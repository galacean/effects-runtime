import type { AlipaySystemInfo, DeviceInfo } from '../types';
import { DeviceLevel } from '../types';

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

      for (const brand of brandList) {
        const modelLower = model.toLowerCase();
        const brandLower = brand.toLowerCase();

        if (modelLower.startsWith(brandLower)) {
          return model.substring(brand.length).trim();
        }
      }
    }

    return model;
  }

  private getDeviceLevel (level?: string): DeviceLevel {
    if (level === 'high') {
      return DeviceLevel.High;
    } else if (level === 'medium' || level === 'middle') {
      return DeviceLevel.Medium;
    } else if (level === 'low') {
      return DeviceLevel.Low;
    } else {
      return DeviceLevel.Unknown;
    }
  }
}
