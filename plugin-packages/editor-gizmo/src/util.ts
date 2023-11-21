
import { Texture, noop } from '@galacean/effects';
import type { Engine, spec } from '@galacean/effects';
import { vecSub, vecAdd, vecNormalize, vecMulScalar } from './math/vec';

type vec3 = spec.vec3;

/**
 * 下载图片
 * @param imageUrl - 图片url
 * @returns 图片对象
 */
export async function createImage (imageUrl: string): Promise<HTMLImageElement> {
  const image = new Image();

  image.src = imageUrl;

  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => {
      resolve(image);
    };
    image.onerror = reject;
  });
}

/**
 * 创建 Texture 对象
 * @param engine - engine 对象
 * @param image - 图片对象
 * @returns 纹理
 */
export function createTexture (engine: Engine, image: HTMLImageElement, hookDestroy?: boolean): Texture {

  const texture = Texture.create(engine, { image });

  if (hookDestroy) {
    texture.dispose = noop;
  }

  return texture;
}

/**
 * 移动到距离目标点指定距离的位置
 * @param targetPos - 目标点
 * @param currentPos - 当前点
 * @returns 指定点
 */
export function moveToPointWidthFixDistance (targetPos: vec3, currentPos: vec3): vec3 {
  const vecCameraItem: vec3 = [0, 0, 0];

  vecSub(vecCameraItem, currentPos, targetPos);
  const normalVecCameraItem = vecNormalize(vecCameraItem);
  const newPos: vec3 = [0, 0, 0];
  const scalerVecCameraItem: vec3 = [0, 0, 0];

  vecMulScalar(scalerVecCameraItem, normalVecCameraItem, 20);
  const vecScalerItem: vec3 = [0, 0, 0];
  const vecItemScaler: vec3 = [0, 0, 0];

  vecSub(vecScalerItem, vecCameraItem, scalerVecCameraItem);
  vecMulScalar(vecItemScaler, vecScalerItem, -1);
  vecAdd(newPos, currentPos, vecItemScaler);

  return newPos;
}
