import React, { useEffect, useRef } from 'react';

export default function Modal({ title, id, onClose, children, wide = false }) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () => [...panel.current.querySelectorAll('button:not(:disabled), input, textarea, a[href], [tabindex="0"]')];
    focusable()[0]?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = focusable();
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={id} className={'dialog-panel' + (wide ? ' dialog-wide' : '')}>
        <div className="dialog-heading"><h2 id={id}>{title}</h2><button className="dialog-close" onClick={onClose}>닫기</button></div>
        {children}
      </section>
    </div>
  );
}
