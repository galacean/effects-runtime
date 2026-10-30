import type { Engine, TextureSourceOptions } from '@galacean/effects';
import { Texture, TextureSourceType, glContext } from '@galacean/effects';
import { RenderingDeviceWebGL, type GPUTextureWebGL } from '@galacean/effects-webgl';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { ImGuiBackend } from '../../../platform/imgui';
import { ImGuiTextureBinding } from '../../../platform/imgui/texture-binding';

export interface CachedImagePreview { texture: ImGuiTextureBinding, width: number, height: number, flipY: boolean }
export type PreviewTextureSource = Texture | (() => Texture | undefined);

interface ImageEntry {
  owner: object,
  key: string,
  version: number,
  lastUsed: number,
  texture?: GPUTextureWebGL,
  preview?: CachedImagePreview,
}

/** Borrows live GPU resources; only decoded library images are owned by this cache. */
export class TexturePreviewCache {
  private images: ImageEntry[] = [];
  private references = new WeakMap<Texture, ImGuiTextureBinding>();
  private frame = 0;
  private readonly maxUnusedFrames = 300;
  private readonly maxBytes = 64 * 1024 * 1024;

  constructor (private readonly engine: () => Engine | undefined) { }

  beginFrame (): void { this.frame++; }

  reference (source: PreviewTextureSource): ImGuiTextureBinding {
    if (source instanceof Texture) {
      const cached = this.references.get(source);

      if (cached) { return cached; }
    }
    const binding = new ImGuiTextureBinding(() => {
      const texture = source instanceof Texture ? source : source();

      if (!texture || texture.isDestroyed) { return null; }
      const device = texture.engine.displayServer.renderingDevice;

      if (!(device instanceof RenderingDeviceWebGL) || device.gl !== ImGuiBackend.gl || device.gl.isContextLost()) { return null; }
      texture.initialize();
      const gpu = texture.getGPUTexture() as GPUTextureWebGL;

      return gpu.target === device.gl.TEXTURE_2D ? gpu.textureBuffer : null;
    }, () => {
      const texture = source instanceof Texture ? source : source();

      return !!texture?.source.premultiplyAlpha || texture?.source.sourceType === TextureSourceType.framebuffer;
    });

    if (source instanceof Texture) { this.references.set(source, binding); }

    return binding;
  }

  image (owner: object, key: string, version: number, load: () => Promise<Blob | undefined>, report: (error: unknown) => void): CachedImagePreview | undefined {
    const device = this.engine()?.displayServer.renderingDevice;

    if (!device || device.contextWasLost || ImGuiBackend.gl?.isContextLost()) { return; }
    let entry = this.images.find(entry => entry.owner === owner && entry.key === key);

    if (entry && (entry.version !== version || entry.texture?.isDestroyed)) { this.remove(entry); entry = undefined; }
    if (!entry) {
      entry = { owner, key, version, lastUsed: this.frame };
      this.images.push(entry);
      const request = entry;

      void this.loadImage(request, load).catch(error => { if (this.images.includes(request)) { report(error); } });
    }
    entry.lastUsed = this.frame;

    return entry.preview;
  }

  private async loadImage (entry: ImageEntry, load: () => Promise<Blob | undefined>): Promise<void> {
    const engine = this.engine(), blob = await load();

    if (!engine || !blob || !this.images.includes(entry)) { return; }
    const url = URL.createObjectURL(blob);

    try {
      const image = new Image();

      image.src = url; await image.decode();
      if (engine !== this.engine() || engine.disposed || !this.images.includes(entry) || ImGuiBackend.gl?.isContextLost()) { return; }
      const device = engine.displayServer.renderingDevice;

      if (!(device instanceof RenderingDeviceWebGL)) { return; }
      const texture = device.createTexture();
      const source: TextureSourceOptions = {
        name: 'AssetPreview', image, sourceType: TextureSourceType.image, flipY: false,
        format: glContext.RGBA, internalFormat: glContext.RGBA, type: glContext.UNSIGNED_BYTE,
        minFilter: glContext.LINEAR, magFilter: glContext.LINEAR, wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE,
      };

      entry.texture = texture;
      entry.preview = {
        texture: new ImGuiTextureBinding(() => {
          if (texture.isDestroyed || !texture.device || device.contextWasLost || device.gl.isContextLost()) { return null; }
          if (!texture.isInitialized) { texture.initialize(source); }

          return texture.textureBuffer;
        }),
        width: image.naturalWidth, height: image.naturalHeight, flipY: false,
      };
    } finally { URL.revokeObjectURL(url); }
  }

  clear (owner?: object): void {
    for (const entry of [...this.images]) { if (!owner || entry.owner === owner) { this.remove(entry); } }
    if (!owner) { this.references = new WeakMap(); }
  }

  prune (): void {
    let bytes = this.images.reduce((sum, entry) => sum + (entry.preview ? entry.preview.width * entry.preview.height * 4 : 0), 0);

    for (const entry of [...this.images].sort((a, b) => a.lastUsed - b.lastUsed)) {
      if (entry.lastUsed < this.frame && (entry.lastUsed + this.maxUnusedFrames < this.frame || bytes > this.maxBytes || entry.texture?.isDestroyed)) {
        bytes -= entry.preview ? entry.preview.width * entry.preview.height * 4 : 0;
        this.remove(entry);
      }
    }
  }

  private remove (entry: ImageEntry): void {
    const index = this.images.indexOf(entry);

    if (index >= 0) { this.images.splice(index, 1); }
    entry.texture?.dispose();
  }
}

export const texturePreviewCache = new TexturePreviewCache(() => EditorRuntimeSession.player?.engine);
