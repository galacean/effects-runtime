function createArray (length: number, fillValue = 0): number[] {
  const arr = new Array<number>(length);

  arr.fill(fillValue);

  return arr;
}

/**
 * 粒子系统 SoA 数据缓冲区。
 *
 * 每个属性是独立的 number[]，按粒子索引访问。统一使用 JS 原生 number（Float64）精度，
 * 避免 Float32/Float64 混用导致的精度问题。
 *
 * 通道分两类：
 * - Spawn 通道：粒子出生时一次性写入（position, velocity, color 等）
 * - Accumulate 通道：每帧由模块累加更新（translation, rotMatrix, linearMove）
 */
export class ParticleDataBuffer {
  readonly maxCount: number;

  // --- Spawn-time state (written once at particle birth) ---

  /** 粒子出生时的 emitter 时间戳 */
  readonly delay: number[];
  /** 粒子年龄（秒），= currentTime - delay。对齐 Pro 的 Particle.Age */
  readonly age: number[];
  /** 粒子生命周期（秒） */
  readonly lifetime: number[];
  /** 随机种子 [0,1)，出生时写入 */
  readonly seed: number[];
  /** 当前位置 xyz，模块可直接修改（对齐 Pro 的 Particle.Position） */
  readonly position: number[];
  /** 初始速度 xyz，3 分量 */
  readonly velocity: number[];
  /** 初始旋转（欧拉角 xyz 弧度），3 分量 */
  readonly rotation: number[];
  /** Quad X 方向，3 分量 */
  readonly dirX: number[];
  /** Quad Y 方向，3 分量 */
  readonly dirY: number[];
  /** 精灵动画参数 (animDelay, animDuration, cycles)，3 分量 */
  readonly sprite: number[];
  /** 粒子尺寸 (width, height)，2 分量 */
  readonly size: number[];
  /** 粒子颜色 (r, g, b, a)，4 分量 */
  readonly color: number[];
  /** 纹理坐标 (u, v, w, h)，4 分量 */
  readonly uv: number[];

  // --- Per-frame accumulated state (updated each substep by modules) ---

  /** 旋转矩阵 3x3 列主序，9 分量 */
  readonly rotMatrix: number[];
  /** 线性位移累计值 xyz，3 分量 */
  readonly linearMove: number[];
  /** 显示位置 xyz（position + orbital + linearMove + forceTarget 合成结果），3 分量 */
  readonly finalOffset: number[];
  /** size over lifetime 缩放因子 (scaleX, scaleY)，2 分量 */
  readonly sizeScale: number[];
  /** color/opacity over lifetime 缩放因子 (r, g, b, a)，4 分量 */
  readonly colorScale: number[];

  // --- 生命周期管理 ---

  /** 粒子存活标记，0=空闲 1=存活 */
  readonly alive: number[];

  private _activeCount = 0;

  constructor (maxCount: number) {
    this.maxCount = maxCount;

    this.delay = createArray(maxCount);
    this.age = createArray(maxCount);
    this.lifetime = createArray(maxCount);
    this.seed = createArray(maxCount);

    this.position = createArray(maxCount * 3);
    this.velocity = createArray(maxCount * 3);
    this.rotation = createArray(maxCount * 3);
    this.dirX = createArray(maxCount * 3);
    this.dirY = createArray(maxCount * 3);
    this.sprite = createArray(maxCount * 3);

    this.size = createArray(maxCount * 2);

    this.color = createArray(maxCount * 4);
    this.uv = createArray(maxCount * 4);

    this.rotMatrix = createArray(maxCount * 9);
    this.linearMove = createArray(maxCount * 3);
    this.finalOffset = createArray(maxCount * 3);
    this.sizeScale = createArray(maxCount * 2, 1);
    this.colorScale = createArray(maxCount * 4, 1);

    this.alive = createArray(maxCount);
  }

  get activeCount (): number {
    return this._activeCount;
  }

  set activeCount (n: number) {
    this._activeCount = Math.min(n, this.maxCount);
  }

  clear (): void {
    this._activeCount = 0;
    this.rotMatrix.fill(0);
    this.linearMove.fill(0);
    this.finalOffset.fill(0);
    this.sizeScale.fill(1);
    this.colorScale.fill(1);
    this.alive.fill(0);
  }
}
