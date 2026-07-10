import html2canvas from 'html2canvas';

// Renders a DOM element to a PNG File. Split out from sharing so callers can
// pre-render ahead of a click (see shareCachedImage) — calling this and then
// awaiting navigator.share() in the same click handler burns the browser's
// user-gesture window on some mobile browsers (notably Chrome/Android),
// which throws "not allowed by the user agent or platform" even though
// canShare() said yes.
export async function renderElementToImage(element: HTMLElement, filename: string): Promise<File> {
  const canvas = await html2canvas(element, { backgroundColor: '#e5fa00', scale: 2 });
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to render image'))), 'image/png')
  );
  return new File([blob], filename, { type: 'image/png' });
}

// Shares an already-rendered file (native share sheet, e.g. straight into
// WhatsApp) where supported, otherwise downloads it so it can be attached
// manually. Call this synchronously from a click handler with a file that
// was rendered ahead of time — no await before this runs, so the gesture
// window can't expire.
export async function shareCachedImage(file: File): Promise<'shared' | 'downloaded'> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err; // user cancelled the share sheet
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

// Convenience wrapper for one-shot render+share (used where pre-rendering
// isn't practical, e.g. the schedule table which can change right up until
// the share button is clicked). Still vulnerable to the gesture-window
// issue above; shareCachedImage is the preferred path when data is known
// ahead of time.
export async function shareElementAsImage(element: HTMLElement, filename: string): Promise<'shared' | 'downloaded'> {
  const file = await renderElementToImage(element, filename);
  return shareCachedImage(file);
}
