import json
import os
import unittest
from unittest.mock import Mock, patch

import anthropic
import httpx2
from fastapi import FastAPI
from fastapi.testclient import TestClient

from models import llm_api
from models.llm_service import RecommendationLLM, LLMError
from test_llm_recommendations import HISTORY, CANDIDATES, PLAN, EXPLANATIONS


class ClaudeTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            'LLM_PROVIDER': 'anthropic', 'ANTHROPIC_API_KEY': 'anthropic-test-key',
            'ANTHROPIC_MODEL': 'claude-haiku-5-5', 'OPENAI_API_KEY': 'unused-openai-key',
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.requests = []
        self.data = PLAN
        self.stop_reason = 'end_turn'
        self.status_code = 200
        self.timeout = False

        def handle(request):
            self.requests.append(json.loads(request.content))
            if self.timeout:
                raise httpx2.ReadTimeout('mock timeout', request=request)
            if self.status_code != 200:
                return httpx2.Response(self.status_code, json={'type': 'error', 'error': {
                    'type': 'api_error', 'message': 'provider detail must not leak'}})
            content = [] if self.stop_reason == 'refusal' else [
                {'type': 'text', 'text': json.dumps(self.data, ensure_ascii=False)}]
            return httpx2.Response(200, json={
                'id': 'msg_test', 'type': 'message', 'role': 'assistant', 'model': 'claude-haiku-5-5',
                'content': content, 'stop_reason': self.stop_reason, 'stop_sequence': None,
                'usage': {'input_tokens': 100, 'output_tokens': 100},
            })

        def factory(**kwargs):
            return anthropic.Anthropic(**kwargs, http_client=httpx2.Client(transport=httpx2.MockTransport(handle)))

        self.openai_factory = Mock(side_effect=AssertionError('OpenAI must not be used for Claude requests'))
        self.service = RecommendationLLM(client_factory=self.openai_factory, anthropic_client_factory=factory)

    def test_real_sdk_uses_native_structured_output_and_only_claude_credentials(self):
        result = self.service.queries(HISTORY, 0.35)
        self.assertEqual(result['provider'], 'anthropic')
        self.assertEqual(result['model'], 'claude-haiku-5-5')
        self.assertEqual(len(result['queries']), 3)
        request = self.requests[0]
        self.assertEqual(request['max_tokens'], 2200)
        self.assertEqual(request['output_config']['format']['type'], 'json_schema')
        self.assertFalse(request['output_config']['format']['schema']['additionalProperties'])
        self.assertIn('system', request)
        self.assertNotIn('store', request)
        self.assertNotIn('reasoning', request)
        sent = json.dumps(request)
        for excluded in ('PRIVATE_COMMENT', 'biasScore', 'anthropic-test-key', 'unused-openai-key'):
            self.assertNotIn(excluded, sent)
        self.openai_factory.assert_not_called()

    def test_claude_evidence_uses_same_grounding_rules(self):
        self.data = EXPLANATIONS
        self.assertEqual(self.service.explain(HISTORY, CANDIDATES)['provider'], 'anthropic')
        self.data = {'explanations': [{**EXPLANATIONS['explanations'][0], 'evidence': 'unsupported assertion'}]}
        # Alter the request context to avoid the valid response's cache entry.
        changed = [{**CANDIDATES[0], 'description': '새로운 전력 자료'}]
        with self.assertRaises(LLMError) as caught:
            self.service.explain(HISTORY, changed)
        self.assertEqual(caught.exception.code, 'llm_unsupported_evidence')

    def test_missing_claude_key_does_not_fall_back_to_openai(self):
        with patch.dict(os.environ, {'ANTHROPIC_API_KEY': ''}):
            with self.assertRaises(LLMError) as caught:
                self.service.queries(HISTORY, 0)
        self.assertIn('ANTHROPIC_API_KEY', str(caught.exception))
        self.assertEqual(self.requests, [])
        self.openai_factory.assert_not_called()

    def test_alias_and_cache_are_supported(self):
        self.assertFalse(self.service.queries(HISTORY, 0.35)['cached'])
        with patch.dict(os.environ, {'LLM_PROVIDER': 'claude'}):
            self.assertTrue(self.service.queries(HISTORY, 0.35)['cached'])
        self.assertEqual(len(self.requests), 1)

    def test_cache_isolated_between_providers_even_when_model_and_key_match(self):
        first = self.service.queries(HISTORY, 0.35)
        with patch.dict(os.environ, {'LLM_PROVIDER': 'openai', 'OPENAI_API_KEY': 'anthropic-test-key',
                                    'OPENAI_MODEL': 'claude-haiku-5-5', 'OPENAI_REASONING_EFFORT': 'none'}):
            with self.assertRaises(AssertionError):
                self.service.queries(HISTORY, 0.35)
        self.assertEqual(first['provider'], 'anthropic')
        self.openai_factory.assert_called_once()

    def test_invalid_provider_is_explicit(self):
        with patch.dict(os.environ, {'LLM_PROVIDER': 'unknown'}):
            with self.assertRaises(LLMError) as caught:
                self.service.queries(HISTORY, 0)
        self.assertEqual(caught.exception.code, 'llm_configuration')
        self.assertEqual(self.requests, [])

    def test_openai_only_settings_do_not_affect_claude(self):
        with patch.dict(os.environ, {'OPENAI_REASONING_EFFORT': 'not-an-effort'}):
            self.assertEqual(self.service.queries(HISTORY, 0)['provider'], 'anthropic')

    def test_authentication_rate_limit_and_provider_errors(self):
        for status, code in ((401, 'llm_authentication'), (403, 'llm_authentication'),
                             (429, 'llm_rate_limit'), (500, 'llm_provider')):
            self.status_code = status
            with self.assertRaises(LLMError) as caught:
                self.service.queries(HISTORY, 0)
            self.assertEqual(caught.exception.code, code)
            self.assertNotIn('provider detail', str(caught.exception))

    def test_refusal_and_token_limit_do_not_produce_suggestions(self):
        for stop, code in (('refusal', 'llm_refusal'), ('max_tokens', 'llm_incomplete')):
            self.stop_reason = stop
            with self.assertRaises(LLMError) as caught:
                self.service.queries(HISTORY, 0)
            self.assertEqual(caught.exception.code, code)

    def test_invalid_schema_and_timeouts_are_handled(self):
        self.data = {**PLAN, 'queries': [PLAN['queries'][0]] * 3}
        with self.assertRaises(LLMError) as caught:
            self.service.queries(HISTORY, 0)
        self.assertEqual(caught.exception.code, 'llm_invalid_output')
        self.timeout = True
        with self.assertRaises(LLMError) as caught:
            self.service.queries(HISTORY, 0)
        self.assertEqual(caught.exception.code, 'llm_connection')

    def test_http_endpoints_keep_same_contract_for_claude(self):
        app = FastAPI()
        app.include_router(llm_api.router)
        client = TestClient(app)
        with patch.object(llm_api, 'service', self.service):
            response = client.post('/api/recommendations/queries', json={'history': HISTORY})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['provider'], 'anthropic')
            self.data = EXPLANATIONS
            response = client.post('/api/recommendations/explain', json={
                'history': HISTORY, 'recommendations': CANDIDATES})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['provider'], 'anthropic')


if __name__ == '__main__':
    unittest.main()
