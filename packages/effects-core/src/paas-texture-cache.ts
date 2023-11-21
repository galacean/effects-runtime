import type { Engine } from './engine';
import { glContext } from './gl';
import type { TextureConfigOptions, TextureSourceOptions } from './texture';
import { Texture, TextureSourceType } from './texture';
import { assertExist, type Disposable } from './utils';

export interface TextureCacheRequest extends TextureConfigOptions {
  width: number,
  height: number,
  name: string,
  format?: typeof WebGLRenderingContext.RGBA | typeof WebGL2RenderingContext.RGB | typeof WebGLRenderingContext.LUMINANCE,
  type?: typeof WebGLRenderingContext.UNSIGNED_BYTE | typeof WebGLRenderingContext.FLOAT | typeof WebGL2RenderingContext.HALF_FLOAT,
  minFilter?: GLenum,
  magFilter?: GLenum,
  wrapS?: GLenum,
  wrapT?: GLenum,
}

const def: Record<string, number> = {
  format: glContext.RGBA,
  type: glContext.UNSIGNED_BYTE,
  minFilter: glContext.LINEAR,
  magFilter: glContext.LINEAR,
  wrapS: glContext.CLAMP_TO_EDGE,
  wrapT: glContext.CLAMP_TO_EDGE,
};
const disposeSymbol = Symbol('dispose');

export class PassTextureCache implements Disposable {
  private textureCache: Record<string, Texture> = {};
  private textureRef: Record<string, number> = {};
  private engine?: Engine;

  constructor (engine: Engine) {
    this.engine = engine;
  }

  requestColorAttachmentTexture (request: TextureCacheRequest): Texture {
    const { width, height, name } = request;
    const options: Record<string, any> = {
      sourceType: TextureSourceType.framebuffer,
      data: {
        width,
        height,
      },
      name,
    };
    const keys: (string | number)[] = [name];

    Object.getOwnPropertyNames(def).forEach(name => {
      const value = request[name as keyof TextureCacheRequest] as number | string ?? def[name];

      options[name] = value;
      keys.push(name, value);
    });

    const cacheId = keys.join(':');
    let tex = this.textureCache[cacheId];

    if (tex) {
      this.textureRef[cacheId]++;
      if (__DEBUG__) {
        // consoleLog(`Texture cache hit: ${cacheId}.`);
      }
    } else {

      const engine = this.engine;

      assertExist(engine);
      tex = Texture.create(engine, options as TextureSourceOptions);
      this.textureCache[cacheId] = tex;
      this.textureRef[cacheId] = 1;

      // @ts-expect-error
      tex[disposeSymbol] = tex.dispose;
      tex.dispose = () => this.removeTexture(cacheId);
    }

    return tex;
  }

  removeTexture (id: string) {
    const refCount = this.textureRef[id];

    if (refCount <= 1) {
      if (refCount < 0) {
        console.error('ref count < 0');
      }
      const tex = this.textureCache[id];

      if (tex) {
        // @ts-expect-error
        tex[disposeSymbol]();
        // @ts-expect-error
        tex.dispose = tex[disposeSymbol];
      }
      delete this.textureCache[id];
      delete this.textureRef[id];
    } else {
      this.textureRef[id] = refCount - 1;
    }
  }

  dispose () {
    Object.values(this.textureCache).forEach(tex => {
      // @ts-expect-error
      tex[disposeSymbol]();
      // @ts-expect-error
      tex.dispose = tex[disposeSymbol];
    });
    this.textureCache = {};
    this.textureRef = {};
    this.engine = undefined;
  }
}
