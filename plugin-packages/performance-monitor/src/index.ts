import './core/monitor-core';
import { wrapCanvasContext } from './core/monitor-core';
import * as EFFECTS from '@galacean/effects';
export { startMonitoring, startMonitoringWithUI, stopMonitoring } from './core/tracker';

// 初始化：包装 Canvas 的 getContext 方法
if (typeof HTMLCanvasElement !== 'undefined') {
  wrapCanvasContext(HTMLCanvasElement);
}

// if (typeof OffscreenCanvas !== 'undefined') {
//   wrapCanvasContext(OffscreenCanvas);
// }

/**
 * 插件版本号
 */
export const version = __VERSION__;

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一性能检测器插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the Performance Monitor plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}