import { spec, isString, isAlipayMiniApp } from '@galacean/effects';

declare global {
  interface Window {
    AlipayJSBridge: any,
  }
}

const DEVICE_PERFORMANCE_LOW = 'low';
const DEVICE_PERFORMANCE_MIDDLE = 'middle';
const DEVICE_PERFORMANCE_HIGH = 'high';

let devicePending: Promise<string | void> | undefined;
let devicePerformance: string;
let deviceName = 'DESKTOP_DEBUG';
let deviceSystem = 'Unknown';
let isIOS = false;

export async function getDeviceName () {
  if (!devicePending) {
    devicePending = getSystemInfo().then(info => {
      const { performance, platform, model = 'UNKNOWN_DEVICE', system = 'Unknown' } = info;

      if (!devicePerformance) {
        devicePerformance = performance;
      }
      isIOS = platform === 'iOS';
      deviceName = model;
      deviceSystem = system;
      if (/iPhone(\d+),/.test(deviceName) && !devicePerformance) {
        const gen = +RegExp.$1;

        // https://gist.github.com/adamawolf/3048717 device code
        if (gen <= 9) { // iphone 7,iphone 7p
          devicePerformance = DEVICE_PERFORMANCE_LOW;
        } else if (gen < 10) {
          devicePerformance = DEVICE_PERFORMANCE_MIDDLE;
        } else {
          devicePerformance = DEVICE_PERFORMANCE_HIGH;
        }
      }
      if (deviceName.indexOf(info.brand) === 0) {
        deviceName = deviceName.replace(info.brand, '').trim();
      }

      return deviceName;
    }, (e: any) => {
    });
  }

  return devicePending.then(() => deviceName, () => deviceName);
}

export function getRenderLevelByDevice (renderLevel?: spec.RenderLevel | 'auto'): spec.RenderLevel {
  if (renderLevel === 'auto' || !renderLevel) {
    if (devicePerformance === DEVICE_PERFORMANCE_HIGH) {
      return spec.RenderLevel.S;
    } else if (devicePerformance === DEVICE_PERFORMANCE_MIDDLE) {
      return spec.RenderLevel.A;
    } else if (devicePerformance === DEVICE_PERFORMANCE_LOW) {
      return spec.RenderLevel.B;
    }

    return isIOS ? spec.RenderLevel.S : spec.RenderLevel.B;
  }

  return /[ABS]/.test(renderLevel) ? renderLevel : spec.RenderLevel.S;
}

export function resetDevicePending () {
  devicePending = undefined;
}

interface DowngradeResult {
  downgrade: boolean,
  reason: string,
}

const mockIdPass = 'mock-pass';
const mockIdFail = 'mock-fail';

/**
 *
 * @param bizId
 * @param options
 * @returns
 */
export async function checkDowngrade (
  bizId?: string,
  options: { techPoint?: string[], callBridge?: (a: string, option: any, cb: (res: any) => void) => void } = {},
): Promise<DowngradeResult> {
  if (bizId === mockIdFail || bizId === mockIdPass) {
    return Promise.resolve({ downgrade: bizId === mockIdFail, reason: 'mock' });
  }

  let ap: { call: any };

  if (isAlipayMiniApp()) {
    //@ts-expect-error
    ap = my;
  } else {
    ap = window.AlipayJSBridge;
  }

  if (ap) {
    const now = performance.now();

    return getDeviceName().then(function () {
      return new Promise(function (resolve) {
        const techPoint = ['mars'];
        const tc = options.techPoint;

        if (tc) {
          techPoint.push(...tc);
        }
        const callBridge = options.callBridge ?? ap.call;

        callBridge('getDowngradeResult', {
          bizId,
          scene: 0,
          ext: {
            techPoint,
          },
        }, function (result: any) {
          let reason = undefined;

          console.info(`downgrade time: ${performance.now() - now}ms`);
          if (!result.error) {
            try {
              const ret = isString(result) ? JSON.parse(result) : result;

              if ('downgradeResultType' in ret) {
                reason = ret.downgradeResultType;
              } else if ('resultType' in ret) {
                reason = ret.resultType;
              }
              if (result.context) {
                const deviceInfo = result.context.deviceInfo;

                if (deviceInfo) {
                  const level = deviceInfo.deviceLevel;

                  if (level === DEVICE_PERFORMANCE_HIGH || level === DEVICE_PERFORMANCE_LOW) {
                    devicePerformance = level;
                  } else if (level === 'medium') {
                    devicePerformance = DEVICE_PERFORMANCE_MIDDLE;
                  }
                }
              }
            } catch (ex) {
              console.error(ex);
            }
          } else {
            // 无权调用的情况下不降级
            resolve({ downgrade: result.error !== 4, reason: 'api error:' + result.error });
          }
          if (reason === undefined) {
            resolve({ downgrade: true, reason: 'call downgrade fail' });
          } else {
            if (isAlipayMiniApp() && downgradeForMiniprogram()) {
              resolve({ downgrade: true, reason: 'Force downgrade by downgrade plugin' });
            } else {
              resolve({ downgrade: reason === 1, reason });
            }
          }
        },
        );
      });
    });
  }

  return Promise.resolve({ downgrade: false, reason: 'no AP env' });
}

type SystemInfo = {
  performance: string,
  platform: string,
  model: string,
  system: string,
  brand: string,
  version: string,
  error: any,
};

export async function getSystemInfo (): Promise<SystemInfo> {
  return new Promise((resolve, reject) => {
    let ap;

    if (isAlipayMiniApp()) {
      //@ts-expect-error
      ap = my;
    } else {
      ap = window.AlipayJSBridge;
    }
    if (ap) {
      ap.call('getSystemInfo', (e: SystemInfo) => {
        if (e.error) {
          reject(e);
        } else {
          resolve(e);
        }
      });
    } else {
      reject('no ap');
    }
  });
}

const deviceNameList = ['12,8', '13,1', '13,2', '13,3', '13,4'];

/**
 *
 * @returns iPhone SE2和12全系列机型，如果是iOS 16系统，在小程序中强制降级
 */
export function downgradeForMiniprogram () {
  if (isIOS) {
    if (deviceNameList.find(v => v === deviceName)) {
      const versionList = deviceSystem.split('.');

      if (versionList.length > 0 && versionList[0] === '16') {
        return true;
      }
    }
  }

  return false;
}
