import os
import sys
import torch
import torch.nn as nn
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer

# Configure paths to training directory
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
TRAINING_DIR = os.path.join(CURRENT_DIR, 'training')
sys.path.append(TRAINING_DIR)

# Register custom module mapping for pickle loaders
sys.modules['model'] = sys.modules[__name__]

from biasanalyzer_model import BiasAnalyzer

# Define KCELectraClassifier directly to avoid running training scripts upon import
class KCELectraClassifier(nn.Module):
    def __init__(self, electra, num_classes):
        super(KCELectraClassifier, self).__init__()
        self.electra = electra
        self.classifier = nn.Sequential(
            nn.Linear(768, 256),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(256, 64),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(64, num_classes)
        )

    def forward(self, input_ids, attention_mask, token_type_ids):
        outputs = self.electra(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids
        )
        cls_output = outputs[0][:, 0, :] 
        logits = self.classifier(cls_output)
        return logits


app = FastAPI(title="BiasAnalyzer Demo Backend")

# Enable CORS for React frontend (defaulting to localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants & Configurations
MODEL_NAME = 'monologg/koelectra-base-v3-discriminator'
TOPIC_MODEL_PATH = os.path.join(TRAINING_DIR, 'topic-classifier_final.pt')
BIAS_MODEL_PATH = os.path.join(TRAINING_DIR, 'bias_final.pt')
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

TOPIC_CLASSES = {
    0: "게임", 1: "과학과 기술", 2: "노하우/스타일", 3: "비영리/사회운동",
    4: "스포츠", 5: "애완동물/동물", 6: "여행/이벤트", 7: "영화/애니메이션",
    8: "예능", 9: "음악", 10: "인물/블로그", 11: "자동차/탈것",
    12: "정치", 13: "코미디"
}

BIAS_CLASSES = {
    0: "진보",
    1: "보수",
    2: "중립"
}

# Global references for lazy loading
tokenizer = None
topic_model = None
bias_model = None

class AnalysisRequest(BaseModel):
    title: str
    comment: str = ""

@app.on_event("startup")
def startup_event():
    global tokenizer, topic_model, bias_model
    print("=" * 60)
    print(f"[Device] Device set to: {DEVICE}")
    print("=" * 60)
    
    try:
        print("Loading tokenizer...")
        try:
            tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=False, local_files_only=True)
        except Exception:
            tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=False)
        
        print(f"Loading Topic Classifier weights...")
        loaded_topic = torch.load(TOPIC_MODEL_PATH, map_location=DEVICE, weights_only=False)
        
        # Clean state dict keys (strip 'module.' prefix if DataParallel was used)
        topic_state_dict = loaded_topic.state_dict() if hasattr(loaded_topic, 'state_dict') else loaded_topic
        clean_topic_state = {}
        for k, v in topic_state_dict.items():
            name = k[7:] if k.startswith('module.') else k
            clean_topic_state[name] = v
            
        # Detect actual class count from clean state dict keys (looking for final layer weight)
        weight_key = next((k for k in clean_topic_state.keys() if k.endswith('classifier.6.bias')), None)
        if weight_key is not None:
            num_topic_classes = clean_topic_state[weight_key].shape[0]
        else:
            num_topic_classes = 14  # Default fallback
            
        # Instantiate clean native model
        from transformers import AutoModel
        try:
            electra_topic = AutoModel.from_pretrained(MODEL_NAME, local_files_only=True)
        except Exception:
            electra_topic = AutoModel.from_pretrained(MODEL_NAME)
            
        topic_model = KCELectraClassifier(electra_topic, num_classes=num_topic_classes)
        topic_model.load_state_dict(clean_topic_state)
        topic_model.device = DEVICE
        topic_model.to(DEVICE)
        topic_model.eval()
        
        print(f"Loading Bias Classifier weights...")
        loaded_bias = torch.load(BIAS_MODEL_PATH, map_location=DEVICE, weights_only=False)
        
        # Clean state dict keys for bias model
        bias_state_dict = loaded_bias.state_dict() if hasattr(loaded_bias, 'state_dict') else loaded_bias
        clean_bias_state = {}
        for k, v in bias_state_dict.items():
            name = k[7:] if k.startswith('module.') else k
            clean_bias_state[name] = v
            
        bias_config = {
            'model_name': "beomi/KcELECTRA-base",
            'num_classes': 3,
            'device': DEVICE
        }
        
        # Temporarily force offline mode for BiasAnalyzer to prevent connection issues
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        try:
            bias_model = BiasAnalyzer(bias_config)
        except Exception:
            os.environ["TRANSFORMERS_OFFLINE"] = "0"
            bias_model = BiasAnalyzer(bias_config)
        finally:
            if "TRANSFORMERS_OFFLINE" in os.environ:
                del os.environ["TRANSFORMERS_OFFLINE"]
                
        bias_model.load_state_dict(clean_bias_state)
        bias_model.device = DEVICE
        bias_model.to(DEVICE)
        bias_model.eval()
        
        print("[Success] Clean models initialized and state dict weights successfully loaded.")
        print("=" * 60)
    except Exception as e:
        print(f"[Error] Initialization error: {e}")
        # We don't crash startup to allow server configuration debugging, 
        # but endpoint requests will fail gracefully.

