import { Component, spec, TextComponent, VFXItem } from '@galacean/effects';
import type { Composition } from '@galacean/effects';
import {
  ProAccelerationForceModule,
  ProAddVelocityInConeModule,
  ProCalculateAccurateVelocityModule,
  ProCameraOffsetModule,
  ProCurveColor,
  ProCurveFloat,
  ProCurlNoiseForceModule,
  ProDistributionColor,
  ProDistributionFloat,
  ProDistributionVector2,
  ProDistributionVector3,
  ProDragModule,
  ProEmitterPropertiesModule,
  ProGravityForceModule,
  ProInheritVelocityModule,
  ProInitializeParticleModule,
  ProParticleSystemComponent,
  ProParticleSystemRendererComponent,
  ProRibbonFacingMode,
  ProRibbonRenderer,
  ProRibbonRendererProperties,
  ProRibbonTessellationMode,
  ProRibbonTextureMode,
  ProRibbonWidthScaleModule,
  ProRotateAroundPointModule,
  ProSampleParticlesFromOtherEmitterModule,
  ProScaleColorModule,
  ProScaleSizeBySpeedModule,
  ProScaleSpriteSizeModule,
  ProShapeLocationModule,
  ProSolveForcesAndVelocityModule,
  ProSpawnBurstModule,
  ProSpawnPerSourceParticleModule,
  ProSpawnRateModule,
  ProSpriteRenderer,
  ProSpriteRendererProperties,
  ProSpriteRotationRateModule,
  ProSubUVAnimationModule,
  ProSubUVMode,
  ProUpdateAgeModule,
  ProWindForceModule,
} from '@galacean/effects-plugin-particle-system-pro';
import { Selection } from './core/selection';

type DemoConfig = {
  name: string,
  position: [number, number, number],
  configureModules: (system: ProParticleSystemComponent) => void,
  configureRenderer: (component: ProParticleSystemRendererComponent, engine: Composition['engine']) => void,
  selectOnSpawn?: boolean,
  /**
   * 在 item 构建完成并挂到 pluginRoot 之后调用，用来挂额外组件（如让发射器
   * 自身运动以驱动 InheritVelocity 的轨道组件）。在 toData/fromData 往返之后执行，
   * 所以挂的组件不会被序列化。
   */
  postConfigure?: (item: VFXItem, composition: Composition) => void,
};

/**
 * 在已经加载好的 composition 上挂一个新的 VFXItem，运行 particle-system-pro
 * 的默认 Sprite Emitter（8 个 module + Sprite Renderer）。
 */
export function spawnProParticleDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-particle-demo',
    position: [0, -1.5, 0],
    configureModules: configureFountainModules,
    configureRenderer: configureFountainRenderer,
    selectOnSpawn: true,
  });
}

/**
 * Ribbon/Trail 粒子 demo：发射一条持续的拖尾。
 */
export function spawnProRibbonDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-ribbon-demo',
    position: [2, -1.0, 0],
    configureModules: configureRibbonModules,
    configureRenderer: configureRibbonRenderer,
  });
}

export function spawnProSparkDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-spark-demo',
    position: [-1.25, -1.45, 0],
    configureModules: configureSparkModules,
    configureRenderer: configureSparkRenderer,
  });
}

export function spawnProOrbitSmokeDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-orbit-smoke-demo',
    position: [3.5, -1.2, 0],
    configureModules: configureOrbitSmokeModules,
    configureRenderer: configureOrbitSmokeRenderer,
  });
}

export function spawnProShockRingDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-shock-ring-demo',
    position: [-6.6, -2.5, 0],
    configureModules: configureShockRingModules,
    configureRenderer: configureShockRingRenderer,
  });
}

export function spawnProNoiseFieldDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-noise-field-demo',
    position: [-2.2, -2.5, 0],
    configureModules: configureNoiseFieldModules,
    configureRenderer: configureNoiseFieldRenderer,
  });
}

export function spawnProAccelerationColumnDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-acceleration-column-demo',
    position: [2.2, -2.5, 0],
    configureModules: configureAccelerationColumnModules,
    configureRenderer: configureAccelerationColumnRenderer,
  });
}

export function spawnProFlipbookBurstDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-flipbook-burst-demo',
    position: [5.8, -2.1, 0],
    configureModules: configureFlipbookBurstModules,
    configureRenderer: configureFlipbookBurstRenderer,
  });
}

/**
 * 每个 source 粒子拖一条独立 ribbon trail 的 demo。
 *
 * 两个 emitter：
 * - source（sprite）：少量长寿命粒子，curl noise 飘动，每条轨迹就是一条 ribbon
 * - trail（ribbon）：用 Spawn Per Source Particle 触发 spawn，用
 *   Sample Particles From Other Emitter 把每个新 trail 粒子绑到一个 source 粒子
 *
 * Ribbon Renderer 自动按 RibbonID（= source UniqueID）分组成多条独立 ribbon。
 */
export function spawnProTrailPerSourceDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-trail-per-source-demo',
    position: [-4, 1.0, 0],
    configureModules: configureTrailPerSourceModules,
    configureRenderer: configureTrailPerSourceRenderer,
  });
}

export function spawnProDemoGallery (composition: Composition): VFXItem[] {
  // 每行 6 个，间距 5.4 水平 × 5.5 垂直，给每个 demo 足够活动空间
  const colX = [-13.5, -8.1, -2.7, 2.7, 8.1, 13.5];
  const rowY = [2.75, -2.75, -8.25];

  const items = [
    // ── row 0 ──
    spawnConfiguredDemo(composition, {
      name: 'pro-particle-demo',
      position: [colX[0], rowY[0], 0],
      configureModules: configureFountainModules,
      configureRenderer: configureFountainRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-spark-demo',
      position: [colX[1], rowY[0], 0],
      configureModules: configureSparkModules,
      configureRenderer: configureSparkRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-ribbon-demo',
      position: [colX[2], rowY[0], 0],
      configureModules: configureRibbonModules,
      configureRenderer: configureRibbonRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-orbit-smoke-demo',
      position: [colX[3], rowY[0], 0],
      configureModules: configureOrbitSmokeModules,
      configureRenderer: configureOrbitSmokeRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-shock-ring-demo',
      position: [colX[4], rowY[0], 0],
      configureModules: configureShockRingModules,
      configureRenderer: configureShockRingRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-noise-field-demo',
      position: [colX[5], rowY[0], 0],
      configureModules: configureNoiseFieldModules,
      configureRenderer: configureNoiseFieldRenderer,
    }),
    // ── row 1 ──
    spawnConfiguredDemo(composition, {
      name: 'pro-acceleration-column-demo',
      position: [colX[0], rowY[1], 0],
      configureModules: configureAccelerationColumnModules,
      configureRenderer: configureAccelerationColumnRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-flipbook-burst-demo',
      position: [colX[1], rowY[1], 0],
      configureModules: configureFlipbookBurstModules,
      configureRenderer: configureFlipbookBurstRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-trail-per-source-demo',
      position: [colX[2], rowY[1], 0],
      configureModules: configureTrailPerSourceModules,
      configureRenderer: configureTrailPerSourceRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-autumn-gale-demo',
      position: [colX[3], rowY[1], 0],
      configureModules: configureAutumnGaleModules,
      configureRenderer: configureAutumnGaleRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-plasma-conduit-demo',
      position: [colX[4], rowY[1], 0],
      configureModules: configurePlasmaConduitModules,
      configureRenderer: configurePlasmaConduitRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-fireworks-finale-demo',
      position: [colX[5], rowY[1], 0],
      configureModules: configureFireworksFinaleModules,
      configureRenderer: configureFireworksFinaleRenderer,
    }),
    // ── row 2 ──
    spawnConfiguredDemo(composition, {
      name: 'pro-comet-swarm-demo',
      position: [colX[0], rowY[2], 0],
      configureModules: configureCometSwarmModules,
      configureRenderer: configureCometSwarmRenderer,
      postConfigure: attachCometOrbit,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-arcane-rune-demo',
      position: [colX[1], rowY[2], 0],
      configureModules: configureArcaneRuneModules,
      configureRenderer: configureArcaneRuneRenderer,
      postConfigure: tiltToGroundPlane,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-spiral-galaxy-demo',
      position: [colX[2], rowY[2], 0],
      configureModules: configureSpiralGalaxyModules,
      configureRenderer: configureSpiralGalaxyRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-dragon-breath-demo',
      position: [colX[3], rowY[2], 0],
      configureModules: configureDragonBreathModules,
      configureRenderer: configureDragonBreathRenderer,
    }),
  ];

  Selection.select(items[0]);

  return items;
}

/** comet-swarm 专用：给彗核 item 挂轨道运动组件 + 世界空间发射。 */
function attachCometOrbit (item: VFXItem): void {
  const mover = item.addComponent(ProDemoOrbitMover);

  mover.baseX = item.transform.position.x;
  mover.baseY = item.transform.position.y;
  mover.baseZ = item.transform.position.z;
  mover.radius = 1.4;
  mover.angularSpeed = Math.PI * 0.7; // ~0.35 圈/秒，切向速度 ≈ 3.1 单位/秒
}

/** arcane-rune 专用：把符文盘绕 X 轴后仰，做出地面透视铺开的魔法阵观感。 */
function tiltToGroundPlane (item: VFXItem): void {
  item.transform.setRotation(-58, 0, 0);
}

function spawnConfiguredDemo (composition: Composition, config: DemoConfig): VFXItem {
  const engine = composition.engine;
  const item = new VFXItem(engine);

  item.name = config.name;
  item.duration = 99999;
  item.endBehavior = spec.EndBehavior.forward;
  item.transform.setPosition(config.position[0], config.position[1], config.position[2]);

  const systemComponent = item.addComponent(ProParticleSystemComponent);
  const rendererComponent = item.addComponent(ProParticleSystemRendererComponent);

  // 1) 用 imperative configure 在组件上构建出一份 "source of truth"
  config.configureModules(systemComponent);
  config.configureRenderer(rendererComponent, engine);

  // 如果 configure 没自己加 Emitter Properties，补一个默认的，让编辑器
  // EmitterSpawn 段总能直接编辑生命周期/容量/space/seed 等
  const defaultEmitter = systemComponent.defaultEmitter;

  if (defaultEmitter && !defaultEmitter.modules.some(m => m instanceof ProEmitterPropertiesModule)) {
    defaultEmitter.addModule(new ProEmitterPropertiesModule());
  }

  // 2) 走一次 toData→fromData，让运行态从 JSON 重建，验证序列化正确性
  //    这样每次启动 demo 都经过序列化往返路径，任何 toJSON/fromJSON 的 bug
  //    都会立刻表现为视觉差异。
  const systemJson = systemComponent.toData();
  const rendererJson = rendererComponent.toData();

  systemComponent.fromData(systemJson);
  rendererComponent.fromData(rendererJson);

  // 3) 再做一次 toData 比对，确保 fromData 之后的状态可以再次稳定序列化
  //    （roundtrip idempotent 检查；不一致就 console.warn）
  const systemJson2 = systemComponent.toData();
  const rendererJson2 = rendererComponent.toData();

  if (JSON.stringify(systemJson) !== JSON.stringify(systemJson2)) {
    console.warn(`[${config.name}] system roundtrip mismatch`, { a: systemJson, b: systemJson2 });
  }
  if (JSON.stringify(rendererJson) !== JSON.stringify(rendererJson2)) {
    console.warn(`[${config.name}] renderer roundtrip mismatch`, { a: rendererJson, b: rendererJson2 });
  }

  item.setParent(composition.pluginRoot);

  // 在格子固定上方添加名称标签（独立 item，不跟随粒子移动）
  const labelItem = new VFXItem(engine);

  labelItem.name = config.name + '-label';
  labelItem.duration = 99999;
  labelItem.endBehavior = spec.EndBehavior.forward;
  // 标签固定在格子顶部，不做粒子的子物体
  labelItem.transform.setPosition(config.position[0], config.position[1] + 2.4, config.position[2]);

  const textComp = labelItem.addComponent(TextComponent);
  const labelOptions: spec.TextContentOptions = {
    text: config.name.replace('pro-', '').replace('-demo', ''),
    fontFamily: 'sans-serif',
    fontSize: 36,
    textColor: [0.75, 0.8, 0.85, 1],
    fontWeight: spec.TextWeight.normal,
    letterSpace: 0,
    textAlign: spec.TextAlignment.middle,
    fontStyle: spec.FontStyle.normal,
    textWidth: 400,
    textHeight: 42,
    lineHeight: 38,
  };

  textComp.updateWithOptions(labelOptions);
  textComp.renderText(labelOptions);
  labelItem.setParent(composition.pluginRoot);

  if (config.selectOnSpawn) {
    Selection.select(item);
  }

  config.postConfigure?.(item, composition);

  return item;
}

