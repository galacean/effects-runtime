import { Stats } from '../stats';

/**
 * ProgramHook
 * 每一帧的 shader 数量
 */
export default class ProgramHook {
  programs = 0;

  private readonly realUseProgram: (program: WebGLProgram | null) => void;
  private hooked = true;

  constructor (
    private readonly gl: WebGLRenderingContext | WebGL2RenderingContext,
  ) {
    this.realUseProgram = gl.useProgram;

    gl.useProgram = this.hookedUseProgram.bind(this);

    if (Stats.options.debug) {
      console.debug('Program is hooked.');
    }
  }

  private hookedUseProgram (program: WebGLProgram): void {
    this.realUseProgram.call(this.gl, program);
    this.programs++;

    if (Stats.options.debug) {
      console.debug(`UseProgram: ${program}, program: ${this.programs}.`);
    }
  }

  reset (): void {
    this.programs = 0;
  }

  release (): void {
    if (this.hooked) {
      this.gl.useProgram = this.realUseProgram;
      this.hooked = false;
    }
  }
}
