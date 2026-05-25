import { spec, VFXItem } from '@galacean/effects';
import type { Composition } from '@galacean/effects';
import {
  ProAccelerationForceModule,
  ProAddVelocityInConeModule,
  ProCameraOffsetModule,
  ProColorOverLifeModule,
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
  ProInitializeParticleModule,
  ProInitializeRotationModule,
  ProInitializeRibbonIDModule,
  ProParticleSystemComponent,
  ProParticleSystemRendererComponent,
  ProRibbonRenderer,
  ProRibbonRendererProperties,
  ProRotateAroundPointModule,
  ProRotationOverLifeModule,
  ProScaleColorModule,
  ProScaleSizeBySpeedModule,
  ProScaleSpriteSizeModule,
  ProShapeLocationModule,
  ProSizeOverLifeModule,
  ProSolveForcesAndVelocityModule,
  ProSpawnBurstModule,
  ProSpawnRateModule,
  ProSpriteRenderer,
  ProSpriteRendererProperties,
  ProSpriteRotationRateModule,
  ProSubUVAnimationModule,
  ProSubUVMode,
  ProUpdateAgeModule,
} from '@galacean/effects-plugin-particle-system-pro';
import { Selection } from './core/selection';

type DemoConfig = {
  name: string,
  position: [number, number, number],
  configureModules: (system: ProParticleSystemComponent) => void,
  configureRenderer: (component: ProParticleSystemRendererComponent, engine: Composition['engine']) => void,
  selectOnSpawn?: boolean,
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
    configureRenderer: configureDefaultSpriteRenderer,
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
    configureRenderer: configureSoftSpriteRenderer,
  });
}

export function spawnProShockRingDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-shock-ring-demo',
    position: [-6.6, -2.5, 0],
    configureModules: configureShockRingModules,
    configureRenderer: configureAdditiveSpriteRenderer,
  });
}

export function spawnProNoiseFieldDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-noise-field-demo',
    position: [-2.2, -2.5, 0],
    configureModules: configureNoiseFieldModules,
    configureRenderer: configureSoftSpriteRenderer,
  });
}

export function spawnProAccelerationColumnDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-acceleration-column-demo',
    position: [2.2, -2.5, 0],
    configureModules: configureAccelerationColumnModules,
    configureRenderer: configureDefaultSpriteRenderer,
  });
}

export function spawnProFlipbookBurstDemo (composition: Composition): VFXItem {
  return spawnConfiguredDemo(composition, {
    name: 'pro-flipbook-burst-demo',
    position: [5.8, -2.1, 0],
    configureModules: configureFlipbookBurstModules,
    configureRenderer: configureFlipbookSpriteRenderer,
  });
}

export function spawnProDemoGallery (composition: Composition): VFXItem[] {
  const items = [
    spawnConfiguredDemo(composition, {
      name: 'pro-particle-demo',
      position: [-6.6, 1.5, 0],
      configureModules: configureFountainModules,
      configureRenderer: configureDefaultSpriteRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-spark-demo',
      position: [-2.2, 1.5, 0],
      configureModules: configureSparkModules,
      configureRenderer: configureSparkRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-ribbon-demo',
      position: [2.4, 1.35, 0],
      configureModules: configureRibbonModules,
      configureRenderer: configureRibbonRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-orbit-smoke-demo',
      position: [6.1, 1.45, 0],
      configureModules: configureOrbitSmokeModules,
      configureRenderer: configureSoftSpriteRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-shock-ring-demo',
      position: [-6.6, -2.5, 0],
      configureModules: configureShockRingModules,
      configureRenderer: configureAdditiveSpriteRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-noise-field-demo',
      position: [-2.2, -2.5, 0],
      configureModules: configureNoiseFieldModules,
      configureRenderer: configureSoftSpriteRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-acceleration-column-demo',
      position: [2.2, -2.5, 0],
      configureModules: configureAccelerationColumnModules,
      configureRenderer: configureDefaultSpriteRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-flipbook-burst-demo',
      position: [5.8, -2.1, 0],
      configureModules: configureFlipbookBurstModules,
      configureRenderer: configureFlipbookSpriteRenderer,
    }),
  ];

  Selection.select(items[0]);

  return items;
}

