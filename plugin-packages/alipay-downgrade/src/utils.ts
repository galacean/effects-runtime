import type { SceneRenderLevel } from '@galacean/effects';
import { isIOS } from '@galacean/effects';
import { spec, isString, getActivePlayers, logger, isAlipayMiniApp } from '@galacean/effects';

export interface DowngradeOptions {
  level?: SceneRenderLevel,
  /**
   * 技术点列表
   */
  techPoint?: string[],
  systemInfo?: any,
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
  callBridge?: (bizId: string, option: any, callback: (res: any) => void) => void,
}

export interface DowngradeResult {
  bizId: string,
  downgrade: boolean,
  level: SceneRenderLevel,
  reason: string,
  //
  systemInfo?: any,
  systemTime?: number,
  downgradeResult?: any,
  downgradeTime?: number,
}

const mockIdPass = 'mock-pass';
const mockIdFail = 'mock-fail';

let hasRegisterEvent = false;

export async function getDowngradeResult (bizId: string, options: DowngradeOptions = {}): Promise<DowngradeResult> {
  if (!hasRegisterEvent) {
    hasRegisterEvent = true;
    registerEvent(options);
  }

  if (bizId === mockIdFail || bizId === mockIdPass) {
    return Promise.resolve({
      bizId,
      downgrade: bizId === mockIdFail,
      level: options.level ?? spec.RenderLevel.S,
      reason: 'mock',
    });
  }

  const ap = isAlipayMiniApp() ? my : window.AlipayJSBridge;

  console.info(`getDowngradeResult: ${ap}, ${JSON.stringify(ap)}`);
  if (!ap) {
    return {
      bizId,
      downgrade: false,
      level: options.level ?? spec.RenderLevel.S,
      reason: 'Non-Alipay environment',
    };
  }

  const systemStartTime = performance.now();

  return getSystemInfoJSAPI(options, ap).then(function (systemInfo: SystemInfo) {
    const systemEndTime = performance.now();

    return getDowngradeResultJSAPI(bizId, options, ap).then(function (downgradeResult: any) {
      const downgradeEndTime = performance.now();

      logger.info(`Downgrade time: ${downgradeEndTime - systemStartTime}ms.`);

      const device = new DeviceProxy();

      device.setSystemInfo(systemInfo);

      const decision = device.getDowngradeDecision(downgradeResult);

      if (options.level) {
        decision.level = options.level;
      }

      return {
        ...decision,
        bizId,
        systemInfo,
        systemTime: systemEndTime - systemStartTime,
        downgradeResult,
        downgradeTime: downgradeEndTime - systemEndTime,
      };
    });
  });
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

interface SystemInfo {
  performance: string,
  platform: string,
  model: string,
  system: string,
  brand: string,
  version: string,
  error: any,
}

async function getSystemInfoJSAPI (options: DowngradeOptions, ap: any): Promise<SystemInfo> {
  if (options.systemInfo) {
    return Promise.resolve(options.systemInfo);
  } else {
    return new Promise((resolve, reject) => {
      ap.call('getSystemInfo', (e: SystemInfo) => {
        if (e.error) {
          reject(e);
        } else {
          resolve(e);
        }
      });
    });
  }
}

async function getDowngradeResultJSAPI (bizId: string, options: DowngradeOptions, ap: any): Promise<any> {
  if (options.downgradeResult) {
    return Promise.resolve(options.downgradeResult);
  } else {
    return new Promise((resolve, reject) => {
      const techPoint = ['mars'];
      const tc = options.techPoint;

      if (tc) {
        techPoint.push(...tc);
      }

      const downgradeOptions = {
        bizId,
        scene: 0,
        ext: {
          techPoint,
        },
      };

      const callBridge = options.callBridge ?? ap.call;

      callBridge('getDowngradeResult', downgradeOptions, (result: any) => {
        resolve(result);
      });
    });
  }
}

enum DeviceLevel {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Unknown = 'unknown',
}

interface DowngradeDecision {
  downgrade: boolean,
  level: SceneRenderLevel,
  reason: string,
}

const deviceModelList = ['12,8', '13,1', '13,2', '13,3', '13,4'];

class DeviceProxy {
  isIOS = false;
  model = 'DESKTOP_DEBUG';
  system = 'Unknown';
  level = DeviceLevel.Unknown;
  isDowngrade = false;

  setSystemInfo (systemInfo: SystemInfo) {
    const { performance, platform, model = 'UNKNOWN_DEVICE', system = 'Unknown' } = systemInfo;

    this.isIOS = platform === 'iOS';
    this.model = model;
    this.system = system;
    this.setLevel(performance);
  }

  getDowngradeDecision (result: any): DowngradeDecision {
    let resultType = undefined;
    let resultReason = undefined;

    if (!result.error) {
      try {
        const ret = isString(result) ? JSON.parse(result) : result;

        if ('downgradeResultType' in ret) {
          resultType = ret.downgradeResultType;
        } else if ('resultType' in ret) {
          resultType = ret.resultType;
          resultReason = ret.resultReason;
        }

        if (result.context) {
          const deviceInfo = result.context.deviceInfo;

          if (deviceInfo) {
            const { deviceLevel } = deviceInfo;
            const newLevel = getDeviceLevel(deviceLevel);

            if (newLevel !== DeviceLevel.Unknown) {
              this.level = newLevel;
            }
          }
        }
      } catch (ex: any) {
        logger.error(ex);
      }

      if (resultType === undefined) {
        return {
          downgrade: true,
          level: this.getRenderLevel(),
          reason: 'call downgrade fail',
        };
      } else {
        if (resultType === 1) {
          return {
            downgrade: true,
            level: this.getRenderLevel(),
            reason: getDowngradeReason(resultReason),
          };
        } else {
          if (isAlipayMiniApp() && this.downgradeForMiniprogram()) {
            return {
              downgrade: true,
              level: this.getRenderLevel(),
              reason: 'Force downgrade by downgrade plugin',
            };
          } else {
            return {
              downgrade: false,
              level: this.getRenderLevel(),
              reason: resultType,
            };
          }
        }
      }
    } else {
      // 无权调用的情况下不降级
      return {
        downgrade: result.error !== 4,
        level: this.getRenderLevel(),
        reason: 'api error: ' + result.error,
      };
    }
  }

  getRenderLevel (): SceneRenderLevel {
    if (this.level === DeviceLevel.High) {
      return spec.RenderLevel.S;
    } else if (this.level === DeviceLevel.Medium) {
      return spec.RenderLevel.A;
    } else if (this.level === DeviceLevel.Low) {
      return spec.RenderLevel.B;
    } else {
      return this.isIOS ? spec.RenderLevel.S : spec.RenderLevel.B;
    }
  }

  private setLevel (level?: string) {
    this.level = getDeviceLevel(level);
    if (this.level === DeviceLevel.Unknown) {
      if (/iPhone(\d+),/.test(this.model)) {
        const gen = +RegExp.$1;

        if (gen <= 9) {
          this.level = DeviceLevel.Low;
        } else if (gen < 10) {
          this.level = DeviceLevel.Medium;
        } else {
          this.level = DeviceLevel.High;
        }
      }
    }
  }

  private downgradeForMiniprogram () {
    if (this.isIOS) {
      if (deviceModelList.find(v => v === this.model)) {
        const versionList = this.system.split('.');

        if (versionList.length > 0 && versionList[0] === '16') {
          return true;
        }
      }
    }

    return false;
  }

}

export function getDefaultRenderLevel () {
  return isIOS() ? spec.RenderLevel.S : spec.RenderLevel.B;
}

function getDowngradeReason (reason: number): string {
  if (reason === -1) {
    return `${reason}, unable to pull configuration`;
  } else if (reason === 0) {
    return `${reason}, no downgrade`;
  } else if (reason === 1) {
    return `${reason}, memory downgrade`;
  } else if (reason === 2) {
    return `${reason}, crash downgrade`;
  } else if (reason === 3) {
    return `${reason}, basic dimension downgrade`;
  } else if (reason === 4) {
    return `${reason}, technical point downgrade`;
  } else if (reason === 5) {
    return `${reason}, GPU downgrade`;
  } else if (reason === 6) {
    return `${reason}, self-healing downgrade`;
  } else if (reason === 7) {
    return `${reason}, 32-bit CPU downgrade`;
  } else {
    return `${reason}`;
  }
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

const internalPaused = Symbol('@@_inter_pause');

function pauseAllActivePlayers (e: Event) {
  if (e.target === document) {
    logger.info('Auto pause all players with data offloaded.');
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
    logger.info('Auto resume all players.');
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
