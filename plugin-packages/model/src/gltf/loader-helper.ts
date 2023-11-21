import type { spec } from '@galacean/effects';
import { Transform as EffectsTransform } from '@galacean/effects';
import type { BaseTransform as Transform } from '../index';
import { Vector3, Matrix4, Quaternion, Euler, EulerOrder } from '../math';

export class LoaderHelper {
  static getTransformFromMat4 (mat: Matrix4): Transform {
    const transform = Matrix4.decompose(mat);

    return {
      position: transform.translation.xyz,
      rotation: LoaderHelper.getEulerFromQuat(transform.rotation),
      scale: transform.scale.xyz,
    };
  }

  static getEffectsTransformFromMat4 (mat: Matrix4): Transform {
    const transform = new EffectsTransform({
      valid: true,
    });

    transform.cloneFromMatrix(mat.toArray() as spec.mat4);

    return {
      position: transform.position,
      rotation: transform.rotation,
      scale: transform.scale,
    };
  }

  static getTransformFromTranslation (t: Vector3): Transform {
    return {
      position: t.xyz,
    };
  }

  static getTransformFromDirection (d: Vector3): Transform {
    const d0 = Vector3.fromArray([1, 0, 0]);
    const d1 = d.clone().normalize();
    const a = Vector3.cross(d0, d1);

    if (a.length() < 0.01) { return {}; }

    a.normalize();
    const b = Vector3.dot(d1, d0);
    const c = Math.acos(b);

    const mat = Matrix4.IDENTITY.clone().rotate(c, a) as Matrix4;

    return LoaderHelper.getTransformFromMat4(mat);
  }

  static getEffectsTransformFromDirection (d: Vector3): Transform {
    const d0 = Vector3.fromArray([0, 0, 1]);
    const d1 = d.clone().normalize();
    const a = Vector3.cross(d0, d1);

    if (a.length() < 0.01) { return {}; }

    a.normalize();
    const b = Vector3.dot(d1, d0);
    const c = Math.acos(b);

    const mat = Matrix4.IDENTITY.clone().rotate(c, a) as Matrix4;

    return LoaderHelper.getEffectsTransformFromMat4(mat);
  }

  static getTransformFromTransDir (t: Vector3, d: Vector3): Transform {
    const transform = LoaderHelper.getTransformFromDirection(d);

    transform.position = t.xyz;

    return transform;
  }

  static getEffectsTransformFromTransDir (t: Vector3, d: Vector3): Transform {
    const transform = LoaderHelper.getEffectsTransformFromDirection(d);

    transform.position = t.xyz;

    return transform;
  }

  static getEulerFromQuat (q: Quaternion): [number, number, number] {
    const euler = new Euler();
    const quat = new Quaternion(q.x, q.y, q.z, q.w);

    euler.order = EulerOrder.ZYX;
    euler.setFromQuaternion(quat);

    return [euler.x, euler.y, euler.z];
  }

  static getQuatFromEuler (e: Euler): [number, number, number, number] {
    const quat = new Quaternion();

    quat.setFromEuler(e);

    return [quat.x, quat.y, quat.z, quat.w];
  }

  static toPlayerColor3 (color: spec.vec3): spec.vec3 {
    // [0, 1] => [0, 255]
    return [
      LoaderHelper.scaleTo255(color[0]),
      LoaderHelper.scaleTo255(color[1]),
      LoaderHelper.scaleTo255(color[2]),
    ];
  }

  static toPlayerColor4 (color: spec.vec4): spec.vec4 {
    // [0, 1] => [0, 255]
    return [
      LoaderHelper.scaleTo255(color[0]),
      LoaderHelper.scaleTo255(color[1]),
      LoaderHelper.scaleTo255(color[2]),
      LoaderHelper.scaleTo255(color[3]),
    ];
  }

  static scaleTo255 (val: number): number {
    const intVal = val * 255;

    return Math.max(0, Math.min(intVal, 255));
  }

  static scaleTo1 (val: number): number {
    const floatVal = val / 255.0;

    return Math.max(0.0, Math.min(floatVal, 1.0));
  }
}
