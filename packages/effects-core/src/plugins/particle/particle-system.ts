import type { Ray } from '@galacean/effects-math/es/core/index';
import { Euler, Matrix4, Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { vec2, vec3, vec4 } from '@galacean/effects-specification';
import * as spec from '@galacean/effects-specification';
import { Component } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import type { ValueGetter } from '../../math';
import { calculateTranslation, createValueGetter, ensureVec3 } from '../../math';
import type { Mesh } from '../../render';
import type { ShapeGenerator, ShapeGeneratorOptions, ShapeParticle } from '../../shape';
import { createShape } from '../../shape';
import { Texture } from '../../texture';
import { Transform } from '../../transform';
import { DestroyOptions, type color } from '../../utils';
import type { BoundingBoxSphere, HitTestCustomParams } from '../interact/click-handler';
import { HitTestType } from '../interact/click-handler';
import { Burst } from './burst';
import { Link } from './link';
import type { ParticleMeshProps, Point } from './particle-mesh';
import { ParticleSystemRenderer } from './particle-system-renderer';
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
  startColor: ValueGetter<color>,
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
  textureMap?: vec4,
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

export interface ParticleSystemOptions extends spec.ParticleOptions {
  meshSlots?: number[],
}

export interface ParticleSystemProps extends Omit<spec.ParticleContent, 'options' | 'renderer' | 'trails'> {
  options: ParticleSystemOptions,
  renderer: ParticleSystemRendererOptions,
  trails?: ParticleTrailProps,
}

// spec.RenderOptions 经过处理
export interface ParticleSystemRendererOptions extends Required<Omit<spec.RendererOptions, 'texture' | 'anchor' | 'particleOrigin'>> {
  mask: number,
  texture: Texture,
  anchor?: vec2,
  particleOrigin?: spec.ParticleOrigin,
}

export interface ParticleTrailProps extends Omit<spec.ParticleTrail, 'texture'> {
  texture: Texture,
  textureMap: vec4,
}

// 粒子节点包含的数据
export type ParticleContent = [number, number, number, Point]; // delay + lifetime, particleIndex, delay, pointData

@effectsClass(spec.DataType.ParticleSystem)
export class ParticleSystem extends Component {
  renderer: ParticleSystemRenderer;
  options: ParticleOptions;
  shape: ShapeGenerator;
  emission: ParticleEmissionOptions;
  trails: Pick<TrailOptions, 'lifetime' | 'dieWithParticles' | 'sizeAffectsLifetime' | 'sizeAffectsWidth' | 'inheritParticleColor' | 'parentAffectsPosition'>;
  meshes: Mesh[];
  textureSheetAnimation?: ParticleTextureSheetAnimation;
  interaction?: ParticleInteraction;
  emissionStopped: boolean;
  destroyed = false;
  props: ParticleSystemProps;

  private generatedCount: number;
  private lastUpdate: number;
  private loopStartTime: number;
  private particleLink: Link<ParticleContent>;
  private started: boolean;
  private ended: boolean;
  private lastEmitTime: number;
  private frozen: boolean;
  private upDirectionWorld: Vector3 | null;
  private uvs: number[][];
  private basicTransform: ParticleTransform;

  constructor (
    engine: Engine,
    props?: ParticleSystemProps,
  ) {
    super(engine);

    if (props) {
      this.fromData(props);
    }
  }

  get timePassed () {
    return this.lastUpdate - this.loopStartTime;
  }

  get lifetime () {
    return this.timePassed / this.item.duration;
  }

  get particleCount () {
    return this.particleLink.length;
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

    const parentTransform = this.transform.parentTransform;

    const selfPos = position.clone();

    if (path) {
      selfPos.add(path.getValue(0));
    }
    this.transform.setPosition(selfPos.x, selfPos.y, selfPos.z);

    if (this.options.particleFollowParent && parentTransform) {
      const worldMatrix = parentTransform.getWorldMatrix();

      this.renderer.updateWorldMatrix(worldMatrix);
    }
  }

  private updateEmitterTransform (time: number) {
    const parentTransform = this.transform.parentTransform;

    const { path, position } = this.basicTransform;
    const selfPos = position.clone();

    if (path) {
      const duration = this.item.duration;

      selfPos.add(path.getValue(time / duration));
    }
    this.transform.setPosition(selfPos.x, selfPos.y, selfPos.z);

    if (this.options.particleFollowParent && parentTransform) {
      const worldMatrix = parentTransform.getWorldMatrix();

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
    this.clearPointTrail(pointIndex);
    if (this.transform.parentTransform) {
      this.renderer.setTrailStartPosition(pointIndex, this.transform.parentTransform.position.clone());
    }
  }

  setVisible (visible: boolean) {
    this.renderer.setVisible(visible);
  }

  setOpacity (opacity: number) {
    const material = this.renderer.particleMesh.mesh.material;
    const geometry = this.renderer.particleMesh.mesh.geometry;
    const originalColor = material.getVector4('uOpacityOverLifetimeValue')?.toArray() || [1, 1, 1, 1];

    material.setVector4('uOpacityOverLifetimeValue', new Vector4(originalColor[0], originalColor[1], originalColor[2], opacity));
    const data = geometry.getAttributeData('aColor') || [];

    for (let i = 0; i < data.length; i += 32) {
      data[i * 8 + 7] = opacity;
    }
  }

  /**
   * @internal
   */
  setColor (r: number, g: number, b: number, a: number) {
    const material = this.renderer.particleMesh.mesh.material;
    const geometry = this.renderer.particleMesh.mesh.geometry;
    const originalColor = material.getVector4('uOpacityOverLifetimeValue')?.toArray() || [1, 1, 1, 1];

    material.setVector4('uOpacityOverLifetimeValue', new Vector4(originalColor[0], originalColor[1], originalColor[2], a));
    const data = geometry.getAttributeData('aColor') || [];

    for (let i = 0; i < data.length; i += 32) {
      data[i * 8 + 4] = r;
      data[i * 8 + 5] = g;
      data[i * 8 + 6] = b;
      data[i * 8 + 7] = a;
    }
  }

  setParentTransform (transform: Transform) {
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
    this.lastUpdate = 0;
    this.loopStartTime = 0;
    this.lastEmitTime = -1 / this.emission.rateOverTime.getValue(0);
    this.generatedCount = 0;
    this.particleLink = new Link((a, b) => a[0] - b[0]);
    this.emission.bursts.forEach(b => b.reset());
    this.frozen = false;
    this.ended = false;
  }

  update (delta: number) {
    if (this.started && !this.frozen) {
      const now = this.lastUpdate + delta / 1000;
      const options = this.options;
      const loopStartTime = this.loopStartTime;
      const emission = this.emission;

      this.lastUpdate = now;
      this.upDirectionWorld = null;
      this.renderer.updateTime(now, delta);

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
          const interval = 1 / emission.rateOverTime.getValue(lifetime);
          const pointCount = Math.floor((timePassed - this.lastEmitTime) / interval);
          const maxEmissionCount = pointCount;
          const timeDelta = interval / pointCount;
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
            this.lastEmitTime = timePassed;
          }
          const bursts = emission.bursts;

          for (let j = bursts?.length - 1, cursor = 0; j >= 0 && cursor < maxCount; j--) {
            if (shouldSkipGenerate()) {
              break;
            }
            const burst = bursts[j];
            const opts = burst.getGeneratorOptions(timePassed, lifetime);

            if (opts) {
              const originVec = [0, 0, 0];
              const offsets = emission.burstOffsets[j];
              const burstOffset = (offsets && offsets[opts.cycleIndex]) || originVec;

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
                p.transform.translate(...burstOffset as vec3);

                this.addParticle(p, maxCount);
              }
            }
          }
        } else if (this.item.endBehavior === spec.EndBehavior.restart) {
          updateTrail();
          this.loopStartTime = now - duration;
          this.lastEmitTime -= duration;
          this.lastUpdate -= duration;
          emission.bursts.forEach(b => b.reset());
          this.particleLink.forEach(content => {
            content[0] -= duration;
            content[2] -= duration;
            content[3].delay -= duration;
          });

          this.renderer.minusTimeForLoop(duration);
        } else {
          this.ended = true;
          const endBehavior = this.item.endBehavior;

          if (endBehavior === spec.EndBehavior.freeze) {
            this.frozen = true;
          }
        }
      } else if (this.item.endBehavior !== spec.EndBehavior.restart) {
        if (spec.EndBehavior.destroy === this.item.endBehavior) {
          const node = link.last;

          if (node && (node.content[0]) < this.lastUpdate) {
            this.destroyed = true;
          }
        }
      }
      updateTrail();
    }
  }

  override onDestroy (): void {
    if (this.item && this.item.composition) {
      this.item.composition.destroyTextures(this.getTextures());
      this.meshes.forEach(mesh => mesh.dispose({ material: { textures: DestroyOptions.keep } }));
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
        const [currentTime, pointIndex, _, point] = node.content;

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
            if (options.removeParticle) {
              renderer.removeParticlePoint(pointIndex);
              this.clearPointTrail(pointIndex);
              link.removeNode(node); // TODO: 会多移除一个粒子，为了通过帧对比先保留，等 2.0 合到主分支后移除。
              node.content = [0] as unknown as ParticleContent;
            }
            hitPositions.push(pos);
            if (!options.multiple) {
              finish = true;
            }
          }
        } else {
          break;
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
    const time = this.lastUpdate - delay;

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
    const matrix4 = options.particleFollowParent ? this.transform.getMatrix() : this.transform.getWorldMatrix();
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

  override fromData (data: unknown): void {
    super.fromData(data);
    const props = data as ParticleSystemProps;

    this.props = props;
    this.destroyed = false;
    const cachePrefix = '';
    const { options, positionOverLifetime = {}, shape } = props;
    const gravityModifier = positionOverLifetime?.gravityOverLifetime;
    const gravity = ensureVec3(positionOverLifetime?.gravity);
    const _textureSheetAnimation = props.textureSheetAnimation;
    const textureSheetAnimation = _textureSheetAnimation ? {
      animationDelay: createValueGetter(_textureSheetAnimation.animationDelay || 0),
      animationDuration: createValueGetter(_textureSheetAnimation.animationDuration || 1),
      cycles: createValueGetter(_textureSheetAnimation.cycles || 1),
      animate: _textureSheetAnimation.animate,
      col: _textureSheetAnimation.col,
      row: _textureSheetAnimation.row,
      total: _textureSheetAnimation.total || _textureSheetAnimation.col * _textureSheetAnimation.row,
    } : undefined;
    const startTurbulence = !!(shape && shape.turbulenceX || shape?.turbulenceY || shape?.turbulenceZ);
    let turbulence: ParticleOptions['turbulence'];

    if (startTurbulence) {
      turbulence = [
        createValueGetter(shape.turbulenceX ?? 0),
        createValueGetter(shape.turbulenceY ?? 0),
        createValueGetter(shape.turbulenceZ ?? 0),
      ];
    }

    this.name = 'ParticleSystem';
    this.shape = createShape(shape);
    this.emission = {
      rateOverTime: createValueGetter(props.emission.rateOverTime),
      burstOffsets: getBurstOffsets(props.emission.burstOffsets ?? []),
      bursts: (props.emission.bursts || []).map((c: any) => new Burst(c)),
    };
    this.textureSheetAnimation = textureSheetAnimation;
    const renderer = props.renderer || {};
    const rotationOverLifetime: ParticleMeshProps['rotationOverLifetime'] = {};
    const rotOverLt = props.rotationOverLifetime;

    if (rotOverLt) {
      rotationOverLifetime.asRotation = !!rotOverLt.asRotation;
      rotationOverLifetime.z = rotOverLt.z ? createValueGetter(rotOverLt.z) : createValueGetter(0);
      if (rotOverLt.separateAxes) {
        rotationOverLifetime.x = rotOverLt.x && createValueGetter(rotOverLt.x);
        rotationOverLifetime.y = rotOverLt.y && createValueGetter(rotOverLt.y);
      }
    }

    let forceTarget;

    if (positionOverLifetime?.forceTarget) {
      forceTarget = {
        target: positionOverLifetime.target || [0, 0, 0],
        curve: createValueGetter(positionOverLifetime.forceCurve || [spec.ValueType.LINE, [[0, 0], [1, 1]]]),
      };
    }
    const linearVelOverLifetime = {
      x: positionOverLifetime.linearX && createValueGetter(positionOverLifetime.linearX || 0),
      y: positionOverLifetime.linearY && createValueGetter(positionOverLifetime.linearY || 0),
      z: positionOverLifetime.linearZ && createValueGetter(positionOverLifetime.linearZ || 0),
      asMovement: positionOverLifetime.asMovement,
    };
    const orbitalVelOverLifetime = {
      x: positionOverLifetime.orbitalX && createValueGetter(positionOverLifetime.orbitalX),
      y: positionOverLifetime.orbitalY && createValueGetter(positionOverLifetime.orbitalY),
      z: positionOverLifetime.orbitalZ && createValueGetter(positionOverLifetime.orbitalZ),
      center: positionOverLifetime.orbCenter,
      asRotation: positionOverLifetime.asRotation,
    };
    const sizeOverLifetime = props.sizeOverLifetime || {};
    const colorOverLifetime = props.colorOverLifetime;
    const shaderCachePrefix = cachePrefix;
    const sizeOverLifetimeGetter = sizeOverLifetime?.separateAxes ?
      {
        separateAxes: true,
        x: createValueGetter(sizeOverLifetime.x),
        y: createValueGetter(sizeOverLifetime.y),
      } :
      {
        separateAxes: false,
        x: createValueGetter(('size' in sizeOverLifetime ? sizeOverLifetime.size : sizeOverLifetime.x) || 1),
      };

    renderer.anchor = renderer.anchor || [0, 0];
    const anchor = Vector2.fromArray(renderer.anchor);

    this.options = {
      particleFollowParent: !!options.particleFollowParent,
      startLifetime: createValueGetter(options.startLifetime),
      startDelay: createValueGetter(options.startDelay || 0),
      startSpeed: createValueGetter(positionOverLifetime.startSpeed || 0),
      startColor: createValueGetter(options.startColor),
      // duration:vfxItem.duration || 1,
      looping: false,
      maxCount: options.maxCount ?? 0,
      gravityModifier: createValueGetter(gravityModifier || 0),
      gravity,
      start3DSize: !!options.start3DSize,
      startTurbulence,
      turbulence,
      speedOverLifetime: positionOverLifetime.speedOverLifetime && createValueGetter(positionOverLifetime.speedOverLifetime),
      linearVelOverLifetime,
      orbitalVelOverLifetime,
      forceTarget,
    };
    if (options.startRotationZ) {
      this.options.startRotation = createValueGetter(options.startRotationZ || 0);
    }
    if (options.startRotationX || options.startRotationY) {
      this.options.start3DRotation = true;
      this.options.startRotationX = createValueGetter(options.startRotationX || 0);
      this.options.startRotationY = createValueGetter(options.startRotationY || 0);
      this.options.startRotationZ = createValueGetter(options.startRotationZ || 0);
    }

    if (options.start3DSize) {
      this.options.startSizeX = createValueGetter(options.startSizeX);
      this.options.startSizeY = createValueGetter(options.startSizeY);
    } else {
      this.options.startSize = createValueGetter(options.startSize);
      this.options.sizeAspect = createValueGetter(options.sizeAspect || 1);
    }

    const particleMeshProps: ParticleMeshProps = {
      // listIndex: vfxItem.listIndex,
      meshSlots: options.meshSlots,
      name: this.name,
      matrix: Matrix4.IDENTITY,
      shaderCachePrefix,
      renderMode: renderer.renderMode || spec.RenderMode.BILLBOARD,
      side: renderer.side || spec.SideMode.DOUBLE,
      gravity,
      // duration: vfxItem.duration,
      blending: renderer.blending || spec.BlendingMode.ALPHA,
      rotationOverLifetime,
      gravityModifier: this.options.gravityModifier,
      linearVelOverLifetime: this.options.linearVelOverLifetime,
      orbitalVelOverLifetime: this.options.orbitalVelOverLifetime,
      speedOverLifetime: this.options.speedOverLifetime,
      sprite: textureSheetAnimation,
      occlusion: !!renderer.occlusion,
      transparentOcclusion: !!renderer.transparentOcclusion,
      maxCount: options.maxCount,
      mask: renderer.mask,
      maskMode: renderer.maskMode ?? spec.MaskMode.NONE,
      forceTarget,
      diffuse: renderer.texture,
      sizeOverLifetime: sizeOverLifetimeGetter,
      anchor,
    };

    if (colorOverLifetime) {
      const { color, opacity } = colorOverLifetime;

      particleMeshProps.colorOverLifetime = {};
      if (opacity) {
        particleMeshProps.colorOverLifetime.opacity = createValueGetter(colorOverLifetime.opacity);
      }
      if (color) {
        if (color[0] === spec.ValueType.GRADIENT_COLOR) {
          particleMeshProps.colorOverLifetime.color = (colorOverLifetime.color as spec.GradientColor)[1];
        } else if (color[0] === spec.ValueType.RGBA_COLOR) {
          particleMeshProps.colorOverLifetime.color = Texture.createWithData(
            this.engine,
            {
              data: new Uint8Array(color[1] as unknown as number[]),
              width: 1,
              height: 1,
            });
        } else if (color instanceof Texture) {
          particleMeshProps.colorOverLifetime.color = color;
        }
      }
    }

    const uvs = [];
    let textureMap = [0, 0, 1, 1];
    let flip;

    if (props.splits) {
      const s = props.splits[0];

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
            textureMap[3] / row]);
        }
      }
    } else {
      uvs.push(textureMap);
    }
    this.uvs = uvs;
    // @ts-expect-error
    particleMeshProps.textureFlip = flip;

    const trails = props.trails;
    let trailMeshProps: TrailMeshProps | undefined;

    if (trails) {
      this.trails = {
        lifetime: createValueGetter(trails.lifetime),
        dieWithParticles: trails.dieWithParticles !== false,
        sizeAffectsWidth: !!trails.sizeAffectsWidth,
        sizeAffectsLifetime: !!trails.sizeAffectsLifetime,
        inheritParticleColor: !!trails.inheritParticleColor,
        parentAffectsPosition: !!trails.parentAffectsPosition,
      };
      trailMeshProps = {
        name: 'Trail',
        matrix: Matrix4.IDENTITY,
        minimumVertexDistance: trails.minimumVertexDistance || 0.02,
        maxTrailCount: options.maxCount,
        pointCountPerTrail: Math.round(trails.maxPointPerTrail) || 32,
        blending: trails.blending,
        texture: trails.texture,
        opacityOverLifetime: createValueGetter(trails.opacityOverLifetime || 1),
        widthOverTrail: createValueGetter(trails.widthOverTrail || 1),
        // order: vfxItem.listIndex + (trails.orderOffset || 0),
        shaderCachePrefix,
        lifetime: this.trails.lifetime,
        occlusion: !!trails.occlusion,
        transparentOcclusion: !!trails.transparentOcclusion,
        textureMap: trails.textureMap,
        mask: renderer.mask,
        maskMode: renderer.maskMode,
      };

      if (trails.colorOverLifetime && trails.colorOverLifetime[0] === spec.ValueType.GRADIENT_COLOR) {
        trailMeshProps.colorOverLifetime = trails.colorOverLifetime[1];
      }
      if (trails.colorOverTrail && trails.colorOverTrail[0] === spec.ValueType.GRADIENT_COLOR) {
        trailMeshProps.colorOverTrail = trails.colorOverTrail[1];
      }
    }

    this.renderer = new ParticleSystemRenderer(this.engine, particleMeshProps, trailMeshProps);
    this.renderer.item = this.item;
    this.meshes = this.renderer.meshes;

    const interaction = props.interaction;

    if (interaction) {
      this.interaction = {
        multiple: interaction.multiple,
        radius: interaction.radius ?? 0.4,
        behavior: interaction.behavior,
      };
    }
    this.item.getHitTestParams = this.getHitTestParams;
    this.item._content = this;
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

function getBurstOffsets (burstOffsets: Record<string, number>[]): Record<string, vec3[]> {
  const ret: Record<string, vec3[]> = {};

  if (Array.isArray(burstOffsets)) {
    burstOffsets.forEach(arr => {
      const isArr = arr instanceof Array;
      const index = isArr ? arr[0] : arr.index;
      let offsets = ret[index];

      if (!offsets) {
        offsets = ret[index] = [];
      }
      if (isArr) {
        offsets.push(arr.slice(1, 4) as vec3);
      } else {
        offsets.push([+arr.x, +arr.y, +arr.z]);
      }
    });
  }

  return ret;
}

function randomArrItem<T> (arr: T[], keepArr?: boolean): T {
  const index = Math.floor(Math.random() * arr.length);
  const item = arr[index];

  if (!keepArr) {
    arr.splice(index, 1);
  }

  return item;
}
