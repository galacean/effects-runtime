/**
 * 帧对比测试要求新旧两版渲染器消费完全一致的随机数。
 * 重构后新版粒子系统的 Math.random 调用顺序与次数与旧版（CDN）不同，
 * 任何"有序"的随机序列都会因调用顺序差异而发散，导致新旧画面不一致。
 *
 * 唯一与调用顺序/次数无关的方案：让 Math.random 始终返回同一常量。
 * 代价：同一发射器内所有粒子取到相同随机值，空间分布退化为重叠；
 * 但新旧两版表现完全一致，可用于回归比对（仍覆盖发射时序、颜色/尺寸曲线、
 * 变换、混合模式、贴图序列帧等绝大部分逻辑）。
 */
const FIXED_RANDOM = 0.5;

export function installFixedRandom (value: number = FIXED_RANDOM): void {
  Math.random = () => value;
}
