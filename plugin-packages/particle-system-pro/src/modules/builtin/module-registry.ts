import type { ProModule } from '../module';
import { ProModuleStage } from '../stage';
import { ProAccelerationForceModule } from './acceleration-force-module';
import { ProAddVelocityInConeModule } from './add-velocity-in-cone-module';
import { ProCalculateAccurateVelocityModule } from './calculate-accurate-velocity-module';
import { ProCameraOffsetModule } from './camera-offset-module';
import { ProColorOverLifeModule } from './color-over-life-module';
import { ProCurlNoiseForceModule } from './curl-noise-force-module';
import { ProDragModule } from './drag-module';
import { ProEmitterPropertiesModule } from './emitter-properties-module';
import { ProGravityForceModule } from './gravity-force-module';
import { ProInitializeParticleModule } from './initialize-particle-module';
import { ProInitializeRibbonIDModule } from './initialize-ribbon-id-module';
import { ProInitializeRotationModule } from './initialize-rotation-module';
import { ProRibbonWidthModule } from './ribbon-width-module';
import { ProRibbonWidthScaleModule } from './ribbon-width-scale-module';
import { ProRotateAroundPointModule } from './rotate-around-point-module';
import { ProRotationOverLifeModule } from './rotation-over-life-module';
import { ProSampleParticlesFromOtherEmitterModule } from './sample-particles-from-other-emitter-module';
import { ProScaleColorModule } from './scale-color-module';
import { ProScaleSizeBySpeedModule } from './scale-size-by-speed-module';
import { ProScaleSpriteSizeModule } from './scale-sprite-size-module';
import { ProShapeLocationModule } from './shape-location-module';
import { ProSizeOverLifeModule } from './size-over-life-module';
import { ProSolveForcesAndVelocityModule } from './solve-forces-and-velocity-module';
import { ProSpawnBurstModule } from './spawn-burst-module';
import { ProSpawnPerSourceParticleModule } from './spawn-per-source-particle-module';
import { ProSpawnRateModule } from './spawn-rate-module';
import { ProSpriteRotationRateModule } from './sprite-rotation-rate-module';
import { ProSubUVAnimationModule } from './sub-uv-animation-module';
import { ProUpdateAgeModule } from './update-age-module';

/**
 * 描述一个可在编辑器里被「+ Add Module」选中的内置模块。
 *
 * id 用 'pro.xxx' 命名空间避免和未来用户 module 撞；label 给 UI 显示；
 * stage 决定它属于哪一段下拉；create 返回新实例。
 */
export interface ProModuleDescriptor {
  id: string,
  label: string,
  stage: ProModuleStage,
  create: () => ProModule,
}

