export class ImageComparator {
  private lastDiffSummary = '';

  constructor (
    private pixelThreshold: number,
  ) { }

  async compareImages (image1: Uint8Array, image2: Uint8Array, width?: number, height?: number) {
    let pixelDiffValue = 0;
    let maxChannelDiff = 0;

    this.lastDiffSummary = '';

    for (let i = 0; i < image1.length; i += 4) {
      if (image1[i] == image2[i]
        && image1[i + 1] == image2[i + 1]
        && image1[i + 2] == image2[i + 2]
        && image1[i + 3] == image2[i + 3]) {
        continue;
      }
      const diff = Math.max(
        Math.abs(image1[i] - image2[i]),
        Math.abs(image1[i + 1] - image2[i + 1]),
        Math.abs(image1[i + 2] - image2[i + 2]),
        Math.abs(image1[i + 3] - image2[i + 3]),
      );

      if (diff > maxChannelDiff) {
        maxChannelDiff = diff;
      }

      if (diff > this.pixelThreshold) {
        ++pixelDiffValue;
      }
    }

    if (width && height) {
      const ratio = pixelDiffValue / (width * height);

      this.lastDiffSummary = `diff=${(ratio * 100).toFixed(4)}%, maxDelta=${maxChannelDiff}`;
    }

    return pixelDiffValue;
  }

  generateDiffHeatmapDataURL (image1: Uint8Array, image2: Uint8Array, width: number, height: number) {
    if (!width || !height || image1.length !== width * height * 4 || image2.length !== image1.length) {
      return '';
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return '';
    }

    canvas.width = width;
    canvas.height = height;
    const imageData = ctx.createImageData(width, height);
    const rowBytes = width * 4;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < rowBytes; x += 4) {
        const i = y * rowBytes + x;
        const diff = Math.max(
          Math.abs(image1[i] - image2[i]),
          Math.abs(image1[i + 1] - image2[i + 1]),
          Math.abs(image1[i + 2] - image2[i + 2]),
          Math.abs(image1[i + 3] - image2[i + 3]),
        );

        if (diff === 0) {
          continue;
        }

        // WebGL readPixels 的原点在左下角，直接写入翻转后的行。
        const dst = (height - 1 - y) * rowBytes + x;
        const intensity = Math.min(1, diff / 255);

        // 使用黄->红渐变标记差异，透明度随差异强度增大。
        imageData.data[dst] = 255;
        imageData.data[dst + 1] = Math.round(220 * (1 - intensity));
        imageData.data[dst + 2] = 0;
        imageData.data[dst + 3] = diff > this.pixelThreshold ? Math.round(120 + intensity * 120) : 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/png');
  }

  getLastDiffSummary () {
    return this.lastDiffSummary;
  }
}
