import { Euler, Matrix4, Vector2, Vector3 } from '@galacean/effects-math/es/core/index';
import type { vec3, vec4 } from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import type { Geometry } from '../../render';
import type { ShapeGenerator, ShapeParticle } from '../../shape';
import { Transform } from '../../transform';
import type { ParticleDataBuffer } from './particle-data-buffer';
import type { Point } from './particle-mesh';

type InitParticleOptions = {
  startSpeed: ValueGetter<number>,
  startLifetime: ValueGetter<number>,
  startDelay: ValueGetter<number>,
  startColor: ValueGetter<any>,
  start3DRotation?: boolean,
  startRotationX?: ValueGetter<number>,
  startRotationY?: ValueGetter<number>,
  startRotationZ?: ValueGetter<number>,
  startRotation?: ValueGetter<number>,
  start3DSize: boolean,
  startSizeX?: ValueGetter<number>,
  startSizeY?: ValueGetter<number>,
  startSize?: ValueGetter<number>,
  sizeAspect?: ValueGetter<number>,
  startTurbulence: boolean,
  turbulence?: [ValueGetter<number>, ValueGetter<number>, ValueGetter<number>],
  gravity: vec3,
  particleFollowParent?: boolean,
};

type InitParticleTextureSheet = {
  animate: boolean,
  animationDelay: ValueGetter<number>,
  animationDuration: ValueGetter<number>,
  cycles: ValueGetter<number>,
};

export class InitializeParticleModule {
  private options: InitParticleOptions;
  private shape: ShapeGenerator;
  private textureSheetAnimation?: InitParticleTextureSheet;
  private uvs: number[][];

  setup (opts: {
    options: InitParticleOptions,
    shape: ShapeGenerator,
    textureSheetAnimation?: InitParticleTextureSheet,
    uvs: number[][],
  }): void {
    this.options = opts.options;
    this.shape = opts.shape;
    this.textureSheetAnimation = opts.textureSheetAnimation;
    this.uvs = opts.uvs;
  }

  createPoint (
    data: ShapeParticle,
    emitterLifetime: number,
    worldMatrix: Matrix4,
    emitterTransform: Transform,
    upDirectionWorld: Vector3 | null,
  ): { point: Point, upDirectionWorld: Vector3 | null } {
    const options = this.options;
    const shape = this.shape;
    const speed = options.startSpeed.getValue(emitterLifetime);
    const matrix4 = options.particleFollowParent ? Matrix4.IDENTITY : worldMatrix;
    const pointPosition: Vector3 = data.position;

    const position = matrix4.transformPoint(pointPosition, new Vector3());
    const transform = new Transform({
      position,
      valid: true,
    });

    let direction = data.direction;

    direction = matrix4.transformNormal(direction, tempDir).normalize();
    if (options.startTurbulence && options.turbulence) {
      for (let i = 0; i < 3; i++) {
        tempVec3.setElement(i, options.turbulence[i].getValue(emitterLifetime));
      }
      tempEuler.setFromVector3(tempVec3.negate());
      const mat4 = tempMat4.setFromEuler(tempEuler);

      mat4.transformNormal(direction).normalize();
    }
    const dirX = tmpDirX;
    const dirY = tmpDirY;

    if (shape.alignSpeedDirection) {
      dirY.copyFrom(direction);
      if (!upDirectionWorld) {
        if (shape.upDirection) {
          upDirectionWorld = shape.upDirection.clone();
        } else {
          upDirectionWorld = Vector3.Z.clone();
        }
        matrix4.transformNormal(upDirectionWorld);
      }
      dirX.crossVectors(dirY, upDirectionWorld).normalize();
      if (dirX.isZero()) {
        dirX.set(1, 0, 0);
      }
    } else {
      dirX.set(1, 0, 0);
      dirY.set(0, 1, 0);
    }
    let sprite;
    const tsa = this.textureSheetAnimation;

    if (tsa && tsa.animate) {
      sprite = tempSprite;
      sprite[0] = tsa.animationDelay.getValue(emitterLifetime);
      sprite[1] = tsa.animationDuration.getValue(emitterLifetime);
      sprite[2] = tsa.cycles.getValue(emitterLifetime);
    }
    const rot = tempRot;

    if (options.start3DRotation) {
      rot.set(
        options.startRotationX!.getValue(emitterLifetime),
        options.startRotationY!.getValue(emitterLifetime),
        options.startRotationZ!.getValue(emitterLifetime),
      );
    } else if (options.startRotation) {
      rot.set(0, 0, options.startRotation.getValue(emitterLifetime));
    } else {
      rot.set(0, 0, 0);
    }
    transform.setRotation(rot.x, rot.y, rot.z);
    const color = options.startColor.getValue(emitterLifetime) as number[];

    if (color.length === 3) {
      color[3] = 1;
    }
    const size = tempSize;

    if (options.start3DSize) {
      size.x = options.startSizeX!.getValue(emitterLifetime);
      size.y = options.startSizeY!.getValue(emitterLifetime);
    } else {
      const n = options.startSize!.getValue(emitterLifetime);
      const aspect = options.sizeAspect!.getValue(emitterLifetime);

      size.x = n;
      size.y = aspect === 0 ? 0 : n / aspect;
    }

    const vel = direction.clone();

    vel.multiply(speed);

    if (!options.particleFollowParent) {
      const tempScale = new Vector3();

      emitterTransform.assignWorldTRS(undefined, undefined, tempScale);
      size.x *= tempScale.x;
      size.y *= tempScale.y;
    }
    transform.setScale(size.x, size.y, 1);

    const point: Point = {
      size,
      vel,
      color: color as vec4,
      delay: options.startDelay.getValue(emitterLifetime),
      lifetime: options.startLifetime.getValue(emitterLifetime),
      uv: randomArrItem(this.uvs, true),
      gravity: options.gravity,
      sprite,
      dirY,
      dirX,
      transform,
    };

    return { point, upDirectionWorld };
  }

