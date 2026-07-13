import sys
import os
import torch

# Add training directory to sys.path to resolve class loading issues
sys.path.append(os.path.join(os.path.dirname(__file__), 'training'))

from biasanalyzer_model import BiasAnalyzer
import torch.nn as nn

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


DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {DEVICE}")

try:
    topic_model_path = os.path.join(os.path.dirname(__file__), 'training', 'topic-classifier_final.pt')
    print(f"Loading topic classifier from {topic_model_path}...")
    topic_model = torch.load(topic_model_path, map_location=DEVICE, weights_only=False)
    topic_model.eval()
    print("✅ Topic classifier loaded successfully!")
except Exception as e:
    print(f"❌ Failed to load topic classifier: {e}")

try:
    bias_model_path = os.path.join(os.path.dirname(__file__), 'training', 'bias_final.pt')
    print(f"Loading bias classifier from {bias_model_path}...")
    bias_model = torch.load(bias_model_path, map_location=DEVICE, weights_only=False)
    bias_model.eval()
    print("✅ Bias classifier loaded successfully!")
    
    # Dynamic patch to solve Hugging Face Transformers version mismatch
    for model in (topic_model, bias_model):
        if 'model' in locals() or 'topic_model' in locals():
            for module in model.modules():
                if module.__class__.__name__ == 'ElectraAttention':
                    if not hasattr(module, 'is_cross_attention'):
                        module.is_cross_attention = False
    print("✅ Compatibility patches applied.")
except Exception as e:
    print(f"❌ Failed to load bias classifier: {e}")
