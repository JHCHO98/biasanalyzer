import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmbeddingRecommendations from './EmbeddingRecommendations';

const history = [{ id: 'history0001', title: 'solar', description: 'power grid', topic: '과학과 기술' }];
const response = data => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
const searchResult = { items: [{ id: { videoId: 'newvideo001' } }, { id: { videoId: 'history0001' } }] };
const details = { items: [{ id: 'newvideo001', snippet: { title: '새로운 영상', description: '전력망 설명', channelTitle: '채널' }, status: { privacyStatus: 'public' } }] };
const ranked = { model: 'E5', candidate_count: 1, recommendations: [{ id: 'newvideo001', title: '추천 결과', description: '전력망 설명', channel: '채널', matched_topic: '과학과 기술', similarity: 0.84, reason: '기본 관련성 설명' }] };
const explanation = { model: 'gpt-6-luna', explanations: [{ id: 'newvideo001', reason: '관심 주제와 전력망 설명이 연결됩니다.', evidence: '전력망 설명' }] };
const plan = { model: 'gpt-6-luna', summary: '전력 관련 영상을 시청했습니다.', queries: [
  { query: '태양광 전력망', purpose: 'related', reason: '관심 주제 설명' },
  { query: '전력 공급 수요', purpose: 'background', reason: '배경 주제 설명' },
  { query: '에너지 저장 기술', purpose: 'adjacent', reason: '인접 주제 설명' },
] };
const originalFetch = global.fetch;
const callsTo = path => global.fetch.mock.calls.filter(([url]) => String(url).includes(path));

function mockFetch(overrides = {}) {
  global.fetch = jest.fn((url, options) => {
    if (String(url).includes('/api/recommendations/queries')) return overrides.queries?.(url, options) || response(plan);
    if (String(url).includes('/api/recommendations/explain')) return overrides.explain?.(url, options) || response(explanation);
    if (String(url).includes('/api/recommendations/rank')) return overrides.rank?.(url, options) || response(ranked);
    if (String(url).includes('/v3/search?')) return response(searchResult);
    if (String(url).includes('/v3/videos?')) return response(details);
    return Promise.reject(new Error('Unexpected test URL'));
  });
}

afterEach(() => { global.fetch = originalFetch; });