function spawnConfiguredDemo (composition: Composition, config: DemoConfig): VFXItem {
  const engine = composition.engine;
  const item = new VFXItem(engine);

  item.name = config.name;
  item.transform.setPosition(config.position[0], config.position[1], config.position[2]);

  const systemComponent = item.addComponent(ProParticleSystemComponent);
  const rendererComponent = item.addComponent(ProParticleSystemRendererComponent);

  config.configureModules(systemComponent);
  config.configureRenderer(rendererComponent, engine);

  item.setParent(composition.pluginRoot);

  if (config.selectOnSpawn) {
    Selection.select(item);
  }

  return item;
}

function configureFountainModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(42);

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 42;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.0, 1.6);
  initParticle.startColor = ProDistributionColor.fromConstant(1.0, 0.8, 0.3, 1.0);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.15);
  initParticle.positionOrigin = [0, 0, 0];

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 5;
  velocity.speed = ProDistributionFloat.fromRange(1.0, 1.9);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, -2.1, 0];

  const forces = new ProSolveForcesAndVelocityModule();

  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 1, 1], [1, 0, 0, 0]);

  const scaleSize = new ProScaleSizeBySpeedModule();

  scaleSize.referenceSpeed = 1.5;
  scaleSize.intensity = 0.22;
  scaleSize.maxFactor = 1.8;

  const updateAge = new ProUpdateAgeModule();

  system.addModule(spawnRate);
  system.addModule(spawnBurst);
  system.addModule(initParticle);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(forces);
  system.addModule(colorOverLife);
  system.addModule(scaleSize);
  system.addModule(updateAge);
}

function configureSparkModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(14);

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 18;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(0.35, 0.6);
  initParticle.startColor = ProDistributionColor.fromRange([1.0, 0.65, 0.2, 1.0], [1.0, 0.95, 0.45, 1.0]);
  initParticle.startSize = ProDistributionVector2.fromRange([0.05, 0.05], [0.09, 0.09], true);
  initParticle.positionOrigin = [0, 0, 0];

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0.2, 1, 0];
  velocity.coneAngle = Math.PI / 10;
  velocity.speed = ProDistributionFloat.fromRange(2.8, 4.3);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, -3.4, 0];

  const forces = new ProSolveForcesAndVelocityModule();

  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 1, 1], [1, 0.35, 0.0, 0]);

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.4, 0));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(spawnRate);
  system.addModule(spawnBurst);
  system.addModule(initParticle);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(forces);
  system.addModule(colorOverLife);
  system.addModule(scaleSize);
  system.addModule(updateAge);
}

function configureRibbonModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(18);

  const initParticle = new ProInitializeParticleModule();

  // This demo keeps ribbon particle lifetime constant so Color Over Life stays visually continuous along the trail.
  initParticle.lifetime = ProDistributionFloat.fromConstant(0.9);
  initParticle.startColor = ProDistributionColor.fromConstant(0.2, 0.6, 1.0, 1.0);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.22);
  initParticle.positionOrigin = [0, 0, 0];

  const ribbonId = new ProInitializeRibbonIDModule();

  ribbonId.ribbonId = 0;

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 8;
  velocity.speed = ProDistributionFloat.fromRange(1.2, 1.6);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, -0.55, 0];

  const forces = new ProSolveForcesAndVelocityModule();

  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 1, 1], [0, 0.2, 1, 0]);

  const updateAge = new ProUpdateAgeModule();

  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(ribbonId);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(forces);
  system.addModule(colorOverLife);
  system.addModule(updateAge);
}

function configureOrbitSmokeModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(10);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.6, 2.1);
  initParticle.startColor = ProDistributionColor.fromRange([0.55, 0.65, 0.85, 0.45], [0.95, 1.0, 1.0, 0.7]);
  initParticle.startSize = ProDistributionVector2.fromRange([0.09, 0.09], [0.14, 0.14], true);
  initParticle.positionOrigin = [0, 0, 0];

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 6;
  velocity.speed = ProDistributionFloat.fromRange(0.08, 0.3);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, 0.15, 0];

  const forces = new ProSolveForcesAndVelocityModule();

  const rotateAroundPoint = new ProRotateAroundPointModule();

  rotateAroundPoint.rate = ProDistributionFloat.fromRange(60, 120);
  rotateAroundPoint.radius = ProDistributionFloat.fromRange(0.02, 0.18);
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

  scaleSize.scale = ProDistributionFloat.fromCurve(ProCurveFloat.linear(0.8, 1.5));

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

  emitterProps.duration = 0.6;
  emitterProps.loopBehavior = 'multiple';
  emitterProps.loopCount = 999;
  emitterProps.loopDelay = 1.1;
  emitterProps.maxParticleCount = 192;
  emitterProps.warmupTime = 0.1;

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 20;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromConstant(1.15);
  initParticle.startColor = ProDistributionColor.fromConstant(0.3, 0.95, 1.0, 1.0);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.09);
  initParticle.positionOrigin = [0, 0, 0];

  const initRotation = new ProInitializeRotationModule();

  initRotation.rotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'ring';
  shapeLocation.ringRadius = 0.18;
  shapeLocation.ringThickness = 0.08;

  const cameraOffset = new ProCameraOffsetModule();

  cameraOffset.offset = ProDistributionFloat.fromConstant(-0.35);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 2.2;
  velocity.speed = ProDistributionFloat.fromRange(0.55, 1.0);

  const forces = new ProSolveForcesAndVelocityModule();

  const rotationOverLife = new ProRotationOverLifeModule();

  rotationOverLife.angularVelocity = 1.1;

  const sizeOverLife = new ProSizeOverLifeModule();

  sizeOverLife.sizeCurveX = ProCurveFloat.linear(0.55, 1.4);
  sizeOverLife.sizeCurveY = ProCurveFloat.linear(0.55, 1.15);

  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 1, 1], [1, 0.45, 0.0, 0]);

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnBurst);
  system.addModule(initParticle);
  system.addModule(initRotation);
  system.addModule(shapeLocation);
  system.addModule(cameraOffset);
  system.addModule(velocity);
  system.addModule(forces);
  system.addModule(rotationOverLife);
  system.addModule(sizeOverLife);
  system.addModule(colorOverLife);
  system.addModule(updateAge);
}

function configureNoiseFieldModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.loopBehavior = 'infinite';
  emitterProps.maxParticleCount = 240;
  emitterProps.warmupTime = 0.45;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(8);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.5, 2.2);
  initParticle.startColor = ProDistributionColor.fromRange([0.45, 0.75, 1.0, 0.35], [0.85, 1.0, 1.0, 0.6]);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.14);
  initParticle.positionOrigin = [0, 0, 0];

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'sphere';
  shapeLocation.sphereMin = 0.05;
  shapeLocation.sphereMax = 0.22;

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 4;
  velocity.speed = ProDistributionFloat.fromRange(0.05, 0.16);

  const curlNoise = new ProCurlNoiseForceModule();

  curlNoise.amplitude = 1.0;
  curlNoise.frequency = 1.25;

  const drag = new ProDragModule();

  drag.dragCurve = ProCurveFloat.linear(0.45, 1.4);

  const forces = new ProSolveForcesAndVelocityModule();

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = new ProDistributionColor(
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.72)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.9)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.95)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0)),
  );

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionFloat.fromCurve(ProCurveFloat.linear(0.85, 1.4));

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
  emitterProps.maxParticleCount = 192;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(9);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.1, 1.6);
  initParticle.startColor = ProDistributionColor.fromRange([0.25, 0.9, 0.7, 0.7], [0.55, 1.0, 0.85, 0.95]);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.1);
  initParticle.positionOrigin = [0, 0, 0];

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'plane';
  shapeLocation.planeSize = [0.22, 0.22];

  const cameraOffset = new ProCameraOffsetModule();

  cameraOffset.offset = ProDistributionFloat.fromRange(-0.25, -0.08);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 16;
  velocity.speed = ProDistributionFloat.fromRange(0.3, 0.55);

  const acceleration = new ProAccelerationForceModule();

  acceleration.acceleration = ProDistributionVector3.fromRange([0.18, 1.1, -0.08], [0.45, 1.6, 0.08]);

  const drag = new ProDragModule();

  drag.dragCurve = ProCurveFloat.linear(0.35, 0.9);

  const forces = new ProSolveForcesAndVelocityModule();

  const sizeOverLife = new ProSizeOverLifeModule();

  sizeOverLife.sizeCurveX = ProCurveFloat.linear(0.9, 0.25);
  sizeOverLife.sizeCurveY = ProCurveFloat.linear(1.2, 1.9);

  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 1, 1], [0.25, 0.85, 1.0, 0]);

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
  system.addModule(sizeOverLife);
  system.addModule(colorOverLife);
  system.addModule(updateAge);
}

