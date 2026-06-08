import { Matrix4, Vector2 } from '@galacean/effects-math/es/core/index';
import type { vec3 } from '@galacean/effects-specification';
import * as spec from '@galacean/effects-specification';
import type { Engine } from '../../engine';
import { createValueGetter, ensureVec3 } from '../../math';
import type { BurstSpawnModuleData } from './burst-spawn-module';
import type { ForceTargetModuleData } from './force-target-module';
import type { InitializeModuleData } from './initialize-particle-module';
import type { EmitterData, ParsedTrailConfig } from './particle-emitter';
import type { ParticleMeshProps } from './particle-mesh';
import type { ParticleRibbonRendererProps } from './particle-ribbon-renderer';
import type { ScaleColorModuleData } from './scale-color-module';
import type { ScaleSizeModuleData } from './scale-size-module';
import type { OrbitalAndLinearMoveModuleData } from './orbital-and-linear-move-module';
import type { SolveRotationModuleData } from './solve-rotation-module';
import type { GravityForceModuleData } from './gravity-force-module';
import type { SolveForcesAndVelocityModuleData } from './solve-forces-and-velocity-module';
import type { SpawnRateModuleData } from './spawn-rate-module';

/**
 * 模块级数据描述。每个字段 1:1 对应一个模块的构建参数。
 */
export type ParsedModuleData = {
  initialize: InitializeModuleData,
  spawnRate?: SpawnRateModuleData,
  burst: BurstSpawnModuleData,
  gravityForce: GravityForceModuleData,
  solveForcesAndVelocity: SolveForcesAndVelocityModuleData,
  solveRotation: SolveRotationModuleData,
  orbitalAndLinearMove: OrbitalAndLinearMoveModuleData,
  forceTarget?: ForceTargetModuleData,
  scaleSize: ScaleSizeModuleData,
  scaleColor: ScaleColorModuleData,
};

export type ParsedSpecResult = {
  emitterData: EmitterData,
  particleMeshProps: ParticleMeshProps,
  trailMeshProps: ParticleRibbonRendererProps | undefined,
  interaction: { behavior?: spec.ParticleInteractionBehavior, multiple?: boolean, radius: number } | undefined,
};

/**
 * 从 spec 数据解析粒子系统配置。纯函数，不依赖 ParticleSystem 实例。
 */
