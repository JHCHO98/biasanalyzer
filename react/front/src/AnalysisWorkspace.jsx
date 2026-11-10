import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from 'recharts';
import Brand from './components/Brand';
import Modal from './components/Modal';
import EmbeddingRecommendations from './components/EmbeddingRecommendations';
import { SAMPLE_VIDEOS, getTopicCounts } from './sampleVideos';
import { NUDGE_ISSUES } from './nudgeExamples';

const EMPTY_VIDEOS = [];
const TABS = [
  { id: 'patterns', label: '시청 기록', title: '시청 기록', description: '무엇을 자주 보고 있는지, 영상 목록과 주제 분포로 확인합니다.' },
  { id: 'bias', label: '콘텐츠 성향', title: '콘텐츠 성향', description: '정치 관련 영상의 모델 분류 결과와 목록 순서에 따른 변화를 살펴봅니다.' },
  { id: 'nudge', label: '다음 콘텐츠', title: '다음에 볼 콘텐츠', description: '관심 주제로 새 영상을 찾고, 주제와 채널의 다양성을 조절합니다.' },
  { id: 'demo', label: '영상 직접 분석', title: '영상 직접 분석', description: '제목과 댓글을 입력해 주제와 콘텐츠 성향의 분류 결과를 확인합니다.' },
];
const DIAL_LABELS = ['관련성 우선', '가벼운 탐색', '다양성 확대', '폭넓은 탐색'];

export function getBiasSummary(videos) {
  const political = videos.filter(video => video.topic === '정치' && Number.isFinite(video.biasScore));
  const n = political.length;
  if (!n) return { score: 0, drift: 0, concentration: 0, political, progressive: 0, conservative: 0, neutral: 0 };
  let sum = 0, total = 0, progressive = 0, conservative = 0;
  political.forEach((video, index) => {
    const weight = Math.exp(0.05 * (index + 1 - n));
    sum += weight * video.biasScore;
    total += weight;
    if (video.biasScore < -0.05) progressive++;
    else if (video.biasScore > 0.05) conservative++;
  });
  const drift = sum / total;
  const concentration = Math.max(progressive / n, conservative / n) - 1 / 3;
  return { score: Math.max(-1, Math.min(1, drift * (1 + 0.3 * Math.max(0, concentration)))),
    drift, concentration, political, progressive, conservative, neutral: n - progressive - conservative };
}

function biasClass(score) {
  return score > 0.05 ? 'lean-conservative' : score < -0.05 ? 'lean-progressive' : 'lean-neutral';
}

function signed(value, digits = 2) {
  return (value > 0 ? '+' : '') + value.toFixed(digits);
}

function RecordTable({ videos, onSelect, label = '시청 기록 목록' }) {
  return (
    <div className="record-table-scroll" tabIndex={0} role="region" aria-label={label}>
      <table className="record-table">
        <thead><tr><th scope="col">영상 제목</th><th scope="col">주제</th><th scope="col">콘텐츠 성향</th><th scope="col" className="numeric">점수</th></tr></thead>
        <tbody>{videos.map(video => <tr key={video.id}>
          <td><button className="record-title-button" onClick={() => onSelect(video)}>{video.title}</button><span className="table-channel">{video.channel}</span></td>
          <td>{video.topic || '기타'}</td><td className={biasClass(video.biasScore)}>{video.biasLabel || '미분류'}</td>
          <td className={'numeric ' + biasClass(video.biasScore)}>{Number.isFinite(video.biasScore) ? signed(video.biasScore) : '—'}</td>
        </tr>)}</tbody>
      </table>
      {!videos.length && <p className="empty-message">조건에 맞는 영상이 없습니다. 검색어나 주제를 바꿔 주세요.</p>}
    </div>
  );
}