/**
 * 让宿主 VFXItem 沿圆周轨道平移的小组件。
 *
 * 配合 world simulation space，使发射器自身产生非零 emitterVelocity——
 * ProParticleSystemComponent.onUpdate 每帧从 worldMatrix 平移增量算出该速度，
 * 进而驱动 ProInheritVelocityModule：移动的"彗核"把新生火花沿切线方向甩出，
 * 形成绕轨道飘散的彗尾。
 */
class ProDemoOrbitMover extends Component {
  baseX = 0;
  baseY = 0;
  baseZ = 0;
  radius = 0.7;
  /** 角速度（弧度/秒） */
  angularSpeed = Math.PI;

  private angle = 0;

  override onUpdate (dt: number): void {
    this.angle += this.angularSpeed * (dt / 1000);
    this.transform.setPosition(
      this.baseX + Math.cos(this.angle) * this.radius,
      this.baseY + Math.sin(this.angle) * this.radius,
      this.baseZ,
    );
  }
}

function configureFountainModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(100);

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 100;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.0, 1.6);
  initParticle.startColor = ProDistributionColor.fromConstant(1.0, 0.84, 0.42, 1.0);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.24);
  initParticle.positionOrigin = ProDistributionVector3.fromConstant(0, 0, 0);
  initParticle.spriteRotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 5;
  velocity.speed = ProDistributionFloat.fromRange(1.05, 2.1);

  const gravity = new ProGravityForceModule();

  gravity.gravity = ProDistributionVector3.fromConstant(0, -2.1, 0);

  const forces = new ProSolveForcesAndVelocityModule();

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.linear([1, 1, 1, 1], [1, 0, 0, 0]));

  const scaleSize = new ProScaleSizeBySpeedModule();

  // 速度上限 ~1.4 → velocityNorm = 1 / (1.4²) ≈ 0.51；曲线从 1×(静止) 升到 2.2×(尾端)
  scaleSize.scaleDistribution = new ProDistributionVector2(
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 2.2)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 2.2)),
    true,
  );
  scaleSize.velocityNorm = 1 / (1.4 * 1.4);

  const rotationRate = new ProSpriteRotationRateModule();

  rotationRate.rate = ProDistributionFloat.fromRange(-0.65, 0.65);

  const updateAge = new ProUpdateAgeModule();

  system.addModule(spawnRate);
  system.addModule(spawnBurst);
  system.addModule(initParticle);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(forces);
  system.addModule(scaleColor);
  system.addModule(scaleSize);
  system.addModule(rotationRate);
  system.addModule(updateAge);
}

function configureSparkModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(55);

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 60;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(0.6, 1.0);
  initParticle.startColor = ProDistributionColor.fromRange([1.0, 0.65, 0.2, 1.0], [1.0, 0.95, 0.45, 1.0]);
  initParticle.startSize = ProDistributionVector2.fromRange([0.12, 0.12], [0.2, 0.2], true);
  initParticle.positionOrigin = ProDistributionVector3.fromConstant(0, 0, 0);
  initParticle.spriteRotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0.2, 1, 0];
  velocity.coneAngle = Math.PI / 10;
  velocity.speed = ProDistributionFloat.fromRange(1.3, 2.0);

  const gravity = new ProGravityForceModule();

  gravity.gravity = ProDistributionVector3.fromConstant(0, -2.4, 0);

  const forces = new ProSolveForcesAndVelocityModule();

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.linear([1, 1, 1, 1], [1, 0.35, 0.0, 0]));

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionVector2.fromCurves(ProCurveFloat.linear(1.7, 0.15), ProCurveFloat.linear(1.7, 0.15));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(spawnRate);
  system.addModule(spawnBurst);
  system.addModule(initParticle);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(forces);
  system.addModule(scaleColor);
  system.addModule(scaleSize);
  system.addModule(updateAge);
}

function configureRibbonModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(48);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromConstant(1.3);
  initParticle.startColor = ProDistributionColor.fromConstant(0.35, 0.92, 1.0, 1.0);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.55);
  initParticle.positionOrigin = ProDistributionVector3.fromConstant(0, 0, 0);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 7;
  velocity.speed = ProDistributionFloat.fromRange(1.1, 1.6);

  const gravity = new ProGravityForceModule();

  gravity.gravity = ProDistributionVector3.fromConstant(0, -0.15, 0);

  const forces = new ProSolveForcesAndVelocityModule();

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.linear([1, 1, 1, 1], [0, 0.2, 1, 0]));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(forces);
  system.addModule(scaleColor);
  system.addModule(updateAge);
}

function configureOrbitSmokeModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(36);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.4, 2.0);
  initParticle.startColor = ProDistributionColor.fromRange([0.82, 0.86, 0.96, 0.82], [1.0, 1.0, 1.0, 0.96]);
  initParticle.startSize = ProDistributionVector2.fromRange([0.3, 0.3], [0.55, 0.55], true);
  initParticle.positionOrigin = ProDistributionVector3.fromRange(
    [-0.12, 0, -0.12],
    [0.12, 0, 0.12],
  );
  initParticle.spriteRotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 3;
  velocity.speed = ProDistributionFloat.fromRange(0.001, 0.005);

  const gravity = new ProGravityForceModule();

  gravity.gravity = ProDistributionVector3.fromConstant(0, 0.001, 0);

  const forces = new ProSolveForcesAndVelocityModule();

  const rotateAroundPoint = new ProRotateAroundPointModule();

  rotateAroundPoint.rate = ProDistributionFloat.fromRange(60, 120);
  rotateAroundPoint.radius = ProDistributionFloat.fromRange(0.7, 1.2);
  rotateAroundPoint.phase = ProDistributionFloat.fromRange(0, 360);

  const rotationRate = new ProSpriteRotationRateModule();

  rotationRate.rate = ProDistributionFloat.fromRange(-0.8, 0.8);

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = new ProDistributionColor(
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.65)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.78)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.95)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0)),
  );

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionVector2.fromCurves(ProCurveFloat.linear(0.6, 1.0), ProCurveFloat.linear(0.6, 1.0));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(forces);
  system.addModule(rotateAroundPoint);
  system.addModule(rotationRate);
  system.addModule(scaleColor);
  system.addModule(scaleSize);
  system.addModule(updateAge);
}

function configureShockRingModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.duration = ProDistributionFloat.fromConstant(0.6);
  emitterProps.loopBehavior = 'multiple';
  emitterProps.loopCount = 999;
  emitterProps.loopDelay = ProDistributionFloat.fromConstant(1.2);
  emitterProps.maxParticleCount = 320;
  emitterProps.warmupTime = 0.1;

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 140;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromConstant(1.15);
  initParticle.startColor = ProDistributionColor.fromConstant(0.25, 0.6, 0.7, 0.75);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.4);
  initParticle.positionOrigin = ProDistributionVector3.fromConstant(0, 0, 0);
  initParticle.spriteRotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'ring';
  shapeLocation.ringRadius = 0.5;
  shapeLocation.ringThickness = 0.06;

  const cameraOffset = new ProCameraOffsetModule();

  cameraOffset.offset = ProDistributionFloat.fromConstant(-0.18);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 2.2;
  velocity.speed = ProDistributionFloat.fromRange(0.3, 0.6);

  const forces = new ProSolveForcesAndVelocityModule();

  const rotationRate = new ProSpriteRotationRateModule();

  rotationRate.rate = ProDistributionFloat.fromConstant(0.45);

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionVector2.fromCurves(ProCurveFloat.linear(1.4, 3.8), ProCurveFloat.linear(1.1, 2.8));

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.linear([1, 1, 1, 1], [1, 0.45, 0.0, 0]));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnBurst);
  system.addModule(initParticle);
  system.addModule(shapeLocation);
  system.addModule(cameraOffset);
  system.addModule(velocity);
  system.addModule(forces);
  system.addModule(rotationRate);
  system.addModule(scaleSize);
  system.addModule(scaleColor);
  system.addModule(updateAge);
}

function configureNoiseFieldModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  emitterProps.maxParticleCount = 360;
  emitterProps.warmupTime = 0.75;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(24);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(2.4, 3.1);
  initParticle.startColor = ProDistributionColor.fromRange([0.72, 0.9, 1.0, 0.78], [1.0, 1.0, 1.0, 1.0]);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.38);
  initParticle.positionOrigin = ProDistributionVector3.fromConstant(0, 0, 0);
  initParticle.spriteRotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'sphere';
  shapeLocation.sphereMin = 0.04;
  shapeLocation.sphereMax = 0.11;

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 4;
  velocity.speed = ProDistributionFloat.fromRange(0.015, 0.05);

  const curlNoise = new ProCurlNoiseForceModule();

  // amplitude 现在是位移速度（pos += curl·amp·dt），0.2 给出温和盘旋而不会飘出包围盒
  curlNoise.amplitude = 0.2;
  curlNoise.frequency = 0.95;

  const drag = new ProDragModule();

  drag.drag = ProDistributionFloat.fromRange(0.28, 1.0);

  const forces = new ProSolveForcesAndVelocityModule();

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = new ProDistributionColor(
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.72)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.9)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.95)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0)),
  );

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionVector2.fromCurves(ProCurveFloat.linear(1.3, 2.7), ProCurveFloat.linear(1.3, 2.7));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(shapeLocation);
  system.addModule(velocity);
  system.addModule(curlNoise);
  system.addModule(drag);
  system.addModule(forces);
  system.addModule(scaleColor);
  system.addModule(scaleSize);
  system.addModule(updateAge);
}

function configureAccelerationColumnModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  emitterProps.simulationSpace = 'world';
  emitterProps.maxParticleCount = 300;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(24);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.3, 1.9);
  initParticle.startColor = ProDistributionColor.fromRange([0.4, 0.96, 0.86, 0.94], [0.82, 1.0, 0.94, 1.0]);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.36);
  initParticle.positionOrigin = ProDistributionVector3.fromConstant(0, -0.5, 0);

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'plane';
  shapeLocation.planeSize = [0.2, 0.2];

  const cameraOffset = new ProCameraOffsetModule();

  cameraOffset.offset = ProDistributionFloat.fromRange(-0.22, -0.05);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 12;
  velocity.speed = ProDistributionFloat.fromRange(0.5, 0.9);

  const acceleration = new ProAccelerationForceModule();

  // 终端速度 ≈ accel/drag，控制在 ~1 单位/秒以内，列高 ~1.2 单位不串扰邻居
  acceleration.acceleration = ProDistributionVector3.fromRange([0.02, 0.7, -0.02], [0.08, 1.1, 0.02]);

  const drag = new ProDragModule();

  drag.drag = ProDistributionFloat.fromRange(1.0, 1.6);

  const forces = new ProSolveForcesAndVelocityModule();

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionVector2.fromCurves(ProCurveFloat.linear(1.1, 0.55), ProCurveFloat.linear(1.8, 3.2));

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.linear([1, 1, 1, 1], [0.15, 0.85, 1.0, 0]));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(shapeLocation);
  system.addModule(cameraOffset);
  system.addModule(velocity);
  system.addModule(acceleration);
  system.addModule(drag);
  system.addModule(forces);
  system.addModule(scaleSize);
  system.addModule(scaleColor);
  system.addModule(updateAge);
}

function configureFlipbookBurstModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  emitterProps.maxParticleCount = 8;
  emitterProps.warmupTime = 0;

  // Slow spawn — one burst every ~2 seconds
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(0.6);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.8, 2.5);
  initParticle.startColor = ProDistributionColor.fromConstant(1.0, 0.85, 0.55, 0.95);
  initParticle.startSize = ProDistributionVector2.fromRange([1.0, 1.0], [1.6, 1.6], true);
  initParticle.positionOrigin = ProDistributionVector3.fromConstant(0, 0, 0);
  initParticle.spriteRotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const subUV = new ProSubUVAnimationModule();

  subUV.mode = ProSubUVMode.SyncToAge;
  subUV.totalFrames = 16;

  // Expand rapidly then settle
  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionVector2.fromCurves(ProCurveFloat.linear(0.8, 1.8), ProCurveFloat.linear(0.8, 1.8));

  // Bright flash → warm fade → transparent
  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.linear([1, 1, 0.85, 1], [1, 0.4, 0.1, 0.15]));

  const forces = new ProSolveForcesAndVelocityModule();
  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(subUV);
  system.addModule(scaleSize);
  system.addModule(scaleColor);
  system.addModule(forces);
  system.addModule(updateAge);
}

function configureTrailPerSourceModules (system: ProParticleSystemComponent): void {
  // —— source emitter：少量长寿命粒子，curl noise 飘 ——
  const source = system.ensureDefaultEmitter();

  source.name = 'source';

  const srcProps = new ProEmitterPropertiesModule();

  srcProps.loopBehavior = 'infinite';
  srcProps.maxParticleCount = 12;
  srcProps.warmupTime = 0.6;
  source.addModule(srcProps);

  const srcSpawn = new ProSpawnRateModule();

  srcSpawn.rate = ProDistributionFloat.fromConstant(4);
  source.addModule(srcSpawn);

  const srcInit = new ProInitializeParticleModule();

  srcInit.lifetime = ProDistributionFloat.fromRange(1.8, 2.4);
  srcInit.startColor = ProDistributionColor.fromConstant(1.0, 0.95, 0.55, 1.0);
  srcInit.startSize = ProDistributionVector2.fromUniformConstant(0.22);
  srcInit.positionOrigin = ProDistributionVector3.fromConstant(0, 0, 0);
  source.addModule(srcInit);

  const srcShape = new ProShapeLocationModule();

  srcShape.shape = 'sphere';
  srcShape.sphereMin = 0.03;
  srcShape.sphereMax = 0.12;
  source.addModule(srcShape);

  const srcVel = new ProAddVelocityInConeModule();

  srcVel.coneAxis = [0, 1, 0];
  srcVel.coneAngle = Math.PI / 3;
  srcVel.speed = ProDistributionFloat.fromRange(0.45, 0.7);
  source.addModule(srcVel);

  const srcCurl = new ProCurlNoiseForceModule();

  srcCurl.amplitude = 0.5;
  srcCurl.frequency = 0.85;
  source.addModule(srcCurl);

  const srcForces = new ProSolveForcesAndVelocityModule();

  source.addModule(srcForces);
  source.addModule(new ProUpdateAgeModule());

  // —— trail emitter：每个 source 粒子拖一条独立 ribbon ——
  const trail = system.addEmitter();

  trail.name = 'trail';

  const trailProps = new ProEmitterPropertiesModule();

  trailProps.loopBehavior = 'infinite';
  trailProps.maxParticleCount = 1024;
  trail.addModule(trailProps);

  // 每个 source 每秒触发 ~36 trail 粒子；source 数量越多，总 spawn 数越大
  const trailSpawn = new ProSpawnPerSourceParticleModule();

  trailSpawn.sourceEmitterName = 'source';
  trailSpawn.spawnRatePerSource = ProDistributionFloat.fromConstant(36);
  trail.addModule(trailSpawn);

  const trailInit = new ProInitializeParticleModule();

  trailInit.lifetime = ProDistributionFloat.fromConstant(1.1);
  trailInit.startColor = ProDistributionColor.fromConstant(0.6, 0.95, 1.0, 1.0);
  trailInit.startSize = ProDistributionVector2.fromUniformConstant(0.12);
  trail.addModule(trailInit);

  // 把每个新 trail 粒子的 Position 改写到对应 source 粒子的位置；
  // RibbonID 同时改写为 source 的 UniqueID。注意必须在 InitializeParticle 之后加。
  const sample = new ProSampleParticlesFromOtherEmitterModule();

  sample.sourceEmitterName = 'source';
  trail.addModule(sample);

  // 沿生命周期把 size 收窄 → ribbon 头宽尾细，做出彗尾收束感（width 取 Size.x）
  const trailWidth = new ProScaleSpriteSizeModule();

  trailWidth.scale = ProDistributionVector2.fromCurves(ProCurveFloat.linear(1.0, 0.15), ProCurveFloat.linear(1.0, 0.15));
  trail.addModule(trailWidth);

  const trailColor = new ProScaleColorModule();

  trailColor.scale = ProDistributionColor.fromCurve(ProCurveColor.linear([1, 1, 1, 1], [0.2, 0.5, 1.0, 0]));
  trail.addModule(trailColor);

  trail.addModule(new ProUpdateAgeModule());
}

function configureFountainRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'fountain-flame', createProceduralFountainFlameCanvas, 'fountain flame');
}

function configureSparkRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  props.facingMode = 'velocity';

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'spark-shards', createProceduralSparkShardCanvas, 'spark shards');
}

function configureOrbitSmokeRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'orbit-smoke-body', createProceduralSmokeBodyCanvas, 'orbit smoke body');
}

function configureShockRingRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'shockwave-band', createProceduralShockBandCanvas, 'shockwave band');
}

function configureNoiseFieldRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'noise-plasma-core', createProceduralPlasmaCoreCanvas, 'plasma core');
}

function configureAccelerationColumnRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  props.facingMode = 'velocity';

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'acceleration-streak', createProceduralEnergyStreakCanvas, 'energy streak');
}

function configureFlipbookBurstRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  props.subUVRows = 4;
  props.subUVCols = 4;
  props.subUVTotal = 16;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'flipbook-fireball', createProceduralFireballFlipbookCanvas, 'fireball flipbook');
}

function configureRibbonRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProRibbonRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  const renderer = new ProRibbonRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'energy-ribbon', createProceduralEnergyTrailCanvas, 'energy trail');
}

function configureTrailPerSourceRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  // 顺序必须与 emitter 顺序一致：renderers[i] ↔ emitters[i]
  // —— source emitter sprite ——
  const srcProps = new ProSpriteRendererProperties();

  srcProps.blending = spec.BlendingMode.ALPHA;
  const srcRenderer = new ProSpriteRenderer(engine, srcProps);

  component.addRenderer(srcRenderer);
  applyGeneratedTexture(srcRenderer, 'noise-plasma-core', createProceduralPlasmaCoreCanvas, 'plasma core');

  // —— trail emitter ribbon ——
  const trailProps = new ProRibbonRendererProperties();

  trailProps.blending = spec.BlendingMode.ALPHA;
  // 细带：width = Size.x(0.12) * widthScale(0.35) ≈ 0.04，避免 ribbon 过粗糊成一片
  trailProps.widthScale = 0.6;
  // Catmull-Rom 细分让低 spawn 率下的 trail 平滑不折线
  trailProps.tessellationMode = ProRibbonTessellationMode.Automatic;
  // useRibbonId 已移除：多 ribbon 检测改为通过 accessor.ribbonId.isValid 自动判断
  const trailRenderer = new ProRibbonRenderer(engine, trailProps);

  component.addRenderer(trailRenderer);
  applyGeneratedTexture(trailRenderer, 'energy-ribbon', createProceduralEnergyTrailCanvas, 'energy trail');
}

type ProDemoKeyframe = { time: number, value: number, inTangent: number, outTangent: number, interpMode: 'linear' };

/** 线性关键帧速记，给 ProCurveFloat.fromKeyframes 构造多段渐变。 */
function kf (time: number, value: number): ProDemoKeyframe {
  return { time, value, inTangent: 0, outTangent: 0, interpMode: 'linear' };
}

function normalize3 (x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z) || 1;

  return [x / len, y / len, z / len];
}

// ─────────────────────────────────────────────────────────────────────────
//  Autumn Gale —— WindForce + Box 形状 + directSet SubUV + viewDepth 排序
//  落叶从顶部宽板飘落，逐叶不同的横向阵风把它们吹斜，curl 湍流让其翻飞，
//  每片锁定 4 种剪影之一。唯一使用 ALPHA（不发光）的新 demo。
// ─────────────────────────────────────────────────────────────────────────
function configureAutumnGaleModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  emitterProps.maxParticleCount = 200;
  emitterProps.warmupTime = 0.8;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(28);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(2.0, 2.8);
  initParticle.startColor = ProDistributionColor.fromRange([0.55, 0.16, 0.03, 1.0], [0.95, 0.72, 0.12, 1.0]);
  initParticle.startSize = ProDistributionVector2.fromRange([0.18, 0.18], [0.32, 0.32], true);
  initParticle.positionOrigin = ProDistributionVector3.fromConstant(0, 1.2, 0);
  initParticle.spriteRotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'box';
  shapeLocation.boxSize = [1.6, 0.2, 0.4];

  const velocity = new ProAddVelocityInConeModule();

  velocity.velocityType = 'linear';
  velocity.linearVelocity = ProDistributionVector3.fromConstant(0, -0.5, 0);
  velocity.linearVelocityScale = ProDistributionVector3.fromRange([0.7, 0.7, 0.3], [1.3, 1.2, 0.3]);

  const gravity = new ProGravityForceModule();

  gravity.gravity = ProDistributionVector3.fromConstant(0, -0.5, 0);

  const wind = new ProWindForceModule();

  // wind 直接位移不被 drag 衰减: 0.2 * 2.8s ≈ 0.56 单位最大横漂
  wind.wind = ProDistributionVector3.fromRange([0.1, 0, -0.06], [0.2, 0, 0.06]);

  const drag = new ProDragModule();

  drag.drag = ProDistributionFloat.fromRange(0.3, 0.7);

  const curlNoise = new ProCurlNoiseForceModule();

  curlNoise.amplitude = 0.2;
  curlNoise.frequency = 0.55;

  const forces = new ProSolveForcesAndVelocityModule();

  const rotationRate = new ProSpriteRotationRateModule();

  rotationRate.rate = ProDistributionFloat.fromRange(-2.2, 2.2);

  // 每片叶子在 spawn 时锁定 4 个剪影里的一个
  const subUV = new ProSubUVAnimationModule();

  subUV.mode = ProSubUVMode.DirectSet;
  subUV.totalFrames = 4;

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.fromKeyframes(
    [kf(0, 1), kf(1, 1)],
    [kf(0, 1), kf(1, 1)],
    [kf(0, 1), kf(1, 1)],
    [kf(0, 0), kf(0.15, 1), kf(0.8, 1), kf(1, 0)],
  ));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(shapeLocation);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(wind);
  system.addModule(drag);
  system.addModule(curlNoise);
  system.addModule(forces);
  system.addModule(rotationRate);
  system.addModule(subUV);
  system.addModule(scaleColor);
  system.addModule(updateAge);
}

