import { RectTransform } from '../rect-transform';
import { CanvasItem } from './canvas-item';

/**
 * 锚点布局组件
 *
 * `Control extends CanvasItem`。CanvasItem 仅承担绘制与节点层级，Control 在挂到 VFXItem 时把
 * `item.transform` 升级为 {@link RectTransform}。
 *
 * 布局完全由 RectTransform 自治:父子节点关系沿 `Transform.parentTransform / children` 走，
 * 父节点 size 变化时通过 `RectTransform.sizeChanged()` 直接调用子节点 sizeChanged 链式传播。
 * Control 本身不持有任何与布局相关的状态
 */
export class Control extends CanvasItem {
  /**
   * 在挂到 VFXItem 时确保 `item.transform` 是 `RectTransform`。
   * 既有 Transform 状态(position / rotation / scale / size / anchor 等)通过 `RectTransform.fromTransform` 复制
   */
  override onAwake (): void {
    const item = this.item;

    if (!(item.transform instanceof RectTransform)) {
      item.transform = RectTransform.fromTransform(item.transform);
    }
  }
}
