import { Euler, Matrix4, Vector2, Vector3 } from '@galacean/effects-math/es/core/index';
import type { vec3 } from '@galacean/effects-specification';
import type { ShapeParticle } from '../../shape';
import type { ParticleDataBuffer } from './particle-data-buffer';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { InitializeModuleData } from './parse-spec';

export class InitializeParticleModule extends ParticleModule {
  override readonly stage = 'particleSpawn' as const;

  private data: InitializeModuleData;

  constructor (data: InitializeModuleData) {
    super();
    this.data = data;
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
      const shapeData = this.data.shape.generate(generator);

      this.initializeToBuffer(shapeData, ctx.emitterLifetime, slotIndex, db);
    }
  }

  initializeToBuffer (
    data: ShapeParticle,
    emitterLifetime: number,
    slotIndex: number,
    db: ParticleDataBuffer,
  ): void {
    const options = this.data.options;
    const shape = this.data.shape;
    const speed = options.startSpeed.getValue(emitterLifetime);

    const position = data.position.clone();

    const direction = data.direction.clone();

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

    const delay = options.startDelay.getValue(emitterLifetime);
    const lifetime = options.startLifetime.getValue(emitterLifetime);
    const uv = randomArrItem(this.data.uvs, true);

    let sprite: vec3 | undefined;
    const tsa = this.data.textureSheetAnimation;

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
    const i9 = slotIndex * 9;

    db.age[slotIndex] = -delay;
    db.lifetime[slotIndex] = lifetime;
    db.seed[slotIndex] = Math.random();
    db.alive[slotIndex] = 1;

    db.rotation[i3] = rot.x;
    db.rotation[i3 + 1] = rot.y;
    db.rotation[i3 + 2] = rot.z;

    db.position[i3] = position.x;
    db.position[i3 + 1] = position.y;
    db.position[i3 + 2] = position.z;

    db.velocity[i3] = direction.x * speed;
    db.velocity[i3 + 1] = direction.y * speed;
    db.velocity[i3 + 2] = direction.z * speed;

    db.color[i4] = color[0];
    db.color[i4 + 1] = color[1];
    db.color[i4 + 2] = color[2];
    db.color[i4 + 3] = color[3];

    db.size[i2] = size.x;
    db.size[i2 + 1] = size.y;

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
