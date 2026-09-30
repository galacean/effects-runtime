import type { Engine } from '@galacean/effects';
import { Matrix4, Quaternion, Vector2, Vector3 } from '../math';

/**
 * 缩放视图。
 * @param engine 引擎
 * @param zoom 缩放值
 * @param center 缩放中心
 */
export function zoomView (engine: Engine, zoom: number, center: Vector2 = new Vector2()) {
  const composition = engine.sceneServer.compositions[0];

  if (!composition) {
    return;
  }

  const { camera } = composition;
  const scale = camera.getViewportMatrix().elements[0];
  const translation = new Vector2(camera.getViewportMatrix().elements[12], camera.getViewportMatrix().elements[13]);

  const result = scale + zoom;

  // 1. 反算缩放中心对应的世界坐标。
  const worldX = (center.x - translation.x) / scale;
  const worldY = (center.y - translation.y) / scale;

  // 2. 调整平移，使缩放中心在屏幕上的位置保持不变。
  const newNDCTranslation = new Vector2(
    center.x - worldX * result,
    center.y - worldY * result,
  );

  const viewportMatrix = new Matrix4().compose(
    new Vector3(newNDCTranslation.x, newNDCTranslation.y, 0),
    new Quaternion(),
    new Vector3(result, result, 1)
  );

  composition.camera.setViewportMatrix(viewportMatrix);
}

/**
 * 平移视图。
 * @param engine 引擎
 * @param translation 位移值
 */
export function panView (engine: Engine, translation: Vector2,) {
  const composition = engine.sceneServer.compositions[0];

  if (!composition) {
    return;
  }
  const { camera } = composition;
  const scale = camera.getViewportMatrix().elements[0];
  const resultTranslation = new Vector2(camera.getViewportMatrix().elements[12], camera.getViewportMatrix().elements[13]).add(translation);

  const viewportMatrix = new Matrix4().compose(
    new Vector3(resultTranslation.x, resultTranslation.y, 0),
    new Quaternion(),
    new Vector3(scale, scale, 1)
  );

  camera.setViewportMatrix(viewportMatrix);
}
