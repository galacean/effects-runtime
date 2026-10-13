import * as spec from '@galacean/effects-specification';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { calculateTranslation } from '../math/translate';
import { BezierCurve, createValueGetter, InterpolationMode, LineSegments } from '../math/value-getters';
import type { TransformPlayableAssetData } from '../plugins/timeline/playables/transform-playable';
import { Transform } from '../transform';
import { ensureFixedNumber, ensureFixedVec3 } from './utils';

const { ValueType, BezierKeyframeType, DataType } = spec;
const axes = ['x', 'y', 'z'] as const;

/** Apply an affine transform to key values and control ordinates without changing their times. */
function mapTransformCurve (value: spec.FixedNumberExpression | number, scale: number, offset = 0): spec.FixedNumberExpression {
  if (typeof value === 'number') {
    return [ValueType.CONSTANT, value * scale + offset];
  }
  if (value[0] === ValueType.CONSTANT) {
    return [ValueType.CONSTANT, value[1] * scale + offset];
  }
  if (value[0] === ValueType.LINE) {
    return [ValueType.LINE, value[1].map(key => [key[0], key[1] * scale + offset])];
  }
  if (value[0] === ValueType.CURVE) {
    return mapTransformCurve(ensureFixedNumber(value)!, scale, offset);
  }

  return [ValueType.BEZIER_CURVE, value[1].map(key => [
    key[0], key[1].map((coordinate, index) => index % 2 ? coordinate * scale + offset : coordinate), ...key.slice(2),
  ] as spec.BezierKeyframeValue)];
}

/** Convert the legacy integral into ordinary angle keys; preserve its duration conventions. */
function bakeAngularVelocity (value: spec.FixedNumberExpression | number, duration: number): spec.FixedNumberExpression {
  if (duration <= 0) {
    return [ValueType.CONSTANT, 0];
  }
  const getter = createValueGetter(value);
  const sample = (life: number): number => getter.getIntegrateValue(0, life, duration);

  if (typeof value === 'number' || value[0] === ValueType.CONSTANT ||
    (value[0] === ValueType.BEZIER_CURVE && value[1].length <= 1)) {
    return [ValueType.LINE, [[0, 0], [1, sample(1)]]];
  }
  const knots = new Set([0, 1]);

  if (getter instanceof BezierCurve) {
    for (const key of getter.getKeyFrames()) {
      if (key.time > 0) {
        knots.add(key.time * duration);
      }
    }
  } else if (getter instanceof LineSegments) {
    for (const key of getter.keys) {
      if (key[0] > 0) {
        knots.add(key[0]);
      }
    }
  }
  const times = Array.from(knots).sort((a, b) => a - b);
  const keys: spec.BezierKeyframeValue[] = [[BezierKeyframeType.LINE, [0, 0]]];
  const subdivide = (start: number, end: number, startValue: number, endValue: number, depth: number): void => {
    let error = 0;

    for (let i = 1; i < 8; i++) {
      const ratio = i / 8;

      error = Math.max(error, Math.abs(sample(start + (end - start) * ratio) - (startValue + (endValue - startValue) * ratio)));
    }
    // Use a tighter threshold than the 0.01 degree target to leave interpolation headroom.
    if (error > 0.0025) {
      if (depth >= 24 || keys.length >= 32768) {
        throw new Error('Angular velocity curve exceeds the angle baking precision/keyframe limit.');
      }
      const middle = (start + end) / 2;
      const middleValue = sample(middle);

      subdivide(start, middle, startValue, middleValue, depth + 1);
      subdivide(middle, end, middleValue, endValue, depth + 1);
    } else {
      keys.push([BezierKeyframeType.LINE, [end, endValue]]);
    }
  };

  for (let i = 1; i < times.length; i++) {
    subdivide(times[i - 1], times[i], sample(times[i - 1]), sample(times[i]), 0);
  }

  return [ValueType.BEZIER_CURVE, keys];
}

