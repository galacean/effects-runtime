import { Euler, Matrix4, Vector2, Vector3 } from '@galacean/effects-math/es/core/index';
import type { vec3 } from '@galacean/effects-specification';
import type * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import { createShape } from '../../shape';
import type { ShapeGenerator, ShapeParticle } from '../../shape';
import type { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleEmitter } from './particle-emitter';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

export type InitializeModuleData = {
  startSpeed: spec.NumberExpression | number,
  startLifetime: spec.NumberExpression | number,
  startDelay: spec.NumberExpression | number,
  startColor: spec.ColorExpression | spec.RGBAColorValue,
  start3DRotation?: boolean,
  startRotationX?: spec.NumberExpression | number,
  startRotationY?: spec.NumberExpression | number,
  startRotationZ?: spec.NumberExpression | number,
  startRotation?: spec.NumberExpression | number,
  start3DSize: boolean,
  startSizeX?: spec.NumberExpression | number,
  startSizeY?: spec.NumberExpression | number,
  startSize?: spec.NumberExpression | number,
  sizeAspect?: spec.NumberExpression | number,
  startTurbulence: boolean,
  turbulence?: [spec.NumberExpression | number, spec.NumberExpression | number, spec.NumberExpression | number],
  shape: spec.ParticleShape | undefined,
  textureSheetAnimation: spec.ParticleTextureSheetAnimation | undefined,
  splits: number[][] | undefined,
};

type RuntimeTextureSheetAnimation = {
  animate: boolean,
  animationDelay: ValueGetter<number>,
  animationDuration: ValueGetter<number>,
  cycles: ValueGetter<number>,
};

export class InitializeParticleModule extends ParticleModule {
  override readonly stage = 'particleSpawn' as const;

  private shape: ShapeGenerator;
  private startSpeed: ValueGetter<number>;
  private startLifetime: ValueGetter<number>;
  private startDelay: ValueGetter<number>;
  private startColor: ValueGetter<any>;
  private start3DRotation = false;
  private startRotationX?: ValueGetter<number>;
  private startRotationY?: ValueGetter<number>;
  private startRotationZ?: ValueGetter<number>;
  private startRotation?: ValueGetter<number>;
  private start3DSize = false;
  private startSizeX?: ValueGetter<number>;
  private startSizeY?: ValueGetter<number>;
  private startSize?: ValueGetter<number>;
  private sizeAspect?: ValueGetter<number>;
  private startTurbulence = false;
  private turbulence?: [ValueGetter<number>, ValueGetter<number>, ValueGetter<number>];
  private textureSheetAnimation?: RuntimeTextureSheetAnimation;
  private uvs: number[][] = [];

  override fromJSON (data: InitializeModuleData): void {
    this.shape = createShape(data.shape);
    this.uvs = this.buildUVs(data.textureSheetAnimation, data.splits);
    this.startSpeed = createValueGetter(data.startSpeed);
    this.startLifetime = createValueGetter(data.startLifetime);
    this.startDelay = createValueGetter(data.startDelay);
    this.startColor = createValueGetter(data.startColor);
    this.start3DRotation = !!data.start3DRotation;
    this.start3DSize = data.start3DSize;
    this.startTurbulence = data.startTurbulence;

    if (data.startRotation !== undefined) {
      this.startRotation = createValueGetter(data.startRotation);
    }

    if (data.startRotationX !== undefined) {
      this.startRotationX = createValueGetter(data.startRotationX);
    }

    if (data.startRotationY !== undefined) {
      this.startRotationY = createValueGetter(data.startRotationY);
    }

    if (data.startRotationZ !== undefined) {
      this.startRotationZ = createValueGetter(data.startRotationZ);
    }

    if (data.startSizeX !== undefined) {
      this.startSizeX = createValueGetter(data.startSizeX);
    }

    if (data.startSizeY !== undefined) {
      this.startSizeY = createValueGetter(data.startSizeY);
    }

    if (data.startSize !== undefined) {
      this.startSize = createValueGetter(data.startSize);
    }

    if (data.sizeAspect !== undefined) {
      this.sizeAspect = createValueGetter(data.sizeAspect);
    }

    if (data.turbulence) {
      this.turbulence = [
        createValueGetter(data.turbulence[0]),
        createValueGetter(data.turbulence[1]),
        createValueGetter(data.turbulence[2]),
      ];
    }

    if (data.textureSheetAnimation) {
      this.textureSheetAnimation = {
        animate: data.textureSheetAnimation.animate,
        animationDelay: createValueGetter(data.textureSheetAnimation.animationDelay || 0),
        animationDuration: createValueGetter(data.textureSheetAnimation.animationDuration || 1),
        cycles: createValueGetter(data.textureSheetAnimation.cycles || 1),
      };
    }
  }

