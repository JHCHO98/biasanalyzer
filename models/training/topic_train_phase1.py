import torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup
import pandas as pd
from torch.optim import AdamW
from tqdm import tqdm
import numpy as np
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt

# KoELECTRA 모델/토크나이저 로드
MODEL_NAME = 'monologg/koelectra-base-v3-discriminator'

# 설정 상수
MAX_LEN = 128
BATCH_SIZE = 32
NUM_EPOCHS = 500
LEARNING_RATE = 1e-3
NUM_CLASSES = 14
EARLY_STOPPING_PATIENCE = 15   # val_loss 기준 5 에폭 개선 없으면 종료
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

print(f"사용할 장치: {DEVICE}")


# --- 1. 데이터셋 준비 ---

try:
    data = pd.read_csv("crawling_data/data_processed.csv")
    data['text_input'] = data['title_clean'] + " [SEP] " + data['comment_clean'].fillna('')
    train_val_df, test_df = train_test_split(
        data, test_size=0.2, random_state=42, stratify=data['label_id']
    )
    train_df, val_df = train_test_split(
        train_val_df, test_size=0.125, random_state=42, stratify=train_val_df['label_id']
    )
    print(f"Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")
except FileNotFoundError:
    print("경고: 파일을 찾을 수 없습니다. 더미 데이터를 사용합니다.")
    train_data = {
        'title_clean': ['안녕하세요', 'KcELECTRA', '댓글이 중요합니다', '다중 클래스', '코드 작성'],
        'comment_clean': ['영상 리뷰 좋아요', '구어체와 신조어가 많음', '이 모델로 분류합니다', '클래스 15개 충분', '최종적으로 완성'],
        'label_id': [0, 14, 7, 3, 11]
    }
    train_df = pd.DataFrame(train_data)
    val_df = train_df.copy()
    train_df['text_input'] = train_df['title_clean'] + " [SEP] " + train_df['comment_clean']
    val_df['text_input'] = val_df['title_clean'] + " [SEP] " + val_df['comment_clean']


# --- 1-1. Early Stopping 클래스 ---

class EarlyStopping:
    def __init__(self, patience=5, min_delta=0.001, mode='min'):
        """
        patience  : 개선 없이 기다릴 최대 에폭 수
        min_delta : 개선으로 인정할 최소 변화량
        mode      : 'min' (loss 기준) or 'max' (accuracy 기준)
        """
        self.patience = patience
        self.min_delta = min_delta
        self.mode = mode
        self.counter = 0
        self.best_value = float('inf') if mode == 'min' else float('-inf')
        self.should_stop = False

    def __call__(self, value):
        if self.mode == 'min':
            improved = value < self.best_value - self.min_delta
        else:
            improved = value > self.best_value + self.min_delta

        if improved:
            self.best_value = value
            self.counter = 0
        else:
            self.counter += 1
            print(f"   Early Stopping 카운터: {self.counter}/{self.patience}")
            if self.counter >= self.patience:
                self.should_stop = True

    def reset(self):
        self.counter = 0
        self.best_value = float('inf') if self.mode == 'min' else float('-inf')
        self.should_stop = False


# --- 1-2. 커스텀 데이터셋 클래스 ---

