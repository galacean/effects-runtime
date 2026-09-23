import { GPUProgram } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from './rendering-device-webgl';

export interface ProgramAttributeInfo {
  readonly name: string,
  readonly size: number,
  readonly type: number,
  readonly loc: number,
}

// TODO: 待移除？
export interface ProgramUniformInfo {
  readonly loc: WebGLUniformLocation,
  readonly subInfos: ProgramUniformInfo[],
  readonly name: string,
  readonly size: number,
  readonly type: number,
  readonly textureIndex: number,
  readonly isTexture: boolean,
}
export class GPUProgramWebGL extends GPUProgram {
  program: WebGLProgram | null = null;

  private attribInfoMap: Record<string, ProgramAttributeInfo> = {};
  private attributeNames: string[] = [];

  initialize (program: WebGLProgram): void {
    this.releaseGPU();
    this.program = program;
    const device = this.device as RenderingDeviceWebGL;

    device.useProgram(program);
    this.attribInfoMap = this.createAttribMap();
    this.attributeNames = Object.keys(this.attribInfoMap);
    device.useProgram(null);
    this.initialized = true;
  }

  override bind (): void {
    (this.device as RenderingDeviceWebGL).useProgram(this.program);
  }

  /**
   * @hide
   */
  override getAttributesNames (): readonly string[] {
    return this.attributeNames;
  }

  /**
   * @hide
   */
  override getAttributeLocation (index: number): number {
    const name = this.attributeNames[index];

    return name === undefined ? -1 : this.attribInfoMap[name].loc;
  }

  private createAttribMap () {
    const { gl } = this.device as RenderingDeviceWebGL;
    const program = this.program!;
    const attribMap: Record<string, ProgramAttributeInfo> = {};
    const num = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

    for (let i = 0; i < num; i++) {
      const info = gl.getActiveAttrib(program, i);

      if (info) {
        const { name, type, size } = info;
        const loc = gl.getAttribLocation(program, name);

        attribMap[name] = {
          type, name, size, loc,
        };
      }
    }

    return attribMap;
  }

  protected override onReleaseGPU (): void {
    const device = this.device as RenderingDeviceWebGL;

    device.invalidateProgram(this.program!);
    if (!device.gl.isContextLost()) {
      device.gl.deleteProgram(this.program);
    }
    this.program = null;
    this.attribInfoMap = {};
    this.attributeNames = [];
  }
}
