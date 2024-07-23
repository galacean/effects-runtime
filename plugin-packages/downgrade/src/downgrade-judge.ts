import { spec, type SceneRenderLevel } from '@galacean/effects';
import { DeviceLevel, type DeviceInfo, type DowngradeOptions, type DowngradeResult } from './types';
import { downgradeModels, downgradeVersions } from './constants';

export class DowngradeJudge {
  isIOS = false;
  level: SceneRenderLevel;

  constructor (
    public options: DowngradeOptions,
    public device: DeviceInfo,
  ) { }

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

    if (this.device.model) {
      const deviceModel = this.device.model.toLowerCase();
      const modelList = this.isIOS ? downgradeModels.iPhone : downgradeModels.android;
      const findModel = modelList.find(m => {
        const testModel = m.toLowerCase();

        if (this.isIOS) {
          return testModel === deviceModel;
        } else {
          return testModel.includes(deviceModel) || deviceModel.includes(testModel);
        }
      });

      if (findModel !== undefined) {
        return {
          downgrade: true,
          level: this.level,
          reason: 'Downgrade by model list',
          deviceInfo: this.device,
        };
      }
    }

    const osVersionList = this.isIOS ? downgradeVersions.iOS : downgradeVersions.android;
    const findOS = osVersionList.find(v => v === this.device.osVersion);

    if (findOS !== undefined) {
      return {
        downgrade: true,
        level: this.level,
        reason: 'Downgrade by OS version list',
        deviceInfo: this.device,
      };
    }

    return {
      downgrade: false,
      level: this.level,
      reason: '',
      deviceInfo: this.device,
    };
  }

  getRenderLevel (): SceneRenderLevel {
    if (this.options.level) {
      return this.options.level;
    }

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
