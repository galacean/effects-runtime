import type { Engine, GPUFramebuffer } from '@galacean/effects';
import { RenderPassAttachmentStorageType, Texture, TextureSourceType, TextureStoreAction, glContext } from '@galacean/effects';
import { RenderingDeviceWebGL } from '@galacean/effects-webgl';

/** Keeps the scene's logical surface independent of the shared presentation canvas. */
export class EditorRenderingDevice extends RenderingDeviceWebGL {
  private sceneTarget?: GPUFramebuffer;

  static forSurface (engine: Engine, surface: HTMLCanvasElement): EditorRenderingDevice {
    const sceneCanvas = engine.canvas;

    // The backend acquires its context here; sizing and input continue to use the scene canvas.
    engine.canvas = surface;
    try { return new EditorRenderingDevice(engine); } finally { engine.canvas = sceneCanvas; }
  }

  override getWidth (): number { return this.engine.canvas.width; }
  override getHeight (): number { return this.engine.canvas.height; }

  get sceneTexture (): Texture | undefined {
    const texture = this.sceneTarget?.getColorTextures()[0];

    return texture && !texture.isDestroyed ? texture : undefined;
  }

  isSceneTexture (texture: Texture): boolean { return this.sceneTarget?.getColorTextures().includes(texture) ?? false; }

  prepareFrame (): void {
    this.gl.bindVertexArray(null); this.gl.activeTexture(this.gl.TEXTURE0);
    this.reset(); this.setScissorTest(false);
  }

  override bindSystemFramebuffer (): void {
    const width = Math.max(1, this.getWidth()), height = Math.max(1, this.getHeight());

    if (!this.sceneTarget) {
      const color = Texture.create(this.engine, {
        name: 'SceneViewportColor', sourceType: TextureSourceType.framebuffer,
        data: { width, height }, minFilter: glContext.LINEAR, magFilter: glContext.LINEAR,
        wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE,
      });

      this.sceneTarget = this.createFramebuffer({
        name: 'SceneViewport', attachments: [color], viewport: [0, 0, width, height],
        depthStencilAttachment: { storageType: RenderPassAttachmentStorageType.depth_stencil_opaque },
        storeAction: { colorAction: TextureStoreAction.store },
      });
      this.sceneTarget.initialize();
    }
    this.sceneTarget.resize(0, 0, width, height);
    this.sceneTarget.bind();
  }

  override dispose (): void {
    this.sceneTarget?.dispose(); this.sceneTarget = undefined;
    super.dispose();
  }
}
