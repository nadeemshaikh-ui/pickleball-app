import { redirect } from 'next/navigation';

export default async function LegacyTournamentRedirect({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  redirect(`/tournaments/${tournamentId}`);
}
