import type { GLType, MessageItem, Region } from '@galacean/effects-core';

/**
 * player 创建的构造参数
 */
export interface PlayerConfig {
  /**
   * 播放器的容器，会在容器中创建 canvas，container 和 canvas 必传一个
   */
  container?: HTMLElement | null,
  /**
   * 指定 canvas 进行播放
   */
  canvas?: HTMLCanvasElement,
  /**
   * 画布比例，尽量使用默认值，如果不够清晰，可以写2，但是可能产生渲染卡顿
   */
  pixelRatio?: number | 'auto',
  /**
   * 播放器是否可交互
   */
  interactive?: boolean,
  /**
   * canvas 是否透明，如果不透明可以略微提升性能
   * @default true
   */
  transparentBackground?: boolean,
  /**
   * 渲染帧数
   * @default 60
   */
  fps?: number,
  /**
   * 是否停止计时器，否手动渲染
   * @default false
   */
  manualRender?: boolean,
  /**
   * 播放合成的环境
   * @default '' - 编辑器中为 'editor'
   */
  env?: string,
  /**
   * 指定 WebGL 创建的上下文类型，`debug-disable` 表示不创建
   */
  renderFramework?: GLType | 'debug-disable',
  /**
   * player 的 name
   */
  name?: string,
  /**
   * 渲染选项，传递给 WebGLRenderingContext 实例化的 WebGLContextAttributes 参数
   */
  renderOptions?: {
    /**
     * 播放器是否需要截图（对应 WebGL 的 preserveDrawingBuffer 参数）
     */
    willCaptureImage?: boolean,
    /**
     * 图片预乘 Alpha
     * @default false
     */
    premultipliedAlpha?: boolean,
  },
  /**
   * 是否通知 container touchend / mouseup 事件, 默认不通知
   */
  notifyTouch?: boolean,
  // createRenderNode?: (model: Object) => any,
  /**
   * 每帧渲染调用后的回调，WebGL2 上下文生效
   * @param time - GPU 渲染使用的时间，秒
   */
  reportGPUTime?: (time: number) => void,
}

/**
 * 播放器事件
 */
export type PlayerEvent<P> = {
  /**
   * 播放器点击事件
   */
  ['click']: [clickInfo: Region & {
    player: P,
    compositionId: string,
    compositionName: string,
  }],
  /**
   * 播放器消息事件（合成中元素创建/销毁时触发）
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
