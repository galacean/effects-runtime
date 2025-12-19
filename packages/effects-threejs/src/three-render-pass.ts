import type { RenderPassDestroyOptions, spec } from '@galacean/effects-core';
import { RenderPass } from '@galacean/effects-core';

/**
 * THREE RenderPass 抽象类的实现（滤镜元素需要实现）
 */
export class ThreeRenderPass extends RenderPass {

  /**
   * 构造函数
   * @param options - 设置 RenderPass 的参数选项
   */
  constructor (renderer: any) {
    super(renderer);
  }

  /**
   * 获取视口
   * @returns vec4 类型的值，表示视口的左上角 x 和 y 坐标以及宽度和高度
   */
  override getViewport (): spec.vec4 {
    return [0, 0, 0, 0];
  }

  /**
   * 销毁渲染目标及其所有附件
   * @param options - 销毁渲染目标的选项
   */
  override dispose (options?: RenderPassDestroyOptions) {

  }
}

