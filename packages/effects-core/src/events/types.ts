import type { MessageItem } from '../composition';
import type { Region } from '../plugins';

/**
 * Item 可以绑定的事件
 */
export type ItemEvent = {
  /**
   * 元素点击事件
   */
  ['click']: [region: Region],
  /**
   * 元素消息事件（元素创建/销毁时触发）
   */
  ['message']: [message: Omit<MessageItem, 'compositionId'>],
};

/**
 * Composition 可以绑定的事件
 */
export type CompositionEvent<C> = {
  /**
   * 合成点击事件
   */
  ['click']: [clickInfo: Region & {
    compositionName: string,
    compositionId: string,
  }],
  // ['message']: [messageInfo: MessageItem],
  /**
   * 合成结束事件
   * 合成行为为循环时每次循环结束都会触发
   * 合成行为为销毁/冻结时只会触发一次
   */
  ['end']: [endInfo: { composition: C }],
  /**
   * 时间跳转事件
   * 用于在合成中跳转到指定时间
   */
  ['goto']: [gotoInfo: { time: number }],
};

/**
 * Renderer 可以绑定的事件
 */
export type RendererEvent = {
  /**
   * Renderer resize 事件
   */
  ['resize']: [],
};
