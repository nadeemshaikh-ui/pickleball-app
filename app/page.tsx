import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="page" style={{ textAlign: 'center', paddingTop: 64 }}>
      <h1>Pickleball Session</h1>
      <p style={{ color: 'var(--muted)', marginTop: 8 }}>
        Set up tonight&apos;s players, format, and rounds.
      </p>
      <Link href="/setup" className="btn-primary" style={{ marginTop: 24 }}>
        New Session
      </Link>
    </main>
  );
}