  writeToBuffer (
    index: number,
    point: Point,
    db: ParticleDataBuffer,
    geometry: Geometry,
  ): void {
    const i3 = index * 3;
    const i4 = index * 4;
    const i2 = index * 2;
    const i9 = index * 9;
    const pos = point.transform.position;

    db.delay[index] = point.delay;
    db.lifetime[index] = point.lifetime;

    const aRotData = geometry.getAttributeData('aRot') as Float32Array;
    const gRotOff = index * 32;

    db.seed[index] = aRotData[gRotOff + 3];
    db.rotation[i3] = aRotData[gRotOff];
    db.rotation[i3 + 1] = aRotData[gRotOff + 1];
    db.rotation[i3 + 2] = aRotData[gRotOff + 2];

    db.position[i3] = pos.x;
    db.position[i3 + 1] = pos.y;
    db.position[i3 + 2] = pos.z;

    db.velocity[i3] = point.vel.x;
    db.velocity[i3 + 1] = point.vel.y;
    db.velocity[i3 + 2] = point.vel.z;

    db.color[i4] = point.color[0];
    db.color[i4 + 1] = point.color[1];
    db.color[i4 + 2] = point.color[2];
    db.color[i4 + 3] = point.color[3];

    db.size[i2] = point.size.x;
    db.size[i2 + 1] = point.size.y;

    db.dirX[i3] = point.dirX.x;
    db.dirX[i3 + 1] = point.dirX.y;
    db.dirX[i3 + 2] = point.dirX.z;
    db.dirY[i3] = point.dirY.x;
    db.dirY[i3 + 1] = point.dirY.y;
    db.dirY[i3 + 2] = point.dirY.z;

    if (point.uv) {
      db.uv[i4] = point.uv[0];
      db.uv[i4 + 1] = point.uv[1];
      db.uv[i4 + 2] = point.uv[2];
      db.uv[i4 + 3] = point.uv[3];
    }
    if (point.sprite) {
      db.sprite[i3] = point.sprite[0];
      db.sprite[i3 + 1] = point.sprite[1];
      db.sprite[i3 + 2] = point.sprite[2];
    }
    if (point.gravity) {
      db.gravity[i3] = point.gravity[0];
      db.gravity[i3 + 1] = point.gravity[1];
      db.gravity[i3 + 2] = point.gravity[2];
    }

    db.translation[i3] = 0;
    db.translation[i3 + 1] = 0;
    db.translation[i3 + 2] = 0;
    db.linearMove[i3] = 0;
    db.linearMove[i3 + 1] = 0;
    db.linearMove[i3 + 2] = 0;

    db.rotMatrix[i9] = 1;
    db.rotMatrix[i9 + 1] = 0;
    db.rotMatrix[i9 + 2] = 0;
    db.rotMatrix[i9 + 3] = 0;
    db.rotMatrix[i9 + 4] = 1;
    db.rotMatrix[i9 + 5] = 0;
    db.rotMatrix[i9 + 6] = 0;
    db.rotMatrix[i9 + 7] = 0;
    db.rotMatrix[i9 + 8] = 1;

    db.activeCount = Math.max(db.activeCount, index + 1);
  }
}

const tempDir = new Vector3();
const tempSize = new Vector2();
const tempRot = new Euler();
const tmpDirX = new Vector3();
const tmpDirY = new Vector3();
const tempVec3 = new Vector3();
const tempEuler = new Euler();
const tempSprite: vec3 = [0, 0, 0];
const tempMat4 = new Matrix4();

function randomArrItem<T> (arr: T[], keepArr?: boolean): T {
  const index = Math.floor(Math.random() * arr.length);
  const item = arr[index];

  if (!keepArr) {
    arr.splice(index, 1);
  }

  return item;
}
