import { loadImage } from '@galacean/effects';

export async function decodeImage (blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);

  try { return await loadImage(url); } finally { URL.revokeObjectURL(url); }
}

export async function createImageThumbnail (image: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));

  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');

  if (!context) { throw new Error('Unable to create an image preview.'); }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to create an image preview.')), 'image/png'));
}
