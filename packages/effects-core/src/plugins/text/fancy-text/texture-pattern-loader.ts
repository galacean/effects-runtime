import type { FancyRenderLayer } from './fancy-types';
import { loadImage } from '../../../downloader';

/** 图片缓存，避免同一 URL 重复网络请求 */
const imageCache = new Map<string, HTMLImageElement>();

/**
 * 加载所有 texture 层的图片并创建 CanvasPattern
 *
 * 遍历 layers 中 kind === 'texture' 且 runtimePattern 为空且 imageUrl 有值的层，
 * 异步加载图片后调用 ctx.createPattern(image, repeat) 创建 CanvasPattern，
 * 并写回 layer.runtimePattern。
 *
 * @param layers   FancyRenderLayer 数组
 * @param context  Canvas 2D 上下文，用于 createPattern
 */
export async function loadTexturePatterns (
  layers: FancyRenderLayer[],
  context: CanvasRenderingContext2D,
): Promise<void> {
  const textureLayers = layers.filter(
    (l): l is Extract<FancyRenderLayer, { kind: 'texture' }> =>
      l.kind === 'texture' && l.runtimePattern == null && !!l.params.pattern?.imageUrl,
  );

  if (textureLayers.length === 0) { return; }

  await Promise.all(textureLayers.map(async layer => {
    const { imageUrl, repeat } = layer.params.pattern;

    try {
      // 优先从缓存取
      let image = imageCache.get(imageUrl);

      if (!image) {
        image = await loadImage(imageUrl);
        imageCache.set(imageUrl, image);
      }

      // context 可能在 await 期间被回收，需再次检查
      const pattern = context.createPattern(image, repeat ?? 'repeat');

      if (pattern) {
        layer.runtimePattern = pattern;
      }
    } catch (err) {
      console.warn(`[FancyText] 纹理图片加载失败: ${imageUrl}`, err);
    }
  }));
}

/**
 * 清除图片缓存中指定 URL 或全部缓存
 *
 * @param imageUrl  如提供则只清除该 URL 的缓存，否则清除全部
 */
export function clearTextureImageCache (imageUrl?: string): void {
  if (imageUrl) {
    imageCache.delete(imageUrl);
  } else {
    imageCache.clear();
  }
}