test('searches unwatched videos and reranks the pool without repeating YouTube requests', async () => {
  mockFetch();
  const { rerender } = render(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={1} />);
  fireEvent.click(screen.getByRole('button', { name: '후보 검색' }));
  expect(await screen.findByRole('link', { name: '추천 결과' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=newvideo001');
  await screen.findByText(explanation.explanations[0].reason);
  expect(new URL(callsTo('/v3/videos?')[0][0]).searchParams.get('id')).toBe('newvideo001');
  expect(JSON.parse(callsTo('/rank')[0][1].body).candidates[0].description).toBe('전력망 설명');
  expect(JSON.parse(callsTo('/explain')[0][1].body).recommendations[0].id).toBe('newvideo001');
  rerender(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={3} />);
  await waitFor(() => expect(callsTo('/rank')).toHaveLength(2));
  expect(JSON.parse(callsTo('/rank')[1][1].body).diversity).toBe(1);
  await screen.findByText(explanation.explanations[0].reason);
  expect(callsTo('/v3/search?')).toHaveLength(1);
  expect(callsTo('/v3/videos?')).toHaveLength(1);
});

test('embedding errors are visible and retry does not repeat the YouTube search', async () => {
  let fail = true;
  mockFetch({ rank: () => fail ? Promise.resolve({ ok: false, status: 503 }) : response(ranked) });
  render(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={1} />);
  fireEvent.click(screen.getByRole('button', { name: '후보 검색' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('임베딩 모델');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: '검색 없이 순위 다시 계산' }));
  await screen.findByText(explanation.explanations[0].reason);
  expect(callsTo('/v3/search?')).toHaveLength(1);
});

test('changing query discards prior results without an automatic paid search', async () => {
  mockFetch();
  render(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={1} />);
  fireEvent.click(screen.getByRole('button', { name: '후보 검색' }));
  await screen.findByText(explanation.explanations[0].reason);
  const count = global.fetch.mock.calls.length;
  fireEvent.change(screen.getByLabelText('추천 후보 검색어'), { target: { value: '피아노' } });
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(count);
});

test('query suggestions are editable and the three searches deduplicate their shared candidates', async () => {
  mockFetch();
  render(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={1} />);
  fireEvent.click(screen.getByRole('button', { name: '검색어 제안받기' }));
  await screen.findByText(plan.summary);
  expect(callsTo('/v3/search?')).toHaveLength(0);
  expect(JSON.parse(callsTo('/queries')[0][1].body).diversity).toBe(0.35);
  fireEvent.change(screen.getByLabelText('관심 주제'), { target: { value: '수정한 검색어' } });
  fireEvent.click(screen.getByRole('button', { name: '제안 검색어 모두 검색' }));
  await screen.findByText(explanation.explanations[0].reason);
  expect(callsTo('/v3/search?')).toHaveLength(3);
  expect(new URL(callsTo('/v3/search?')[0][0]).searchParams.get('q')).toBe('수정한 검색어');
  expect(callsTo('/v3/videos?')).toHaveLength(1);
  expect(JSON.parse(callsTo('/rank')[0][1].body).candidates).toHaveLength(1);
  expect(callsTo('/queries')).toHaveLength(1);
});

test('missing LLM configuration preserves manual search and ranked results', async () => {
  mockFetch({ queries: () => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({ detail: { code: 'llm_unconfigured', message: '서버에 OPENAI_API_KEY를 설정해 주세요.' } }) }) });
  render(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={1} />);
  fireEvent.click(screen.getByRole('button', { name: '검색어 제안받기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('OPENAI_API_KEY');
  fireEvent.click(screen.getByRole('button', { name: '후보 검색' }));
  await screen.findByText(explanation.explanations[0].reason);
  expect(callsTo('/v3/search?')).toHaveLength(1);
});

test('explanation failure keeps E5 results and its retry calls only the LLM endpoint', async () => {
  let fail = true;
  mockFetch({ explain: () => fail ? Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({ detail: { message: '사용 한도에 도달했습니다.' } }) }) : response(explanation) });
  render(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={1} />);
  fireEvent.click(screen.getByRole('button', { name: '후보 검색' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('기본 주제 관련성 설명');
  expect(screen.getByRole('link', { name: '추천 결과' })).toBeInTheDocument();
  expect(screen.getByText('기본 관련성 설명')).toBeInTheDocument();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: '추천 이유 다시 작성' }));
  await screen.findByText(explanation.explanations[0].reason);
  expect(callsTo('/v3/search?')).toHaveLength(1);
  expect(callsTo('/rank')).toHaveLength(1);
  expect(callsTo('/explain')).toHaveLength(2);
});

test('late suggestions from a previous history do not appear after history replacement', async () => {
  let finish;
  mockFetch({ queries: () => new Promise(resolve => { finish = resolve; }) });
  const { rerender } = render(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={1} />);
  fireEvent.click(screen.getByRole('button', { name: '검색어 제안받기' }));
  rerender(<EmbeddingRecommendations history={[{ id: 'history0002', title: 'piano', topic: '음악' }]} youtubeApiKey="test" diversityLevel={1} />);
  await act(async () => { finish(await response(plan)); });
  expect(screen.queryByText(plan.summary)).not.toBeInTheDocument();
  expect(callsTo('/v3/search?')).toHaveLength(0);
});

test('changing diversity marks old query suggestions without silently generating new ones', async () => {
  mockFetch();
  const { rerender } = render(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={1} />);
  fireEvent.click(screen.getByRole('button', { name: '검색어 제안받기' }));
  await screen.findByText(plan.summary);
  rerender(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={3} />);
  expect(screen.getByText(/탐색 범위가 변경되었습니다/)).toBeInTheDocument();
  expect(callsTo('/queries')).toHaveLength(1);
});

test('Claude uses the same UI and endpoints and displays its model attribution', async () => {
  mockFetch({
    queries: () => response({ ...plan, model: 'claude-haiku-5-5', provider: 'anthropic' }),
    explain: () => response({ ...explanation, model: 'claude-haiku-5-5', provider: 'anthropic' }),
  });
  render(<EmbeddingRecommendations history={history} youtubeApiKey="test" diversityLevel={1} />);
  fireEvent.click(screen.getByRole('button', { name: '검색어 제안받기' }));
  expect(await screen.findByText('제안 모델: claude-haiku-5-5')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: '이 검색어로 찾기' })[0]);
  await screen.findByText(explanation.explanations[0].reason);
  fireEvent.click(screen.getByText('추천 기준 알아보기'));
  expect(screen.getByText(/추천 이유는 claude-haiku-5-5 모델/)).toBeInTheDocument();
  expect(callsTo('/queries')).toHaveLength(1);
  expect(callsTo('/explain')).toHaveLength(1);
});
