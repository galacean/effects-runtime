import type { Composition } from '@galacean/effects';
import { Plugin, Texture, TextureSourceType } from '@galacean/effects';
import { axisIconMap } from './constants';
import { createImage, createTexture } from './util';

export class EditorGizmoPlugin extends Plugin {
  override order = 1001;
  private readonly iconImages = new Map<string, HTMLImageElement>();

  private async loadIconImages (): Promise<void> {
    await Promise.all(Array.from(axisIconMap, async ([name, data]) => {
      if (!this.iconImages.has(name)) { this.iconImages.set(name, await createImage(data)); }
    }));
  }

  override onAssetsLoadStart (): Promise<void> { return this.loadIconImages(); }

  getIconTextures (composition: Composition): Map<string, Texture> {
    const cached: Map<string, Texture> | undefined = composition.loaderData.gizmoIconTextures;

    if (cached) { return cached; }
    const textures = new Map<string, Texture>();
    const transparent = { width: 1, height: 1, data: new Uint8Array(4) };

    composition.loaderData.gizmoIconTextures = textures;
    for (const name of axisIconMap.keys()) {
      const image = this.iconImages.get(name);

      textures.set(name, image ? createTexture(composition.engine, image) : Texture.create(composition.engine, { data: transparent }));
    }
    // A directly constructed composition has no scene asset preload.
    if (this.iconImages.size !== axisIconMap.size) {
      void this.loadIconImages().then(() => {
        for (const [name, texture] of textures) {
          if (texture.sourceType === TextureSourceType.data) {
            texture.updateSource({ sourceType: TextureSourceType.image, image: this.iconImages.get(name)! });
          }
        }
      });
    }

    return textures;
  }

  override onCompositionDestroy (composition: Composition): void {
    const textures: Map<string, Texture> | undefined = composition.loaderData.gizmoIconTextures;

    textures?.forEach(texture => texture.dispose());
    textures?.clear();
  }
}
