import type { AlipaySystemInfo, DeviceInfo } from '../types';
import { DeviceLevel } from '../types';

/**
 * 支付宝小程序系统信息解析类
 *
 * 负责解析支付宝小程序 JSAPI 返回的系统信息
 */
export class AlipayMiniprogramParser {
  device: DeviceInfo = {};

  constructor (info: AlipaySystemInfo) {
    this.parse(info);
  }

  getDeviceInfo () {
    return this.device;
  }

  private parse (info: AlipaySystemInfo) {
    this.device.platform = info.platform;
    this.device.osVersion = info.system;
    this.device.originalModel = info.model;
    this.device.model = this.getDeviceModel(info.model);
    this.device.level = this.getDeviceLevel(info.performance);
    this.device.sourceData = info;
  }

  private getDeviceModel (model?: string) {
    if (model) {
      const brandList = ['Huawei', 'Xiaomi', 'samsung', 'vivo', 'OPPO'];
      const brand = brandList.find(b => (model ?? '').toLowerCase().startsWith(b.toLowerCase()));

      if (brand) {
        return model?.substring(brand.length).trim();
      }
    }

    return model;
  }

  private getDeviceLevel (level = ''): DeviceLevel {
    const levelMap: Record<string, DeviceLevel> = {
      'high': DeviceLevel.High,
      'medium': DeviceLevel.Medium,
      'middle': DeviceLevel.Medium,
      'low': DeviceLevel.Low,
    };

    return levelMap[level] || DeviceLevel.Unknown;
  }
}
