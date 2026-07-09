'use client';

import Link from 'next/link';

export default function NewSessionLink() {
  return (
    <Link
      href="/setup"
      style={{
        display: 'inline-block',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--primary)',
        border: '1px solid var(--primary)',
        borderRadius: 999,
        padding: '6px 14px',
        marginBottom: 12,
      }}
    >
      + New Session
    </Link>
  );
}
