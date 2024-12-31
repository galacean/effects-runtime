import DrawCallHook from './hooks/drawcall-hook';
import ProgramHook from './hooks/program-hook';
import ShaderHook from './hooks/shader-hook';
import TextureHook from './hooks/texture-hook';

declare global {
  interface Performance {
    memory: any,
  }
}

/**
 * Hook gl to calculate stats
 */
export class Core {
  private drawCallHook: DrawCallHook;
  private textureHook: TextureHook;
  private shaderHook: ShaderHook;
  private samplingFrames = 60;
  private samplingIndex = 0;
  private updateCounter = 0;
  private updateTime = 0;
  private programHook: ProgramHook;

  constructor (
    private readonly gl: WebGLRenderingContext | WebGL2RenderingContext,
    debug = false,
  ) {
    if (!gl) {
      throw new Error('Unsupported WebGL context.');
    }
    this.hook(gl, debug);
  }

  private hook (gl: WebGLRenderingContext | WebGL2RenderingContext, debug: boolean): void {
    this.drawCallHook = new DrawCallHook(gl, debug);
    this.textureHook = new TextureHook(gl, debug);
    this.shaderHook = new ShaderHook(gl, debug);
    this.programHook = new ProgramHook(gl, debug);
  }

  /**
   * reset draw call hook
   */
  reset (): void {
    this.drawCallHook?.reset();
    this.programHook?.reset();
  }

  /**
   * release hook
   */
  release (): void {
    this.drawCallHook?.release();
    this.textureHook?.release();
    this.shaderHook?.release();
    this.programHook?.release();
  }

  /**
   * update performance data
   */
  update (dt: number): PerformanceData | undefined {
    const now = performance.now();

    this.updateCounter++;

    if (now - this.updateTime < 1000) {
      return undefined;
    }

    if (this.samplingIndex !== this.samplingFrames) {
      this.reset();
      this.samplingIndex++;

      return undefined;
    }

    this.samplingIndex = 0;

    const data: PerformanceData = {
      fps: Math.round((this.updateCounter * 1000) / (now - this.updateTime)),
      // eslint-disable-next-line compat/compat -- performance.memory is not standard
      memory: performance.memory && (performance.memory.usedJSHeapSize / 1048576) >> 0,
      drawCall: (this.drawCallHook.drawCall === 0) ? 0 : this.drawCallHook.drawCall,
      triangles: (this.drawCallHook.triangles === 0) ? 0 : this.drawCallHook.triangles,
      lines: this.drawCallHook.lines,
      points: this.drawCallHook.points,
      textures: this.textureHook.textures,
      shaders: (this.shaderHook.shaders === 0) ? 0 : this.shaderHook.shaders,
      programs: this.programHook.programs,
      webglContext: this.gl instanceof WebGL2RenderingContext ? '2.0' : '1.0',
    };

    this.reset();

    this.updateCounter = 0;
    this.updateTime = now;

    return data;
  }
}

export interface PerformanceData {
  fps: number,
  memory: number,
  drawCall: number,
  triangles: number,
  lines: number,
  points: number,
  textures: number,
  shaders: number,
  webglContext: string,
  programs: number,
}
