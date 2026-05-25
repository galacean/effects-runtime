import type { ProSystemInstance } from './system-instance';

/**
 * SystemInstance.tick 接收的输入。
 *
 * 当前只有 deltaTime，未来可能挂上视图矩阵、World Transform 等。
 */
export interface ProTickContext {
  deltaTime: number,
  systemInstance: ProSystemInstance,
}
