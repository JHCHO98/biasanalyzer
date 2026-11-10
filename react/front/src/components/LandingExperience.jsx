import React, { useState, useCallback } from 'react';
import Brand from './Brand';
import Modal from './Modal';
import { SAMPLE_VIDEOS, getTopicCounts } from '../sampleVideos';

export default function LandingExperience({ videoData, youtubeApiKey, onApiKeyChange, onImport, onOpenYoutube, onAnalyze, onDemo }) {
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [topic, setTopic] = useState('전체');
  const count = Array.isArray(videoData) ? new Set(videoData).size : 0;
  const topics = getTopicCounts(SAMPLE_VIDEOS);
  const filtered = SAMPLE_VIDEOS.filter(video => topic === '전체' || video.topic === topic);
  const closeImport = useCallback(() => setImportOpen(false), []);
  const submitImport = event => {
    event.preventDefault();
    const error = onImport(importText);
    if (error) setImportError(error);
    else { setImportOpen(false); setImportText(''); }
  };

  return (
    <div className="landing-page">
      <header className="site-header">
        <a href="#top" aria-label="BiasAnalyzer 홈"><Brand /></a>
        <nav aria-label="주요 메뉴"><a href="#about-analysis">분석 기준</a><button onClick={onDemo} className="button button-outline">샘플 분석 보기</button></nav>
      </header>
      <main id="top">
        <section className="landing-introduction">
          <h1>내가 본 영상들,<br />어디에 모여 있을까.</h1>
          <p>유튜브 시청 기록을 주제와 콘텐츠 성향으로 읽습니다.<br />자주 보는 이야기를 확인하고, 다음에 볼 영상을 직접 골라보세요.</p>
        </section>
        <div className="landing-workbench">
          <section className="record-preview" aria-labelledby="sample-records-heading">
            <div className="section-heading"><h2 id="sample-records-heading">시청 기록을 펼쳐보면</h2><span>샘플 기록 {SAMPLE_VIDEOS.length}개</span></div>
            <div className="topic-strip" aria-label="샘플 주제 분포">
              {topics.map(item => <button key={item.name} style={{ flexGrow: item.value }} aria-pressed={topic === item.name} onClick={() => setTopic(topic === item.name ? '전체' : item.name)} className={item.name === '정치' ? 'topic-band-politics' : 'topic-band-science'}><span>{item.name}</span><strong>{item.value}개</strong></button>)}
            </div>
            <p className="preview-instruction">주제를 누르면 해당 영상만 모아볼 수 있습니다.</p>
            <div className="record-filter"><div role="group" aria-label="샘플 기록 주제 선택">{['전체', ...topics.map(item => item.name)].map(name => <button key={name} aria-pressed={topic === name} onClick={() => setTopic(name)} className={topic === name ? 'selected' : ''}>{name}</button>)}</div><span>{filtered.length}개 영상</span></div>
            <ol className="sample-record-list">{filtered.map(video => <li key={video.id}><span className="record-play" aria-hidden="true"><svg viewBox="0 0 24 16"><path d="M9 4v8l7-4Z" fill="currentColor" /></svg></span><div><h3>{video.title}</h3><span>{video.channel}</span></div><span className="record-topic">{video.topic}</span></li>)}</ol>
            <p className="sample-disclosure">기능 설명을 위한 가상 기록입니다. 실제 시청 이력이나 검색 결과가 아닙니다.</p>
            <button onClick={onDemo} className="text-button">이 기록의 분석 결과 열기</button>
          </section>
          <aside className="connection-panel" aria-labelledby="connect-title">
            <h2 id="connect-title">내 기록으로 분석하기</h2><p>확장 프로그램에서 복사한 시청 기록을 연결하세요.</p>
            <div className="connection-field"><span className="field-label">시청 기록</span><div className="connection-record-state"><strong>{count ? count + '개 영상 연결됨' : '연결된 기록 없음'}</strong>{count > 0 && <span className="connected-state">준비됨</span>}</div><button onClick={() => { setImportError(''); setImportOpen(true); }} className="button button-outline full-width">클립보드 데이터 붙여넣기</button><button onClick={onOpenYoutube} className="text-button">유튜브 시청기록 열기</button></div>
            <div className="connection-field"><label htmlFor="youtube-api-key">YouTube API Key</label><div className="input-with-action"><input id="youtube-api-key" type={showKey ? 'text' : 'password'} autoComplete="off" value={youtubeApiKey} onChange={event => onApiKeyChange(event.target.value)} placeholder="API Key 입력..." /><button type="button" onClick={() => setShowKey(value => !value)} className="input-action" aria-label={showKey ? 'API 키 숨기기' : 'API 키 표시'}>{showKey ? '숨기기' : '표시'}</button></div><small>영상 제목과 댓글을 가져오는 데 사용합니다.</small></div>
            <button onClick={onAnalyze} disabled={!youtubeApiKey.trim() || !count} className="button button-primary full-width">실시간 분석 시작</button>
            <p className="connection-help">{!count ? '시청 기록과 API 키를 연결하면 분석을 시작할 수 있습니다.' : '분석이 끝나면 주제 분포와 콘텐츠 탐색 화면이 열립니다.'}</p>
          </aside>
        </div>
        <section id="about-analysis" className="analysis-explanation">
          <h2>기록을 어떻게 읽나요?</h2>
          <dl><div><dt>시청한 주제</dt><dd>제목과 댓글을 바탕으로 영상의 주제를 분류합니다. 주제 분포는 어떤 이야기를 자주 보고 있는지 보여줍니다.</dd></div><div><dt>콘텐츠의 성향</dt><dd>정치 관련 영상의 성향을 모델로 분류합니다. 영상에 대한 추정값이며, 이용자의 정치적 입장을 판정하지 않습니다.</dd></div><div><dt>다음에 볼 영상</dt><dd>직접 입력한 검색어로 후보를 찾습니다. 시청한 영상과의 주제 관련성, 목록의 다양성을 조절해 선택할 수 있습니다.</dd></div></dl>
        </section>
      </main>
      <footer className="site-footer"><span>제72회 경기도과학전람회 출품 프로젝트</span><span>BiasAnalyzer</span></footer>
      {importOpen && <Modal title="시청 기록 연결" id="history-import-title" onClose={closeImport}><p className="dialog-description">확장 프로그램에서 복사한 영상 ID 목록을 붙여넣어 주세요.</p><form onSubmit={submitImport}><label htmlFor="history-import" className="field-label">영상 ID 목록 (JSON)</label><textarea id="history-import" rows={6} value={importText} onChange={event => setImportText(event.target.value)} placeholder={'["영상_ID_1", "영상_ID_2"]'} required />{importError && <p className="form-error" role="alert">{importError}</p>}<div className="dialog-actions"><button type="button" onClick={closeImport} className="button button-outline">취소</button><button type="submit" className="button button-primary">기록 연결하기</button></div></form></Modal>}
    </div>
  );
}
