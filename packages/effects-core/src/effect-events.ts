import type { MessageItem } from './composition';
import type { Region } from './plugins';

export type PlayerEffectEvent<P> = {
  [PlayerEffectEventName.ITEM_CLICK]: [clickInfo: Region & { player: P, composition: string }],
  [PlayerEffectEventName.ITEM_MESSAGE]: [messageInfo: MessageItem],
  [PlayerEffectEventName.WEBGL_CONTEXT_LOST]: [event: Event],
  [PlayerEffectEventName.WEBGL_CONTEXT_RESTORED]: [],
  [PlayerEffectEventName.COMPOSITION_END]: [],
  [PlayerEffectEventName.PLAYER_PAUSE]: [],
  [PlayerEffectEventName.PLAYER_UPDATE]: [updateInfo: { player: P, playing: boolean }],
  [PlayerEffectEventName.RENDER_ERROR]: [error: Error | undefined],
};

/**
 * Player 可以绑定的事件
 */
export const PlayerEffectEventName = {
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

export type CompositionEffectEvent<C> = {
  [CompositionEffectEventName.ITEM_MESSAGE]: [messageInfo: MessageItem],
  [CompositionEffectEventName.COMPOSITION_END]: [endInfo: { composition: C }],
};

/**
 * Composition 可以绑定的事件
 */
export const CompositionEffectEventName = {
  /**
   * 元素消息事件
   */
  ITEM_MESSAGE: 'item-message',
  /**
   * 合成结束事件
   * 合成行为为循环时每次循环结束都会触发
   * 合成行为为销毁/冻结时只会触发一次
   */
  COMPOSITION_END: 'composition-end',
} as const;

export type ItemEffectEvent = {
  [ItemEffectEventName.ITEM_CLICK]: [region: Region],
  [ItemEffectEventName.ITEM_MESSAGE]: [message: Omit<MessageItem, 'compositionId'>],
};

/**
 * Item 可以绑定的事件
 */
export const ItemEffectEventName = {
  /**
   * 元素点击事件
   */
  ITEM_CLICK: 'item-click',
  /**
   * 元素消息事件
   */
  ITEM_MESSAGE: 'item-message',
} as const;
