import React, { useEffect, useMemo, useRef, useState } from 'react';

const EMPTY_HISTORY = [];
const DIVERSITY = [0, 0.35, 0.65, 1];
const PURPOSES = { related: '관심 주제', background: '배경 설명', adjacent: '인접 주제' };
const API_BASE = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const toVideo = video => ({
  id: video.id, title: (video.title || '').slice(0, 500),
  description: (video.description || '').slice(0, 10000),
  channel: (video.channel || '').slice(0, 200), topic: (video.topic || '기타').slice(0, 80),
});

async function readJson(response, source = 'rank') {
  if (!response.ok) {
    if (source === 'llm') {
      let payload;
      try { payload = await response.json(); } catch { /* A proxy can return a non-JSON error. */ }
      const message = payload?.detail?.message;
      throw new Error(typeof message === 'string' ? message.slice(0, 350) : 'LLM 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (source === 'rank' && response.status === 503) throw new Error('임베딩 모델을 불러오지 못했습니다. 서버의 설치·다운로드 상태를 확인해 주세요.');
    if (source === 'youtube' && response.status === 403) throw new Error('YouTube API 키의 권한 또는 검색 할당량을 확인해 주세요.');
    throw new Error('요청에 실패했습니다 (' + response.status + '). 잠시 후 다시 시도해 주세요.');
  }
  return response.json();
}

export default function EmbeddingRecommendations({ history, youtubeApiKey, diversityLevel }) {
  const videos = history || EMPTY_HISTORY;
  const topics = useMemo(() => {
    const counts = new Map();
    videos.forEach(video => counts.set(video.topic || '기타', (counts.get(video.topic || '기타') || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [videos]);
  const [query, setQuery] = useState(() => topics[0]?.[0] || '');
  const [queryPlan, setQueryPlan] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [searchedQueries, setSearchedQueries] = useState([]);
  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [rankError, setRankError] = useState('');
  const [retry, setRetry] = useState(0);
  const [explaining, setExplaining] = useState(false);
  const [explanations, setExplanations] = useState(null);
  const [explanationError, setExplanationError] = useState('');
  const [explanationRetry, setExplanationRetry] = useState(0);
  const searchController = useRef(null);
  const queryController = useRef(null);

  useEffect(() => {
    queryController.current?.abort();
    setQueryPlan(null); setQueryError(''); setGenerating(false);
    return () => queryController.current?.abort();
  }, [videos]);

  useEffect(() => {
    searchController.current?.abort();
    setCandidates([]); setResult(null); setSearching(false);
    setSearchError(''); setRankError(''); setSearchedQueries([]);
    return () => searchController.current?.abort();
  }, [videos, query, youtubeApiKey]);

  // The diversity dial reuses the candidate pool; it never starts a YouTube search.
  useEffect(() => {
    if (!candidates.length || !videos.length) return undefined;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 180000);
    setRanking(true); setRankError(''); setResult(null);
    fetch(API_BASE + '/api/recommendations/rank', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ history: videos.slice(0, 500).map(toVideo), candidates: candidates.map(toVideo),
        limit: 6, diversity: DIVERSITY[diversityLevel] ?? 0.35 }),
    }).then(response => readJson(response)).then(data => {
      if (!controller.signal.aborted) setResult(data);
    }).catch(error => {
      if (!controller.signal.aborted || timedOut) setRankError(timedOut ? '모델 준비 시간이 초과되었습니다. 서버 다운로드가 끝나면 순위를 다시 계산해 주세요.' :
        error.name === 'TypeError' ? '분석 서버에 연결하지 못했습니다. 서버 상태를 확인해 주세요.' : error.message);
    }).finally(() => { clearTimeout(timer); if (!controller.signal.aborted || timedOut) setRanking(false); });
    return () => { clearTimeout(timer); controller.abort(); setRanking(false); };
  }, [candidates, videos, diversityLevel, retry]);

  // Explanations are a separate stage: failure must not discard valid E5 rankings.
  useEffect(() => {
    setExplanations(null); setExplanationError('');
    if (!result?.recommendations?.length) { setExplaining(false); return undefined; }
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    setExplaining(true);
    fetch(API_BASE + '/api/recommendations/explain', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ history: videos.slice(0, 500).map(toVideo),
        recommendations: result.recommendations.map(video => ({ ...toVideo(video), matched_topic: video.matched_topic || '' })) }),
    }).then(response => readJson(response, 'llm')).then(data => {
      if (!Array.isArray(data.explanations)) throw new Error('추천 이유의 응답 형식을 확인하지 못했습니다.');
      if (!controller.signal.aborted) setExplanations({ model: data.model,
        byId: new Map(data.explanations.map(item => [item.id, item])) });
    }).catch(error => {
      if (!controller.signal.aborted || timedOut) setExplanationError(timedOut ? '추천 이유 작성 시간이 초과되었습니다.' :
        error.name === 'TypeError' ? '추천 이유 작성 서버에 연결하지 못했습니다.' : error.message);
    }).finally(() => { clearTimeout(timer); if (!controller.signal.aborted || timedOut) setExplaining(false); });
    return () => { clearTimeout(timer); controller.abort(); setExplaining(false); };
  }, [result, videos, explanationRetry]);

  const generateQueries = async () => {
    if (!videos.length) return;
    queryController.current?.abort();
    const controller = new AbortController();
    queryController.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    setGenerating(true); setQueryError('');
    try {
      const data = await readJson(await fetch(API_BASE + '/api/recommendations/queries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ history: videos.slice(0, 500).map(toVideo), diversity: DIVERSITY[diversityLevel] ?? 0.35 }),
      }), 'llm');
      if (!Array.isArray(data.queries) || data.queries.length !== 3) throw new Error('검색어 제안의 응답 형식을 확인하지 못했습니다.');
      if (!controller.signal.aborted) setQueryPlan({ ...data, level: diversityLevel });
    } catch (error) {
      if (!controller.signal.aborted || timedOut) setQueryError(timedOut ? '검색어 제안 시간이 초과되었습니다. 다시 시도하거나 직접 입력해 주세요.' :
        error.name === 'TypeError' ? '검색어 제안 서버에 연결하지 못했습니다. 직접 입력해 검색할 수 있습니다.' : error.message);
    } finally {
      clearTimeout(timer);
      if (queryController.current === controller) setGenerating(false);
    }
  };

  const searchForQueries = async terms => {
    const queries = [...new Set(terms.map(term => term.trim()).filter(Boolean))].slice(0, 3);
    if (!queries.length || !youtubeApiKey || !videos.length) return;
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, queries.length > 1 ? 90000 : 45000);
    setSearching(true); setSearchError(''); setCandidates([]); setResult(null); setSearchedQueries(queries);
    try {
      const watched = new Set(videos.map(video => video.id));
      const foundIds = new Set();
      for (const term of queries) {
        const params = new URLSearchParams({ part: 'snippet', type: 'video', q: term, maxResults: '25',
          relevanceLanguage: 'ko', regionCode: 'KR', key: youtubeApiKey });
        const data = await readJson(await fetch('https://www.googleapis.com/youtube/v3/search?' + params, { signal: controller.signal }), 'youtube');
        (data.items || []).forEach(item => {
          const id = item.id?.videoId;
          if (id && !watched.has(id)) foundIds.add(id);
        });
      }
      const ids = [...foundIds];
      if (!ids.length) throw new Error('새로운 영상 후보가 없습니다. 검색어를 바꿔 주세요.');
      const next = [];
      for (let i = 0; i < ids.length; i += 25) {
        const params = new URLSearchParams({ part: 'snippet,status', id: ids.slice(i, i + 25).join(','), key: youtubeApiKey });
        const details = await readJson(await fetch('https://www.googleapis.com/youtube/v3/videos?' + params, { signal: controller.signal }), 'youtube');
        next.push(...(details.items || []).filter(item => item.status?.privacyStatus === 'public')
          .map(item => ({ id: item.id, title: item.snippet.title, description: item.snippet.description, channel: item.snippet.channelTitle })));
      }
      if (!next.length) throw new Error('공개 영상 후보가 없습니다. 검색어를 바꿔 주세요.');
      if (!controller.signal.aborted) setCandidates(next);
    } catch (error) {
      if (!controller.signal.aborted || timedOut) setSearchError(timedOut ? 'YouTube 검색 시간이 초과되었습니다. 다시 시도해 주세요.' :
        error.name === 'TypeError' ? 'YouTube에 연결하지 못했습니다. 네트워크를 확인해 주세요.' : error.message);
    } finally {
      clearTimeout(timer);
      if (searchController.current === controller) setSearching(false);
    }
  };

  return (
    <section className="recommendations-panel" aria-label="임베딩 기반 대체 콘텐츠 추천">
      <h2>검색할 주제</h2>
      <p>관심 주제로 아직 보지 않은 영상을 찾습니다. 위 설정을 바꾸면 같은 후보의 순위를 다시 계산합니다.</p>
      <div className="llm-query-heading"><button type="button" className="button button-outline" onClick={generateQueries} disabled={!videos.length || generating || searching || ranking}>{generating ? '검색어 제안 중…' : '검색어 제안받기'}</button><span>직접 입력해도 검색할 수 있습니다.</span></div>
      <p className="field-help">검색어 제안과 추천 이유 작성에는 주제별 집계와 일부 영상 제목·설명을 서버에서 선택한 LLM 제공업체(OpenAI 또는 Anthropic)에 보냅니다. 댓글과 YouTube API 키는 요청 자료에 포함하지 않습니다.</p>
      {queryError && <p role="alert" className="form-error">{queryError}</p>}
      {queryPlan && <section className="query-plan" aria-label="LLM 검색어 제안">
        <p>{queryPlan.summary}</p>
        <p className="field-help">제안 모델: {queryPlan.model}</p>
        {queryPlan.level !== diversityLevel && <p className="field-help">탐색 범위가 변경되었습니다. 현재 설정을 반영하려면 검색어를 다시 제안받으세요.</p>}
        <ul>{queryPlan.queries.map((item, index) => <li key={index}>
          <label htmlFor={'suggested-query-' + index}>{PURPOSES[item.purpose] || '검색 방향'}</label>
          <input id={'suggested-query-' + index} maxLength={100} value={item.query} disabled={searching} onChange={event => setQueryPlan(plan => ({ ...plan, queries: plan.queries.map((entry, i) => i === index ? { ...entry, query: event.target.value } : entry) }))} />
          <p>{item.reason}</p><button className="text-button" type="button" disabled={searching || ranking || !item.query.trim() || !youtubeApiKey} onClick={() => searchForQueries([item.query])}>이 검색어로 찾기</button>
        </li>)}</ul>
        <button type="button" className="button button-outline" disabled={searching || ranking || !youtubeApiKey || queryPlan.queries.some(item => !item.query.trim())} onClick={() => searchForQueries(queryPlan.queries.map(item => item.query))}>제안 검색어 모두 검색</button>
        <p className="field-help">검색어별로 최대 25개를 검색합니다. 중복·시청 이력을 제외한 후보를 함께 정렬합니다.</p>
      </section>}
      <form onSubmit={event => { event.preventDefault(); searchForQueries([query]); }} className="recommendation-search">
        <label htmlFor="recommendation-query">추천 후보 검색어</label>
        <div className="search-input-row"><input id="recommendation-query" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="예: 재생에너지 전력망 해설" required /><button type="submit" disabled={!videos.length || !youtubeApiKey || !query.trim() || searching || ranking} className="button button-primary">{searching ? '검색 중…' : '후보 검색'}</button></div>
        <div className="query-suggestions">{topics.slice(0, 6).map(([topic, count]) => <button key={topic} type="button" onClick={() => setQuery(topic)}>{topic} ({count})</button>)}</div>
      </form>
      {!youtubeApiKey && <p className="field-help">메인 화면에서 YouTube API 키를 입력해 주세요.</p>}
      {ranking && <p role="status" className="request-status">주제 관련성을 계산하고 있습니다. 첫 실행은 모델 다운로드로 시간이 걸릴 수 있습니다.</p>}
      {(searchError || rankError) && <p role="alert" className="form-error">{searchError || rankError}</p>}
      {rankError && candidates.length > 0 && <button type="button" onClick={() => setRetry(value => value + 1)} className="text-button">검색 없이 순위 다시 계산</button>}
      {!result && !searching && !ranking && !searchError && !rankError && <div className="recommendations-empty"><p>검색어를 입력하거나 자주 본 주제를 선택해 주세요.</p><span>추천 결과에 시청한 영상과 중복 후보는 포함하지 않습니다.</span></div>}
      {result && <>
        <div className="recommendation-results-heading"><h3>추천 결과</h3><span>후보 {result.candidate_count}개 중 {result.recommendations.length}개</span></div>
        {searchedQueries.length > 0 && <p className="searched-queries">검색한 주제: {searchedQueries.join(', ')}</p>}
        {explaining && <p role="status" className="request-status">영상 제목·설명을 근거로 추천 이유를 작성하고 있습니다.</p>}
        {explanationError && <div className="explanation-error"><p role="alert" className="form-error">{explanationError} 현재 기본 주제 관련성 설명을 표시합니다.</p><button type="button" className="text-button" onClick={() => setExplanationRetry(value => value + 1)}>추천 이유 다시 작성</button></div>}
        {result.recommendations.length === 0 && <p className="empty-message">중복·시청 이력을 제외한 후보가 없습니다. 검색어를 바꿔 주세요.</p>}
        <ol className="recommendation-results">{result.recommendations.map(video => {
          const explanation = explanations?.byId.get(video.id);
          return <li key={video.id}><h4><a href={'https://www.youtube.com/watch?v=' + video.id} target="_blank" rel="noopener noreferrer">{video.title}</a></h4><p className="recommendation-channel">{video.channel}</p><p>{explanation?.reason || video.reason}</p>{explanation && <blockquote className="recommendation-evidence"><span>제목·설명에서 확인한 구절</span>{explanation.evidence}</blockquote>}<span className="recommendation-topic">관련 주제: {video.matched_topic}</span></li>;
        })}</ol>
        <details className="method-details"><summary>추천 기준 알아보기</summary><p>{result.model} 모델로 제목·설명의 주제 관련성을 비교합니다. 정치적 관점의 균형이나 콘텐츠의 신뢰도를 평가하는 점수는 아닙니다.{explanations && ' 추천 이유는 ' + explanations.model + ' 모델이 후보 정보에 근거해 작성했습니다.'}</p></details>
      </>}
    </section>
  );
}