// ─────────────────────────────────────────────────────────────────────────
//  Plasma Conduit —— RibbonWidthScale + ribbon velocity 朝向 + custom 细分 + tile 贴图
//  一条横向流动的等离子能量束：用 writeRibbonWidth 写初始宽度，再用
//  RibbonWidthScale 做中粗两端尖的纺锤形；CalculateAccurateVelocity 喂给
//  ribbon 的速度朝向，Catmull-Rom 细分让束体平滑弯曲。
// ─────────────────────────────────────────────────────────────────────────
function configurePlasmaConduitModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  emitterProps.maxParticleCount = 400;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(130);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromConstant(0.85);
  initParticle.startColor = ProDistributionColor.fromConstant(0.2, 0.32, 0.45, 0.8);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.2);
  initParticle.positionOrigin = ProDistributionVector3.fromConstant(-0.8, 0, 0);
  // RibbonWidthScale 的硬依赖：必须开 writeRibbonWidth 写 InitialRibbonWidth，
  // 否则 InitialRibbonWidth 为 0 → 输出宽度 0 → ribbon 不可见
  initParticle.writeRibbonWidth = true;
  initParticle.ribbonWidth = ProDistributionFloat.fromConstant(0.28);

  const velocity = new ProAddVelocityInConeModule();

  velocity.velocityType = 'linear';
  // 行程 = v/drag * (1 - e^(-drag*t)) = 2.5/1.8 * (1-e^(-1.53)) ≈ 1.08; 加起始偏移总跨度 ~1.88 < 2.0
  velocity.linearVelocity = ProDistributionVector3.fromConstant(2.5, 0, 0);
  velocity.linearVelocityScale = ProDistributionVector3.fromRange([1, 0, 0], [1, 0, 0]);

  const drag = new ProDragModule();

  drag.drag = ProDistributionFloat.fromConstant(1.8);

  const curlNoise = new ProCurlNoiseForceModule();

  curlNoise.amplitude = 0.03;
  curlNoise.frequency = 0.6;

  const forces = new ProSolveForcesAndVelocityModule();

  // ribbon velocity facing 需要真实速度 → 末端反算
  const accurateVel = new ProCalculateAccurateVelocityModule();

  // 纺锤形：沿生命周期 width 0.15 → 1.0 → 0.1
  const widthScale = new ProRibbonWidthScaleModule();

  widthScale.scale = ProDistributionFloat.fromCurve(ProCurveFloat.fromKeyframes([kf(0, 0.15), kf(0.5, 1.0), kf(1, 0.1)]));

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.fromKeyframes(
    [kf(0, 1), kf(1, 0.4)],
    [kf(0, 1), kf(1, 0.7)],
    [kf(0, 1), kf(1, 1)],
    [kf(0, 0.2), kf(0.5, 1), kf(1, 0.2)],
  ));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(velocity);
  system.addModule(drag);
  system.addModule(curlNoise);
  system.addModule(forces);
  system.addModule(accurateVel);
  system.addModule(widthScale);
  system.addModule(scaleColor);
  system.addModule(updateAge);
}

// ─────────────────────────────────────────────────────────────────────────
//  Fireworks Finale —— 多段 SpawnBurst + fromPoint 径向 + random SubUV + age 排序
//  四批错峰绽放的球状烟花：极小球面散布给 fromPoint 一个方向基准，火花从
//  中心径向爆开，受重力下坠、阻力悬停，random 切帧闪烁。
// ─────────────────────────────────────────────────────────────────────────
function configureFireworksFinaleModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  // duration > 0 + infinite → 每 3 秒重新触发整组 burst
  emitterProps.duration = ProDistributionFloat.fromConstant(3.0);
  emitterProps.maxParticleCount = 900;

  const spawnBurst = new ProSpawnBurstModule();

  // 多段错峰（单 demo 唯一用到多 burst 数组）
  spawnBurst.bursts = [
    { time: 0.0, count: 90 },
    { time: 0.7, count: 110 },
    { time: 1.4, count: 130 },
    { time: 2.1, count: 150 },
  ];

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.1, 1.8);
  // ADD 叠加 + bloom，颜色压暗避免过曝
  initParticle.startColor = ProDistributionColor.fromRange([0.35, 0.06, 0.06, 0.8], [0.45, 0.4, 0.18, 0.8]);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.16);
  initParticle.spriteRotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  // 极小球面散布，给 fromPoint 提供非退化的方向基准
  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'sphere';
  shapeLocation.sphereMin = 0.04;
  shapeLocation.sphereMax = 0.08;

  // 从中心径向爆开
  const velocity = new ProAddVelocityInConeModule();

  velocity.velocityType = 'fromPoint';
  velocity.pointOrigin = [0, 0, 0];
  velocity.pointSpeed = ProDistributionFloat.fromRange(1.4, 2.2);

  const gravity = new ProGravityForceModule();

  gravity.gravity = ProDistributionVector3.fromConstant(0, -1.6, 0);

  const drag = new ProDragModule();

  drag.drag = ProDistributionFloat.fromConstant(0.7);

  const forces = new ProSolveForcesAndVelocityModule();

  // 快速随机切帧 → 闪烁
  const subUV = new ProSubUVAnimationModule();

  subUV.mode = ProSubUVMode.Random;
  subUV.totalFrames = 4;
  subUV.randomChangeInterval = 0.06;

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.fromKeyframes(
    [kf(0, 1), kf(1, 1)],
    [kf(0, 1), kf(1, 1)],
    [kf(0, 1), kf(1, 1)],
    [kf(0, 0), kf(0.06, 1), kf(1, 0)],
  ));

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionVector2.fromCurves(ProCurveFloat.linear(1.3, 0.4), ProCurveFloat.linear(1.3, 0.4));

  const rotationRate = new ProSpriteRotationRateModule();

  rotationRate.rate = ProDistributionFloat.fromRange(-2.5, 2.5);

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnBurst);
  system.addModule(initParticle);
  system.addModule(shapeLocation);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(drag);
  system.addModule(forces);
  system.addModule(subUV);
  system.addModule(scaleColor);
  system.addModule(scaleSize);
  system.addModule(rotationRate);
  system.addModule(updateAge);
}

// ─────────────────────────────────────────────────────────────────────────
//  Comet Swarm —— InheritVelocity + CalculateAccurateVelocity（运动发射器 / 世界空间）
//  彗核 item 绕小圈平移（ProDemoOrbitMover），world space 下发射器产生非零
//  emitterVelocity，新生火花继承它沿切线甩出；CalculateAccurateVelocity 从净
//  位移反算真实速度，让 velocity-facing 拖尾朝向真实运动方向。
// ─────────────────────────────────────────────────────────────────────────
function configureCometSwarmModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  emitterProps.simulationSpace = 'world';
  emitterProps.maxParticleCount = 700;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(260);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(0.45, 0.85);
  initParticle.startColor = ProDistributionColor.fromRange([0.25, 0.4, 0.55, 1.0], [0.4, 0.5, 0.58, 1.0]);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.18);

  // 小范围球面散布，避免火花全挤在一个点
  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'sphere';
  shapeLocation.sphereMin = 0.0;
  shapeLocation.sphereMax = 0.06;

  // 各向轻微随机喷射
  const velocity = new ProAddVelocityInConeModule();

  velocity.velocityType = 'inCone';
  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI; // 半球喷
  velocity.speed = ProDistributionFloat.fromRange(0.25, 0.8);

  // 继承彗核的世界运动速度（ParticleSpawn 阶段累加，必须在 AddVelocity 之后）
  const inherit = new ProInheritVelocityModule();

  inherit.velocityScale = [1.05, 1.05, 1.05];

  const drag = new ProDragModule();

  drag.drag = ProDistributionFloat.fromConstant(2.4);

  const forces = new ProSolveForcesAndVelocityModule();

  // 末端从净位移反算真实速度
  const accurateVel = new ProCalculateAccurateVelocityModule();

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.linear([1, 1, 1, 1], [0.2, 0.45, 1.0, 0]));

  // 越快的火花拉得越长（读 accurateVel 后的真实速度）
  const scaleSize = new ProScaleSizeBySpeedModule();

  scaleSize.scaleDistribution = new ProDistributionVector2(
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(0.6, 1.8)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(0.6, 1.8)),
    true,
  );
  scaleSize.velocityNorm = 1 / (3.3 * 3.3);

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(shapeLocation);
  system.addModule(velocity);
  system.addModule(inherit);
  system.addModule(drag);
  system.addModule(forces);
  system.addModule(accurateVel);
  system.addModule(scaleColor);
  system.addModule(scaleSize);
  system.addModule(updateAge);
}

// ─────────────────────────────────────────────────────────────────────────
//  Arcane Rune —— unaligned 朝向 + fixedRate SubUV + warmup + 透视地面符文环
//  用 RotateAroundPoint（rotationAxis=[90,0,0] → 本地 XY 面）排出一圈缓慢自转
//  的符文；item 后仰 58° 让整盘在地面透视铺开，unaligned 让符文与该平面共面、
//  像地面贴花；fixedRate 序列帧让每个符文不停闪动。
// ─────────────────────────────────────────────────────────────────────────
function configureArcaneRuneModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  emitterProps.maxParticleCount = 220;
  emitterProps.warmupTime = 2.0; // 启动即满阵
  emitterProps.warmupTickDelta = 1 / 60;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(26);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(2.6, 3.4);
  // ADD 叠加 + bloom，颜色压暗避免过曝
  initParticle.startColor = ProDistributionColor.fromConstant(0.22, 0.42, 0.55, 1.0);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.55);

  // 用 RotateAroundPoint 在本地 XY 平面排出旋转符文环
  const orbit = new ProRotateAroundPointModule();

  orbit.rate = ProDistributionFloat.fromConstant(60); // 缓慢公转
  orbit.radius = ProDistributionFloat.fromRange(1.5, 1.65);
  orbit.phase = ProDistributionFloat.fromRange(0, 360);
  orbit.rotationAxis = [90, 0, 0];

  const rotationRate = new ProSpriteRotationRateModule();

  rotationRate.rate = ProDistributionFloat.fromConstant(0.4);

  // 循环序列帧：符文不停闪动（与生命周期无关）
  const subUV = new ProSubUVAnimationModule();

  subUV.mode = ProSubUVMode.FixedRate;
  subUV.totalFrames = 9;
  subUV.framesPerSecond = 6;

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.fromKeyframes(
    [kf(0, 1), kf(1, 1)],
    [kf(0, 1), kf(1, 1)],
    [kf(0, 1), kf(1, 1)],
    [kf(0, 0), kf(0.2, 1), kf(0.8, 1), kf(1, 0)],
  ));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(orbit);
  system.addModule(rotationRate);
  system.addModule(subUV);
  system.addModule(scaleColor);
  system.addModule(updateAge);
}

