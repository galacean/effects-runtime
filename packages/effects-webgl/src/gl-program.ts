import type { Disposable } from '@galacean/effects-core';
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
export class GLProgram implements Disposable {
  private attribInfoMap: Record<string, ProgramAttributeInfo>;
  private attributeNames: string[];

  constructor (
    public device: RenderingDeviceWebGL,
    public readonly program: WebGLProgram,
    public readonly key: string,
  ) {
    this.device.useProgram(program);

    this.attribInfoMap = this.createAttribMap();
    this.attributeNames = Object.keys(this.attribInfoMap);

    this.device.useProgram(null);
    //gl.activeTexture(gl.TEXTURE0);
    //this.device.activeTexture(gl.TEXTURE0);
    //emptyTexture2D.bind();
    //this.uniformInfoMap = uniformMap;
  }

  bind () {
    this.device.useProgram(this.program);
  }

  /**
   * @internal
   */
  getAttributesNames (): readonly string[] {
    return this.attributeNames;
  }

  /**
   * @internal
   */
  getAttributeLocation (index: number): number {
    const name = this.attributeNames[index];

    return name === undefined ? -1 : this.attribInfoMap[name].loc;
  }

  createAttribMap () {
    const { gl } = this.device;
    const program = this.program;
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

  dispose () {
    if (this.device) {
      this.device.gl.deleteProgram(this.program);
    }
  }
}
