function createArray (length: number, fillValue = 0): number[] {
  const arr = new Array<number>(length);

  arr.fill(fillValue);

  return arr;
}

/**
 * 粒子系统 SoA（Structure of Arrays）数据缓冲区。
 *
 * 每个属性是独立的 number[]，按粒子 slot 索引访问。
 * 统一使用 JS 原生 number（Float64）精度，避免 Float32/Float64 混用导致的精度问题。
 *
 * 通道分四类：
 * - **Spawn-time immutable**：出生时写入，生命周期内不再修改
 * - **Per-frame mutable**：每帧由模块计算并覆写
 * - **Lifecycle**：粒子生死管理
 * - **Trail/Ribbon**：仅 trail emitter 使用的连线数据
 */
export class ParticleDataBuffer {
  readonly maxCount: number;

  // ── Spawn-time immutable（出生时写入，生命周期内不再修改） ──

  /** 粒子生命周期（秒），出生时由 InitializeModule 写入 */
  readonly lifetime: number[];
  /** 随机种子 [0,1)，出生时写入，供模块采样使用 */
  readonly seed: number[];
  /** 出生时速度快照 xyz，3 分量，不可变。speedOverLifetime 以此为基准 */
  readonly initialVelocity: number[];
  /** 出生时尺寸快照 (width, height)，2 分量，不可变 */
  readonly initialSize: number[];
  /** 出生时颜色快照 (r, g, b, a)，4 分量，不可变 */
  readonly initialColor: number[];
  /** 出生时旋转快照（欧拉角 xyz 度），3 分量，不可变 */
  readonly initialRotation: number[];
  /** 精灵动画参数 (animDelay, animDuration, cycles)，3 分量 */
  readonly sprite: number[];
  /** 纹理坐标 (u, v, w, h)，4 分量 */
  readonly uv: number[];

  // ── Per-frame mutable（每帧由模块计算并覆写） ──

  /** 粒子年龄（秒），每帧 += dt */
  readonly age: number[];
  /** velocity 积分累加位置 xyz，3 分量。专为 OrbitalAndLinearMoveModule 提供旋转基准，无该模块时可移除 */
  readonly simulatedPosition: number[];
  /** 最终显示位置 xyz，3 分量（simulatedPosition + orbital + linearMove + forceTarget 合成结果） */
  readonly position: number[];
  /** 当前速度 xyz，3 分量。SolveVelocityModule 每帧累加 gravity */
  readonly velocity: number[];
  /** 粒子尺寸 (width, height)，2 分量。ScaleSizeModule 每帧覆写为 initialSize × scale */
  readonly size: number[];
  /** 粒子颜色 (r, g, b, a)，4 分量。ScaleColorModule 每帧覆写为 initialColor × scale */
  readonly color: number[];
  /** Quad X 方向，3 分量 */
  readonly dirX: number[];
  /** Quad Y 方向，3 分量 */
  readonly dirY: number[];
  /** 当前旋转（欧拉角 xyz 度），3 分量。SolveRotationModule 每帧覆写为 initialRotation + ROL */
  readonly rotation: number[];

  // ── Lifecycle（粒子生死管理） ──

  /** 粒子存活标记，0 = 空闲，1 = 存活 */
  readonly alive: number[];

  // ── Trail/Ribbon（仅 trail emitter 使用） ──

  /** 全局唯一 ID，spawn 时递增写入，永不复用 */
  readonly uniqueId: number[];
  /** 所属 ribbon 的 ID（= source 粒子的 uniqueId） */
  readonly ribbonId: number[];
  /** 排序连线用的全局单调递增序号 */
  readonly ribbonLinkOrder: number[];
  /** trail 粒子 spawn 时刻 source 粒子的 age，用于 ribbon renderer 反推 source normalized age */
  readonly spawnSourceAge: number[];

  // ── Recycling infrastructure ──

  /** 下一个顺序分配的 slot 索引 */
  nextSlotIndex = 0;
  /** Free-list 栈：pop 获取可用 slot，push 回收死亡 slot */
  readonly freeSlots: number[] = [];
  /** 每帧重建的紧凑活跃粒子索引列表，供 renderer 使用 */
  liveIndices: number[] = [];

  get liveCount (): number { return this.liveIndices.length; }

  private _activeCount = 0;

  constructor (maxCount: number) {
    this.maxCount = maxCount;

    // Spawn-time immutable (1 component)
    this.lifetime = createArray(maxCount);
    this.seed = createArray(maxCount);
    // Spawn-time immutable (multi-component)
    this.initialVelocity = createArray(maxCount * 3);
    this.initialRotation = createArray(maxCount * 3);
    this.sprite = createArray(maxCount * 3);
    this.initialSize = createArray(maxCount * 2);
    this.initialColor = createArray(maxCount * 4);
    this.uv = createArray(maxCount * 4);

    // Per-frame mutable (1 component)
    this.age = createArray(maxCount);
    // Per-frame mutable (multi-component)
    this.simulatedPosition = createArray(maxCount * 3);
    this.position = createArray(maxCount * 3);
    this.velocity = createArray(maxCount * 3);
    this.dirX = createArray(maxCount * 3);
    this.dirY = createArray(maxCount * 3);
    this.rotation = createArray(maxCount * 3);
    this.size = createArray(maxCount * 2);
    this.color = createArray(maxCount * 4);

    // Lifecycle
    this.alive = createArray(maxCount);

    // Trail/Ribbon
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
    this.nextSlotIndex = 0;
    this.position.fill(0);
    this.alive.fill(0);
    this.freeSlots.length = 0;
    this.liveIndices.length = 0;
  }
}
