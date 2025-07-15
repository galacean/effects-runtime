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
  /**
   * 每帧渲染调用后的回调，WebGL2 上下文生效
   * @param time - GPU 渲染使用的时间，秒
   */
  reportGPUTime?: (time: number) => void,

  /**
   * 可捕获异常的时机：
   * 1. 初始化 `Player` 遇到异常（包含 `webglcontextlost` 事件）
   * 2. `loadScene` 运行时异常（包含资源加载失败以及 `rendererror` 异常等）
   * 3. 非以上两种情况，请自行 `try/catch` 捕获
   *
   * ```
   * 注意：
   * - 如果使用 `onError` 回调捕获异常，则以上两种时机无需再用 `try/catch` 捕获
   * - 如果不使用 `onError` 回调，则以上两种时机务必需要自行用 `try/catch` 捕获异常
   * ```
   *
   * @example
   * ``` ts
   * // 可以直接补充降级逻辑
   * new Player({
   *   // ...
   *   onError: (err, ...args) => {
   *     // 降级逻辑
   *   },
   * });
   * ```
   * @example
   * ``` ts
   * // 也可以精细化判断
   * new Player({
   *   // ...
   *   onError: (err, ...args) => {
   *     switch (err.cause) {
   *       case 'webgliniterror':
   *         // WebGL 初始化失败或者 Player 已经被销毁
   *         break;
   *       case 'rendererror':
   *         // 运行时渲染错误
   *         break;
   *       case 'webglcontextlost': {
   *         // WebGL 上下文丢失
   *         console.info(args); // WebGLContextEvent 对象
   *
   *         break;
   *       }
   *       default: {
   *         // 其他未知异常（如：创建播放器传入的容器不是 `HTMLElement` 时抛出错误）
   *         console.error(err.message);
   *
   *         break;
   *       }
   *     }
   *   },
   * });
   * ```
   * @since 2.3.0
   * @param e
   * @param args
   * @returns
   */
  onError?: (e: Error, ...args: any) => void,
}

/**
 * 播放器错误原因
 */
export type PlayerErrorCause =
  /**
   * 渲染错误
   */
  | 'rendererror'
  /**
   * WebGL 初始化失败或者 Player 已经被销毁
   */
  | 'webgliniterror'
  /**
   * WebGL 上下文丢失事件
   * 这个时候播放器已经自动被销毁，业务需要做兜底逻辑
   */
  | 'webglcontextlost'
  /**
   * 未知错误
   */
  | 'unknown'
  ;

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
   * 播放器播放事件
   */
  ['play']: [playInfo: { time: number }],
  /**
   * 播放器暂停事件
   */
  ['pause']: [],
  /**
   * 播放器恢复事件
   */
  ['resume']: [],
  /**
   * 播放器更新事件
   */
  ['update']: [updateInfo: { player: P, playing: boolean }],
  /**
   * WebGL 上下文丢失事件
   * 这个时候播放器已经自动被销毁，业务需要做兜底逻辑
   * @deprecated 2.3.0 use `onError` instead
   */
  ['webglcontextlost']: [event: Event],
  /**
   * WebGL 上下文恢复事件
   */
  ['webglcontextrestored']: [],
  /**
   * 渲染错误事件
   * @deprecated 2.3.0 use `onError` instead
   */
  ['rendererror']: [error?: Error],
};
