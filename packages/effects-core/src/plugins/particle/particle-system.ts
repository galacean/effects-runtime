import type { Ray } from '@galacean/effects-math/es/core/index';
import { Euler, Matrix4, Vector2, Vector3 } from '@galacean/effects-math/es/core/index';
import type { vec3, vec4 } from '@galacean/effects-specification';
import * as spec from '@galacean/effects-specification';
import { Component } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import type { ValueGetter } from '../../math';
import { calculateTranslation, createValueGetter } from '../../math';
import type { Mesh } from '../../render';
import type { Maskable } from '../../material';
import { MaskProcessor } from '../../material';
import type { ShapeGenerator, ShapeGeneratorOptions, ShapeParticle } from '../../shape';
import type { Texture } from '../../texture';
import { Transform } from '../../transform';
import type { BoundingBoxSphere, HitTestCustomParams } from '../interact/click-handler';
import { HitTestType } from '../interact/click-handler';
import type { Burst } from './burst';
import type { LinkNode } from './link';
import { Link } from './link';
import { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleMeshProps, Point } from './particle-mesh';
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

// 粒子节点包含的数据
export type ParticleContent = [number, number, number, Point]; // delay + lifetime, particleIndex, delay, pointData

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
  private particleLink: Link<ParticleContent>;
  private started: boolean;
  private ended: boolean;
  private spawnRateModule: SpawnRateModule;
  private frozen: boolean;
  private upDirectionWorld: Vector3 | null;
  private uvs: number[][];
  private basicTransform: ParticleTransform;
  private clickedPoint: LinkNode<ParticleContent>;

  private dataBuffer: ParticleDataBuffer | null = null;
  private solveVelocityModule: SolveVelocityModule | null = null;
  private solveRotationModule: SolveRotationModule | null = null;
  private solveLinearMoveModule: SolveLinearMoveModule | null = null;
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
    return this.particleLink.length;
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

  private addParticle (point: Point, maxCount: number) {
    const link = this.particleLink;
    const linkContent: ParticleContent = [point.delay + point.lifetime, 0, point.delay, point];
    let pointIndex;

    if (link.length < maxCount) {
      pointIndex = linkContent[1] = link.length;
    } else {
      const first = link.first;

      link.removeNode(first);
      pointIndex = linkContent[1] = first.content[1];
    }
    link.pushNode(linkContent);
    this.renderer.setParticlePoint(pointIndex, point);
    this.writePointToDataBuffer(pointIndex, point);
    this.clearPointTrail(pointIndex);
    if (this.transform.parentTransform) {
      this.renderer.setTrailStartPosition(pointIndex, this.transform.parentTransform.position.clone());
    }
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
    this.particleLink = new Link((a, b) => a[0] - b[0]);
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
      if (this.interaction?.behavior === spec.ParticleInteractionBehavior.removeParticle) {
        const pointIndex = this.clickedPoint.content[1];

        this.renderer.removeParticlePoint(pointIndex);
        this.clearPointTrail(pointIndex);
        this.clickedPoint.content = [0] as unknown as ParticleContent;
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

      const link = this.particleLink;
      const emitterLifetime = (now - loopStartTime) / this.item.duration;
      const timePassed = this.timePassed;
      let trailUpdated = false;
      const updateTrail = () => {
        if (this.trails && !trailUpdated) {
          trailUpdated = true;
          link.forEach(([time, pointIndex, delay, point]) => {
            if (time < timePassed) {
              this.clearPointTrail(pointIndex);
            } else if (timePassed > delay) {
              this.updatePointTrail(pointIndex, emitterLifetime, point, delay);
            }
          });
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
          const shouldSkipGenerate = () => {
            const first = link.first;

            return this.emissionStopped || (link.length === maxCount && first && (first.content[0] - loopStartTime) > timePassed);
          };

          for (let i = 0; i < maxEmissionCount && i < maxCount; i++) {
            if (shouldSkipGenerate()) {
              break;
            }
            const p = this.createPoint(lifetime);

            p.delay += meshTime + i * timeDelta;
            this.addParticle(p, maxCount);
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
                const p = this.initPoint(this.shape.generate({
                  total: opts.total,
                  index: opts.index,
                  burstIndex: i,
                  burstCount: opts.count,
                }));

                p.delay += meshTime;
                cursor++;
                p.transform.translate(...burstOffset);

                this.addParticle(p, maxCount);
              }
            }
          }
        } else if (this.options.looping) {
          updateTrail();
          this.loopStartTime = now - duration;
          this.spawnRateModule.adjustForLoop(duration);
          this.time -= duration;
          emission.bursts.forEach(b => b.reset());
          this.particleLink.forEach(content => {
            content[0] -= duration;
            content[2] -= duration;

            // TODO 优化粒子销毁逻辑
            if (content[3]) {
              content[3].delay -= duration;
            }
          });

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
    const link = this.particleLink;
    const renderer = this.renderer;
    const res: { center: Vector3, size: Vector3 }[] = [];
    const maxCount = this.particleCount;
    let counter = 0;

    if (!(link && renderer)) {
      return res;
    }
    let node = link.last;
    let finish = false;

    while (!finish) {
      const currentTime = node.content[0];
      const point = node.content[3];

      if (currentTime > this.timePassed) {
        const pos = this.getPointPosition(point);

        res.push({
          center: pos,
          size: point.transform.scale,
        });
        if (node.pre) {
          node = node.pre;
        } else {
          finish = true;
        }
      }
      counter++;
      if (counter > maxCount) {
        finish = true;
      }
    }

    return res;
  }

  raycast (options: ParticleSystemRayCastOptions): Vector3[] | undefined {
    const link = this.particleLink;
    const renderer = this.renderer;

    if (!(link && renderer)) {
      return;
    }
    let node = link.last;
    const hitPositions = [];
    const temp = new Vector3();
    let finish = false;

    if (node && node.content) {
      do {
        const [currentTime,, _, point] = node.content;

        if (currentTime > this.timePassed) {
          const pos = this.getPointPosition(point);
          const ray = options.ray;
          let pass = false;

          if (ray) {
            pass = !!ray.intersectSphere({
              center: pos,
              radius: options.radius,
            }, temp);
          }
          if (pass) {
            this.clickedPoint = node;
            hitPositions.push(pos);
            if (!options.multiple) {
              finish = true;
            }
          }
        }
        // @ts-expect-error
      } while ((node = node.pre) && !finish);
    }

    return hitPositions;
  }

  clearPointTrail (pointIndex: number) {
    if (this.trails && this.trails.dieWithParticles) {
      this.renderer.clearTrail(pointIndex);
    }
  }

  updatePointTrail (pointIndex: number, emitterLifetime: number, point: Point, startTime: number) {
    const renderer = this.renderer;

    if (!renderer.hasTrail()) {
      return;
    }
    const trails = this.trails;
    const position = this.getPointPosition(point);
    const color = trails.inheritParticleColor ? renderer.getParticlePointColor(pointIndex) : [1, 1, 1, 1];
    const size: vec3 = point.transform.getWorldScale().toArray();

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
    const point = this.particleLink.getNodeByIndex(index);

    if (!point) {
      console.error('Get point error.');

      return null;
    } else {
      return this.getPointPosition(point.content[3]);
    }
  }

  /**
   * 通过粒子参数获取当前时刻粒子的位置
   */
  getPointPosition (point: Point): Vector3 {
    const {
      transform,
      vel,
      lifetime,
      delay,
      gravity = [],
    } = point;

    const forceTarget = this.options.forceTarget;
    const time = this.time - delay;

    const tempPos = new Vector3();
    const acc = Vector3.fromArray(gravity);

    transform.assignWorldTRS(tempPos);
    const ret = calculateTranslation(new Vector3(), this.options, acc, time, lifetime, tempPos, vel);

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

  initPoint (data: ShapeParticle): Point {
    const options = this.options;
    const lifetime = this.lifetime;
    const shape = this.shape;
    const speed = options.startSpeed.getValue(lifetime);
    const matrix4 = options.particleFollowParent ? Matrix4.IDENTITY : this.transform.getWorldMatrix();
    const pointPosition: Vector3 = data.position;

    // 粒子的位置受发射器的位置影响，自身的旋转和缩放不受影响
    const position = matrix4.transformPoint(pointPosition, new Vector3());
    const transform = new Transform({
      position,
      valid: true,
    });

    let direction = data.direction;

    direction = matrix4.transformNormal(direction, tempDir).normalize();
    if (options.startTurbulence && options.turbulence) {
      for (let i = 0; i < 3; i++) {
        tempVec3.setElement(i, options.turbulence[i].getValue(lifetime));
      }
      tempEuler.setFromVector3(tempVec3.negate());
      const mat4 = tempMat4.setFromEuler(tempEuler);

      mat4.transformNormal(direction).normalize();
    }
    const dirX = tmpDirX;
    const dirY = tmpDirY;

    if (shape.alignSpeedDirection) {
      dirY.copyFrom(direction);
      if (!this.upDirectionWorld) {
        if (shape.upDirection) {
          this.upDirectionWorld = shape.upDirection.clone();
        } else {
          this.upDirectionWorld = Vector3.Z.clone();
        }
        matrix4.transformNormal(this.upDirectionWorld);
      }
      dirX.crossVectors(dirY, this.upDirectionWorld).normalize();
      // FIXME: 原先因为有精度问题，这里dirX不是0向量
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
      sprite[0] = tsa.animationDelay.getValue(lifetime);
      sprite[1] = tsa.animationDuration.getValue(lifetime);
      sprite[2] = tsa.cycles.getValue(lifetime);
    }
    const rot = tempRot;

    if (options.start3DRotation) {
      // @ts-expect-error
      rot.set(options.startRotationX.getValue(lifetime), options.startRotationY.getValue(lifetime), options.startRotationZ.getValue(lifetime));
    } else if (options.startRotation) {
      rot.set(0, 0, options.startRotation.getValue(lifetime));
    } else {
      rot.set(0, 0, 0);
    }
    transform.setRotation(rot.x, rot.y, rot.z);
    const color = options.startColor.getValue(lifetime) as number[];

    if (color.length === 3) {
      color[3] = 1;
    }
    const size = tempSize;

    if (options.start3DSize) {
      size.x = options.startSizeX!.getValue(lifetime);
      size.y = options.startSizeY!.getValue(lifetime);
    } else {
      const n = options.startSize!.getValue(lifetime);
      const aspect = options.sizeAspect!.getValue(lifetime);

      size.x = n;
      // 兼容aspect为0的情况
      size.y = aspect === 0 ? 0 : n / aspect;
      // size[1] = n / aspect;
    }

    const vel = direction.clone();

    vel.multiply(speed);

    // 粒子的大小受发射器父节点的影响
    if (!options.particleFollowParent) {
      const tempScale = new Vector3();

      this.transform.assignWorldTRS(undefined, undefined, tempScale);
      size.x *= tempScale.x;
      size.y *= tempScale.y;
    }
    transform.setScale(size.x, size.y, 1);

    return {
      size,
      vel,
      color: color as vec4,
      delay: options.startDelay.getValue(lifetime),
      lifetime: options.startLifetime.getValue(lifetime),
      uv: randomArrItem(this.uvs, true),
      gravity: options.gravity,
      sprite,
      dirY,
      dirX,
      transform,
    };
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

  createPoint (lifetime: number): Point {
    const generator: ShapeGeneratorOptions = {
      total: this.emission.rateOverTime.getValue(lifetime),
      index: this.generatedCount,
      burstIndex: 0,
      burstCount: 0,
    };

    this.generatedCount++;

    return this.initPoint(this.shape.generate(generator));
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

  private writePointToDataBuffer (index: number, point: Point): void {
    const db = this.dataBuffer;

    if (!db) {
      return;
    }
    const i3 = index * 3;
    const i4 = index * 4;
    const i2 = index * 2;
    const pos = point.transform.position;

    db.delay[index] = point.delay;
    db.lifetime[index] = point.lifetime;

    // seed 和 rotation 从几何体回读，确保与 setPoint 的 quat round-trip 结果一致
    const aRotData = this.renderer.particleMesh.geometry.getAttributeData('aRot') as Float32Array;
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

    // 重置累积通道——槽位复用时必须清零，与 setPoint 写全零 aTranslation 对齐
    db.translation[i3] = 0;
    db.translation[i3 + 1] = 0;
    db.translation[i3 + 2] = 0;
    db.linearMove[i3] = 0;
    db.linearMove[i3 + 1] = 0;
    db.linearMove[i3 + 2] = 0;

    const i9 = index * 9;

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

// array performance better for small memory than Float32Array
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
