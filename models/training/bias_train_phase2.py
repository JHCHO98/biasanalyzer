import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
import sys
import os
import numpy as np  # 클래스 가중치 계산을 위해 추가
import matplotlib.pyplot as plt
from torch.utils.data import DataLoader
from biasanalyzer_model import BiasAnalyzer, YouTubeBiasDataset, collate_fn

# 로그 기록용 클래스
class Logger(object):
    def __init__(self, path):
        self.terminal = sys.stdout
        self.log = open(path, "w", encoding='utf-8')
    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)
    def flush(self): pass

# --- 설정 및 경로 ---
LOG_PATH = f'models/result/biasanalyzer_log/log_phase2_.txt'
LOAD_PATH = f'models/training/bias.pt'
SAVE_PATH = f'models/training/bias_final.pt'
SUMMARY_PLOT_PATH = f'models/result/biasanalyzer_plots/summary_phase2_.png'

sys.stdout = Logger(LOG_PATH)
device = 'cuda' if torch.cuda.is_available() else 'cpu'
NUM_CLASSES = 3  # 클래스 수 명시 (가중치 계산용)

def resume_training():
    print(f"--- Phase 2 미세 조정 시작 (Device: {device}) ---")
    
    # 1. 모델 로드 및 레이어 해동 전략
    if not os.path.exists(LOAD_PATH):
        print(f"❌ 에러: {LOAD_PATH} 모델 파일이 없습니다.")
        return

    model = torch.load(LOAD_PATH, weights_only=False)
    model.to(device)

    for param in model.parameters(): param.requires_grad = False
    
    # 상위 레이어 및 분류기 해동
    for i in range(8, 12): 
        for param in model.bert.encoder.layer[i].parameters(): param.requires_grad = True
    for module in [model.title_to_comment_attn, model.comment_to_title_attn, model.classifier]:
        for param in module.parameters(): param.requires_grad = True

    # 2. 이미 분할된 데이터 로드 (URL 기준 분할된 파일들)
    print("--- 분할된 Phase 2 데이터 로드 중 ---")
    train_df = pd.read_csv("models/Data/data_processed/bias_train2_merged.csv")
    vali_df = pd.read_csv("models/Data/data_processed/bias_vali2_merged.csv")
    test_df = pd.read_csv("models/Data/data_processed/bias_test2_merged.csv")

    # ================= [변경 포인트 1] Phase 2 학습 데이터 기반 가중치 계산 =================
    # 데이터프레임의 정답 라벨 컬럼명에 맞게 'label' 부분을 수정하세요.
    label_column = 'label' 
    
    # 클래스별 데이터 개수 및 가중치 계산
    class_counts = train_df[label_column].value_counts().sort_index().values
    total_samples = len(train_df)
    class_weights = total_samples / (NUM_CLASSES * class_counts)
    
    # 디바이스로 이동시킬 텐서 생성
    class_weights_tensor = torch.FloatTensor(class_weights).to(device)
    
    print(f"Phase 2 클래스별 데이터 수: {class_counts}")
    print(f"Phase 2 적용 가중치: {class_weights}")
    # ====================================================================================

    train_loader = DataLoader(YouTubeBiasDataset(train_df.to_dict('records')), batch_size=16, shuffle=True, collate_fn=collate_fn)
    val_loader = DataLoader(YouTubeBiasDataset(vali_df.to_dict('records')), batch_size=16, collate_fn=collate_fn)
    test_loader = DataLoader(YouTubeBiasDataset(test_df.to_dict('records')), batch_size=16, collate_fn=collate_fn)

    optimizer = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=5e-6)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=2)
    
    # ================= [변경 포인트 2] Loss 함수에 불균형 가중치 주입 =================
    criterion = nn.CrossEntropyLoss(weight=class_weights_tensor, label_smoothing=0.1)
    # ====================================================================================

    history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': []}
    best_acc = 0.7261
    early_stop_count = 0

    # 3. 학습 루프
    for epoch in range(500):
        model.train()
        t_loss, t_correct, t_total = 0, 0, 0
        for texts, labels in train_loader:
            labels = labels.to(device)
            optimizer.zero_grad()
            logits, _ = model(texts)
            loss = criterion(logits, labels)
            loss.backward(); optimizer.step()
            
            t_loss += loss.item()
            t_correct += (torch.argmax(logits, 1) == labels).sum().item()
            t_total += labels.size(0)
        
        model.eval()
        v_loss, v_correct, v_total = 0, 0, 0
        with torch.no_grad():
            for texts, labels in val_loader:
                labels = labels.to(device)
                logits, _ = model(texts)
                v_loss += criterion(logits, labels).item()
                v_correct += (torch.argmax(logits, 1) == labels).sum().item()
                v_total += labels.size(0)

        # 결과 기록
        train_loss_avg = t_loss / len(train_loader)
        val_loss_avg = v_loss / len(val_loader)
        train_acc = t_correct / t_total
        val_acc = v_correct / v_total
        
        history['train_loss'].append(train_loss_avg)
        history['val_loss'].append(val_loss_avg)
        history['train_acc'].append(train_acc)
        history['val_acc'].append(val_acc)

        scheduler.step(val_acc)
        print(f"Epoch {epoch+1:03d} | T-Loss: {train_loss_avg:.4f} | V-Loss: {val_loss_avg:.4f} | V-Acc: {val_acc:.4f}")
        
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model, SAVE_PATH)
            print(f"⭐️ [갱신] 최고 정확도: {best_acc:.4f}")
            early_stop_count = 0
        else:
            early_stop_count += 1
            if early_stop_count >= 50:
                print("🛑 조기 종료 (Early Stopping)")
                break

    # 4. 최종 Test 세트 평가 (진짜 성능 확인)
    print("\n" + "="*30)
    print("--- 최종 Test 세트 평가 (Best Model) ---")
    best_model = torch.load(SAVE_PATH, weights_only=False)
    best_model.eval()
    test_correct, test_total = 0, 0
    with torch.no_grad():
        for texts, labels in test_loader:
            labels = labels.to(device)
            logits, _ = best_model(texts)
            test_correct += (torch.argmax(logits, 1) == labels).sum().item()
            test_total += labels.size(0)
    print(f"최종 Test Accuracy: {test_correct / test_total:.4f}")
    print("="*30)

    # 5. 시각화
    epochs_range = range(1, len(history['train_loss']) + 1)
    plt.figure(figsize=(12, 5))
    
    plt.subplot(1, 2, 1)
    plt.plot(epochs_range, history['train_loss'], label='Train Loss')
    plt.plot(epochs_range, history['val_loss'], label='Val Loss')
    plt.title('Phase 2 Loss'); plt.legend(); plt.grid(True)
    
    plt.subplot(1, 2, 2)
    plt.plot(epochs_range, history['train_acc'], label='Train Acc')
    plt.plot(epochs_range, history['val_acc'], label='Val Acc')
    plt.title('Phase 2 Accuracy'); plt.legend(); plt.grid(True)
    
    plt.savefig(SUMMARY_PLOT_PATH)
    print(f"✅ 그래프 저장 완료: {SUMMARY_PLOT_PATH}")

if __name__ == "__main__":
    resume_training()