// ─────────────────────────────────────────────────────────────────────────
//  Spiral Galaxy —— Cylinder 形状 + 差速轨道 + 关键帧颜色 + distance 排序
//  极薄圆柱盘做星点种子，RotateAroundPoint（face-on）用不同的角速度与半径把
//  星点铺成旋转盘面，差速旋转把盘绞成旋臂；关键帧颜色给出白核→蓝臂→暗红尘。
// ─────────────────────────────────────────────────────────────────────────
function configureSpiralGalaxyModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  emitterProps.maxParticleCount = 1400;
  emitterProps.warmupTime = 4.0; // 开场即转好的星系
  emitterProps.warmupTickDelta = 1 / 60;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(300);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(3.5, 5.5);
  // ADD 叠加 + bloom，星点压暗避免过曝（叠加后核心自然变亮）
  initParticle.startColor = ProDistributionColor.fromConstant(0.42, 0.44, 0.5, 1.0);
  initParticle.startSize = ProDistributionVector2.fromRange([0.06, 0.06], [0.15, 0.15], true);

  // 极薄圆柱盘做星点种子（唯一 cylinder demo）；真正的盘面由轨道半径铺开
  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'cylinder';
  shapeLocation.cylinderRadius = 0.12;
  shapeLocation.cylinderHeight = 0.05;
  shapeLocation.cylinderHeightMidpoint = 0.5;

  // 差速旋转：每星各自的角速度/半径，phase 铺满整圈；face-on（XY 平面）
  const orbit = new ProRotateAroundPointModule();

  orbit.rate = ProDistributionFloat.fromRange(120, 320);
  orbit.radius = ProDistributionFloat.fromRange(0.2, 1.95);
  orbit.phase = ProDistributionFloat.fromRange(0, 360);
  orbit.rotationAxis = [90, 0, 0];

  const scaleColor = new ProScaleColorModule();

  // 白核 → 蓝臂 → 暗红尘
  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.fromKeyframes(
    [kf(0, 1), kf(0.5, 0.85), kf(1, 0.9)],
    [kf(0, 1), kf(0.5, 0.7), kf(1, 0.35)],
    [kf(0, 1), kf(0.4, 1), kf(1, 0.45)],
    [kf(0, 0), kf(0.12, 1), kf(0.85, 1), kf(1, 0)],
  ));

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionVector2.fromCurves(
    ProCurveFloat.fromKeyframes([kf(0, 0.5), kf(0.2, 1.2), kf(1, 0.8)]),
    ProCurveFloat.fromKeyframes([kf(0, 0.5), kf(0.2, 1.2), kf(1, 0.8)]),
  );

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(shapeLocation);
  system.addModule(orbit);
  system.addModule(scaleColor);
  system.addModule(scaleSize);
  system.addModule(updateAge);
}

// ─────────────────────────────────────────────────────────────────────────
//  Dragon Breath —— innerConeAngle 空心锥 + speedFalloff + 浮力重力 + 火焰序列帧
//  斜向上的空心锥喷射，锥边粒子更快 → 火舌；正 Y 重力做热气上浮，curl 抖动，
//  16 帧火焰序列帧随生命周期烧完一遍。
// ─────────────────────────────────────────────────────────────────────────
function configureDragonBreathModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  emitterProps.maxParticleCount = 700;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(180);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(0.6, 1.0);
  // ADD 叠加 + bloom，颜色压暗避免过曝
  initParticle.startColor = ProDistributionColor.fromConstant(0.5, 0.42, 0.2, 1.0);
  initParticle.startSize = ProDistributionVector2.fromRange([0.28, 0.28], [0.5, 0.5], true);
  initParticle.spriteRotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  // 斜向上的空心锥喷射，锥边更快
  const velocity = new ProAddVelocityInConeModule();

  velocity.velocityType = 'inCone';
  velocity.coneAxis = normalize3(0.34, 1, 0);
  velocity.coneAngle = Math.PI / 3;       // 60° 全角
  velocity.innerConeAngle = Math.PI / 5;  // 36° 空心 → 环形火口
  velocity.speed = ProDistributionFloat.fromRange(1.9, 2.8);
  velocity.speedFalloffFromConeAxis = 0.7;

  // 热气上浮（正 Y 重力）
  const gravity = new ProGravityForceModule();

  gravity.gravity = ProDistributionVector3.fromConstant(0, 1.0, 0);

  const drag = new ProDragModule();

  drag.drag = ProDistributionFloat.fromConstant(1.8);

  // 火焰抖动
  const curlNoise = new ProCurlNoiseForceModule();

  curlNoise.amplitude = 0.7;
  curlNoise.frequency = 1.3;

  const forces = new ProSolveForcesAndVelocityModule();

  const subUV = new ProSubUVAnimationModule();

  subUV.mode = ProSubUVMode.SyncToAge;
  subUV.totalFrames = 16;

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = ProDistributionColor.fromCurve(ProCurveColor.fromKeyframes(
    [kf(0, 1), kf(0.5, 1), kf(1, 0.4)],
    [kf(0, 1), kf(0.5, 0.45), kf(1, 0.08)],
    [kf(0, 0.7), kf(0.5, 0.12), kf(1, 0.06)],
    [kf(0, 0), kf(0.12, 1), kf(1, 0)],
  ));

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionVector2.fromCurves(ProCurveFloat.linear(0.8, 2.4), ProCurveFloat.linear(0.8, 2.4));

  const rotationRate = new ProSpriteRotationRateModule();

  rotationRate.rate = ProDistributionFloat.fromRange(-1.4, 1.4);

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(drag);
  system.addModule(curlNoise);
  system.addModule(forces);
  system.addModule(subUV);
  system.addModule(scaleColor);
  system.addModule(scaleSize);
  system.addModule(updateAge);
}

function configureAutumnGaleRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  props.sortMode = 'viewDepth';
  props.subUVRows = 2;
  props.subUVCols = 2;
  props.subUVTotal = 4;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'autumn-leaves', createProceduralLeafAtlasCanvas, 'autumn leaves');
}

function configurePlasmaConduitRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProRibbonRendererProperties();

  props.blending = spec.BlendingMode.ADD;
  props.facingMode = ProRibbonFacingMode.Velocity;
  props.tessellationMode = ProRibbonTessellationMode.Custom;
  props.customSubdivisions = 2;
  props.curveTension = 0.8;
  props.textureMode = ProRibbonTextureMode.Tile;
  props.tileLength = 0.3;

  const renderer = new ProRibbonRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'plasma-conduit', createProceduralPlasmaConduitCanvas, 'plasma conduit');
}

function configureFireworksFinaleRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ADD;
  props.facingMode = 'velocity';
  props.sortMode = 'age';
  props.subUVRows = 2;
  props.subUVCols = 2;
  props.subUVTotal = 4;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'firework-sparkles', createProceduralSparkleAtlasCanvas, 'firework sparkles');
}

function configureCometSwarmRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ADD;
  props.facingMode = 'velocity';

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'comet-spark', createProceduralCometSparkCanvas, 'comet spark');
}

function configureArcaneRuneRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ADD;
  props.facingMode = 'unaligned';
  props.subUVRows = 3;
  props.subUVCols = 3;
  props.subUVTotal = 9;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'arcane-runes', createProceduralRuneAtlasCanvas, 'arcane runes');
}

function configureSpiralGalaxyRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ADD;
  props.sortMode = 'distance';

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  applyGeneratedTexture(renderer, 'galaxy-star', createProceduralStarCanvas, 'galaxy star');
}

function configureDragonBreathRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ADD;
  props.subUVRows = 4;
  props.subUVCols = 4;
  props.subUVTotal = 16;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  // 复用已有的 4x4 火球序列帧（与 flipbook-burst 共享缓存）
  applyGeneratedTexture(renderer, 'flipbook-fireball', createProceduralFireballFlipbookCanvas, 'fireball flipbook');
}

type ProceduralTextureTarget = ProSpriteRenderer | ProRibbonRenderer;

const proceduralTextureDataUrls = new Map<string, string>();

/**
 * 同步登记一张程序生成的 texture URL 到 properties.__debugUrl。
 *
 * 之前的版本会同步生成 URL + 异步加载 texture 调 setTexture，但 demo 现在走
 * toData → fromData roundtrip：原始 renderer 被立刻 dispose，pending 的
 * setTexture 会作用到已释放的 material 上。改为 URL-only 之后，由
 * fromData → addSnapshot 统一触发异步加载（作用在新 renderer 上）。
 */
function applyGeneratedTexture (
  renderer: ProceduralTextureTarget,
  cacheKey: string,
  canvasFactory: () => HTMLCanvasElement,
  _label: string,
): void {
  const url = getProceduralTextureUrl(cacheKey, canvasFactory);

  (renderer.properties as unknown as Record<string, string>).__debugUrl = url;
}

function getProceduralTextureUrl (cacheKey: string, canvasFactory: () => HTMLCanvasElement): string {
  const cached = proceduralTextureDataUrls.get(cacheKey);

  if (cached) {
    return cached;
  }

  const url = canvasFactory().toDataURL();

  proceduralTextureDataUrls.set(cacheKey, url);

  return url;
}

// ═══════════════════════════════════════════════════════════════════════════
//  WebGL GLSL Procedural Texture Generation
// ═══════════════════════════════════════════════════════════════════════════

const FULLSCREEN_VERT = `#version 300 es
out vec2 vUV;
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = vec2(pos.x, 1.0 - pos.y);
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

const GLSL_COMMON = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

float hash11(float p) {
  return fract(sin(p * 127.1 + 311.7) * 43758.5453123);
}

vec4 alphaBlend(vec4 base, vec4 top) {
  float a = top.a + base.a * (1.0 - top.a);
  if (a < 0.001) return vec4(0.0);
  vec3 c = (top.rgb * top.a + base.rgb * base.a * (1.0 - top.a)) / a;
  return vec4(c, a);
}

float radialGrad(vec2 uv, vec2 center, float innerR, float outerR) {
  float d = length(uv - center);
  return 1.0 - smoothstep(innerR, outerR, d);
}

float linearGrad(float t, float start, float end) {
  return clamp((t - start) / (end - start), 0.0, 1.0);
}

float sdEllipse(vec2 p, vec2 center, vec2 radii) {
  vec2 q = (p - center) / radii;
  return length(q) - 1.0;
}

float sdBox(vec2 p, vec2 center, vec2 halfSize) {
  vec2 d = abs(p - center) - halfSize;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdRing(vec2 p, vec2 center, float radius, float thickness) {
  float d = abs(length(p - center) - radius);
  return 1.0 - smoothstep(0.0, thickness, d);
}

`;

let sharedGLCanvas: HTMLCanvasElement | null = null;
let sharedGL: WebGL2RenderingContext | null = null;
let sharedVS: WebGLShader | null = null;
let sharedVAO: WebGLVertexArrayObject | null = null;

