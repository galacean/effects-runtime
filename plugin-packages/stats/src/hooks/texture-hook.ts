/**
 * TextureHook
 */
export default class TextureHook {
  textures = 0;

  private readonly realCreateTexture: () => WebGLTexture | null;
  private readonly realDeleteTexture: (texture: WebGLTexture | null) => void;
  private hooked = true;

  constructor (
    private readonly gl: WebGLRenderingContext | WebGL2RenderingContext,
    private readonly debug: boolean,
  ) {
    this.realCreateTexture = gl.createTexture;
    this.realDeleteTexture = gl.deleteTexture;

    gl.createTexture = this.hookedCreateTexture.bind(this);
    gl.deleteTexture = this.hookedDeleteTexture.bind(this);

    if (debug) {
      console.debug('Texture is hooked.');
    }
  }

  private hookedCreateTexture (): WebGLTexture | null {
    const texture = this.realCreateTexture.call(this.gl);

    this.textures++;

    if (this.debug) {
      console.debug(`CreateTexture: ${texture}, textures: ${this.textures}.`);
    }

    return texture;
  }

  private hookedDeleteTexture (texture: WebGLTexture | null): void {
    this.realDeleteTexture.call(this.gl, texture);
    this.textures--;

    if (this.debug) {
      console.debug(`DeleteTexture, textures: ${this.textures}.`);
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