/** Bake legacy orbital, linear and path motion into absolute position keys over the clip. */
function bakePositionPath (movement: spec.PositionOverLifetime, position: Vector3, duration: number): spec.FixedVec3Expression {
  if (duration <= 0) {
    return [ValueType.CONSTANT_VEC3, position.toArray()];
  }
  const linear = {
    x: createValueGetter(movement.linearX ?? 0),
    y: createValueGetter(movement.linearY ?? 0),
    z: createValueGetter(movement.linearZ ?? 0),
    asMovement: movement.asMovement,
    enabled: !!(movement.linearX || movement.linearY || movement.linearZ),
  };
  const orbital = {
    x: createValueGetter(movement.orbitalX ?? 0),
    y: createValueGetter(movement.orbitalY ?? 0),
    z: createValueGetter(movement.orbitalZ ?? 0),
    center: movement.orbCenter ?? [0, 0, 0],
    asRotation: movement.asRotation,
    enabled: !!(movement.orbitalX || movement.orbitalY || movement.orbitalZ),
  };
  const target = { linearVelOverLifetime: linear, orbitalVelOverLifetime: orbital };
  const path = ensureFixedVec3(movement.path);
  const pathGetter = path && createValueGetter(path);
  const knots = new Set([0, 1]);
  const addKnot = (time: number): void => {
    if (time > 0 && time < 1) {
      knots.add(time);
    }
  };

  for (const motion of [linear, orbital]) {
    const asValue = motion === linear ? linear.asMovement : orbital.asRotation;

    for (const axis of axes) {
      const getter = motion[axis];

      if (getter instanceof BezierCurve) {
        const keys = getter.getKeyFrames();

        for (let i = 0; i < keys.length; i++) {
          addKnot(keys[i].time);
          if (asValue && i > 0 && keys[i - 1].interpolationMode === InterpolationMode.Constant) {
            // Keep a jump at its authored key instead of interpolating across the preceding interval.
            addKnot(keys[i].time - Number.EPSILON);
          }
        }
      } else if (getter instanceof LineSegments) {
        for (const key of getter.keys) {
          addKnot(asValue ? key[0] : key[0] / duration);
        }
      }
    }
  }
  if (path?.[0] === ValueType.BEZIER_CURVE_PATH) {
    for (const key of new BezierCurve(path[1][0]).getKeyFrames()) {
      addKnot(key.time);
    }
  }
  const sample = (life: number): Vector3 => {
    const point = calculateTranslation(new Vector3(), target, undefined, life * duration, duration, position);

    return pathGetter ? point.add(pathGetter.getValue(life)) : point;
  };
  const angle = (axis: typeof axes[number], life: number): number => orbital.asRotation
    ? orbital[axis].getValue(life) : orbital[axis].getIntegrateValue(0, life * duration, duration);
  const hasOrbit = orbital.enabled && position.toArray().some((value, axis) => value !== orbital.center[axis]);
  const times = Array.from(knots).sort((a, b) => a - b);
  const keyTimes = [0];
  const points: spec.vec3[] = [sample(0).toArray()];
  const subdivide = (start: number, end: number, first: Vector3, last: Vector3, depth: number): void => {
    let error = 0;
    let turns = false;

    for (let i = 1; i <= 8; i++) {
      const ratio = i / 8;
      const life = start + (end - start) * ratio;
      const point = i === 8 ? last : sample(life);

      error = Math.max(error, Math.hypot(
        point.x - (first.x + (last.x - first.x) * ratio),
        point.y - (first.y + (last.y - first.y) * ratio),
        point.z - (first.z + (last.z - first.z) * ratio),
      ));
      // Unwrapped angles prevent a whole number of orbits from aliasing to a stationary path.
      turns ||= hasOrbit && axes.some(axis => Math.abs(angle(axis, life) - angle(axis, start)) > 45);
    }
    if ((error > 0.001 || turns) && end - start > 1e-7) {
      if (depth >= 24 || points.length >= 32768) {
        throw new Error('Transform motion exceeds the position baking precision/keyframe limit.');
      }
      const middle = (start + end) / 2;
      const point = sample(middle);

      subdivide(start, middle, first, point, depth + 1);
      subdivide(middle, end, point, last, depth + 1);
    } else {
      keyTimes.push(end);
      points.push(last.toArray());
    }
  };

  for (let i = 1; i < times.length; i++) {
    subdivide(times[i - 1], times[i], sample(times[i - 1]), sample(times[i]), 0);
  }
  if (points.every(point => point.every((value, axis) => value === points[0][axis]))) {
    return [ValueType.CONSTANT_VEC3, points[0]];
  }

  // Existing linear paths interpolate these absolute points directly, without arc-length resampling.
  return [ValueType.LINEAR_PATH, [keyTimes.map(time => [time, time, 1, 1]), points]];
}

