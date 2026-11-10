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
NUM_EPOCHS = 30
NUM_CLASSES = 14
EARLY_STOPPING_PATIENCE = 5
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# ============================================================
# [핵심] Unfreezing 설정
# KoELECTRA base는 총 12개 layer (0~11), 숫자가 클수록 상위 레이어
# UNFREEZE_LAST_N_LAYERS = 3 이면 layer 9, 10, 11 + pooler가 학습됨
# ============================================================
UNFREEZE_LAST_N_LAYERS = 3

# Learning Rate 설정 (레이어별로 다르게 적용 - Discriminative LR)
# 상위 레이어일수록 더 큰 LR, 하위 레이어일수록 더 작은 LR
LR_CLASSIFIER    = 1e-3   # Classifier head
LR_TOP_LAYERS    = 5e-5   # Unfreezing된 KoELECTRA 상위 레이어
LR_BOTTOM_LAYERS = 1e-5   # Unfreezing된 KoELECTRA 하위 레이어 (있을 경우)

print(f"사용할 장치: {DEVICE}")
print(f"KoELECTRA 하위 {UNFREEZE_LAST_N_LAYERS}개 레이어 unfreezing")


# --- 1. 데이터셋 준비 ---

try:
    data = pd.read_csv("models/Data/data_processed/TopicDataset_processed.csv")
    data['text_input'] = data['title'] + " [SEP] " + data['comment'].fillna('')
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
        'title':   ['안녕하세요', 'KcELECTRA', '댓글이 중요합니다', '다중 클래스', '코드 작성'],
        'comment': ['영상 리뷰 좋아요', '구어체와 신조어가 많음', '이 모델로 분류합니다', '클래스 15개 충분', '최종적으로 완성'],
        'label_id':      [0, 14, 7, 3, 11]
    }
    train_df = pd.DataFrame(train_data)
    val_df   = train_df.copy()
    train_df['text_input'] = train_df['title'] + " [SEP] " + train_df['comment']
    val_df['text_input']   = val_df['title']   + " [SEP] " + val_df['comment']


# --- 1-1. Early Stopping 클래스 ---

class EarlyStopping:
    def __init__(self, patience=5, min_delta=0.001, mode='min'):
        self.patience   = patience
        self.min_delta  = min_delta
        self.mode       = mode
        self.counter    = 0
        self.best_value = float('inf') if mode == 'min' else float('-inf')
        self.should_stop = False

    def __call__(self, value):
        improved = (
            value < self.best_value - self.min_delta if self.mode == 'min'
            else value > self.best_value + self.min_delta
        )
        if improved:
            self.best_value = value
            self.counter    = 0
        else:
            self.counter += 1
            print(f"   Early Stopping 카운터: {self.counter}/{self.patience}")
            if self.counter >= self.patience:
                self.should_stop = True

    def reset(self):
        self.counter     = 0
        self.best_value  = float('inf') if self.mode == 'min' else float('-inf')
        self.should_stop = False


# --- 1-2. 커스텀 데이터셋 클래스 ---

class KCELectraDataset(Dataset):
    def __init__(self, df, tokenizer, max_len):
        self.sentences = df['text_input'].tolist()
        self.labels    = df['label_id'].values
        self.tokenizer = tokenizer
        self.max_len   = max_len

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
            'input_ids':      encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'token_type_ids': encoding['token_type_ids'].flatten(),
            'labels':         torch.tensor(self.labels[idx], dtype=torch.long)
        }


tokenizer        = AutoTokenizer.from_pretrained(MODEL_NAME)
train_dataset    = KCELectraDataset(train_df, tokenizer, MAX_LEN)
val_dataset      = KCELectraDataset(val_df,   tokenizer, MAX_LEN)
train_dataloader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
val_dataloader   = DataLoader(val_dataset,   batch_size=BATCH_SIZE)
test_dataset    = KCELectraDataset(test_df, tokenizer, MAX_LEN)
test_dataloader = DataLoader(test_dataset, batch_size=BATCH_SIZE)

# --- 2. 모델 정의 ---

