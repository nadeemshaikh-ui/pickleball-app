import StatusChip from '@/components/StatusChip';

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div style={{ padding: '8px 16px 0' }}>
        <StatusChip />
      </div>
      {children}
    </>
  );
}
