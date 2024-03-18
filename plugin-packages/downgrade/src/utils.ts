import { spec, isString, disableAllPlayer, getActivePlayers, isCanvasUsedByPlayer, logger } from '@galacean/effects';
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
  /**
   * mock相关信息
   */
  mock?: {
    id: string,
    deviceLevel?: string,
  },
}

export interface DowngradeResult {
  device?: {
    downgrade?: boolean,
    level?: string,
    model?: string,
    platform?: string,
    isSystem64?: boolean,
    osVersion?: string,
    totalMemoryMB?: number,
  },
  mock?: {
    downgrade: boolean,
    deviceLevel?: string,
  },
}

interface DowngradeDecision {
  downgrade: boolean,
  reason: string,
}

const mockIdPass = 'mock-pass';
const mockIdFail = 'mock-fail';

const DEVICE_LEVEL_HIGH = 'high';
const DEVICE_LEVEL_MEDIUM = 'medium';
const DEVICE_LEVEL_LOW = 'low';
const DEVICE_LEVEL_NONE = 'none';

let hasRegisterEvent = false;

export function getDowngradeResult (options: DowngradeOptions = {}): DowngradeResult {
  if (!hasRegisterEvent) {
    registerEvent(options);
    hasRegisterEvent = true;
  }

  const { mock } = options;

  if (mock) {
    return {
      mock : {
        downgrade: mock.id === mockIdFail,
        deviceLevel: mock.deviceLevel,
      },
    };
  }

  return {};

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

class DeviceProxy {
  isIOS = false;
  model = 'DESKTOP_DEBUG';
  deviceLevel = DEVICE_LEVEL_NONE;
  isDowngrade = false;

  getRenderLevel (): spec.RenderLevel {
    if (this.deviceLevel === DEVICE_LEVEL_HIGH) {
      return spec.RenderLevel.S;
    } else if (this.deviceLevel === DEVICE_LEVEL_MEDIUM) {
      return spec.RenderLevel.A;
    } else if (this.deviceLevel === DEVICE_LEVEL_LOW) {
      return spec.RenderLevel.B;
    } else {
      return this.isIOS ? spec.RenderLevel.S : spec.RenderLevel.B;
    }
  }

  hasDeviceLevel (): boolean {
    return isDeviceLevel(this.deviceLevel);
  }

  updateDeviceLevel () {
    if (this.hasDeviceLevel()) {
      return;
    }

    if (/iPhone(\d+),/.test(this.model)) {
      const gen = +RegExp.$1;

      if (gen <= 9) {
        this.deviceLevel = DEVICE_LEVEL_LOW;
      } else if (gen < 10) {
        this.deviceLevel = DEVICE_LEVEL_MEDIUM;
      } else {
        this.deviceLevel = DEVICE_LEVEL_HIGH;
      }
    }
  }

  getDeviceInfo () {
    return {
      isIOS: this.isIOS,
      model: this.model,
      deviceLevel: this.deviceLevel,
    };
  }
}

const device = new DeviceProxy();

export function checkDowngradeResult (result: DowngradeResult): DowngradeDecision {
  if (result.mock) {
    const { downgrade, deviceLevel = DEVICE_LEVEL_HIGH } = result.mock;

    device.deviceLevel = deviceLevel;

    return { downgrade, reason: 'mock' };
  }

  return { downgrade: false, reason: 'mock' };
}

function parseDowngradeResult (result: any) {
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

          if (isDeviceLevel(deviceLevel)) {
            device.deviceLevel = deviceLevel;
          }
        }
      }

      device.updateDeviceLevel();
    } catch (ex) {
      console.error(ex);
    }

    if (resultType === undefined) {
      return { downgrade: true, reason: 'call downgrade fail' };
    } else {
      if (resultType === 1) {
        return { downgrade: true, reason: getDowngradeReason(resultReason) };
      } else {
        return { downgrade: false, reason: resultType };
      }
    }
  } else {
    // 无权调用的情况下不降级
    return { downgrade: result.error !== 4, reason: 'api error: ' + result.error };
  }
}

function getDowngradeReason (reason: number): string {
  if (reason === -1) {
    return `${reason}-no config`;
  } else if (reason === 0) {
    return `${reason}-none`;
  } else if (reason === 1) {
    return `${reason}-downgrade by memory`;
  } else if (reason === 2) {
    return `${reason}-downgrade by crash`;
  } else if (reason === 3) {
    return `${reason}-downgrade by device`;
  } else if (reason === 4) {
    return `${reason}-downgrade by force`;
  } else {
    return `${reason}`;
  }
}

export function getRenderLevelByDevice (renderLevel?: spec.RenderLevel): spec.RenderLevel {
  if (!renderLevel) {
    return device.getRenderLevel();
  } else {
    return /[ABS]/.test(renderLevel) ? renderLevel : spec.RenderLevel.S;
  }
}

function isDeviceLevel (deviceLevel?: string): boolean {
  return deviceLevel === DEVICE_LEVEL_HIGH
    || deviceLevel === DEVICE_LEVEL_MEDIUM
    || deviceLevel === DEVICE_LEVEL_LOW;
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

export class UADecoder {
  osName: string;
  osVersion: string;
  architecture: string;

  constructor () {
    const ua = navigator.userAgent;

  }
}