class KCELectraClassifier(torch.nn.Module):
    def __init__(self, electra, num_classes, unfreeze_last_n_layers=3):
        super(KCELectraClassifier, self).__init__()
        self.electra = electra

        # ── Step 1: 전체 KoELECTRA를 우선 모두 Freeze ──
        for param in self.electra.parameters():
            param.requires_grad = False

        # ── Step 2: 지정된 하위 레이어 수만큼 Unfreeze ──
        # KoELECTRA encoder는 electra.encoder.layer 리스트로 구성
        encoder_layers = self.electra.encoder.layer         # 총 12개 (0~11)
        total_layers   = len(encoder_layers)                # 12
        unfreeze_from  = total_layers - unfreeze_last_n_layers  # ex) 12-3=9

        for i, layer in enumerate(encoder_layers):
            if i >= unfreeze_from:
                for param in layer.parameters():
                    param.requires_grad = True

        # ── Step 3: Pooler도 Unfreeze (CLS 토큰 표현에 관여) ──
        if hasattr(self.electra, 'pooler'):
            for param in self.electra.pooler.parameters():
                param.requires_grad = True

        # Unfreeze 현황 출력
        unfrozen_layers = list(range(unfreeze_from, total_layers))
        print(f"\n✅ KoELECTRA Unfreeze 현황")
        print(f"   전체 레이어 수    : {total_layers}")
        print(f"   Unfreeze 레이어   : {unfrozen_layers} + pooler")
        print(f"   Freeze 레이어     : {list(range(unfreeze_from))}")

        # ── 3층 Classifier ──
        self.classifier = torch.nn.Sequential(
            torch.nn.Linear(768, 256),
            torch.nn.GELU(),
            torch.nn.Dropout(0.3),

            torch.nn.Linear(256, 64),
            torch.nn.GELU(),
            torch.nn.Dropout(0.3),

            torch.nn.Linear(64, num_classes)
        )

        for layer in self.classifier:
            if isinstance(layer, torch.nn.Linear):
                torch.nn.init.xavier_uniform_(layer.weight)
                torch.nn.init.zeros_(layer.bias)

    def forward(self, input_ids, attention_mask, token_type_ids):
        # Unfreezing된 레이어는 gradient 계산 필요 → no_grad 제거
        outputs = self.electra(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids
        )
        cls_output = outputs[0][:, 0, :]
        return self.classifier(cls_output)


def build_fresh_model(unfreeze_last_n_layers):
    """항상 새 KCELectraClassifier 구조(forward 포함)로 생성"""
    electra_model = AutoModel.from_pretrained(MODEL_NAME)
    return KCELectraClassifier(electra_model, NUM_CLASSES, unfreeze_last_n_layers)


def load_model_with_unfreeze(unfreeze_last_n_layers):
    """
    가중치(state_dict)만 이식하는 방식으로 forward() 문제를 원천 차단.

    1순위: best_koelectra_unfreeze.pt  (이 파일로 학습한 best 모델)
    2순위: best_koelectra_model_test.pt (frozen 학습 best 모델 → 첫 실행 시)
    3순위: HuggingFace pretrained       (둘 다 없을 경우)
    """
    UNFREEZE_CKPT = 'best_koelectra_unfreeze.pt'
    FROZEN_CKPT   = 'best_koelectra_model_test.pt'

    # 항상 새 구조로 모델 생성 → forward()에 no_grad 없음이 보장됨
    model = build_fresh_model(unfreeze_last_n_layers)

    # 1순위: unfreeze best 모델
    try:
        saved = torch.load(UNFREEZE_CKPT, map_location=DEVICE, weights_only=False)
        model.load_state_dict(saved.state_dict())
        print(f"✅ '{UNFREEZE_CKPT}' 가중치 이식 완료")
        return model
    except FileNotFoundError:
        pass

    # 2순위: frozen best 모델
    try:
        saved = torch.load(FROZEN_CKPT, map_location=DEVICE, weights_only=False)
        model.load_state_dict(saved.state_dict())
        print(f"✅ '{FROZEN_CKPT}' 가중치 이식 완료 → unfreeze 학습 시작")
        return model
    except FileNotFoundError:
        pass

    # 3순위: pretrained에서 시작
    print("⚠️  저장된 모델 없음 → HuggingFace pretrained에서 시작합니다.")
    return model


