export default function GroupHeader({
  groupName,
  logoUrl1,
  logoUrl2,
}: {
  groupName: string | null;
  logoUrl1: string | null;
  logoUrl2: string | null;
}) {
  if (!groupName && !logoUrl1 && !logoUrl2) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
      {logoUrl1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl1}
          alt={groupName ? `${groupName} logo 1` : 'Group logo'}
          style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '2px solid var(--border)', boxShadow: 'var(--shadow)', flex: '0 0 auto' }}
        />
      )}
      {groupName && (
        <span style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 30, textAlign: 'center', lineHeight: 1.05 }}>
          {groupName.toUpperCase()}
        </span>
      )}
      {logoUrl2 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl2}
          alt={groupName ? `${groupName} logo 2` : 'Group logo'}
          style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '2px solid var(--border)', boxShadow: 'var(--shadow)', flex: '0 0 auto' }}
        />
      )}
    </div>
  );
}
