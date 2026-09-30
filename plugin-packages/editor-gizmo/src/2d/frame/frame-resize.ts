import type { VFXItem } from '@galacean/effects';
import { Matrix4, type Vector2, Vector3 } from '../math';
import { getItemWorldSize } from '../items/item-geometry';
import { isFramePlayerItem } from '../items/item-predicates';

/**
 * 调整画板元素（Frame）的尺寸与位置，并同步其子合成 Item 的位移。
 * @param frameItem 画板元素（Frame 空节点控制器）
 * @param worldSize 目标世界尺寸（所属合成坐标系，不受 viewport zoom 影响）
 * @param translation 位移
 * @param initialSize pointer down 时冻结的本地 / 世界尺寸；传入后允许尺寸连续经过 0 并变为负值
 */
export function resizeFrameItem (
  frameItem: VFXItem,
  worldSize: Vector2,
  translation: Vector3,
  initialSize?: { localSize: Vector2, worldSize: Vector2 },
) {
  if (!isFramePlayerItem(frameItem)) {
    console.warn(`Item ${frameItem.getInstanceId()} is not a frame item.`);

    return;
  }

  // 1. 根据本地尺寸与世界尺寸的比例写回画板尺寸。
  const currentWorldSize = initialSize?.worldSize ?? getItemWorldSize(frameItem);
  const currentLocalSize = initialSize?.localSize ?? frameItem.transform.size;
  const localWidth = currentWorldSize.x === 0
    ? worldSize.x
    : currentLocalSize.x * worldSize.x / currentWorldSize.x;
  const localHeight = currentWorldSize.y === 0
    ? worldSize.y
    : currentLocalSize.y * worldSize.y / currentWorldSize.y;

  frameItem.transform.setSize(localWidth, localHeight);

  // 2. 将交互位移应用到画板。
  if (translation && (translation.x !== 0 || translation.y !== 0)) {
    const currentPosition = frameItem.transform.position;

    frameItem.setPosition(
      currentPosition.x + translation.x,
      currentPosition.y + translation.y,
      currentPosition.z
    );
  }

  // 3. 反向补偿子合成元素，保持其世界位置不变。
  const subCompositionItem = frameItem?.children?.[0];

  if (subCompositionItem && translation) {
    subCompositionItem.children.forEach(item => {
      const parentMatrix = new Matrix4().copyFrom(item.transform.getParentMatrix() ?? new Matrix4());

      parentMatrix.setPosition(new Vector3());
      const result = translation.clone().applyMatrix(parentMatrix.invert()).negate();

      item.translate(...result.toArray());
      item.transform.updateLocalMatrix();
    });
  }
}
