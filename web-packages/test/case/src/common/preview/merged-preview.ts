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

// 把若干张同尺寸图片按 old|new|heatmap 的 gap/padding/#111 布局横向拼成一张 PNG。
// 不依赖 DOM 容器，buildMergedPreviewDataURL 与 composeComparisonDataURL 共用此绘制核心。
function composeImagesToDataURL (images: HTMLImageElement[]) {
  if (images.length === 0) {
    return '';
  }

  const first = images[0];
  const width = first.naturalWidth || first.width;
  const height = first.naturalHeight || first.height;

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

  const count = images.length;
  const mergedWidth = width * count + gap * (count - 1) + padding * 2;
  const mergedHeight = height + padding * 2;

  mergedCanvas.width = mergedWidth;
  mergedCanvas.height = mergedHeight;
  mergedCtx.fillStyle = '#111';
  mergedCtx.fillRect(0, 0, mergedWidth, mergedHeight);

  images.forEach((image, column) => {
    const x = padding + column * (width + gap);
    const y = padding;

    mergedCtx.drawImage(image, x, y, width, height);
  });

  return mergedCanvas.toDataURL('image/png');
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

  return composeImagesToDataURL([oldImage, newImage, heatmapImage]);
}

// 由 dataURL 列表(old|new|heatmap)直接拼接对比图，供无头落盘使用,无需 DOM 容器。
export async function composeComparisonDataURL (urls: string[]) {
  if (urls.length === 0) {
    return '';
  }

  const images = urls.map(url => {
    const img = new Image();

    img.src = url;

    return img;
  });

  const ready = await Promise.all(images.map(waitImageReady));

  if (ready.some(item => !item)) {
    return '';
  }

  return composeImagesToDataURL(images);
}