  private buildUVs (
    textureSheetAnimation: spec.ParticleTextureSheetAnimation | undefined,
    splits: number[][] | undefined,
  ): number[][] {
    const uvs: number[][] = [];
    let textureMap = [0, 0, 1, 1];
    let flip: number | undefined;

    if (splits) {
      const s = splits[0];

      flip = s[4];
      textureMap = flip ? [s[0], s[1], s[3], s[2]] : [s[0], s[1], s[2], s[3]];
    }

    if (textureSheetAnimation && !textureSheetAnimation.animate) {
      const col = flip ? textureSheetAnimation.row : textureSheetAnimation.col;
      const row = flip ? textureSheetAnimation.col : textureSheetAnimation.row;
      const total = textureSheetAnimation.total || col * row;
      let index = 0;

      for (let x = 0; x < col; x++) {
        for (let y = 0; y < row && index < total; y++, index++) {
          uvs.push([
            x * textureMap[2] / col + textureMap[0],
            y * textureMap[3] / row + textureMap[1],
            textureMap[2] / col,
            textureMap[3] / row,
          ]);
        }
      }
    } else {
      uvs.push(textureMap);
    }

    return uvs;
  }

  override execute (ctx: ParticleModuleContext): void {
    if (!ctx.spawnBatch) {
      return;
    }
    const { slotIndices, spawnGenerators } = ctx.spawnBatch;
    const db = ctx.dataBuffer;

    for (let idx = 0; idx < slotIndices.length; idx++) {
      const slotIndex = slotIndices[idx];
      const generator = spawnGenerators[idx];
      const shapeData = this.shape.generate(generator);

      this.initializeToBuffer(shapeData, ctx.emitterLifetime, slotIndex, db, ctx.emitter);
    }
  }

