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
    print(f"📡 Device set to: {DEVICE}")
    print("=" * 60)
    
    try:
        print("Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=False)
        
        print(f"Loading Topic Classifier weights...")
        topic_model = torch.load(TOPIC_MODEL_PATH, map_location=DEVICE, weights_only=False)
        topic_model.to(DEVICE)
        topic_model.eval()
        
        print(f"Loading Bias Classifier weights...")
        bias_model = torch.load(BIAS_MODEL_PATH, map_location=DEVICE, weights_only=False)
        bias_model.to(DEVICE)
        bias_model.eval()
        
        print("✅ Models loaded successfully into memory.")
        print("=" * 60)
    except Exception as e:
        print(f"❌ Initialization error: {e}")
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
    comment = request.comment.strip()
    
    if not title:
        raise HTTPException(status_code=400, detail="Title field is required")
        
    try:
        # 1. Run Topic Inference
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
            
        return {
            "topic": {
                "label": topic_label,
                "confidence": topic_confidence
            },
            "bias": {
                "label": bias_label,
                "confidence": bias_confidence,
                "score": round(raw_score, 2)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
