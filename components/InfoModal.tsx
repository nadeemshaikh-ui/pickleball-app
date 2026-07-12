'use client';

interface InfoModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export default function InfoModal({ title, children, onClose }: InfoModalProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 420, width: '100%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{children}</div>
        <button className="btn-secondary" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