function convertAnimation (
  source: TransformPlayableAssetData, item: spec.VFXItemData, duration: number,
  rotationCache: Map<string, spec.FixedNumberExpression>,
): TransformPlayableAssetData {
  const transform = new Transform();

  if (item.transform) {
    transform.fromData(item.transform);
  }
  const initialRotation = transform.getRotation();
  const position = transform.position;
  const scale = transform.scale;
  const result = { ...source };
  const size = source.sizeOverLifetime;
  const rotation = source.rotationOverLifetime;
  const movement = source.positionOverLifetime;

  if (size) {
    result.sizeOverLifetime = {
      separateAxes: true,
      x: mapTransformCurve((size.separateAxes ? size.x : size.size) || 1, scale.x),
      y: mapTransformCurve((size.separateAxes ? size.y : size.size) || 1, scale.y),
      // Animated Z historically uses the item's initial X scale.
      z: mapTransformCurve((size.separateAxes ? size.z : size.size) || 1, scale.x),
    };
  }
  if (rotation) {
    const absolute: spec.RotationOverLifetime = { separateAxes: true, asRotation: true };

    for (const axis of axes) {
      let curve = (axis === 'z' || rotation.separateAxes ? rotation[axis] : undefined) || 0;

      if (!rotation.asRotation) {
        const key = JSON.stringify([curve, duration]);
        let baked = rotationCache.get(key);

        if (!baked) {
          baked = bakeAngularVelocity(curve, duration);
          rotationCache.set(key, baked);
        }
        curve = baked;
      }
      absolute[axis] = mapTransformCurve(curve, 1, initialRotation[axis]);
    }
    result.rotationOverLifetime = absolute;
  }
  if (movement && (movement.linearX || movement.linearY || movement.linearZ || movement.orbitalX || movement.orbitalY || movement.orbitalZ)) {
    result.positionOverLifetime = { path: bakePositionPath(movement, position, duration) };
  } else if (movement?.path) {
    const translate = (point: spec.vec3): spec.vec3 => [point[0] + position.x, point[1] + position.y, point[2] + position.z];
    const path = ensureFixedVec3(movement.path);
    let absolutePath: spec.FixedVec3Expression = [ValueType.CONSTANT_VEC3, position.toArray()];

    if (path?.[0] === ValueType.CONSTANT_VEC3) {
      absolutePath = [ValueType.CONSTANT_VEC3, translate(path[1])];
    } else if (path?.[0] === ValueType.BEZIER_CURVE_PATH) {
      absolutePath = [ValueType.BEZIER_CURVE_PATH, [path[1][0], path[1][1].map(translate), path[1][2].map(translate)]];
    }
    result.positionOverLifetime = { ...movement, path: absolutePath };
  }

  return result;
}

/** Resolve each track's bound item and convert its transform curves in place. */
export function migrateTransformAnimations (json: spec.JSONScene): void {
  const assets = new Map(json.miscs.map(asset => [asset.id, asset]));
  const items = new Map(json.items.map(item => [item.id, item]));
  const rotationCache = new Map<string, spec.FixedNumberExpression>();
  const converted = new Set<string>();

  for (const component of json.components) {
    if (component.dataType !== DataType.CompositionComponent) {
      continue;
    }
    const composition = component as spec.CompositionComponentData;
    const timeline = assets.get(composition.timelineAsset?.id) as spec.TimelineAssetData | undefined;

    if (!timeline || !composition.sceneBindings) {
      continue;
    }
    const bindings = new Map(composition.sceneBindings.map(binding => [binding.key.id, items.get(binding.value.id)]));
    const visit = (trackId: string, parentItem?: spec.VFXItemData): void => {
      const track = assets.get(trackId) as spec.TrackAssetData | undefined;

      if (!track) {
        return;
      }
      // Explicit component bindings must not inherit the parent item's transform context.
      const item = bindings.has(trackId) ? bindings.get(trackId) : parentItem;

      if (item && track.dataType === DataType.TransformTrack) {
        for (const clip of track.clips ?? []) {
          const asset = assets.get(clip.asset.id) as TransformPlayableAssetData | undefined;

          if (asset?.dataType === DataType.TransformPlayableAsset && !converted.has(asset.id)) {
            Object.assign(asset, convertAnimation(asset, item, clip.duration ?? 0, rotationCache));
            converted.add(asset.id);
          }
        }
      }
      for (const child of track.children ?? []) {
        visit(child.id, item);
      }
    };

    for (const track of timeline.tracks) {
      visit(track.id);
    }
  }
}
