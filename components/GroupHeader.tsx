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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      {logoUrl1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl1} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
      )}
      {groupName && <span style={{ fontWeight: 800, fontSize: 16 }}>{groupName}</span>}
      {logoUrl2 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl2} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
      )}
    </div>
  );
}
