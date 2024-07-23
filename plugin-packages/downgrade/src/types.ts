import type { SceneRenderLevel } from '@galacean/effects';

export interface DowngradeOptions {
  /**
   * 指定设备渲染等级
   */
  level?: SceneRenderLevel,
  /**
   * 禁用压后台的时候自动暂停播放器
   * @default false - 不自动暂停
   */
  autoPause?: boolean,
  /**
   * 在小程序环境下，是否自动通过原生API查询设备信息
   * @default false - 不自动查询
   */
  queryDeviceInMiniApp?: boolean,
  /**
   * 设备信息，可以外部传入
   */
  deviceInfo?: DeviceInfo,
  /**
   * 是否 mock 降级
   * - true：mock 降级
   * - false: mock 不降级
   * - undefined: 不进行 mock, 用设备信息判断降级
   */
  mockDowngrade?: boolean,
  /**
   * 自定义降级回调，可针对特定机型配置特定的降级规则
   */
  downgradeCallback?: DowngradeCallback,
}

export interface DowngradeResult {
  downgrade: boolean,
  level: SceneRenderLevel,
  reason: string,
  deviceInfo?: DeviceInfo,
}

export interface DeviceInfo {
  platform?: string,
  osVersion?: string,
  model?: string,
  originalModel?: string,
  level?: DeviceLevel,
  memoryMB?: number,
  sourceData?: any,
}

export type DowngradeCallback = (device: DeviceInfo) => DowngradeResult | undefined;

export interface WechatDeviceInfo {
  /**
   * 设备性能等级（仅 Android 支持）。
   * 取值为：
   *  -2 或 0（该设备无法运行小游戏）
   *  -1（性能未知）
   *  >=1（设备性能值，该值越高，设备性能越好，目前最高不到50）
   */
  benchmarkLevel: number,
  /**
   * 设备品牌
   */
  brand: string,
  /**
   * 设备型号。新机型刚推出一段时间会显示unknown，微信会尽快进行适配。
   */
  model: string,
  /**
   * 操作系统及版本
   */
  system: string,
  /**
   * 客户端平台
   */
  platform: string,
  /**
   * 设备 CPU 型号（仅 Android 支持）
   */
  cpuType?: string,
  /**
   * 设备内存大小，单位为 MB
   */
  memorySize: number,
}

export interface AlipaySystemInfo {
  /**
   * high: 高性能。Android 设备运行内存大于等于 4GB
   * middle: 性能中等。Android 设备运行内存大于等于 3GB 且 CPU 核心数大于 4
   * low: 性能较弱
   * unknown: 无法识别
   */
  performance?: string,
  /**
   * 手机品牌
   */
  brand?: string,
  /**
   * 手机型号。具体可参考 https://opendocs.alipay.com/mini/072v9s
   */
  model?: string,
  /**
   * 系统版本
   */
  system?: string,
  /**
   * 客户端平台：Android，iOS / iPhone OS，Harmony
   */
  platform?: string,
}

export interface ProductInfo {
  name: string,
  comment?: string,
}

export interface IPhoneInfo {
  name: string,
  model: string,
  width: number,
  height: number,
}

export enum DeviceLevel {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Unknown = 'unknown',
}
