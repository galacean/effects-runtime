import type { Texture, math } from '@galacean/effects-core';
import { GPUProgram } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from './rendering-device-webgl';

type Color = math.Color;
type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Vector4 = math.Vector4;
type Matrix3 = math.Matrix3;
type Matrix4 = math.Matrix4;
type Quaternion = math.Quaternion;

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

  private uniformLocations: Record<string, WebGLUniformLocation | null> = {};
  private samplerChannels: Record<string, number> = {};

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

  override setFloat (name: string, value: number) {
    (this.device as RenderingDeviceWebGL).setFloat(this.uniformLocations[name], value);
  }
  override setInt (name: string, value: number) {
    (this.device as RenderingDeviceWebGL).setInt(this.uniformLocations[name], value);
  }
  override setFloats (name: string, value: number[]) {
    (this.device as RenderingDeviceWebGL).setFloats(this.uniformLocations[name], value);
  }
  override setTexture (name: string, texture: Texture) {
    (this.device as RenderingDeviceWebGL).setTexture(this.uniformLocations[name], this.samplerChannels[name], texture);
  }
  override setVector2 (name: string, value: Vector2) {
    (this.device as RenderingDeviceWebGL).setVector2(this.uniformLocations[name], value);
  }
  override setVector3 (name: string, value: Vector3) {
    (this.device as RenderingDeviceWebGL).setVector3(this.uniformLocations[name], value);
  }
  override setVector4 (name: string, value: Vector4) {
    (this.device as RenderingDeviceWebGL).setVector4(this.uniformLocations[name], value);
  }
  override setColor (name: string, value: Color) {
    (this.device as RenderingDeviceWebGL).setColor(this.uniformLocations[name], value);
  }
  override setQuaternion (name: string, value: Quaternion) {
    (this.device as RenderingDeviceWebGL).setQuaternion(this.uniformLocations[name], value);
  }
  override setMatrix (name: string, value: Matrix4) {
    (this.device as RenderingDeviceWebGL).setMatrix(this.uniformLocations[name], value);
  }
  override setMatrix3 (name: string, value: Matrix3) {
    (this.device as RenderingDeviceWebGL).setMatrix3(this.uniformLocations[name], value);
  }
  override setVector4Array (name: string, array: number[]) {
    (this.device as RenderingDeviceWebGL).setVector4Array(this.uniformLocations[name], array);
  }
  override setMatrixArray (name: string, array: number[]) {
    (this.device as RenderingDeviceWebGL).setMatrixArray(this.uniformLocations[name], array);
  }

  override fillShaderInformation (uniformNames: string[], samplers: string[]) {
    // 避免修改原数组。
    const samplerList = samplers.slice();

    uniformNames = uniformNames.concat(samplerList);
    const avaliableUniforms = (this.device as RenderingDeviceWebGL).getUniforms(this.program!, uniformNames);

    for (let i = 0; i < uniformNames.length; i++) {
      this.uniformLocations[uniformNames[i]] = avaliableUniforms[i];
    }

    let index: number;

    for (index = 0; index < samplerList.length; index++) {
      const sampler = this.uniformLocations[(samplerList[index])];

      if (sampler == null) {
        samplerList.splice(index, 1);
        index--;
      }
    }

    for (index = 0; index < samplerList.length; index++) {
      const samplerName = samplerList[index];

      this.samplerChannels[samplerName] = index;
    }
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
    this.uniformLocations = {};
    this.samplerChannels = {};
  }
}
