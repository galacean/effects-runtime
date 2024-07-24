import { isIOS, isWechatMiniApp } from '@galacean/effects';
import { spec, getActivePlayers, logger, isAlipayMiniApp } from '@galacean/effects';
import type { AlipaySystemInfo, DowngradeOptions, DowngradeResult } from './types';
import { UADecoder } from './ua-decoder';
import { AlipayMiniprogramParser, WechatMiniprogramParser } from './parser';
import { DowngradeJudge } from './downgrade-judge';

const internalPaused = Symbol('@@_inter_pause');
let hasRegisterEvent = false;

/**
 * 获取 GE 降级结果，不需要创建 Canvas 和 WebGL 环境。
 * 如果是小程序环境下，要确保 JSAPI 可调用
 *
 * @param options - 降级选项
 * @returns 降级结果
 */
export function getDowngradeResult (options: DowngradeOptions = {}): DowngradeResult {
  if (!hasRegisterEvent) {
    registerEvent(options);
    hasRegisterEvent = true;
  }

  const { mockDowngrade } = options;

  if (mockDowngrade !== undefined) {
    return {
      downgrade: mockDowngrade,
      level: options.level ?? spec.RenderLevel.S,
      reason: 'mock',
    };
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
        const parser = new AlipayMiniprogramParser(info);

        return parser.getDeviceInfo();
      } else {
        logger.error('Can\'t use getSystemInfo in Alipay MiniProgram.');
      }
    }
    if (isWechatMiniApp()) {
      // 微信小程序
      // @ts-expect-error
      if (wx.canIUse('getDeviceInfo')) {
        // https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getDeviceInfo.html
        // @ts-expect-error
        const info = wx.getDeviceInfo() as WechatDeviceInfo;
        const parser = new WechatMiniprogramParser(info);

        return parser.getDeviceInfo();
      } else {
        logger.error('Can\'t use getDeviceInfo in WeChat MiniProgram.');
      }
    } else {
      logger.error('Non-mini program environment and try to get device info from user agent.');
    }
  }

  return new UADecoder().getDeviceInfo();
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
