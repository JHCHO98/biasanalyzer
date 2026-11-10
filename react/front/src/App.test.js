import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { ThemeProvider } from './ThemeContext';

jest.mock('./Dashboard', () => {
  const React = require('react');
  return ({ analyzedVideos }) => React.createElement('pre', { 'data-testid': 'dashboard-data' }, JSON.stringify(analyzedVideos));
});

const originalFetch = global.fetch;
const jsonResponse = data => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test('shows the actual landing page', () => {
  render(<ThemeProvider><App /></ThemeProvider>);
  expect(screen.getByRole('heading', { name: /내가 본 영상들/, level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '클립보드 데이터 붙여넣기' })).toBeInTheDocument();
});

test('the landing record preview filters the displayed data rather than showing a decorative chart', () => {
  render(<ThemeProvider><App /></ThemeProvider>);
  const filters = screen.getByRole('group', { name: '샘플 기록 주제 선택' });
  fireEvent.click(within(filters).getByRole('button', { name: '과학과 기술' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('인공지능 규제법, 기술과 사회에 남은 질문')).toBeInTheDocument();
  fireEvent.click(within(filters).getByRole('button', { name: '전체' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(5);
});

test('imports records through an accessible dialog and rejects malformed IDs', () => {
  render(<ThemeProvider><App /></ThemeProvider>);
  fireEvent.click(screen.getByRole('button', { name: '클립보드 데이터 붙여넣기' }));
  expect(screen.getByRole('dialog', { name: '시청 기록 연결' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('영상 ID 목록 (JSON)'), { target: { value: '["bad"]' } });
  fireEvent.click(screen.getByRole('button', { name: /기록 연결하기/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('11자리');
  fireEvent.change(screen.getByLabelText('영상 ID 목록 (JSON)'), { target: { value: '["history0001", "history0001"]' } });
  fireEvent.click(screen.getByRole('button', { name: /기록 연결하기/ }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('youtube_data_ids'))).toEqual(['history0001']);
  expect(screen.getByRole('button', { name: '실시간 분석 시작' })).toBeDisabled();
});

test('preserves dark mode preference and updates the font size accessibly', () => {
  localStorage.setItem('theme', 'dark');
  render(<ThemeProvider><App /></ThemeProvider>);
  expect(document.documentElement).toHaveClass('dark');
  fireEvent.click(screen.getByRole('button', { name: '화면 설정' }));
  fireEvent.click(screen.getByRole('button', { name: '라이트' }));
  expect(document.documentElement).not.toHaveClass('dark');
  fireEvent.click(screen.getByRole('button', { name: '조금 크게' }));
  expect(document.documentElement.dataset.fontSize).toBe('lg');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

const renderWithHistory = () => {
  localStorage.setItem('youtube_data_ids', JSON.stringify(['history0001']));
  localStorage.setItem('youtube_api_key', 'test');
  render(<ThemeProvider><App /></ThemeProvider>);
};

test('retains video descriptions for the embedding recommender', async () => {
  global.fetch = jest.fn()
    .mockImplementationOnce(() => jsonResponse({ items: [{ id: 'history0001', snippet: { title: '영상', channelTitle: '채널', description: '관심 주제 설명' } }] }))
    .mockImplementationOnce(() => jsonResponse({ items: [] }))
    .mockImplementationOnce(() => jsonResponse({ topic: { label: '과학과 기술' }, bias: { label: '중립', score: 0 } }));
  renderWithHistory();
  fireEvent.click(await screen.findByRole('button', { name: '실시간 분석 시작' }));
  const data = JSON.parse((await screen.findByTestId('dashboard-data')).textContent);
  expect(data[0].description).toBe('관심 주제 설명');
});

test('does not populate recommendations with fabricated analysis after a model failure', async () => {
  global.fetch = jest.fn()
    .mockImplementationOnce(() => jsonResponse({ items: [{ id: 'history0001', snippet: { title: '영상', channelTitle: '채널' } }] }))
    .mockImplementationOnce(() => jsonResponse({ items: [] }))
    .mockResolvedValueOnce({ ok: false, status: 503 });
  renderWithHistory();
  fireEvent.click(await screen.findByRole('button', { name: '실시간 분석 시작' }));
  await waitFor(() => expect(window.alert).toHaveBeenCalled());
  expect(screen.queryByTestId('dashboard-data')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '실시간 분석 시작' })).toBeInTheDocument();
});
