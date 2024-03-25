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
    modelAlias?: string,
    level?: string,
    memoryMB?: number,
  },
  mock?: {
    downgrade: boolean,
    deviceLevel?: string,
  },
  queryResult?: any,
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

    return match?.model;
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
      const modelPattern = /(.*) Build/;
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

      for (const vender of venderInfoList) {
        if (lastItem.startsWith(vender)) {
          return lastItem.substring(vender.length).trim();
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
  'SAMSUNG',
];

interface iPhoneInfo {
  name: string,
  model: string,
  width: number,
  height: number,
}

const iPhoneInfoList: iPhoneInfo[] = [
  { name: 'iPhone 15 Pro Max', model: 'iPhone16,2', width: 1290, height: 2796 },
  { name: 'iPhone 15 Pro', model: 'iPhone16,1', width: 1179, height: 2556 },
  { name: 'iPhone 15 Plus', model: 'iPhone15,5', width: 1290, height: 2796 },
  { name: 'iPhone 15', model: 'iPhone15,4', width: 1179, height: 2556 },
  { name: 'iPhone 14 Pro Max', model: 'iPhone15,3', width: 1290, height: 2796 },
  { name: 'iPhone 14 Pro', model: 'iPhone15,2', width: 1179, height: 2556 },
  { name: 'iPhone 14 Plus', model: 'iPhone14,8', width: 1284, height: 2778 },
  { name: 'iPhone 14', model: 'iPhone14,7', width: 1170, height: 2532 },
  { name: 'iPhone 13 Pro Max', model: 'iPhone14,3', width: 1284, height: 2778 },
  { name: 'iPhone 13 Pro', model: 'iPhone14,2', width: 1170, height: 2532 },
  { name: 'iPhone 13', model: 'iPhone14,5', width: 1170, height: 2532 },
  { name: 'iPhone 13 mini', model: 'iPhone14,4', width: 1080, height: 2340 },
  { name: 'iPhone SE (3rd gen)', model: 'iPhone14,6', width: 750, height: 1334 },
  { name: 'iPhone 12 Pro Max', model: 'iPhone13,4', width: 1284, height: 2778 },
  { name: 'iPhone 12 Pro', model: 'iPhone13,3', width: 1170, height: 2532 },
  { name: 'iPhone 12', model: 'iPhone13,2', width: 1170, height: 2532 },
  { name: 'iPhone 12 mini', model: 'iPhone13,1', width: 1080, height: 2340 },
  { name: 'iPhone 11 Pro Max', model: 'iPhone12,5', width: 1242, height: 2688 },
  { name: 'iPhone 11 Pro', model: 'iPhone12,3', width: 1125, height: 2436 },
  { name: 'iPhone 11', model: 'iPhone12,1', width: 828, height: 1792 },
  { name: 'iPhone SE (2nd gen)', model: 'iPhone12,8', width: 750, height: 1334 },
  { name: 'iPhone XR', model: 'iPhone11,8', width: 828, height: 1792 },
  { name: 'iPhone XS Max', model: 'iPhone11,6', width: 1242, height: 2688 },
  { name: 'iPhone XS', model: 'iPhone11,2', width: 1125, height: 2436 },
  { name: 'iPhone X', model: 'iPhone10,3', width: 1125, height: 2436 },
  { name: 'iPhone 8 Plus', model: 'iPhone10,2', width: 1080, height: 1920 },
  { name: 'iPhone 8', model: 'iPhone10,1', width: 750, height: 1334 },
  { name: 'iPhone 7 Plus', model: 'iPhone9,2', width: 1080, height: 1920 },
  { name: 'iPhone 7', model: 'iPhone9,1', width: 750, height: 1334 },
  { name: 'iPhone 6s Plus', model: 'iPhone8,2', width: 1080, height: 1920 },
  { name: 'iPhone 6s', model: 'iPhone8,1', width: 750, height: 1334 },
  { name: 'iPhone SE (1st gen)', model: 'iPhone8,4', width: 640, height: 1136 },
  { name: 'iPhone 6 Plus', model: 'iPhone7,1', width: 1080, height: 1920 },
  { name: 'iPhone 6', model: 'iPhone7,2', width: 750, height: 1334 },
  { name: 'iPhone 5C', model: 'iPhone5,3', width: 640, height: 1136 },
  { name: 'iPhone 5S', model: 'iPhone6,1', width: 640, height: 1136 },
  { name: 'iPhone 5', model: 'iPhone5,1', width: 640, height: 1136 },
  { name: 'iPhone 4S', model: 'iPhone4,1', width: 640, height: 960 },
  { name: 'iPhone 4', model: 'iPhone3,1', width: 640, height: 960 },
  { name: 'iPhone 3GS', model: 'iPhone2,1', width: 320, height: 480 },
  { name: 'iPhone 3G', model: 'iPhone1,2', width: 320, height: 480 },
  { name: 'iPhone 1st gen', model: 'iPhone1,1', width: 320, height: 480 },
];

interface WechatDeviceInfo {
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
    const userAgent = navigator.userAgent;

    if (userAgent.match(/MicroMessenger/i)) {
      // 微信小程序
      // @ts-expect-error
      if (wx.canIUse('getDeviceInfo')) {
        // @ts-expect-error
        const info = wx.getDeviceInfo() as WechatDeviceInfo;

        return parseWechatDeviceInfo(info);
      } else {
        console.error('Can\'t use getDeviceInfo and fail to get device info.');
      }
    }
    // FIXME: 支付宝小程序，https://opendocs.alipay.com/mini/api/system-info?pathHash=3ca534f3
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

export function parseWechatDeviceInfo (info: WechatDeviceInfo) {
  let osName = undefined;
  let osVersion = undefined;
  let model = undefined;
  let modelAlias = undefined;
  let level = undefined;

  const osNameMatch = info.system.match(/\w+/);

  if (osNameMatch) {
    osName = osNameMatch[0].trim();
  }

  const osVersionMatch = info.system.match(/[\d.]+/);

  if (osVersionMatch) {
    osVersion = osVersionMatch[0].trim();
  }

  if (osName === 'iOS') {
    const modelMatch = info.model.match(/^(.*?)<(.*?)>$/);

    if (modelMatch) {
      model = modelMatch[1].trim();
      modelAlias = modelMatch[2].trim();
    } else {
      model = info.model;
    }
  } else {
    model = info.model;
  }

  if (info.benchmarkLevel >= 1 && info.benchmarkLevel <= 50) {
    if (info.benchmarkLevel <= 10) {
      level = DEVICE_LEVEL_LOW;
    } else if (info.benchmarkLevel <= 20) {
      level = DEVICE_LEVEL_MEDIUM;
    } else {
      level = DEVICE_LEVEL_HIGH;
    }
  }

  return {
    device: {
      osName,
      osVersion,
      model,
      modelAlias,
      level,
      memoryMB: info.memorySize,
    },
    queryResult: info,
  };
}

// FIXME: 安卓机型校对
const downgradeAndroidModels: string[] = [
  'OPPO R9s Plus',
  'GM1910',
  'V1824A',
  'V1916A', // checked
  'SM-G9650', // checked
  'V1936A',
  'MI9 PRO 5G', // checked
  'REDMI K20',
  'V1914A',
  'GM1900',
  'RMX1971',
  'SM-A6060',
  'SM-G9600', // checked
  'V1922A',
  'PBAM00', // checked
  'PCAM10', // checked
  'PACT00', // checked
  'PBBM00',
  'PCEM00',
  'V1818A', // checked
  'vivo X6A',
  'vivo X6Plus A',
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