function PatternView({ videos, onSelect, onShowAll }) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('전체');
  const topics = useMemo(() => getTopicCounts(videos), [videos]);
  const diversity = topics.reduce((sum, item) => {
    const p = item.value / videos.length;
    return sum - p * Math.log2(p);
  }, 0) / Math.log2(14);
  const filtered = videos.filter(video => (topic === '전체' || video.topic === topic) &&
    (video.title + ' ' + video.channel).toLowerCase().includes(query.toLowerCase()));
  return <>
    <dl className="record-summary"><div><dt>분석한 영상</dt><dd>{videos.length}<small>개</small></dd></div><div><dt>가장 많이 본 주제</dt><dd>{topics[0]?.name || '없음'}</dd></div><div><dt>주제 다양성</dt><dd>{diversity.toFixed(2)}<small>/ 1</small></dd></div></dl>
    <div className="record-analysis-layout">
      <section className="topic-analysis" aria-label="주제 분포"><h2>주제별 시청 수</h2><p>주제를 누르면 목록을 좁힐 수 있습니다.</p><button className={'topic-reset ' + (topic === '전체' ? 'selected' : '')} onClick={() => setTopic('전체')}>전체 기록</button><ul>{topics.map(item => <li key={item.name}><button aria-pressed={topic === item.name} onClick={() => setTopic(topic === item.name ? '전체' : item.name)} className={topic === item.name ? 'selected' : ''}><span>{item.name}<b>{item.value}</b></span><span className="topic-track"><span style={{ width: item.value / videos.length * 100 + '%' }} /></span></button></li>)}</ul><small>다양성 지수는 14개 주제의 시청 분포를 정규화해 계산합니다.</small></section>
      <section className="record-list-panel"><div className="record-list-toolbar"><label className="search-field"><span>영상·채널 검색</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="제목 또는 채널 이름" /></label><span>{filtered.length}개 영상</span></div><RecordTable videos={filtered.slice(0, 15)} onSelect={onSelect} />{filtered.length > 15 && <p className="field-help">일부 기록을 표시하고 있습니다.</p>}<button className="text-button" onClick={onShowAll}>전체 기록 보기</button></section>
    </div>
  </>;
}

function BiasView({ summary }) {
  const chartData = summary.political.map((video, index) => ({ order: index + 1, score: video.biasScore, title: video.title }));
  return <>
    <div className="bias-overview">
      <section className="bias-summary"><h2>필터 버블 지수</h2><strong className="bias-score">{signed(summary.score, 3)}</strong><p>분석한 정치 영상 {summary.political.length}개의 성향과 집중도를 반영한 값입니다.</p><div className="bias-key"><span className="lean-progressive">진보 −1</span><span>중립 0</span><span className="lean-conservative">보수 +1</span></div><div className="bias-meter"><span style={{ left: ((summary.score + 1) / 2 * 100) + '%' }} /></div></section>
      <dl className="bias-counts"><div><dt>진보로 분류</dt><dd className="lean-progressive">{summary.progressive}<small>개</small></dd></div><div><dt>중립으로 분류</dt><dd>{summary.neutral}<small>개</small></dd></div><div><dt>보수로 분류</dt><dd className="lean-conservative">{summary.conservative}<small>개</small></dd></div></dl>
    </div>
    <section className="workspace-section"><div className="section-heading"><h2>목록 순서에 따른 성향 변화</h2><span>영상별 모델 분류 점수</span></div>{chartData.length ? <div className="chart-region"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 20, right: 24, bottom: 8, left: 0 }}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="order" axisLine={false} tickLine={false} /><YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} axisLine={false} tickLine={false} /><ReferenceLine y={0} stroke="var(--muted)" /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: 4 }} labelFormatter={(label, items) => items[0]?.payload?.title || label} formatter={value => [signed(value), '콘텐츠 성향']} /><Line type="monotone" dataKey="score" stroke="var(--ink)" strokeWidth={2} dot={{ r: 3, fill: 'var(--surface)' }} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div> : <p className="empty-message">정치로 분류된 영상이 없어 성향 추이를 표시할 수 없습니다.</p>}</section>
    <details className="method-details"><summary>점수 계산 방법</summary><p>목록 순서에 지수 감쇠 가중치(λ = 0.05)를 적용한 평균에 방향별 집중도(α = 0.3)를 반영합니다. 값의 범위는 −1에서 +1입니다. 수집 목록의 순서이며 실제 시청 시각을 복원한 그래프는 아닙니다.</p><dl><div><dt>가중 평균</dt><dd>{signed(summary.drift, 3)}</dd></div><div><dt>집중도 R</dt><dd>{summary.concentration.toFixed(3)}</dd></div></dl></details>
  </>;
}

