// Parses a spoken score like "15 to 10", "15-10", or "15 10" into two
// numbers. Only handles digit transcriptions (what browser speech engines
// reliably produce for numbers like these) — not spelled-out words
// ("fifteen ten") — keeping this simple and predictable over clever.
export function parseSpokenScore(transcript: string): [number, number] | null {
  const digits = transcript.match(/\d+/g);
  if (!digits || digits.length !== 2) return null;
  const a = Number(digits[0]);
  const b = Number(digits[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [a, b];
}

export function isVoiceScoreSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

// Starts one-shot voice capture and resolves with the parsed [scoreA,
// scoreB] tuple, or null if unsupported / denied / unparseable. Never
// throws — a failed voice attempt should silently fall back to manual
// entry, not break the score input.
export function captureSpokenScore(): Promise<[number, number] | null> {
  return new Promise(resolve => {
    const Ctor = (
      window as unknown as { SpeechRecognition?: new () => MinimalSpeechRecognition; webkitSpeechRecognition?: new () => MinimalSpeechRecognition }
    ).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => MinimalSpeechRecognition }).webkitSpeechRecognition;
    if (!Ctor) {
      resolve(null);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    let settled = false;
    const finish = (result: [number, number] | null) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    recognition.onresult = event => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      finish(parseSpokenScore(transcript));
    };
    recognition.onerror = () => finish(null);
    recognition.onend = () => finish(null);

    try {
      recognition.start();
    } catch {
      finish(null);
    }
  });
}
