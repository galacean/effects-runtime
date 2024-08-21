import { infoList } from './constants';
import type { DeviceInfo, ProductInfo } from './types';
import { DeviceLevel } from './types';

/**
 * UserAgent 解析类
 *
 * 从 UserAgent 中解析出设备相关的信息，但是能获取的信息有限。
 */
export class UADecoder {
  device: DeviceInfo = {};

  constructor (userAgent?: string) {
    this.parse(userAgent ?? navigator.userAgent);
  }

  getDeviceInfo () {
    return this.device;
  }

  isIOS () {
    return this.device.platform === 'iOS';
  }

  isAndroid () {
    return this.device.platform === 'Android';
  }

  isHarmony () {
    return this.device.platform === 'Harmony';
  }

  isWindows () {
    return this.device.platform === 'Windows';
  }

  isMacintosh () {
    return this.device.platform === 'Macintosh';
  }

  isMobile () {
    return this.isIOS() || this.isAndroid() || this.isHarmony();
  }

  private parse (ua: string) {
    const pattern = /(\w+\/[\w.]+)(\s+\([^)]+\))?/g;
    const productInfos: ProductInfo[] = [];
    let match;

    while ((match = pattern.exec(ua)) !== null) {
      const name = match[1];
      const comment = match[2]?.trim();

      productInfos.push({ name, comment });
    }

    for (const productInfo of productInfos) {
      const { name, comment } = productInfo;

      if (name?.startsWith('Mozilla/')) {
        if (comment) {
          this.parseData(comment);
        }

        break;
      }
    }

    this.device.level = this.estimateDeviceLevel();
    this.device.sourceData = ua;
  }

  private parseData (data: string) {
    if (data.length && data[0] === '(') {
      data = data.substring(1);
    }

    if (data.length && data[data.length - 1] == ')') {
      data = data.substring(0, data.length - 1);
    }
    if (this.testIPhone(data)) {
      this.device.platform = 'iOS';
      this.device.osVersion = this.parseIOSVersion(data);
      this.device.model = this.getIPhoneModel();
    } else if (this.testIPad(data)) {
      this.device.platform = 'iOS';
      this.device.osVersion = this.parseIOSVersion(data);
      this.device.model = 'iPad';
    } else if (this.testMacintosh(data)) {
      this.device.platform = 'Mac OS';
      this.device.osVersion = this.parseMacOSVersion(data);
    } else if (this.testAndroid(data)) {
      this.device.platform = 'Android';
      this.device.osVersion = this.parseAndroidVersion(data);
      this.device.model = this.parseAndroidModel(data);
    } else if (this.testWindows(data)) {
      this.device.platform = 'Windows';
      this.device.osVersion = this.parseWindowsVersion(data);
    } else {
      console.error(`Unknown info: ${data}.`);
    }
  }

  private estimateDeviceLevel () {
    if (this.isIOS()) {
      if (this.device.osVersion) {
        const osVersion = parseInt(this.device.osVersion.split('.')[0]);

        if (osVersion < 12) {
          return DeviceLevel.Low;
        } else if (osVersion < 16) {
          return DeviceLevel.Medium;
        } else {
          return DeviceLevel.High;
        }
      } else {
        return DeviceLevel.Low;
      }
    }
    if (this.isAndroid()) {
      if (this.device.osVersion) {
        const osVersion = parseInt(this.device.osVersion.split('.')[0]);

        if (osVersion < 10) {
          return DeviceLevel.Low;
        } else if (osVersion < 12) {
          return DeviceLevel.Medium;
        } else {
          return DeviceLevel.High;
        }
      } else {
        return DeviceLevel.Low;
      }
    }

    return DeviceLevel.High;
  }

  private parseIOSVersion (data: string) {
    const pattern = /OS (\d+)(?:_(\d+))?_(\d+)/;
    const match = data.match(pattern);

    if (match) {
      const versionList: string[] = [];

      for (let i = 1; i <= 3; i++) {
        if (match[i]) {
          versionList.push(match[i]);
        }
      }

      return versionList.join('.');
    }
  }

  private getIPhoneModel () {
    const screenWidth = window.screen.width * window.devicePixelRatio;
    const screenHeight = window.screen.height * window.devicePixelRatio;
    const match = infoList.iPhone.find(m => m.width === screenWidth && m.height === screenHeight);

    return match?.model ?? 'iPhone';
  }

  private parseAndroidVersion (data: string) {
    const pattern = /Android ([\d.]+);/;
    const match = data.match(pattern);

    if (match && match.length >= 2) {
      return match[1];
    }
  }

  private parseAndroidModel (data: string) {
    const itemList = data.split(';');
    let lastItem;

    for (const item of itemList) {
      const modelPattern = /(.+?) Build/;
      const modelMatch = item.match(modelPattern);

      if (modelMatch && modelMatch.length >= 2) {
        return modelMatch[1].trim();
      }

      if (item.includes('HMSCore') && lastItem) {
        return lastItem.trim();
      }

      lastItem = item;
    }

    if (itemList.length > 0) {
      const lastItem = itemList[itemList.length - 1].trim();

      for (const vender of infoList.vender) {
        if (lastItem.startsWith(vender)) {
          return lastItem.substring(vender.length).trim();
        }
      }
    }

    if (itemList.length == 3) {
      return itemList[itemList.length - 1].trim();
    } else if (itemList.length === 4) {
      const len = itemList.length;

      if (itemList[len - 1].trim() === 'wv') {
        return itemList[len - 2].trim();
      }
    }
  }

  private parseWindowsVersion (data: string) {
    const pattern = /Windows NT ([\d.]+);/;
    const match = data.match(pattern);

    if (match && match.length >= 2) {
      return match[1];
    }
  }

  private parseMacOSVersion (data: string) {
    const pattern = /OS X (\d+)(?:_(\d+))?_(\d+)/;
    const match = data.match(pattern);

    if (match) {
      const versionList: string[] = [];

      for (let i = 1; i <= 3; i++) {
        if (match[i]) {
          versionList.push(match[i]);
        }
      }

      return versionList.join('.');
    }
  }

  private testIPhone (data: string) {
    return data.includes('iPhone');
  }

  private testIPad (data: string) {
    return data.includes('iPad');
  }

  private testAndroid (data: string) {
    return data.includes('Android');
  }

  private testMacintosh (data: string) {
    return data.includes('Macintosh');
  }

  private testWindows (data: string) {
    return data.includes('Windows');
  }
}
