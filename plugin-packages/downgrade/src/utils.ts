import type { SceneRenderLevel } from '@galacean/effects';
import { isIOS } from '@galacean/effects';
import { spec, getActivePlayers, logger, isAlipayMiniApp } from '@galacean/effects';

export interface DowngradeOptions {
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
   * mock 相关信息
   */
  mock?: {
    downgrade: boolean,
    level: SceneRenderLevel,
  },
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
  modelAlias?: string,
  level?: DeviceLevel,
  memoryMB?: number,
  sourceData?: any,
}

export type DowngradeCallback = (device: DeviceInfo) => DowngradeResult | undefined;

interface ProductInfo {
  name: string,
  comment?: string,
}

interface iPhoneInfo {
  name: string,
  model: string,
  width: number,
  height: number,
}

interface WeChatDeviceInfo {
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

interface AlipaySystemInfo {
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
  model?:	string,
  /**
   * 系统版本
   */
  system?: string,
  /**
   * 客户端平台：Android，iOS / iPhone OS，Harmony
   */
  platform?: string,
}

enum DeviceLevel {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Unknown = 'unknown',
}

let hasRegisterEvent = false;

export function getDowngradeResult (options: DowngradeOptions = {}): DowngradeResult {
  if (!hasRegisterEvent) {
    registerEvent(options);
    hasRegisterEvent = true;
  }

  const { mock } = options;

  if (mock) {
    return { ...mock, reason: 'mock' };
  }

  const device = getDeviceInfo(options);
  const judge = new DowngradeJudge(options, device);

  return judge.getDowngradeResult();
}

function registerEvent (options: DowngradeOptions) {
  const { autoPause } = options;

  window.addEventListener('unload', () => {
    getActivePlayers().forEach(player => player.dispose());
  });

  if (autoPause) {
    document.addEventListener('pause', pauseAllActivePlayers);
    document.addEventListener('resume', resumePausedPlayers);
  }
}

function getDeviceInfo (options: DowngradeOptions) {
  const { queryDeviceInMiniApp, deviceInfo } = options;

  if (deviceInfo) {
    return deviceInfo;
  }

  if (queryDeviceInMiniApp) {
    if (isAlipayMiniApp()) {
      // 支付宝小程序
      if (my.canIUse('getSystemInfo')) {
        // https://opendocs.alipay.com/mini/api/system-info
        const info = my.getSystemInfo() as AlipaySystemInfo;
        const parser = new AlipayMiniAppParser(info);

        return parser.getDeviceInfo();
      } else {
        logger.error('Can\'t use getSystemInfo in AlipayMiniApp');
      }
    } else if (isWeChatMiniApp()) {
      // 微信小程序
      // @ts-expect-error
      if (wx.canIUse('getDeviceInfo')) {
        // https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getDeviceInfo.html
        // @ts-expect-error
        const info = wx.getDeviceInfo() as WeChatDeviceInfo;
        const parser = new WeChatMiniAppParser(info);

        return parser.getDeviceInfo();
      } else {
        logger.error('Can\'t use getDeviceInfo in WeChatMiniApp');
      }
    } else {
      logger.error('Non-mini program environment and try to get device info from user agent');
    }
  }

  const decoder = new UADecoder();

  return decoder.getDeviceInfo();
}

export class UADecoder {
  device: DeviceInfo = {};

  constructor (userAgent?: string) {
    this.parse(userAgent ?? navigator.userAgent);
  }

  getDeviceInfo () {
    return this.device;
  }

  isiOS () {
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
    return this.isiOS() || this.isAndroid() || this.isHarmony();
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

    this.device.sourceData = ua;
  }

