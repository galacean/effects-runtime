import type { MessageItem } from './composition';
import type { Region } from './plugins';

export type PlayerEffectEvent<P> = {
  [EffectEventName.ITEM_CLICK]: [clickInfo: Region & { player: P, composition: string }],
  [EffectEventName.ITEM_MESSAGE]: [messageInfo: MessageItem],
  [EffectEventName.WEBGL_CONTEXT_LOST]: [event: Event],
  [EffectEventName.WEBGL_CONTEXT_RESTORED]: [],
  [EffectEventName.COMPOSITION_END]: [],
  [EffectEventName.PLAYER_PAUSE]: [],
  [EffectEventName.PLAYER_UPDATE]: [updateInfo: { player: P, playing: boolean }],
  [EffectEventName.RENDER_ERROR]: [error: Error | undefined],
};

export type CompositionEffectEvent<C> = {
  [EffectEventName.ITEM_CLICK]: [clickInfo: Region & {
    composition: string,
  }],
  [EffectEventName.ITEM_MESSAGE]: [messageInfo: MessageItem],
  [EffectEventName.COMPOSITION_END]: [endInfo: { composition: C }],
};

export type ItemEffectEvent = {
  [EffectEventName.ITEM_CLICK]: [region: Region],
  [EffectEventName.ITEM_MESSAGE]: [message: Omit<MessageItem, 'compositionId'>],
};

/**
 * Player、Composition、Item 可以绑定的事件
 */
export const EffectEventName = {
  /**
   * 元素点击事件
   */
  ITEM_CLICK: 'item-click',
  /**
   * 元素消息事件
   */
  ITEM_MESSAGE: 'item-message',
  /**
   * WebGL 上下文丢失事件
   * 这个时候播放器已经自动被销毁，业务需要做兜底逻辑
   */
  WEBGL_CONTEXT_LOST: 'webgl-context-lost',
  /**
   * WebGL 上下文恢复事件
   */
  WEBGL_CONTEXT_RESTORED: 'webgl-context-restored',
  /**
   * 合成结束事件
   * 合成行为为循环时每次循环结束都会触发
   * 合成行为为销毁/冻结时只会触发一次
   */
  COMPOSITION_END: 'composition-end',
  /**
   * 播放器暂停事件
   */
  PLAYER_PAUSE: 'player-pause',
  /**
   * 播放器更新事件
   */
  PLAYER_UPDATE: 'player-update',
  /**
   * 渲染错误事件
   */
  RENDER_ERROR: 'render-error',
} as const;