export const proModuleRegistry: ProModuleDescriptor[] = [
  // Emitter Spawn
  { id: 'pro.emitterProperties', label: 'Emitter Properties', stage: ProModuleStage.EmitterSpawn, create: () => new ProEmitterPropertiesModule() },
  // Emitter Update
  { id: 'pro.spawnRate', label: 'Spawn Rate', stage: ProModuleStage.EmitterUpdate, create: () => new ProSpawnRateModule() },
  { id: 'pro.spawnBurst', label: 'Spawn Burst', stage: ProModuleStage.EmitterUpdate, create: () => new ProSpawnBurstModule() },
  { id: 'pro.spawnPerSourceParticle', label: 'Spawn Per Source Particle', stage: ProModuleStage.EmitterUpdate, create: () => new ProSpawnPerSourceParticleModule() },
  // Particle Spawn
  { id: 'pro.initializeParticle', label: 'Initialize Particle', stage: ProModuleStage.ParticleSpawn, create: () => new ProInitializeParticleModule() },
  { id: 'pro.initializeRotation', label: 'Initialize Rotation', stage: ProModuleStage.ParticleSpawn, create: () => new ProInitializeRotationModule() },
  { id: 'pro.addVelocityInCone', label: 'Add Velocity in Cone', stage: ProModuleStage.ParticleSpawn, create: () => new ProAddVelocityInConeModule() },
  { id: 'pro.shapeLocation', label: 'Shape Location', stage: ProModuleStage.ParticleSpawn, create: () => new ProShapeLocationModule() },
  { id: 'pro.initializeRibbonId', label: 'Initialize Ribbon ID', stage: ProModuleStage.ParticleSpawn, create: () => new ProInitializeRibbonIDModule() },
  { id: 'pro.ribbonWidth', label: 'Ribbon Width', stage: ProModuleStage.ParticleSpawn, create: () => new ProRibbonWidthModule() },
  { id: 'pro.sampleParticlesFromOtherEmitter', label: 'Sample Particles From Other Emitter', stage: ProModuleStage.ParticleSpawn, create: () => new ProSampleParticlesFromOtherEmitterModule() },
  { id: 'pro.cameraOffset', label: 'Camera Offset', stage: ProModuleStage.ParticleSpawn, create: () => new ProCameraOffsetModule() },
  // Particle Update
  { id: 'pro.gravityForce', label: 'Gravity Force', stage: ProModuleStage.ParticleUpdate, create: () => new ProGravityForceModule() },
  { id: 'pro.accelerationForce', label: 'Acceleration Force', stage: ProModuleStage.ParticleUpdate, create: () => new ProAccelerationForceModule() },
  { id: 'pro.curlNoiseForce', label: 'Curl Noise Force', stage: ProModuleStage.ParticleUpdate, create: () => new ProCurlNoiseForceModule() },
  { id: 'pro.rotateAroundPoint', label: 'Rotate Around Point', stage: ProModuleStage.ParticleUpdate, create: () => new ProRotateAroundPointModule() },
  { id: 'pro.solveForcesAndVelocity', label: 'Solve Forces & Velocity', stage: ProModuleStage.ParticleUpdate, create: () => new ProSolveForcesAndVelocityModule() },
  { id: 'pro.calculateAccurateVelocity', label: 'Calculate Accurate Velocity', stage: ProModuleStage.ParticleUpdate, create: () => new ProCalculateAccurateVelocityModule() },
  { id: 'pro.drag', label: 'Drag', stage: ProModuleStage.ParticleUpdate, create: () => new ProDragModule() },
  { id: 'pro.rotationOverLife', label: 'Rotation Over Life', stage: ProModuleStage.ParticleUpdate, create: () => new ProRotationOverLifeModule() },
  { id: 'pro.spriteRotationRate', label: 'Sprite Rotation Rate', stage: ProModuleStage.ParticleUpdate, create: () => new ProSpriteRotationRateModule() },
  { id: 'pro.colorOverLife', label: 'Color Over Life', stage: ProModuleStage.ParticleUpdate, create: () => new ProColorOverLifeModule() },
  { id: 'pro.scaleColor', label: 'Scale Color', stage: ProModuleStage.ParticleUpdate, create: () => new ProScaleColorModule() },
  { id: 'pro.sizeOverLife', label: 'Size Over Life', stage: ProModuleStage.ParticleUpdate, create: () => new ProSizeOverLifeModule() },
  { id: 'pro.scaleSpriteSize', label: 'Scale Sprite Size', stage: ProModuleStage.ParticleUpdate, create: () => new ProScaleSpriteSizeModule() },
  { id: 'pro.scaleSizeBySpeed', label: 'Scale Size by Speed', stage: ProModuleStage.ParticleUpdate, create: () => new ProScaleSizeBySpeedModule() },
  { id: 'pro.ribbonWidthScale', label: 'Ribbon Width Scale', stage: ProModuleStage.ParticleUpdate, create: () => new ProRibbonWidthScaleModule() },
  { id: 'pro.subUVAnimation', label: 'SubUV Animation', stage: ProModuleStage.ParticleUpdate, create: () => new ProSubUVAnimationModule() },
  { id: 'pro.updateAge', label: 'Update Age', stage: ProModuleStage.ParticleUpdate, create: () => new ProUpdateAgeModule() },
];

export function getProModuleDescriptorsByStage (stage: ProModuleStage): ProModuleDescriptor[] {
  return proModuleRegistry.filter(d => d.stage === stage);
}

let constructorToIdCache: Map<Function, string> | null = null;

/**
 * 根据 module 实例反查它的 registry id（typeId）。序列化时用。
 *
 * 通过一次性构造一个临时实例拿到 constructor 引用建立映射；
 * 用户自定义的 module（未注册）返回 null。
 */
export function getProModuleTypeId (module: ProModule): string | null {
  if (!constructorToIdCache) {
    constructorToIdCache = new Map();
    for (const desc of proModuleRegistry) {
      const sample = desc.create();

      constructorToIdCache.set(sample.constructor, desc.id);
    }
  }

  return constructorToIdCache.get(module.constructor) ?? null;
}

/**
 * 根据 typeId 查找 descriptor。反序列化时用。
 */
export function findProModuleDescriptor (typeId: string): ProModuleDescriptor | undefined {
  return proModuleRegistry.find(d => d.id === typeId);
}
