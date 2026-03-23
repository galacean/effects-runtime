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
   * 销毁渲染目标及其所有附件
   * @param options - 销毁渲染目标的选项
   */
  override dispose () {

  }
}