  initializeToBuffer (
    data: ShapeParticle,
    emitterLifetime: number,
    slotIndex: number,
    db: ParticleDataBuffer,
    emitter: ParticleEmitter,
  ): void {
    const shape = this.shape;
    const speed = this.startSpeed.getValue(emitterLifetime);

    const position = data.position.clone();

    const direction = data.direction.clone();

    if (this.startTurbulence && this.turbulence) {
      for (let i = 0; i < 3; i++) {
        tempVec3.setElement(i, this.turbulence[i].getValue(emitterLifetime));
      }
      tempEuler.setFromVector3(tempVec3.negate());
      const mat4 = tempMat4.setFromEuler(tempEuler);

      mat4.transformNormal(direction).normalize();
    }

    const dirX = tmpDirX;
    const dirY = tmpDirY;

    if (shape.alignSpeedDirection) {
      dirY.copyFrom(direction);
      if (shape.upDirection) {
        tmpUpDir.copyFrom(shape.upDirection);
      } else {
        tmpUpDir.set(0, 0, 1);
      }
      dirX.crossVectors(dirY, tmpUpDir).normalize();
      if (dirX.isZero()) {
        dirX.set(1, 0, 0);
      }
    } else {
      dirX.set(1, 0, 0);
      dirY.set(0, 1, 0);
    }

    const rot = tempRot;

    if (this.start3DRotation) {
      rot.set(
        this.startRotationX!.getValue(emitterLifetime),
        this.startRotationY!.getValue(emitterLifetime),
        this.startRotationZ!.getValue(emitterLifetime),
      );
    } else if (this.startRotation) {
      rot.set(0, 0, this.startRotation.getValue(emitterLifetime));
    } else {
      rot.set(0, 0, 0);
    }

    const color = this.startColor.getValue(emitterLifetime) as number[];

    if (color.length === 3) {
      color[3] = 1;
    }
    const size = tempSize;

    if (this.start3DSize) {
      size.x = this.startSizeX!.getValue(emitterLifetime);
      size.y = this.startSizeY!.getValue(emitterLifetime);
    } else {
      const n = this.startSize!.getValue(emitterLifetime);
      const aspect = this.sizeAspect!.getValue(emitterLifetime);

      size.x = n;
      size.y = aspect === 0 ? 0 : n / aspect;
    }

    const delay = this.startDelay.getValue(emitterLifetime);
    const lifetime = this.startLifetime.getValue(emitterLifetime);
    const uv = randomArrItem(this.uvs, true);

    let sprite: vec3 | undefined;
    const tsa = this.textureSheetAnimation;

    if (tsa && tsa.animate) {
      sprite = tempSprite;
      sprite[0] = tsa.animationDelay.getValue(emitterLifetime);
      sprite[1] = tsa.animationDuration.getValue(emitterLifetime);
      sprite[2] = tsa.cycles.getValue(emitterLifetime);
    }

    // --- Write to DataBuffer (local space) ---
    const i3 = slotIndex * 3;
    const i4 = slotIndex * 4;
    const i2 = slotIndex * 2;

    db.age[slotIndex] = -delay;
    db.lifetime[slotIndex] = lifetime;
    db.seed[slotIndex] = Math.random();
    db.alive[slotIndex] = 1;
    db.uniqueId[slotIndex] = emitter.uniqueIndexOffset++;

    db.initialRotation[i3] = rot.x;
    db.initialRotation[i3 + 1] = rot.y;
    db.initialRotation[i3 + 2] = rot.z;
    db.rotation[i3] = rot.x;
    db.rotation[i3 + 1] = rot.y;
    db.rotation[i3 + 2] = rot.z;

    db.simulatedPosition[i3] = position.x;
    db.simulatedPosition[i3 + 1] = position.y;
    db.simulatedPosition[i3 + 2] = position.z;

    db.velocity[i3] = direction.x * speed;
    db.velocity[i3 + 1] = direction.y * speed;
    db.velocity[i3 + 2] = direction.z * speed;
    db.initialVelocity[i3] = db.velocity[i3];
    db.initialVelocity[i3 + 1] = db.velocity[i3 + 1];
    db.initialVelocity[i3 + 2] = db.velocity[i3 + 2];

    db.color[i4] = color[0];
    db.color[i4 + 1] = color[1];
    db.color[i4 + 2] = color[2];
    db.color[i4 + 3] = color[3];
    db.initialColor[i4] = color[0];
    db.initialColor[i4 + 1] = color[1];
    db.initialColor[i4 + 2] = color[2];
    db.initialColor[i4 + 3] = color[3];

    db.size[i2] = size.x;
    db.size[i2 + 1] = size.y;
    db.initialSize[i2] = size.x;
    db.initialSize[i2 + 1] = size.y;

    db.dirX[i3] = dirX.x;
    db.dirX[i3 + 1] = dirX.y;
    db.dirX[i3 + 2] = dirX.z;
    db.dirY[i3] = dirY.x;
    db.dirY[i3 + 1] = dirY.y;
    db.dirY[i3 + 2] = dirY.z;

    if (uv) {
      db.uv[i4] = uv[0];
      db.uv[i4 + 1] = uv[1];
      db.uv[i4 + 2] = uv[2];
      db.uv[i4 + 3] = uv[3];
    }
    if (sprite) {
      db.sprite[i3] = sprite[0];
      db.sprite[i3 + 1] = sprite[1];
      db.sprite[i3 + 2] = sprite[2];
    }
    db.activeCount = Math.max(db.activeCount, slotIndex + 1);
  }
}

const tmpUpDir = new Vector3();
const tempSize = new Vector2();
const tempRot = new Euler();
const tmpDirX = new Vector3();
const tmpDirY = new Vector3();
const tempVec3 = new Vector3();
const tempEuler = new Euler();
const tempMat4 = new Matrix4();
const tempSprite: vec3 = [0, 0, 0];

function randomArrItem<T> (arr: T[], keepArr?: boolean): T {
  const index = Math.floor(Math.random() * arr.length);
  const item = arr[index];

  if (!keepArr) {
    arr.splice(index, 1);
  }

  return item;
}
