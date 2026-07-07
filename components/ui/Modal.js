import { useEffect } from 'react';

export default function Modal({ show, onClose, title, size = 'md', children, footer }) {
  useEffect(() => {
    document.body.style.overflow = show ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [show]);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-custom`} style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: 16, width: '100%',
        maxWidth: size === 'sm' ? 400 : size === 'lg' ? 800 : size === 'xl' ? 1100 : 600,
        maxHeight: '90vh', overflow: 'auto',
        animation: 'fadeInUp 0.25s ease',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border-color)'
        }}>
          <h6 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>{title}</h6>
          <button onClick={onClose} style={{
            background: 'var(--hover-bg)', border: 'none', borderRadius: 8,
            width: 32, height: 32, cursor: 'pointer', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>✕</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
        {footer && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}