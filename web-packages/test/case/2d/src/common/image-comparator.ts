export class ImageComparator {

  constructor (
    private pixelThreshold: number,
  ) { }

  async compareImages (image1: Uint8Array, image2: Uint8Array) {
    let pixelDiffValue = 0;

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

      if (diff > this.pixelThreshold) {
        ++pixelDiffValue;
      }
    }

    return pixelDiffValue;
  }
}
