import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi import FastAPI
from fastapi.testclient import TestClient

from models import embedding_api
from models.embedding_service import EmbeddingService, EmbeddingUnavailable, clean_text


class FakeEncoder:
    def __init__(self):
        self.inputs = []

    def encode(self, texts, **kwargs):
        self.inputs.extend(texts)
        return np.array([[1, 0, 0] if 'solar' in text else
                         [0.9, 0.1, 0] if 'wind' in text else
                         [0.7, 0, 0.7] if 'piano' in text else [0, 1, 0]
                         for text in texts], dtype=np.float32)


def video(index, title, topic='energy', **kwargs):
    return {'id': f'{index:011d}', 'title': title, 'topic': topic, **kwargs}


class RankingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.encoder = FakeEncoder()
        self.service = EmbeddingService(self.encoder, Path(self.temp.name) / 'cache.sqlite3')
        # Ignore any developer's model setting for deterministic prefix assertions.
        self.service.model_name = 'intfloat/multilingual-e5-small'

    def tearDown(self):
        self.temp.cleanup()

    def test_related_candidates_exclude_watched_and_duplicate_titles(self):
        history = [video(1, 'solar')]
        candidates = [video(1, 'watched'), video(2, 'solar'), video(3, 'wind'),
                      video(4, 'wind'), video(5, 'cooking')]
        result = self.service.rank(history, candidates, diversity=0)
        self.assertEqual([item['id'] for item in result['recommendations']],
                         [video(3, 'wind')['id'], video(5, 'cooking')['id']])
        self.assertEqual(result['excluded_count'], 3)
        self.assertTrue(any(text.startswith('query: ') for text in self.encoder.inputs))
        self.assertTrue(any(text.startswith('passage: ') for text in self.encoder.inputs))

    def test_cache_reused_and_description_change_invalidates_it(self):
        history, candidates = [video(1, 'solar')], [video(2, 'wind')]
        self.service.rank(history, candidates)
        count = len(self.encoder.inputs)
        self.service.rank(history, candidates)
        self.assertEqual(len(self.encoder.inputs), count)
        self.service.rank(history, [video(2, 'wind', description='updated')])
        self.assertEqual(len(self.encoder.inputs), count + 1)

    def test_dial_can_expand_topic_coverage_without_losing_top_match(self):
        history = [video(1, 'solar'), video(2, 'piano', topic='music')]
        candidates = [video(3, 'solar overview', channel='A'),
                      video(4, 'solar analysis', channel='A'),
                      video(5, 'piano lesson', channel='B')]
        focused = self.service.rank(history, candidates, limit=2, diversity=0)
        diverse = self.service.rank(history, candidates, limit=2, diversity=1)
        self.assertEqual(focused['recommendations'][0]['id'], diverse['recommendations'][0]['id'])
        self.assertEqual(diverse['recommendations'][1]['matched_topic'], 'music')
        self.assertEqual(len(diverse['profiles']), 2)

    def test_description_cleanup(self):
        self.assertEqual(clean_text('A &amp; B\nhttps://example.com\nA &amp; B\n<b>hello</b>'), 'A & B hello')

    def test_fully_watched_pool_does_not_load_an_encoder(self):
        result = self.service.rank([video(1, 'solar')], [video(1, 'solar')])
        self.assertEqual(result['recommendations'], [])
        self.assertEqual(self.encoder.inputs, [])


class ApiTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(embedding_api.router)
        self.client = TestClient(app)
        self.payload = {'history': [video(1, 'solar')], 'candidates': [video(2, 'wind')]}

    def test_response_and_bounded_inputs(self):
        with patch.object(embedding_api.service, 'rank', return_value={'recommendations': []}) as rank:
            response = self.client.post('/api/recommendations/rank', json=self.payload)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(rank.call_args.args[2:], (6, 0.35))
        for overrides in ({'history': []}, {'diversity': 1.1}, {'limit': 21},
                          {'candidates': [{'id': '../bad', 'title': 'bad'}]},
                          {'candidates': [video(2, '   ')]}):
            self.assertEqual(self.client.post('/api/recommendations/rank',
                                              json={**self.payload, **overrides}).status_code, 422)

    def test_unavailable_model_returns_error_without_simulation(self):
        with patch.object(embedding_api.service, 'rank', side_effect=EmbeddingUnavailable('Model unavailable')):
            response = self.client.post('/api/recommendations/rank', json=self.payload)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('recommendations', response.json())


if __name__ == '__main__':
    unittest.main()
