import { Stats } from '../stats';

/**
 * ShaderHook
 */
export default class ShaderHook {
  shaders = 0;

  private readonly realAttachShader: (program: WebGLProgram, shader: WebGLShader) => void;
  private readonly realDetachShader: (program: WebGLProgram, shader: WebGLShader) => void;
  private hooked = true;

  constructor (
    private readonly gl: WebGLRenderingContext | WebGL2RenderingContext,
  ) {
    this.realAttachShader = gl.attachShader;
    this.realDetachShader = gl.detachShader;

    gl.attachShader = this.hookedAttachShader.bind(this);
    gl.detachShader = this.hookedDetachShader.bind(this);

    if (Stats.options.debug) {
      console.debug('Shader is hooked.');
    }
  }

  private hookedAttachShader (program: WebGLProgram, shader: WebGLShader): void {
    this.realAttachShader.call(this.gl, program, shader);
    this.shaders++;

    if (Stats.options.debug) {
      console.debug(`AttachShader: ${shader}. shaders: ${this.shaders}`);
    }
  }

  private hookedDetachShader (program: WebGLProgram, shader: WebGLShader): void {
    this.realDetachShader.call(this.gl, program, shader);
    this.shaders--;

    if (Stats.options.debug) {
      console.debug(`DetachShader. shaders: ${this.shaders}`);
    }
  }

  reset (): void {
    this.shaders = 0;
  }

  release (): void {
    if (this.hooked) {
      this.gl.attachShader = this.realAttachShader;
      this.gl.detachShader = this.realDetachShader;
      this.hooked = false;
    }
  }
}
