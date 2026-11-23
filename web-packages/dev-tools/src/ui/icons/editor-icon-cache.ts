import type { Engine, TextureRegion } from '@galacean/effects';
import { Texture, TextureSourceType, glContext } from '@galacean/effects';
import { EDITOR_ICON_PATHS } from './editor-icon-paths';

export type EditorIcon = keyof typeof EDITOR_ICON_PATHS;
interface IconImage { texture?: Texture, region?: TextureRegion }
interface IconPage {
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  texture: Texture,
  x: number,
  y: number,
  rowHeight: number,
}

/** Caches rasterized SVGs by icon and physical pixel dimensions. */
export class EditorIconCache {
  private readonly images = new Map<EditorIcon, Map<number, Map<number, IconImage>>>();
  private readonly pages: IconPage[] = [];
  private readonly largeTextures: Texture[] = [];
  private readonly uploads = new Set<Texture>();
  private disposed = false;
  private readonly pageSize: number;

  constructor (private readonly engine: Engine) {
    this.pageSize = Math.min(1024, engine.displayServer.renderingDevice.gpuCapability.detail.maxTextureSize);
  }

  get (icon: EditorIcon, width: number, height: number): IconImage {
    let widths = this.images.get(icon);

    if (!widths) { widths = new Map(); this.images.set(icon, widths); }
    let heights = widths.get(width);

    if (!heights) { heights = new Map(); widths.set(width, heights); }
    let image = heights.get(height);

    if (!image) {
      image = {}; heights.set(height, image);
      void this.rasterize(icon, width, height, image).catch(error => { if (!this.disposed) { console.error('Unable to rasterize editor icon ' + icon + '.', error); } });
    }

    return image;
  }

  upload (): void {
    for (const texture of this.uploads) {
      if (texture.getGPUTexture().isInitialized) { texture.update(texture.source); } else { texture.initialize(); }
    }
    this.uploads.clear();
  }

  private async rasterize (icon: EditorIcon, width: number, height: number, result: IconImage): Promise<void> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 20 20" preserveAspectRatio="none" fill="none">${EDITOR_ICON_PATHS[icon]}</svg>`;
    const image = new Image();

    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await image.decode();
    if (this.disposed || this.engine.disposed || this.engine.displayServer.renderingDevice.contextWasLost) { return; }
    if (width + 2 > this.pageSize || height + 2 > this.pageSize) {
      const texture = this.createTexture(image);

      this.largeTextures.push(texture); this.uploads.add(texture);
      result.texture = texture; result.region = { u0: 0, v0: 1, u1: 1, v1: 0 };

      return;
    }
    for (const page of this.pages) { if (this.insert(page, image, width, height, result)) { return; } }
    const canvas = document.createElement('canvas');

    canvas.width = canvas.height = this.pageSize;
    const context = canvas.getContext('2d');

    if (!context) { throw new Error('Unable to create an editor icon atlas.'); }
    const page = { canvas, context, texture: this.createTexture(canvas), x: 0, y: 0, rowHeight: 0 };

    this.pages.push(page); this.insert(page, image, width, height, result);
  }

  private createTexture (image: HTMLCanvasElement | HTMLImageElement): Texture {
    const texture = Texture.create(this.engine, {
      name: 'Editor icons', sourceType: TextureSourceType.image, image, flipY: false, generateMipmap: false,
      minFilter: glContext.LINEAR, magFilter: glContext.LINEAR, wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE,
    });

    texture.unregisterObject();

    return texture;
  }

  private insert (page: IconPage, image: HTMLImageElement, width: number, height: number, result: IconImage): boolean {
    const paddedWidth = width + 2, paddedHeight = height + 2, size = this.pageSize;

    if (page.x + paddedWidth > size) { page.x = 0; page.y += page.rowHeight; page.rowHeight = 0; }
    if (page.y + paddedHeight > size) { return false; }
    const x = page.x + 1, y = page.y + 1, context = page.context;

    context.drawImage(image, x, y);
    // Repeat edge pixels into the one-pixel border for linear filtering.
    context.drawImage(image, 0, 0, width, 1, x, y - 1, width, 1);
    context.drawImage(image, 0, height - 1, width, 1, x, y + height, width, 1);
    context.drawImage(image, 0, 0, 1, height, x - 1, y, 1, height);
    context.drawImage(image, width - 1, 0, 1, height, x + width, y, 1, height);
    context.drawImage(image, 0, 0, 1, 1, x - 1, y - 1, 1, 1);
    context.drawImage(image, width - 1, 0, 1, 1, x + width, y - 1, 1, 1);
    context.drawImage(image, 0, height - 1, 1, 1, x - 1, y + height, 1, 1);
    context.drawImage(image, width - 1, height - 1, 1, 1, x + width, y + height, 1, 1);
    page.x += paddedWidth; page.rowHeight = Math.max(page.rowHeight, paddedHeight);
    this.uploads.add(page.texture);
    result.texture = page.texture; result.region = { u0: x / size, v0: (y + height) / size, u1: (x + width) / size, v1: y / size };

    return true;
  }

  dispose (): void {
    this.disposed = true; this.images.clear(); this.uploads.clear();
    for (const page of this.pages) { page.texture.dispose(); page.canvas.width = page.canvas.height = 0; }
    for (const texture of this.largeTextures) { texture.dispose(); }
    this.pages.length = this.largeTextures.length = 0;
  }
}
