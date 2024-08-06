import { logger } from '@galacean/effects';
import { EffectsStats } from '../effects-stats';

/**
 * DrawCallHook
 */
export default class DrawCallHook {
  drawCall = 0;
  triangles = 0;
  lines = 0;
  points = 0;
  private hooked: boolean;
  private readonly realDrawElements: (mode: number, count: number, type: number, offset: number) => void;
  private readonly realDrawArrays: (mode: number, first: number, count: number) => void;
  private readonly gl: WebGLRenderingContext | WebGL2RenderingContext;

  constructor (gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.realDrawElements = gl.drawElements;
    this.realDrawArrays = gl.drawArrays;

    gl.drawElements = this.hookedDrawElements.bind(this);
    gl.drawArrays = this.hookedDrawArrays.bind(this);

    this.hooked = true;
    this.gl = gl;
    if (EffectsStats.options.debug) {
      logger.info('DrawCall is hooked.');
    }
  }

  private hookedDrawElements (mode: number, count: number, type: number, offset: number): void {
    this.realDrawElements.call(this.gl, mode, count, type, offset);
    this.update(count, mode);
  }

  private hookedDrawArrays (mode: number, first: number, count: number): void {
    this.realDrawArrays.call(this.gl, mode, first, count);
    this.update(count, mode);
  }

  private update (count: number, mode: number): void {
    const { gl } = this;

    this.drawCall++;

    switch (mode) {
      case gl.TRIANGLES:
        this.triangles += count / 3;

        break;
      case gl.TRIANGLE_STRIP:
      case gl.TRIANGLE_FAN:
        this.triangles += count - 2;

        break;
      case gl.LINES:
        this.lines += count / 2;

        break;
      case gl.LINE_STRIP:
        this.lines += count - 1;

        break;
      case gl.LINE_LOOP:
        this.lines += count;

        break;
      case gl.POINTS:
        this.points += count;

        break;
      default:
        logger.error('Unknown draw mode:', mode);

        break;
    }
  }

  reset (): void {
    this.drawCall = 0;
    this.triangles = 0;
    this.lines = 0;
    this.points = 0;
  }

  release (): void {
    if (this.hooked) {
      this.gl.drawElements = this.realDrawElements;
      this.gl.drawArrays = this.realDrawArrays;
    }

    this.hooked = false;
  }
}
