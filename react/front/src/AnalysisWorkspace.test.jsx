import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import AnalysisWorkspace, { getBiasSummary } from './AnalysisWorkspace';

jest.mock('recharts', () => Object.fromEntries(
  ['ResponsiveContainer', 'ComposedChart', 'Area', 'Line', 'XAxis', 'YAxis', 'CartesianGrid', 'ReferenceLine', 'Tooltip'].map(name => [name, () => null])
));

test('filters the sample records and keeps the full list searchable', () => {
  render(<AnalysisWorkspace onResetAll={jest.fn()} />);
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(6);
  fireEvent.change(screen.getByRole('searchbox', { name: '영상·채널 검색' }), { target: { value: '테크리뷰' } });
  expect(screen.getAllByRole('row')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '전체 기록 보기' }));
  const dialog = screen.getByRole('dialog', { name: '전체 시청 기록' });
  fireEvent.change(within(dialog).getByRole('combobox', { name: '콘텐츠 성향' }), { target: { value: '진보' } });
  expect(within(dialog).getAllByRole('row')).toHaveLength(3);
  fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('changes discovery strength and compares the user estimate with explicitly demo data', () => {
  render(<AnalysisWorkspace onResetAll={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '다음 콘텐츠' }));
  fireEvent.click(screen.getByRole('button', { name: '폭넓은 탐색' }));
  expect(screen.getByRole('button', { name: '폭넓은 탐색' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('새로운 채널의 과학·문화 이야기')).toBeInTheDocument();
  fireEvent.click(screen.getByText('내 예상과 모델 측정값 비교하기'));
  fireEvent.change(screen.getByLabelText(/내가 예상한 성향/), { target: { value: '0.4' } });
  fireEvent.click(screen.getByRole('button', { name: '측정값과 비교' }));
  expect(screen.getByRole('status')).toHaveTextContent('0.12');
});

test('uses the original YouTube ID in record details and handles histories without politics', () => {
  const history = [{ id: 'history0001', title: '실제 과학 영상', channel: '과학 채널', topic: '과학과 기술', biasLabel: '중립', biasScore: 0 }];
  render(<AnalysisWorkspace analyzedVideos={history} onResetAll={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '실제 과학 영상' }));
  expect(screen.getByRole('link', { name: '유튜브에서 영상 보기' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=history0001');
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  fireEvent.click(screen.getByRole('button', { name: '콘텐츠 성향' }));
  expect(screen.getByText('정치로 분류된 영상이 없어 성향 추이를 표시할 수 없습니다.')).toBeInTheDocument();
  expect(getBiasSummary(history).score).toBe(0);
});
