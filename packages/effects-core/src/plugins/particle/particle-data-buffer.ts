/**
 * 粒子系统 SoA 数据缓冲区。
 *
 * 每个属性是独立的 Float32Array，按粒子索引访问。
 * 参考 particle-system-pro 的 ProDataBuffer 设计，但简化为
 * 固定容量 + 命名通道，适配标准粒子系统的渐进式迁移。
 *
 * 通道分两类：
 * - Spawn 通道：粒子出生时一次性写入（position, velocity, color 等）
 * - Accumulate 通道：每帧由模块累加更新（translation, rotMatrix, linearMove）
 */
export class ParticleDataBuffer {
  readonly maxCount: number;

  // --- Spawn-time state (written once at particle birth) ---

  /** 粒子出生延迟（秒） */
  readonly delay: Float32Array;
  /** 粒子生命周期（秒） */
  readonly lifetime: Float32Array;
  /** 随机种子 [0,1)，出生时写入 */
  readonly seed: Float32Array;
  /** 出生位置 xyz，3 分量 (index * 3 + component) */
  readonly position: Float32Array;
  /** 初始速度 xyz，3 分量 */
  readonly velocity: Float32Array;
  /** 初始旋转（欧拉角 xyz 弧度），3 分量 */
  readonly rotation: Float32Array;
  /** Quad X 方向，3 分量 */
  readonly dirX: Float32Array;
  /** Quad Y 方向，3 分量 */
  readonly dirY: Float32Array;
  /** 精灵动画参数 (animDelay, animDuration, cycles)，3 分量 */
  readonly sprite: Float32Array;
  /** 粒子尺寸 (width, height)，2 分量 */
  readonly size: Float32Array;
  /** 粒子颜色 (r, g, b, a)，4 分量 */
  readonly color: Float32Array;
  /** 纹理坐标 (u, v, w, h)，4 分量 */
  readonly uv: Float32Array;

  // --- Per-frame accumulated state (updated each substep by modules) ---

  /** 位移积分累计值 xyz，3 分量 */
  readonly translation: Float32Array;
  /** 旋转矩阵 3x3 列主序，9 分量 */
  readonly rotMatrix: Float32Array;
  /** 线性位移累计值 xyz，3 分量 */
  readonly linearMove: Float32Array;
  /** 最终位置偏移 xyz（translation + orbital + linearMove + forceTarget 合成结果），3 分量 */
  readonly finalOffset: Float32Array;
  /** size over lifetime 缩放因子 (scaleX, scaleY)，2 分量 */
  readonly sizeScale: Float32Array;
  /** color/opacity over lifetime 缩放因子 (r, g, b, a)，4 分量 */
  readonly colorScale: Float32Array;

  // --- Float64 通道（trail/raycast 位置计算需要 float64 精度） ---

  readonly delayF64: Float64Array;
  readonly lifetimeF64: Float64Array;
  readonly positionF64: Float64Array;
  readonly velocityF64: Float64Array;
  readonly sizeF64: Float64Array;

  // --- 生命周期管理 ---

  /** 粒子存活标记，0=空闲 1=存活 */
  readonly alive: Uint8Array;
  /** 粒子过期时间 (delay + lifetime)，用于回收最老粒子。Float64 与老代码 Link 精度一致 */
  readonly expiry: Float64Array;

  private _activeCount = 0;

  constructor (maxCount: number) {
    this.maxCount = maxCount;

    this.delay = new Float32Array(maxCount);
    this.lifetime = new Float32Array(maxCount);
    this.seed = new Float32Array(maxCount);

    this.position = new Float32Array(maxCount * 3);
    this.velocity = new Float32Array(maxCount * 3);
    this.rotation = new Float32Array(maxCount * 3);
    this.dirX = new Float32Array(maxCount * 3);
    this.dirY = new Float32Array(maxCount * 3);
    this.sprite = new Float32Array(maxCount * 3);

    this.size = new Float32Array(maxCount * 2);

    this.color = new Float32Array(maxCount * 4);
    this.uv = new Float32Array(maxCount * 4);

    this.translation = new Float32Array(maxCount * 3);
    this.rotMatrix = new Float32Array(maxCount * 9);
    this.linearMove = new Float32Array(maxCount * 3);
    this.finalOffset = new Float32Array(maxCount * 3);
    this.sizeScale = new Float32Array(maxCount * 2);
    this.colorScale = new Float32Array(maxCount * 4);
    this.delayF64 = new Float64Array(maxCount);
    this.lifetimeF64 = new Float64Array(maxCount);
    this.positionF64 = new Float64Array(maxCount * 3);
    this.velocityF64 = new Float64Array(maxCount * 3);
    this.sizeF64 = new Float64Array(maxCount * 2);

    this.alive = new Uint8Array(maxCount);
    this.expiry = new Float64Array(maxCount);
  }

  get activeCount (): number {
    return this._activeCount;
  }

  set activeCount (n: number) {
    this._activeCount = Math.min(n, this.maxCount);
  }

  clear (): void {
    this._activeCount = 0;
    this.translation.fill(0);
    this.rotMatrix.fill(0);
    this.linearMove.fill(0);
    this.finalOffset.fill(0);
    this.sizeScale.fill(1);
    this.colorScale.fill(1);
    this.alive.fill(0);
  }
}
