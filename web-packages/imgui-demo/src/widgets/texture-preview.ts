import type { Texture } from '@galacean/effects';
import { GLEngine, GLTexture } from '@galacean/effects-webgl';
import { ImGui, ImGui_Impl } from '../imgui';

/**
 * 纹理预览：把 Galacean Texture 上传/拷贝为 imgui 可用的 WebGLTexture，并返回整图 UV（含 flipY 处理）。
 * 缓存于 texture.__imguiAssetThumb / __imguiAssetThumbFlipped，避免重复上传。
 * 从 content-browser 抽取为共享 util，供 sequencer sprite 缩略图等复用。
 */
export type TexturePreview = { tex: WebGLTexture, uv0: ImGui.Vec2, uv1: ImGui.Vec2 };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function getOrCreateTexturePreview (obj: Texture): TexturePreview | null {
  const imguiGl = ImGui_Impl.gl;

  if (!imguiGl || !(obj instanceof GLTexture)) { return null; }

  // 命中缓存（缓存了 ImGui context 的 WebGLTexture 和该纹理来源对应的翻转标记）
  const cachedTex = (obj as any).__imguiAssetThumb as WebGLTexture | undefined;

  if (cachedTex) {
    const cachedFlipped = !!(obj as any).__imguiAssetThumbFlipped;

    return {
      tex: cachedTex,
      uv0: cachedFlipped ? new ImGui.Vec2(0, 1) : new ImGui.Vec2(0, 0),
      uv1: cachedFlipped ? new ImGui.Vec2(1, 0) : new ImGui.Vec2(1, 1),
    };
  }

  const tex = imguiGl.createTexture();

  if (!tex) { return null; }
  imguiGl.bindTexture(imguiGl.TEXTURE_2D, tex);

  let uploaded = false;
  // 标记结果纹理是否处于"引擎 flipY 后"的布局，据此决定 UV 是否翻转
  let needsFlip = false;
  const src = obj.source as any;
  const srcImage = src?.image;
  const srcData = src?.data;

  // Path 1: 未初始化纹理的原始 HTMLImage / Canvas / ImageBitmap，直接上传（无需翻转 UV）
  if (
    srcImage && (
      (typeof HTMLImageElement !== 'undefined' && srcImage instanceof HTMLImageElement) ||
      (typeof HTMLCanvasElement !== 'undefined' && srcImage instanceof HTMLCanvasElement) ||
      (typeof ImageBitmap !== 'undefined' && srcImage instanceof ImageBitmap)
    )
  ) {
    imguiGl.texImage2D(imguiGl.TEXTURE_2D, 0, imguiGl.RGBA, imguiGl.RGBA, imguiGl.UNSIGNED_BYTE, srcImage);
    uploaded = true;
  } else if (srcData && srcData.data && srcData.width > 0 && srcData.height > 0) {
    // Path 2: 未初始化的 raw data 纹理（emptyTexture / whiteTexture 等内置 1x1 贴图）
    const td = srcData.data;
    const data = td instanceof Uint8ClampedArray
      ? new Uint8Array(td.buffer, td.byteOffset, td.byteLength)
      : td;

    if (data instanceof Uint8Array) {
      imguiGl.texImage2D(
        imguiGl.TEXTURE_2D, 0, imguiGl.RGBA, srcData.width, srcData.height, 0,
        imguiGl.RGBA, imguiGl.UNSIGNED_BYTE, data,
      );
      uploaded = true;
    }
  }

  // Path 3: 已初始化且 source 已被 release，只能跨 context readPixels
  if (
    !uploaded && obj.textureBuffer && obj.width > 0 && obj.height > 0 &&
    obj.engine instanceof GLEngine
  ) {
    const engineGl = obj.engine.gl;

    if (obj.target === engineGl.TEXTURE_2D) {
      const w = obj.width;
      const h = obj.height;
      const pixels = new Uint8Array(w * h * 4);
      const prevFbo = engineGl.getParameter(engineGl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
      const fbo = engineGl.createFramebuffer();

      if (fbo) {
        engineGl.bindFramebuffer(engineGl.FRAMEBUFFER, fbo);
        engineGl.framebufferTexture2D(
          engineGl.FRAMEBUFFER, engineGl.COLOR_ATTACHMENT0,
          engineGl.TEXTURE_2D, obj.textureBuffer, 0,
        );
        if (engineGl.checkFramebufferStatus(engineGl.FRAMEBUFFER) === engineGl.FRAMEBUFFER_COMPLETE) {
          engineGl.readPixels(0, 0, w, h, engineGl.RGBA, engineGl.UNSIGNED_BYTE, pixels);
          imguiGl.bindTexture(imguiGl.TEXTURE_2D, tex);
          imguiGl.texImage2D(
            imguiGl.TEXTURE_2D, 0, imguiGl.RGBA, w, h, 0,
            imguiGl.RGBA, imguiGl.UNSIGNED_BYTE, pixels,
          );
          uploaded = true;
          // 引擎上传时若 flipY=true，GPU 布局相对原图是翻转的，ImGui 默认 UV 会上下颠倒
          needsFlip = !!src?.flipY;
        }
        engineGl.bindFramebuffer(engineGl.FRAMEBUFFER, prevFbo);
        engineGl.deleteFramebuffer(fbo);
      }
    }
  }

  if (!uploaded) {
    imguiGl.deleteTexture(tex);

    return null;
  }

  imguiGl.texParameteri(imguiGl.TEXTURE_2D, imguiGl.TEXTURE_MIN_FILTER, imguiGl.LINEAR);
  imguiGl.texParameteri(imguiGl.TEXTURE_2D, imguiGl.TEXTURE_MAG_FILTER, imguiGl.LINEAR);
  imguiGl.texParameteri(imguiGl.TEXTURE_2D, imguiGl.TEXTURE_WRAP_S, imguiGl.CLAMP_TO_EDGE);
  imguiGl.texParameteri(imguiGl.TEXTURE_2D, imguiGl.TEXTURE_WRAP_T, imguiGl.CLAMP_TO_EDGE);

  (obj as any).__imguiAssetThumb = tex;
  (obj as any).__imguiAssetThumbFlipped = needsFlip;

  return {
    tex,
    uv0: needsFlip ? new ImGui.Vec2(0, 1) : new ImGui.Vec2(0, 0),
    uv1: needsFlip ? new ImGui.Vec2(1, 0) : new ImGui.Vec2(1, 1),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