model = load_model_with_unfreeze(UNFREEZE_LAST_N_LAYERS)
model.to(DEVICE)

# 학습 파라미터 수 출력
total_params     = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"\n   전체 파라미터     : {total_params:,}")
print(f"   학습 파라미터     : {trainable_params:,} ({100*trainable_params/total_params:.1f}%)\n")


# --- 3. Optimizer 설정 (Discriminative Learning Rate) ---
# 레이어마다 다른 LR을 적용해 상위 레이어는 크게, 하위 레이어는 작게 업데이트

def get_optimizer_grouped_parameters(model, lr_classifier, lr_top, lr_bottom, unfreeze_last_n):
    """
    파라미터 그룹을 3가지로 분리:
      1. Classifier head       → lr_classifier (가장 큰 LR)
      2. Unfreeze 상위 절반    → lr_top
      3. Unfreeze 하위 절반    → lr_bottom (가장 작은 LR)
    """
    encoder_layers = model.electra.encoder.layer
    total_layers   = len(encoder_layers)
    unfreeze_from  = total_layers - unfreeze_last_n

    # Unfreeze된 레이어를 상위/하위 절반으로 나눔
    mid = unfreeze_from + unfreeze_last_n // 2

    top_layer_params    = []
    bottom_layer_params = []

    for i, layer in enumerate(encoder_layers):
        if i >= unfreeze_from:
            params = [p for p in layer.parameters() if p.requires_grad]
            if i >= mid:
                top_layer_params.extend(params)
            else:
                bottom_layer_params.extend(params)

    # Pooler는 top에 포함
    if hasattr(model.electra, 'pooler'):
        top_layer_params.extend(
            [p for p in model.electra.pooler.parameters() if p.requires_grad]
        )

    classifier_params = [p for p in model.classifier.parameters() if p.requires_grad]

    param_groups = [
        {'params': classifier_params,    'lr': lr_classifier, 'name': 'classifier'},
        {'params': top_layer_params,     'lr': lr_top,        'name': 'electra_top'},
    ]
    if bottom_layer_params:
        param_groups.append(
            {'params': bottom_layer_params, 'lr': lr_bottom, 'name': 'electra_bottom'}
        )

    return param_groups


optimizer_grouped = get_optimizer_grouped_parameters(
    model,
    lr_classifier=LR_CLASSIFIER,
    lr_top=LR_TOP_LAYERS,
    lr_bottom=LR_BOTTOM_LAYERS,
    unfreeze_last_n=UNFREEZE_LAST_N_LAYERS
)

optimizer   = AdamW(optimizer_grouped)
total_steps = len(train_dataloader) * NUM_EPOCHS
scheduler   = get_linear_schedule_with_warmup(
    optimizer,
    num_warmup_steps=int(total_steps * 0.1),  # 전체의 10%를 warmup
    num_training_steps=total_steps
)

# LR 그룹 출력
print("Optimizer LR 그룹:")
for g in optimizer.param_groups:
    print(f"   [{g['name']}] lr={g['lr']}  params={len(g['params'])}")


# --- 클래스 불균형 보정 ---

if 'label_id' in train_df.columns and len(train_df) > 0:
    full_weights = np.zeros(NUM_CLASSES)
    for idx, count in train_df['label_id'].value_counts().items():
        if count > 0:
            full_weights[idx] = 1.0 / count
    if (full_weights > 0).sum() > 0:
        full_weights = full_weights / full_weights.sum() * (full_weights > 0).sum()
    class_weights = torch.tensor(full_weights, dtype=torch.float).to(DEVICE)
    loss_fn = torch.nn.CrossEntropyLoss(weight=class_weights).to(DEVICE)
    print("\n✅ 클래스 불균형 보정이 적용되었습니다.")
