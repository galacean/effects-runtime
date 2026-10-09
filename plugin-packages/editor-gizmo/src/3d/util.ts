import { Texture, noop } from '@galacean/effects';
import type { Engine, math } from '@galacean/effects';

type Vector3 = math.Vector3;

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
export function moveToPointWidthFixDistance (targetPos: Vector3, currentPos: Vector3): Vector3 {
  const vecCameraItem = currentPos.clone().subtract(targetPos);

  const normalVecCameraItem = vecCameraItem.clone().normalize();
  const scalerVecCameraItem = normalVecCameraItem.clone().multiply(20);

  const vecScalerItem = vecCameraItem.clone().subtract(scalerVecCameraItem);
  const vecItemScaler = vecScalerItem.clone().multiply(-1);

  return currentPos.clone().add(vecItemScaler);
}
