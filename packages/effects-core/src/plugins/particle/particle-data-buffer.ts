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
 * - Accumulate 通道：每帧由模块计算更新（rotMatrix, finalOffset）
 */
export class ParticleDataBuffer {
  readonly maxCount: number;

  // --- Spawn-time state (written once at particle birth) ---

  /** 粒子年龄（秒），每帧 += dt。对齐 Pro 的 Particle.Age */
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
  /** 粒子尺寸 (width, height)，2 分量。ScaleSizeModule 每帧覆写为 initialSize * scale */
  readonly size: number[];
  /** 出生时尺寸快照 (width, height)，2 分量，不可变 */
  readonly initialSize: number[];
  /** 粒子颜色 (r, g, b, a)，4 分量。ScaleColorModule 每帧覆写为 initialColor * scale */
  readonly color: number[];
  /** 出生时颜色快照 (r, g, b, a)，4 分量，不可变 */
  readonly initialColor: number[];
  /** 纹理坐标 (u, v, w, h)，4 分量 */
  readonly uv: number[];

  // --- Per-frame accumulated state (updated each substep by modules) ---

  /** 旋转矩阵 3x3 列主序，9 分量 */
  readonly rotMatrix: number[];
  /** 显示位置 xyz（position + orbital + linearMove + forceTarget 合成结果），3 分量 */
  readonly finalOffset: number[];

  // --- 生命周期管理 ---

  /** 粒子存活标记，0=空闲 1=存活 */
  readonly alive: number[];

  // --- Trail/Ribbon 专用（仅 trail emitter 使用） ---

  /** 全局唯一 ID，spawn 时递增写入，永不复用 */
  readonly uniqueId: number[];
  /** 所属 ribbon 的 ID（= source 粒子的 uniqueId） */
  readonly ribbonId: number[];
  /** 排序连线用的全局单调递增序号 */
  readonly ribbonLinkOrder: number[];
  /** trail 粒子 spawn 时刻 source 粒子的 age（用于 ribbon renderer 反推 source normalized age） */
  readonly spawnSourceAge: number[];

  private _activeCount = 0;

  constructor (maxCount: number) {
    this.maxCount = maxCount;

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
    this.initialSize = createArray(maxCount * 2);

    this.color = createArray(maxCount * 4);
    this.initialColor = createArray(maxCount * 4);
    this.uv = createArray(maxCount * 4);

    this.rotMatrix = createArray(maxCount * 9);
    this.finalOffset = createArray(maxCount * 3);

    this.alive = createArray(maxCount);

    this.uniqueId = createArray(maxCount);
    this.ribbonId = createArray(maxCount);
    this.ribbonLinkOrder = createArray(maxCount);
    this.spawnSourceAge = createArray(maxCount);
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
    this.finalOffset.fill(0);
    this.alive.fill(0);
  }
}
