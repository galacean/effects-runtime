import type { VFXItem } from '@galacean/effects';
import type { Euler } from '../math';
import { Matrix4, Vector2, Vector3, RayCaster } from '../math';
import { Plane } from '@galacean/effects-math/es/extension/index';

/**
 * 获取元素所在合成的相机视图投影矩阵。
 * @param item 播放器元素
 * @returns 相机视图投影矩阵
 */
function getViewProjectionMatrix (item: VFXItem) {
  const { composition } = item;

  if (!composition?.camera) {
    console.warn('The composition of the item does not have a camera, using identity matrix instead.');

    return new Matrix4();
  }

  const projectionMatrix = composition.camera.getProjectionMatrix();
  const viewMatrix = composition.camera.getViewMatrix();

  return new Matrix4().copyFrom(projectionMatrix.multiply(viewMatrix));
}

/**
 * 将世界坐标转换为视图坐标。
 * @param point 世界坐标
 * @param item 播放器元素
 * @param containerSize 视图容器大小
 * @returns 视图坐标
 */
export function projectPoint (point: Vector3, item: VFXItem, containerSize: Vector2): Vector2 {
  const projectMatrix = getViewProjectionMatrix(item);

  const viewPoint = new Vector2()
    .copyFrom(point.applyProjectionMatrix(projectMatrix).toVector2())
    .add(new Vector2(1, -1))
    .multiply(new Vector2(containerSize.x / 2, -containerSize.y / 2));

  return viewPoint;
}

/**
 * 视图坐标转 NDC 标准化坐标（范围 [-1, 1]）。
 * @param point 视图坐标
 * @param containerSize 视图容器大小
 * @returns NDC 坐标
 */
export function viewPositionToNDC (point: Vector2, containerSize: Vector2): Vector2 {
  return new Vector2(
    point.x / containerSize.x * 2 - 1,
    1 - point.y / containerSize.y * 2,
  );
}

/**
 * 视图大小转 NDC 视图大小。
 * @param viewSize 视图大小
 * @param containerSize 视图容器大小
 * @returns NDC 视图大小
 */
export function viewSizeToNDC (viewSize: Vector2, containerSize: Vector2): Vector2 {
  return new Vector2(
    (viewSize.x / containerSize.x) * 2,
    -(viewSize.y / containerSize.y) * 2
  );
}

/**
 * NDC 大小转视图大小。
 * @param ndcSize NDC 大小
 * @param containerSize 视图容器大小
 * @returns 视图大小
 */
export function ndcSizeToViewSize (ndcSize: Vector2, containerSize: Vector2): Vector2 {
  return new Vector2(
    ndcSize.x / 2 * containerSize.x,
    -ndcSize.y / 2 * containerSize.y
  );
}

/**
 * 视图坐标转世界坐标（经 NDC 构造射线并与交互平面求交）。
 * @param viewPoint 视图坐标
 * @param cameraInfo 相机信息
 * @param plane 交互平面
 * @param containerSize 视图容器大小
 * @returns 世界坐标
 */
export function viewPositionToWorld (
  viewPoint: Vector2,
  cameraInfo: { position: Vector3, matrix: Matrix4 },
  plane: Plane,
  containerSize: Vector2
): Vector3 | undefined {
  const { position, matrix: inverseViewProjectMatrix } = cameraInfo;
  const coords = viewPositionToNDC(viewPoint, containerSize);
  const rayCaster = new RayCaster().setFromCamera(coords, { position, inverseViewProjectMatrix });

  const result = rayCaster.rayCastPlane(plane);

  return result?.point;
}

/**
 * 视图尺寸对应的世界尺寸（经射线碰撞换算）。
 * @param viewSize 视图尺寸
 * @param containerSize 容器尺寸
 * @param item 播放器元素
 * @param cameraInfo 相机位置与逆视投影矩阵
 * @param plane 交互平面
 * @returns 世界尺寸
 */
export function viewSizeToWorld (viewSize: Vector2, containerSize: Vector2, item: VFXItem, cameraInfo: { position: Vector3, matrix: Matrix4 }, plane: Plane): Vector3 {
  const position = new Vector3();

  const focusViewPoint = projectPoint(position.clone(), item, containerSize);
  const startPoint = viewPositionToWorld(focusViewPoint, cameraInfo, plane, containerSize);
  const nextPoint = viewPositionToWorld(focusViewPoint.clone().add(viewSize), cameraInfo, plane, containerSize);

  if (!startPoint || !nextPoint) {
    console.warn('size is out of bounds.');

    return new Vector3(0, 0, 0);
  }

  const worldSize = nextPoint.subtract(startPoint);

  return worldSize;
}

/**
 * 世界尺寸转视图尺寸。
 * @param worldSize 世界尺寸
 * @param containerSize 视图容器大小
 * @param item 播放器元素
 * @returns 视图尺寸
 */
export function worldSizeToViewSize (worldSize: Vector2, containerSize: Vector2, item: VFXItem): Vector2 {
  const result = new Vector2();
  const camera = item.composition!.camera;

  const { z } = item.transform.getWorldPosition();
  const { x: rx, y: ry } = camera.getInverseVPRatio(z);

  result.x = Math.abs(worldSize.x * containerSize.x / rx / 2);
  result.y = Math.abs(worldSize.y * containerSize.y / ry / -2);

  return result;
}

/**
 * 视图尺寸转像素尺寸。
 * @param viewSize 视图尺寸
 * @param viewportScale 视口缩放
 * @returns 像素尺寸
 */
export function viewSizeToPixel (viewSize: Vector2, viewportScale: number): Vector2 {
  return viewSize.clone().divide(viewportScale);
}

/**
 * 视图坐标转像素坐标。
 * @param viewPosition 视图坐标（像素，左上原点）
 * @param containerSize 视图容器大小
 * @param viewportScale 视口缩放
 * @param viewportTranslation NDC 单位的视口平移
 * @returns 像素坐标
 */
export function viewPositionToPixel (viewPosition: Vector2, containerSize: Vector2, viewportScale: number, viewportTranslation: Vector2): Vector2 {
  // 先将 NDC 平移转换为像素，确保后续运算量纲一致。
  const translationInPixel = ndcSizeToViewSize(viewportTranslation, containerSize);
  const center = new Vector2(containerSize.x / 2, containerSize.y / 2);

  return viewPosition.clone()
    .subtract(translationInPixel)
    .subtract(center)
    .multiply(new Vector2(1 / viewportScale, 1 / viewportScale))
    .add(center);
}

/**
 * 构造交互平面。
 * @param position 平面位置
 * @param rotation 平面旋转
 * @returns 交互平面
 */
export function createInteractionPlane (position: Vector3, rotation: Euler) {
  const normal = new Vector3(0, 0, 1).applyEuler(rotation);
  const plane = new Plane();

  plane.setFromNormalAndCoplanarPoint(position, normal);

  return plane;
}
