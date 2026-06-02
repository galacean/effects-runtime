function waitImageReady (img: HTMLImageElement) {
  return new Promise<boolean>(resolve => {
    if (img.complete && img.naturalWidth > 0) {
      resolve(true);

      return;
    }

    const onLoad = () => {
      cleanup();
      resolve(true);
    };
    const onError = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };

    img.addEventListener('load', onLoad, { once: true });
    img.addEventListener('error', onError, { once: true });
  });
}

export async function buildMergedPreviewDataURL (groupContainer: HTMLElement) {
  const oldImage = groupContainer.querySelector<HTMLImageElement>('.image-group[data-group="old"] .image-slot img');
  const newImage = groupContainer.querySelector<HTMLImageElement>('.image-group[data-group="new"] .image-slot img');
  const heatmapImage = groupContainer.querySelector<HTMLImageElement>('.image-group[data-group="heatmap"] .image-slot img');

  if (!oldImage || !newImage || !heatmapImage) {
    return '';
  }

  const ready = await Promise.all([
    waitImageReady(oldImage),
    waitImageReady(newImage),
    waitImageReady(heatmapImage),
  ]);

  if (ready.some(item => !item)) {
    return '';
  }

  const width = oldImage.naturalWidth || oldImage.width;
  const height = oldImage.naturalHeight || oldImage.height;

  if (!width || !height) {
    return '';
  }

  const gap = 8;
  const padding = 8;
  const mergedCanvas = document.createElement('canvas');
  const mergedCtx = mergedCanvas.getContext('2d');

  if (!mergedCtx) {
    return '';
  }

  const mergedWidth = width * 3 + gap * 2 + padding * 2;
  const mergedHeight = height + padding * 2;

  mergedCanvas.width = mergedWidth;
  mergedCanvas.height = mergedHeight;
  mergedCtx.fillStyle = '#111';
  mergedCtx.fillRect(0, 0, mergedWidth, mergedHeight);

  const drawBlock = (image: HTMLImageElement, column: number) => {
    const x = padding + column * (width + gap);
    const y = padding;

    mergedCtx.drawImage(image, x, y, width, height);
  };

  drawBlock(oldImage, 0);
  drawBlock(newImage, 1);
  drawBlock(heatmapImage, 2);

  return mergedCanvas.toDataURL('image/png');
}
