import type { SceneRenderLevel } from '@galacean/effects';
import { isAlipayMiniApp, isString, logger, spec } from '@galacean/effects';
import type { DowngradeDecision, SystemInfo } from './types';
import { DeviceLevel } from './types';

const deviceModelList = ['12,8', '13,1', '13,2', '13,3', '13,4'];

export class DeviceProxy {
  isIOS = false;
  model = 'DESKTOP_DEBUG';
  system = 'Unknown';
  level = DeviceLevel.Unknown;
  isDowngrade = false;

  setSystemInfo (systemInfo: SystemInfo) {
    const {
      performance, platform,
      model = 'UNKNOWN_DEVICE',
      system = 'Unknown',
    } = systemInfo;

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
