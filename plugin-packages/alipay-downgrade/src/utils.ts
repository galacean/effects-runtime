import { spec, getActivePlayers, logger, isAlipayMiniApp, isIOS } from '@galacean/effects';
import type { DowngradeOptions, DowngradeResult, SystemInfo } from './types';
import { DeviceProxy } from './device-proxy';

const internalPaused = Symbol('@@_inter_pause');
const mockIdPass = 'mock-pass';
const mockIdFail = 'mock-fail';
let hasRegisterEvent = false;

// window 对象不存在时需要判断
export const canUseBOM = typeof window !== 'undefined';

/**
 * 获取 GE 降级结果，在有 JSAPI 环境下调用，不需要创建 Canvas 和 WebGL 环境。
 *
 * @param bizId - 业务 bizId
 * @param options - 降级选项
 * @returns 降级结果
 */
export async function getDowngradeResult (bizId: string, options: DowngradeOptions = {}): Promise<DowngradeResult> {
  if (!canUseBOM) {
    return Promise.resolve({
      bizId,
      downgrade: true,
      level: options.level ?? spec.RenderLevel.S,
      reason: '当前环境无法访问 window',
    });
  }

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

  // 当需要通过 ap 获取降级信息时，才进行降级环境的检查
  if (!ap && (!options.systemInfo || !options.downgradeResult)) {
    return {
      bizId,
      downgrade: false,
      level: options.level ?? spec.RenderLevel.S,
      reason: 'Non-Alipay environment',
    };
  }

  const systemStartTime = performance.now();

  return getSystemInfoJSAPI(options, ap)
    .then((systemInfo: SystemInfo) => {
      const systemEndTime = performance.now();

      return getDowngradeResultJSAPI(bizId, options, ap)
        .then((downgradeResult: any) => {
          const downgradeEndTime = performance.now();

          logger.info(`Downgrade time: ${downgradeEndTime - systemStartTime}ms.`);

          const device = new DeviceProxy();

          device.setSystemInfo(systemInfo);

          const decision = device.getDowngradeDecision(downgradeResult);

          if (options.level) {
            decision.level = options.level;
          }

          const result: DowngradeResult = {
            ...decision,
            bizId,
            systemInfo,
            systemTime: systemEndTime - systemStartTime,
            downgradeResult,
            downgradeTime: downgradeEndTime - systemEndTime,
          };

          return result;
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

/**
 * 获取默认渲染等级
 *
 * @returns 渲染等级
 */
export function getDefaultRenderLevel () {
  return isIOS() ? spec.RenderLevel.S : spec.RenderLevel.B;
}

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
