'use client';

import { PlusCircle, Link2 } from 'lucide-react';

export default function BranchStep({ onPick, onSkip }: { onPick: (choice: 'create' | 'join') => void; onSkip: () => void }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Are you starting a new club or joining one?</h2>
      <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => onPick('create')}>
        <PlusCircle size={16} /> Starting a new club
      </button>
      <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => onPick('join')}>
        <Link2 size={16} /> Joining an existing club
      </button>
      
      <div style={{ margin: '10px 0', height: 1, background: 'var(--border)' }} />
      
      <button className="btn-secondary" style={{ border: '1.5px dashed var(--border)', background: 'transparent' }} onClick={onSkip}>
        Play as Guest (Skip for now)
      </button>
    </div>
  );
}
