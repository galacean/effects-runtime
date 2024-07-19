import type { SceneRenderLevel } from '@galacean/effects';

export interface DowngradeOptions {
  level?: SceneRenderLevel,
  /**
   * 技术点列表
   */
  techPoint?: string[],
  /**
   * Alipay JSAPI getSystemInfo 返回的结果
   */
  systemInfo?: SystemInfo,
  /**
   * Alipay JSAPI getDowngradeResult 返回的结果
   */
  downgradeResult?: any,
  /**
   * 禁用压后台的时候自动暂停播放器
   * @default false - 不自动暂停
   */
  autoPause?: boolean,
  /**
   * 降级 API
   * @param bizId - 业务Id
   * @param option - 参数
   * @param callback - 回调函数
   * @returns 降级结果
   */
  callBridge?: (
    bizId: string,
    option: Record<string, any>,
    callback: (res: Record<string, any>) => void,
  ) => void,
}

export interface DowngradeResult {
  bizId: string,
  downgrade: boolean,
  level: SceneRenderLevel,
  reason: string,
  //
  systemInfo?: SystemInfo,
  systemTime?: number,
  downgradeResult?: any,
  downgradeTime?: number,
}

export interface SystemInfo {
  performance: string,
  platform: string,
  model: string,
  system: string,
  brand: string,
  version: string,
  error: Error,
}

export enum DeviceLevel {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Unknown = 'unknown',
}

export interface DowngradeDecision {
  downgrade: boolean,
  level: SceneRenderLevel,
  reason: string,
}
