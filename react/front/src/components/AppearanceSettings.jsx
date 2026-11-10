import React, { useState, useCallback } from 'react';
import { useTheme } from '../ThemeContext';
import Modal from './Modal';

export default function AppearanceSettings() {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme, fontSize, setFontSize } = useTheme();
  const close = useCallback(() => setOpen(false), []);
  return <>
    <button className="appearance-trigger" onClick={() => setOpen(true)}>화면 설정</button>
    {open && <Modal title="화면 설정" id="appearance-title" onClose={close}>
      <p className="dialog-description">테마와 글꼴 크기를 선택하세요.</p>
      <fieldset className="settings-group"><legend>화면 테마</legend><div className="theme-options">{[['light', '라이트'], ['dark', '다크']].map(([value, label]) => <button key={value} aria-pressed={theme === value} className={theme === value ? 'selected' : ''} onClick={() => { if (theme !== value) toggleTheme(); }}>{label}</button>)}</div></fieldset>
      <fieldset className="settings-group"><legend>글꼴 크기</legend><div className="font-options">{[['xs', '작게'], ['sm', '조금 작게'], ['base', '기본'], ['lg', '조금 크게'], ['xl', '크게']].map(([value, label]) => <button key={value} aria-pressed={fontSize === value} className={fontSize === value ? 'selected' : ''} onClick={() => setFontSize(value)}>{label}</button>)}</div></fieldset>
    </Modal>}
  </>;
}
