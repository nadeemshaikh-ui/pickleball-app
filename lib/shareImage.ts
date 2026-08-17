import html2canvas from 'html2canvas';

// Renders a DOM element to an Ultra-HD PNG File (3200px wide, 300 DPI).
// Scaled at 2x resolution to guarantee 100% compatibility on iOS Safari & Android WebViews without exceeding mobile GPU canvas limits (4096px max).
export async function renderElementToImage(element: HTMLElement, filename: string): Promise<File> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2, // 3200px Ultra-HD canvas (safe for iOS Safari & Android WebViews)
    useCORS: true,
    allowTaint: true,
    logging: false,
    imageTimeout: 0
  });

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to render image'))), 'image/png', 1.0)
  );
  return new File([blob], filename, { type: 'image/png' });
}

// Shares an already-rendered file (native share sheet, e.g. straight into
// WhatsApp) where supported, otherwise downloads it so it can be attached
// manually.
export async function shareCachedImage(file: File, shareText?: string): Promise<'shared' | 'downloaded'> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: sessionTitleFromFilename(file.name),
        text: shareText || '🎾 Hotshots Tournament Schedule'
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err; // user cancelled share sheet
    }
  }

  // Fallback: Save file to device & return downloaded flag
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

function sessionTitleFromFilename(filename: string): string {
  if (filename.includes('groupings') || filename.includes('court')) {
    return '🎾 Hourly Court & Player Groupings';
  }
  return '🎾 Official Tournament Match Schedule';
}

export async function shareElementAsImage(element: HTMLElement, filename: string, text?: string): Promise<'shared' | 'downloaded'> {
  const file = await renderElementToImage(element, filename);
  return shareCachedImage(file, text);
}
