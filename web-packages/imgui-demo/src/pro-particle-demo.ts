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

export function spawnProDemoGallery (composition: Composition): VFXItem[] {
  const items = [
    spawnConfiguredDemo(composition, {
      name: 'pro-particle-demo',
      position: [-6.6, 1.5, 0],
      configureModules: configureFountainModules,
      configureRenderer: configureFountainRenderer,
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
      configureRenderer: configureOrbitSmokeRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-shock-ring-demo',
      position: [-6.6, -2.5, 0],
      configureModules: configureShockRingModules,
      configureRenderer: configureShockRingRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-noise-field-demo',
      position: [-2.2, -2.5, 0],
      configureModules: configureNoiseFieldModules,
      configureRenderer: configureNoiseFieldRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-acceleration-column-demo',
      position: [2.2, -2.5, 0],
      configureModules: configureAccelerationColumnModules,
      configureRenderer: configureAccelerationColumnRenderer,
    }),
    spawnConfiguredDemo(composition, {
      name: 'pro-flipbook-burst-demo',
      position: [5.8, -2.1, 0],
      configureModules: configureFlipbookBurstModules,
      configureRenderer: configureFlipbookBurstRenderer,
    }),
  ];

  Selection.select(items[0]);

  return items;
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

  spawnRate.rate = ProDistributionFloat.fromConstant(72);

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 72;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.0, 1.6);
  initParticle.startColor = ProDistributionColor.fromConstant(1.0, 0.84, 0.42, 1.0);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.18);
  initParticle.positionOrigin = [0, 0, 0];

  const initRotation = new ProInitializeRotationModule();

  initRotation.rotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 5;
  velocity.speed = ProDistributionFloat.fromRange(1.05, 2.1);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, -2.1, 0];

  const forces = new ProSolveForcesAndVelocityModule();

  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 1, 1], [1, 0, 0, 0]);

  const scaleSize = new ProScaleSizeBySpeedModule();

  scaleSize.referenceSpeed = 1.4;
  scaleSize.intensity = 0.3;
  scaleSize.maxFactor = 2.2;

  const rotationRate = new ProSpriteRotationRateModule();

  rotationRate.rate = ProDistributionFloat.fromRange(-0.65, 0.65);

  const updateAge = new ProUpdateAgeModule();

  system.addModule(spawnRate);
  system.addModule(spawnBurst);
  system.addModule(initParticle);
  system.addModule(initRotation);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(forces);
  system.addModule(colorOverLife);
  system.addModule(scaleSize);
  system.addModule(rotationRate);
  system.addModule(updateAge);
}

function configureSparkModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(32);

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 40;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(0.55, 0.9);
  initParticle.startColor = ProDistributionColor.fromRange([1.0, 0.65, 0.2, 1.0], [1.0, 0.95, 0.45, 1.0]);
  initParticle.startSize = ProDistributionVector2.fromRange([0.09, 0.09], [0.15, 0.15], true);
  initParticle.positionOrigin = [0, 0, 0];

  const initRotation = new ProInitializeRotationModule();

  initRotation.rotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0.2, 1, 0];
  velocity.coneAngle = Math.PI / 10;
  velocity.speed = ProDistributionFloat.fromRange(1.8, 3.0);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, -1.8, 0];

  const forces = new ProSolveForcesAndVelocityModule();

  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 1, 1], [1, 0.35, 0.0, 0]);

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.7, 0.15));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(spawnRate);
  system.addModule(spawnBurst);
  system.addModule(initParticle);
  system.addModule(initRotation);
  system.addModule(velocity);
  system.addModule(gravity);
  system.addModule(forces);
  system.addModule(colorOverLife);
  system.addModule(scaleSize);
  system.addModule(updateAge);
}

function configureRibbonModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(32);

  const initParticle = new ProInitializeParticleModule();

  // This demo keeps ribbon particle lifetime constant so Color Over Life stays visually continuous along the trail.
  initParticle.lifetime = ProDistributionFloat.fromConstant(1.05);
  initParticle.startColor = ProDistributionColor.fromConstant(0.35, 0.92, 1.0, 1.0);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.42);
  initParticle.positionOrigin = [0, 0, 0];

  const ribbonId = new ProInitializeRibbonIDModule();

  ribbonId.ribbonId = 0;

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 8;
  velocity.speed = ProDistributionFloat.fromRange(0.9, 1.25);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, -0.15, 0];

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

  spawnRate.rate = ProDistributionFloat.fromConstant(22);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.2, 1.8);
  initParticle.startColor = ProDistributionColor.fromRange([0.82, 0.86, 0.96, 0.82], [1.0, 1.0, 1.0, 0.96]);
  initParticle.startSize = ProDistributionVector2.fromRange([0.12, 0.12], [0.22, 0.22], true);
  initParticle.positionOrigin = [0, 0, 0];

  const initRotation = new ProInitializeRotationModule();

  initRotation.rotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 3;
  velocity.speed = ProDistributionFloat.fromRange(0.001, 0.005);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, 0.001, 0];

  const forces = new ProSolveForcesAndVelocityModule();

  const rotateAroundPoint = new ProRotateAroundPointModule();

  rotateAroundPoint.rate = ProDistributionFloat.fromRange(60, 120);
  rotateAroundPoint.radius = ProDistributionFloat.fromRange(0.02, 0.08);
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

  scaleSize.scale = ProDistributionFloat.fromCurve(ProCurveFloat.linear(0.6, 1.0));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(initRotation);
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
  emitterProps.loopDelay = 1.8;
  emitterProps.maxParticleCount = 320;
  emitterProps.warmupTime = 0.1;

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 96;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromConstant(1.15);
  initParticle.startColor = ProDistributionColor.fromConstant(0.25, 0.6, 0.7, 0.75);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.24);
  initParticle.positionOrigin = [0, 0, 0];

  const initRotation = new ProInitializeRotationModule();

  initRotation.rotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'ring';
  shapeLocation.ringRadius = 0.2;
  shapeLocation.ringThickness = 0.02;

  const cameraOffset = new ProCameraOffsetModule();

  cameraOffset.offset = ProDistributionFloat.fromConstant(-0.18);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 2.2;
  velocity.speed = ProDistributionFloat.fromRange(0.18, 0.38);

  const forces = new ProSolveForcesAndVelocityModule();

  const rotationOverLife = new ProRotationOverLifeModule();

  rotationOverLife.angularVelocity = 0.45;

  const sizeOverLife = new ProSizeOverLifeModule();

  sizeOverLife.sizeCurveX = ProCurveFloat.linear(1.4, 3.8);
  sizeOverLife.sizeCurveY = ProCurveFloat.linear(1.1, 2.8);

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
  emitterProps.maxParticleCount = 360;
  emitterProps.warmupTime = 0.75;

  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(24);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(2.4, 3.1);
  initParticle.startColor = ProDistributionColor.fromRange([0.72, 0.9, 1.0, 0.78], [1.0, 1.0, 1.0, 1.0]);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.28);
  initParticle.positionOrigin = [0, 0, 0];

  const initRotation = new ProInitializeRotationModule();

  initRotation.rotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'sphere';
  shapeLocation.sphereMin = 0.02;
  shapeLocation.sphereMax = 0.11;

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 4;
  velocity.speed = ProDistributionFloat.fromRange(0.015, 0.05);

  const curlNoise = new ProCurlNoiseForceModule();

  curlNoise.amplitude = 1.8;
  curlNoise.frequency = 0.95;

  const drag = new ProDragModule();

  drag.dragCurve = ProCurveFloat.linear(0.28, 1.0);

  const forces = new ProSolveForcesAndVelocityModule();

  const scaleColor = new ProScaleColorModule();

  scaleColor.scale = new ProDistributionColor(
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.72)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.9)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0.95)),
    ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.0, 0)),
  );

  const scaleSize = new ProScaleSpriteSizeModule();

  scaleSize.scale = ProDistributionFloat.fromCurve(ProCurveFloat.linear(1.3, 2.7));

  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(initRotation);
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

  initParticle.lifetime = ProDistributionFloat.fromRange(1.6, 2.4);
  initParticle.startColor = ProDistributionColor.fromRange([0.4, 0.96, 0.86, 0.94], [0.82, 1.0, 0.94, 1.0]);
  initParticle.startSize = ProDistributionVector2.fromUniformConstant(0.22);
  initParticle.positionOrigin = [0, 0, 0];

  const shapeLocation = new ProShapeLocationModule();

  shapeLocation.shape = 'plane';
  shapeLocation.planeSize = [0.08, 0.08];

  const cameraOffset = new ProCameraOffsetModule();

  cameraOffset.offset = ProDistributionFloat.fromRange(-0.16, -0.02);

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 16;
  velocity.speed = ProDistributionFloat.fromRange(0.68, 1.05);

  const acceleration = new ProAccelerationForceModule();

  acceleration.acceleration = ProDistributionVector3.fromRange([0.04, 1.4, -0.03], [0.18, 2.3, 0.03]);

  const drag = new ProDragModule();

  drag.dragCurve = ProCurveFloat.linear(0.22, 0.75);

  const forces = new ProSolveForcesAndVelocityModule();

  const sizeOverLife = new ProSizeOverLifeModule();

  sizeOverLife.sizeCurveX = ProCurveFloat.linear(1.1, 0.55);
  sizeOverLife.sizeCurveY = ProCurveFloat.linear(1.8, 3.2);

  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 1, 1], [0.15, 0.85, 1.0, 0]);

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

  emitterProps.loopBehavior = 'infinite';
  emitterProps.maxParticleCount = 8;
  emitterProps.warmupTime = 0;

  // Slow spawn — one burst every ~2 seconds
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = ProDistributionFloat.fromConstant(0.6);

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.8, 2.5);
  initParticle.startColor = ProDistributionColor.fromConstant(1.0, 0.85, 0.55, 0.95);
  initParticle.startSize = ProDistributionVector2.fromRange([1.2, 1.2], [1.8, 1.8], true);
  initParticle.positionOrigin = [0, 0, 0];

  const initRotation = new ProInitializeRotationModule();

  initRotation.rotation = ProDistributionFloat.fromRange(0, Math.PI * 2);

  const subUV = new ProSubUVAnimationModule();

  subUV.mode = ProSubUVMode.SyncToAge;
  subUV.totalFrames = 16;

  // Expand rapidly then settle
  const sizeOverLife = new ProSizeOverLifeModule();

  sizeOverLife.sizeCurveX = ProCurveFloat.linear(0.8, 1.8);
  sizeOverLife.sizeCurveY = ProCurveFloat.linear(0.8, 1.8);

  // Bright flash → warm fade → transparent
  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 0.85, 1], [1, 0.4, 0.1, 0.15]);

  const forces = new ProSolveForcesAndVelocityModule();
  const updateAge = new ProUpdateAgeModule();

  system.addModule(emitterProps);
  system.addModule(spawnRate);
  system.addModule(initParticle);
  system.addModule(initRotation);
  system.addModule(subUV);
  system.addModule(sizeOverLife);
  system.addModule(colorOverLife);
  system.addModule(forces);
  system.addModule(updateAge);
}

function configureFountainRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  void applyGeneratedTexture(renderer, 'fountain-flame', createProceduralFountainFlameCanvas, 'fountain flame');
}

function configureSparkRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  props.facingMode = 'velocity';

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  void applyGeneratedTexture(renderer, 'spark-shards', createProceduralSparkShardCanvas, 'spark shards');
}

function configureOrbitSmokeRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  void applyGeneratedTexture(renderer, 'orbit-smoke-body', createProceduralSmokeBodyCanvas, 'orbit smoke body');
}

function configureShockRingRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  void applyGeneratedTexture(renderer, 'shockwave-band', createProceduralShockBandCanvas, 'shockwave band');
}

function configureNoiseFieldRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  void applyGeneratedTexture(renderer, 'noise-plasma-core', createProceduralPlasmaCoreCanvas, 'plasma core');
}

function configureAccelerationColumnRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  props.facingMode = 'velocity';

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  void applyGeneratedTexture(renderer, 'acceleration-streak', createProceduralEnergyStreakCanvas, 'energy streak');
}

function configureFlipbookBurstRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  props.subUVRows = 4;
  props.subUVCols = 4;
  props.subUVTotal = 16;

  const renderer = new ProSpriteRenderer(engine, props);

  component.addRenderer(renderer);
  void applyGeneratedTexture(renderer, 'flipbook-fireball', createProceduralFireballFlipbookCanvas, 'fireball flipbook');
}

function configureRibbonRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProRibbonRendererProperties();

  props.blending = spec.BlendingMode.ALPHA;
  const renderer = new ProRibbonRenderer(engine, props);

  component.addRenderer(renderer);
  void applyGeneratedTexture(renderer, 'energy-ribbon', createProceduralEnergyTrailCanvas, 'energy trail');
}

type ProceduralTextureTarget = ProSpriteRenderer | ProRibbonRenderer;

const proceduralTextureDataUrls = new Map<string, string>();

async function applyGeneratedTexture (
  renderer: ProceduralTextureTarget,
  cacheKey: string,
  canvasFactory: () => HTMLCanvasElement,
  label: string,
): Promise<void> {
  const { Texture } = await import('@galacean/effects');

  try {
    const texture = await Texture.fromImage(getProceduralTextureUrl(cacheKey, canvasFactory), renderer.material.engine);

    renderer.setTexture(texture);
  } catch (err) {
    console.warn('[pro-particle-demo] failed to build procedural texture:', label, err);
  }
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

function fract (value: number): number {
  return value - Math.floor(value);
}

function random01 (seed: number): number {
  return fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453123);
}

function lerp (a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgba (r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

function createProceduralWarmBodyCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 192;
  canvas.height = 192;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const base = ctx.createRadialGradient(96, 108, 0, 96, 108, 82);

  base.addColorStop(0, rgba(255, 228, 182, 0.44));
  base.addColorStop(0.48, rgba(255, 172, 96, 0.18));
  base.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(96, 108, 82, 0, Math.PI * 2);
  ctx.fill();

  const inner = ctx.createRadialGradient(96, 112, 0, 96, 112, 40);

  inner.addColorStop(0, rgba(255, 236, 198, 0.22));
  inner.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(96, 112, 40, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function createProceduralSmokeBodyCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 192;
  canvas.height = 192;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const puffs: Array<[number, number, number, [number, number, number, number]]> = [
    [72, 84, 44, [220, 226, 236, 0.34]],
    [116, 78, 40, [176, 188, 208, 0.26]],
    [92, 118, 52, [144, 154, 174, 0.22]],
    [132, 114, 34, [206, 214, 228, 0.18]],
  ];

  for (const [x, y, radius, color] of puffs) {
    const puff = ctx.createRadialGradient(x, y, 0, x, y, radius);

    puff.addColorStop(0, rgba(color[0], color[1], color[2], color[3]));
    puff.addColorStop(0.5, rgba(color[0], color[1], color[2], color[3] * 0.45));
    puff.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = puff;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function createProceduralSmokeHighlightCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 128;
  canvas.height = 128;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const glow = ctx.createRadialGradient(68, 62, 0, 68, 62, 42);

  glow.addColorStop(0, rgba(255, 255, 255, 0.22));
  glow.addColorStop(0.36, rgba(190, 232, 255, 0.12));
  glow.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(68, 62, 42, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function createProceduralShockBandCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const band = ctx.createRadialGradient(128, 128, 54, 128, 128, 102);

  band.addColorStop(0, rgba(0, 0, 0, 0));
  band.addColorStop(0.28, rgba(0, 0, 0, 0));
  band.addColorStop(0.48, rgba(214, 248, 255, 0.9));
  band.addColorStop(0.62, rgba(116, 220, 255, 0.48));
  band.addColorStop(0.78, rgba(0, 0, 0, 0));
  band.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = band;
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function createProceduralShockwaveHazeCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const haze = ctx.createRadialGradient(128, 128, 38, 128, 128, 126);

  haze.addColorStop(0, rgba(0, 0, 0, 0));
  haze.addColorStop(0.34, rgba(0, 0, 0, 0));
  haze.addColorStop(0.62, rgba(160, 210, 255, 0.12));
  haze.addColorStop(0.86, rgba(120, 150, 255, 0.06));
  haze.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function createProceduralPlasmaBodyCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 224;
  canvas.height = 224;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const cloud = ctx.createRadialGradient(112, 112, 0, 112, 112, 96);

  cloud.addColorStop(0, rgba(184, 244, 255, 0.38));
  cloud.addColorStop(0.42, rgba(118, 198, 255, 0.18));
  cloud.addColorStop(0.72, rgba(110, 124, 255, 0.08));
  cloud.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = cloud;
  ctx.beginPath();
  ctx.arc(112, 112, 96, 0, Math.PI * 2);
  ctx.fill();

  const blobs: Array<[number, number, number]> = [
    [86, 96, 34],
    [132, 90, 30],
    [104, 134, 42],
    [142, 126, 26],
  ];

  for (const [x, y, radius] of blobs) {
    const puff = ctx.createRadialGradient(x, y, 0, x, y, radius);

    puff.addColorStop(0, rgba(188, 240, 255, 0.16));
    puff.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = puff;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function createProceduralPlasmaCoreCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 160;
  canvas.height = 160;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const core = ctx.createRadialGradient(80, 80, 0, 80, 80, 56);

  core.addColorStop(0, rgba(255, 255, 255, 0.92));
  core.addColorStop(0.24, rgba(180, 248, 255, 0.68));
  core.addColorStop(0.58, rgba(92, 210, 255, 0.28));
  core.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(80, 80, 56, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function createProceduralEnergyStreakCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 128;
  canvas.height = 320;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const core = ctx.createLinearGradient(64, 0, 64, 320);

  core.addColorStop(0, rgba(0, 0, 0, 0));
  core.addColorStop(0.16, rgba(152, 255, 232, 0.4));
  core.addColorStop(0.5, rgba(255, 255, 255, 0.94));
  core.addColorStop(0.84, rgba(112, 226, 255, 0.42));
  core.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(64, 160, 20, 138, 0, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function createProceduralColumnAuraCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 160;
  canvas.height = 320;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const aura = ctx.createLinearGradient(80, 0, 80, 320);

  aura.addColorStop(0, rgba(0, 0, 0, 0));
  aura.addColorStop(0.2, rgba(90, 255, 214, 0.12));
  aura.addColorStop(0.5, rgba(96, 188, 255, 0.22));
  aura.addColorStop(0.8, rgba(90, 255, 214, 0.12));
  aura.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(80, 160, 54, 150, 0, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function createProceduralFountainFlameCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 256;
  canvas.height = 320;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.62;
  const body = ctx.createLinearGradient(cx, cy + 82, cx, cy - 112);

  body.addColorStop(0, rgba(255, 156, 62, 0));
  body.addColorStop(0.28, rgba(255, 176, 74, 0.42));
  body.addColorStop(0.62, rgba(255, 224, 156, 0.86));
  body.addColorStop(1, rgba(255, 255, 255, 0));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 112);
  ctx.bezierCurveTo(cx - 54, cy - 34, cx - 42, cy + 46, cx, cy + 82);
  ctx.bezierCurveTo(cx + 42, cy + 46, cx + 54, cy - 34, cx, cy - 112);
  ctx.fill();

  const core = ctx.createLinearGradient(cx, cy + 52, cx, cy - 88);

  core.addColorStop(0, rgba(255, 220, 110, 0));
  core.addColorStop(0.35, rgba(255, 238, 168, 0.82));
  core.addColorStop(0.72, rgba(255, 255, 255, 0.98));
  core.addColorStop(1, rgba(255, 255, 255, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 88);
  ctx.bezierCurveTo(cx - 24, cy - 22, cx - 20, cy + 22, cx, cy + 52);
  ctx.bezierCurveTo(cx + 20, cy + 22, cx + 24, cy - 22, cx, cy - 88);
  ctx.fill();

  const halo = ctx.createRadialGradient(cx, cy + 4, 0, cx, cy + 4, 82);

  halo.addColorStop(0, rgba(255, 234, 176, 0.28));
  halo.addColorStop(0.55, rgba(255, 178, 98, 0.1));
  halo.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy + 4, 82, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function createProceduralSparkShardCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 256;
  canvas.height = 96;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const tail = ctx.createLinearGradient(0, canvas.height * 0.5, canvas.width, canvas.height * 0.5);

  tail.addColorStop(0, rgba(255, 164, 62, 0));
  tail.addColorStop(0.12, rgba(255, 176, 78, 0.2));
  tail.addColorStop(0.42, rgba(255, 240, 214, 0.96));
  tail.addColorStop(0.72, rgba(255, 162, 68, 0.3));
  tail.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.48, canvas.height * 0.5, canvas.width * 0.34, canvas.height * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  const head = ctx.createRadialGradient(canvas.width * 0.28, canvas.height * 0.5, 0, canvas.width * 0.28, canvas.height * 0.5, 20);

  head.addColorStop(0, rgba(255, 255, 255, 1));
  head.addColorStop(0.48, rgba(255, 238, 184, 0.82));
  head.addColorStop(1, rgba(255, 192, 94, 0));
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(canvas.width * 0.28, canvas.height * 0.5, 20, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function createProceduralShockwaveCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.5;

  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = rgba(244, 252, 255, 0.72 - i * 0.14);
    ctx.lineWidth = 22 - i * 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 60 + i * 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  const halo = ctx.createRadialGradient(cx, cy, 44, cx, cy, 118);

  halo.addColorStop(0, rgba(0, 0, 0, 0));
  halo.addColorStop(0.45, rgba(118, 214, 255, 0));
  halo.addColorStop(0.68, rgba(102, 220, 255, 0.62));
  halo.addColorStop(0.88, rgba(96, 140, 255, 0.22));
  halo.addColorStop(1, rgba(0, 0, 0, 0));

  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, 118, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const inner = 58 + (i % 2) * 8;
    const outer = 96 + (i % 3) * 10;

    ctx.strokeStyle = rgba(220, 248, 255, 0.18);
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  for (let i = 0; i < 9; i++) {
    const angle = i * (Math.PI * 2 / 9) + 0.22;

    ctx.strokeStyle = rgba(176, 244, 255, 0.16);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 52 + i * 5, angle, angle + Math.PI * 0.34);
    ctx.stroke();
  }

  return canvas;
}

function createProceduralOrbitSmokeCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 192;
  canvas.height = 192;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const puffs: Array<[number, number, number, [number, number, number, number]]> = [
    [66, 70, 48, [218, 224, 238, 0.62]],
    [114, 64, 44, [176, 188, 212, 0.46]],
    [92, 116, 58, [146, 156, 182, 0.38]],
    [132, 112, 38, [204, 212, 230, 0.34]],
    [56, 116, 34, [136, 146, 172, 0.28]],
  ];

  for (const [x, y, radius, color] of puffs) {
    const puff = ctx.createRadialGradient(x, y, 0, x, y, radius);

    puff.addColorStop(0, rgba(color[0], color[1], color[2], color[3]));
    puff.addColorStop(0.45, rgba(color[0], color[1], color[2], color[3] * 0.5));
    puff.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = puff;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9; i++) {
    const x = lerp(42, 150, random01(i + 101));
    const y = lerp(34, 150, random01(i + 111));
    const radius = lerp(12, 24, random01(i + 121));
    const hole = ctx.createRadialGradient(x, y, 0, x, y, radius);

    hole.addColorStop(0, rgba(0, 0, 0, 0.08));
    hole.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  ctx.strokeStyle = rgba(210, 220, 242, 0.08);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(94, 98, 44, Math.PI * 0.15, Math.PI * 1.35);
  ctx.stroke();

  ctx.strokeStyle = rgba(150, 164, 196, 0.06);
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(96, 92, 58, Math.PI * 0.72, Math.PI * 1.84);
  ctx.stroke();

  return canvas;
}

function createProceduralPlasmaCloudCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 224;
  canvas.height = 224;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.5;
  const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, 98);

  cloud.addColorStop(0, rgba(255, 255, 255, 0.96));
  cloud.addColorStop(0.18, rgba(170, 248, 255, 1));
  cloud.addColorStop(0.42, rgba(88, 212, 255, 0.8));
  cloud.addColorStop(0.7, rgba(120, 92, 255, 0.42));
  cloud.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = cloud;
  ctx.beginPath();
  ctx.arc(cx, cy, 98, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 14; i++) {
    const angle = random01(i + 201) * Math.PI * 2;
    const distance = lerp(18, 70, random01(i + 221));
    const px = cx + Math.cos(angle) * distance;
    const py = cy + Math.sin(angle) * distance;
    const radius = lerp(24, 46, random01(i + 241));
    const cell = ctx.createRadialGradient(px, py, 0, px, py, radius);

    cell.addColorStop(0, rgba(204, 255, 255, 0.72));
    cell.addColorStop(0.5, rgba(118, 224, 255, 0.32));
    cell.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = cell;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 11; i++) {
    const startAngle = random01(i + 261) * Math.PI * 2;
    const radius = lerp(26, 86, random01(i + 281));
    const span = lerp(0.35, 0.8, random01(i + 301));

    ctx.strokeStyle = rgba(198, 252, 255, 0.2 - i * 0.01);
    ctx.lineWidth = 4.2 - i * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + span);
    ctx.stroke();
  }

  return canvas;
}

function createProceduralPlasmaFilamentCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 160;
  canvas.height = 320;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const core = ctx.createLinearGradient(0, 0, 0, canvas.height);

  core.addColorStop(0, rgba(0, 0, 0, 0));
  core.addColorStop(0.14, rgba(120, 255, 220, 0.58));
  core.addColorStop(0.45, rgba(255, 255, 255, 0.98));
  core.addColorStop(0.78, rgba(92, 220, 255, 0.6));
  core.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.5, canvas.height * 0.5, 32, 140, 0, 0, Math.PI * 2);
  ctx.fill();

  const aura = ctx.createLinearGradient(0, 0, 0, canvas.height);

  aura.addColorStop(0, rgba(0, 0, 0, 0));
  aura.addColorStop(0.2, rgba(84, 255, 210, 0.22));
  aura.addColorStop(0.5, rgba(96, 180, 255, 0.42));
  aura.addColorStop(0.82, rgba(84, 255, 210, 0.22));
  aura.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.5, canvas.height * 0.5, 70, 156, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 12; i++) {
    const y0 = lerp(18, 278, i / 11);
    const phase = random01(i + 321) * 18;

    ctx.strokeStyle = rgba(220, 255, 255, 0.16 - i * 0.007);
    ctx.lineWidth = 4.6 - (i % 4) * 0.5;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.34, y0);
    ctx.bezierCurveTo(canvas.width * 0.36 + phase, y0 + 24, canvas.width * 0.64 - phase, y0 + 42, canvas.width * 0.66, y0 + 74);
    ctx.stroke();
  }

  return canvas;
}

function createProceduralEnergyTrailCanvas (): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = 96;
  canvas.height = 512;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const crossFade = ctx.createLinearGradient(0, 0, canvas.width, 0);

  crossFade.addColorStop(0, rgba(0, 0, 0, 0));
  crossFade.addColorStop(0.18, rgba(92, 214, 255, 0.16));
  crossFade.addColorStop(0.5, rgba(255, 255, 255, 1));
  crossFade.addColorStop(0.82, rgba(92, 214, 255, 0.16));
  crossFade.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = crossFade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lengthFade = ctx.createLinearGradient(0, 0, 0, canvas.height);

  lengthFade.addColorStop(0, rgba(160, 248, 255, 0.3));
  lengthFade.addColorStop(0.25, rgba(255, 255, 255, 0.9));
  lengthFade.addColorStop(0.58, rgba(90, 190, 255, 0.58));
  lengthFade.addColorStop(1, rgba(0, 0, 0, 0.08));
  ctx.fillStyle = lengthFade;
  ctx.fillRect(canvas.width * 0.28, 0, canvas.width * 0.44, canvas.height);

  for (let i = 0; i < 18; i++) {
    const y = (i / 17) * canvas.height;
    const offset = Math.sin(i * 1.73) * 8;

    ctx.strokeStyle = rgba(255, 255, 255, 0.1 + (i % 3) * 0.03);
    ctx.lineWidth = 2.2 - (i % 3) * 0.4;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.24 + offset, y);
    ctx.quadraticCurveTo(canvas.width * 0.5, y + 8, canvas.width * 0.76 - offset, y + 20);
    ctx.stroke();
  }

  for (let i = 0; i < 14; i++) {
    const y = lerp(20, canvas.height - 20, i / 13);
    const width = lerp(10, 24, random01(i + 341));
    const pulse = ctx.createRadialGradient(canvas.width * 0.5, y, 0, canvas.width * 0.5, y, width);

    pulse.addColorStop(0, rgba(255, 255, 255, 0.28));
    pulse.addColorStop(0.45, rgba(110, 235, 255, 0.12));
    pulse.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = pulse;
    ctx.beginPath();
    ctx.arc(canvas.width * 0.5, y, width, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function createProceduralFireballHaloFlipbookCanvas (): HTMLCanvasElement {
  const rows = 4;
  const cols = 4;
  const cellSize = 96;
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
    const radius = lerp(cellSize * 0.28, cellSize * 0.58, progress);
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.28, cx, cy, radius);

    ctx.clearRect(x, y, cellSize, cellSize);

    halo.addColorStop(0, rgba(255, 236, 176, 0.12));
    halo.addColorStop(0.42, rgba(255, 214, 132, 0.16 - progress * 0.05));
    halo.addColorStop(0.72, rgba(255, 166, 82, 0.08 - progress * 0.02));
    halo.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    if (progress > 0.2) {
      ctx.strokeStyle = rgba(255, 224, 164, 0.1 - progress * 0.03);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.88, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return canvas;
}

function createProceduralFireballFlipbookCanvas (): HTMLCanvasElement {
  const rows = 4;
  const cols = 4;
  const cellSize = 96;
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
    const radius = cellSize * (0.16 + progress * 0.24);

    ctx.clearRect(x, y, cellSize, cellSize);

    const smoke = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 1.12);

    smoke.addColorStop(0, rgba(255, 214, 154, 0.14));
    smoke.addColorStop(0.45, rgba(82, 94, 118, 0.18 + progress * 0.16));
    smoke.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = smoke;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.12, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 9; i++) {
      const angle = ((i / 9) * Math.PI * 2) + progress * 1.4 + random01(frame * 17 + i * 9) * 0.35;
      const distance = radius * lerp(0.08, 0.34, random01(frame * 23 + i * 13));
      const px = cx + Math.cos(angle) * distance;
      const py = cy + Math.sin(angle) * distance;
      const lobeRadius = radius * lerp(0.36, 0.72, random01(frame * 31 + i * 7));
      const lobe = ctx.createRadialGradient(px, py, 0, px, py, lobeRadius);

      lobe.addColorStop(0, rgba(255, 255, 255, 0.92 - progress * 0.18));
      lobe.addColorStop(0.22, rgba(255, lerp(238, 210, progress), lerp(172, 120, progress), 0.88 - progress * 0.12));
      lobe.addColorStop(0.65, rgba(255, lerp(164, 112, progress), lerp(62, 18, progress), 0.38 - progress * 0.08));
      lobe.addColorStop(1, rgba(0, 0, 0, 0));
      ctx.fillStyle = lobe;
      ctx.beginPath();
      ctx.arc(px, py, lobeRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    const core = ctx.createRadialGradient(cx - radius * 0.1, cy - radius * 0.08, 0, cx - radius * 0.1, cy - radius * 0.08, radius * 0.42);

    core.addColorStop(0, rgba(255, 255, 255, 1));
    core.addColorStop(0.35, rgba(255, 246, 214, 0.96));
    core.addColorStop(1, rgba(255, 184, 66, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx - radius * 0.1, cy - radius * 0.08, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 6; i++) {
      const angle = progress * 1.8 + i * (Math.PI / 3);
      const length = radius * lerp(0.55, 1.05, random01(frame * 41 + i * 5));

      ctx.strokeStyle = rgba(255, 246, 220, 0.32 - progress * 0.1);
      ctx.lineWidth = 2.2 - progress * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * radius * 0.16, cy + Math.sin(angle) * radius * 0.16);
      ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
      ctx.stroke();
    }

    if (progress > 0.28) {
      ctx.strokeStyle = rgba(255, 222, 168, 0.22 - progress * 0.08);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * lerp(0.78, 1.18, progress), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return canvas;
}
