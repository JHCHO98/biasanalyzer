import torch
import torch.nn as nn
from torch.utils.data import Dataset
from transformers import AutoModel, AutoTokenizer


class YouTubeBiasMultiTaskDataset(Dataset):
    def __init__(self, data):
        self.data = data

    def __len__(self):
        return len(self.data)

    def __getitem__(self, index):
        item = self.data[index]
        texts = [str(item["title"]), str(item["comment"])]
        return texts, int(item["target"]), int(item["attitude"])


def collate_fn(batch):
    texts = [item[0] for item in batch]
    targets = torch.tensor([item[1] for item in batch], dtype=torch.long)
    attitudes = torch.tensor([item[2] for item in batch], dtype=torch.long)
    return texts, targets, attitudes


class BiasAnalyzerMultiTask(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.device = torch.device(config["device"])
        self.bert = AutoModel.from_pretrained(config["model_name"])
        self.tokenizer = AutoTokenizer.from_pretrained(config["model_name"])
        self.hidden_dim = self.bert.config.hidden_size

        self.title_to_comment_attn = nn.MultiheadAttention(
            embed_dim=self.hidden_dim, num_heads=8, batch_first=True
        )
        self.comment_to_title_attn = nn.MultiheadAttention(
            embed_dim=self.hidden_dim, num_heads=8, batch_first=True
        )

        combined_dim = self.hidden_dim * 4
        intermediate_dim = config.get("intermediate_dim", 512)
        self.shared_classifier = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(combined_dim, intermediate_dim),
            nn.BatchNorm1d(intermediate_dim),
            nn.LeakyReLU(0.1),
            nn.Dropout(0.4),
            nn.Linear(intermediate_dim, intermediate_dim // 2),
            nn.BatchNorm1d(intermediate_dim // 2),
            nn.LeakyReLU(0.1),
            nn.Dropout(0.2),
        )
        self.target_classifier = nn.Linear(
            intermediate_dim // 2, config["num_target_classes"]
        )
        self.attitude_classifier = nn.Linear(
            intermediate_dim // 2, config["num_attitude_classes"]
        )
        self.to(self.device)

    @staticmethod
    def _masked_mean(hidden_states, attention_mask):
        mask = attention_mask.unsqueeze(-1).to(hidden_states.dtype)
        return (hidden_states * mask).sum(dim=1) / mask.sum(dim=1).clamp_min(1.0)

    def forward(self, batch_texts):
        titles = [item[0] for item in batch_texts]
        comments = [item[1] for item in batch_texts]

        title_inputs = self.tokenizer(
            titles, return_tensors="pt", padding=True, truncation=True, max_length=256
        ).to(self.device)
        comment_inputs = self.tokenizer(
            comments, return_tensors="pt", padding=True, truncation=True, max_length=256
        ).to(self.device)

        title_hidden = self.bert(**title_inputs).last_hidden_state
        comment_hidden = self.bert(**comment_inputs).last_hidden_state

        title_cross, _ = self.title_to_comment_attn(
            title_hidden,
            comment_hidden,
            comment_hidden,
            key_padding_mask=~comment_inputs["attention_mask"].bool(),
            need_weights=False,
        )
        comment_cross, _ = self.comment_to_title_attn(
            comment_hidden,
            title_hidden,
            title_hidden,
            key_padding_mask=~title_inputs["attention_mask"].bool(),
            need_weights=False,
        )

        features = torch.cat(
            [
                self._masked_mean(title_hidden, title_inputs["attention_mask"]),
                self._masked_mean(comment_hidden, comment_inputs["attention_mask"]),
                self._masked_mean(title_cross, title_inputs["attention_mask"]),
                self._masked_mean(comment_cross, comment_inputs["attention_mask"]),
            ],
            dim=-1,
        )
        shared = self.shared_classifier(features)
        return self.target_classifier(shared), self.attitude_classifier(shared), features
