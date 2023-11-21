import type { Bone } from './Bone';
import type { Skeleton } from './Skeleton';
import type { TransformConstraintData } from './TransformConstraintData';
import type { Updatable } from './Updatable';
import { MathUtils } from '../math/math';
import { Vector2 } from '../math/vector2';

/** Stores the current pose for a transform constraint. A transform constraint adjusts the world transform of the constrained
 * bones to match that of the target bone.
 *
 * See [Transform constraints](http://esotericsoftware.com/spine-transform-constraints) in the Spine User Guide. */
export class TransformConstraint implements Updatable {

  /** The transform constraint's setup pose data. */
  data: TransformConstraintData;

  /** The bones that will be modified by this transform constraint. */
  bones: Array<Bone>;

  /** The target bone whose world transform will be copied to the constrained bones. */
  target: Bone;

  mixRotate = 0; mixX = 0; mixY = 0; mixScaleX = 0; mixScaleY = 0; mixShearY = 0;

  temp = new Vector2();
  active = false;

  constructor (data: TransformConstraintData, skeleton: Skeleton) {
    if (!data) {throw new Error('data cannot be null.');}
    if (!skeleton) {throw new Error('skeleton cannot be null.');}
    this.data = data;
    this.mixRotate = data.mixRotate;
    this.mixX = data.mixX;
    this.mixY = data.mixY;
    this.mixScaleX = data.mixScaleX;
    this.mixScaleY = data.mixScaleY;
    this.mixShearY = data.mixShearY;
    this.bones = new Array<Bone>();
    for (let i = 0; i < data.bones.length; i++) {
      const bone = skeleton.findBone(data.bones[i].name);

      if (!bone) {throw new Error(`Couldn't find bone ${data.bones[i].name}.`);}
      this.bones.push(bone);
    }
    const target = skeleton.findBone(data.target.name);

    if (!target) {throw new Error(`Couldn't find target bone ${data.target.name}.`);}
    this.target = target;
  }

  isActive () {
    return this.active;
  }

  update () {
    if (this.mixRotate == 0 && this.mixX == 0 && this.mixY == 0 && this.mixScaleX == 0 && this.mixScaleX == 0 && this.mixShearY == 0) {return;}

    if (this.data.local) {
      if (this.data.relative) {this.applyRelativeLocal();} else {this.applyAbsoluteLocal();}
    } else {
      if (this.data.relative) {this.applyRelativeWorld();} else {this.applyAbsoluteWorld();}
    }
  }

  applyAbsoluteWorld () {
    const mixRotate = this.mixRotate, mixX = this.mixX, mixY = this.mixY, mixScaleX = this.mixScaleX,
      mixScaleY = this.mixScaleY, mixShearY = this.mixShearY;
    const translate = mixX != 0 || mixY != 0;

    const target = this.target;
    const ta = target.a, tb = target.b, tc = target.c, td = target.d;
    const degRadReflect = ta * td - tb * tc > 0 ? MathUtils.degRad : -MathUtils.degRad;
    const offsetRotation = this.data.offsetRotation * degRadReflect;
    const offsetShearY = this.data.offsetShearY * degRadReflect;

    const bones = this.bones;

    for (let i = 0, n = bones.length; i < n; i++) {
      const bone = bones[i];

      if (mixRotate != 0) {
        const a = bone.a, b = bone.b, c = bone.c, d = bone.d;
        let r = Math.atan2(tc, ta) - Math.atan2(c, a) + offsetRotation;

        if (r > MathUtils.PI) {r -= MathUtils.PI2;} else if (r < -MathUtils.PI) {r += MathUtils.PI2;}
        r *= mixRotate;
        const cos = Math.cos(r), sin = Math.sin(r);

        bone.a = cos * a - sin * c;
        bone.b = cos * b - sin * d;
        bone.c = sin * a + cos * c;
        bone.d = sin * b + cos * d;
      }

      if (translate) {
        const temp = this.temp;

        target.localToWorld(temp.set(this.data.offsetX, this.data.offsetY));
        bone.worldX += (temp.x - bone.worldX) * mixX;
        bone.worldY += (temp.y - bone.worldY) * mixY;
      }

      if (mixScaleX != 0) {
        let s = Math.sqrt(bone.a * bone.a + bone.c * bone.c);

        if (s != 0) {s = (s + (Math.sqrt(ta * ta + tc * tc) - s + this.data.offsetScaleX) * mixScaleX) / s;}
        bone.a *= s;
        bone.c *= s;
      }
      if (mixScaleY != 0) {
        let s = Math.sqrt(bone.b * bone.b + bone.d * bone.d);

        if (s != 0) {s = (s + (Math.sqrt(tb * tb + td * td) - s + this.data.offsetScaleY) * mixScaleY) / s;}
        bone.b *= s;
        bone.d *= s;
      }

      if (mixShearY > 0) {
        const b = bone.b, d = bone.d;
        const by = Math.atan2(d, b);
        let r = Math.atan2(td, tb) - Math.atan2(tc, ta) - (by - Math.atan2(bone.c, bone.a));

        if (r > MathUtils.PI) {r -= MathUtils.PI2;} else if (r < -MathUtils.PI) {r += MathUtils.PI2;}
        r = by + (r + offsetShearY) * mixShearY;
        const s = Math.sqrt(b * b + d * d);

        bone.b = Math.cos(r) * s;
        bone.d = Math.sin(r) * s;
      }

      bone.updateAppliedTransform();
    }
  }

