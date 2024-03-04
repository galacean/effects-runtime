/**
 * 抽象插值采样类
 */
export abstract class InterpolationSampler {
  protected cachedIndex = 0;

  constructor (
    protected time: Float32Array,
    protected data: Float32Array,
    protected componentCount: number,
  ) { }

  /**
   * 计算当前 t 时刻的插值
   * @param t 当前时间
   * @returns 插值结果
   */
  evaluate (t: number) {
    const pp = this.time;
    let i1 = this.cachedIndex;
    let t1 = pp[i1];
    let t0 = pp[i1 - 1];

    validate_interval: {
      seek: {
        let right: number;

        linear_scan: {
          //- See http://jsperf.com/comparison-to-undefined/3
          //- slower code:
          //-
          //- 				if ( t >= t1 || t1 === undefined ) {
          forward_scan: if (!(t < t1)) {
            for (let giveUpAt = i1 + 2; ;) {
              if (t1 === undefined) {
                if (t < t0) { break forward_scan; }

                // after end
                i1 = pp.length;
                this.cachedIndex = i1;

                return this.copySampleValue(i1 - 1);
              }

              if (i1 === giveUpAt) { break; } // this loop

              t0 = t1;
              t1 = pp[++i1];

              if (t < t1) {
                // we have arrived at the sought interval
                break seek;
              }
            }

            // prepare binary search on the right side of the index
            right = pp.length;

            break linear_scan;
          }

          //- slower code:
          //-					if ( t < t0 || t0 === undefined ) {
          if (!(t >= t0)) {
            // looping?
            const t1global = pp[1];

            if (t < t1global) {
              i1 = 2; // + 1, using the scan for the details
              t0 = t1global;
            }

            // linear reverse scan
            for (let giveUpAt = i1 - 2; ;) {
              if (t0 === undefined) {
                // before start
                this.cachedIndex = 0;

                return this.copySampleValue(0);
              }

              if (i1 === giveUpAt) { break; } // this loop

              t1 = t0;
              t0 = pp[--i1 - 1];

              if (t >= t0) {
                // we have arrived at the sought interval
                break seek;
              }
            }

            // prepare binary search on the left side of the index
            right = i1;
            i1 = 0;

            break linear_scan;
          }

          // the interval is valid
          break validate_interval;
        } // linear scan

        // binary search
        while (i1 < right) {
          const mid = (i1 + right) >>> 1;

          if (t < pp[mid]) {
            right = mid;
          } else {
            i1 = mid + 1;
          }
        }

        t1 = pp[i1];
        t0 = pp[i1 - 1];

        // check boundary cases, again
        if (t0 === undefined) {
          this.cachedIndex = 0;

          return this.copySampleValue(0);
        }

        if (t1 === undefined) {
          i1 = pp.length;
          this.cachedIndex = i1;

          return this.copySampleValue(i1 - 1);
        }
      } // seek

      this.cachedIndex = i1;

      this.intervalChanged(i1, t0, t1);
    } // validate_interval

    return this.interpolate(i1, t0, t, t1);
  }

  /**
   * 销毁
   */
  dispose () {
    // @ts-expect-error
    this.time = undefined;
    // @ts-expect-error
    this.data = undefined;
  }

  protected copySampleValue (index: number) {
    // copies a sample value to the result buffer
    const values = this.data;
    const stride = this.componentCount;
    const offset = index * stride;

    const result = new Float32Array(stride);

    for (let i = 0; i !== stride; ++i) {
      result[i] = values[offset + i];
    }

    return result;
  }

  protected abstract intervalChanged (i1: number, t0: number, t1: number): void;

  protected abstract interpolate (i1: number, t0: number, t: number, t1: number): Float32Array;
}

class LinearSampler extends InterpolationSampler {

  constructor (time: Float32Array, data: Float32Array, size: number) {
    super(time, data, size);
  }

  protected intervalChanged (i1: number, t0: number, t1: number): void {
  }

  protected interpolate (i1: number, t0: number, t: number, t1: number): Float32Array {
    const values = this.data;
    const stride = this.componentCount ?? 1;
    const offset1 = i1 * stride;
    const offset0 = offset1 - stride;

    const weight1 = (t - t0) / (t1 - t0);
    const weight0 = 1 - weight1;

    const result = new Float32Array(stride);

    for (let i = 0; i !== stride; ++i) {
      result[i] =
        values[offset0 + i] * weight0 +
        values[offset1 + i] * weight1;
    }

    return result;
  }
}