else:
    loss_fn = torch.nn.CrossEntropyLoss().to(DEVICE)


# --- 4. 학습 및 평가 함수 ---

def train_epoch(model, data_loader, loss_fn, optimizer, device, scheduler):
    model.train()
    losses, correct_predictions = [], 0

    for batch in tqdm(data_loader, desc="Training"):
        input_ids      = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        token_type_ids = batch['token_type_ids'].to(device)
        labels         = batch['labels'].to(device)

        outputs      = model(input_ids, attention_mask, token_type_ids)
        _, preds     = torch.max(outputs, dim=1)
        loss         = loss_fn(outputs, labels)

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
    losses, correct_predictions = [], 0

    with torch.no_grad():
        for batch in tqdm(data_loader, desc="Evaluation"):
            input_ids      = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            token_type_ids = batch['token_type_ids'].to(device)
            labels         = batch['labels'].to(device)

            outputs      = model(input_ids, attention_mask, token_type_ids)
            _, preds     = torch.max(outputs, dim=1)
            loss         = loss_fn(outputs, labels)

            correct_predictions += torch.sum(preds == labels)
            losses.append(loss.item())

    return correct_predictions.double() / len(data_loader.dataset), np.mean(losses)


# --- 5. 학습 루프 ---

history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': []}
early_stopping = EarlyStopping(patience=EARLY_STOPPING_PATIENCE, min_delta=0.001, mode='min')

resume      = input("이전 학습을 이어서 하시겠습니까? (y/n): ").strip().lower()
start_epoch  = 0
best_loss = 2

if resume == 'y':
    # ── Case 1: unfreeze 체크포인트가 있으면 → 완전히 이어서 ──
    try:
        saved = torch.load('best_koelectra_unfreeze.pt', map_location=DEVICE, weights_only=False)
        model.load_state_dict(saved.state_dict())  # state_dict만 이식 → forward() 보장
        model.to(DEVICE)

        checkpoint    = torch.load('training_checkpoint_unfreeze.pt', map_location=DEVICE, weights_only=False)
        optimizer.load_state_dict(checkpoint['optimizer_state'])
        scheduler.load_state_dict(checkpoint['scheduler_state'])
        history       = checkpoint['history']
        start_epoch   = checkpoint['epoch'] + 1
        best_accuracy = checkpoint['best_accuracy']
        early_stopping.counter    = checkpoint['es_counter']
        early_stopping.best_value = checkpoint['es_best_value']

        print(f"✅ unfreeze 체크포인트 로드 완료. Epoch {start_epoch}부터 이어서 학습합니다.")
        print(f"   현재 best accuracy   : {best_accuracy:.4f}")
        print(f"   Early Stopping 카운터: {early_stopping.counter}/{early_stopping.patience}")

    except FileNotFoundError:
        # ── Case 2: unfreeze 체크포인트 없음 → frozen best 모델에서 시작 ──
        try:
            saved = torch.load('best_koelectra_model_test.pt', map_location=DEVICE, weights_only=False)
            model.load_state_dict(saved.state_dict())  # state_dict만 이식 → forward() 보장
            model.to(DEVICE)

            # optimizer/scheduler/history는 새로 시작 (frozen과 스펙이 달라서 재사용 불가)
            print("✅ 'best_koelectra_model_test.pt' 가중치 이식 완료.")
            print("   unfreeze 설정 적용 후 Epoch 1부터 학습을 시작합니다.")

        except FileNotFoundError:
            # ── Case 3: 둘 다 없으면 → pretrained에서 시작 ──
            model.to(DEVICE)
            print("⚠️  저장된 모델 없음 → HuggingFace pretrained에서 시작합니다.")

else:
    print("처음부터 학습을 시작합니다.")
    model.to(DEVICE)


print("\n--- 학습 시작 ---")