function ensureSharedGL (): WebGL2RenderingContext | null {
  if (sharedGL && !sharedGL.isContextLost()) {
    return sharedGL;
  }
  sharedGLCanvas = document.createElement('canvas');
  const gl = sharedGLCanvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false });

  if (!gl) {
    return null;
  }
  sharedGL = gl;
  sharedVS = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(sharedVS, FULLSCREEN_VERT);
  gl.compileShader(sharedVS);
  sharedVAO = gl.createVertexArray();

  return gl;
}

function renderShaderToCanvas (width: number, height: number, fragSource: string): HTMLCanvasElement {
  const gl = ensureSharedGL();
  const canvas = sharedGLCanvas!;

  if (!gl || !canvas) {
    const fallback = document.createElement('canvas');

    fallback.width = width;
    fallback.height = height;

    return fallback;
  }

  canvas.width = width;
  canvas.height = height;

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;

  gl.shaderSource(fs, GLSL_COMMON + fragSource);
  gl.compileShader(fs);

  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error('[procedural-texture] Fragment shader error:', gl.getShaderInfoLog(fs));
    gl.deleteShader(fs);

    return canvas;
  }

  const prog = gl.createProgram()!;

  gl.attachShader(prog, sharedVS!);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  gl.bindVertexArray(sharedVAO);
  gl.viewport(0, 0, width, height);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);

  gl.deleteShader(fs);
  gl.deleteProgram(prog);

  // 将结果拷贝到独立 canvas，因为共享 canvas 下次渲染会被覆盖
  const output = document.createElement('canvas');

  output.width = width;
  output.height = height;
  const ctx2d = output.getContext('2d')!;

  ctx2d.drawImage(canvas, 0, 0);

  return output;
}

// ─── GLSL Procedural Texture Functions ───────────────────────────────────────

function createProceduralWarmBodyCanvas (): HTMLCanvasElement {
  return renderShaderToCanvas(192, 192, `
void main() {
  vec2 uv = vUV;
  vec2 c = vec2(0.5, 0.5625);
  float d = length(uv - c);
  float g = exp(-d * d * 18.0);
  vec3 col = mix(vec3(1.0, 0.675, 0.376), vec3(1.0, 0.894, 0.714), pow(g, 1.5));
  float a = g * 0.35;
  // inner highlight
  vec2 c2 = vec2(0.5, 0.583);
  float d2 = length(uv - c2);
  float g2 = exp(-d2 * d2 * 40.0);
  col = mix(col, vec3(1.0, 0.95, 0.82), g2);
  a += g2 * 0.15;
  fragColor = vec4(col, a);
}
`);
}

function createProceduralSmokeBodyCanvas (): HTMLCanvasElement {
  // orbit-smoke: 36/s, 1.4-2.0s, orbit radius 0.7-1.2, ~60 alive in tight ring
  // startColor alpha 0.82-0.96, particles orbit and heavily overlap
  return renderShaderToCanvas(192, 192, `
void main() {
  vec2 uv = vUV;
  vec4 col = vec4(0.0);
  vec2 puffs[4] = vec2[4](vec2(0.375,0.44), vec2(0.60,0.41), vec2(0.48,0.62), vec2(0.69,0.59));
  float radii[4] = float[4](0.14, 0.12, 0.16, 0.10);
  vec3 colors[4] = vec3[4](
    vec3(0.86, 0.89, 0.93), vec3(0.69, 0.74, 0.82),
    vec3(0.57, 0.60, 0.68), vec3(0.81, 0.84, 0.89));
  float alphas[4] = float[4](0.06, 0.05, 0.045, 0.035);
  for (int i = 0; i < 4; i++) {
    float d = length(uv - puffs[i]);
    float r = radii[i];
    float g = exp(-d * d / (r * r * 0.15));
    col = alphaBlend(col, vec4(colors[i], g * alphas[i]));
  }
  fragColor = col;
}
`);
}

function createProceduralSmokeHighlightCanvas (): HTMLCanvasElement {
  return renderShaderToCanvas(128, 128, `
void main() {
  vec2 uv = vUV;
  vec2 c = vec2(0.531, 0.484);
  float d = length(uv - c);
  float g = exp(-d * d * 20.0);
  vec3 col = mix(vec3(0.745, 0.91, 1.0), vec3(1.0), pow(g, 2.0));
  fragColor = vec4(col, g * 0.18);
}
`);
}

function createProceduralShockBandCanvas (): HTMLCanvasElement {
  // shock-ring: burst 140 from ring shape, ScaleSize 1.4→3.8, ALPHA
  // At ring center ~50 particles overlap. startColor alpha=0.75
  return renderShaderToCanvas(256, 256, `
void main() {
  vec2 uv = vUV;
  float d = length(uv - vec2(0.5));
  float ringCenter = 0.3;
  float ringWidth = 0.022;
  float ring = exp(-pow((d - ringCenter) / ringWidth, 2.0));
  float haze = exp(-pow((d - ringCenter) / 0.05, 2.0)) * 0.2;
  vec3 col = mix(vec3(0.45, 0.86, 1.0), vec3(0.84, 0.97, 1.0), ring);
  float a = ring * 0.012 + haze * 0.002;
  fragColor = vec4(col, a);
}
`);
}

function createProceduralShockwaveHazeCanvas (): HTMLCanvasElement {
  return renderShaderToCanvas(256, 256, `
void main() {
  vec2 uv = vUV;
  float d = length(uv - vec2(0.5));
  float ring = exp(-pow((d - 0.35) / 0.1, 2.0));
  vec3 c = mix(vec3(0.47, 0.59, 1.0), vec3(0.63, 0.82, 1.0), ring);
  fragColor = vec4(c, ring * 0.08);
}
`);
}

function createProceduralPlasmaBodyCanvas (): HTMLCanvasElement {
  return renderShaderToCanvas(224, 224, `
void main() {
  vec2 uv = vUV;
  float d = length(uv - vec2(0.5));
  float g = exp(-d * d * 12.0);
  vec3 c = mix(vec3(0.43, 0.49, 1.0), vec3(0.72, 0.96, 1.0), pow(g, 1.5));
  float a = g * 0.3;
  // blobs for detail
  for (int i = 0; i < 4; i++) {
    float angle = float(i) * 1.57 + 0.4;
    float dist = 0.15 + hash11(float(i) + 50.0) * 0.08;
    vec2 bp = vec2(0.5) + vec2(cos(angle), sin(angle)) * dist;
    float bd = length(uv - bp);
    float bg = exp(-bd * bd * 60.0) * 0.12;
    a += bg;
    c = mix(c, vec3(0.74, 0.94, 1.0), bg);
  }
  fragColor = vec4(c, a);
}
`);
}

function createProceduralPlasmaCoreCanvas (): HTMLCanvasElement {
  // Used by noise-field (60 alive, size up to 1.03 units, ALPHA)
  // and trail-per-source source (12 alive).
  // 60 particles × 1 unit each = MASSIVE overlap. Only a pinpoint should be visible.
  return renderShaderToCanvas(160, 160, `
void main() {
  vec2 uv = vUV;
  float d = length(uv - vec2(0.5));
  // pinpoint core: visible only in center ~5% of texture
  float core = exp(-d * d * 800.0);
  // subtle haze that's almost invisible
  float haze = exp(-d * d * 80.0);
  vec3 c = mix(vec3(0.36, 0.82, 1.0), vec3(1.0), core);
  // alpha: tiny bright dot + barely-there haze
  float a = core * 0.18 + haze * 0.015;
  fragColor = vec4(c, a);
}
`);
}

function createProceduralEnergyStreakCanvas (): HTMLCanvasElement {
  // acceleration-column: 35 stacking particles. Use dim RGB approach.
  return renderShaderToCanvas(128, 320, `
void main() {
  vec2 uv = vUV;
  float cx = abs(uv.x - 0.5);
  float cy = abs(uv.y - 0.5);
  float hG = exp(-cx * cx * 500.0);
  float vG = exp(-cy * cy * 12.0);
  float endFade = smoothstep(0.0, 0.18, 0.5 - cy);
  float aura = exp(-cx * cx * 30.0) * vG;
  // dim RGB: cap brightness at 0.3 for center, darker for edges
  vec3 col = mix(vec3(0.06, 0.15, 0.18), vec3(0.15, 0.3, 0.25), vG);
  col = mix(col, vec3(0.25, 0.45, 0.4), hG * vG * 0.5);
  float a = (hG * vG * endFade * 0.08 + aura * 0.015);
  fragColor = vec4(col, a);
}
`);
}

function createProceduralColumnAuraCanvas (): HTMLCanvasElement {
  return renderShaderToCanvas(160, 320, `
void main() {
  vec2 uv = vUV;
  float cx = (uv.x - 0.5) / 0.34;
  float cy = (uv.y - 0.5) / 0.47;
  float ellipse = cx * cx + cy * cy;
  float g = exp(-ellipse * 2.0);
  float yFade = smoothstep(0.0, 0.2, 0.5 - abs(uv.y - 0.5));
  vec3 c = mix(vec3(0.35, 1.0, 0.84), vec3(0.38, 0.74, 1.0), g);
  fragColor = vec4(c, g * yFade * 0.18);
}
`);
}

function createProceduralFountainFlameCanvas (): HTMLCanvasElement {
  // fountain: 100/s, ~25 overlap at emitter. Use dim RGB + moderate alpha.
  return renderShaderToCanvas(256, 320, `
void main() {
  vec2 uv = vUV;
  vec2 center = vec2(0.5, 0.55);
  vec2 p = uv - center;

  float yNorm = (p.y + 0.35) / 0.6;
  float yClamp = clamp(yNorm, 0.0, 1.0);

  float noiseX = (hash21(uv * 8.0 + 1.0) - 0.5) * 0.05 * (1.0 - yClamp);
  vec2 dp = vec2(p.x + noiseX, p.y);

  // broader flame shape so individual particles have visible area
  float taper = 0.15 * pow(1.0 - yClamp, 1.1) + 0.02;
  float xNorm = abs(dp.x) / taper;
  float shape = exp(-xNorm * xNorm * 3.5);
  float vertMask = smoothstep(-0.35, -0.1, p.y) * smoothstep(0.25, 0.02, p.y);
  float flame = shape * vertMask;

  float coreTaper = taper * 0.3;
  float coreX = abs(dp.x) / max(coreTaper, 0.001);
  float core = exp(-coreX * coreX * 5.0) * vertMask * smoothstep(0.18, -0.05, p.y);

  // DIM RGB: darken the output color instead of relying solely on alpha
  vec3 col = mix(vec3(0.4, 0.12, 0.02), vec3(0.6, 0.35, 0.08), yClamp);
  col = mix(col, vec3(0.7, 0.5, 0.2), pow(yClamp, 2.0) * shape);
  col = mix(col, vec3(0.85, 0.75, 0.5), core * 0.7);

  float a = flame * 0.06 + core * 0.04;
  float ember = step(0.98, hash21(uv * 40.0)) * flame * 0.02;
  a += ember;

  fragColor = vec4(col, a);
}
`);
}