class DiscreteSampler extends InterpolationSampler {

  constructor (time: Float32Array, data: Float32Array, size: number) {
    super(time, data, size);
  }

  protected intervalChanged (i1: number, t0: number, t1: number): void {
  }

  protected interpolate (i1: number, t0: number, t: number, t1: number): Float32Array {
    const values = this.data;
    const stride = this.componentCount ?? 1;
    const offset = (i1 - 1) * stride;

    const result = new Float32Array(stride);

    for (let i = 0; i !== stride; ++i) {
      result[i] = values[offset + i];
    }

    return result;
  }
}

class QuaternionInner {

  static slerpFlat (dst: any, dstOffset: number, src0: any, srcOffset0: number, src1: any, srcOffset1: number, t: number) {
    // fuzz-free, array-based Quaternion SLERP operation
    let x0 = src0[srcOffset0 + 0];
    let y0 = src0[srcOffset0 + 1];
    let z0 = src0[srcOffset0 + 2];
    let w0 = src0[srcOffset0 + 3];

    const x1 = src1[srcOffset1 + 0];
    const y1 = src1[srcOffset1 + 1];
    const z1 = src1[srcOffset1 + 2];
    const w1 = src1[srcOffset1 + 3];

    if (t === 0) {
      dst[dstOffset + 0] = x0;
      dst[dstOffset + 1] = y0;
      dst[dstOffset + 2] = z0;
      dst[dstOffset + 3] = w0;

      return;
    }

    if (t === 1) {
      dst[dstOffset + 0] = x1;
      dst[dstOffset + 1] = y1;
      dst[dstOffset + 2] = z1;
      dst[dstOffset + 3] = w1;

      return;
    }

    if (w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1) {
      let s = 1 - t;
      const cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1;
      const dir = (cos >= 0 ? 1 : - 1);
      const sqrSin = 1 - cos * cos;

      // Skip the Slerp for tiny steps to avoid numeric problems:
      if (sqrSin > Number.EPSILON) {
        const sin = Math.sqrt(sqrSin);
        const len = Math.atan2(sin, cos * dir);

        s = Math.sin(s * len) / sin;
        t = Math.sin(t * len) / sin;
      }

      const tDir = t * dir;

      x0 = x0 * s + x1 * tDir;
      y0 = y0 * s + y1 * tDir;
      z0 = z0 * s + z1 * tDir;
      w0 = w0 * s + w1 * tDir;

      // Normalize in case we just did a lerp:
      if (s === 1 - t) {
        const f = 1 / Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0);

        x0 *= f;
        y0 *= f;
        z0 *= f;
        w0 *= f;
      }
    }

    dst[dstOffset] = x0;
    dst[dstOffset + 1] = y0;
    dst[dstOffset + 2] = z0;
    dst[dstOffset + 3] = w0;
  }
}

class QuaternionLinearSampler extends InterpolationSampler {

  constructor (time: Float32Array, data: Float32Array, size: number) {
    super(time, data, size);
  }

  protected intervalChanged (i1: number, t0: number, t1: number): void {
  }

  protected interpolate (i1: number, t0: number, t: number, t1: number): Float32Array {
    const values = this.data;
    const stride = this.componentCount ?? 1;
    const alpha = (t - t0) / (t1 - t0);
    let offset = i1 * stride;
    const result = new Float32Array(stride);

    for (let end = offset + stride; offset !== end; offset += 4) {
      QuaternionInner.slerpFlat(result, 0, values, offset - stride, values, offset, alpha);
    }

    return result;
  }

}

/**
 * 创建动画采样器，支持线性和跳变两种模式，类别上支持平移、旋转和缩放
 * @param type 动画类型，线性和跳变
 * @param times 时间点数组
 * @param data 关键帧数组
 * @param size 数据分量
 * @param path 动画类别，平移、旋转和缩放
 * @returns 动画采样器
 */
export function createAnimationSampler (type: string, times: Float32Array, data: Float32Array, size: number, path?: string): InterpolationSampler {
  switch (type) {
    case 'LINEAR':
      if (path === 'rotation') {
        return new QuaternionLinearSampler(times, data, size);
      } else {
        return new LinearSampler(times, data, size);
      }
    case 'STEP':
      return new DiscreteSampler(times, data, size);
    case 'CUBICSPLINE':
      // FIXME: support cubic spline
      return new LinearSampler(times, data, size);
    default:
      return new LinearSampler(times, data, size);
  }
}
