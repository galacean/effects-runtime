import { spec, getActivePlayers, logger, isAlipayMiniApp, isIOS } from '@galacean/effects';
import type { DowngradeOptions, DowngradeResult, SystemInfo } from './types';
import { DeviceProxy } from './device-proxy';

const internalPaused = Symbol('@@_inter_pause');
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

  if (!ap) {
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
