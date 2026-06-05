import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
import sys
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
TRIAL=int(input('몇 번째 모델이신가요??: '))
CONFIG = {
    'model_name': "beomi/KcELECTRA-base",
    'num_classes': 3,
    'batch_size': 4,
    'epochs': 100,
    'learning_rate': 2e-5,
    'device': 'cuda' if torch.cuda.is_available() else 'cpu'
}
LOG_PATH = f'models/result/biasanalyzer_log/log_phase1_{TRIAL}.txt'
MODEL_PATH = f'models/result/biasanalyzer_model/bias{TRIAL}.pt'
sys.stdout = Logger(LOG_PATH)
def train():
    # 1. 학습 재개 여부 확인
    resume = input("기존 모델을 이어서 학습하시겠습니까? (y/n): ").lower()
    
    if resume == 'y':
        print(f"--- {MODEL_PATH}에서 모델을 불러오는 중 ---")
        model = torch.load(MODEL_PATH, weights_only=False)
        model.to(CONFIG['device'])
    else:
        print(f"--- 새 모델 초기화 시작 ---")
        model = BiasAnalyzer(CONFIG)
        for param in model.bert.parameters():
            param.requires_grad = False

    # 2. 분할된 파일 로드
    # 저장하신 파일명에 맞게 경로를 수정하세요.
    print("--- 분할된 데이터 로드 중 ---")
    train_df = pd.read_csv("models/Data/data_processed/train1_merged.csv")
    vali_df = pd.read_csv("models/Data/data_processed/vali1_merged.csv")
    test_df = pd.read_csv("models/Data/data_processed/test1_merged.csv")

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

    # 3. Optimizer 및 Loss
# 3. Optimizer 및 Loss
    optimizer = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=CONFIG['learning_rate'])
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
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
                
                # Validation Loss 계산
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
            print(f"   => [Best Model Saved] Acc: {best_acc:.4f}")

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