class KCELectraDataset(Dataset):
    def __init__(self, df, tokenizer, max_len):
        self.sentences = df['text_input'].tolist()
        self.labels = df['label_id'].values
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        text = self.sentences[idx]
        label = self.labels[idx]

        encoding = self.tokenizer.encode_plus(
            text,
            max_length=self.max_len,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'token_type_ids': encoding['token_type_ids'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }


# 토크나이저 및 데이터로더 생성
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

train_dataset = KCELectraDataset(train_df, tokenizer, MAX_LEN)
val_dataset   = KCELectraDataset(val_df,   tokenizer, MAX_LEN)

train_dataloader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
val_dataloader   = DataLoader(val_dataset,   batch_size=BATCH_SIZE)
test_dataset = KCELectraDataset(test_df, tokenizer, MAX_LEN)
test_dataloader = DataLoader(test_dataset, batch_size=BATCH_SIZE)

# --- 2. 모델 정의 ---

class KCELectraClassifier(torch.nn.Module):
    def __init__(self, electra, num_classes):
        super(KCELectraClassifier, self).__init__()
        self.electra = electra

        # KoELECTRA Freezing
        for param in self.electra.parameters():
            param.requires_grad = False

        # 3층 Classifier
        self.classifier = torch.nn.Sequential(
            torch.nn.Linear(768, 256),
            torch.nn.GELU(),
            torch.nn.Dropout(0.3),

            torch.nn.Linear(256, 64),
            torch.nn.GELU(),
            torch.nn.Dropout(0.3),

            torch.nn.Linear(64, num_classes)
        )

        # 가중치 초기화
        for layer in self.classifier:
            if isinstance(layer, torch.nn.Linear):
                torch.nn.init.xavier_uniform_(layer.weight)
                torch.nn.init.zeros_(layer.bias)

    def forward(self, input_ids, attention_mask, token_type_ids):
        with torch.no_grad():
            outputs = self.electra(
                input_ids=input_ids,
                attention_mask=attention_mask,
                token_type_ids=token_type_ids
            )

        cls_output = outputs[0][:, 0, :]
        logits = self.classifier(cls_output)
        return logits


# 모델 생성
electra_model = AutoModel.from_pretrained(MODEL_NAME)
model = KCELectraClassifier(electra_model, NUM_CLASSES)
model.to(DEVICE)


# --- 3. 학습 설정 ---

# Classifier 파라미터만 optimizer에 등록
optimizer = AdamW(
    filter(lambda p: p.requires_grad, model.parameters()),
    lr=LEARNING_RATE
)

total_steps = len(train_dataloader) * NUM_EPOCHS
scheduler = get_linear_schedule_with_warmup(
    optimizer,
    num_warmup_steps=0,
    num_training_steps=total_steps
)

# 클래스 불균형 보정
if 'label_id' in train_df.columns and len(train_df) > 0:
    full_weights = np.zeros(NUM_CLASSES)
    for idx, count in train_df['label_id'].value_counts().items():
        if count > 0:
            full_weights[idx] = 1.0 / count

    if (full_weights > 0).sum() > 0:
        full_weights = full_weights / full_weights.sum() * (full_weights > 0).sum()

    class_weights = torch.tensor(full_weights, dtype=torch.float).to(DEVICE)
    loss_fn = torch.nn.CrossEntropyLoss(weight=class_weights).to(DEVICE)
    print("✅ 클래스 불균형 보정이 적용되었습니다.")
else:
    loss_fn = torch.nn.CrossEntropyLoss().to(DEVICE)
    print("기본 CrossEntropyLoss가 적용되었습니다.")


# --- 4. 학습 및 평가 함수 ---

def train_epoch(model, data_loader, loss_fn, optimizer, device, scheduler):
    model.train()
    losses = []
    correct_predictions = 0

    for batch in tqdm(data_loader, desc="Training"):
        input_ids      = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        token_type_ids = batch['token_type_ids'].to(device)
        labels         = batch['labels'].to(device)

        outputs = model(input_ids, attention_mask, token_type_ids)
        _, preds = torch.max(outputs, dim=1)
        loss = loss_fn(outputs, labels)

        correct_predictions += torch.sum(preds == labels)
        losses.append(loss.item())

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad()

    return correct_predictions.double() / len(data_loader.dataset), np.mean(losses)


def eval_model(model, data_loader, loss_fn, device):
    model.eval()
    losses = []
    correct_predictions = 0

    with torch.no_grad():
        for batch in tqdm(data_loader, desc="Evaluation"):
            input_ids      = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            token_type_ids = batch['token_type_ids'].to(device)
            labels         = batch['labels'].to(device)

            outputs = model(input_ids, attention_mask, token_type_ids)
            _, preds = torch.max(outputs, dim=1)
            loss = loss_fn(outputs, labels)

            correct_predictions += torch.sum(preds == labels)
            losses.append(loss.item())

    return correct_predictions.double() / len(data_loader.dataset), np.mean(losses)


# --- 5. 학습 루프 ---

history = {
    'train_loss': [],
    'val_loss': [],
    'train_acc': [],
    'val_acc': []
}

early_stopping = EarlyStopping(patience=EARLY_STOPPING_PATIENCE, min_delta=0.001, mode='min')

# 이어서 학습 여부 확인
resume = input("이전 학습을 이어서 하시겠습니까? (y/n): ").strip().lower()

start_epoch  = 0
best_accuracy = 0

if resume == 'y':
    try:
        model = torch.load('best_koelectra_model_test.pt', map_location=DEVICE, weights_only=False)
        model.to(DEVICE)

        checkpoint = torch.load('training_checkpoint.pt', map_location=DEVICE, weights_only=False)
        optimizer.load_state_dict(checkpoint['optimizer_state'])
        scheduler.load_state_dict(checkpoint['scheduler_state'])
        history       = checkpoint['history']
        start_epoch   = checkpoint['epoch'] + 1
        best_accuracy = checkpoint['best_accuracy']

        # Early Stopping 상태 복원
        early_stopping.counter    = checkpoint['es_counter']
        early_stopping.best_value = checkpoint['es_best_value']

        print(f"✅ 체크포인트 로드 완료. Epoch {start_epoch}부터 이어서 학습합니다.")
        print(f"   현재 best accuracy : {best_accuracy:.4f}")
        print(f"   Early Stopping 카운터: {early_stopping.counter}/{early_stopping.patience}")

    except FileNotFoundError as e:
        print(f"⚠️  체크포인트 파일을 찾을 수 없습니다: {e}")
        print("   처음부터 학습을 시작합니다.")
else:
    print("처음부터 학습을 시작합니다.")


print("\n--- 학습 시작 ---")

for epoch in range(start_epoch, start_epoch + NUM_EPOCHS):
    print(f'\nEpoch {epoch + 1}')
    print('-' * 10)

    train_acc, train_loss = train_epoch(
        model, train_dataloader, loss_fn, optimizer, DEVICE, scheduler
    )
    print(f'Train loss {train_loss:.4f} accuracy {train_acc:.4f}')

    val_acc, val_loss = eval_model(
        model, val_dataloader, loss_fn, DEVICE
    )
    print(f'Val   loss {val_loss:.4f} accuracy {val_acc:.4f}')

    history['train_loss'].append(train_loss)
    history['val_loss'].append(val_loss)
    history['train_acc'].append(train_acc.item())
    history['val_acc'].append(val_acc.item())

    # 베스트 모델 저장
    if val_acc > best_accuracy:
        torch.save(model, 'best_koelectra_model_test.pt')
        best_accuracy = val_acc
        print("-> Best model 저장 완료.")

    # 체크포인트 저장
    torch.save({
        'epoch'          : epoch,
        'optimizer_state': optimizer.state_dict(),
        'scheduler_state': scheduler.state_dict(),
        'history'        : history,
        'best_accuracy'  : best_accuracy,
        'es_counter'     : early_stopping.counter,
        'es_best_value'  : early_stopping.best_value,
    }, 'training_checkpoint.pt')

    # Early Stopping 체크
    early_stopping(val_loss)
    if early_stopping.should_stop:
        print(f"\n🛑 Early Stopping 발동! {EARLY_STOPPING_PATIENCE} 에폭 동안 val_loss 개선 없음.")
        print(f"   최종 종료 Epoch: {epoch + 1}")
        break

print("\n--- 학습 완료 ---")


# --- 6. 시각화 ---

def plot_and_save_metrics(history):
    total_epochs = len(history['train_loss'])
    epochs = range(1, total_epochs + 1)

    plt.figure(figsize=(10, 6))
    plt.plot(epochs, history['train_loss'], 'bo-', label='Training Loss')
    plt.plot(epochs, history['val_loss'],   'ro-', label='Validation Loss')
    plt.title('Training and Validation Loss')
    plt.xlabel('Epochs')
    plt.ylabel('Loss')
    plt.legend()
    plt.grid(True)
    plt.savefig('loss_plot.png')
    plt.close()
    print("✅ Loss 그래프 저장 완료.")

    plt.figure(figsize=(10, 6))
    plt.plot(epochs, history['train_acc'], 'bo-', label='Training Accuracy')
    plt.plot(epochs, history['val_acc'],   'ro-', label='Validation Accuracy')
    plt.title('Training and Validation Accuracy')
    plt.xlabel('Epochs')
    plt.ylabel('Accuracy')
    plt.legend()
    plt.grid(True)
    plt.savefig('accuracy_plot.png')
    plt.close()
    print("✅ Accuracy 그래프 저장 완료.")

plot_and_save_metrics(history)