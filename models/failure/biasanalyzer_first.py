import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from transformers import AutoModel, AutoTokenizer
from sklearn.cluster import KMeans
import pandas as pd
from sklearn.model_selection import train_test_split
import numpy as np
import matplotlib.pyplot as plt

def csv_to_list_of_dicts(file_path):
    try:
        df = pd.read_csv(file_path)
        try:
            df['label'] = df['label'].astype(int)
        except ValueError:
            print("경고: 'label' 열에 정수로 변환할 수 없는 값이 포함되어 있습니다. 문자열로 유지합니다.")
        result_list = df.to_dict('records')
        return result_list
    except FileNotFoundError:
        print(f"오류: 파일을 찾을 수 없습니다: {file_path}")
        return None
    except pd.errors.EmptyDataError:
        print(f"오류: 파일이 비어 있습니다: {file_path}")
        return None
    except Exception as e:
        print(f"처리 중 예상치 못한 오류 발생: {e}")
        return None


data_list = csv_to_list_of_dicts("emergency/data_final/original.csv")

# ==========================================
# 1. 설정 및 하이퍼파라미터
# ==========================================
CONFIG = {
    'model_name': "beomi/KcELECTRA-base",
    'num_classes': 3,
    'hidden_dim': 768,
    'nhead': 8,
    'num_layers': 4,
    'batch_size': 16,
    'epochs': 50,
    'learning_rate': 0.00003,
    'device': 'cuda' if torch.cuda.is_available() else 'cpu',
    # ⭐ EARLY STOPPING: patience 설정 ⭐
    'early_stopping_patience': 10,
}

print(f"Current Device: {CONFIG['device']}")


# ==========================================
# 2. 데이터셋 클래스
# ==========================================
class YouTubeBiasDataset(Dataset):
    def __init__(self, data):
        self.data = data

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]
        texts = [item['title'], item['comment']]
        label = item['label']
        return texts, label

def collate_fn(batch):
    texts = [item[0] for item in batch]
    labels = torch.tensor([item[1] for item in batch])
    return texts, labels


