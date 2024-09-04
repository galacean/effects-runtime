import type { SceneRenderLevel } from '@galacean/effects';

/**
 * 降级接口入参
 */
export interface DowngradeOptions {
  /**
   * 去除 window 上默认添加的 gl lost 事件
   */
  disableGLLostEvent?: boolean,
  /**
   * 发生 gl lost 时，是否忽略
   * @default false - 不忽略，将不再允许任何播放器创建，会全部走降级逻辑
   */
  ignoreGLLost?: boolean,
  /**
   * 指定渲染等级，如果没有设置，会根据设备信息自动计算
   */
  level?: SceneRenderLevel,
  /**
   * 技术点列表
   */
  techPoint?: string[],
  /**
   * Alipay JSAPI getSystemInfo 返回的结果，可以在外部调用后传进来
   */
  systemInfo?: SystemInfo,
  /**
   * Alipay JSAPI getDowngradeResult 返回的结果，可以在外部调用后传进来
   */
  downgradeResult?: any,
  /**
   * 禁用压后台的时候自动暂停播放器
   * @default false - 不自动暂停
   */
  autoPause?: boolean,
  /**
   * 降级 API
   * @param bizId - 业务 Id
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

/**
 * 降级结果
 */
export interface DowngradeResult {
  /**
   * 业务 bizId
   */
  bizId: string,
  /**
   * 是否降级
   */
  downgrade: boolean,
  /**
   * 渲染等级
   */
  level: SceneRenderLevel,
  /**
   * 降级原因
   */
  reason: string,
  /**
   * JSAPI 返回的系统信息
   */
  systemInfo?: SystemInfo,
  /**
   * JSAPI 调用时间
   */
  systemTime?: number,
  /**
   * JSAPI 返回的降级结果
   */
  downgradeResult?: any,
  /**
   * JSAPI 调用时间
   */
  downgradeTime?: number,
}

/**
 * JSAPI 返回的系统信息
 */
export interface SystemInfo {
  /**
   * 性能信息
   */
  performance: string,
  /**
   * 平台信息
   */
  platform: string,
  /**
   * 硬件机型
   */
  model: string,
  /**
   * 系统信息
   */
  system: string,
  /**
   * 品牌信息
   */
  brand: string,
  /**
   * 版本信息
   */
  version?: string,
  /**
   * 错误消息
   */
  error?: Error,
}

/**
 * 设备等级，分为高、中、低和未知。
 */
export enum DeviceLevel {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Unknown = 'unknown',
}

/**
 * 降级决定
 */
export interface DowngradeDecision {
  /**
   * 是否降级
   */
  downgrade: boolean,
  /**
   * 渲染等级
   */
  level: SceneRenderLevel,
  /**
   * 降级原因
   */
  reason: string,
}
