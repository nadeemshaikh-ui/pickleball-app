import { redirect } from 'next/navigation';

// Tournaments moved to its own top-level nav section (/tournaments) —
// kept as a redirect so old bookmarks/links don't 404.
export default function LegacyTournamentsRedirect() {
  redirect('/tournaments');
}
