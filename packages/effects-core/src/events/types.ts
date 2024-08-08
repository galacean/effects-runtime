import type { MessageItem } from '../composition';
import type { Region } from '../plugins';

/**
 * Item 可以绑定的事件
 */
export type ItemEffectEvent = {
  /**
   * 元素点击事件
   */
  ['click']: [region: Region],
  /**
   * 元素消息事件
   */
  ['message']: [message: Omit<MessageItem, 'compositionId'>],
};

/**
 * Compositio 可以绑定的事件
 */
export type CompositionEffectEvent<C> = {
  /**
   * 合成点击事件
   */
  ['click']: [clickInfo: Region & {
    composition: string,
  }],
  // ['message']: [messageInfo: MessageItem],
  /**
   * 合成结束事件
   * 合成行为为循环时每次循环结束都会触发
   * 合成行为为销毁/冻结时只会触发一次
   */
  ['end']: [endInfo: { composition: C }],
};

export type PlayerEffectEvent<P> = {
  /**
   * 播放器点击事件
   */
  ['click']: [clickInfo: Region & { player: P, composition: string }],
  /**
   * 播放器消息事件
   */
  ['message']: [messageInfo: MessageItem],
  /**
   * 播放器暂停事件
   */
  ['pause']: [],
  /**
   * 播放器更新事件
   */
  ['update']: [updateInfo: { player: P, playing: boolean }],
  /**
   * WebGL 上下文丢失事件
   * 这个时候播放器已经自动被销毁，业务需要做兜底逻辑
   */
  ['webglcontextlost']: [event: Event],
  /**
   * WebGL 上下文恢复事件
   */
  ['webglcontextrestored']: [],
  /**
   * 渲染错误事件
   */
  ['rendererror']: [error?: Error],
};
