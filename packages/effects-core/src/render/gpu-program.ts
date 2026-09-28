import type { Color, Matrix3, Matrix4, Quaternion, Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { Texture } from '../texture';
import { GPUResource } from '../gpu-resource';
import type { RenderingDevice } from '../rendering-device';

/** Linked GPU program resource. Shader assets and compilation remain with their owners. */
export abstract class GPUProgram extends GPUResource {
  constructor (device: RenderingDevice, readonly key: string) {
    super(device);
  }

  abstract setFloat (name: string, value: number): void;
  abstract setInt (name: string, value: number): void;
  abstract setFloats (name: string, value: number[]): void;
  abstract setTexture (name: string, texture: Texture): void;
  abstract setVector2 (name: string, value: Vector2): void;
  abstract setVector3 (name: string, value: Vector3): void;
  abstract setVector4 (name: string, value: Vector4): void;
  abstract setColor (name: string, value: Color): void;
  abstract setQuaternion (name: string, value: Quaternion): void;
  abstract setMatrix (name: string, value: Matrix4): void;
  abstract setMatrix3 (name: string, value: Matrix3): void;
  abstract setVector4Array (name: string, array: number[]): void;
  abstract setMatrixArray (name: string, array: number[]): void;
  /** @hide */
  abstract fillShaderInformation (uniformNames: string[], samplers: string[]): void;

  abstract bind (): void;
  /** @hide */
  abstract getAttributesNames (): readonly string[];
  /** @hide */
  abstract getAttributeLocation (index: number): number;
}
