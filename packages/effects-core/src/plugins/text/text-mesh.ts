import type { SpriteItem } from '../sprite/sprite-item';
import { SpriteMesh } from '../sprite/sprite-mesh';
import type { TextItem } from './text-item';

export class TextMesh extends SpriteMesh {
  /**
   *
   * @override
   * @param item
   * @param aIndex
   * @returns
   */
  override getItemGeometryData (item: SpriteItem, aIndex: number) {
    const { splits, renderer, textureSheetAnimation, startSize, textLayout } = item as TextItem;
    const { x: sx, y: sy } = startSize;

    if (renderer.shape) {
      const { index, aPoint } = renderer.shape;
      const point = new Float32Array(aPoint);

      for (let i = 0; i < point.length; i += 6) {
        point[i] *= sx;
        point[i + 1] *= sy;
      }

      return {
        index,
        aPoint: Array.from(point),
      };
    }

    const x = 0.5;// textLayout.meshSize[0] / 2;
    const y = 0.5; // textLayout.meshSize[1] / 2;

    const originData = [-x, y, -x, -y, x, y, x, -y];
    const aPoint = [];
    const index = [];
    let col = 2;
    let row = 2;

    if (splits.length === 1) {
      col = 1;
      row = 1;
    }
    for (let x = 0; x < col; x++) {
      for (let y = 0; y < row; y++) {
        const base = (y * 2 + x) * 4;
        // @ts-expect-error
        const split: number[] = textureSheetAnimation ? [0, 0, 1, 1, splits[0][4]] : splits[y * 2 + x];
        const texOffset = split[4] ? [0, 0, 1, 0, 0, 1, 1, 1] : [0, 1, 0, 0, 1, 1, 1, 0];
        const dw = ((x + x + 1) / col - 1) / 2;
        const dh = ((y + y + 1) / row - 1) / 2;
        const tox = split[0];
        const toy = split[1];
        const tsx = split[4] ? split[3] : split[2];
        const tsy = split[4] ? split[2] : split[3];
        const origin = [
          originData[0] / col + dw,
          originData[1] / row + dh,
          originData[2] / col + dw,
          originData[3] / row + dh,
          originData[4] / col + dw,
          originData[5] / row + dh,
          originData[6] / col + dw,
          originData[7] / row + dh,
        ];

        aPoint.push(
          (origin[0]) * sx, (origin[1]) * sy, texOffset[0] * tsx + tox, texOffset[1] * tsy + toy, aIndex, 0,
          (origin[2]) * sx, (origin[3]) * sy, texOffset[2] * tsx + tox, texOffset[3] * tsy + toy, aIndex, 0,
          (origin[4]) * sx, (origin[5]) * sy, texOffset[4] * tsx + tox, texOffset[5] * tsy + toy, aIndex, 0,
          (origin[6]) * sx, (origin[7]) * sy, texOffset[6] * tsx + tox, texOffset[7] * tsy + toy, aIndex, 0,
        );
        if (this.lineMode) {
          index.push(base, 1 + base, 1 + base, 3 + base, 3 + base, 2 + base, 2 + base, base);
        } else {
          index.push(base, 1 + base, 2 + base, 2 + base, 1 + base, 3 + base);
        }
      }
    }

    return { index, aPoint };
  }
}
