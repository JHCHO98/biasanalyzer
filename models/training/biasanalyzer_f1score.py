import torch
import pandas as pd
import numpy as np
from torch.utils.data import DataLoader
from sklearn.metrics import f1_score, classification_report, confusion_matrix
import torch.nn.functional as F  # Loss 계산을 위해 추가
import sys

sys.path.append(r'c:\Users\user\Desktop\BiasAnalyzer\models\training')
sys.modules['model'] = sys.modules[__name__]
from biasanalyzer_model import BiasAnalyzer, YouTubeBiasDataset, collate_fn

# --- 설정 ---
MODEL_PATH = f'models/training/bias_final.pt'
TEST_CSV   = 'models/Data/data_processed/bias_test2_merged.csv'
TARGET_NAMES = ['진보', '보수', '중립']
BATCH_SIZE = 16
device = 'cuda' if torch.cuda.is_available() else 'cpu'

# --- 모델 & 데이터 로드 ---
print(f"\n모델 로드 중: {MODEL_PATH}")
model = torch.load(MODEL_PATH, weights_only=False, map_location=device)
model.eval()

# 클래스 불균형이 심할 경우 학습 시 사용했던 weights를 CrossEntropyLoss에 넣어주면 정확한 비교가 가능합니다.
# 여기서는 일반적인 Loss 확인을 위해 기본 CrossEntropy를 사용합니다.
criterion = torch.nn.CrossEntropyLoss() 

test_df = pd.read_csv(TEST_CSV)
test_loader = DataLoader(
    YouTubeBiasDataset(test_df.to_dict('records')),
    batch_size=BATCH_SIZE,
    collate_fn=collate_fn
)
print(f"테스트 샘플 수: {len(test_df)}")

# --- 추론 및 Loss 계산 ---
all_preds, all_labels = [], []
total_loss = 0.0

with torch.no_grad():
    for texts, labels in test_loader:
        labels = labels.to(device)
        logits, _ = model(texts)
        
        # Loss 계산
        loss = criterion(logits, labels)
        total_loss += loss.item() * labels.size(0) # 배치의 평균 loss에 배치 크기를 곱해 합산
        
        preds = torch.argmax(logits, dim=1)
        all_preds.extend(preds.cpu().tolist())
        all_labels.extend(labels.cpu().tolist())

# --- 지표 계산 ---
avg_loss = total_loss / len(all_labels) # 전체 샘플 수로 나눠 최종 평균 Loss 산출
acc    = sum(p == l for p, l in zip(all_preds, all_labels)) / len(all_labels)
f1_mac = f1_score(all_labels, all_preds, average='macro')
f1_wei = f1_score(all_labels, all_preds, average='weighted')

# --- 결과 출력 ---
print("\n" + "=" * 40)
print(f"Test Loss       : {avg_loss:.4f}") # 추가된 부분
print(f"Accuracy        : {acc:.4f}")
print(f"F1 (macro)      : {f1_mac:.4f}")
print(f"F1 (weighted)   : {f1_wei:.4f}")
print("=" * 40)

print("\n[Classification Report]")
print(classification_report(all_labels, all_preds, target_names=TARGET_NAMES))

print("[Confusion Matrix]")
print(confusion_matrix(all_labels, all_preds))