import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
import sys
import numpy as np  # 클래스 가중치 계산을 위해 추가
from torch.utils.data import DataLoader
from sklearn.model_selection import train_test_split
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
CONFIG = {
    'model_name': "beomi/KcELECTRA-base",
    'num_classes': 3,
    'batch_size': 4,
    'epochs': 100,
    'learning_rate': 1e-4,
    'device': 'cuda' if torch.cuda.is_available() else 'cpu'
}
LOG_PATH = f'models/result/biasanalyzer_log/log_phase1_.txt'
MODEL_PATH = f'models/training/bias.pt'
sys.stdout = Logger(LOG_PATH)

def train():
    print(f"--- 새 모델 초기화 시작 ---")
    model = BiasAnalyzer(CONFIG)
    for param in model.bert.parameters():
        param.requires_grad = False

    # 2. 분할된 파일 로드
    print("--- 분할된 데이터 로드 중 ---")
    train_df = pd.read_csv("models/Data/data_processed/bias_train1_merged.csv")
    vali_df = pd.read_csv("models/Data/data_processed/bias_vali1_merged.csv")
    test_df = pd.read_csv("models/Data/data_processed/bias_test1_merged.csv")

    # ================= [변경 포인트 1] 클래스 불균형을 위한 가중치 계산 =================
    # 데이터프레임의 정답 라벨 컬럼명을 'label'이라고 가정했습니다. 실제 컬럼명으로 변경하세요.
    label_column = 'label' 
    
    # 클래스별 데이터 개수 세기
    class_counts = train_df[label_column].value_counts().sort_index().values
    total_samples = len(train_df)
    
    # 가중치 계산 공식: 전체 샘플 수 / (클래스 수 * 클래스별 샘플 수)
    class_weights = total_samples / (CONFIG['num_classes'] * class_counts)
    
    # PyTorch 텐서로 변환 후 지정된 디바이스(GPU/CPU)로 이동
    class_weights_tensor = torch.FloatTensor(class_weights).to(CONFIG['device'])
    
    print(f"클래스별 데이터 수: {class_counts}")
    print(f"적용될 클래스별 가중치: {class_weights}")
    # ====================================================================================

    # DataLoader 설정
    train_loader = DataLoader(
        YouTubeBiasDataset(train_df.to_dict('records')), 
        batch_size=CONFIG['batch_size'], shuffle=True, collate_fn=collate_fn
    )
    val_loader = DataLoader(
        YouTubeBiasDataset(vali_df.to_dict('records')), 
        batch_size=CONFIG['batch_size'], collate_fn=collate_fn
    )
    test_loader = DataLoader(
        YouTubeBiasDataset(test_df.to_dict('records')), 
        batch_size=CONFIG['batch_size'], collate_fn=collate_fn
    )

    print(f"로드 완료 - Train: {len(train_df)}, Vali: {len(vali_df)}, Test: {len(test_df)}")

    # 3. Optimizer 및 Loss 설정
    optimizer = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=CONFIG['learning_rate'])
    
    # ================= [변경 포인트 2] Loss 함수에 가중치 주입 =================
    # label_smoothing과 클래스 가중치(weight)를 함께 적용합니다.
    criterion = nn.CrossEntropyLoss(weight=class_weights_tensor, label_smoothing=0.1)
    # ====================================================================================
    
    best_acc = 0.0

    # 4. 학습 루프
    print(f"학습 시작: 총 {CONFIG['epochs']} Epoch")
    for epoch in range(CONFIG['epochs']):
        # --- Training Phase ---
        model.train()
        t_loss = 0
        for texts, labels in train_loader:
            labels = labels.to(CONFIG['device'])
            optimizer.zero_grad()
            logits, _ = model(texts)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            t_loss += loss.item()
        
        # --- Validation Phase ---
        model.eval()
        v_loss, correct, total = 0, 0, 0
        with torch.no_grad():
            for texts, labels in val_loader:
                labels = labels.to(CONFIG['device'])
                logits, _ = model(texts)
                
                # Validation Loss 계산 (여기서도 불균형 가중치가 적용된 loss를 봅니다)
                batch_loss = criterion(logits, labels)
                v_loss += batch_loss.item()
                
                preds = torch.argmax(logits, dim=1)
                correct += (preds == labels).sum().item()
                total += labels.size(0)
        
        avg_train_loss = t_loss / len(train_loader)
        avg_val_loss = v_loss / len(val_loader)
        val_acc = correct / total
        
        # Train Loss와 Val Loss를 함께 출력
        print(f"Epoch {epoch+1:03d}/{CONFIG['epochs']} | "
              f"Train Loss: {avg_train_loss:.4f} | "
              f"Val Loss: {avg_val_loss:.4f} | "
              f"Val Acc: {val_acc:.4f}")
        
        # Best 모델 저장 (Accuracy 기준)
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model, MODEL_PATH)
            print(f"    => [Best Model Saved] Acc: {best_acc:.4f}")

    # 5. 최종 Test 평가
    print("\n" + "="*30)
    print("최종 Test 세트 평가 (Best Model)")
    final_model = torch.load(MODEL_PATH, weights_only=False)
    final_model.eval()
    t_correct, t_total = 0, 0
    with torch.no_grad():
        for texts, labels in test_loader:
            labels = labels.to(CONFIG['device'])
            logits, _ = final_model(texts)
            preds = torch.argmax(logits, dim=1)
            t_correct += (preds == labels).sum().item()
            t_total += labels.size(0)
    
    print(f"최종 Test Accuracy: {t_correct / t_total:.4f}")
    print("="*30)

if __name__ == "__main__":
    train()