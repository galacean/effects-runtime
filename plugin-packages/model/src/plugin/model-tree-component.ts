import type { Engine } from '@galacean/effects';
import { Behaviour, effectsClass, spec } from '@galacean/effects';
import type { ModelTreeContent } from '../index';

/**
 * 插件场景树组件类，实现 3D 场景树功能
 *
 * FIXME: 有些发布的新JSON包含TreeComponent，这里做兼容处理，否则会报错
 * @since 2.0.0
 */
@effectsClass(spec.DataType.TreeComponent)
export class ModelTreeComponent extends Behaviour {
  /**
   * 参数
   */
  options?: ModelTreeContent;

  /**
   * 构造函数，创建节点树元素
   * @param engine
   * @param options
   */
  constructor (engine: Engine, options?: ModelTreeContent) {
    super(engine);
    if (options) {
      this.fromData(options);
    }
  }

  /**
   * 反序列化，保存入参和创建节点树元素
   * @param options
   */
  override fromData (options: ModelTreeContent): void {
    super.fromData(options);
    this.options = options;
  }
}
