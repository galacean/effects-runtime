import type { Ray } from '@galacean/effects-math/es/core/index';
import type { Vector3 } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import { Component } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import type { Mesh } from '../../render';
import type { Maskable } from '../../material';
import { MaskProcessor } from '../../material';
import type { Texture } from '../../texture';
import type { BoundingBoxSphere, HitTestCustomParams } from '../interact/click-handler';
import { HitTestType } from '../interact/click-handler';
import { ParticleEmitter } from './particle-emitter';
import type { ParsedSpecResult } from './parse-spec';
import { parseParticleSpec } from './parse-spec';
import { ParticleSystemRenderer } from './particle-system-renderer';

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
  meshes: Mesh[];
  options: ParsedSpecResult['options'];
  interaction?: ParticleInteraction;
  props: ParticleSystemProps;

  readonly maskManager: MaskProcessor;

  private emitter: ParticleEmitter | null = null;
  private specResult: ParsedSpecResult | null = null;
  private clickedPointIndex = -1;
  private pathTime = 0;
  private pathBasePosition = { x: 0, y: 0, z: 0 };
  private pathCurve: ValueGetter<any> | undefined;

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

  // ========================
  // Public API — 全部代理到 emitter
  // ========================

  get time (): number {
    return this.emitter?.time ?? 0;
  }

  get timePassed () {
    return this.emitter?.timePassed ?? 0;
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
    return this.emitter?.getMaxCount() ?? 0;
  }

  /**
   * 设置当前粒子系统的最大粒子数。当系统的粒子数量达到最大值时，发射器会暂时停止发射粒子。
   * 注意：暂时不支持增加拖尾数量
   * @since 2.3.0
   */
  set maxParticles (count: number) {
    this.emitter?.setMaxCount(count);
  }

  isFrozen () {
    return this.emitter?.frozen ?? false;
  }

  isEnded () {
    return this.emitter?.ended ?? false;
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
    this.emitter?.fullReset();
    this.pathTime = 0;
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

  simulate (time: number) {
    this.tickEmitter(time * 1000);
    if (this.emitter) {
      this.emitter.frozen = true;
    }
  }

  // ========================
  // 查询 — 代理到 emitter
  // ========================

  getPointPositionByIndex (index: number): Vector3 | null {
    const db = this.emitter?.dataBuffer;

    if (!db || index < 0 || index >= db.activeCount || !db.alive[index]) {
      return null;
    }

    return this.emitter!.getPointPosition(index);
  }

  getParticleBoxes (): { center: Vector3, size: Vector3 }[] {
    return this.emitter?.getParticleBoxes() ?? [];
  }

  raycast (options: { ray: Ray, radius: number, removeParticle?: boolean, multiple: boolean }): Vector3[] | undefined {
    const result = this.emitter?.raycast({
      ray: options.ray,
      radius: options.radius,
      multiple: options.multiple,
    });

    if (this.emitter) {
      this.clickedPointIndex = this.emitter.lastRaycastHitIndex;
    }

    return result;
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
        clipMasks: this.renderer.frameClipMasks,
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

  // ========================
  // Component Lifecycle
  // ========================

  override onStart (): void {
    if (!this.specResult) {
      return;
    }
    const result = this.specResult;

    this.specResult = null;

    const { particleMeshProps, trailMeshProps } = result;

    this.emitter = new ParticleEmitter();

    this.renderer = this.item.addComponent(ParticleSystemRenderer);
    this.renderer.setup(particleMeshProps, trailMeshProps);
    this.renderer.maskManager = this.maskManager;
    this.meshes = this.renderer.meshes;

    this.emitter.setup(result.emitterData, this.renderer);

    this.emitter.itemDuration = this.item.duration;
    this.emitter.endBehaviorValue = this.item.endBehavior;

    this.initEmitterTransform();
    this.pushTransformToEmitter();
    this.startEmit();

    this.item.on('click', () => {
      if (this.interaction?.behavior === spec.ParticleInteractionBehavior.removeParticle && this.clickedPointIndex >= 0) {
        this.emitter?.killParticle(this.clickedPointIndex);
        this.clickedPointIndex = -1;
      }
    });
  }

  override onUpdate (dt: number): void {
    if (!this.emitter?.frozen) {
      this.tickEmitter(dt);
    }
  }

  private tickEmitter (dt: number): void {
    if (!this.emitter) {
      return;
    }
    this.updateItemPosition(dt / 1000);
    this.pushTransformToEmitter();
    this.emitter.tick(dt);
  }

  private pushTransformToEmitter (): void {
    if (!this.emitter) {
      return;
    }
    this.emitter.worldMatrix = this.transform.getWorldMatrix();

    if (this.emitter.particleFollowParent) {
      this.renderer.updateWorldMatrix(this.emitter.worldMatrix);
    }
  }

  private initEmitterTransform (): void {
    const position = this.item.transform.position.clone();
    const transformPath = this.props.emitterTransform?.path;

    if (transformPath) {
      if (transformPath[0] === spec.ValueType.CONSTANT_VEC3) {
        position.add(transformPath[1]);
      } else {
        this.pathCurve = createValueGetter(transformPath);
      }
    }
    this.pathBasePosition = { x: position.x, y: position.y, z: position.z };
    this.updateItemPosition(0);
  }

  private updateItemPosition (dt: number): void {
    if (!this.emitter) {
      return;
    }
    this.pathTime += dt;
    const { x, y, z } = this.pathBasePosition;
    let px = x, py = y, pz = z;

    if (this.pathCurve) {
      const pathVal = this.pathCurve.getValue(this.pathTime / this.emitter.itemDuration);

      px += pathVal.x ?? pathVal[0] ?? 0;
      py += pathVal.y ?? pathVal[1] ?? 0;
      pz += pathVal.z ?? pathVal[2] ?? 0;
    }
    this.transform.setPosition(px, py, pz);
  }

  override onDestroy (): void {
    if (this.item && this.item.composition) {
      this.meshes.forEach(mesh => mesh.dispose());
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

  // ========================
  // Spec Parsing
  // ========================

  override fromData (data: spec.ParticleSystemData): void {
    super.fromData(data);
    this.props = data;
    this.name = 'ParticleSystem';

    if (data.mask) {
      this.maskManager.setMaskOptions(this.engine, data.mask);
    }

    const result = parseParticleSpec(data, this.engine);

    this.options = result.options;
    this.interaction = result.interaction;

    result.particleMeshProps.mask = this.maskManager.getRefValue();
    result.particleMeshProps.maskMode = this.maskManager.maskMode;

    if (result.trailMeshProps) {
      result.trailMeshProps.mask = this.maskManager.getRefValue();
      result.trailMeshProps.maskMode = this.maskManager.maskMode;
    }

    this.specResult = result;
    this.item.getHitTestParams = this.getHitTestParams;
  }
}
