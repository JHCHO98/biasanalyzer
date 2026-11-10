// Illustrative records shared by the landing page and demo workspace.
export const SAMPLE_VIDEOS = [
  { id: 'sample-1', title: '국가 채무 증가, 재정 정책의 쟁점은?', channel: '재정경제이슈', topic: '정치', biasLabel: '보수', biasScore: 0.85 },
  { id: 'sample-2', title: '기후 에너지 정책 개편 발표 내용 분석', channel: '그린포럼', topic: '정치', biasLabel: '진보', biasScore: -0.72 },
  { id: 'sample-3', title: '인공지능 규제법, 기술과 사회에 남은 질문', channel: '테크리뷰', topic: '과학과 기술', biasLabel: '중립', biasScore: 0.05 },
  { id: 'sample-4', title: '주택 대출 금리 추가 인상 전망', channel: '금융포커스', topic: '정치', biasLabel: '보수', biasScore: 0.68 },
  { id: 'sample-5', title: '공공 의료 확대 법안 논쟁 요약', channel: '시사이슈', topic: '정치', biasLabel: '진보', biasScore: -0.81 },
];

export function getTopicCounts(videos) {
  const counts = new Map();
  videos.forEach(video => counts.set(video.topic || '기타', (counts.get(video.topic || '기타') || 0) + 1));
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
