'use client';

import { PlusCircle, Link2 } from 'lucide-react';

export default function BranchStep({ onPick }: { onPick: (choice: 'create' | 'join') => void }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Are you starting a new club or joining one?</h2>
      <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => onPick('create')}>
        <PlusCircle size={16} /> Starting a new club
      </button>
      <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => onPick('join')}>
        <Link2 size={16} /> Joining an existing club
      </button>
    </div>
  );
}
