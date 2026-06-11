import torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay, accuracy_score, f1_score
import matplotlib.pyplot as plt
from tqdm import tqdm

# --- 설정 상수 (기존 학습 조건과 동일하게 설정) ---
MODEL_NAME = 'monologg/koelectra-base-v3-discriminator'
MAX_LEN = 128
BATCH_SIZE = 32
NUM_CLASSES = 14
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

print(f"✅ 평가 장치: {DEVICE}")

# --- 1. Test 데이터셋 준비 (기존 분할 방식 보존) ---
try:
    data = pd.read_csv("models/Data/data_processed/TopicDataset_processed.csv")
    data['text_input'] = data['title_clean'] + " [SEP] " + data['comment_clean'].fillna('')
    
    # 학습 때와 동일한 random_state와 stratify를 사용하여 Test 세트(20%)를 정확히 분리
    _, test_df = train_test_split(
        data, test_size=0.2, random_state=42, stratify=data['label_id']
    )
    print(f"📋 로드된 Test 데이터 수: {len(test_df)}개")
except FileNotFoundError:
    print("❌ 에러: 'models/Data/data_processed/TopicDataset_processed.csv' 파일을 찾을 수 없습니다.")
    exit()

# --- 2. 커스텀 데이터셋 클래스 정의 ---
class KCELectraDataset(Dataset):
    def __init__(self, df, tokenizer, max_len):
        self.sentences = df['text_input'].tolist()
        self.labels = df['label_id'].values
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        encoding = self.tokenizer.encode_plus(
            self.sentences[idx],
            max_length=self.max_len,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'token_type_ids': encoding['token_type_ids'].flatten(),
            'labels': torch.tensor(self.labels[idx], dtype=torch.long)
        }

# 토크나이저 및 데이터로더 생성
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
test_dataset = KCELectraDataset(test_df, tokenizer, MAX_LEN)
test_dataloader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)

class KCELectraClassifier(torch.nn.Module):
    def __init__(self, electra, num_classes, unfreeze_last_n_layers=3):
        super(KCELectraClassifier, self).__init__()
        self.electra = electra

        # 1차 frozen / 2차 unfreeze 구조 호환용
        encoder_layers = self.electra.encoder.layer
        total_layers   = len(encoder_layers)
        unfreeze_from  = total_layers - unfreeze_last_n_layers

        # 3층 Classifier 구조 정의
        self.classifier = torch.nn.Sequential(
            torch.nn.Linear(768, 256),
            torch.nn.GELU(),
            torch.nn.Dropout(0.3),
            torch.nn.Linear(256, 64),
            torch.nn.GELU(),
            torch.nn.Dropout(0.3),
            torch.nn.Linear(64, num_classes)
        )

    def forward(self, input_ids, attention_mask, token_type_ids):
        outputs = self.electra(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids
        )
        cls_output = outputs[0][:, 0, :]
        return self.classifier(cls_output)
# ==========================================================


# --- 3. 저장된 .pt 모델 로드 ---
MODEL_PATH = 'models/training/topic-classifier_final.pt'

try:
    print(f"🔄 '{MODEL_PATH}' 모델 파일 로드 중...")
    # 💡 이제 위에 클래스가 선언되었으므로 정상적으로 로드됩니다!
    model = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
    model.to(DEVICE)
    model.eval() 
    print("✅ 모델 로드 성공!")
except FileNotFoundError:
    print(f"❌ 에러: 지정한 모델 파일({MODEL_PATH})을 찾을 수 없습니다.")
    exit()

# --- 4. Test 데이터 예측 및 지표 계산 ---
all_preds = []
all_labels = []

print("\n🚀 Test 데이터 추론 시작...")
with torch.no_grad(): # Gradient 계산 비활성화 (메모리 절약)
    for batch in tqdm(test_dataloader, desc="Testing"):
        input_ids = batch['input_ids'].to(DEVICE)
        attention_mask = batch['attention_mask'].to(DEVICE)
        token_type_ids = batch['token_type_ids'].to(DEVICE)
        labels = batch['labels'].to(DEVICE)

        outputs = model(input_ids, attention_mask, token_type_ids)
        _, preds = torch.max(outputs, dim=1)

        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

# 리스트를 numpy 배열로 변환
all_preds = np.array(all_preds)
all_labels = np.array(all_labels)


# --- 5. 최종 결과 출력 ---
final_accuracy = accuracy_score(all_labels, all_preds)
final_macro_f1 = f1_score(all_labels, all_preds, average='macro')
final_weighted_f1 = f1_score(all_labels, all_preds, average='weighted')

print("\n" + "="*50)
print("📊 [최종 종합 평가 결과]")
print(f"🔹 Test Accuracy     : {final_accuracy:.4f} ({final_accuracy*100:.2f}%)")
print(f"🔹 Test Macro F1     : {final_macro_f1:.4f}")
print(f"🔹 Test Weighted F1  : {final_weighted_f1:.4f}")
print("="*50)

print("\n📝 [클래스별 상세 점수 (Classification Report)]")
# 14개 클래스에 대응하는 이름을 붙이고 싶다면 target_names=[...] 매개변수를 추가하세요.
print(classification_report(all_labels, all_preds, digits=4))


# --- 6. 포스터/보고서용 깔끔한 Confusion Matrix 시각화 및 저장 ---
print("🎨 Confusion Matrix 시각화 및 이미지 저장 중...")
cm = confusion_matrix(all_labels, all_preds)

fig, ax = plt.subplots(figsize=(11, 9), dpi=300) # 고해상도 설정
disp = ConfusionMatrixDisplay(confusion_matrix=cm)

# 포스터 분위기에 잘 맞는 Blues 또는 Purples, Deep 오렌지 계열 컬러 매핑 가능 ('Blues', 'viridis' 등)
disp.plot(ax=ax, cmap='Blues', values_format='d') 

plt.title('Final Test Confusion Matrix', fontsize=16, fontweight='bold', pad=15)
plt.tight_layout()

output_filename = 'models/result/final_test_confusion_matrix.png'
plt.savefig(output_filename, bbox_inches='tight', transparent=True)
plt.close()

print(f"✅ Confusion Matrix 이미지 저장 완료: '{output_filename}'")