# ==========================================
# 3. 모델 아키텍처
# ==========================================
class BiasAnalyzer(nn.Module):
    def __init__(self, config):
        super(BiasAnalyzer, self).__init__()
        self.device = config['device']

        print(f"Loading SBERT model: {config['model_name']}...")
        self.bert = AutoModel.from_pretrained(config['model_name'])
        self.tokenizer = AutoTokenizer.from_pretrained(config['model_name'])

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=config['hidden_dim'],
            nhead=config['nhead'],
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=config['num_layers'])

        h_dim = config['hidden_dim']
        self.classifier = nn.Sequential(
            nn.Linear(h_dim, h_dim),
            nn.BatchNorm1d(h_dim),
            nn.ReLU(),
            nn.Dropout(0.4),

            nn.Linear(h_dim, h_dim // 2),
            nn.BatchNorm1d(h_dim // 2),
            nn.ReLU(),
            nn.Dropout(0.2),

            nn.Linear(h_dim // 2, h_dim // 8),
            nn.ReLU(),

            nn.Linear(h_dim // 8, config['num_classes'])
        )

        self.to(self.device)

    def get_sbert_embeddings(self, flat_texts):
        inputs = self.tokenizer(
            flat_texts,
            return_tensors='pt',
            padding=True,
            truncation=True,
            max_length=512
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        outputs = self.bert(**inputs)

        attention_mask = inputs['attention_mask']
        token_embeddings = outputs.last_hidden_state

        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
        sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)

        return sum_embeddings / sum_mask

    def forward(self, batch_texts):
        batch_size = len(batch_texts)
        seq_len = 2

        flat_texts = [t for video in batch_texts for t in video]
        flat_embeddings = self.get_sbert_embeddings(flat_texts)

        context_input = flat_embeddings.view(batch_size, seq_len, -1)
        context_output = self.transformer(context_input)

        video_vector = torch.mean(context_output, dim=1)
        logits = self.classifier(video_vector)

        return logits, video_vector


# ==========================================
# 4. 실행 및 학습 (Main Loop)
# ==========================================
if __name__ == "__main__":

    if data_list is None or len(data_list) < 5:
        print("오류: CSV 파일 로드에 실패했거나 데이터가 너무 적어 학습을 시작할 수 없습니다.")
        exit()

    # --- A. 데이터 분할 ---
    print(f"\n[데이터 분할 시작] 전체 샘플 수: {len(data_list)}개")

    train_data, temp_data = train_test_split(data_list, test_size=0.2, random_state=42)
    val_data, test_data = train_test_split(temp_data, test_size=0.5, random_state=42)

    if len(train_data) == 0:
        print("\n!!! 치명적 오류: 학습 데이터셋(Train Data)이 0개입니다. !!!")
        exit()

    print(f"  - 학습(Train) 데이터: {len(train_data)}개")
    print(f"  - 검증(Validation) 데이터: {len(val_data)}개")
    print(f"  - 테스트(Test) 데이터: {len(test_data)}개")

    # --- B. 데이터 로더 ---
    train_dataset = YouTubeBiasDataset(train_data)
    val_dataset = YouTubeBiasDataset(val_data)
    test_dataset = YouTubeBiasDataset(test_data)

    train_dataloader = DataLoader(train_dataset, batch_size=CONFIG['batch_size'], shuffle=True, collate_fn=collate_fn)
    val_dataloader = DataLoader(val_dataset, batch_size=CONFIG['batch_size'], shuffle=False, collate_fn=collate_fn)

    # --- C. 모델 초기화 ---
    model = BiasAnalyzer(CONFIG)
    optimizer = optim.AdamW(model.parameters(), lr=CONFIG['learning_rate'])
    criterion = nn.CrossEntropyLoss()

    # ⭐ EARLY STOPPING: 변수 초기화 ⭐
    best_val_loss = float('inf')   # Accuracy 대신 Loss 기준으로 변경
    early_stopping_counter = 0
    best_epoch = 0
    # ⭐ ----------------------------- ⭐

    history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': []}

    # --- D. 학습 및 검증 ---
    print("\n[Start Training & Validation]")

    for epoch in range(CONFIG['epochs']):
        # 1. TRAIN PHASE
        model.train()
        total_loss, total_correct, total_samples = 0, 0, 0

        for texts, labels in train_dataloader:
            labels = labels.to(CONFIG['device'])
            optimizer.zero_grad()
            logits, _ = model(texts)
            loss = criterion(logits, labels)

            preds = torch.argmax(logits, dim=1)
            total_correct += (preds == labels).sum().item()
            total_samples += labels.size(0)

            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        epoch_loss = total_loss / len(train_dataloader)
        train_accuracy = total_correct / total_samples if total_samples > 0 else 0.0

        # 2. VALIDATION PHASE
        model.eval()
        val_loss, val_correct, val_samples = 0, 0, 0

        with torch.no_grad():
            for texts, labels in val_dataloader:
                labels = labels.to(CONFIG['device'])
                logits, _ = model(texts)

                loss = criterion(logits, labels)
                val_loss += loss.item()

                preds = torch.argmax(logits, dim=1)
                val_correct += (preds == labels).sum().item()
                val_samples += labels.size(0)

        val_accuracy = val_correct / val_samples if val_samples > 0 else 0.0
        val_loss_avg = val_loss / len(val_dataloader)

        print(f"Epoch {epoch+1}/{CONFIG['epochs']} | "
              f"Train Loss: {epoch_loss:.4f} | Train Acc: {train_accuracy:.4f} | "
              f"Val Loss: {val_loss_avg:.4f} | Val Acc: {val_accuracy:.4f}", end="")

        history['train_loss'].append(epoch_loss)
        history['val_loss'].append(val_loss_avg)
        history['train_acc'].append(train_accuracy)
        history['val_acc'].append(val_accuracy)

        # ⭐ EARLY STOPPING: Val Loss 기준 Best 모델 저장 및 카운터 관리 ⭐
        if val_loss_avg < best_val_loss:
            best_val_loss = val_loss_avg
            best_epoch = epoch + 1
            early_stopping_counter = 0  # 개선되었으므로 카운터 리셋

            MODEL_SAVE_PATH = 'please.pt'
            torch.save(model, MODEL_SAVE_PATH)
            print(f" -> [모델 저장] Val Loss {best_val_loss:.4f} (Epoch {best_epoch}), {MODEL_SAVE_PATH}에 저장.")
        else:
            early_stopping_counter += 1  # 개선 없으면 카운터 증가
            print(f" -> [Early Stopping] {early_stopping_counter}/{CONFIG['early_stopping_patience']} (best: Epoch {best_epoch}, Val Loss {best_val_loss:.4f})")

            if early_stopping_counter >= CONFIG['early_stopping_patience']:
                print(f"\n[Early Stopping 발동] {CONFIG['early_stopping_patience']} 에폭 동안 Val Loss 개선 없음. 학습 중단.")
                print(f"  Best Epoch: {best_epoch} | Best Val Loss: {best_val_loss:.4f}")
                break
        # ⭐ ---------------------------------------------------------------- ⭐

    print("\n--- 학습 완료 ---")
    print(f"  최종 Best Epoch: {best_epoch} | Best Val Loss: {best_val_loss:.4f}")

    # --- E. 시각화 ---
    def plot_and_save_metrics(history):
        actual_epochs = len(history['train_loss'])
        epochs = range(1, actual_epochs + 1)

        fig, axes = plt.subplots(1, 2, figsize=(14, 5))

        # Loss 그래프
        axes[0].plot(epochs, history['train_loss'], 'bo-', label='Train Loss')
        axes[0].plot(epochs, history['val_loss'], 'ro-', label='Val Loss')
        axes[0].axvline(x=best_epoch, color='green', linestyle='--', label=f'Best Epoch ({best_epoch})')
        axes[0].set_title('Training and Validation Loss')
        axes[0].set_xlabel('Epochs')
        axes[0].set_ylabel('Loss')
        axes[0].legend()
        axes[0].grid(True)

        # Accuracy 그래프
        axes[1].plot(epochs, history['train_acc'], 'bo-', label='Train Accuracy')
        axes[1].plot(epochs, history['val_acc'], 'ro-', label='Val Accuracy')
        axes[1].axvline(x=best_epoch, color='green', linestyle='--', label=f'Best Epoch ({best_epoch})')
        axes[1].set_title('Training and Validation Accuracy')
        axes[1].set_xlabel('Epochs')
        axes[1].set_ylabel('Accuracy')
        axes[1].legend()
        axes[1].grid(True)

        plt.tight_layout()
        plt.savefig('please.png')
        plt.close()
        print("✅ 그래프 ('please.png') 저장 완료.")

    plot_and_save_metrics(history)

    # --- F. 최종 테스트 ---
    print("\n[Start Final Test on Test Set]")

    model.eval()
    test_correct, test_samples = 0, 0
    all_vectors_list = []
    all_titles_list = []

    with torch.no_grad():
        test_dataloader = DataLoader(test_dataset, batch_size=CONFIG['batch_size'], shuffle=False, collate_fn=collate_fn)
        for texts, labels in test_dataloader:
            labels = labels.to(CONFIG['device'])
            logits, vectors = model(texts)

            preds = torch.argmax(logits, dim=1)
            test_correct += (preds == labels).sum().item()
            test_samples += labels.size(0)

            all_vectors_list.append(vectors.cpu().numpy())
            all_titles_list.extend([t[0] for t in texts])

    if len(all_vectors_list) > 0:
        all_vectors = np.concatenate(all_vectors_list, axis=0)
    else:
        all_vectors = np.array([])

    test_accuracy = test_correct / test_samples if test_samples > 0 else 0.0
    print(f"\n=== 최종 테스트 결과 ===\nTest Accuracy: {test_accuracy:.4f} (Total {test_samples} Samples)")

    # --- G. 군집화 ---
    if all_vectors.shape[0] >= CONFIG['num_classes']:
        print("\n[Start Clustering on Test Data Embeddings]")
        kmeans = KMeans(n_clusters=CONFIG['num_classes'], random_state=42, n_init=10)
        labels = kmeans.fit_predict(all_vectors)

        print(f"\n=== 군집화 결과 (총 {all_vectors.shape[0]} 샘플 기준) ===")
        for i, title in enumerate(all_titles_list):
            print(f"영상 제목: '{title}' -> 군집 ID: {labels[i]}")
    else:
        print(f"\n[군집화 건너뜀] 샘플 수({all_vectors.shape[0]}개)가 군집 수({CONFIG['num_classes']}개)보다 적습니다.")

    print("\n=== 작업 완료 ===")