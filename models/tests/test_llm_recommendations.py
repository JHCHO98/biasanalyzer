import json
import os
import unittest
from unittest.mock import patch

import httpx
import openai
from fastapi import FastAPI
from fastapi.testclient import TestClient

from models import llm_api
from models.llm_service import RecommendationLLM, LLMError, summarize_history

HISTORY = [{'id': 'history0001', 'title': '태양광 전력망', 'description': '전력 공급과 수요',
            'topic': '과학과 기술', 'comment': 'PRIVATE_COMMENT', 'biasScore': 0.9}]
CANDIDATES = [{'id': 'newvideo001', 'title': '재생에너지 저장 기술', 'description': '전력 수요를 관리하는 방법',
               'matched_topic': '과학과 기술'}]
PLAN = {'summary': '전력망과 에너지 기술을 시청했습니다.', 'queries': [
    {'query': '태양광 전력망 해설', 'purpose': 'related', 'reason': '자주 본 주제의 구조를 살펴봅니다.'},
    {'query': '전력 공급 수요 기초', 'purpose': 'background', 'reason': '관련 배경을 이해합니다.'},
    {'query': '에너지 저장 장치 비교', 'purpose': 'adjacent', 'reason': '인접 기술로 탐색 범위를 넓힙니다.'},
]}
EXPLANATIONS = {'explanations': [{'id': 'newvideo001', 'reason': '전력망 관심 주제와 연결되는 에너지 저장 기술을 다룹니다.',
                                 'evidence': '재생에너지 저장 기술'}]}


def response_body(data=None, refusal=False):
    content = [{'type': 'refusal', 'refusal': 'Cannot process this input'}] if refusal else [
        {'type': 'output_text', 'text': json.dumps(data, ensure_ascii=False), 'annotations': []}]
    return {'id': 'resp_test', 'object': 'response', 'created_at': 1780000000, 'status': 'completed',
            'error': None, 'incomplete_details': None, 'model': 'gpt-6-luna',
            'output': [{'id': 'msg_test', 'type': 'message', 'status': 'completed', 'role': 'assistant', 'content': content}]}


class LLMTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'LLM_PROVIDER': 'openai', 'OPENAI_API_KEY': 'test-only-key', 'OPENAI_MODEL': 'gpt-6-luna',
                                           'OPENAI_REASONING_EFFORT': 'none'})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.requests = []
        self.data = PLAN
        self.status_code = 200
        self.refusal = False
        self.response_status = 'completed'
        self.now = 1000.0

        def handle(request):
            self.requests.append(json.loads(request.content))
            if self.status_code != 200:
                return httpx.Response(self.status_code, json={'error': {'message': 'provider detail must not leak', 'type': 'request_error'}})
            body = response_body(self.data, self.refusal)
            body['status'] = self.response_status
            return httpx.Response(200, json=body)

        def factory(**kwargs):
            return openai.OpenAI(**kwargs, http_client=httpx.Client(transport=httpx.MockTransport(handle)))

        self.service = RecommendationLLM(client_factory=factory, clock=lambda: self.now)

    def test_real_sdk_structured_request_is_bounded_and_contains_no_comments_or_keys(self):
        result = self.service.queries(HISTORY, 0.35)
        self.assertEqual(len(result['queries']), 3)
        request = self.requests[0]
        self.assertEqual(request['model'], 'gpt-6-luna')
        self.assertFalse(request['store'])
        self.assertEqual(request['reasoning'], {'effort': 'none'})
        schema = request['text']['format']
        self.assertEqual(schema['type'], 'json_schema')
        self.assertTrue(schema['strict'])
        self.assertFalse(schema['schema']['additionalProperties'])
        sent = json.dumps(request['input'])
        self.assertNotIn('PRIVATE_COMMENT', sent)
        self.assertNotIn('test-only-key', sent)
        self.assertNotIn('biasScore', sent)

    def test_cache_reuses_requests_and_expires_and_separates_diversity(self):
        self.assertFalse(self.service.queries(HISTORY, 0.35)['cached'])
        self.assertTrue(self.service.queries(HISTORY, 0.35)['cached'])
        self.assertEqual(len(self.requests), 1)
        self.service.queries(HISTORY, 1)
        self.assertEqual(len(self.requests), 2)
        self.now += 601
        self.service.queries(HISTORY, 0.35)
        self.assertEqual(len(self.requests), 3)

    def test_explanations_must_match_candidate_ids_and_real_metadata(self):
        self.data = EXPLANATIONS
        result = self.service.explain(HISTORY, CANDIDATES)
        self.assertEqual(result['explanations'][0]['id'], 'newvideo001')
        self.assertIn(result['explanations'][0]['evidence'], CANDIDATES[0]['title'])

    def test_invented_candidate_and_unsupported_evidence_are_not_cached(self):
        for invalid in (
            {'explanations': [{**EXPLANATIONS['explanations'][0], 'id': 'invented001'}]},
            {'explanations': [{**EXPLANATIONS['explanations'][0], 'evidence': '영상에서 확인하지 못한 내용'}]},
        ):
            self.data = invalid
            with self.assertRaises(LLMError) as caught:
                self.service.explain(HISTORY, CANDIDATES)
            self.assertEqual(caught.exception.status_code, 502)
        self.data = EXPLANATIONS
        self.assertFalse(self.service.explain(HISTORY, CANDIDATES)['cached'])

    def test_duplicate_ids_and_watched_candidates_are_rejected_before_calling(self):
        for invalid in (CANDIDATES * 2, [{**CANDIDATES[0], 'id': 'history0001'}]):
            with self.assertRaises(LLMError):
                self.service.explain(HISTORY, invalid)
        self.assertEqual(self.requests, [])

    def test_no_key_does_not_call_provider(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
            with self.assertRaises(LLMError) as caught:
                self.service.queries(HISTORY, 0)
        self.assertEqual(caught.exception.code, 'llm_unconfigured')
        self.assertEqual(self.requests, [])

    def test_authentication_rate_limit_and_refusal_are_handled_without_provider_details(self):
        for status_code, expected in ((401, 'llm_authentication'), (429, 'llm_rate_limit'), (500, 'llm_provider')):
            self.status_code = status_code
            with self.assertRaises(LLMError) as caught:
                self.service.queries(HISTORY, 0)
            self.assertEqual(caught.exception.code, expected)
            self.assertNotIn('provider detail', str(caught.exception))
        self.status_code = 200
        self.refusal = True
        with self.assertRaises(LLMError) as caught:
            self.service.queries(HISTORY, 0)
        self.assertEqual(caught.exception.code, 'llm_refusal')

    def test_duplicate_searches_invalid_schema_and_incomplete_output_fail(self):
        self.data = {**PLAN, 'queries': [PLAN['queries'][0]] * 3}
        with self.assertRaises(LLMError) as caught:
            self.service.queries(HISTORY, 0)
        self.assertEqual(caught.exception.code, 'llm_invalid_output')
        self.data = PLAN
        self.response_status = 'incomplete'
        with self.assertRaises(LLMError) as caught:
            self.service.queries(HISTORY, 0)
        self.assertEqual(caught.exception.code, 'llm_incomplete')

    def test_missing_candidate_explanations_and_urls_are_rejected(self):
        self.data = {'explanations': []}
        with self.assertRaises(LLMError):
            self.service.explain(HISTORY, CANDIDATES)
        self.data = {**PLAN, 'summary': 'https://invented.example/video'}
        with self.assertRaises(LLMError):
            self.service.queries(HISTORY, 0)

    def test_timeout_returns_a_retryable_message(self):
        def factory(**kwargs):
            def timeout(request):
                raise httpx.ReadTimeout('network timeout', request=request)
            return openai.OpenAI(**kwargs, http_client=httpx.Client(transport=httpx.MockTransport(timeout)))
        with self.assertRaises(LLMError) as caught:
            RecommendationLLM(client_factory=factory).queries(HISTORY, 0)
        self.assertEqual(caught.exception.code, 'llm_connection')

    def test_history_summary_limits_examples_and_preserves_counts(self):
        history = [{'id': str(i), 'title': 'example', 'topic': 'topic ' + str(i % 10), 'description': 'x' * 500}
                   for i in range(50)]
        summary = summarize_history(history + history)
        self.assertEqual(len(summary), 8)
        self.assertTrue(all(item['count'] == 5 and len(item['examples']) == 3 for item in summary))
        self.assertTrue(all(len(item['examples'][0]['description']) == 240 for item in summary))


class LLMApiTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(llm_api.router)
        self.client = TestClient(app)

    def test_query_contract_and_error_messages(self):
        with patch.object(llm_api.service, 'queries', return_value={**PLAN, 'model': 'gpt-6-luna', 'cached': False}):
            self.assertEqual(self.client.post('/api/recommendations/queries', json={'history': HISTORY}).status_code, 200)
        with patch.object(llm_api.service, 'queries', side_effect=LLMError('llm_unconfigured', '키 설정 필요')):
            response = self.client.post('/api/recommendations/queries', json={'history': HISTORY})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['detail']['code'], 'llm_unconfigured')
        self.assertEqual(self.client.post('/api/recommendations/queries', json={'history': []}).status_code, 422)
        self.assertEqual(self.client.post('/api/recommendations/queries', json={'history': HISTORY, 'diversity': 2}).status_code, 422)

    def test_explanation_contract_rejects_excess_candidates_and_invalid_ids(self):
        with patch.object(llm_api.service, 'explain', return_value=EXPLANATIONS):
            response = self.client.post('/api/recommendations/explain', json={'history': HISTORY, 'recommendations': CANDIDATES})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.post('/api/recommendations/explain', json={'history': HISTORY, 'recommendations': CANDIDATES * 7}).status_code, 422)


if __name__ == '__main__':
    unittest.main()
