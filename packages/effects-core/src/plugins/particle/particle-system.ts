import type { Ray } from '@galacean/effects-math/es/core/index';
import { Vector3 } from '@galacean/effects-math/es/core/index';
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
import { ParticleEmitter } from './particle-emitter';
import { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleMeshProps } from './particle-mesh';
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
  props: ParticleSystemProps;

  readonly maskManager: MaskProcessor;

  private uvs: number[][];
  private clickedPointIndex = -1;

  private dataBuffer: ParticleDataBuffer | null = null;
  private emitter: ParticleEmitter | null = null;
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

  get time (): number {
    return this.emitter?.time ?? 0;
  }

  get timePassed () {
    return this.emitter ? this.emitter.time - this.emitter.loopStartTime : 0;
  }

  get lifetime () {
    return this.emitter ? this.timePassed / this.item.duration : 0;
  }

  get particleCount () {
    return this.emitter?.aliveCount ?? 0;
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
    return this.emitter?.frozen ?? false;
  }

  isEnded () {
    return this.emitter?.ended ?? false;
  }

  initEmitterTransform () {
    const position = this.item.transform.position.clone();
    const transformPath = this.props.emitterTransform && this.props.emitterTransform.path;
    let path;

    if (transformPath) {
      if (transformPath[0] === spec.ValueType.CONSTANT_VEC3) {
        position.add(transformPath[1]);
      } else {
        path = createValueGetter(transformPath);
      }
    }
    this.emitter!.basicTransform = { position, path };

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

  setVisible (visible: boolean) {
    this.renderer.setVisible(visible);
  }

  getTextures (): Texture[] {
    return this.renderer.getTextures();
  }

  startEmit () {
    if (!this.emitter?.started || this.emitter?.ended) {
      this.reset();
      if (this.emitter) {
        this.emitter.started = true;
        this.emitter.ended = false;
      }
    }
  }

  stop () {
    if (this.emitter) {
      this.emitter.ended = true;
      this.emitter.started = false;
    }
  }

  reset () {
    this.renderer.reset();
    this.emitter?.fullReset(this.emission.rateOverTime);
    this.emission.bursts.forEach(b => b.reset());
    this.dataBuffer?.clear();
  }

  override onStart (): void {
    if (!this.particleMeshProps) {
      return;
    }

    this.dataBuffer = new ParticleDataBuffer(this.particleMeshProps.maxCount);
    const lv = this.options.linearVelOverLifetime;
    const initModule = new InitializeParticleModule();

    initModule.setup({
      options: this.options,
      shape: this.shape,
      textureSheetAnimation: this.textureSheetAnimation,
      uvs: this.uvs,
    });

    const spawnRateModule = new SpawnRateModule(this.emission.rateOverTime);
    const solveVelocity = new SolveVelocityModule({
      gravity: this.options.gravity,
      gravityModifier: this.options.gravityModifier,
      speedOverLifetime: this.options.speedOverLifetime,
    });
    const solveRotation = new SolveRotationModule({
      rotationOverLifetime: this.particleMeshProps.rotationOverLifetime,
    });
    const solveLinearMove = new SolveLinearMoveModule({
      linearVelOverLifetime: (lv?.x || lv?.y || lv?.z) ? { ...lv, enabled: true } : undefined,
    });

    this.emitter = new ParticleEmitter();
    this.emitter.initParticleModule = initModule;

    this.renderer = this.item.addComponent(ParticleSystemRenderer);

    this.renderer.setup(this.particleMeshProps, this.trailMeshProps);
    this.renderer.maskManager = this.maskManager;
    this.meshes = this.renderer.meshes;

    this.emitter.setup({
      dataBuffer: this.dataBuffer,
      renderer: this.renderer,
      options: this.options,
      emission: this.emission,
      shape: this.shape,
      modules: [spawnRateModule, solveVelocity, solveRotation, solveLinearMove].filter(Boolean),
      trails: this.trails,
      getPointPositionF64: index => this.getPointPositionF64(index),
    });

    this.emitter.componentTransform = this.transform;
    this.initEmitterTransform();
    this.emitter.itemDuration = this.item.duration;
    this.emitter.endBehaviorValue = this.item.endBehavior;

    this.startEmit();

    this.item.on('click', ()=>{
      if (this.interaction?.behavior === spec.ParticleInteractionBehavior.removeParticle && this.clickedPointIndex >= 0) {
        this.renderer.removeParticlePoint(this.clickedPointIndex);
        if (this.trails?.dieWithParticles) {
          this.renderer.clearTrail(this.clickedPointIndex);
        }
        if (this.dataBuffer) {
          this.dataBuffer.expiry[this.clickedPointIndex] = 0;
        }
        this.clickedPointIndex = -1;
      }
    });
  }

  override onUpdate (dt: number): void {
    if (!this.emitter?.frozen) {
      this.emitter?.tick(dt);
    }
  }

  simulate (time: number) {
    this.emitter?.tick(time * 1000);
    if (this.emitter) {
      this.emitter.frozen = true;
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
    const time = this.emitter!.time - db.delayF64[index];
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
    if (this.emitter) {
      this.emitter.emissionStopped = true;
    }
  }

  resumeParticleEmission () {
    if (this.emitter) {
      this.emitter.emissionStopped = false;
    }
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