  applyRelativeWorld () {
    const mixRotate = this.mixRotate, mixX = this.mixX, mixY = this.mixY, mixScaleX = this.mixScaleX,
      mixScaleY = this.mixScaleY, mixShearY = this.mixShearY;
    const translate = mixX != 0 || mixY != 0;

    const target = this.target;
    const ta = target.a, tb = target.b, tc = target.c, td = target.d;
    const degRadReflect = ta * td - tb * tc > 0 ? MathUtils.degRad : -MathUtils.degRad;
    const offsetRotation = this.data.offsetRotation * degRadReflect, offsetShearY = this.data.offsetShearY * degRadReflect;

    const bones = this.bones;

    for (let i = 0, n = bones.length; i < n; i++) {
      const bone = bones[i];

      if (mixRotate != 0) {
        const a = bone.a, b = bone.b, c = bone.c, d = bone.d;
        let r = Math.atan2(tc, ta) + offsetRotation;

        if (r > MathUtils.PI) {r -= MathUtils.PI2;} else if (r < -MathUtils.PI) {r += MathUtils.PI2;}
        r *= mixRotate;
        const cos = Math.cos(r), sin = Math.sin(r);

        bone.a = cos * a - sin * c;
        bone.b = cos * b - sin * d;
        bone.c = sin * a + cos * c;
        bone.d = sin * b + cos * d;
      }

      if (translate) {
        const temp = this.temp;

        target.localToWorld(temp.set(this.data.offsetX, this.data.offsetY));
        bone.worldX += temp.x * mixX;
        bone.worldY += temp.y * mixY;
      }

      if (mixScaleX != 0) {
        const s = (Math.sqrt(ta * ta + tc * tc) - 1 + this.data.offsetScaleX) * mixScaleX + 1;

        bone.a *= s;
        bone.c *= s;
      }
      if (mixScaleY != 0) {
        const s = (Math.sqrt(tb * tb + td * td) - 1 + this.data.offsetScaleY) * mixScaleY + 1;

        bone.b *= s;
        bone.d *= s;
      }

      if (mixShearY > 0) {
        let r = Math.atan2(td, tb) - Math.atan2(tc, ta);

        if (r > MathUtils.PI) {r -= MathUtils.PI2;} else if (r < -MathUtils.PI) {r += MathUtils.PI2;}
        const b = bone.b, d = bone.d;

        r = Math.atan2(d, b) + (r - MathUtils.PI / 2 + offsetShearY) * mixShearY;
        const s = Math.sqrt(b * b + d * d);

        bone.b = Math.cos(r) * s;
        bone.d = Math.sin(r) * s;
      }

      bone.updateAppliedTransform();
    }
  }

  applyAbsoluteLocal () {
    const mixRotate = this.mixRotate, mixX = this.mixX, mixY = this.mixY, mixScaleX = this.mixScaleX,
      mixScaleY = this.mixScaleY, mixShearY = this.mixShearY;

    const target = this.target;

    const bones = this.bones;

    for (let i = 0, n = bones.length; i < n; i++) {
      const bone = bones[i];

      let rotation = bone.arotation;

      if (mixRotate != 0) {
        let r = target.arotation - rotation + this.data.offsetRotation;

        r -= (16384 - ((16384.499999999996 - r / 360) | 0)) * 360;
        rotation += r * mixRotate;
      }

      let x = bone.ax, y = bone.ay;

      x += (target.ax - x + this.data.offsetX) * mixX;
      y += (target.ay - y + this.data.offsetY) * mixY;

      let scaleX = bone.ascaleX, scaleY = bone.ascaleY;

      if (mixScaleX != 0 && scaleX != 0) {scaleX = (scaleX + (target.ascaleX - scaleX + this.data.offsetScaleX) * mixScaleX) / scaleX;}
      if (mixScaleY != 0 && scaleY != 0) {scaleY = (scaleY + (target.ascaleY - scaleY + this.data.offsetScaleY) * mixScaleY) / scaleY;}

      let shearY = bone.ashearY;

      if (mixShearY != 0) {
        let r = target.ashearY - shearY + this.data.offsetShearY;

        r -= (16384 - ((16384.499999999996 - r / 360) | 0)) * 360;
        shearY += r * mixShearY;
      }

      bone.updateWorldTransformWith(x, y, rotation, scaleX, scaleY, bone.ashearX, shearY);
    }
  }

  applyRelativeLocal () {
    const mixRotate = this.mixRotate, mixX = this.mixX, mixY = this.mixY, mixScaleX = this.mixScaleX,
      mixScaleY = this.mixScaleY, mixShearY = this.mixShearY;

    const target = this.target;

    const bones = this.bones;

    for (let i = 0, n = bones.length; i < n; i++) {
      const bone = bones[i];

      const rotation = bone.arotation + (target.arotation + this.data.offsetRotation) * mixRotate;
      const x = bone.ax + (target.ax + this.data.offsetX) * mixX;
      const y = bone.ay + (target.ay + this.data.offsetY) * mixY;
      const scaleX = bone.ascaleX * (((target.ascaleX - 1 + this.data.offsetScaleX) * mixScaleX) + 1);
      const scaleY = bone.ascaleY * (((target.ascaleY - 1 + this.data.offsetScaleY) * mixScaleY) + 1);
      const shearY = bone.ashearY + (target.ashearY + this.data.offsetShearY) * mixShearY;

      bone.updateWorldTransformWith(x, y, rotation, scaleX, scaleY, bone.ashearX, shearY);
    }
  }
}