  private parseData (data: string) {
    if (data.length && data[0] === '(') {
      data = data.substring(1);
    }

    if (data.length && data[data.length - 1] == ')') {
      data = data.substring(0, data.length - 1);
    }
    if (this.testiPhone(data)) {
      this.device.platform = 'iOS';
      this.device.osVersion = this.parseiOSVersion(data);
      this.device.model = this.getiPhoneModel();
    } else if (this.testiPad(data)) {
      this.device.platform = 'iOS';
      this.device.osVersion = this.parseiOSVersion(data);
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

  private testiPhone (data: string) {
    return data.includes('iPhone');
  }

  private testiPad (data: string) {
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

export class WeChatMiniAppParser {
  device: DeviceInfo = {};

  constructor (info: WeChatDeviceInfo) {
    this.parse(info);
  }

  getDeviceInfo () {
    return this.device;
  }

  private parse (info: WeChatDeviceInfo) {
    const osNameMatch = info.system.match(/\w+/);

    if (osNameMatch) {
      this.device.platform = osNameMatch[0].trim();
    }

    const osVersionMatch = info.system.match(/[\d.]+/);

    if (osVersionMatch) {
      this.device.osVersion = osVersionMatch[0].trim();
    }

    if (this.device.platform === 'iOS') {
      const modelMatch = info.model.match(/^(.*?)<(.*?)>$/);

      if (modelMatch) {
        this.device.model = modelMatch[1].trim();
        this.device.modelAlias = modelMatch[2].trim();
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

export class AlipayMiniAppParser {
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
    this.device.model = info.model;
    this.device.level = getDeviceLevel(info.performance);
    this.device.sourceData = info;
  }
}

export class DowngradeJudge {
  isIOS = false;
  level: SceneRenderLevel;

  constructor (
    public options: DowngradeOptions,
    public device: DeviceInfo,
  ) {

  }

  getDowngradeResult (): DowngradeResult {
    const { downgradeCallback } = this.options;

    if (downgradeCallback) {
      const result = downgradeCallback(this.device);

      if (result) {
        if (!result.reason) {
          result.reason = 'downgradeCallback';
        }

        return result;
      }
    }

    this.isIOS = this.device.platform === 'iOS';
    this.level = this.getRenderLevel();

    const modelList = this.isIOS ? downgradeiOSModels : downgradeAndroidModels;
    const osVersionList = this.isIOS ? downgradeiOSVersions : downgradeAndroidVersions;

    const findModel = modelList.find(m => m.toLowerCase() == this.device.model?.toLowerCase());

    if (findModel !== undefined) {
      return {
        downgrade: true,
        level: this.level,
        reason: 'Downgrade by model list',
      };
    }
    const findOS = osVersionList.find(v => v === this.device.osVersion);

    if (findOS !== undefined) {
      return {
        downgrade: true,
        level: this.level,
        reason: 'Downgrade by OS version list',
      };
    }

    return {
      downgrade: false,
      level: this.level,
      reason: '',
    };
  }

  getRenderLevel (): SceneRenderLevel {
    if (this.device.level) {
      if (this.device.level === DeviceLevel.High) {
        return spec.RenderLevel.S;
      } else if (this.device.level === DeviceLevel.Medium) {
        return spec.RenderLevel.A;
      } else if (this.device.level === DeviceLevel.Low) {
        return spec.RenderLevel.B;
      }
    }

    if (this.device.memoryMB) {
      if (this.device.memoryMB < 4000) {
        return spec.RenderLevel.B;
      } else if (this.device.memoryMB < 6000) {
        return spec.RenderLevel.A;
      } else {
        return spec.RenderLevel.S;
      }
    }

    if (this.isIOS && this.device.model) {
      if (/iPhone(\d+),/.test(this.device.model)) {
        const gen = +RegExp.$1;

        if (gen <= 9) {
          return spec.RenderLevel.B;
        } else if (gen < 10) {
          return spec.RenderLevel.A;
        } else {
          return spec.RenderLevel.S;
        }
      }
    }

    return this.isIOS ? spec.RenderLevel.S : spec.RenderLevel.B;
  }
}

export function getDefaultRenderLevel () {
  return isIOS() ? spec.RenderLevel.S : spec.RenderLevel.B;
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

function isWeChatMiniApp (): boolean {
  // @ts-expect-error
  return typeof wx !== 'undefined' && wx?.renderTarget === 'web';
}

function getDeviceLevel (level?: string): DeviceLevel {
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

const venderInfoList: string[] = [
  'SAMSUNG',
];

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
