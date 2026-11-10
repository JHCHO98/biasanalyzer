"""Local semantic ranking; no political labels are inferred from embeddings."""

import hashlib
import html
import json
import os
import re
import sqlite3
import threading
from collections import defaultdict
from contextlib import closing
from pathlib import Path

import numpy as np


class EmbeddingUnavailable(RuntimeError):
    pass


def clean_text(text):
    text = html.unescape(text)
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    # Drop repeated description lines, including repeated promotional blocks.
    lines = dict.fromkeys(line.strip() for line in text.splitlines() if line.strip())
    return re.sub(r"\s+", " ", " ".join(lines)).strip()


def video_text(video):
    title = clean_text(video['title'])
    description = clean_text(video.get('description', ''))[:3000]
    return f"{title}\n{description}".strip()


class EmbeddingService:
    def __init__(self, encoder=None, cache_path=None):
        self.model_name = os.getenv('EMBEDDING_MODEL', 'intfloat/multilingual-e5-small')
        self.revision = os.getenv('EMBEDDING_REVISION', 'main')
        self.device = os.getenv('EMBEDDING_DEVICE', 'cpu')
        self.cache_dir = Path(os.getenv(
            'EMBEDDING_CACHE_DIR', str(Path(__file__).resolve().parent / '.cache' / 'embeddings')
        ))
        self.cache_path = Path(cache_path) if cache_path else self.cache_dir / 'vectors.sqlite3'
        self._encoder = encoder
        self._lock = threading.Lock()
        self._namespace = f'{self.model_name}:{self.revision}'

    def _load(self):
        if self._encoder is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            self._encoder = SentenceTransformer(
                self.model_name, revision=self.revision, device=self.device,
                cache_folder=str(self.cache_dir / 'models'),
            )
            # Keep title first and bound inference cost even for long-context models.
            self._encoder.max_seq_length = min(self._encoder.max_seq_length, 512)
            commit = getattr(self._encoder[0].auto_model.config, '_commit_hash', None)
            self._namespace = f'{self.model_name}:{commit or self.revision}'
        except Exception as exc:
            self._encoder = None
            raise EmbeddingUnavailable(
                'Embedding model could not load. Install requirements and check model access/cache.'
            ) from exc

    def _encode(self, videos, role):
        prefix = f'{role}: ' if self.model_name.startswith('intfloat/multilingual-e5-') else ''
        texts = [prefix + video_text(video) for video in videos]
        keys = [hashlib.sha256(json.dumps(
            [self._namespace, 'title-description-v1', role, video['id'], text],
            ensure_ascii=False,
        ).encode('utf-8')).hexdigest() for video, text in zip(videos, texts)]
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.cache_path)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS vectors (key TEXT PRIMARY KEY, value BLOB)')
            found = {key: np.frombuffer(value, dtype=np.float32).copy() for key, value in
                     db.execute('SELECT key, value FROM vectors WHERE key IN (%s)' %
                                ','.join('?' for _ in keys), keys)}
            missing = list(dict.fromkeys(key for key in keys if key not in found))
            text_by_key = dict(zip(keys, texts))
            if missing:
                try:
                    vectors = self._encoder.encode(
                        [text_by_key[key] for key in missing], batch_size=16,
                        normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False,
                    )
                except Exception as exc:
                    raise EmbeddingUnavailable('Embedding inference failed. Check device and memory settings.') from exc
                for key, vector in zip(missing, vectors):
                    vector = np.asarray(vector, dtype=np.float32)
                    if vector.ndim != 1 or not np.isfinite(vector).all() or np.linalg.norm(vector) == 0:
                        raise EmbeddingUnavailable('Embedding model returned an invalid vector.')
                    found[key] = vector / np.linalg.norm(vector)
                    db.execute('INSERT OR REPLACE INTO vectors VALUES (?, ?)', (key, found[key].tobytes()))
                # Bound persistent cache growth; cache contains vectors, never pickle objects.
                db.execute('DELETE FROM vectors WHERE rowid NOT IN '
                           '(SELECT rowid FROM vectors ORDER BY rowid DESC LIMIT 20000)')
        return np.stack([found[key] for key in keys])

    def rank(self, history, candidates, limit=6, diversity=0.35):
        watched_ids = {video['id'] for video in history}
        watched_titles = {clean_text(video['title']).casefold() for video in history}
        seen_ids, seen_titles, unique = set(), set(), []
        for video in candidates:
            title = clean_text(video['title']).casefold()
            if (video['id'] in watched_ids or title in watched_titles or
                    video['id'] in seen_ids or title in seen_titles):
                continue
            seen_ids.add(video['id'])
            seen_titles.add(title)
            unique.append(video)
        base = {'recommendations': [], 'profiles': [], 'model': self.model_name,
                'candidate_count': len(unique), 'excluded_count': len(candidates) - len(unique)}
        if not unique:
            return base

        # SentenceTransformer loading, inference, and SQLite access are serialized.
        with self._lock:
            self._load()
            history_vectors = self._encode(history, 'query')
            candidate_vectors = self._encode(unique, 'passage')

        groups = defaultdict(list)
        for i, video in enumerate(history):
            groups[video.get('topic') or '기타'].append(i)
        profiles, centroids = [], []
        for topic, indices in sorted(groups.items(), key=lambda item: -len(item[1])):
            centroid = history_vectors[indices].mean(axis=0)
            centroid /= max(float(np.linalg.norm(centroid)), 1e-12)
            profiles.append({'topic': topic, 'count': len(indices)})
            centroids.append(centroid)
        similarities = np.clip(candidate_vectors @ np.stack(centroids).T, -1, 1)
        best_profiles = similarities.argmax(axis=1)
        relevance = similarities.max(axis=1)
        # Relative scores are for ranking only, not confidence probabilities.
        relative = (relevance - relevance.min()) / max(float(np.ptp(relevance)), 1e-6)
        remaining, selected, topic_counts, channel_counts = list(range(len(unique))), [], defaultdict(int), defaultdict(int)
        recommendations = []
        while remaining and len(selected) < limit:
            def score(index):
                redundancy = max((float(candidate_vectors[index] @ candidate_vectors[prev])
                                  for prev in selected), default=0.0)
                coverage = 1 / (1 + topic_counts[int(best_profiles[index])])
                channel = unique[index].get('channel', '').casefold()
                repeat_channel = channel_counts[channel] if channel else 0
                return ((1 - 0.35 * diversity) * float(relative[index])
                        - 0.35 * diversity * redundancy + 0.15 * diversity * coverage
                        - 0.05 * diversity * repeat_channel)

            chosen = max(remaining, key=score)
            profile = profiles[int(best_profiles[chosen])]['topic']
            recommendations.append({
                **unique[chosen], 'url': f"https://www.youtube.com/watch?v={unique[chosen]['id']}",
                'similarity': round(float(relevance[chosen]), 4), 'matched_topic': profile,
                'reason': f'시청 이력의 {profile} 주제와 제목·설명이 의미적으로 연결됩니다.',
            })
            selected.append(chosen)
            remaining.remove(chosen)
            topic_counts[int(best_profiles[chosen])] += 1
            channel = unique[chosen].get('channel', '').casefold()
            if channel:
                channel_counts[channel] += 1
        return {**base, 'recommendations': recommendations, 'profiles': profiles}
