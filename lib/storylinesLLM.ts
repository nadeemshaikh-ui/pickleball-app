// Progressive enhancement over lib/storylines.ts's template lines — calls
// our own /api/storylines route (server-side, holds the Anthropic key) to
// rewrite them via Haiku 4.5. Returns null on any failure so callers can
// keep showing the template version, which is already a complete feature.
export async function polishStorylines(lines: string[]): Promise<string[] | null> {
  try {
    const res = await fetch('/api/storylines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.lines) && data.lines.length === lines.length ? data.lines : null;
  } catch {
    return null;
  }
}