@app.post("/api/analyze")
async def analyze(request: AnalysisRequest):
    global tokenizer, topic_model, bias_model
    if any(m is None for m in (tokenizer, topic_model, bias_model)):
        raise HTTPException(
            status_code=503, 
            detail="Model server is not fully loaded. Check weight paths in models/training/."
        )
    
    title = request.title.strip()
    comment = request.comment.strip() or "댓글 없음"
    
    if not title:
        raise HTTPException(status_code=400, detail="Title field is required")
        
    try:
        # 1. Run Topic Inference
        text_input = title + " [SEP] " + comment
        encoding = tokenizer(
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
            topic_outputs = topic_model(input_ids, attention_mask, token_type_ids)
            topic_probs = torch.nn.functional.softmax(topic_outputs, dim=1).cpu().numpy().flatten()
            
        topic_idx = np.argmax(topic_probs)
        topic_label = TOPIC_CLASSES.get(topic_idx, f"Unknown ({topic_idx})")
        topic_confidence = float(topic_probs[topic_idx])
        
        # 2. Run Bias Inference
        batch_input = [[title, comment]]
        with torch.no_grad():
            bias_logits, _ = bias_model(batch_input)
            bias_probs = torch.nn.functional.softmax(bias_logits, dim=1).cpu().numpy().flatten()
            
        bias_idx = np.argmax(bias_probs)
        bias_label = BIAS_CLASSES.get(bias_idx, f"Unknown ({bias_idx})")
        bias_confidence = float(bias_probs[bias_idx])
        
        # Calculate raw score for front: Progressive -> negative, Conservative -> positive, Neutral -> near zero
        # We can scale this based on probabilities
        if bias_idx == 0:  # Progressive
            raw_score = -bias_confidence
        elif bias_idx == 1:  # Conservative
            raw_score = bias_confidence
        else:  # Neutral
            # Mix progressive vs conservative representation
            raw_score = float(bias_probs[1] - bias_probs[0])
            
        # Sort topic classes by probability
        topic_probs_list = []
        for idx, prob in enumerate(topic_probs):
            label = TOPIC_CLASSES.get(idx, f"Unknown ({idx})")
            topic_probs_list.append({
                "label": label,
                "confidence": float(prob)
            })
        topic_probs_list = sorted(topic_probs_list, key=lambda x: x["confidence"], reverse=True)

        # Sort bias classes by probability
        bias_probs_list = []
        for idx, prob in enumerate(bias_probs):
            label = BIAS_CLASSES.get(idx, f"Unknown ({idx})")
            bias_probs_list.append({
                "label": label,
                "confidence": float(prob)
            })
        bias_probs_list = sorted(bias_probs_list, key=lambda x: x["confidence"], reverse=True)

        return {
            "topic": {
                "label": topic_label,
                "confidence": topic_confidence,
                "probabilities": topic_probs_list
            },
            "bias": {
                "label": bias_label,
                "confidence": bias_confidence,
                "score": round(raw_score, 2),
                "probabilities": bias_probs_list
            }
        }
        
    except Exception as e:
        import traceback
        print("[Error] [Inference Error Traceback]:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
