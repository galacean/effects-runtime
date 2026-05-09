export class ImageComparator {
  private lastDiffHeatmapDataURL = '';
  private lastDiffSummary = '';

  constructor (
    private pixelThreshold: number,
  ) { }

  async compareImages (image1: Uint8Array, image2: Uint8Array, width?: number, height?: number) {
    let pixelDiffValue = 0;
    let maxChannelDiff = 0;

    this.lastDiffHeatmapDataURL = '';
    this.lastDiffSummary = '';

    const canGenerateHeatmap = !!width && !!height && image1.length === width * height * 4;
    const heatmapData = canGenerateHeatmap ? new Uint8ClampedArray(image1.length) : null;

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

      if (heatmapData) {
        // 使用黄->红渐变标记差异，透明度随差异强度增大。
        const intensity = Math.min(1, diff / 255);

        heatmapData[i] = 255;
        heatmapData[i + 1] = Math.round(220 * (1 - intensity));
        heatmapData[i + 2] = 0;
        heatmapData[i + 3] = diff > this.pixelThreshold ? Math.round(120 + intensity * 120) : 0;
      }
    }

    if (width && height) {
      const ratio = pixelDiffValue / (width * height);

      this.lastDiffSummary = `diff=${(ratio * 100).toFixed(4)}%, maxDelta=${maxChannelDiff}`;

      if (heatmapData) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (ctx) {
          canvas.width = width;
          canvas.height = height;
          const imageData = ctx.createImageData(width, height);

          imageData.data.set(heatmapData);
          ctx.putImageData(imageData, 0, 0);
          this.lastDiffHeatmapDataURL = canvas.toDataURL('image/png');
        }
      }
    }

    return pixelDiffValue;
  }

  getLastDiffHeatmapDataURL () {
    return this.lastDiffHeatmapDataURL;
  }

  getLastDiffSummary () {
    return this.lastDiffSummary;
  }
}
