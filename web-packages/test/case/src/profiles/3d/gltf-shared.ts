import type { spec } from '@galacean/effects';

export function copySceneCamera (fromScene: spec.JSONScene, toScene: spec.JSONScene) {
  const fromCamera = fromScene.compositions[0].camera;
  const toCamera = toScene.compositions[0].camera;
  let fromCameraItem: spec.VFXItemData | undefined;
  let toCameraItem: spec.VFXItemData | undefined;

  toCamera.fov = fromCamera.fov;
  toCamera.far = fromCamera.far;
  toCamera.near = fromCamera.near;
  // @ts-expect-error
  toCamera.position = fromCamera.position?.slice();
  // @ts-expect-error
  toCamera.rotation = fromCamera.rotation?.slice() ?? [0, 0, 0];
  toCamera.clipMode = fromCamera.clipMode;

  fromScene.items.forEach(item => {
    // @ts-expect-error
    if (item.type === 'camera') {
      fromCameraItem = item;
    }
  });

  toScene.items.forEach(item => {
    // @ts-expect-error
    if (item.type === 'camera') {
      toCameraItem = item;
    }
  });

  if (
    toCameraItem === undefined ||
    fromCameraItem === undefined ||
    toCameraItem.transform === undefined ||
    fromCameraItem.transform === undefined
  ) {
    return;
  }

  toCameraItem.transform.position = {
    x: fromCameraItem.transform.position.x,
    y: fromCameraItem.transform.position.y,
    z: fromCameraItem.transform.position.z,
  };
  toCameraItem.transform.scale = {
    x: fromCameraItem.transform.scale.x,
    y: fromCameraItem.transform.scale.y,
    z: fromCameraItem.transform.scale.z,
  };
  toCameraItem.transform.eulerHint = {
    x: fromCameraItem.transform.eulerHint.x,
    y: fromCameraItem.transform.eulerHint.y,
    z: fromCameraItem.transform.eulerHint.z,
  };
}
