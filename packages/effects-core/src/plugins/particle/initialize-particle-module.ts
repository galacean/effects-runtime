import { Euler, Matrix4, Vector2, Vector3 } from '@galacean/effects-math/es/core/index';
import type { vec3 } from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import type { ShapeGenerator, ShapeParticle } from '../../shape';
import type { Transform } from '../../transform';
import type { ParticleDataBuffer } from './particle-data-buffer';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext, ParticleSpawnContext } from './particle-module';

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

export class InitializeParticleModule extends ParticleModule {
  override readonly stage = 'particleSpawn' as const;

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

  override execute (ctx: ParticleModuleContext): void {
    const spawnCtx = ctx as ParticleSpawnContext;
    const db = ctx.dataBuffer;
    const emitter = ctx.emitter;
    const worldMatrix = spawnCtx.worldMatrix;
    const slotIndices = spawnCtx.slotIndices;

    for (let idx = 0; idx < slotIndices.length; idx++) {
      const slotIndex = slotIndices[idx];
      const generator = emitter.getSpawnGenerator(idx);
      const data = this.shape.generate(generator);
      const result = this.initializeToBuffer(
        data, ctx.emitterLifetime, worldMatrix,
        emitter.componentTransform, emitter.upDirectionWorld,
        slotIndex, db,
      );

      emitter.upDirectionWorld = result.upDirectionWorld;
    }
  }

  initializeToBuffer (
    data: ShapeParticle,
    emitterLifetime: number,
    worldMatrix: Matrix4,
    emitterTransform: Transform,
    upDirectionWorld: Vector3 | null,
    slotIndex: number,
    db: ParticleDataBuffer,
  ): { upDirectionWorld: Vector3 | null } {
    const options = this.options;
    const shape = this.shape;
    const speed = options.startSpeed.getValue(emitterLifetime);
    const matrix4 = options.particleFollowParent ? Matrix4.IDENTITY : worldMatrix;

    const position = matrix4.transformPoint(data.position, new Vector3());

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

    const vel = direction.clone();

    vel.multiply(speed);

    if (!options.particleFollowParent) {
      const tempScale = new Vector3();

      emitterTransform.assignWorldTRS(undefined, undefined, tempScale);
      size.x *= tempScale.x;
      size.y *= tempScale.y;
    }

    const delay = options.startDelay.getValue(emitterLifetime);
    const lifetime = options.startLifetime.getValue(emitterLifetime);
    const uv = randomArrItem(this.uvs, true);
    const gravity = options.gravity;

    let sprite: vec3 | undefined;
    const tsa = this.textureSheetAnimation;

    if (tsa && tsa.animate) {
      sprite = tempSprite;
      sprite[0] = tsa.animationDelay.getValue(emitterLifetime);
      sprite[1] = tsa.animationDuration.getValue(emitterLifetime);
      sprite[2] = tsa.cycles.getValue(emitterLifetime);
    }

    // --- Write to DataBuffer ---
    const i3 = slotIndex * 3;
    const i4 = slotIndex * 4;
    const i2 = slotIndex * 2;
    const i9 = slotIndex * 9;

    db.delay[slotIndex] = delay;
    db.lifetime[slotIndex] = lifetime;
    db.delayF64[slotIndex] = delay;
    db.lifetimeF64[slotIndex] = lifetime;

    db.rotation[i3] = rot.x;
    db.rotation[i3 + 1] = rot.y;
    db.rotation[i3 + 2] = rot.z;

    db.position[i3] = position.x;
    db.position[i3 + 1] = position.y;
    db.position[i3 + 2] = position.z;
    db.positionF64[i3] = position.x;
    db.positionF64[i3 + 1] = position.y;
    db.positionF64[i3 + 2] = position.z;

    db.velocity[i3] = vel.x;
    db.velocity[i3 + 1] = vel.y;
    db.velocity[i3 + 2] = vel.z;
    db.velocityF64[i3] = vel.x;
    db.velocityF64[i3 + 1] = vel.y;
    db.velocityF64[i3 + 2] = vel.z;

    db.color[i4] = color[0];
    db.color[i4 + 1] = color[1];
    db.color[i4 + 2] = color[2];
    db.color[i4 + 3] = color[3];

    db.size[i2] = size.x;
    db.size[i2 + 1] = size.y;
    db.sizeF64[i2] = size.x;
    db.sizeF64[i2 + 1] = size.y;

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
    if (gravity) {
      db.gravity[i3] = gravity[0];
      db.gravity[i3 + 1] = gravity[1];
      db.gravity[i3 + 2] = gravity[2];
      db.gravityF64[i3] = gravity[0];
      db.gravityF64[i3 + 1] = gravity[1];
      db.gravityF64[i3 + 2] = gravity[2];
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

    db.activeCount = Math.max(db.activeCount, slotIndex + 1);

    return { upDirectionWorld };
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
