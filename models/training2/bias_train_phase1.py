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
MODEL_PATH = OUTPUT_DIR / "bias_multitask_phase1.pt"
LOG_PATH = OUTPUT_DIR / "bias_multitask_phase1.log"

CONFIG = {
    "model_name": "beomi/KcELECTRA-base",
    "num_target_classes": 4,
    "num_attitude_classes": 4,
    "intermediate_dim": 512,
    "batch_size": 4,
    "epochs": 100,
    "learning_rate": 1e-4,
    "device": "cuda" if torch.cuda.is_available() else "cpu",
}


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


def class_weights(series, num_classes, device):
    counts = series.value_counts().reindex(range(num_classes), fill_value=0).to_numpy()
    if np.any(counts == 0):
        raise ValueError(f"학습 데이터에 없는 클래스가 있습니다: {counts.tolist()}")
    weights = len(series) / (num_classes * counts)
    return torch.tensor(weights, dtype=torch.float32, device=device), counts


def make_loader(frame, batch_size, shuffle=False):
    dataset = YouTubeBiasMultiTaskDataset(frame.to_dict("records"))
    return DataLoader(
        dataset, batch_size=batch_size, shuffle=shuffle, collate_fn=collate_fn
    )


def evaluate(model, loader, target_loss_fn, attitude_loss_fn, device):
    model.eval()
    loss_sum = target_correct = attitude_correct = total = 0
    with torch.no_grad():
        for texts, targets, attitudes in loader:
            targets, attitudes = targets.to(device), attitudes.to(device)
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
    device = torch.device(CONFIG["device"])
    model = BiasAnalyzerMultiTask(CONFIG)
    for parameter in model.bert.parameters():
        parameter.requires_grad = False

    train_df = pd.read_csv(DATA_DIR / "bias_train1_merged.csv")
    vali_df = pd.read_csv(DATA_DIR / "bias_vali1_merged.csv")
    test_df = pd.read_csv(DATA_DIR / "bias_test1_merged.csv")

    target_weights, target_counts = class_weights(
        train_df["target"], CONFIG["num_target_classes"], device
    )
    attitude_weights, attitude_counts = class_weights(
        train_df["attitude"], CONFIG["num_attitude_classes"], device
    )
    print(f"Target counts: {target_counts}, weights: {target_weights.cpu().numpy()}")
    print(f"Attitude counts: {attitude_counts}, weights: {attitude_weights.cpu().numpy()}")

    train_loader = make_loader(train_df, CONFIG["batch_size"], shuffle=True)
    val_loader = make_loader(vali_df, CONFIG["batch_size"])
    test_loader = make_loader(test_df, CONFIG["batch_size"])
    target_loss_fn = nn.CrossEntropyLoss(weight=target_weights, label_smoothing=0.1)
    attitude_loss_fn = nn.CrossEntropyLoss(
        weight=attitude_weights, label_smoothing=0.1
    )
    optimizer = optim.AdamW(
        filter(lambda parameter: parameter.requires_grad, model.parameters()),
        lr=CONFIG["learning_rate"],
    )

    best_score = -1.0
    for epoch in range(CONFIG["epochs"]):
        model.train()
        train_loss = 0.0
        for texts, targets, attitudes in train_loader:
            targets, attitudes = targets.to(device), attitudes.to(device)
            optimizer.zero_grad()
            target_logits, attitude_logits, _ = model(texts)
            loss = target_loss_fn(target_logits, targets) + attitude_loss_fn(
                attitude_logits, attitudes
            )
            loss.backward()
            optimizer.step()
            train_loss += loss.item()

        val_loss, target_acc, attitude_acc = evaluate(
            model, val_loader, target_loss_fn, attitude_loss_fn, device
        )
        score = (target_acc + attitude_acc) / 2
        print(
            f"Epoch {epoch + 1:03d}/{CONFIG['epochs']} | "
            f"Train Loss: {train_loss / len(train_loader):.4f} | "
            f"Val Loss: {val_loss:.4f} | Target Acc: {target_acc:.4f} | "
            f"Attitude Acc: {attitude_acc:.4f} | Mean Acc: {score:.4f}"
        )
        if score > best_score:
            best_score = score
            torch.save({"config": CONFIG, "model_state_dict": model.state_dict()}, MODEL_PATH)
            print(f"  => Best checkpoint saved: {best_score:.4f}")

    checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    _, target_acc, attitude_acc = evaluate(
        model, test_loader, target_loss_fn, attitude_loss_fn, device
    )
    print(f"Test Target Acc: {target_acc:.4f}")
    print(f"Test Attitude Acc: {attitude_acc:.4f}")


if __name__ == "__main__":
    train()
