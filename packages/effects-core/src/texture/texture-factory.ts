import type { vec2 } from '@galacean/effects-specification';
import type { TextureConfigOptions, TextureCubeSourceURLMap, TextureFactorySource2DFrom, TextureFactorySource2DMipmapsFrom, TextureFactorySourceCubeBinaryMipmapsFrom, TextureFactorySourceCubeFrom, TextureFactorySourceCubeMipmapsFrom, TextureFactorySourceFrom, TextureSourceOptions, TextureSourceCubeData, Texture2DSourceOptionsImageMipmaps } from './types';
import { TextureSourceType } from './types';
import { glContext } from '../gl';
import { isString } from '../utils';
import { loadBinary, loadImage, loadVideo } from '../downloader';
import { getKTXTextureOptions } from './ktx-texture';
import type { Texture } from './texture';

export class TextureFactory {
  reloadPending: Record<string, boolean>;

  constructor () {
    this.reloadPending = {};
  }

  async reload (texture: Texture): Promise<void> {
    const id = texture.id;

    if (this.reloadPending[id]) {
      return;
    }
    if (texture.sourceFrom) {
      this.reloadPending[id] = true;
      const sourceOpts = await this.loadSource(texture.sourceFrom);

      texture.updateSource(sourceOpts);
      this.reloadPending[id] = false;
    } else {
      throw new Error('No source from');
    }
  }

  canOffloadTexture (sourceFrom?: TextureFactorySourceFrom): boolean {
    if (sourceFrom) {
      const type = sourceFrom.type;

      if (
        type === TextureSourceType.compressed ||
        type === TextureSourceType.image
      ) {
        const { target, map } = sourceFrom as TextureFactorySourceCubeFrom;
        const { url } = sourceFrom as TextureFactorySource2DFrom;

        if (target === glContext.TEXTURE_CUBE_MAP) {
          return typeof map === 'object' && !!map;
        }

        return isString(url) && url.length > 0;
      }
      if (type === TextureSourceType.mipmaps) {
        const { bin, mipmaps } = sourceFrom as TextureFactorySourceCubeBinaryMipmapsFrom;
        const { target, maps } = sourceFrom as TextureFactorySourceCubeMipmapsFrom;
        const { urls } = sourceFrom as TextureFactorySource2DMipmapsFrom;

        if (bin) {
          return mipmaps.length > 0;
        }
        if (target === glContext.TEXTURE_CUBE_MAP) {
          return maps.every(map => typeof map === 'object' && map);
        }

        return urls.every(url => isString(url) && url.length > 0);
      }
    }

    return false;
  }

  async loadSource (sourceFrom: TextureFactorySourceFrom, config?: TextureConfigOptions): Promise<TextureSourceOptions> {
    const { type, target } = sourceFrom;
    const { map } = sourceFrom as TextureFactorySourceCubeFrom;
    const { url } = sourceFrom as TextureFactorySource2DFrom;
    const { bin, mipmaps } = sourceFrom as TextureFactorySourceCubeBinaryMipmapsFrom;
    const { urls } = sourceFrom as TextureFactorySource2DMipmapsFrom;
    const { maps } = sourceFrom as TextureFactorySourceCubeMipmapsFrom;

    // cube without mipmap
    if (target === glContext.TEXTURE_CUBE_MAP && type !== TextureSourceType.mipmaps) {
      const cube = await this.loadCubeMap(map);

      return {
        ...config,
        cube,
        target: glContext.TEXTURE_CUBE_MAP,
        sourceType: TextureSourceType.image,
        sourceFrom: { type: TextureSourceType.image, map: { ...map }, target: glContext.TEXTURE_CUBE_MAP },
      };
    } else if (type === TextureSourceType.image) {
      // image without mipmap
      const image = await loadImage(url);

      return {
        ...config,
        image,
        sourceType: TextureSourceType.image,
        sourceFrom: { type, url, target: glContext.TEXTURE_2D },
      };
    } else if (type === TextureSourceType.video) {
      const video = await loadVideo(url);

      return {
        ...config,
        video,
        sourceType: TextureSourceType.video,
      };
    } else if (type === TextureSourceType.compressed) {
      const buffer = await loadBinary(url);

      return {
        ...getKTXTextureOptions(buffer),
        ...config,
        sourceFrom: { url, type: TextureSourceType.compressed },
      };
    } else if (type === TextureSourceType.mipmaps) {
      if (bin) {
        const data = await loadBinary(bin);
        const newTarget = target ?? glContext.TEXTURE_2D;
        const newMipmaps = newTarget === glContext.TEXTURE_2D ? mipmaps.slice() : mipmaps.map(s => s.slice());
        let loadedMipmaps;

        if (target === glContext.TEXTURE_CUBE_MAP) {
          loadedMipmaps = await Promise.all(mipmaps.map(mipmap => this.loadMipmapImages(mipmap, data)));
        } else {
          loadedMipmaps = this.loadMipmapImages(mipmaps as unknown as vec2[], data);
        }

        return {
          ...config,
          mipmaps: loadedMipmaps,
          target: newTarget,
          sourceType: TextureSourceType.mipmaps,
          sourceFrom: { bin, mipmaps: newMipmaps, target: newTarget, type: TextureSourceType.mipmaps },
        } as unknown as Texture2DSourceOptionsImageMipmaps;
      }

      if (target === glContext.TEXTURE_2D || !target) {
        const loadedMipmaps = await Promise.all(urls.map(url => loadImage(url)));

        return {
          ...config,
          mipmaps: loadedMipmaps,
          target: glContext.TEXTURE_2D,
          sourceType: TextureSourceType.mipmaps,
          sourceFrom: { type, urls: urls.slice(), target: glContext.TEXTURE_2D },
        };
      } else if (target === glContext.TEXTURE_CUBE_MAP) {
        const loadedMipmaps = await Promise.all(maps.map(map => this.loadCubeMap(map)));

        return {
          ...config,
          mipmaps: loadedMipmaps,
          target: glContext.TEXTURE_CUBE_MAP,
          sourceType: TextureSourceType.mipmaps,
          sourceFrom: { type, maps: maps.map(map => ({ ...map })), target: glContext.TEXTURE_CUBE_MAP },
        };
      }
    }

    throw new Error(`Invalid resource type: ${type}`);
  }

  private async loadMipmapImages (pointers: vec2[], bin: ArrayBuffer) {
    return Promise.all(pointers.map(pointer => {
      const blob = new Blob([new Uint8Array(bin, pointer[0], pointer[1])]);

      return loadImage(blob);
    }));
  }

  private async loadCubeMap (cubemap: TextureCubeSourceURLMap | string[]): Promise<TextureSourceCubeData> {
    return Promise.all(cubemap.map(key => loadImage(key))) as Promise<TextureSourceCubeData>;
  }
}

let g: TextureFactory;

export function getDefaultTextureFactory (): TextureFactory {
  if (!g) {
    g = new TextureFactory();
  }

  return g;
}

export function setDefaultTextureFactory (factory: TextureFactory) {
  g = factory;
}
