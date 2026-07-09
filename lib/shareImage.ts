import html2canvas from 'html2canvas';

// Renders a DOM element to a PNG and shares it directly (native share sheet,
// e.g. straight into WhatsApp) where supported, otherwise downloads the PNG
// so it can be attached manually.
export async function shareElementAsImage(element: HTMLElement, filename: string): Promise<'shared' | 'downloaded'> {
  const canvas = await html2canvas(element, { backgroundColor: '#e5fa00', scale: 2 });
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to render image'))), 'image/png')
  );
  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return 'shared';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
