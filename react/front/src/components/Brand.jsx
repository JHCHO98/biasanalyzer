import React from 'react';

export default function Brand({ compact = false }) {
  return (
    <span className={`brand ${compact ? 'brand-compact' : ''}`}>
      <svg className="brand-symbol" viewBox="0 0 30 26" fill="none" aria-hidden="true"><path d="M2 4v18l12-9Z" fill="currentColor" /><path d="M20 4v18M27 8v10" stroke="currentColor" strokeWidth="2.4" /></svg>
      <span className="brand-name">BiasAnalyzer<small>유튜브 시청 기록 분석</small></span>
    </span>
  );
}
