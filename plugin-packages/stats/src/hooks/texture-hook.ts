import { logger } from '@galacean/effects-core';
import { EffectsStats } from '../effects-stats';

/**
 * TextureHook
 */
export default class TextureHook {
  textures = 0;
  private readonly realCreateTexture: () => WebGLTexture | null;
  private readonly realDeleteTexture: (texture: WebGLTexture | null) => void;
  private readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
  private hooked: boolean;

  constructor (gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.realCreateTexture = gl.createTexture;
    this.realDeleteTexture = gl.deleteTexture;

    gl.createTexture = this.hookedCreateTexture.bind(this);
    gl.deleteTexture = this.hookedDeleteTexture.bind(this);

    this.hooked = true;
    this.gl = gl;

    if (EffectsStats.options.debug) {
      logger.info('Texture is hooked.');
    }

  }

  private hookedCreateTexture (): WebGLTexture | null {
    const texture = this.realCreateTexture.call(this.gl);

    this.textures++;
    if (EffectsStats.options.debug) {
      logger.info(`CreateTexture: ${texture}, textures: ${this.textures}.`);

    }

    return texture;
  }

  private hookedDeleteTexture (texture: WebGLTexture | null): void {
    this.realDeleteTexture.call(this.gl, texture);

    this.textures--;

    if (EffectsStats.options.debug) {
      logger.info(`DeleteTexture. textures: ${this.textures}`);
    }

  }

  reset (): void {
    this.textures = 0;
  }

  release (): void {
    if (this.hooked) {
      this.gl.createTexture = this.realCreateTexture;
      this.gl.deleteTexture = this.realDeleteTexture;
      this.hooked = false;
    }
  }
}
