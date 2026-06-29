/**
 * 粒子池分配模式。对齐成熟实现的分配模式枚举语义。
 *
 * - FixedCount：以 PreAllocationCount 为硬上限,池满丢新(不扩容)。
 * - AutomaticEstimate：初始以 PreAllocationCount 预分配,运行期按需扩容,
 *   软上限(PreAllocationCount × 16)防 OOM,超软上限才丢新。
 * - ManualEstimate：TODO 预留。语义为「用户提供固定预估容量作 estimate 锚」,
 *   与 AutomaticEstimate 区别在 estimate 来源(当前未实现历史采样,行为暂同 Auto)。
 *
 * 扩容/丢弃决策逻辑内联在 ParticleEmitter.preAllocateSlots(散在 tick 的风格),
 * 不再独立成 Policy 类。
 */
export enum AllocationMode {
  FixedCount = 'fixedCount',
  ManualEstimate = 'manualEstimate',
  AutomaticEstimate = 'automaticEstimate',
}
