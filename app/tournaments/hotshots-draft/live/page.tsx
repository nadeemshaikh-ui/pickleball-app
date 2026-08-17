'use client';

import React, { useEffect, useState } from 'react';

export default function HotshotsLiveDraft() {
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    // Realtime Postgres subscription logic here
  }, []);

  return (
    <main className="page" style={{ paddingBottom: 80, background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#0f2922', fontFamily: 'serif', marginBottom: 4 }}>HOTSHOTS</h1>
        <p style={{ fontSize: 13, color: '#aa8529', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 800, marginBottom: 30 }}>Live Spectator Room</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 20, justifyContent: 'center' }}>
          {Array.from({ length: 12 }).map((_, idx) => (
            <div 
              key={idx}
              style={{
                width: 160,
                height: 240,
                background: '#f8f9fa',
                border: '2px solid #d4af37',
                borderRadius: 12,
                boxShadow: '0 10px 25px -5px rgba(15, 41, 34, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f2922', fontFamily: 'serif' }}>
                <span style={{ color: '#d4af37' }}>H</span>S
              </div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, fontWeight: 700 }}>HOTSHOT</div>
              <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 4 }}>Card {idx + 1}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