function NudgeView({ realVideos, youtubeApiKey, summary }) {
  const [dial, setDial] = useState(1);
  const [prediction, setPrediction] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [issue, setIssue] = useState('tax');
  const frame = NUDGE_ISSUES[issue];
  const actual = realVideos ? summary.score : 0.52;
  return <>
    <section className="discovery-controls"><div><h2>얼마나 넓게 찾아볼까요?</h2><p>관련성을 우선할지, 주제와 채널을 더 다양하게 볼지 선택하세요.</p></div><div className="diversity-options" role="group" aria-label="추천 다양성">{DIAL_LABELS.map((label, index) => <button key={label} onClick={() => setDial(index)} aria-pressed={dial === index} className={dial === index ? 'selected' : ''}>{label}</button>)}</div></section>
    {realVideos ? <EmbeddingRecommendations history={realVideos} youtubeApiKey={youtubeApiKey} diversityLevel={dial} /> : <section className="discovery-demo"><h2>추천 화면 예시</h2><p>실제 새 영상 검색은 내 시청 기록을 분석한 뒤 사용할 수 있습니다. 아래 항목은 선택한 탐색 범위를 설명하는 가상 콘텐츠입니다.</p><ol>{(dial === 0 ? ['최근 시청 주제의 주요 쟁점 정리', '같은 주제를 다루는 다른 채널의 설명'] : dial === 1 ? ['관심 주제의 배경을 설명하는 영상', '관련 자료와 통계를 정리한 영상'] : dial === 2 ? ['같은 쟁점의 여러 주장을 비교하는 토론', '인접한 주제에서 살펴보는 해설'] : ['자주 보지 않은 주제의 입문 영상', '새로운 채널의 과학·문화 이야기']).map(title => <li key={title}><h3>{title}</h3><span>예시 콘텐츠</span></li>)}</ol></section>}
    <details className="method-details"><summary>내 예상과 모델 측정값 비교하기</summary><div className="reflection-form"><p>내가 예상한 성향과 콘텐츠 기반 측정값의 차이를 살펴보는 실험입니다.{!realVideos && ' 현재 측정값은 데모용입니다.'}</p><label htmlFor="bias-prediction">내가 예상한 성향: {signed(prediction)}</label><input id="bias-prediction" type="range" min="-1" max="1" step="0.05" value={prediction} onChange={event => { setPrediction(Number(event.target.value)); setShowComparison(false); }} /><div className="bias-key"><span>진보 −1</span><span>중립 0</span><span>보수 +1</span></div><button className="button button-outline" onClick={() => setShowComparison(true)}>측정값과 비교</button>{showComparison && <div role="status" className="comparison-result"><dl><div><dt>내 예상</dt><dd>{signed(prediction)}</dd></div><div><dt>모델 측정값</dt><dd>{signed(actual)}</dd></div><div><dt>두 값의 차이</dt><dd>{Math.abs(prediction - actual).toFixed(2)}</dd></div></dl><p>값의 차이는 두 측정 방식이 얼마나 다른지 나타냅니다. 차이만으로 편향의 정도나 원인을 단정할 수는 없습니다.</p></div>}</div></details>
    <details className="method-details"><summary>같은 쟁점을 여러 관점으로 살펴보기</summary><p>관점 비교 방식의 가상 예시입니다. 실제 영상 검색 결과가 아닙니다.</p><div className="issue-options" role="group" aria-label="비교할 쟁점">{Object.entries(NUDGE_ISSUES).map(([key, value]) => <button key={key} className={issue === key ? 'selected' : ''} onClick={() => setIssue(key)} aria-pressed={issue === key}>{value.title}</button>)}</div><div className="perspective-comparison">{[['prog', '진보 관점'], ['neutral', '자료 분석'], ['cons', '보수 관점']].map(([key, label]) => <section key={key}><h3>{label}</h3><h4>{frame[key].title}</h4><p>{frame[key].desc}</p><small>{frame[key].channel}</small></section>)}</div></details>
    <details className="method-details"><summary>다양성 계수 실험 예시</summary><p>추천 관련성과 다양성의 관계를 설명하기 위한 고정 예시입니다. 실제 추천 정확도나 편향 완화 효과를 검증한 결과가 아닙니다.</p><div className="chart-region small"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={[{ coefficient: 0.1, relevance: 94.2, diversity: 15.4 }, { coefficient: 0.2, relevance: 91.8, diversity: 38.6 }, { coefficient: 0.3, relevance: 88.5, diversity: 68.2 }, { coefficient: 0.4, relevance: 82.1, diversity: 84.5 }, { coefficient: 0.5, relevance: 71.3, diversity: 92.7 }]}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="coefficient" /><YAxis domain={[0, 100]} /><Tooltip /><Area type="monotone" dataKey="relevance" name="관련성 예시" stroke="var(--ink)" fill="var(--soft)" isAnimationActive={false} /><Line type="monotone" dataKey="diversity" name="다양성 예시" stroke="var(--progressive)" isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div></details>
  </>;
}

