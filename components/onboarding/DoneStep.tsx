'use client';

export default function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>🎉</div>
      <h2>You&apos;re all set!</h2>
      <button className="btn-primary" onClick={onFinish}>
        Start a Session
      </button>
    </div>
  );
}
