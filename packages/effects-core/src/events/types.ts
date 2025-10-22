import type { MessageItem } from '../composition';
import type { PointerEventData, Region } from '../plugins';

/**
 * Item 可以绑定的事件
 */
export type ItemEvent = {
  /**
   * 元素点击事件（编辑器设置交互行为“消息通知”）
   */
  ['click']: [region: Region],
  /**
   * 元素按下事件
   */
  ['pointerdown']: [eventData: PointerEventData],
  /**
   * 元素抬起事件
   */
  ['pointerup']: [eventData: PointerEventData],
  /**
   * 元素移动事件
   */
  ['pointermove']: [eventData: PointerEventData],
  /**
   * 元素消息事件（元素创建/销毁时触发）
   * 注意：仅对交互元素有效
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
    /**
     * @deprecated 2.7.0
     */
    compositionName: string,
    /**
     * @deprecated 2.7.0
     */
    compositionId: string,
  }],
  /**
   * 合成按下事件
   */
  ['pointerdown']: [eventData: PointerEventData],
  /**
   * 合成抬起事件
   */
  ['pointerup']: [eventData: PointerEventData],
  /**
   * 合成移动事件
   */
  ['pointermove']: [eventData: PointerEventData],
  /**
   * 合成开始播放事件
   * @since 2.6.0
   */
  ['play']: [playInfo: { time: number }],
  /**
   * 合成暂停事件
   * @since 2.6.0
   */
  ['pause']: [],
  /**
   * 合成结束事件
   * 合成行为为循环时每次循环结束都会触发
   * 合成行为为销毁/冻结时只会触发一次
   */
  ['end']: [endInfo: {
    /**
     * @deprecated 2.7.0
     */
    composition: C,
  }],
  /**
   * 时间跳转事件
   * 用于在合成中跳转到指定时间
   */
  ['goto']: [gotoInfo: { time: number }],
};