function configureFlipbookBurstModules (system: ProParticleSystemComponent): void {
  const emitterProps = new ProEmitterPropertiesModule();

  emitterProps.duration = 0.35;
  emitterProps.loopBehavior = 'multiple';
  emitterProps.loopCount = 999;
  emitterProps.loopDelay = 1.15;
  emitterProps.maxParticleCount = 96;
  emitterProps.warmupTime = 0.05;

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 12;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.0, 1.25);
  initParticle.startColor = ProDistributionColor.fromConstant(1.0, 0.95, 0.85, 1.0);
  initParticle.startSize = ProDistributionVector2.fromRange([0.42, 0.42], [0.52, 0.52], true);
  initParticle.positionOrigin = [0, 0, 0];

  const initRotation = new ProInitializeRotationModule();

  initRotation.rotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'sphere';
  shapeLocation.sphereMin = 0;
  shapeLocation.sphereMax = 0.06;

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 3.4;
  velocity.speed = ProDistributionFloat.fromRange(0.15, 0.4);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, -0.08, 0];

  const forces = new ProSolveForcesAndVelocityModule();

  const subUV = new ProSubUVAnimationModule();

  subUV.mode = ProSubUVMode.SyncToAge;
  subUV.totalFrames = 16;

  const sizeOverLife = new ProSizeOverLifeModule();

  sizeOverLife.sizeCurveX = ProCurveFloat.linear(0.85, 1.75);
  sizeOverLife.sizeCurveY = ProCurveFloat.linear(0.85, 1.75);

  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 1, 1], [1, 0.55, 0.15, 0]);

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnBurst);
  system.addModule(initParticle);
  system.addModule(initRotation);
  system.addModule(shapeLocation);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(forces);
  system.addModule(subUV);
  system.addModule(sizeOverLife);
  system.addModule(colorOverLife);
  system.addModule(updateAge);
}

function configureDefaultSpriteRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();
  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
}

function configureSparkRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ADD;
  props.facingMode = 'velocity';

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
}

function configureAdditiveSpriteRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ADD;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
}

function configureSoftSpriteRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
}

function configureFlipbookSpriteRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  props.subUVRows = 4;
  props.subUVCols = 4;
  props.subUVTotal = 16;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  void applyGeneratedFlipbookTexture(renderer);
}

function configureRibbonRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProRibbonRendererProperties();
  const renderer = new ProRibbonRenderer(engine, props);

  component.addRenderer(renderer);
}

async function applyGeneratedFlipbookTexture (renderer: ProSpriteRenderer): Promise<void> {
  const { Texture } = await import('@galacean/effects');

  try {
    const texture = await Texture.fromImage(createProceduralFlipbookCanvas().toDataURL(), renderer.material.engine);

    renderer.setTexture(texture);
  } catch (err) {
    console.warn('[ProSpriteRenderer] failed to build procedural flipbook texture:', err);
  }
}

function createProceduralFlipbookCanvas (): HTMLCanvasElement {
  const rows = 4;
  const cols = 4;
  const cellSize = 64;
  const canvas = document.createElement('canvas');

  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  for (let frame = 0; frame < rows * cols; frame++) {
    const col = frame % cols;
    const row = Math.floor(frame / cols);
    const x = col * cellSize;
    const y = row * cellSize;
    const progress = frame / (rows * cols - 1);
    const cx = x + cellSize * 0.5;
    const cy = y + cellSize * 0.5;
    const radius = cellSize * (0.14 + progress * 0.3);

    ctx.clearRect(x, y, cellSize, cellSize);

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);

    glow.addColorStop(0, `rgba(255, 255, 255, ${1 - progress * 0.15})`);
    glow.addColorStop(0.2, `rgba(255, ${235 - Math.floor(progress * 45)}, ${140 - Math.floor(progress * 50)}, ${1 - progress * 0.08})`);
    glow.addColorStop(0.55, `rgba(255, ${150 - Math.floor(progress * 55)}, 10, ${0.8 - progress * 0.2})`);
    glow.addColorStop(0.9, `rgba(80, 20, 0, ${0.24 - progress * 0.08})`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, ${245 - Math.floor(progress * 35)}, ${180 - Math.floor(progress * 80)}, ${0.95 - progress * 0.15})`;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 - progress * 0.12})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.7, cy + radius * 0.15);
    ctx.lineTo(cx + radius * 0.55, cy - radius * 0.2);
    ctx.stroke();
  }

  return canvas;
}
