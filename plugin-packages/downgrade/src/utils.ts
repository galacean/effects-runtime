import { spec, disableAllPlayer, getActivePlayers, isCanvasUsedByPlayer, logger } from '@galacean/effects';
import { DowngradePlugin } from './downgrade-plugin';

export interface DowngradeOptions {
  /**
   * 发生 gl lost 时，是否忽略
   * @default false - 不忽略，将不再允许任何播放器创建，会全部走降级逻辑
   */
  ignoreGLLost?: boolean,
  /**
   * 禁用压后台的时候自动暂停播放器
   * @default false - 不自动暂停
   */
  autoPause?: boolean,
  autoQueryDevice?: boolean,
  /**
   * mock相关信息
   */
  mock?: {
    downgrade: boolean,
    deviceLevel?: string,
  },
  downgradeCallback?: DowngradeCallback,
}

export interface DowngradeResult {
  device?: {
    downgrade?: boolean,
    osName?: string,
    osVersion?: string,
    model?: string,
    level?: string,
    memoryMB?: number,
  },
  mock?: {
    downgrade: boolean,
    deviceLevel?: string,
  },
  downgradeCallback?: DowngradeCallback,
}

export interface DeviceInfo {
  osName?: string,
  osVersion?: string,
  model?: string,
  level?: string,
  memoryMB?: number,
  isIOS: boolean,
}

export interface DowngradeDecision {
  downgrade: boolean,
  reason: string,
}

export type DowngradeCallback = (device: DeviceInfo) => DowngradeDecision | undefined;

interface ProductInfo {
  name: string,
  comment?: string,
}

export class UADecoder {
  osName?: string;
  osVersion?: string;
  deviceModel?: string;

  constructor () {
    this.initial(navigator.userAgent);
  }

  getDowngradeResult (): DowngradeResult {
    return {
      device: {
        osName: this.osName,
        osVersion: this.osVersion,
        model: this.deviceModel,
      },
    };
  }

  isiOS () {
    return this.osName === 'iOS';
  }

  isAndroid () {
    return this.osName === 'Android';
  }

  isWindows () {
    return this.osName === 'Windows';
  }

  isMacintosh () {
    return this.osName === 'Macintosh';
  }

  isMobile () {
    return this.osName === 'iOS' || this.osName === 'Android';
  }

  private initial (ua: string) {
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
  }

  private parseData (data: string) {
    if (data.length && data[0] === '(') {
      data = data.substring(1);
    }

    if (data.length && data[data.length - 1] == ')') {
      data = data.substring(0, data.length - 1);
    }
    if (this.testiOS(data)) {
      this.osName = 'iOS';
      this.osVersion = this.parseiOSVersion(data);
      this.deviceModel = this.getiPhoneModel();
    } else if (this.testAndroid(data)) {
      this.osName = 'Android';
      this.osVersion = this.parseAndroidVersion(data);
      this.deviceModel = this.parseAndroidModel(data);
    } else if (this.testMacintosh(data)) {
      this.osName = 'Mac OS';
      this.osVersion = this.parseMacOSVersion(data);
    } else if (this.testWindows(data)) {
      this.osName = 'Windows';
      this.osVersion = this.parseWindowsVersion(data);
    } else {
      console.error(`Unkonw info: ${data}`);
    }
  }

