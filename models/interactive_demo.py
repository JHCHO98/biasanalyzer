import os
import sys
import torch
import torch.nn as nn
import numpy as np
from transformers import AutoTokenizer

# 1. PATH CONFIGURATION
# Add training directory to sys.path so PyTorch can locate structural dependencies
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
TRAINING_DIR = os.path.join(CURRENT_DIR, 'training')
sys.path.append(TRAINING_DIR)

# Register custom module mapping to resolve serialization names
sys.modules['model'] = sys.modules[__name__]

# Import the architectures
from biasanalyzer_model import BiasAnalyzer

# Define KCELectraClassifier directly to avoid running training scripts upon import
class KCELectraClassifier(nn.Module):
    def __init__(self, electra, num_classes):
        super(KCELectraClassifier, self).__init__()
        self.electra = electra
        self.classifier = nn.Linear(768, num_classes)
        nn.init.xavier_uniform_(self.classifier.weight) 

    def forward(self, input_ids, attention_mask, token_type_ids):
        outputs = self.electra(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids
        )
        cls_output = outputs[0][:, 0, :] 
        logits = self.classifier(cls_output)
        return logits


# 2. CONSTANTS & MODEL PATHS
MODEL_NAME = 'monologg/koelectra-base-v3-discriminator'
TOPIC_MODEL_PATH = os.path.join(TRAINING_DIR, 'topic-classifier_final.pt')
BIAS_MODEL_PATH = os.path.join(TRAINING_DIR, 'bias_final.pt')

TOPIC_CLASSES = {
    0: "게임",
    1: "과학과 기술",
    2: "노하우/스타일",
    3: "비영리/사회운동",
    4: "스포츠",
    5: "애완동물/동물",
    6: "여행/이벤트",
    7: "영화/애니메이션",
    8: "예능",
    9: "음악",
    10: "인물/블로그",
    11: "자동차/탈것",
    12: "정치",
    13: "코미디"
}

BIAS_CLASSES = {
    0: "진보 (Progressive)",
    1: "보수 (Conservative)",
    2: "중립 (Neutral)"
}

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def load_models():
    print("=" * 60)
    print(f"📡 Device set to: {DEVICE}")
    print("=" * 60)
    
    # Load Tokenizer
    print("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=False)
    
    # Load Topic Classifier
    print(f"Loading Topic Classifier from {TOPIC_MODEL_PATH}...")
    if not os.path.exists(TOPIC_MODEL_PATH):
        raise FileNotFoundError(f"Topic classifier weights not found at {TOPIC_MODEL_PATH}")
    topic_model = torch.load(TOPIC_MODEL_PATH, map_location=DEVICE, weights_only=False)
    topic_model.to(DEVICE)
    topic_model.eval()
    print("✅ Topic Classifier loaded successfully.")
    
    # Load Bias Classifier
    print(f"Loading Bias Classifier from {BIAS_MODEL_PATH}...")
    if not os.path.exists(BIAS_MODEL_PATH):
        raise FileNotFoundError(f"Bias classifier weights not found at {BIAS_MODEL_PATH}")
    bias_model = torch.load(BIAS_MODEL_PATH, map_location=DEVICE, weights_only=False)
    bias_model.to(DEVICE)
    bias_model.eval()
    print("✅ Bias Classifier loaded successfully.")
    print("=" * 60)
    
    return tokenizer, topic_model, bias_model

def run_topic_inference(title, comment, tokenizer, model):
    # Match the format used during training
    text_input = title + " [SEP] " + comment
    encoding = tokenizer.encode_plus(
        text_input,
        max_length=128,
        padding='max_length',
        truncation=True,
        return_tensors='pt'
    )
    
    input_ids = encoding['input_ids'].to(DEVICE)
    attention_mask = encoding['attention_mask'].to(DEVICE)
    token_type_ids = encoding['token_type_ids'].to(DEVICE)
    
    with torch.no_grad():
        outputs = model(input_ids, attention_mask, token_type_ids)
        probabilities = torch.nn.functional.softmax(outputs, dim=1).cpu().numpy().flatten()
        
    predicted_idx = np.argmax(probabilities)
    predicted_label = TOPIC_CLASSES.get(predicted_idx, f"Unknown ({predicted_idx})")
    confidence = probabilities[predicted_idx]
    
    return predicted_label, confidence, probabilities

def run_bias_inference(title, comment, bias_model):
    # Bias model takes a list of lists: [[title, comment]]
    batch_input = [[title, comment]]
    
    with torch.no_grad():
        logits, _ = bias_model(batch_input)
        probabilities = torch.nn.functional.softmax(logits, dim=1).cpu().numpy().flatten()
        
    predicted_idx = np.argmax(probabilities)
    predicted_label = BIAS_CLASSES.get(predicted_idx, f"Unknown ({predicted_idx})")
    confidence = probabilities[predicted_idx]
    
    return predicted_label, confidence, probabilities

def main():
    try:
        tokenizer, topic_model, bias_model = load_models()
    except Exception as e:
        print(f"\n❌ Error initialization models: {e}")
        print("Please check your PyTorch environment and verify weights are placed inside the models/training directory.")
        return

    print("\n💡 BiasAnalyzer 대화형 데모 백엔드가 성공적으로 활성화되었습니다.")
    print("종료하려면 Ctrl+C 또는 'exit'을 입력하세요.\n")

    while True:
        try:
            print("-" * 50)
            title = input("📝 영상 제목 (Video Title): ").strip()
            if not title:
                continue
            if title.lower() == 'exit':
                break
                
            comment = input("💬 주요 댓글 (Top Comment): ").strip()
            if comment.lower() == 'exit':
                break

            print("\n🔄 분석을 실행하고 있습니다...")
            
            # Predict Topic
            topic_label, topic_conf, _ = run_topic_inference(title, comment, tokenizer, topic_model)
            
            # Predict Political Bias
            bias_label, bias_conf, _ = run_bias_inference(title, comment, bias_model)

            # Output results
            print("\n🎯 [분석 결과 / Diagnostic Results]")
            print(f"📁 예측 카테고리 (Topic Category): {topic_label} ({topic_conf * 100:.2f}%)")
            print(f"⚖️ 예측 정치 성향 (Political Bias): {bias_label} ({bias_conf * 100:.2f}%)")
            print("-" * 50)
            
        except KeyboardInterrupt:
            print("\n👋 프로그램을 종료합니다.")
            break
        except Exception as e:
            print(f"❌ 분석 도중 오류가 발생했습니다: {e}")

if __name__ == '__main__':
    main()
