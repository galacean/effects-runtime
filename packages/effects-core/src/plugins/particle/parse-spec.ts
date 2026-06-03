import { Matrix4, Vector2 } from '@galacean/effects-math/es/core/index';
import type { vec3 } from '@galacean/effects-specification';
import * as spec from '@galacean/effects-specification';
import type { Engine } from '../../engine';
import { createValueGetter, ensureVec3 } from '../../math';
import type { ValueGetter } from '../../math';
import { createShape } from '../../shape';
import type { ShapeGenerator } from '../../shape';
import { Texture } from '../../texture';
import { Burst } from './burst';
import type { ParticleMeshProps } from './particle-mesh';
import type { TrailMeshProps } from './trail-mesh';

export type ParsedParticleOptions = {
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
  turbulence?: [ValueGetter<number>, ValueGetter<number>, ValueGetter<number>],
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

export type BurstSpawnModuleData = {
  bursts: Burst[],
  burstOffsets: Record<string, vec3[] | null>,
};

export type ParsedTextureSheetAnimation = {
  col: number,
  row: number,
  total: number,
  animate: boolean,
  animationDelay: ValueGetter<number>,
  animationDuration: ValueGetter<number>,
  cycles: ValueGetter<number>,
  endAtLifetime?: ValueGetter<number>,
  blend?: boolean,
};

export type ParsedTrailConfig = {
  lifetime: ValueGetter<number>,
  dieWithParticles: boolean,
  sizeAffectsWidth: boolean,
  sizeAffectsLifetime: boolean,
  inheritParticleColor: boolean,
  parentAffectsPosition: boolean,
};

export type InitializeModuleData = {
  options: ParsedParticleOptions,
  shape: ShapeGenerator,
  textureSheetAnimation: ParsedTextureSheetAnimation | undefined,
  uvs: number[][],
};

export type SpawnRateModuleData = {
  rateOverTime: ValueGetter<number>,
};

export type SolveVelocityModuleData = {
  gravity: vec3,
  gravityModifier: ValueGetter<number>,
  speedOverLifetime?: ValueGetter<number>,
};

export type SolveRotationModuleData = {
  rotationOverLifetime?: {
    asRotation?: boolean,
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
  },
};

export type SolveLinearMoveModuleData = {
  linearVelOverLifetime?: { asMovement?: boolean, x?: ValueGetter<number>, y?: ValueGetter<number>, z?: ValueGetter<number>, enabled?: boolean },
};

export type SolveOrbitalModuleData = {
  enabled?: boolean,
  asRotation?: boolean,
  x?: ValueGetter<number>,
  y?: ValueGetter<number>,
  z?: ValueGetter<number>,
  center?: vec3,
};

export type ForceTargetModuleData = {
  curve: ValueGetter<number>,
  target: vec3,
};

/**
 * 模块级数据描述。每个字段 1:1 对应一个模块的构建参数。
 */
export type ParsedModuleData = {
  initialize: InitializeModuleData,
  spawnRate?: SpawnRateModuleData,
  burst: BurstSpawnModuleData,
  solveVelocity: SolveVelocityModuleData,
  solveRotation: SolveRotationModuleData,
  solveLinearMove: SolveLinearMoveModuleData,
  solveOrbital: SolveOrbitalModuleData,
  forceTarget?: ForceTargetModuleData,
};

/**
 * Emitter 构建所需的全部数据（不含运行时引用）。
 * 对齐 Pro 的 emitter data 模式：数据与运行时引用分离。
 */
export type EmitterData = {
  maxCount: number,
  looping: boolean,
  particleFollowParent: boolean,
  trails: ParsedTrailConfig | undefined,
  modules: ParsedModuleData,
};

export type ParsedSpecResult = {
  options: ParsedParticleOptions,
  emitterData: EmitterData,
  particleMeshProps: ParticleMeshProps,
  trailMeshProps: TrailMeshProps | undefined,
  interaction: { behavior?: spec.ParticleInteractionBehavior, multiple?: boolean, radius: number } | undefined,
};

/**
 * 从 spec 数据解析粒子系统配置。纯函数，不依赖 ParticleSystem 实例。
 * 与原 fromData 逻辑逐行对应，不改变任何行为。
 */
export function parseParticleSpec (data: spec.ParticleSystemData, engine: Engine): ParsedSpecResult {
  const props = data;
  const cachePrefix = '';
  const { options, positionOverLifetime = {}, shape } = props;
  const gravityModifier = positionOverLifetime?.gravityOverLifetime;
  const gravity = ensureVec3(positionOverLifetime?.gravity);
  const _textureSheetAnimation = props.textureSheetAnimation;
  const textureSheetAnimation: ParsedTextureSheetAnimation | undefined = _textureSheetAnimation ? {
    animationDelay: createValueGetter(_textureSheetAnimation.animationDelay || 0),
    animationDuration: createValueGetter(_textureSheetAnimation.animationDuration || 1),
    cycles: createValueGetter(_textureSheetAnimation.cycles || 1),
    animate: _textureSheetAnimation.animate,
    col: _textureSheetAnimation.col,
    row: _textureSheetAnimation.row,
    total: _textureSheetAnimation.total || _textureSheetAnimation.col * _textureSheetAnimation.row,
  } : undefined;
  const startTurbulence = !!(shape && shape.turbulenceX || shape?.turbulenceY || shape?.turbulenceZ);
  let turbulence: ParsedParticleOptions['turbulence'];

  if (startTurbulence) {
    turbulence = [
      createValueGetter(shape.turbulenceX ?? 0),
      createValueGetter(shape.turbulenceY ?? 0),
      createValueGetter(shape.turbulenceZ ?? 0),
    ];
  }

  const shapeGenerator = createShape(shape);
  const rateOverTime = createValueGetter(props.emission.rateOverTime);
  const burstData: BurstSpawnModuleData = {
    burstOffsets: getBurstOffsets(props.emission.burstOffsets ?? []),
    bursts: (props.emission.bursts || []).map((c: any) => new Burst(c)),
  };

  let rotationOverLifetime: SolveRotationModuleData['rotationOverLifetime'];
  const rotOverLt = props.rotationOverLifetime;

  if (rotOverLt) {
    rotationOverLifetime = {};
    rotationOverLifetime.asRotation = !!rotOverLt.asRotation;
    rotationOverLifetime.z = rotOverLt.z ? createValueGetter(rotOverLt.z) : createValueGetter(0);
    if (rotOverLt.separateAxes) {
      rotationOverLifetime.x = rotOverLt.x && createValueGetter(rotOverLt.x);
      rotationOverLifetime.y = rotOverLt.y && createValueGetter(rotOverLt.y);
    }
  }

  let forceTarget: ParsedParticleOptions['forceTarget'];

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

  const parsedOptions: ParsedParticleOptions = {
    particleFollowParent: !!options.particleFollowParent,
    startLifetime: createValueGetter(options.startLifetime),
    startDelay: createValueGetter(options.startDelay || 0),
    startSpeed: createValueGetter(positionOverLifetime.startSpeed || 0),
    startColor: createValueGetter(options.startColor),
    looping: options.looping ?? false,
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
    parsedOptions.startRotation = createValueGetter(options.startRotationZ || 0);
  }
  if (options.startRotationX || options.startRotationY) {
    parsedOptions.start3DRotation = true;
    parsedOptions.startRotationX = createValueGetter(options.startRotationX || 0);
    parsedOptions.startRotationY = createValueGetter(options.startRotationY || 0);
    parsedOptions.startRotationZ = createValueGetter(options.startRotationZ || 0);
  }

  if (options.start3DSize) {
    parsedOptions.startSizeX = createValueGetter(options.startSizeX);
    parsedOptions.startSizeY = createValueGetter(options.startSizeY);
  } else {
    parsedOptions.startSize = createValueGetter(options.startSize);
    parsedOptions.sizeAspect = createValueGetter(options.sizeAspect || 1);
  }

  // renderer / mesh props
  const renderer = props.renderer || {};

  renderer.anchor = renderer.anchor || [0, 0];
  const anchor = Vector2.fromArray(renderer.anchor);

  const particleMeshProps: ParticleMeshProps = {
    name: 'ParticleSystem',
    matrix: Matrix4.IDENTITY,
    shaderCachePrefix,
    renderMode: renderer.renderMode || spec.RenderMode.BILLBOARD,
    side: renderer.side || spec.SideMode.DOUBLE,
    gravity,
    blending: renderer.blending || spec.BlendingMode.ALPHA,
    gravityModifier: parsedOptions.gravityModifier,
    sprite: textureSheetAnimation,
    occlusion: !!renderer.occlusion,
    transparentOcclusion: !!renderer.transparentOcclusion,
    maxCount: options.maxCount,
    mask: 0,
    maskMode: 0,
    diffuse: renderer.texture ? engine.findObject(renderer.texture) : undefined,
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
          engine,
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

  // UVs
  const uvs: number[][] = [];
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
  // @ts-expect-error
  particleMeshProps.textureFlip = flip;

  // Trails
  let trails: ParsedTrailConfig | undefined;
  let trailMeshProps: TrailMeshProps | undefined;
  const trailsData = props.trails;

  if (trailsData) {
    trails = {
      lifetime: createValueGetter(trailsData.lifetime),
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
      shaderCachePrefix,
      lifetime: trails.lifetime,
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

  // Interaction
  let interaction: ParsedSpecResult['interaction'];
  const interactionData = props.interaction;

  if (interactionData) {
    interaction = {
      multiple: interactionData.multiple,
      radius: interactionData.radius ?? 0.4,
      behavior: interactionData.behavior,
    };
  }

  const lv = parsedOptions.linearVelOverLifetime;
  const ov = parsedOptions.orbitalVelOverLifetime;

  if (lv && (lv.x || lv.y || lv.z)) {
    lv.enabled = true;
  }
  if (ov && (ov.x || ov.y || ov.z)) {
    ov.enabled = true;
  }

  return {
    options: parsedOptions,
    emitterData: {
      maxCount: parsedOptions.maxCount,
      looping: parsedOptions.looping,
      particleFollowParent: !!parsedOptions.particleFollowParent,
      trails,
      modules: {
        initialize: { options: parsedOptions, shape: shapeGenerator, textureSheetAnimation, uvs },
        spawnRate: { rateOverTime },
        burst: burstData,
        solveVelocity: { gravity: parsedOptions.gravity, gravityModifier: parsedOptions.gravityModifier, speedOverLifetime: parsedOptions.speedOverLifetime },
        solveRotation: { rotationOverLifetime },
        solveLinearMove: { linearVelOverLifetime: (lv?.x || lv?.y || lv?.z) ? { ...lv, enabled: true } : undefined },
        solveOrbital: parsedOptions.orbitalVelOverLifetime ?? {},
        forceTarget: parsedOptions.forceTarget,
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

