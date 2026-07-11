'use client';

export default function BranchStep({ onPick }: { onPick: (choice: 'create' | 'join') => void }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Are you starting a new club or joining one?</h2>
      <button className="btn-primary" onClick={() => onPick('create')}>
        🆕 Starting a new club
      </button>
      <button className="btn-secondary" onClick={() => onPick('join')}>
        🔗 Joining an existing club
      </button>
    </div>
  );
}
