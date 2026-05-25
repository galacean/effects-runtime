import { math, VFXItem } from '@galacean/effects';
import type { Composition } from '@galacean/effects';
import {
  ProAddVelocityInConeModule,
  ProColorOverLifeModule,
  ProCurveColor,
  ProDistributionColor,
  ProDistributionFloat,
  ProGravityForceModule,
  ProInitializeParticleModule,
  ProInitializeRibbonIDModule,
  ProParticleSystemComponent,
  ProParticleSystemRendererComponent,
  ProRibbonRenderer,
  ProRibbonRendererProperties,
  ProScaleSizeBySpeedModule,
  ProSolveForcesAndVelocityModule,
  ProSpawnBurstModule,
  ProSpawnRateModule,
  ProSpriteRenderer,
  ProSpriteRendererProperties,
  ProUpdateAgeModule,
} from '@galacean/effects-plugin-particle-system-pro';
import { Selection } from './core/selection';

/**
 * 在已经加载好的 composition 上挂一个新的 VFXItem，运行 particle-system-pro
 * 的默认 Sprite Emitter（8 个 module + Sprite Renderer）。
 */
export function spawnProParticleDemo (composition: Composition): VFXItem {
  const engine = composition.engine;
  const item = new VFXItem(engine);

  item.name = 'pro-particle-demo';
  item.transform.setPosition(0, -1.5, 0);

  const systemComponent = item.addComponent(ProParticleSystemComponent);
  const rendererComponent = item.addComponent(ProParticleSystemRendererComponent);

  configureModules(systemComponent);
  configureRenderer(rendererComponent, engine);

  item.setParent(composition.pluginRoot);
  Selection.select(item);

  return item;
}

/**
 * Ribbon/Trail 粒子 demo：发射一条持续的拖尾。
 */
export function spawnProRibbonDemo (composition: Composition): VFXItem {
  const engine = composition.engine;
  const item = new VFXItem(engine);

  item.name = 'pro-ribbon-demo';
  item.transform.setPosition(2, -1.0, 0);

  const systemComponent = item.addComponent(ProParticleSystemComponent);
  const rendererComponent = item.addComponent(ProParticleSystemRendererComponent);

  configureRibbonModules(systemComponent);
  configureRibbonRenderer(rendererComponent, engine);

  item.setParent(composition.pluginRoot);

  return item;
}

function configureModules (system: ProParticleSystemComponent): void {
  const spawnRate = new ProSpawnRateModule();

  spawnRate.rate = 60;

  const spawnBurst = new ProSpawnBurstModule();

  spawnBurst.count = 80;
  spawnBurst.spawnTime = 0;

  const initParticle = new ProInitializeParticleModule();

  initParticle.lifetime = ProDistributionFloat.fromRange(1.5, 2.5);
  initParticle.startColor = ProDistributionColor.fromConstant(1.0, 0.8, 0.3, 1.0);
  initParticle.startSize = ProDistributionFloat.fromConstant(0.15);
  initParticle.positionOrigin = [0, 0, 0];

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 4;
  velocity.speed = ProDistributionFloat.fromRange(1.5, 3.0);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, -2.5, 0];

  const forces = new ProSolveForcesAndVelocityModule();

  const colorOverLife = new ProColorOverLifeModule();

  colorOverLife.colorCurve = ProCurveColor.linear([1, 1, 1, 1], [1, 0, 0, 0]);

  const scaleSize = new ProScaleSizeBySpeedModule();

  scaleSize.referenceSpeed = 2;
  scaleSize.intensity = 0.4;
  scaleSize.maxFactor = 2.5;

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

  spawnRate.rate = 30;

  const initParticle = new ProInitializeParticleModule();

  // This demo keeps ribbon particle lifetime constant so Color Over Life stays visually continuous along the trail.
  initParticle.lifetime = ProDistributionFloat.fromConstant(1.25);
  initParticle.startColor = ProDistributionColor.fromConstant(0.2, 0.6, 1.0, 1.0);
  initParticle.startSize = ProDistributionFloat.fromConstant(0.3);
  initParticle.positionOrigin = [0, 0, 0];

  const ribbonId = new ProInitializeRibbonIDModule();

  ribbonId.ribbonId = 0;

  const velocity = new ProAddVelocityInConeModule();

  velocity.coneAxis = [0, 1, 0];
  velocity.coneAngle = Math.PI / 8;
  velocity.speed = ProDistributionFloat.fromRange(2.0, 2.5);

  const gravity = new ProGravityForceModule();

  gravity.gravity = [0, -1.0, 0];

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

function configureRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProSpriteRendererProperties();
  const renderer = new ProSpriteRenderer(engine, props);

  void math;
  component.addRenderer(renderer);
}

function configureRibbonRenderer (component: ProParticleSystemRendererComponent, engine: Composition['engine']): void {
  const props = new ProRibbonRendererProperties();
  const renderer = new ProRibbonRenderer(engine, props);

  component.addRenderer(renderer);
}
