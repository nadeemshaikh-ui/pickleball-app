import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

// Polishes the template-generated Storylines lines (lib/storylines.ts) into
// punchier prose via Haiku 4.5 — cheap enough for a per-Setup-visit call on
// a casual weekly group. Never blocks or fails the feature: on any error
// (missing key, API failure, malformed response) this returns the original
// template lines unchanged, since the template version is already a
// complete, working feature on its own.
export async function POST(req: NextRequest) {
  const { lines } = await req.json();
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ lines: [] });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      system:
        'You write short, punchy pregame hype lines for a casual pickleball group chat. ' +
        'Given plain facts (one per line, each starting with an emoji), rewrite each as one ' +
        'energetic sentence. Keep the same emoji, the same facts and numbers, no invented ' +
        'details, under 20 words per line. Return exactly one output line per input line, ' +
        'in the same order, nothing else — no preamble, no numbering.',
      messages: [{ role: 'user', content: lines.join('\n') }],
    });
    const textBlock = response.content.find(b => b.type === 'text');
    const polished = (textBlock?.type === 'text' ? textBlock.text : '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    return NextResponse.json({ lines: polished.length === lines.length ? polished : lines });
  } catch {
    return NextResponse.json({ lines });
  }
}
