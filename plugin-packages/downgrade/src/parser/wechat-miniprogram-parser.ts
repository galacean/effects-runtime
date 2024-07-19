import { infoList, devtoolNameMap } from '../constants';
import type { DeviceInfo, WechatDeviceInfo } from '../types';
import { DeviceLevel } from '../types';

export class WechatMiniprogramParser {
  device: DeviceInfo = {};

  constructor (info: WechatDeviceInfo) {
    this.parse(info);
  }

  getDeviceInfo () {
    return this.device;
  }

  private parse (info: WechatDeviceInfo) {
    const osNameMatch = info.system.match(/\w+/);

    if (osNameMatch) {
      this.device.platform = osNameMatch[0].trim();
    }

    const osVersionMatch = info.system.match(/[\d.]+/);

    if (osVersionMatch) {
      this.device.osVersion = osVersionMatch[0].trim();
    }

    if (info.platform === 'devtools') {
      const phoneName = devtoolNameMap.wechat[info.model] ?? info.model;

      for (const data of infoList.iPhone) {
        if (data.name === phoneName) {
          info.model = data.model;

          break;
        }
      }
    }

    if (this.device.platform === 'iOS') {
      const modelMatch = info.model.match(/^(.*?)<(.*?)>$/);

      if (modelMatch) {
        this.device.model = modelMatch[2].trim();
        this.device.originalModel = info.model;
      } else {
        this.device.model = info.model;
      }
    } else {
      this.device.model = info.model;
    }

    if (info.benchmarkLevel <= 0) {
      this.device.level = DeviceLevel.Unknown;
    } else if (info.benchmarkLevel <= 10) {
      this.device.level = DeviceLevel.Low;
    } else if (info.benchmarkLevel <= 20) {
      this.device.level = DeviceLevel.Medium;
    } else {
      this.device.level = DeviceLevel.High;
    }

    this.device.memoryMB = info.memorySize;
    this.device.sourceData = info;
  }
}