function createProceduralSparkShardCanvas (): HTMLCanvasElement {
  // Used by spark (55/s, velocity-facing, ALPHA blend, ~45 alive)
  // Hot metal shard with bright head and streaking tail
  return renderShaderToCanvas(256, 96, `
void main() {
  vec2 uv = vUV;
  // asymmetric elongated shape: bright compact head, long fading tail
  float cx = uv.x - 0.28;
  float cy = uv.y - 0.5;

  // tail: exponential decay to the right
  float tailDecay = cx > 0.0 ? exp(-cx * 4.0) : exp(cx * 12.0);
  // narrow vertical cross-section
  float yProfile = exp(-cy * cy * 250.0);
  // wider secondary glow around the body
  float yGlow = exp(-cy * cy * 60.0);

  float body = tailDecay * yProfile;
  float glow = tailDecay * yGlow * 0.3;

  // scorching white head hotspot
  float hd = length((uv - vec2(0.25, 0.5)) * vec2(1.5, 1.0));
  float head = exp(-hd * hd * 600.0);

  // sparking fragments around head
  float sparks = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 sp = vec2(0.22 + hash11(fi + 1.0) * 0.12, 0.5 + (hash11(fi + 5.0) - 0.5) * 0.15);
    float sd = length((uv - sp) * vec2(3.0, 8.0));
    sparks += exp(-sd * sd * 20.0) * 0.06;
  }

  // color: deep orange tail → yellow mid → white head
  vec3 col = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.8, 0.3), tailDecay);
  col = mix(col, vec3(1.0, 0.95, 0.8), body * 0.7);
  col = mix(col, vec3(1.0), head * 0.95);

  float a = body * 0.45 + glow + head * 0.5 + sparks;
  fragColor = vec4(col, a);
}
`);
}

function createProceduralShockwaveCanvas (): HTMLCanvasElement {
  return renderShaderToCanvas(256, 256, `
void main() {
  vec2 uv = vUV;
  float d = length(uv - vec2(0.5));
  float angle = atan(uv.y - 0.5, uv.x - 0.5);
  vec4 col = vec4(0.0);
  // concentric rings
  for (int i = 0; i < 3; i++) {
    float r = (60.0 + float(i) * 10.0) / 256.0;
    float w = (22.0 - float(i) * 5.0) / 256.0 * 0.4;
    float ring = exp(-pow((d - r) / w, 2.0));
    col = alphaBlend(col, vec4(0.96, 0.99, 1.0, ring * (0.5 - float(i) * 0.1)));
  }
  // radial halo
  float halo = exp(-pow((d - 0.33) / 0.08, 2.0)) * 0.3;
  col = alphaBlend(col, vec4(0.4, 0.84, 1.0, halo));
  // spokes
  for (int i = 0; i < 16; i++) {
    float tA = float(i) / 16.0 * 6.2832;
    float aD = abs(mod(angle - tA + 3.14159, 6.2832) - 3.14159);
    float spoke = exp(-aD * aD * 800.0);
    float inner = (58.0 + float(i % 2) * 8.0) / 256.0;
    float outer = (96.0 + float(i % 3) * 10.0) / 256.0;
    float radial = smoothstep(inner, inner + 0.01, d) * smoothstep(outer, outer - 0.01, d);
    col = alphaBlend(col, vec4(0.86, 0.97, 1.0, spoke * radial * 0.12));
  }
  fragColor = col;
}
`);
}

function createProceduralOrbitSmokeCanvas (): HTMLCanvasElement {
  // Used by orbit-smoke (36/s, 1.4-2.0s = ~60 alive, ALPHA blend)
  return renderShaderToCanvas(192, 192, `
void main() {
  vec2 uv = vUV;
  vec4 col = vec4(0.0);
  vec2 puffs[5] = vec2[5](vec2(0.34,0.36), vec2(0.59,0.33), vec2(0.48,0.60), vec2(0.69,0.58), vec2(0.29,0.60));
  float radii[5] = float[5](0.25, 0.23, 0.30, 0.20, 0.18);
  vec3 colors[5] = vec3[5](
    vec3(0.85,0.88,0.93), vec3(0.69,0.74,0.83),
    vec3(0.57,0.61,0.71), vec3(0.80,0.83,0.90), vec3(0.53,0.57,0.67));
  float alphas[5] = float[5](0.45, 0.35, 0.30, 0.25, 0.20);
  for (int i = 0; i < 5; i++) {
    float d = length(uv - puffs[i]);
    float r = radii[i];
    float g = exp(-d * d / (r * r * 0.3));
    col = alphaBlend(col, vec4(colors[i], g * alphas[i]));
  }
  // wispy holes
  for (int i = 0; i < 7; i++) {
    vec2 hp = vec2(mix(0.2, 0.8, hash11(float(i) + 101.0)), mix(0.2, 0.8, hash11(float(i) + 111.0)));
    float hr = mix(0.05, 0.1, hash11(float(i) + 121.0));
    float hd = length(uv - hp);
    col.a -= exp(-hd * hd / (hr * hr)) * 0.06;
  }
  col.a = max(col.a, 0.0);
  fragColor = col;
}
`);
}

function createProceduralPlasmaCloudCanvas (): HTMLCanvasElement {
  return renderShaderToCanvas(224, 224, `
void main() {
  vec2 uv = vUV;
  float d = length(uv - vec2(0.5));
  float g = exp(-d * d * 10.0);
  vec3 c = mix(vec3(0.47, 0.36, 1.0), vec3(0.67, 0.97, 1.0), pow(g, 1.2));
  c = mix(c, vec3(1.0), pow(g, 3.0));
  float a = g * 0.4;
  // detail cells
  for (int i = 0; i < 10; i++) {
    float angle = hash11(float(i) + 201.0) * 6.2832;
    float dist = mix(0.08, 0.28, hash11(float(i) + 221.0));
    vec2 cp = vec2(0.5) + vec2(cos(angle), sin(angle)) * dist;
    float cr = mix(0.06, 0.12, hash11(float(i) + 241.0));
    float cd = length(uv - cp);
    float cg = exp(-cd * cd / (cr * cr * 0.3));
    a += cg * 0.15;
    c = mix(c, vec3(0.8, 1.0, 1.0), cg * 0.15);
  }
  a *= smoothstep(0.45, 0.35, d);
  fragColor = vec4(c, a);
}
`);
}

function createProceduralPlasmaFilamentCanvas (): HTMLCanvasElement {
  return renderShaderToCanvas(160, 320, `
void main() {
  vec2 uv = vUV;
  float cx = (uv.x - 0.5) / 0.2;
  float cy = (uv.y - 0.5) / 0.44;
  float ellipse = cx * cx + cy * cy;
  float core = exp(-ellipse * 2.5);
  float yFade = smoothstep(0.0, 0.14, uv.y) * smoothstep(1.0, 0.86, uv.y);
  vec3 col = mix(vec3(0.36, 0.86, 1.0), vec3(0.47, 1.0, 0.86), core);
  col = mix(col, vec3(1.0), pow(core, 3.0) * yFade);
  float a = core * yFade * 0.45;
  // aura
  float ax = (uv.x - 0.5) / 0.44;
  float ay = (uv.y - 0.5) / 0.49;
  float aura = exp(-(ax * ax + ay * ay) * 1.5) * yFade;
  a += aura * 0.12;
  fragColor = vec4(col, a);
}
`);
}

function createProceduralEnergyTrailCanvas (): HTMLCanvasElement {
  // Ribbon: strategy — dim RGB so even if renderer ignores texture alpha,
  // the color contribution per segment is low. Also thin cross-section.
  return renderShaderToCanvas(96, 512, `
void main() {
  vec2 uv = vUV;
  float cx = abs(uv.x - 0.5) * 2.0;
  float core = exp(-cx * cx * 40.0);
  float edge = exp(-cx * cx * 4.0);
  float yVar = 0.9 + 0.1 * sin(uv.y * 25.13);
  // DIM RGB: darken the color itself
  vec3 col = mix(vec3(0.05, 0.12, 0.18), vec3(0.2, 0.4, 0.5), core);
  float a = (edge * 0.08 + core * 0.2) * yVar;
  fragColor = vec4(col, a);
}
`);
}

function createProceduralFireballHaloFlipbookCanvas (): HTMLCanvasElement {
  return renderShaderToCanvas(384, 384, `
void main() {
  vec2 uv = vUV;
  vec2 cellUV = fract(uv * 4.0);
  int col = int(floor(uv.x * 4.0));
  int row = int(floor(uv.y * 4.0));
  int frame = row * 4 + col;
  float progress = float(frame) / 15.0;
  float d = length(cellUV - vec2(0.5));
  float radius = mix(0.2, 0.42, progress);
  float ringD = abs(d - radius * 0.75);
  float ring = exp(-ringD * ringD / (0.003 + progress * 0.002));
  vec3 c = mix(vec3(1.0, 0.93, 0.69), vec3(1.0, 0.84, 0.52), progress);
  float a = ring * max(0.12 - progress * 0.04, 0.02);
  fragColor = vec4(c, a);
}
`);
}

function createProceduralFireballFlipbookCanvas (): HTMLCanvasElement {
  // Used by flipbook-burst (0.6/s = ~1-2 alive, ALPHA) and dragon-breath (180/s, ADD)
  // For flipbook-burst: single large particle, needs dramatic detail
  // For dragon-breath: many particles but ScaleColor fades them + startColor is dim
  return renderShaderToCanvas(384, 384, `
void main() {
  vec2 uv = vUV;
  vec2 cellUV = fract(uv * 4.0);
  int col = int(floor(uv.x * 4.0));
  int row = int(floor(uv.y * 4.0));
  int frame = row * 4 + col;
  float progress = float(frame) / 15.0;
  vec2 center = vec2(0.5);
  float d = length(cellUV - center);
  float radius = 0.1 + progress * 0.28;
  float angle = atan(cellUV.y - 0.5, cellUV.x - 0.5);
  vec4 color = vec4(0.0);

  // outer dark smoke shell (appears mid-late)
  float smokeR = radius * 1.3;
  float smoke = smoothstep(smokeR, smokeR * 0.6, d) * progress;
  vec3 smokeCol = mix(vec3(0.15, 0.12, 0.1), vec3(0.4, 0.25, 0.1), 1.0 - progress);
  color = vec4(smokeCol, smoke * 0.35);

  // turbulent fire lobes — more at start, fewer later
  int lobeCount = int(mix(8.0, 4.0, progress));
  for (int i = 0; i < 8; i++) {
    if (i >= lobeCount) break;
    float fi = float(i);
    float ff = float(frame);
    float lobAngle = fi / float(lobeCount) * 6.2832 + progress * 2.5 + hash11(ff * 17.0 + fi * 7.0) * 0.8;
    float lobDist = radius * mix(0.05, 0.5, hash11(ff * 23.0 + fi * 11.0));
    vec2 lp = center + vec2(cos(lobAngle), sin(lobAngle)) * lobDist;
    float lr = radius * mix(0.25, 0.55, hash11(ff * 31.0 + fi * 5.0));
    float ld = length(cellUV - lp);
    float lg = exp(-ld * ld / (lr * lr * 0.15));

    // color evolution: white-yellow early → orange → deep red late
    float heat = lg * (1.0 - progress * 0.6);
    vec3 lc = mix(vec3(1.0, 0.4, 0.05), vec3(1.0, 0.8, 0.3), heat);
    lc = mix(lc, vec3(1.0, 0.98, 0.9), pow(heat, 3.0));
    color = alphaBlend(color, vec4(lc, lg * mix(0.65, 0.2, progress)));
  }

  // incandescent core (bright early, fades fast)
  float coreR = radius * mix(0.4, 0.15, progress);
  float coreG = exp(-d * d / (coreR * coreR * 0.12));
  vec3 coreCol = mix(vec3(1.0, 0.95, 0.8), vec3(1.0), coreG);
  color = alphaBlend(color, vec4(coreCol, coreG * mix(0.8, 0.1, progress)));

  // radiating shockwave filaments (early frames only)
  if (progress < 0.5) {
    float filaments = 0.0;
    for (int i = 0; i < 8; i++) {
      float fAngle = float(i) * 0.785 + float(frame) * 0.3;
      float aDiff = abs(mod(angle - fAngle + 3.14159, 6.2832) - 3.14159);
      float fil = exp(-aDiff * aDiff * 150.0) * smoothstep(0.0, radius * 0.3, d) * smoothstep(radius * 1.1, radius * 0.6, d);
      filaments += fil;
    }
    color = alphaBlend(color, vec4(vec3(1.0, 0.9, 0.6), filaments * (0.3 - progress * 0.6)));
  }

  // circular mask
  color.a *= smoothstep(smokeR * 1.05, smokeR * 0.7, d);

  fragColor = color;
}
`);
}

