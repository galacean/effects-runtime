/**
 * 粒子池分配策略。
 *
 * - FixedCount：以 PreAllocationCount 为硬上限，池满时丢弃新点（不扩容）。
 * - AutomaticEstimate：初始以 PreAllocationCount 预分配，运行期按需扩容，
 *   全局软上限（preAllocationCount × softCapMultiplier）防 OOM，超软上限才丢新点。
 * - ManualEstimate：TODO 预留。语义为「用户提供一个固定预估容量作为 estimate 锚」，
 *   与 AutomaticEstimate 的「运行时按需估算」相区别。本任务未实现 estimate 锚与
 *   历史采样，行为暂与 AutomaticEstimate 不可区分，故当前不启用。
 */
export enum AllocationMode {
  FixedCount = 'fixedCount',
  ManualEstimate = 'manualEstimate',
  AutomaticEstimate = 'automaticEstimate',
}

/** 初次预分配容量，亦是 FixedCount 的硬上限 / AutomaticEstimate 的 grow 起点。 */
export type AllocationConfig = {
  mode: AllocationMode,
  preAllocationCount: number,
  /** 软上限倍率（仅 Manual/Auto 生效），相对 preAllocationCount。默认 16。 */
  softCapMultiplier?: number,
  /** grow 倍率（仅 Manual/Auto 生效）。默认 1.5。 */
  growMultiplier?: number,
};

/** 扩容/丢弃决策结果。
 * - newCap 非 undefined 时：调用方应先 grow buffer 到 newCap，再分配 requestedCount。
 * - dropCount > 0 时：本次只能分配 requestedCount - dropCount 个。 */
export type AllocationDecision = {
  newCap?: number,
  dropCount: number,
};

export class AllocationPolicy {
  readonly mode: AllocationMode;
  readonly preAllocationCount: number;
  readonly softCap: number;
  private readonly growMultiplier: number;

  constructor (config: AllocationConfig) {
    this.mode = config.mode;
    this.preAllocationCount = Math.max(config.preAllocationCount, 0);
    this.softCap = this.preAllocationCount * (config.softCapMultiplier ?? 16);
    this.growMultiplier = config.growMultiplier ?? 1.5;
  }

  /**
   * 给定当前容量 currentCap 与本次请求分配数 requestedCount（含已活跃数 + 本次新增）,
   * 返回扩容/丢弃决策。
   *
   * - requestedCount <= currentCap：无需处理，直接分配。
   * - FixedCount：超 preAllocationCount 部分丢弃。
   * - Manual/Auto：扩容到 max(requestedCount, currentCap × growMultiplier),
   *   clamp 到软上限；超软上限部分丢弃。
   */
  resolve (currentCap: number, requestedCount: number): AllocationDecision {
    if (requestedCount <= currentCap) {
      return { dropCount: 0 };
    }

    if (this.mode === AllocationMode.FixedCount) {
      const dropCount = Math.max(0, requestedCount - this.preAllocationCount);

      return { dropCount };
    }

    // ManualEstimate / AutomaticEstimate：优先扩容。
    // TODO(ManualEstimate)：接入 estimate 锚 + 历史采样以区分于 Auto。
    const grown = Math.max(requestedCount, Math.ceil(currentCap * this.growMultiplier));

    if (grown <= this.softCap) {
      return { newCap: grown, dropCount: 0 };
    }
    // 扩容后仍超软上限：cap 到软上限，多余丢弃。
    const dropCount = Math.max(0, requestedCount - this.softCap);

    return { newCap: this.softCap, dropCount };
  }
}