export function parseParticleSpec (data: spec.ParticleSystemData, engine: Engine): ParsedSpecResult {
  const { options, positionOverLifetime = {}, shape } = data;
  const textureSheetAnimation = data.textureSheetAnimation;

  // --- Initialize module ---
  const startTurbulence = !!(shape && shape.turbulenceX || shape?.turbulenceY || shape?.turbulenceZ);
  const initData: InitializeModuleData = {
    startSpeed: positionOverLifetime.startSpeed || 0,
    startLifetime: options.startLifetime,
    startDelay: options.startDelay || 0,
    startColor: (options.startColor || [spec.ValueType.RGBA_COLOR, [255, 255, 255, 255]]) as spec.ColorExpression | spec.RGBAColorValue,
    start3DSize: !!options.start3DSize,
    startTurbulence,
    shape,
    textureSheetAnimation,
    splits: data.splits,
  };

  if (options.startRotationZ) {
    initData.startRotation = options.startRotationZ;
  }
  if (options.startRotationX || options.startRotationY) {
    initData.start3DRotation = true;
    initData.startRotationX = options.startRotationX || 0;
    initData.startRotationY = options.startRotationY || 0;
    initData.startRotationZ = options.startRotationZ || 0;
  }
  if (options.start3DSize) {
    initData.startSizeX = options.startSizeX;
    initData.startSizeY = options.startSizeY;
  } else {
    initData.startSize = options.startSize;
    initData.sizeAspect = options.sizeAspect || 1;
  }
  if (startTurbulence) {
    initData.turbulence = [
      shape.turbulenceX ?? 0,
      shape.turbulenceY ?? 0,
      shape.turbulenceZ ?? 0,
    ];
  }

  // --- SolvePosition module ---
  const linearVel = {
    x: positionOverLifetime.linearX || undefined,
    y: positionOverLifetime.linearY || undefined,
    z: positionOverLifetime.linearZ || undefined,
    asMovement: positionOverLifetime.asMovement,
    enabled: false,
  };

  if (linearVel.x || linearVel.y || linearVel.z) {
    linearVel.enabled = true;
  }

  const orbitalVel = {
    x: positionOverLifetime.orbitalX || undefined,
    y: positionOverLifetime.orbitalY || undefined,
    z: positionOverLifetime.orbitalZ || undefined,
    center: positionOverLifetime.orbCenter,
    asRotation: positionOverLifetime.asRotation,
    enabled: false,
  };

  if (orbitalVel.x || orbitalVel.y || orbitalVel.z) {
    orbitalVel.enabled = true;
  }

  // --- SolveRotation module ---
  let rotationOverLifetime: SolveRotationModuleData['rotationOverLifetime'];
  const rotOverLt = data.rotationOverLifetime;

  if (rotOverLt) {
    rotationOverLifetime = {
      asRotation: !!rotOverLt.asRotation,
      z: rotOverLt.z || 0,
      x: rotOverLt.separateAxes ? rotOverLt.x : undefined,
      y: rotOverLt.separateAxes ? rotOverLt.y : undefined,
    };
  }

  // --- ForceTarget module ---
  let forceTarget: ForceTargetModuleData | undefined;

  if (positionOverLifetime?.forceTarget) {
    forceTarget = {
      target: positionOverLifetime.target || [0, 0, 0],
      curve: positionOverLifetime.forceCurve || [spec.ValueType.LINE, [[0, 0], [1, 1]]],
    };
  }

  // --- ScaleSize module ---
  const sizeOverLifetime = data.sizeOverLifetime || {};
  const scaleSize: ScaleSizeModuleData = sizeOverLifetime?.separateAxes
    ? { separateAxes: true, x: sizeOverLifetime.x || 1, y: sizeOverLifetime.y || 1 }
    : { separateAxes: false, x: ('size' in sizeOverLifetime ? sizeOverLifetime.size : sizeOverLifetime.x) || 1 };

  // --- ScaleColor module ---
  const colorOverLifetime = data.colorOverLifetime;
  const scaleColor: ScaleColorModuleData = {
    color: colorOverLifetime && Array.isArray(colorOverLifetime.color) && colorOverLifetime.color[0] === spec.ValueType.GRADIENT_COLOR
      ? (colorOverLifetime.color)[1]
      : undefined,
    opacity: colorOverLifetime?.opacity || undefined,
  };

  // --- Renderer / mesh props ---
  const renderer = data.renderer || {};

  renderer.anchor = renderer.anchor || [0, 0];

  const particleMeshProps: ParticleMeshProps = {
    name: 'ParticleSystem',
    renderMode: renderer.renderMode || spec.RenderMode.BILLBOARD,
    side: renderer.side || spec.SideMode.DOUBLE,
    blending: renderer.blending || spec.BlendingMode.ALPHA,
    sprite: textureSheetAnimation ? {
      animate: textureSheetAnimation.animate,
      blend: (textureSheetAnimation as any).blend,
      col: textureSheetAnimation.col,
      row: textureSheetAnimation.row,
      total: textureSheetAnimation.total || textureSheetAnimation.col * textureSheetAnimation.row,
    } : undefined,
    occlusion: !!renderer.occlusion,
    transparentOcclusion: !!renderer.transparentOcclusion,
    maxCount: options.maxCount,
    mask: 0,
    maskMode: 0,
    diffuse: renderer.texture ? engine.findObject(renderer.texture) : undefined,
    anchor: Vector2.fromArray(renderer.anchor),
  };

  // @ts-expect-error
  particleMeshProps.textureFlip = data.splits?.[0]?.[4];

  // --- Trails ---
  let trails: ParsedTrailConfig | undefined;
  let trailMeshProps: ParticleRibbonRendererProps | undefined;
  const trailsData = data.trails;

  if (trailsData) {
    trails = {
      lifetime: trailsData.lifetime,
      dieWithParticles: trailsData.dieWithParticles !== false,
      sizeAffectsWidth: !!trailsData.sizeAffectsWidth,
      sizeAffectsLifetime: !!trailsData.sizeAffectsLifetime,
      inheritParticleColor: !!trailsData.inheritParticleColor,
      parentAffectsPosition: !!trailsData.parentAffectsPosition,
    };

    trailMeshProps = {
      name: 'Trail',
      matrix: Matrix4.IDENTITY,
      minimumVertexDistance: trailsData.minimumVertexDistance || 0.02,
      maxTrailCount: options.maxCount,
      pointCountPerTrail: Math.round(trailsData.maxPointPerTrail) || 32,
      blending: trailsData.blending,
      texture: trailsData.texture ? engine.findObject(trailsData.texture) : undefined,
      opacityOverLifetime: createValueGetter(trailsData.opacityOverLifetime || 1),
      widthOverTrail: createValueGetter(trailsData.widthOverTrail || 1),
      shaderCachePrefix: '',
      lifetime: createValueGetter(trails.lifetime),
      occlusion: !!trailsData.occlusion,
      transparentOcclusion: !!trailsData.transparentOcclusion,
      mask: 0,
      maskMode: 0,
    };

    if (trailsData.colorOverLifetime && trailsData.colorOverLifetime[0] === spec.ValueType.GRADIENT_COLOR) {
      trailMeshProps.colorOverLifetime = trailsData.colorOverLifetime[1];
    }
    if (trailsData.colorOverTrail && trailsData.colorOverTrail[0] === spec.ValueType.GRADIENT_COLOR) {
      trailMeshProps.colorOverTrail = trailsData.colorOverTrail[1];
    }
  }

  // --- Interaction ---
  const interactionData = data.interaction;
  const interaction = interactionData ? {
    multiple: interactionData.multiple,
    radius: interactionData.radius ?? 0.4,
    behavior: interactionData.behavior,
  } : undefined;

  return {
    emitterData: {
      maxCount: options.maxCount ?? 0,
      looping: options.looping ?? false,
      particleFollowParent: !!options.particleFollowParent,
      alignSpeedDirection: !!(shape as any)?.alignSpeedDirection,
      trails,
      modules: {
        initialize: initData,
        spawnRate: { rateOverTime: data.emission.rateOverTime },
        burst: {
          burstOffsets: getBurstOffsets(data.emission.burstOffsets ?? []),
          bursts: (data.emission.bursts || []) as BurstSpawnModuleData['bursts'],
        },
        gravityForce: {
          gravity: ensureVec3(positionOverLifetime?.gravity),
          gravityModifier: positionOverLifetime?.gravityOverLifetime || 0,
        },
        solveForcesAndVelocity: {
          speedOverLifetime: positionOverLifetime.speedOverLifetime || undefined,
        },
        solveRotation: { rotationOverLifetime },
        orbitalAndLinearMove: {
          orbital: orbitalVel.enabled ? orbitalVel : undefined,
          linearVelOverLifetime: linearVel.enabled ? linearVel : undefined,
        },
        forceTarget,
        scaleSize,
        scaleColor,
      },
    },
    particleMeshProps,
    trailMeshProps,
    interaction,
  };
}

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
        offsets.push(arr.slice(1, 4) as unknown as vec3);
      } else {
        offsets.push([+arr.x, +arr.y, +arr.z]);
      }
    });
  }

  return ret;
}

