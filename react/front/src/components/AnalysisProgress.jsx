import React from 'react';
import Brand from './Brand';

export default function AnalysisProgress({ progress, title, eta }) {
  return (
    <main className="analysis-page">
      <div className="analysis-brand"><Brand /></div>
      <section className="analysis-panel">
        <h1>시청 기록을 분석하고 있습니다.</h1>
        <p>영상 제목과 댓글에서 주제와 콘텐츠 성향을 확인합니다.</p>
        <div className="progress-heading"><span>분석 진행률</span><strong>{progress}%</strong></div>
        <div className="analysis-progress" role="progressbar" aria-label="시청 기록 분석 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: progress + '%' }} /></div>
        <p className="analysis-meta">{eta > 0 ? '예상 잔여 시간 약 ' + eta + '초' : '분석 결과를 정리하고 있어요'}</p>
        <div className="analysis-task"><span className="processing-dot" /><span>{title || '영상 정보를 불러오고 있습니다.'}</span></div>
        <ol className="analysis-steps"><li>기록 연결 완료</li><li aria-current="step">주제·성향 분석 중</li><li>결과 정리</li></ol>
      </section>
    </main>
  );
}