function createProceduralCometSparkCanvas (): HTMLCanvasElement {
  // Used by comet-swarm (260/s, velocity-facing, ADD blend, ~170 alive)
  // Needs VERY LOW alpha since massive particle count + ADD blending
  return renderShaderToCanvas(64, 128, `
void main() {
  vec2 uv = vUV;
  // tight elongated vertical spark
  float dx = (uv.x - 0.5) / 0.15;
  float dy = (uv.y - 0.55) / 0.35;
  float body = exp(-(dx * dx + dy * dy) * 1.5);
  // head hotspot (bottom)
  float hd = length(uv - vec2(0.5, 0.7));
  float head = exp(-hd * hd * 300.0);
  // tail fade (top)
  float tailFade = smoothstep(0.0, 0.2, uv.y);
  vec3 col = mix(vec3(0.35, 0.63, 1.0), vec3(0.71, 0.9, 1.0), body);
  col = mix(col, vec3(1.0), head * 0.7);
  // VERY LOW alpha for ADD + 260/s
  float a = (body * 0.08 + head * 0.12) * tailFade;
  fragColor = vec4(col, a);
}
`);
}

function createProceduralLeafAtlasCanvas (): HTMLCanvasElement {
  // Used by autumn-gale (28/s, 2-2.8s = ~65 alive, ALPHA blend, viewDepth sort)
  // Individual leaves need to be clearly visible — HIGH alpha
  return renderShaderToCanvas(128, 128, `
void main() {
  vec2 uv = vUV;
  vec2 cellUV = fract(uv * 2.0) - 0.5;
  int col = int(floor(uv.x * 2.0));
  int row = int(floor(uv.y * 2.0));
  int idx = row * 2 + col;

  vec3 leafColors[4] = vec3[4](
    vec3(0.95, 0.55, 0.12),
    vec3(0.85, 0.32, 0.08),
    vec3(0.70, 0.15, 0.06),
    vec3(0.60, 0.45, 0.10)
  );
  vec3 lc = leafColors[idx];

  // per-leaf rotation
  float angles[4] = float[4](0.0, 0.63, 1.26, 1.88);
  float ca = cos(angles[idx]);
  float sa = sin(angles[idx]);
  vec2 rp = vec2(ca * cellUV.x + sa * cellUV.y, -sa * cellUV.x + ca * cellUV.y);

  // leaf shape: pointed oval
  float w = 0.18 + float(idx % 2) * 0.05;
  float h = 0.36;
  float px = pow(abs(rp.x) / w, 2.2);
  float py = pow(abs(rp.y) / h, 1.6);
  float leafSDF = px + py;
  float leafMask = smoothstep(1.0, 0.6, leafSDF);

  // gradient: warm center → saturated edge
  float grad = smoothstep(1.0, 0.0, leafSDF);
  vec3 c = mix(lc * 0.7, lc, grad);
  c = mix(c, vec3(1.0, 0.92, 0.74), pow(grad, 4.0) * 0.6);

  // central vein
  float vein = exp(-rp.x * rp.x * 3000.0) * leafMask;
  c = mix(c, lc * 0.3, vein * 0.7);

  // HIGH alpha so individual leaves are clearly visible
  float a = leafMask * 0.92;
  fragColor = vec4(c, a);
}
`);
}

function createProceduralPlasmaConduitCanvas (): HTMLCanvasElement {
  // plasma-conduit: 130/s, ADD blend, 110 alive. ADD sums linearly.
  // Need alpha ~0.003: 110 × 0.003 = 0.33 total ADD contribution
  return renderShaderToCanvas(128, 128, `
void main() {
  vec2 uv = vUV;
  float cx = abs(uv.x - 0.5) * 2.0;
  float center = exp(-cx * cx * 8.0);
  float core = exp(-cx * cx * 30.0);
  // DIM color for ADD: even if alpha is used as multiplier, keep brightness low
  vec3 c = mix(vec3(0.08, 0.18, 0.3), vec3(0.2, 0.4, 0.55), core);
  float wave = 0.7 + 0.3 * sin(uv.y * 6.2832 * 3.0);
  float a = (center * 0.02 + core * 0.03) * wave;
  float edgeFade = smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x);
  a *= edgeFade;
  fragColor = vec4(c, a);
}
`);
}

function createProceduralSparkleAtlasCanvas (): HTMLCanvasElement {
  // Used by fireworks-finale (burst 90-150, ADD blend, velocity, 1.1-1.8s)
  // LOW alpha for ADD stacking
  return renderShaderToCanvas(128, 128, `
void main() {
  vec2 uv = vUV;
  vec2 cellUV = fract(uv * 2.0);
  int col = int(floor(uv.x * 2.0));
  int row = int(floor(uv.y * 2.0));
  int idx = row * 2 + col;
  vec2 center = vec2(0.5);
  float d = length(cellUV - center);
  float angle = atan(cellUV.y - 0.5, cellUV.x - 0.5);

  vec3 tints[4] = vec3[4](
    vec3(1.0, 0.86, 0.59),
    vec3(0.71, 0.90, 1.0),
    vec3(1.0, 0.67, 0.78),
    vec3(0.78, 1.0, 0.74)
  );
  vec3 tint = tints[idx];

  // base glow
  float glow = exp(-d * d * 25.0);
  vec3 c = mix(tint, vec3(1.0), pow(glow, 2.0));
  float a = glow * 0.12; // LOW for ADD

  if (idx == 0) {
    // 4-point star spikes
    float star = pow(max(abs(cos(angle * 2.0)), 0.0), 12.0);
    float spike = star * exp(-d * 8.0);
    a += spike * 0.2;
    c = mix(c, vec3(1.0), spike * 0.5);
  } else if (idx == 1) {
    // circle dot
    float circ = exp(-d * d * 80.0);
    a += circ * 0.2;
    c = mix(c, vec3(1.0), circ * 0.6);
  } else if (idx == 2) {
    // cross
    float armH = exp(-pow((cellUV.y - 0.5) * 16.0, 2.0)) * smoothstep(0.35, 0.0, d);
    float armV = exp(-pow((cellUV.x - 0.5) * 16.0, 2.0)) * smoothstep(0.35, 0.0, d);
    float cross = max(armH, armV);
    a += cross * 0.18;
    c = mix(c, vec3(1.0), cross * 0.6);
  } else {
    // diamond
    float diamond = abs(cellUV.x - 0.5) / 0.6 + abs(cellUV.y - 0.5);
    float dm = exp(-diamond * diamond * 15.0);
    a += dm * 0.18;
    c = mix(c, vec3(1.0), dm * 0.5);
  }
  fragColor = vec4(c, a);
}
`);
}

function createProceduralRuneAtlasCanvas (): HTMLCanvasElement {
  // Used by arcane-rune (26/s, 2.6-3.4s = ~80 alive, ADD blend)
  // LOW-MODERATE alpha for ADD
  return renderShaderToCanvas(192, 192, `
void main() {
  vec2 uv = vUV;
  vec2 cellUV = fract(uv * 3.0) - 0.5;
  int col = int(floor(uv.x * 3.0));
  int row = int(floor(uv.y * 3.0));
  int idx = row * 3 + col;
  float d = length(cellUV);
  float angle = atan(cellUV.y, cellUV.x);
  float r = 0.34;

  // soft glow background
  float glow = exp(-d * d * 18.0);
  vec4 color = vec4(vec3(0.55, 0.90, 1.0), glow * 0.12);

  // main circle (antialiased line)
  float circleDist = abs(d - r);
  float circle = exp(-circleDist * circleDist / (0.008 * 0.008));
  color = alphaBlend(color, vec4(0.75, 0.94, 1.0, circle * 0.3));

  // radial spokes
  int spokes = 3 + idx % 5;
  for (int k = 0; k < 8; k++) {
    if (k >= spokes) break;
    float tAngle = float(k) / float(spokes) * 6.2832 + float(idx) * 0.4;
    float aDiff = abs(mod(angle - tAngle + 3.14159, 6.2832) - 3.14159);
    float spoke = exp(-aDiff * aDiff * 2000.0) * smoothstep(r * 0.85, 0.02, d);
    color = alphaBlend(color, vec4(0.75, 0.94, 1.0, spoke * 0.25));
  }

  // inner polygon
  int sides = 3 + idx % 4;
  float polyAngle = angle - float(idx);
  float segAngle = 6.2832 / float(sides);
  float sector = mod(polyAngle + segAngle * 0.5, segAngle) - segAngle * 0.5;
  float polyR = r * 0.5;
  float polyEdgeR = polyR * cos(segAngle * 0.5) / cos(sector);
  float polyDist = abs(d - polyEdgeR);
  float polyLine = exp(-polyDist * polyDist / (0.008 * 0.008)) * step(d, polyR * 1.1);
  color = alphaBlend(color, vec4(0.75, 0.94, 1.0, polyLine * 0.22));

  // center dot
  float centerDot = exp(-d * d * 800.0);
  color = alphaBlend(color, vec4(1.0, 1.0, 1.0, centerDot * 0.2));

  fragColor = color;
}
`);
}

function createProceduralStarCanvas (): HTMLCanvasElement {
  // Used by spiral-galaxy (300/s, 3.5-5.5s = ~1350 alive, ADD blend)
  // Needs EXTREMELY LOW alpha since massive particle count + ADD
  return renderShaderToCanvas(64, 64, `
void main() {
  vec2 uv = vUV;
  float d = length(uv - vec2(0.5));
  float angle = atan(uv.y - 0.5, uv.x - 0.5);
  // tight star point
  float bloom = exp(-d * d * 50.0);
  vec3 c = mix(vec3(0.47, 0.63, 1.0), vec3(0.86, 0.94, 1.0), pow(bloom, 0.8));
  c = mix(c, vec3(1.0), pow(bloom, 3.0));
  // EXTREMELY LOW alpha for 1350 particles + ADD
  float a = bloom * 0.04;
  // 4 diffraction spikes (very subtle)
  for (int i = 0; i < 4; i++) {
    float sAngle = float(i) * 1.5708;
    float aDiff = abs(mod(angle - sAngle + 3.14159, 6.2832) - 3.14159);
    float spike = exp(-aDiff * aDiff * 600.0) * exp(-d * 5.0);
    a += spike * 0.02;
  }
  fragColor = vec4(c, a);
}
`);
}
