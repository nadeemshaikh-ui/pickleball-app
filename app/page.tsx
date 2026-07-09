import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: 24, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <h1>Pickleball Session</h1>
      <p>Set up tonight&apos;s players, format, and rounds.</p>
      <Link
        href="/setup"
        style={{
          display: 'inline-block',
          marginTop: 24,
          padding: '16px 32px',
          background: '#1a5f3f',
          color: 'white',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 18,
        }}
      >
        New Session
      </Link>
    </main>
  );
}