function AnalyzeVideoView() {
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const analyze = async event => {
    event.preventDefault();
    if (!title.trim()) return;
    setLoading(true); setError(''); setResult(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch((process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, comment }), signal: controller.signal });
      if (!response.ok) throw new Error('분석 서버가 요청을 처리하지 못했습니다 (' + response.status + ').');
      setResult(await response.json());
    } catch (failure) {
      setError(failure.name === 'AbortError' ? '분석 시간이 초과됐습니다. 서버 상태를 확인해 주세요.' : '분석에 실패했습니다. 로컬 분석 서버의 연결 상태를 확인해 주세요.');
    } finally { clearTimeout(timer); setLoading(false); }
  };
  return <div className="single-analysis-layout"><form onSubmit={analyze} className="single-analysis-form"><h2>분석할 영상 내용</h2><div className="preset-options"><span>예시 입력</span>{SAMPLE_VIDEOS.slice(0, 3).map(video => <button type="button" key={video.id} onClick={() => { setTitle(video.title); setComment(''); }} className="text-button">{video.biasLabel === '중립' ? '기술' : video.biasLabel} 예시</button>)}</div><label htmlFor="analysis-title">영상 제목</label><input id="analysis-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="영상 제목을 입력해 주세요" required maxLength={500} /><label htmlFor="analysis-comment">댓글</label><textarea id="analysis-comment" value={comment} onChange={event => setComment(event.target.value)} rows={8} placeholder="분석에 함께 사용할 댓글을 입력하세요" maxLength={20000} /><button className="button button-primary" disabled={loading || !title.trim()}>{loading ? '분석 중…' : '영상 분석하기'}</button>{error && <p role="alert" className="form-error">{error}</p>}</form><section className="single-analysis-result" aria-live="polite"><h2>분류 결과</h2>{loading ? <p className="empty-message">제목과 댓글을 분석하고 있습니다.</p> : result ? <><dl className="result-values"><div><dt>주제</dt><dd>{result.topic.label}<small>모델 확률 {(result.topic.confidence * 100).toFixed(1)}%</small></dd></div><div><dt>콘텐츠 성향</dt><dd className={biasClass(result.bias.score)}>{result.bias.label}<small>모델 확률 {(result.bias.confidence * 100).toFixed(1)}%</small></dd></div><div><dt>성향 점수</dt><dd>{signed(result.bias.score)}</dd></div></dl><p className="field-help">모델의 추정 결과입니다. 분류 확률이 콘텐츠의 사실성이나 신뢰도를 뜻하지는 않습니다.</p></> : <p className="empty-message">제목과 댓글을 입력하면 여기에 분석 결과가 표시됩니다.</p>}</section></div>;
}