  private parseiOSVersion (data: string) {
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

  getiPhoneModel () {
    const screenWidth = window.screen.width * window.devicePixelRatio;
    const screenHeight = window.screen.height * window.devicePixelRatio;

    const match = iPhoneInfoList.find(m => m.width === screenWidth && m.height === screenHeight);

    return match?.name;
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

    for (const item of itemList) {
      const modelPattern = /(.*) Build/;
      const modelMatch = item.match(modelPattern);

      if (modelMatch && modelMatch.length >= 2) {
        return modelMatch[1].trim().toLowerCase();
      }
    }
    if (itemList.length > 0) {
      const lastItem = itemList[itemList.length - 1].trim().toLowerCase();

      if (lastItem) {
        for (const vender of venderInfoList) {
          if (lastItem.startsWith(vender)) {
            return lastItem.substring(vender.length).trim();
          }
        }
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

  private testiOS (data: string) {
    return data.includes('iPhone') || data.includes('iPad');
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

const venderInfoList: string[] = [
  'samsung',
];

interface iPhoneInfo {
  name: string,
  gpu?: string,
  width: number,
  height: number,
}

const iPhoneInfoList: iPhoneInfo[] = [
  { name: 'iPhone 15 Pro Max', gpu: 'A17', width: 1290, height: 2796 },
  { name: 'iPhone 15 Pro', gpu: 'A17', width: 1179, height: 2556 },
  { name: 'iPhone 15 Plus', gpu: 'A16', width: 1290, height: 2796 },
  { name: 'iPhone 15', gpu: 'A16', width: 1179, height: 2556 },
  { name: 'iPhone 14 Pro Max', gpu: 'A16', width: 1290, height: 2796 },
  { name: 'iPhone 14 Pro', gpu: 'A16', width: 1179, height: 2556 },
  { name: 'iPhone 14 Plus', gpu: 'A15', width: 1284, height: 2778 },
  { name: 'iPhone 14', gpu: 'A15', width: 1170, height: 2532 },
  { name: 'iPhone 13 Pro Max', gpu: 'A15', width: 1284, height: 2778 },
  { name: 'iPhone 13 Pro', gpu: 'A15', width: 1170, height: 2532 },
  { name: 'iPhone 13', gpu: 'A15', width: 1170, height: 2532 },
  { name: 'iPhone 13 mini', gpu: 'A15', width: 1080, height: 2340 },
  { name: 'iPhone SE 3rd gen', gpu: 'A15', width: 750, height: 1334 },
  { name: 'iPhone 12 Pro Max', gpu: 'A14', width: 1284, height: 2778 },
  { name: 'iPhone 12 Pro', gpu: 'A14', width: 1170, height: 2532 },
  { name: 'iPhone 12', gpu: 'A14', width: 1170, height: 2532 },
  { name: 'iPhone 12 mini', gpu: 'A14', width: 1080, height: 2340 },
  { name: 'iPhone 11 Pro Max', gpu: 'A13', width: 1242, height: 2688 },
  { name: 'iPhone 11 Pro', gpu: 'A13', width: 1125, height: 2436 },
  { name: 'iPhone 11', gpu: 'A13', width: 828, height: 1792 },
  { name: 'iPhone SE 2nd gen', gpu: 'A13', width: 750, height: 1334 },
  { name: 'iPhone XR', gpu: 'A12', width: 828, height: 1792 },
  { name: 'iPhone XS Max', gpu: 'A12', width: 1242, height: 2688 },
  { name: 'iPhone XS', gpu: 'A12', width: 1125, height: 2436 },
  { name: 'iPhone X', gpu: 'A11', width: 1125, height: 2436 },
  { name: 'iPhone 8 Plus', gpu: 'A11', width: 1080, height: 1920 },
  { name: 'iPhone 8', gpu: 'A11', width: 750, height: 1334 },
  { name: 'iPhone 7 Plus', gpu: 'A10', width: 1080, height: 1920 },
  { name: 'iPhone 7', gpu: 'A10', width: 750, height: 1334 },
  { name: 'iPhone 6s Plus', gpu: 'A9', width: 1080, height: 1920 },
  { name: 'iPhone 6s', gpu: 'A9', width: 750, height: 1334 },
  { name: 'iPhone SE 1st gen', gpu: 'A9', width: 640, height: 1136 },
  { name: 'iPhone 6 Plus', gpu: 'A8', width: 1080, height: 1920 },
  { name: 'iPhone 6', gpu: 'A8', width: 750, height: 1334 },
  { name: 'iPhone 5C', width: 640, height: 1136 },
  { name: 'iPhone 5S', width: 640, height: 1136 },
  { name: 'iPhone 5', width: 640, height: 1136 },
  { name: 'iPhone 4S', width: 640, height: 960 },
  { name: 'iPhone 4', width: 640, height: 960 },
  { name: 'iPhone 3GS', width: 320, height: 480 },
  { name: 'iPhone 3G', width: 320, height: 480 },
  { name: 'iPhone 1st gen', width: 320, height: 480 },
];

export const DEVICE_LEVEL_HIGH = 'high';
export const DEVICE_LEVEL_MEDIUM = 'medium';
export const DEVICE_LEVEL_LOW = 'low';

let hasRegisterEvent = false;

export function getDowngradeResult (options: DowngradeOptions = {}): DowngradeResult {
  if (!hasRegisterEvent) {
    registerEvent(options);
    hasRegisterEvent = true;
  }

  const { mock, autoQueryDevice } = options;

  if (mock) {
    return { mock };
  }

  if (autoQueryDevice) {
    // FIXME: 支付宝小程序，https://opendocs.alipay.com/mini/api/system-info?pathHash=3ca534f3
    // FIXME: 微信小程序，https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getDeviceInfo.html
  }

  const decoder = new UADecoder();

  return decoder.getDowngradeResult();
}

function registerEvent (options: DowngradeOptions) {
  const { ignoreGLLost, autoPause } = options;
  const downgradeWhenGLLost = ignoreGLLost !== true;

  window.addEventListener('unload', () => {
    getActivePlayers().forEach(player => player.dispose());
  });

  window.addEventListener('webglcontextlost', e => {
    if (isCanvasUsedByPlayer(e.target as HTMLCanvasElement)) {
      DowngradePlugin.glLostOccurred = true;
      console.error('webgl lost occur');
      if (downgradeWhenGLLost) {
        console.warn('webgl lost occur, all players will be downgraded from now on');
        disableAllPlayer(true);
        getActivePlayers().forEach(player => player.dispose());
      }
    }
  }, true);

  if (autoPause) {
    document.addEventListener('pause', pauseAllActivePlayers);
    document.addEventListener('resume', resumePausedPlayers);
  }
}

// FIXME: 安卓机型校对
const downgradeAndroidModels: string[] = [
  'oppo r9s plus',
  'gm1910',
  'v1824a',
  'v1916a', // checked
  'sm-g9650', // checked
  'v1936a',
  'mi9 pro 5g', // checked
  'redmi k20',
  'v1914a',
  'gm1900',
  'rmx1971',
  'sm-a6060',
  'sm-g9600', // checked
  'v1922a',
  'pbam00', // checked
  'pcam10', // checked
  'pact00', // checked
  'pbbm00',
  'pcem00',
  'v1818a', // checked
  'vivo x6a',
  'vivo x6plus a',
];
const downgradeAndroidVersions: string[] = [];
const downgradeiOSModels: string[] = [
  'iPhone 8 Plus',
  'iPhone 8',
  'iPhone 7 Plus',
  'iPhone 7',
  'iPhone SE 1st gen',
  'iPhone 6s Plus',
  'iPhone 6s',
  'iPhone 6 Plus',
  'iPhone 6',
  'iPhone 5C',
  'iPhone 5S',
  'iPhone 5',
  'iPhone 4S',
  'iPhone 4',
  'iPhone 3GS',
  'iPhone 3G',
  'iPhone 1st gen',
];
const downgradeiOSVersions: string[] = [
  '16.7',
  '16.7.1',
  '16.7.2',
  '16.7.3',
  '16.7.4',
  '16.7.5',
  '16.7.6',
];

class DeviceProxy {
  osName?: string;
  osVersion?: string;
  model?: string;
  level?: string;
  memoryMB?: number;
  isIOS = false;

  getDowngradeDecision (result: DowngradeResult): DowngradeDecision {
    const { device = {}, downgradeCallback } = result;

    this.osName = device.osName;
    this.osVersion = device.osVersion;
    this.model = device.model;
    this.level = device.level;
    this.memoryMB = device.memoryMB;
    this.isIOS = this.osName === 'iOS';

    if (this.level === undefined) {
      this.level = this.getDeviceLevel();
    }

    const decision = downgradeCallback && downgradeCallback(this);

    if (decision) {
      return decision;
    }

    const modelList = this.isIOS ? downgradeiOSModels : downgradeAndroidModels;
    const osVersionList = this.isIOS ? downgradeiOSVersions : downgradeAndroidVersions;

    const findModel = modelList.find(m => m.toLowerCase() == this.model?.toLowerCase());

    if (findModel !== undefined) {
      return { downgrade: true, reason: 'Downgrade by downgrade model list' };
    }
    const findOS = osVersionList.find(v => v === this.osVersion);

    if (findOS !== undefined) {
      return { downgrade: true, reason: 'Downgrade by downgrade OS version list' };
    }

    return { downgrade: false, reason: '' };
  }

  getRenderLevel (): spec.RenderLevel {
    if (this.level === DEVICE_LEVEL_HIGH) {
      return spec.RenderLevel.S;
    } else if (this.level === DEVICE_LEVEL_MEDIUM) {
      return spec.RenderLevel.A;
    } else if (this.level === DEVICE_LEVEL_LOW) {
      return spec.RenderLevel.B;
    } else {
      return this.isIOS ? spec.RenderLevel.S : spec.RenderLevel.B;
    }
  }

  private getDeviceLevel () {
    if (this.memoryMB) {
      if (this.memoryMB < 4000) {
        return DEVICE_LEVEL_LOW;
      } else if (this.memoryMB < 6000) {
        return DEVICE_LEVEL_MEDIUM;
      } else {
        return DEVICE_LEVEL_HIGH;
      }
    } else if (this.isIOS && this.model) {
      if (/iPhone(\d+),/.test(this.model)) {
        const gen = +RegExp.$1;

        if (gen <= 9) {
          return DEVICE_LEVEL_LOW;
        } else if (gen < 10) {
          return DEVICE_LEVEL_MEDIUM;
        } else {
          return DEVICE_LEVEL_HIGH;
        }
      }
    }
  }
}

const deviceProxy = new DeviceProxy();

export function checkDowngradeResult (result: DowngradeResult): DowngradeDecision {
  const { mock, device } = result;

  if (mock) {
    const { downgrade, deviceLevel = DEVICE_LEVEL_HIGH } = mock;

    deviceProxy.level = deviceLevel;

    return { downgrade, reason: 'Mock' };
  }

  if (device) {
    if (device.downgrade) {
      return { downgrade: true, reason: 'Downgrade by device downgrade flag' };
    } else {
      return deviceProxy.getDowngradeDecision(result);
    }
  } else {
    return { downgrade: false, reason: 'No device info' };
  }
}

export function getRenderLevelByDevice (renderLevel?: spec.RenderLevel): spec.RenderLevel {
  if (!renderLevel) {
    return deviceProxy.getRenderLevel();
  } else {
    return /[ABS]/.test(renderLevel) ? renderLevel : spec.RenderLevel.S;
  }
}

const internalPaused = Symbol('@@_inter_pause');

function pauseAllActivePlayers (e: Event) {
  if (e.target === document) {
    logger.info('Auto pause all players with data offloaded');
    const players = getActivePlayers();

    players.forEach(player => {
      if (!player.paused) {
        player.pause({ offloadTexture: true });
        // @ts-expect-error
        player[internalPaused] = true;
      }
    });
  }
}

function resumePausedPlayers (e: Event) {
  if (e.target === document) {
    logger.info('auto resume all players');
    const players = getActivePlayers();

    players.forEach(player => {
      // @ts-expect-error
      if (player[internalPaused]) {
        void player.resume();
        // @ts-expect-error
        player[internalPaused] = false;
      }
    });
  }
}
