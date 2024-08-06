import { logger } from '@galacean/effects-core';
import { EffectsStats } from '../effects-stats';

/**
 * ProgramHook
 * 每一帧的shader数量
 */
export default class ProgramHook {
  programs = 0;
  private readonly realUseProgram: (program: WebGLProgram | null) => void;
  private readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
  private hooked: boolean;

  constructor (gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.realUseProgram = gl.useProgram;

    gl.useProgram = this.hookedUseProgram.bind(this);

    this.hooked = true;
    this.gl = gl;

    if (EffectsStats.options.debug) {
      logger.info('Program is hooked.');
    }

  }

  private hookedUseProgram (program: WebGLProgram): void {
    this.realUseProgram.call(this.gl, program);

    this.programs++;
    if (EffectsStats.options.debug) {
      logger.info(`UseProgram: ${program}, program: ${this.programs}.`);

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