export default function AnalysisWorkspace({ youtubeApiKey, onResetAll, analyzedVideos = EMPTY_VIDEOS }) {
  const [tab, setTab] = useState('patterns');
  const [mode, setMode] = useState(analyzedVideos.length ? 'real' : 'demo');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [allQuery, setAllQuery] = useState('');
  const [biasFilter, setBiasFilter] = useState('전체');
  useEffect(() => { setMode(analyzedVideos.length ? 'real' : 'demo'); }, [analyzedVideos]);
  const videos = mode === 'real' ? analyzedVideos : SAMPLE_VIDEOS;
  const summary = useMemo(() => getBiasSummary(videos), [videos]);
  const current = TABS.find(item => item.id === tab);
  const closeVideo = useCallback(() => setSelectedVideo(null), []);
  const closeAll = useCallback(() => setShowAll(false), []);
  const allFiltered = videos.filter(video => (biasFilter === '전체' || video.biasLabel === biasFilter) &&
    (video.title + ' ' + video.channel).toLowerCase().includes(allQuery.toLowerCase()));
  return (
    <div className="workspace-page">
      <header className="workspace-header"><button onClick={onResetAll} aria-label="BiasAnalyzer 홈"><Brand compact /></button><nav aria-label="분석 메뉴">{TABS.map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)} className={tab === item.id ? 'selected' : ''}>{item.label}</button>)}</nav><button className="button button-outline print-button" onClick={() => window.print()}>리포트 저장</button></header>
      <main className="workspace-main">
        <div className="workspace-title"><h1>{current.title}</h1><p>{current.description}</p></div>
        <div className="data-toolbar"><div role="group" aria-label="분석 데이터 선택" className="dataset-switch"><button aria-pressed={mode === 'demo'} onClick={() => setMode('demo')} className={mode === 'demo' ? 'selected' : ''}>샘플 기록</button><button aria-pressed={mode === 'real'} disabled={!analyzedVideos.length} onClick={() => setMode('real')} className={mode === 'real' ? 'selected' : ''}>내 기록 {analyzedVideos.length ? '(' + analyzedVideos.length + ')' : ''}</button></div><span>{mode === 'demo' ? '기능 설명용 가상 데이터입니다.' : videos.length + '개 영상의 분석 결과입니다.'}</span><button onClick={onResetAll} className="text-button">시청 기록 연결</button></div>
        {tab === 'patterns' && <PatternView key={mode} videos={videos} onSelect={setSelectedVideo} onShowAll={() => setShowAll(true)} />}
        {tab === 'bias' && <BiasView summary={summary} />}
        {tab === 'nudge' && <NudgeView realVideos={mode === 'real' ? analyzedVideos : null} youtubeApiKey={youtubeApiKey} summary={summary} />}
        {tab === 'demo' && <AnalyzeVideoView />}
      </main>
      <footer className="workspace-footer"><span>제목과 댓글을 바탕으로 한 모델 추정값입니다.</span><button onClick={onResetAll} className="text-button">시작 화면으로</button></footer>
      {showAll && <Modal title="전체 시청 기록" id="all-records-title" onClose={closeAll} wide><div className="all-records-filters"><label className="search-field"><span>제목·채널 검색</span><input type="search" value={allQuery} onChange={event => setAllQuery(event.target.value)} /></label><label>콘텐츠 성향<select value={biasFilter} onChange={event => setBiasFilter(event.target.value)}>{['전체', '진보', '중립', '보수'].map(value => <option key={value}>{value}</option>)}</select></label></div><RecordTable videos={allFiltered} onSelect={video => { closeAll(); setSelectedVideo(video); }} /></Modal>}
      {selectedVideo && <Modal title="영상 분석 상세" id="video-detail-title" onClose={closeVideo}><p className="video-detail-title">{selectedVideo.title}</p><p className="dialog-description">{selectedVideo.channel}</p><dl className="result-values"><div><dt>주제</dt><dd>{selectedVideo.topic}</dd></div><div><dt>콘텐츠 성향</dt><dd className={biasClass(selectedVideo.biasScore)}>{selectedVideo.biasLabel}</dd></div><div><dt>성향 점수</dt><dd>{signed(selectedVideo.biasScore)}</dd></div></dl>{/^[A-Za-z0-9_-]{11}$/.test(selectedVideo.id) ? <a className="button button-outline" href={'https://www.youtube.com/watch?v=' + selectedVideo.id} target="_blank" rel="noopener noreferrer">유튜브에서 영상 보기</a> : <p className="field-help">가상 기록이므로 연결된 실제 영상은 없습니다.</p>}</Modal>}
    </div>
  );
}
