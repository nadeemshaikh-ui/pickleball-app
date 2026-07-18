import { redirect } from 'next/navigation';

export default async function LegacyStageRedirect({ params }: { params: Promise<{ tournamentId: string; stageId: string }> }) {
  const { tournamentId, stageId } = await params;
  redirect(`/tournaments/${tournamentId}/stage/${stageId}`);
}
