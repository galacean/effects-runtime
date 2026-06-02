import type { Ray, Euler } from '@galacean/effects-math/es/core/index';
import { Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import type { vec3 } from '@galacean/effects-specification';
import * as spec from '@galacean/effects-specification';
import { Component } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import type { ValueGetter } from '../../math';
import { calculateTranslation, createValueGetter } from '../../math';
import type { Mesh } from '../../render';
import type { Maskable } from '../../material';
import { MaskProcessor } from '../../material';
import type { ShapeGenerator } from '../../shape';
import type { Texture } from '../../texture';
import type { BoundingBoxSphere, HitTestCustomParams } from '../interact/click-handler';
import { HitTestType } from '../interact/click-handler';
import type { Burst } from './burst';
import { InitializeParticleModule } from './initialize-particle-module';
import { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleMeshProps } from './particle-mesh';
import type { ParticleModuleContext } from './particle-module';
import { parseParticleSpec } from './parse-spec';
import { ParticleSystemRenderer } from './particle-system-renderer';
import { SolveLinearMoveModule } from './solve-linear-move-module';
import { SolveRotationModule } from './solve-rotation-module';
import { SolveVelocityModule } from './solve-velocity-module';
import { SpawnRateModule } from './spawn-rate-module';
import type { TrailMeshProps } from './trail-mesh';

type ParticleSystemRayCastOptions = {
  ray: Ray,
  radius: number,
  removeParticle?: boolean,
  multiple: boolean,
};

type ParticleOptions = {
  startSpeed: ValueGetter<number>,
  startLifetime: ValueGetter<number>,
  startDelay: ValueGetter<number>,
  startColor: ValueGetter<spec.RGBAColorValue>,
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
  turbulenceX?: ValueGetter<number>,
  turbulenceY?: ValueGetter<number>,
  turbulenceZ?: ValueGetter<number>,
  turbulence?: [
    turbulenceX: ValueGetter<number>,
    turbulenceY: ValueGetter<number>,
    turbulenceZ: ValueGetter<number>,
  ],
  // duration: number,
  looping: boolean,
  maxCount: number,
  gravity: vec3,
  gravityModifier: ValueGetter<number>,
  renderLevel?: spec.RenderLevel,
  particleFollowParent?: boolean,
  forceTarget?: { curve: ValueGetter<number>, target: spec.vec3 },
  speedOverLifetime?: ValueGetter<number>,
  linearVelOverLifetime?: { asMovement?: boolean, x?: ValueGetter<number>, y?: ValueGetter<number>, z?: ValueGetter<number>, enabled?: boolean },
  orbitalVelOverLifetime?: { asRotation?: boolean, x?: ValueGetter<number>, y?: ValueGetter<number>, z?: ValueGetter<number>, enabled?: boolean, center?: spec.vec3 },
};

type ParticleEmissionOptions = {
  rateOverTime: ValueGetter<number>,
  bursts: Burst[],
  burstOffsets: Record<string, vec3[] | null>,
};

interface ParticleTransform {
  position: Vector3,
  rotation?: Euler,
  path?: ValueGetter<vec3>,
}

type TrailOptions = {
  lifetime: ValueGetter<number>,
  minimumVertexDistance: number,
  dieWithParticles: boolean,
  sizeAffectsWidth: boolean,
  sizeAffectsLifetime: boolean,
  parentAffectsPosition: boolean,
  inheritParticleColor: boolean,
  maxPointPerTrail: number,
  colorOverLifetime: number[],
  widthOverTrail: ValueGetter<number>,
  colorOverTrail: number[],
  opacityOverLifetime: ValueGetter<number>,
  texture?: Texture,
  orderOffset?: number,
  blending: number,
  occlusion: boolean,
  transparentOcclusion: boolean,
};

interface ParticleTextureSheetAnimation {
  col: number,
  row: number,
  total: number,
  animate: boolean,
  animationDelay: ValueGetter<number>,
  animationDuration: ValueGetter<number>,
  cycles: ValueGetter<number>,
  endAtLifetime?: ValueGetter<number>,
  blend?: boolean,
}

type ParticleInteraction = {
  behavior?: spec.ParticleInteractionBehavior,
  multiple?: boolean,
  radius: number,
};

export interface ParticleSystemProps extends spec.ParticleContent {
}

@effectsClass(spec.DataType.ParticleSystem)
export class ParticleSystem extends Component implements Maskable {
  renderer: ParticleSystemRenderer;
  options: ParticleOptions;
  shape: ShapeGenerator;
  emission: ParticleEmissionOptions;
  trails: Pick<TrailOptions, 'lifetime' | 'dieWithParticles' | 'sizeAffectsLifetime' | 'sizeAffectsWidth' | 'inheritParticleColor' | 'parentAffectsPosition'>;
  meshes: Mesh[];
  textureSheetAnimation?: ParticleTextureSheetAnimation;
  interaction?: ParticleInteraction;
  emissionStopped: boolean;
  props: ParticleSystemProps;
  time: number;

  readonly maskManager: MaskProcessor;

  private generatedCount: number;
  private loopStartTime: number;
  private aliveCount = 0;
  private nextSlotIndex = 0;
  private started: boolean;
  private ended: boolean;
  private spawnRateModule: SpawnRateModule;
  private frozen: boolean;
  private upDirectionWorld: Vector3 | null;
  private uvs: number[][];
  private basicTransform: ParticleTransform;
  private clickedPointIndex = -1;

  private dataBuffer: ParticleDataBuffer | null = null;
  private solveVelocityModule: SolveVelocityModule | null = null;
  private solveRotationModule: SolveRotationModule | null = null;
  private solveLinearMoveModule: SolveLinearMoveModule | null = null;
  private initParticleModule = new InitializeParticleModule();
  private particleMeshProps: ParticleMeshProps | null = null;
  private trailMeshProps: TrailMeshProps | null = null;

  constructor (
    engine: Engine,
    props?: spec.ParticleSystemData,
  ) {
    super(engine);

    this.maskManager = new MaskProcessor();

    if (props) {
      this.fromData(props);
    }
  }

  get timePassed () {
    return this.time - this.loopStartTime;
  }

  get lifetime () {
    return this.timePassed / this.item.duration;
  }

  get particleCount () {
    return this.aliveCount;
  }

  /**
   * 获取当前粒子系统的最大粒子数。当系统的粒子数量达到最大值时，发射器会暂时停止发射粒子。
   * @since 2.3.0
   */
  get maxParticles () {
    return this.options.maxCount;
  }

  /**
   * 设置当前粒子系统的最大粒子数。当系统的粒子数量达到最大值时，发射器会暂时停止发射粒子。
   * 注意：暂时不支持增加拖尾数量
   * @since 2.3.0
   */
  set maxParticles (count: number) {
    this.options.maxCount = count;
    if (this.renderer?.particleMesh) {
      this.renderer.particleMesh.maxCount = count;
    }
  }

  isFrozen () {
    return this.frozen;
  }

  isEnded () {
    return this.ended;
  }

  initEmitterTransform () {
    const position = this.item.transform.position.clone();
    const rotation = this.item.transform.rotation.clone();
    const transformPath = this.props.emitterTransform && this.props.emitterTransform.path;
    let path;

    if (transformPath) {
      if (transformPath[0] === spec.ValueType.CONSTANT_VEC3) {
        position.add(transformPath[1]);
      } else {
        path = createValueGetter(transformPath);
      }
    }
    this.basicTransform = {
      position, rotation, path,
    };

    const selfPos = position.clone();

    if (path) {
      selfPos.add(path.getValue(0));
    }
    this.transform.setPosition(selfPos.x, selfPos.y, selfPos.z);

    if (this.options.particleFollowParent) {
      const worldMatrix = this.transform.getWorldMatrix();

      this.renderer.updateWorldMatrix(worldMatrix);
    }
  }

  private updateEmitterTransform (time: number) {
    const { path, position } = this.basicTransform;
    const selfPos = position.clone();

    if (path) {
      const duration = this.item.duration;

      selfPos.add(path.getValue(time / duration));
    }
    this.transform.setPosition(selfPos.x, selfPos.y, selfPos.z);

    if (this.options.particleFollowParent) {
      const worldMatrix = this.transform.getWorldMatrix();

      this.renderer.updateWorldMatrix(worldMatrix);
    }
  }

  private allocateSlot (maxCount: number): number {
    const db = this.dataBuffer!;

    if (this.nextSlotIndex < maxCount) {
      return this.nextSlotIndex++;
    }

    return this.findOldestSlot(db);
  }

  private commitParticle (slotIndex: number, maxCount: number) {
    const db = this.dataBuffer!;

    db.alive[slotIndex] = 1;
    db.expiry[slotIndex] = db.delayF64[slotIndex] + db.lifetimeF64[slotIndex];
    this.aliveCount = Math.min(this.aliveCount + 1, maxCount);

    db.seed[slotIndex] = Math.random();
    this.renderer.particleMesh.setPointFromBuffer(slotIndex, db);
    this.clearPointTrail(slotIndex);
    if (this.transform.parentTransform) {
      this.renderer.setTrailStartPosition(slotIndex, this.transform.parentTransform.position.clone());
    }
  }

  private findOldestSlot (db: ParticleDataBuffer): number {
    let minIdx = 0;
    let minExpiry = Infinity;

    for (let i = 0; i < db.maxCount; i++) {
      if (db.alive[i] && db.expiry[i] <= minExpiry) {
        minExpiry = db.expiry[i];
        minIdx = i;
      }
    }

    return minIdx;
  }

  setVisible (visible: boolean) {
    this.renderer.setVisible(visible);
  }

  getTextures (): Texture[] {
    return this.renderer.getTextures();
  }

  startEmit () {
    if (!this.started || this.ended) {
      this.reset();
      this.started = true;
      this.ended = false;
    }
  }

  stop () {
    this.ended = true;
    this.started = false;
  }

  reset () {
    this.renderer.reset();
    this.time = 0;
    this.loopStartTime = 0;
    this.spawnRateModule = new SpawnRateModule(this.emission.rateOverTime);
    this.generatedCount = 0;
    this.aliveCount = 0;
    this.nextSlotIndex = 0;
    this.emission.bursts.forEach(b => b.reset());
    this.frozen = false;
    this.ended = false;
    this.dataBuffer?.clear();
  }

  override onStart (): void {
    if (!this.particleMeshProps) {
      return;
    }

    this.dataBuffer = new ParticleDataBuffer(this.particleMeshProps.maxCount);
    this.initParticleModule.setup({
      options: this.options,
      shape: this.shape,
      textureSheetAnimation: this.textureSheetAnimation,
      uvs: this.uvs,
    });
    const lv = this.options.linearVelOverLifetime;

    this.solveVelocityModule = new SolveVelocityModule({
      gravity: this.options.gravity,
      gravityModifier: this.options.gravityModifier,
      speedOverLifetime: this.options.speedOverLifetime,
    });
    this.solveRotationModule = new SolveRotationModule({
      rotationOverLifetime: this.particleMeshProps.rotationOverLifetime,
    });
    this.solveLinearMoveModule = new SolveLinearMoveModule({
      linearVelOverLifetime: (lv?.x || lv?.y || lv?.z) ? { ...lv, enabled: true } : undefined,
    });
    this.renderer = this.item.addComponent(ParticleSystemRenderer);

    this.renderer.setup(this.particleMeshProps, this.trailMeshProps);
    this.renderer.maskManager = this.maskManager;
    this.meshes = this.renderer.meshes;

    this.startEmit();
    this.initEmitterTransform();

    this.item.on('click', ()=>{
      if (this.interaction?.behavior === spec.ParticleInteractionBehavior.removeParticle && this.clickedPointIndex >= 0) {
        this.renderer.removeParticlePoint(this.clickedPointIndex);
        this.clearPointTrail(this.clickedPointIndex);
        if (this.dataBuffer) {
          this.dataBuffer.expiry[this.clickedPointIndex] = 0;
        }
        this.clickedPointIndex = -1;
      }
    });
  }

  override onUpdate (dt: number): void {
    if (!this.frozen) {
      this.update(dt);
    }
  }

  simulate (time: number) {
    this.update(time * 1000);
    this.frozen = true;
  }

  private update (delta: number) {
    if (this.started) {
      const now = this.time + delta / 1000;
      const options = this.options;
      const loopStartTime = this.loopStartTime;
      const emission = this.emission;

      this.time = now;
      this.upDirectionWorld = null;
      this.renderer.updateTime(now, delta);

      this.executeModules(delta, now);

      const emitterLifetime = (now - loopStartTime) / this.item.duration;
      const timePassed = this.timePassed;
      let trailUpdated = false;
      const updateTrail = () => {
        if (this.trails && !trailUpdated) {
          trailUpdated = true;
          const trailDb = this.dataBuffer!;

          for (let ti = 0; ti < trailDb.activeCount; ti++) {
            if (!trailDb.alive[ti]) {
              continue;
            }
            if (trailDb.expiry[ti] < timePassed) {
              this.clearPointTrail(ti);
            } else if (timePassed > trailDb.delayF64[ti]) {
              this.updatePointTrail(ti, emitterLifetime, trailDb.delayF64[ti]);
            }
          }
        }
      };

      if (!this.ended) {
        const duration = this.item.duration;
        const lifetime = this.lifetime;

        if (timePassed < duration) {
          const spawnResult = this.spawnRateModule.compute(timePassed, lifetime);
          const maxEmissionCount = spawnResult.pointCount;
          const timeDelta = spawnResult.timeDelta;
          const meshTime = now;
          const maxCount = options.maxCount;

          this.updateEmitterTransform(timePassed);
          const worldMatrix = this.options.particleFollowParent ? Matrix4.IDENTITY : this.transform.getWorldMatrix();
          const shouldSkipGenerate = () => {
            if (this.emissionStopped) {
              return true;
            }
            if (this.aliveCount < maxCount) {
              return false;
            }
            const db = this.dataBuffer!;
            let minExp = Infinity;

            for (let s = 0; s < db.maxCount; s++) {
              if (db.alive[s] && db.expiry[s] < minExp) {
                minExp = db.expiry[s];
              }
            }

            return (minExp - loopStartTime) > timePassed;
          };

          for (let i = 0; i < maxEmissionCount && i < maxCount; i++) {
            if (shouldSkipGenerate()) {
              break;
            }
            const slotIdx = this.allocateSlot(maxCount);
            const generator = {
              total: emission.rateOverTime.getValue(lifetime),
              index: this.generatedCount,
              burstIndex: 0,
              burstCount: 0,
            };

            this.generatedCount++;
            const result = this.initParticleModule.initializeToBuffer(
              this.shape.generate(generator), lifetime, worldMatrix, this.transform, this.upDirectionWorld, slotIdx, this.dataBuffer!,
            );

            this.upDirectionWorld = result.upDirectionWorld;
            const db = this.dataBuffer!;

            db.delay[slotIdx] += meshTime + i * timeDelta;
            db.delayF64[slotIdx] += meshTime + i * timeDelta;
            this.commitParticle(slotIdx, maxCount);
            this.spawnRateModule.commitEmit(timePassed);
          }
          const bursts = emission.bursts;

          for (let j = bursts?.length - 1, cursor = 0; j >= 0 && cursor < maxCount; j--) {
            if (shouldSkipGenerate()) {
              break;
            }
            const burst = bursts[j];
            const opts = !burst.disabled && burst.getGeneratorOptions(timePassed, lifetime);

            if (opts) {
              const originVec = [0, 0, 0] as vec3;
              const offsets = emission.burstOffsets[j];
              const burstOffset = (offsets && offsets[opts.cycleIndex]) || originVec;

              if (burst.once) {
                this.removeBurst(j);
              }

              for (let i = 0; i < opts.count && cursor < maxCount; i++) {
                if (shouldSkipGenerate()) {
                  break;
                }
                const slotIdx = this.allocateSlot(maxCount);
                const result = this.initParticleModule.initializeToBuffer(
                  this.shape.generate({
                    total: opts.total,
                    index: opts.index,
                    burstIndex: i,
                    burstCount: opts.count,
                  }), lifetime, worldMatrix, this.transform, this.upDirectionWorld, slotIdx, this.dataBuffer!,
                );

                this.upDirectionWorld = result.upDirectionWorld;
                const db = this.dataBuffer!;
                const si3 = slotIdx * 3;

                db.delay[slotIdx] += meshTime;
                db.delayF64[slotIdx] += meshTime;
                db.position[si3] += burstOffset[0];
                db.position[si3 + 1] += burstOffset[1];
                db.position[si3 + 2] += burstOffset[2];
                db.positionF64[si3] += burstOffset[0];
                db.positionF64[si3 + 1] += burstOffset[1];
                db.positionF64[si3 + 2] += burstOffset[2];
                cursor++;
                this.commitParticle(slotIdx, maxCount);
              }
            }
          }
        } else if (this.options.looping) {
          updateTrail();
          this.loopStartTime = now - duration;
          this.spawnRateModule.adjustForLoop(duration);
          this.time -= duration;
          emission.bursts.forEach(b => b.reset());
          if (this.dataBuffer) {
            for (let li = 0; li < this.dataBuffer.activeCount; li++) {
              if (this.dataBuffer.alive[li]) {
                this.dataBuffer.expiry[li] -= duration;
                this.dataBuffer.delay[li] -= duration;
                this.dataBuffer.delayF64[li] -= duration;
              }
            }
          }

          this.renderer.minusTimeForLoop(duration);
          if (this.dataBuffer) {
            for (let i = 0; i < this.dataBuffer.activeCount; i++) {
              this.dataBuffer.delay[i] -= duration;
            }
          }
        } else {
          this.ended = true;
          const endBehavior = this.item.endBehavior;

          if (endBehavior === spec.EndBehavior.freeze) {
            this.frozen = true;
          }
        }
      }
      updateTrail();
    }
  }

  drawStencilMask (maskRef: number): void {
    if (!this.isActiveAndEnabled) {
      return;
    }

    for (const mesh of this.renderer.meshes) {
      this.maskManager.drawGeometryMask(this.engine.renderer, mesh.geometry, mesh.worldMatrix, mesh.material, maskRef);
    }
  }

  override onDestroy (): void {
    if (this.item && this.item.composition) {
      this.meshes.forEach(mesh => mesh.dispose());
    }
  }

  getParticleBoxes (): { center: Vector3, size: Vector3 }[] {
    const db = this.dataBuffer;
    const res: { center: Vector3, size: Vector3 }[] = [];

    if (!db || !this.renderer) {
      return res;
    }
    for (let i = 0; i < db.activeCount; i++) {
      if (!db.alive[i] || db.expiry[i] <= this.timePassed) {
        continue;
      }
      const pos = this.getPointPositionF64(i);
      const bi2 = i * 2;

      res.push({
        center: pos,
        size: new Vector3(db.sizeF64[bi2], db.sizeF64[bi2 + 1], 1),
      });
    }

    return res;
  }

  raycast (options: ParticleSystemRayCastOptions): Vector3[] | undefined {
    const db = this.dataBuffer;

    if (!db || !this.renderer) {
      return;
    }
    const hitPositions: Vector3[] = [];
    const temp = new Vector3();

    for (let i = db.activeCount - 1; i >= 0; i--) {
      if (!db.alive[i] || db.expiry[i] <= this.timePassed) {
        continue;
      }
      const pos = this.getPointPositionF64(i);
      const ray = options.ray;

      if (ray && ray.intersectSphere({ center: pos, radius: options.radius }, temp)) {
        this.clickedPointIndex = i;
        hitPositions.push(pos);
        if (!options.multiple) {
          break;
        }
      }
    }

    return hitPositions;
  }

  clearPointTrail (pointIndex: number) {
    if (this.trails && this.trails.dieWithParticles) {
      this.renderer.clearTrail(pointIndex);
    }
  }

  updatePointTrail (pointIndex: number, emitterLifetime: number, startTime: number) {
    const renderer = this.renderer;

    if (!renderer.hasTrail()) {
      return;
    }
    const trails = this.trails;
    const position = this.getPointPositionF64(pointIndex);
    const color = trails.inheritParticleColor ? renderer.getParticlePointColor(pointIndex) : [1, 1, 1, 1];
    const db = this.dataBuffer!;
    const si2 = pointIndex * 2;
    const size: vec3 = [db.sizeF64[si2], db.sizeF64[si2 + 1], 1];

    let width = 1;
    let lifetime = trails.lifetime.getValue(emitterLifetime);

    if (trails.sizeAffectsWidth) {
      width *= size[0];
    }
    if (trails.sizeAffectsLifetime) {
      lifetime *= size[0];
    }
    if (trails.parentAffectsPosition && this.transform.parentTransform) {
      position.add(this.transform.parentTransform.position);
      const pos = renderer.getTrailStartPosition(pointIndex);

      if (pos) {
        position.subtract(pos);
      }
    }
    renderer.addTrailPoint(pointIndex, position, {
      color,
      lifetime,
      size: width,
      time: startTime,
    });
  }

  /**
   * 通过索引获取指定index粒子当前时刻的位置
   * @params index - 粒子索引
   */
  getPointPositionByIndex (index: number): Vector3 | null {
    const db = this.dataBuffer;

    if (!db || index < 0 || index >= db.activeCount || !db.alive[index]) {
      console.error('Get point error.');

      return null;
    }

    return this.getPointPositionF64(index);
  }

  /**
   * 通过粒子参数获取当前时刻粒子的位置
   */
  getPointPositionF64 (index: number): Vector3 {
    const db = this.dataBuffer!;
    const i3 = index * 3;
    const time = this.time - db.delayF64[index];
    const lifetime = db.lifetimeF64[index];

    const tempPos = new Vector3(db.positionF64[i3], db.positionF64[i3 + 1], db.positionF64[i3 + 2]);
    const vel = new Vector3(db.velocityF64[i3], db.velocityF64[i3 + 1], db.velocityF64[i3 + 2]);
    const acc = new Vector3(db.gravityF64[i3], db.gravityF64[i3 + 1], db.gravityF64[i3 + 2]);

    const ret = calculateTranslation(new Vector3(), this.options, acc, time, lifetime, tempPos, vel);

    const forceTarget = this.options.forceTarget;

    if (forceTarget) {
      const target = forceTarget.target || [0, 0, 0];
      const life = forceTarget.curve.getValue(time / lifetime);
      const dl = 1 - life;

      ret.x = ret.x * dl + target[0] * life;
      ret.y = ret.y * dl + target[1] * life;
      ret.z = ret.z * dl + target[2] * life;
    }

    return ret;
  }

  addBurst (burst: Burst, offsets: vec3[]) {
    let willAdd = false;

    if (!this.emission.bursts.includes(burst)) {
      this.emission.bursts.push(burst);
      willAdd = true;
    }
    if (willAdd && offsets instanceof Array) {
      const index = this.emission.bursts.indexOf(burst);

      this.emission.burstOffsets[index] = offsets;

      return index;
    }

    return -1;
  }

  removeBurst (index: number) {
    if (index < this.emission.bursts.length) {
      this.emission.burstOffsets[index] = null;
      this.emission.bursts.splice(index, 1);
    }
  }

  stopParticleEmission () {
    this.emissionStopped = true;
  }

  resumeParticleEmission () {
    this.emissionStopped = false;
  }

  getBoundingBox (): void | BoundingBoxSphere {
    const area = this.getParticleBoxes();

    return {
      type: HitTestType.sphere,
      area,
    };
  }

  getHitTestParams = (force?: boolean): void | HitTestCustomParams => {
    const interactParams = this.interaction;

    if (force || interactParams) {
      return {
        type: HitTestType.custom,
        clipMasks:this.renderer.frameClipMasks,
        collect: (ray: Ray): Vector3[] | void =>
          this.raycast({
            radius: interactParams?.radius || 0.4,
            multiple: !!interactParams?.multiple,
            removeParticle: interactParams?.behavior === spec.ParticleInteractionBehavior.removeParticle,
            ray,
          }),
      };
    }
  };

  private executeModules (delta: number, now: number): void {
    const db = this.dataBuffer;

    if (!db || db.activeCount === 0) {
      return;
    }

    const ctx: ParticleModuleContext = {
      deltaTime: delta,
      currentTime: now,
      emitterLifetime: this.lifetime,
      duration: this.item.duration,
      dataBuffer: db,
      firstIndex: 0,
      lastIndex: db.activeCount,
    };

    this.solveVelocityModule?.execute(ctx);
    this.solveRotationModule?.execute(ctx);
    this.solveLinearMoveModule?.execute(ctx);

    this.syncToGeometry();
  }

  private syncToGeometry (): void {
    const db = this.dataBuffer;

    if (!db || db.activeCount === 0) {
      return;
    }
    const geometry = this.renderer.particleMesh.geometry;
    const aTranslation = geometry.getAttributeData('aTranslation') as Float32Array;
    const count = Math.min(db.activeCount, Math.floor(aTranslation.length / 12));

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const gOff = i * 12;
      const tx = db.translation[i3];
      const ty = db.translation[i3 + 1];
      const tz = db.translation[i3 + 2];

      for (let v = 0; v < 4; v++) {
        const vOff = gOff + v * 3;

        aTranslation[vOff] = tx;
        aTranslation[vOff + 1] = ty;
        aTranslation[vOff + 2] = tz;
      }
    }
    geometry.setAttributeData('aTranslation', aTranslation);

    // Sync rotation matrix (9 floats per particle → 36 per quad)
    const aRotation0 = geometry.getAttributeData('aRotation0') as Float32Array;
    const rotCount = Math.min(db.activeCount, Math.floor(aRotation0.length / 36));

    for (let i = 0; i < rotCount; i++) {
      const i9 = i * 9;
      const gOff = i * 36;

      for (let v = 0; v < 4; v++) {
        const vOff = gOff + v * 9;

        for (let c = 0; c < 9; c++) {
          aRotation0[vOff + c] = db.rotMatrix[i9 + c];
        }
      }
    }
    geometry.setAttributeData('aRotation0', aRotation0);

    // Sync linear move (3 floats per particle → 12 per quad)
    const aLinearMove = geometry.getAttributeData('aLinearMove') as Float32Array;
    const lmCount = Math.min(db.activeCount, Math.floor(aLinearMove.length / 12));

    for (let i = 0; i < lmCount; i++) {
      const i3 = i * 3;
      const gOff = i * 12;
      const mx = db.linearMove[i3];
      const my = db.linearMove[i3 + 1];
      const mz = db.linearMove[i3 + 2];

      for (let v = 0; v < 4; v++) {
        const vOff = gOff + v * 3;

        aLinearMove[vOff] = mx;
        aLinearMove[vOff + 1] = my;
        aLinearMove[vOff + 2] = mz;
      }
    }
    geometry.setAttributeData('aLinearMove', aLinearMove);
  }

  override fromData (data: spec.ParticleSystemData): void {
    super.fromData(data);
    this.props = data;
    this.name = 'ParticleSystem';

    if (data.mask) {
      this.maskManager.setMaskOptions(this.engine, data.mask);
    }

    const result = parseParticleSpec(data, this.engine);

    this.options = result.options;
    this.emission = result.emission;
    this.shape = result.shape;
    this.textureSheetAnimation = result.textureSheetAnimation;
    this.uvs = result.uvs;
    this.interaction = result.interaction;

    result.particleMeshProps.mask = this.maskManager.getRefValue();
    result.particleMeshProps.maskMode = this.maskManager.maskMode;
    this.particleMeshProps = result.particleMeshProps;

    if (result.trails) {
      this.trails = result.trails;
    }
    if (result.trailMeshProps) {
      result.trailMeshProps.mask = this.maskManager.getRefValue();
      result.trailMeshProps.maskMode = this.maskManager.maskMode;
      this.trailMeshProps = result.trailMeshProps;
    }

    this.item.getHitTestParams = this.getHitTestParams;
  }
}

