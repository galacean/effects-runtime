import { logger } from '@galacean/effects-core';
import type { Player } from './player';
import { HELP_LINK } from './constants';

const playerMap = new Map<HTMLCanvasElement, Player>();

/**
 * 判断指定的 canvas 是否有播放器正在使用
 * @param canvas - 指定的 canvas
 * @returns
 */
export function isCanvasUsedByPlayer (canvas: HTMLCanvasElement) {
  return playerMap.has(canvas);
}

/**
 * 获取 canvas 对应的播放器
 * @param canvas - 指定的 canvas
 * @returns
 */
export function getPlayerByCanvas (canvas: HTMLCanvasElement) {
  return playerMap.get(canvas);
}

/**
 * 获取使用中的播放器
 * @returns
 */
export function getActivePlayers () {
  return Array.from(playerMap.values());
}

/**
 * 同时允许的播放器数量超过 1 时打印错误
 */
function assertNoConcurrentPlayers () {
  const runningPlayers = [];

  for (const player of playerMap.values()) {
    if (!player.paused) {
      runningPlayers.push(player);
    }
  }

  if (runningPlayers.length > 1) {
    logger.error(`Current running player count: ${runningPlayers.length}, see ${HELP_LINK['Current running player count']}.`, runningPlayers);
  }
}

export {
  playerMap,
  assertNoConcurrentPlayers,
};
