import { disableAllPlayer, getActivePlayers, isCanvasUsedByPlayer, logger, registerPlugin } from '@galacean/effects';
import { AlipayDowngradePlugin } from './alipay-downgrade-plugin';
import { DowngradeVFXItem } from './downgrade-vfx-item';
import { getDeviceName } from './utils';

export * from './utils';
export * from './native-log';

/**
 *
 */
export interface AlipayDowngradeOptions {
  /**
   * 去除 window 上默认添加的 gl lost 事件
   */
  disableGLLostEvent?: boolean,
  /**
   * 发生 gl lost 时，是否忽略
   * @default false - 不忽略，将不再允许任何播放器创建，会全部走降级逻辑
   */
  ignoreGLLost?: boolean,
  /**
   * 禁用压后台的时候自动暂停播放器
   * @default false
   */
  autoPause?: boolean,
}

let registered = false;

/**
 * 支付宝端内统一降级方案，传入降级 ID，每次加载场景前都会自动调用降级
 * - 如果要为某个 json 单独配置降级 ID，可以使用 `player.loadScene(url, { pluginData: { alipayBizId: '#bizId#' }})`
 * @param bizId - 降级 ID，如果为 `mock-pass` 将 mock 不降级场景，如果为 `mock-fail` 将 mock 降级场景，业务请不要使用这两个字符串
 * @param options - 优化策略
 */
export function setAlipayDowngradeBizId (bizId: string, options: AlipayDowngradeOptions = {}) {
  const { ignoreGLLost, autoPause, disableGLLostEvent = false } = options;
  const downgradeWhenGLLost = ignoreGLLost !== true;

  AlipayDowngradePlugin.currentBizId = bizId;

  if (registered) {
    return;
  }

  registerPlugin('alipay-downgrade', AlipayDowngradePlugin, DowngradeVFXItem, true);

  window.addEventListener('unload', () => {
    getActivePlayers().forEach(player => player.dispose());
  });

  if (!disableGLLostEvent) {
    window.addEventListener('webglcontextlost', e => {
      if (isCanvasUsedByPlayer(e.target as HTMLCanvasElement)) {
        AlipayDowngradePlugin.glLostOccurred = true;
        console.error('webgl lost occur');
        if (downgradeWhenGLLost) {
          console.warn('webgl lost occur, all players will be downgraded from now on');
          disableAllPlayer(true);
          getActivePlayers().forEach(player => player.dispose());
        }
      }
    }, true);
  }

  if (autoPause) {
    document.addEventListener('pause', pauseAllActivePlayers);
    document.addEventListener('resume', resumePausedPlayers);
  }

  registered = true;
  void getDeviceName();
}

/**
 *
 * @returns
 */
export function getAlipayDowngradeBizId () {
  return AlipayDowngradePlugin.currentBizId;
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

export const version = __VERSION__;

logger.info('plugin alipay downgrade version: ' + version);
