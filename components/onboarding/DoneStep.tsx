'use client';

import { PartyPopper } from 'lucide-react';

export default function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
      <PartyPopper size={40} />
      <h2>You&apos;re all set!</h2>
      <button className="btn-primary" onClick={onFinish}>
        Start a Session
      </button>
    </div>
  );
}
