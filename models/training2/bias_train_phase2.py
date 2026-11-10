import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from biasanalyzer_multitask_model import (
    BiasAnalyzerMultiTask,
    YouTubeBiasMultiTaskDataset,
    collate_fn,
)


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "Data" / "data_2"
OUTPUT_DIR = Path(__file__).resolve().parent
LOAD_PATH = OUTPUT_DIR / "bias_multitask_phase1.pt"
SAVE_PATH = OUTPUT_DIR / "bias_multitask_final.pt"
LOG_PATH = OUTPUT_DIR / "bias_multitask_phase2.log"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
BATCH_SIZE = 16
MAX_EPOCHS = 500
LEARNING_RATE = 2e-5
EARLY_STOPPING_PATIENCE = 50


class Logger:
    def __init__(self, path):
        self.terminal = sys.stdout
        self.log = open(path, "w", encoding="utf-8")

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)

    def flush(self):
        self.terminal.flush()
        self.log.flush()


def smoothed_class_weights(series, num_classes):
    counts = series.value_counts().reindex(range(num_classes), fill_value=0).to_numpy()
    if np.any(counts == 0):
        raise ValueError(f"학습 데이터에 없는 클래스가 있습니다: {counts.tolist()}")
    weights = 1.0 / np.sqrt(counts)
    weights = weights / weights.sum() * num_classes
    return torch.tensor(weights, dtype=torch.float32, device=DEVICE), counts


def make_loader(frame, shuffle=False):
    dataset = YouTubeBiasMultiTaskDataset(frame.to_dict("records"))
    return DataLoader(
        dataset, batch_size=BATCH_SIZE, shuffle=shuffle, collate_fn=collate_fn
    )


def evaluate(model, loader, target_loss_fn, attitude_loss_fn):
    model.eval()
    loss_sum = target_correct = attitude_correct = total = 0
    with torch.no_grad():
        for texts, targets, attitudes in loader:
            targets, attitudes = targets.to(DEVICE), attitudes.to(DEVICE)
            target_logits, attitude_logits, _ = model(texts)
            loss = target_loss_fn(target_logits, targets) + attitude_loss_fn(
                attitude_logits, attitudes
            )
            loss_sum += loss.item()
            target_correct += (target_logits.argmax(1) == targets).sum().item()
            attitude_correct += (attitude_logits.argmax(1) == attitudes).sum().item()
            total += targets.size(0)
    return loss_sum / len(loader), target_correct / total, attitude_correct / total


def train():
    sys.stdout = Logger(LOG_PATH)
    if not LOAD_PATH.exists():
        raise FileNotFoundError(f"Phase 1 checkpoint가 없습니다: {LOAD_PATH}")

    checkpoint = torch.load(LOAD_PATH, map_location=DEVICE, weights_only=False)
    config = checkpoint["config"]
    config["device"] = str(DEVICE)
    model = BiasAnalyzerMultiTask(config)
    model.load_state_dict(checkpoint["model_state_dict"])

    for parameter in model.parameters():
        parameter.requires_grad = False
    for layer_index in range(8, 12):
        for parameter in model.bert.encoder.layer[layer_index].parameters():
            parameter.requires_grad = True
    for module in (
        model.title_to_comment_attn,
        model.comment_to_title_attn,
        model.shared_classifier,
        model.target_classifier,
        model.attitude_classifier,
    ):
        for parameter in module.parameters():
            parameter.requires_grad = True

    train_df = pd.read_csv(DATA_DIR / "bias_train2_merged.csv")
    vali_df = pd.read_csv(DATA_DIR / "bias_vali2_merged.csv")
    test_df = pd.read_csv(DATA_DIR / "bias_test2_merged.csv")
    target_weights, target_counts = smoothed_class_weights(
        train_df["target"], config["num_target_classes"]
    )
    attitude_weights, attitude_counts = smoothed_class_weights(
        train_df["attitude"], config["num_attitude_classes"]
    )
    print(f"Target counts: {target_counts}, weights: {target_weights.cpu().numpy()}")
    print(f"Attitude counts: {attitude_counts}, weights: {attitude_weights.cpu().numpy()}")

    train_loader = make_loader(train_df, shuffle=True)
    val_loader = make_loader(vali_df)
    test_loader = make_loader(test_df)
    target_loss_fn = nn.CrossEntropyLoss(weight=target_weights, label_smoothing=0.1)
    attitude_loss_fn = nn.CrossEntropyLoss(
        weight=attitude_weights, label_smoothing=0.1
    )
    optimizer = optim.AdamW(
        filter(lambda parameter: parameter.requires_grad, model.parameters()),
        lr=LEARNING_RATE,
    )
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=2
    )

    best_score = -1.0
    early_stop_count = 0
    for epoch in range(MAX_EPOCHS):
        model.train()
        train_loss = 0.0
        for texts, targets, attitudes in train_loader:
            targets, attitudes = targets.to(DEVICE), attitudes.to(DEVICE)
            optimizer.zero_grad()
            target_logits, attitude_logits, _ = model(texts)
            loss = target_loss_fn(target_logits, targets) + attitude_loss_fn(
                attitude_logits, attitudes
            )
            loss.backward()
            optimizer.step()
            train_loss += loss.item()

        val_loss, target_acc, attitude_acc = evaluate(
            model, val_loader, target_loss_fn, attitude_loss_fn
        )
        score = (target_acc + attitude_acc) / 2
        scheduler.step(score)
        print(
            f"Epoch {epoch + 1:03d} | Train Loss: {train_loss / len(train_loader):.4f} | "
            f"Val Loss: {val_loss:.4f} | Target Acc: {target_acc:.4f} | "
            f"Attitude Acc: {attitude_acc:.4f} | Mean Acc: {score:.4f}"
        )
        if score > best_score:
            best_score = score
            early_stop_count = 0
            torch.save({"config": config, "model_state_dict": model.state_dict()}, SAVE_PATH)
            print(f"  => Best checkpoint saved: {best_score:.4f}")
        else:
            early_stop_count += 1
            if early_stop_count >= EARLY_STOPPING_PATIENCE:
                print("Early stopping")
                break

    best_checkpoint = torch.load(SAVE_PATH, map_location=DEVICE, weights_only=False)
    model.load_state_dict(best_checkpoint["model_state_dict"])
    _, target_acc, attitude_acc = evaluate(
        model, test_loader, target_loss_fn, attitude_loss_fn
    )
    print(f"Test Target Acc: {target_acc:.4f}")
    print(f"Test Attitude Acc: {attitude_acc:.4f}")


if __name__ == "__main__":
    train()
