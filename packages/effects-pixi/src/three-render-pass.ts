import type {
  Texture, RenderPassOptions, RenderPassAttachmentOptions,
  RenderPassDepthStencilAttachment, RenderPassDestroyOptions,
  spec,
} from '@galacean/effects-core';
import { RenderPass } from '@galacean/effects-core';

/**
 * THREE RenderPass 抽象类的实现（滤镜元素需要实现）
 */
export class ThreeRenderPass extends RenderPass {

  /**
   * 构造函数
   * @param options - 设置 RenderPass 的参数选项
   */
  constructor (renderer: any, options: RenderPassOptions) {
    super(renderer, options);
  }

  /**
   * 重置颜色附件
   * @param colors - 颜色附件数组
   */
  override resetColorAttachments (colors: Texture[]) {

  }

  /**
   * 重置所有附件
   * @param options - 返回渲染目标附件的选项
   */
  override resetAttachments (options: RenderPassAttachmentOptions) {

  }

  /**
   * 获取视口
   * @returns vec4 类型的值，表示视口的左上角 x 和 y 坐标以及宽度和高度
   */
  override getViewport (): spec.vec4 {
    return [0, 0, 0, 0];
  }

  /**
   * 获取深度附件
   * @returns 返回深度附件信息
   */
  override getDepthAttachment (): RenderPassDepthStencilAttachment | undefined {
    return;
  }

  /**
   * 获取模板附件
   * @returns 返回模板附件信息
   */
  override getStencilAttachment (): RenderPassDepthStencilAttachment | undefined {
    return;
  }

  /**
   * 销毁渲染目标及其所有附件
   * @param options - 销毁渲染目标的选项
   */
  override dispose (options?: RenderPassDestroyOptions) {

  }
}

