import sys
import os
import torch

# Add training directory to sys.path to resolve class loading issues
sys.path.append(os.path.join(os.path.dirname(__file__), 'training'))

from biasanalyzer_model import BiasAnalyzer
# We need to define or import KCELectraClassifier for torch.load to locate it
# Let's import it from topic_train_phase2
from topic_train_phase2 import KCELectraClassifier

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
except Exception as e:
    print(f"❌ Failed to load bias classifier: {e}")
