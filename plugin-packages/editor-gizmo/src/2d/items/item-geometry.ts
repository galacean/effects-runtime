import { FrameComponent, spec, type VFXItem } from '@galacean/effects';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import type { Matrix3 } from '../math';
import { Euler, EulerOrder, Matrix4, Quaternion, Vector2, Vector3, getBoxTransform, getBoxTransformFromBox, getTransformedBox } from '../math';
import { projectPoint, worldSizeToViewSize } from '../viewport/coordinates';
import { isFramePlayerItem } from './item-predicates';

/**
 * 获取元素用于编辑的视图 Box2。
 * @param item 播放器元素
 * @param containerSize 视图大小
 * @returns 视图坐标系中的轴对齐包围盒
 */
export function getItemViewBox (item: VFXItem, containerSize: Vector2): Box2 {
  const transform = getItemViewTransform(item, containerSize);

  return transform ? getTransformedBox(transform) : new Box2();
}

/**
 * 获取归一化 Box2 到元素视图坐标的变换。
 * @param item 播放器元素
 * @param containerSize 视图大小
 * @returns 有效变换；元素不可见或没有有效矩形时返回 undefined
 */
export function getItemViewTransform (item: VFXItem, containerSize: Vector2): Matrix3 | undefined {
  if (!item.isVisible || !supportsRect(item)) {
    return undefined;
  }

  const hasFrameComponent = !!item.getComponent(FrameComponent);
  let viewTransform: Matrix3 | undefined;

  if (item.type !== spec.ItemType.null || hasFrameComponent) {
    const { transform, composition } = item;

    transform.updateLocalMatrix();
    const { x, y } = transform.size.clone().divide(2);
    const compositionMatrix = new Matrix4()
      .copyFrom(composition?.transform.getWorldMatrix() ?? new Matrix4())
      .invert();
    const itemWorldMatrix = compositionMatrix.multiply(transform.getWorldMatrix());

    viewTransform = getBoxTransform([
      new Vector3(-x, y, 0),
      new Vector3(x, y, 0),
      new Vector3(x, -y, 0),
      new Vector3(-x, -y, 0),
    ].map(point => projectPoint(point.applyMatrix(itemWorldMatrix), item, containerSize)));
  }

  if (hasFrameComponent) {
    return viewTransform;
  }

  const box = viewTransform ? getTransformedBox(viewTransform) : new Box2();
  let hasChildBox = false;

  for (const child of item.children ?? []) {
    const childBox = getItemViewBox(child, containerSize);

    if (!childBox.isEmpty()) {
      box.union(childBox);
      hasChildBox = true;
    }
  }

  return hasChildBox ? getBoxTransformFromBox(box) : viewTransform;
}

/** @returns 元素类型是否提供矩形编辑几何。 */
function supportsRect (item: VFXItem): boolean {
  return item.type === spec.ItemType.sprite
    || item.type === spec.ItemType.plugin
    || item.type === spec.ItemType.video
    || item.type === spec.ItemType.richtext
    || item.type === spec.ItemType.text
    || item.type === spec.ItemType.null
    || item.type === spec.ItemType.shape;
}

/**
 * 获取播放器元素在视图中的锚点坐标。
 * @param item 播放器元素
 * @param containerSize 视图容器大小
 * @returns 视图锚点坐标
 */
export function getItemViewAnchor (item: VFXItem, containerSize: Vector2): Vector2 {
  const anchor = item.transform.anchor ?? item.transform.position;

  const worldAnchor = new Vector3().copyFrom(anchor).applyMatrix(new Matrix4().copyFrom(item.transform.getWorldMatrix()));
  const viewAnchor = projectPoint(worldAnchor, item, containerSize).multiply(100).round().divide(100);

  return viewAnchor;
}

/**
 * 获取元素的变换矩阵和父级变换矩阵。
 * @param item 播放器元素
 * @returns 元素的变换矩阵和父级变换矩阵
 */
export function getItemTransform (item: VFXItem): { matrix: Matrix4, parentMatrix: Matrix4 } {
  const transform = {
    matrix: new Matrix4(),
    parentMatrix: new Matrix4(),
  };

  if (item.transform !== undefined) {
    item.transform.updateLocalMatrix();
    transform.matrix.copyFrom(item.transform.getWorldMatrix());
    transform.parentMatrix.copyFrom(item.transform.parentTransform?.getWorldMatrix() ?? new Matrix4());
  }

  return transform;
}

/** 元素的世界分解变换。 */
export type DecomposedItemTransform = {
  /** 元素的世界矩阵。 */
  matrix: Matrix4,
  /** 父元素的世界矩阵。 */
  parentMatrix: Matrix4,
  /** 元素的世界位置。 */
  position: Vector3,
  /** 元素的世界旋转。 */
  rotation: Euler,
  /** 元素的世界缩放。 */
  scale: Vector3,
};

/**
 * 获取元素的世界变换。
 * @param item 播放器元素
 * @returns 分解后的世界变换
 */
export function decomposeItemTransform (item: VFXItem): DecomposedItemTransform {
  const { matrix, parentMatrix } = getItemTransform(item);
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();

  item.transform.assignWorldTRS(position, quaternion, scale);

  return {
    matrix,
    parentMatrix,
    position,
    rotation: new Euler(0, 0, 0, EulerOrder.XYZ).setFromQuaternion(quaternion),
    scale,
  };
}

/**
 * 获取播放器元素在视图中的尺寸。
 * @param item 播放器元素
 * @param containerSize 视图容器大小
 * @returns 视图尺寸
 */
export function getItemViewSize (item: VFXItem, containerSize: Vector2): Vector2 {
  if (isFramePlayerItem(item)) {
    return worldSizeToViewSize(getItemWorldSize(item), containerSize, item);
  } else {
    return getItemViewBox(item, containerSize).getSize();
  }
}

/**
 * 获取元素在所属合成坐标系中的实际世界尺寸。
 *
 * `transform.size` 是元素本地尺寸；这里叠加元素到合成根之间的缩放，
 * 但排除合成本身的世界变换，与 Frame 尺寸写回使用的坐标系保持一致。
 * @param item 播放器元素
 * @returns 元素在所属合成坐标系中的尺寸
 */
export function getItemWorldSize (item: VFXItem): Vector2 {
  const { transform, composition } = item;

  transform.updateLocalMatrix();

  const compositionWorldInverse = new Matrix4()
    .copyFrom(composition?.transform.getWorldMatrix() ?? new Matrix4())
    .invert();
  const itemToComposition = compositionWorldInverse.multiply(transform.getWorldMatrix());
  const worldScale = new Vector3();

  itemToComposition.decompose(new Vector3(), new Quaternion(), worldScale);

  return new Vector2(
    Math.abs(transform.size.x * worldScale.x),
    Math.abs(transform.size.y * worldScale.y),
  );
}