for epoch in range(start_epoch, start_epoch + NUM_EPOCHS):
    print(f'\nEpoch {epoch + 1}')
    print('-' * 10)

    train_acc, train_loss = train_epoch(model, train_dataloader, loss_fn, optimizer, DEVICE, scheduler)
    print(f'Train loss {train_loss:.4f} accuracy {train_acc:.4f}')

    val_acc, val_loss = eval_model(model, val_dataloader, loss_fn, DEVICE)
    print(f'Val   loss {val_loss:.4f} accuracy {val_acc:.4f}')

    history['train_loss'].append(train_loss)
    history['val_loss'].append(val_loss)
    history['train_acc'].append(train_acc.item())
    history['val_acc'].append(val_acc.item())

    if val_loss < best_loss:
        torch.save(model, 'best_koelectra_unfreeze.pt')
        best_loss = val_loss
        print("-> Best model 저장 완료.")

    torch.save({
        'epoch'          : epoch,
        'optimizer_state': optimizer.state_dict(),
        'scheduler_state': scheduler.state_dict(),
        'history'        : history,
        'best_loss'  : best_loss,
        'es_counter'     : early_stopping.counter,
        'es_best_value'  : early_stopping.best_value,
    }, 'training_checkpoint_unfreeze.pt')

    early_stopping(val_loss)
    if early_stopping.should_stop:
        print(f"\n🛑 Early Stopping 발동! 최종 종료 Epoch: {epoch + 1}")
        break

print("\n--- 학습 완료 ---")


# --- 6. 시각화 ---

def plot_and_save_metrics(history):
    epochs = range(1, len(history['train_loss']) + 1)

    plt.figure(figsize=(10, 6))
    plt.plot(epochs, history['train_loss'], 'bo-', label='Training Loss')
    plt.plot(epochs, history['val_loss'],   'ro-', label='Validation Loss')
    plt.title('Training and Validation Loss (Unfreeze)')
    plt.xlabel('Epochs')
    plt.ylabel('Loss')
    plt.legend()
    plt.grid(True)
    plt.savefig('loss_plot_unfreeze.png')
    plt.close()
    print("✅ Loss 그래프 저장 완료.")

    plt.figure(figsize=(10, 6))
    plt.plot(epochs, history['train_acc'], 'bo-', label='Training Accuracy')
    plt.plot(epochs, history['val_acc'],   'ro-', label='Validation Accuracy')
    plt.title('Training and Validation Accuracy (Unfreeze)')
    plt.xlabel('Epochs')
    plt.ylabel('Accuracy')
    plt.legend()
    plt.grid(True)
    plt.savefig('accuracy_plot_unfreeze.png')
    plt.close()
    print("✅ Accuracy 그래프 저장 완료.")

plot_and_save_metrics(history)

from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay

# --- 7. Test 평가 ---
print("\n--- Test 평가 시작 ---")

best_model = torch.load('best_koelectra_unfreeze.pt', map_location=DEVICE, weights_only=False)
best_model.to(DEVICE)
best_model.eval()

all_preds = []
all_labels = []

with torch.no_grad():
    for batch in tqdm(test_dataloader, desc="Testing"):
        input_ids      = batch['input_ids'].to(DEVICE)
        attention_mask = batch['attention_mask'].to(DEVICE)
        token_type_ids = batch['token_type_ids'].to(DEVICE)
        labels         = batch['labels'].to(DEVICE)

        outputs = best_model(input_ids, attention_mask, token_type_ids)
        _, preds = torch.max(outputs, dim=1)

        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

test_acc = np.mean(np.array(all_preds) == np.array(all_labels))
print(f"\n✅ Test Accuracy: {test_acc:.4f}")

print("\n[Classification Report]")
print(classification_report(all_labels, all_preds, digits=4))

# Confusion Matrix
cm = confusion_matrix(all_labels, all_preds)
fig, ax = plt.subplots(figsize=(12, 10))
disp = ConfusionMatrixDisplay(confusion_matrix=cm)
disp.plot(ax=ax, cmap='Blues')
plt.title('Test Confusion Matrix (Unfreeze)')
plt.tight_layout()
plt.savefig('confusion_matrix_unfreeze.png')
plt.close()
print("✅ Confusion Matrix 저장 완료 (confusion_matrix_unfreeze.png)")