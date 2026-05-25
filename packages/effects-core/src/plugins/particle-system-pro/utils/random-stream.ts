/**
 * 确定性随机数流（xorshift32）。
 *
 * 粒子模拟要求同样的 seed 总能产出同一组随机数，因此不使用 Math.random。
 * 32 位状态，周期 2^32 - 1，足以用于单个 emitter / 粒子级别的随机。
 */
export class ProRandomStream {
  private state: number;

  constructor (seed: number) {
    this.state = (seed | 0) || 0x9E3779B9;
  }

  /**
   * 用一个新种子重置流。
   */
  reseed (seed: number): void {
    this.state = (seed | 0) || 0x9E3779B9;
  }

  /**
   * 返回 [0, 2^32) 的无符号整数。
   */
  nextUint (): number {
    let x = this.state;

    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x | 0;

    return this.state >>> 0;
  }

  /**
   * 返回 [0, 1) 的浮点数。
   */
  nextFloat (): number {
    return this.nextUint() / 0x100000000;
  }

  /**
   * 返回 [min, max) 的浮点数。
   */
  nextFloatRange (min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  /**
   * 返回 [min, max) 的整数。
   */
  nextIntRange (min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min));
  }
}
