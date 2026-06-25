function createArray (length: number, fillValue = 0): number[] {
  const arr = new Array<number>(length);

  arr.fill(fillValue);

  return arr;
}

/** 扩容 1 分量通道:分配 newCap 长度新数组,copy [0, usedCount) 活跃数据 */
function realloc (old: number[], usedCount: number, newCap: number): number[] {
  const arr = createArray(newCap);

  for (let i = 0; i < usedCount; i++) {
    arr[i] = old[i];
  }

  return arr;
}

/** 扩容 2 分量通道(stride 2) */
function realloc2 (old: number[], usedCount: number, newCap: number): number[] {
  const arr = createArray(newCap * 2);
  const bytes = usedCount * 2;

  for (let i = 0; i < bytes; i++) {
    arr[i] = old[i];
  }

  return arr;
}

/** 扩容 3 分量通道(stride 3) */
function realloc3 (old: number[], usedCount: number, newCap: number): number[] {
  const arr = createArray(newCap * 3);
  const bytes = usedCount * 3;

  for (let i = 0; i < bytes; i++) {
    arr[i] = old[i];
  }

  return arr;
}

/** 扩容 4 分量通道(stride 4) */
function realloc4 (old: number[], usedCount: number, newCap: number): number[] {
  const arr = createArray(newCap * 4);
  const bytes = usedCount * 4;

  for (let i = 0; i < bytes; i++) {
    arr[i] = old[i];
  }

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
  maxCount: number;

  // ── Spawn-time immutable（出生时写入，生命周期内不再修改） ──

  /** 粒子生命周期（秒），出生时由 InitializeModule 写入 */
  lifetime: number[];
  /** 随机种子 [0,1)，出生时写入，供模块采样使用 */
  seed: number[];
  /** 出生时速度快照 xyz，3 分量，不可变。speedOverLifetime 以此为基准 */
  initialVelocity: number[];
  /** 出生时尺寸快照 (width, height)，2 分量，不可变 */
  initialSize: number[];
  /** 出生时颜色快照 (r, g, b, a)，4 分量，不可变 */
  initialColor: number[];
  /** 出生时旋转快照（欧拉角 xyz 度），3 分量，不可变 */
  initialRotation: number[];
  /** 精灵动画参数 (animDelay, animDuration, cycles)，3 分量 */
  sprite: number[];
  /** 纹理坐标 (u, v, w, h)，4 分量 */
  uv: number[];

  // ── Per-frame mutable（每帧由模块计算并覆写） ──

  /** 粒子年龄（秒），每帧 += dt */
  age: number[];
  /** velocity 积分累加位置 xyz，3 分量。专为 OrbitalAndLinearMoveModule 提供旋转基准，无该模块时可移除 */
  simulatedPosition: number[];
  /** 最终显示位置 xyz，3 分量（simulatedPosition + orbital + linearMove + forceTarget 合成结果） */
  position: number[];
  /** 当前速度 xyz，3 分量。SolveVelocityModule 每帧累加 gravity */
  velocity: number[];
  /** 粒子尺寸 (width, height)，2 分量。ScaleSizeModule 每帧覆写为 initialSize × scale */
  size: number[];
  /** 粒子颜色 (r, g, b, a)，4 分量。ScaleColorModule 每帧覆写为 initialColor × scale */
  color: number[];
  /** Quad X 方向，3 分量 */
  dirX: number[];
  /** Quad Y 方向，3 分量 */
  dirY: number[];
  /** 当前旋转（欧拉角 xyz 度），3 分量。SolveRotationModule 每帧覆写为 initialRotation + ROL */
  rotation: number[];

  // ── Lifecycle（粒子生死管理） ──

  /**
   * 粒子存活标记，0 = 死亡，1 = 存活。
   *
   * 模块通过将 alive[i] = 0 标记死亡（自然死亡或主动击杀），框架在 compactDead()
   * 中用 swap-copy 将其移除，使 [0, numInstances) 始终紧凑。
   */
  alive: number[];

  // ── Trail/Ribbon（仅 trail emitter 使用） ──

  /** 全局唯一 ID，spawn 时递增写入，永不复用 */
  uniqueId: number[];
  /** 所属 ribbon 的 ID（= source 粒子的 uniqueId） */
  ribbonId: number[];
  /** 排序连线用的全局单调递增序号 */
  ribbonLinkOrder: number[];
  /** trail 粒子 spawn 时刻 source 粒子的 age，用于 ribbon renderer 反推 source normalized age */
  spawnSourceAge: number[];

  // ── 紧凑布局 ──

  private _numInstances = 0;

  /** compactDead swap-copy 用的多分量通道分组（构造时建立，避免每帧分配；grow 时重建引用） */
  private channels2: number[][];
  private channels3: number[][];
  private channels4: number[][];

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

    this.channels2 = [this.initialSize, this.size];
    this.channels3 = [
      this.initialVelocity, this.initialRotation, this.sprite,
      this.simulatedPosition, this.position, this.velocity,
      this.dirX, this.dirY, this.rotation,
    ];
    this.channels4 = [this.initialColor, this.uv, this.color];
  }

  /**
   * 当前活跃粒子数量。[0, numInstances) 区间内的 slot 均为存活粒子（紧凑布局）。
   */
  get numInstances (): number {
    return this._numInstances;
  }

  set numInstances (n: number) {
    this._numInstances = Math.min(Math.max(n, 0), this.maxCount);
  }

  /**
   * 扩容到 newCap。为每个通道分配更大数组并 copy 当前活跃段 [0, numInstances)，
   * 死亡槽不 copy。更新 maxCount 并重建 channels2/3/4 分组引用。
   * 不改变 _numInstances（活跃数不变，仅容量扩大）。
   */
  grow (newCap: number): void {
    if (newCap <= this.maxCount) {
      return;
    }
    const old = this.numInstances;

    this.lifetime = realloc(this.lifetime, old, newCap);
    this.seed = realloc(this.seed, old, newCap);
    this.age = realloc(this.age, old, newCap);
    this.alive = realloc(this.alive, old, newCap);
    this.uniqueId = realloc(this.uniqueId, old, newCap);
    this.ribbonId = realloc(this.ribbonId, old, newCap);
    this.ribbonLinkOrder = realloc(this.ribbonLinkOrder, old, newCap);
    this.spawnSourceAge = realloc(this.spawnSourceAge, old, newCap);

    this.initialVelocity = realloc3(this.initialVelocity, old, newCap);
    this.initialRotation = realloc3(this.initialRotation, old, newCap);
    this.sprite = realloc3(this.sprite, old, newCap);
    this.simulatedPosition = realloc3(this.simulatedPosition, old, newCap);
    this.position = realloc3(this.position, old, newCap);
    this.velocity = realloc3(this.velocity, old, newCap);
    this.dirX = realloc3(this.dirX, old, newCap);
    this.dirY = realloc3(this.dirY, old, newCap);
    this.rotation = realloc3(this.rotation, old, newCap);

    this.initialSize = realloc2(this.initialSize, old, newCap);
    this.size = realloc2(this.size, old, newCap);

    this.initialColor = realloc4(this.initialColor, old, newCap);
    this.uv = realloc4(this.uv, old, newCap);
    this.color = realloc4(this.color, old, newCap);

    this.maxCount = newCap;

    this.channels2 = [this.initialSize, this.size];
    this.channels3 = [
      this.initialVelocity, this.initialRotation, this.sprite,
      this.simulatedPosition, this.position, this.velocity,
      this.dirX, this.dirY, this.rotation,
    ];
    this.channels4 = [this.initialColor, this.uv, this.color];
  }

  clear (): void {
    this._numInstances = 0;
    this.position.fill(0);
    this.alive.fill(0);
  }

  /**
   * swap-copy 压缩：反向遍历 [0, numInstances)，将 alive[i] === 0 的死亡粒子
   * 用末尾存活粒子填空位后 numInstances--，使存活粒子紧凑排列在前段。
   *
   * 注意：swap-copy 会打乱存活粒子的相对顺序，依赖渲染层的 SortMode 在绘制前
   * 重新排序。SortMode 尚未实现（TODO），在此之前帧对比基准需相应更新。
   */
  compactDead (): void {
    for (let i = this._numInstances - 1; i >= 0; i--) {
      if (this.alive[i] !== 0) {
        continue;
      }
      this._numInstances--;
      if (i < this._numInstances) {
        this.copySlot(this._numInstances, i);
      }
    }
  }

  /** 将 src slot 的全部通道数据复制到 dst slot。 */
  private copySlot (src: number, dst: number): void {
    // 1-component channels
    this.lifetime[dst] = this.lifetime[src];
    this.seed[dst] = this.seed[src];
    this.age[dst] = this.age[src];
    this.alive[dst] = this.alive[src];
    this.uniqueId[dst] = this.uniqueId[src];
    this.ribbonId[dst] = this.ribbonId[src];
    this.ribbonLinkOrder[dst] = this.ribbonLinkOrder[src];
    this.spawnSourceAge[dst] = this.spawnSourceAge[src];

    // 3-component channels
    const s3 = src * 3, d3 = dst * 3;

    for (const arr of this.channels3) {
      arr[d3] = arr[s3];
      arr[d3 + 1] = arr[s3 + 1];
      arr[d3 + 2] = arr[s3 + 2];
    }

    // 2-component channels
    const s2 = src * 2, d2 = dst * 2;

    for (const arr of this.channels2) {
      arr[d2] = arr[s2];
      arr[d2 + 1] = arr[s2 + 1];
    }

    // 4-component channels
    const s4 = src * 4, d4 = dst * 4;

    for (const arr of this.channels4) {
      arr[d4] = arr[s4];
      arr[d4 + 1] = arr[s4 + 1];
      arr[d4 + 2] = arr[s4 + 2];
      arr[d4 + 3] = arr[s4 + 3];
    }
  }
}
