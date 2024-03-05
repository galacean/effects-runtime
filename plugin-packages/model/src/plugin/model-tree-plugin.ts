import { AbstractPlugin } from '@galacean/effects';

/**
 * 场景树插件类，支持 3D 相关的节点动画和骨骼动画等
 */
export class ModelTreePlugin extends AbstractPlugin {
  /**
   * 插件名称
   */
  override name = 'tree';
  /**
   * 高优先级更新
   */
  override order = 2;
}

