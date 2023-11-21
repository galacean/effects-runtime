import type { CompositionTransformerAcceler } from './composition-transformer-acceler';
import { DeviceOrientation } from './device-orientation';

export type AccelerMotionData = {
  x: number,
  y: number,
};

/**
 *
 */
export class OrientationAdapterAcceler {
  private transformers: CompositionTransformerAcceler[] = [];
  private connected = false;
  private accelerMotion: DeviceOrientation | null = null;
  private validRange = { // 限制 3d 角度范围
    alpha: [-60, 60], // 相对范围
    beta: [-80, 80], // 上下翻转
    gamma: [-89, 89], // 左右翻转
  };

  connect () {
    if (!this.connected) {
      this.accelerMotion = new DeviceOrientation({
        X: true, // 监听X(beta)轴
        Y: true, // 监听Y(gamma)轴
        interval: Math.floor(1000 / 60), // 监听时间片段(一秒30帧)
        useRequestAnimationFrame: true, // 使用 requestAnimationFrame 对齐
        relativeBeta: false, // bate 角度使用相对初始化的
        relativeGamma: false, // gamma 角度使用相对初始化的
        validRange: this.validRange,
        stableRange: 3, // 稳定区间
      });
      this.accelerMotion.watch((x, y) => {
        const motion: AccelerMotionData = {
          x, y,
        };

        this.dispatchMotion(motion);
      });
    }
    this.connected = true;
  }

  disconnect () {
    if (this.accelerMotion) {
      this.accelerMotion.unWatch();
    }
    this.connected = false;
  }

  /**
   *
   * @param motion
   */
  dispatchMotion (motion: AccelerMotionData) {
    this.transformers.forEach(t => t.update(motion));
  }

  addTransformer (transformer: CompositionTransformerAcceler) {
    if (!this.transformers.includes(transformer)) {
      this.transformers.push(transformer);
    }
  }

  removeTransformer (transformer: CompositionTransformerAcceler) {
    const index = this.transformers.indexOf(transformer);

    if (index > -1) {
      this.transformers.splice(index, 1);
    }

    return this.transformers.length === 0;
  }
}

let adapter: OrientationAdapterAcceler;

export function getAccelerAdapter () {
  if (!adapter) {
    adapter = new OrientationAdapterAcceler();
  }

  return adapter;
}
