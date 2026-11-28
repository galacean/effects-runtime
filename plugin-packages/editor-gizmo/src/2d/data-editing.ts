import {
  Animator, BezierCurve, Component, CompositionComponent, InterpolationMode, PropertyTrack, ShapeComponent,
  TransformPlayableAsset, TransformTrack, WeightedMode, createValueGetter,
  Vector2PropertyPlayableAsset, Vector2PropertyTrack, Vector3ropertyPlayableAsset, Vector3PropertyTrack,
  VFXItem, math, spec, type EffectsObject, type Keyframe, type TimelineClip, type TrackAsset,
} from '@galacean/effects';
import type { GizmoDataChange, GizmoDataValue } from './gizmo-action';
import { cloneConfigValue as copy } from './configs/config-definition';

export interface DataEditTarget {
  item: VFXItem,
  target: EffectsObject,
  paths: string[],
  /** Complete a new geometry frame, including missing vertex tracks, when vertex animation exists. */
  keyAllVertices?: boolean,
}
type Value = number | number[];
interface PropertyEdit {
  item: VFXItem,
  target: EffectsObject,
  path: string,
  before: Value,
  previous: Value,
  base: unknown,
  touched: boolean,
  binding?: { source: ClipEdit, path: string },
  blocked: boolean,
}
interface ClipEdit {
  item: VFXItem,
  target: EffectsObject,
  composition: CompositionComponent,
  track: TrackAsset,
  clip: TimelineClip,
  before: Record<string, any>,
  time: number,
  normalizedTime: number,
  created?: { active: boolean },
}
export interface DataEditState {
  properties: PropertyEdit[],
  clips: ClipEdit[],
  groups: { properties: PropertyEdit[], reference: ClipEdit }[],
}

function field (object: object, path: string): { parent: Record<string, any>, key: string } | undefined {
  const parts = path.split('.');
  let parent: any = object;

  for (const key of parts.slice(0, -1)) { parent = parent?.[key]; }

  return parent && { parent, key: parts[parts.length - 1] };
}

function read (object: object, path: string): any {
  const value = field(object, path);

  return value?.parent[value.key];
}

function valueOf (value: any): Value {
  if (typeof value === 'number') { return value; }
  if (Array.isArray(value)) { return [...value]; }
  const keys = value && 'r' in value ? ['r', 'g', 'b', 'a'] : ['x', 'y', 'z', 'w'].filter(key => typeof value?.[key] === 'number');

  return keys.map(key => value[key]);
}

function equal (a: Value, b: Value): boolean {
  const left = typeof a === 'number' ? [a] : a, right = typeof b === 'number' ? [b] : b;

  return left.length === right.length && left.every((v, i) => Math.abs(v - right[i]) < 1e-7);
}

function readValue (property: Pick<PropertyEdit, 'target' | 'path' | 'previous'>): Value {
  if (property.target instanceof VFXItem && property.path.startsWith('transform.rotation.')) {
    const transform = property.target.transform;
    const rotation = transform.rotation.clone();
    const expected = new math.Quaternion().setFromEuler(rotation).conjugate();
    const axis = property.path.slice(-1) as 'x' | 'y' | 'z';

    if (Math.abs(expected.dot(transform.quat)) < 1 - 1e-8) {
      rotation.setFromQuaternion(transform.quat.clone().conjugate());
      rotation[axis] += Math.round(((property.previous as number) - rotation[axis]) / 360) * 360;
    }

    return rotation[axis];
  }

  return valueOf(read(property.target, property.path));
}

function definitionPath (property: PropertyEdit): string {
  return property.path.replace(/^shape\./, '').replace(/^transform\.rotation\./, 'transform.eulerHint.');
}

function boundObject (composition: CompositionComponent, track: TrackAsset): object | undefined {
  const own = composition.getBinding(track);

  if (own) { return own; }
  const parent = track.parent && boundObject(composition, track.parent);

  return parent && track.resolveBoundObject(parent);
}

function animationPath (target: EffectsObject, path: string, track: TrackAsset, clip: TimelineClip): string | undefined {
  if (clip instanceof TransformPlayableAsset && track instanceof TransformTrack && target instanceof VFXItem) {
    const data = clip.transformAnimationData;

    if (path === 'transform.position' && data.positionOverLifetime?.path !== undefined) { return 'positionOverLifetime.path'; }
    if (path.startsWith('transform.rotation.')) {
      const axis = path.slice(-1);

      if ((axis === 'z' || data.rotationOverLifetime?.separateAxes) && read(data, 'rotationOverLifetime.' + axis) !== undefined) { return 'rotationOverLifetime.' + axis; }
    }
    if (path.startsWith('transform.scale.')) {
      const axis = path.slice(-1);
      const source = data.sizeOverLifetime?.separateAxes ? axis : 'size';

      if (read(data, 'sizeOverLifetime.' + source) !== undefined) { return 'sizeOverLifetime.' + source; }
    }
  }
  if (track instanceof PropertyTrack && track.definition.path === path && clip.definition.curveData !== undefined) { return 'curveData'; }
}

/** Only the fields the current tool can change are captured; no scene-wide snapshots. */
export function beginDataEdit (targets: DataEditTarget[]): DataEditState {
  const state: DataEditState = { properties: [], clips: [], groups: [] };

  for (const { item, target, paths, keyAllVertices } of targets) {
    const properties: PropertyEdit[] = [];

    const ancestors: VFXItem[] = [];

    for (let ancestor: VFXItem | null | undefined = item; ancestor instanceof VFXItem; ancestor = ancestor.parent) { ancestors.push(ancestor); }
    const skeletons = ancestors.flatMap(ancestor => {
      const skeleton = ancestor.getComponent(Animator)?.graphInstance?.skeleton;

      return skeleton ? [skeleton] : [];
    });
    // Resolve each binding once per target, rather than once for every vertex.
    const sources = ancestors.flatMap(ancestor => {
      const composition = ancestor.getComponent(CompositionComponent);

      return composition?.timelineAsset ? composition.timelineAsset.flattenedTracks
        .filter(track => boundObject(composition, track) === target)
        .flatMap(track => track.getClips().map(clip => ({ composition, track, clip }))) : [];
    });

    for (const path of paths) {
      const initial = read(target, path);

      if (initial === undefined) { continue; }
      const value = valueOf(initial);
      const property: PropertyEdit = { item, target, path, before: value, previous: value, base: undefined, touched: false, blocked: false };

      property.before = property.previous = readValue(property);
      property.base = copy(read(target.definition, definitionPath(property)));
      const slot = field(target, path)!;
      const drivenByAnimator = skeletons.some(skeleton =>
        target instanceof VFXItem && /^transform\.(position|rotation|scale)(\.|$)/.test(path) && skeleton.animatedTransforms.includes(target.transform)
        || [...skeleton.floatAnimatedObjects, ...skeleton.colorAnimatedObjects].some(object => object.target === target
          && (object.directTarget === slot.parent && object.propertyName === slot.key || object.directTarget === slot.parent[slot.key])));
      const matches = sources.flatMap(source => {
        const sourcePath = animationPath(target, path, source.track, source.clip);

        if (sourcePath === undefined) { return []; }
        property.blocked = true; // A non-active animation is not a static property.
        const time = source.composition.getTime() - source.clip.start;

        return source.clip.duration > 0 && time >= 0 && (time <= source.clip.duration || source.clip.endBehavior !== spec.EndBehavior.destroy)
          ? [{ ...source, path: sourcePath }] : [];
      });

      property.blocked ||= drivenByAnimator;
      if (matches.length === 1 && !drivenByAnimator) {
        const match = matches[0];
        let source = state.clips.find(source => source.clip === match.clip);

        if (!source) {
          const time = match.composition.getTime();
          let local = time - match.clip.start;

          if (local > match.clip.duration) {
            if (match.clip.endBehavior === spec.EndBehavior.restart) { local %= match.clip.duration; } else { local = match.clip.duration; }
          }
          source = { ...match, item, target, before: copy(match.clip instanceof TransformPlayableAsset ? match.clip.transformAnimationData : match.clip.definition),
            time, normalizedTime: local / match.clip.duration };
          state.clips.push(source);
        }
        property.binding = { source, path: match.path };
        property.blocked = false;
      }
      state.properties.push(property);
      properties.push(property);
    }
    if (keyAllVertices) {
      const reference = properties.find(property => property.binding && keyTimes(read(property.binding.source.before, property.binding.path)).length)?.binding?.source;

      if (reference && properties.some(property => !property.binding || !hasKeyframe(read(property.binding.source.before, property.binding.path), property.binding.source.normalizedTime))) {
        state.groups.push({ properties, reference });
      }
    }
  }

  for (const source of state.clips) { source.item.composition?.pause(); source.composition.pause(); }

  return state;
}

function keyTimes (expression: any): number[] {
  if (!Array.isArray(expression)) { return []; }
  const [type, data] = expression;

  if (type === spec.ValueType.LINE) { return data.map((point: number[]) => point[0]); }
  if (type === spec.ValueType.BEZIER_CURVE) { return new BezierCurve(data).getKeyFrames().map(key => key.time); }
  if (type === spec.ValueType.VECTOR2_CURVE || type === spec.ValueType.VECTOR3_CURVE) { return data.flatMap(keyTimes); }

  return [];
}

function hasKeyframe (expression: any, time: number): boolean {
  if (!Array.isArray(expression)) { return false; }
  if (expression[0] === spec.ValueType.VECTOR2_CURVE || expression[0] === spec.ValueType.VECTOR3_CURVE) {
    return expression[1].every((channel: unknown) => hasKeyframe(channel, time));
  }

  return keyTimes(expression).some(key => Math.abs(key - time) <= epsilon);
}

/** Missing vertex tracks use the same clip range and binding as the edited geometry. */
function createVertexTrack (state: DataEditState, property: PropertyEdit, reference: ClipEdit): void {
  const { item, target, path } = property;
  const vector2 = (property.before as number[]).length === 2;
  const track = vector2 ? new Vector2PropertyTrack(target.engine) : new Vector3PropertyTrack(target.engine);
  const clip = vector2 ? track.createClip(Vector2PropertyPlayableAsset) : track.createClip(Vector3ropertyPlayableAsset);
  const times = Array.from(new Set([0, ...keyTimes(reference.before.curveData)])).sort((a, b) => a - b);

  track.setData({ id: track.getInstanceId(), dataType: vector2 ? spec.DataType.Vector2PropertyTrack : spec.DataType.Vector3PropertyTrack,
    name: path, path, children: [], clips: [{ id: clip.getInstanceId() }] });
  clip.setData({ id: clip.getInstanceId(), dataType: vector2 ? spec.DataType.Vector2PropertyPlayableAsset : spec.DataType.Vector3PropertyPlayableAsset,
    name: path, start: reference.clip.start, duration: reference.clip.duration, endBehavior: reference.clip.endBehavior,
    curveData: [vector2 ? spec.ValueType.VECTOR2_CURVE : spec.ValueType.VECTOR3_CURVE,
      (property.before as number[]).map(value => [spec.ValueType.LINE, times.map(time => [time, value])])] });
  const source: ClipEdit = { item, target, track, clip, composition: reference.composition,
    time: reference.time, normalizedTime: reference.normalizedTime, before: copy(clip.definition), created: { active: false } };

  state.clips.push(source);
  property.binding = { source, path: 'curveData' };
}

/** Existing transform and resize tools share the same small, explicit property list. */
export function transformEditTargets (items: VFXItem[], geometry = false): DataEditTarget[] {
  return items.flatMap(item => {
    const targets: DataEditTarget[] = [{ item, target: item, paths: ['transform.position', 'transform.anchor', 'transform.size',
      'transform.rotation.x', 'transform.rotation.y', 'transform.rotation.z', 'transform.scale.x', 'transform.scale.y', 'transform.scale.z'] }];
    const shape = geometry && item instanceof VFXItem && item.getComponent(ShapeComponent);

    if (shape) {
      const paths: string[] = [];

      for (const [key, value] of Object.entries(shape.shape)) {
        if (typeof value === 'number') { paths.push('shape.' + key); } else if (['points', 'easingIns', 'easingOuts'].includes(key) && Array.isArray(value)) {
          paths.push(...value.map((_, i) => `shape.${key}.${i}`));
        }
      }

      targets.push({ item, target: shape, paths });
    }

    return targets;
  });
}

function restoreValue (property: PropertyEdit): void {
  const { target, path, before } = property;

  if (target instanceof VFXItem) {
    if (path === 'transform.position') {
      target.transform.setPosition(...before as [number, number, number]);

      return;
    }
    if (path === 'transform.anchor') {
      target.transform.setAnchor(...(before as number[]).slice(0, 2) as [number, number]);

      return;
    }
    if (path.startsWith('transform.rotation.')) {
      const rotation = target.transform.getRotation();

      rotation[path.slice(-1) as 'x' | 'y' | 'z'] = before as number;
      target.transform.setRotation(rotation.x, rotation.y, rotation.z);

      return;
    }
  }
  const slot = field(target, path);

  if (!slot) { return; }
  const current = slot.parent[slot.key];

  if (typeof before === 'number') { slot.parent[slot.key] = before; } else {
    const keys = current && typeof current === 'object' && 'r' in current ? ['r', 'g', 'b', 'a'] : ['x', 'y', 'z', 'w'];

    before.forEach((v, i) => { current[keys[i]] = v; });
  }
}

/** Writes all affected clips before evaluating; returned data never shares mutable asset storage. */
export function updateDataEdit (state: DataEditState | undefined, canceled = false, restoreValues = true): GizmoDataChange[] {
  if (!state) { return []; }
  const values = new Map(state.properties.map(property => [property, canceled ? property.before : readValue(property)]));
  const edits = new Map<ClipEdit, { data: Record<string, any>, paths: string[] }>();
  const changes: GizmoDataChange[] = [];
  const keyed = new Set<PropertyEdit>();

  try {
    for (const { properties, reference } of state.groups) {
      const active = !canceled && properties.some(property => !equal(values.get(property)!, property.before));

      if (active && properties.some(property => property.blocked || property.binding && property.binding.source.composition !== reference.composition)) {
        throw new Error('Cannot key all vertices without a unique timeline source.');
      }
      for (const property of properties) {
        if (active) {
          if (!property.binding) { createVertexTrack(state, property, reference); }
          keyed.add(property);
        }
        const created = property.binding?.source.created;

        if (created) { created.active = active; }
      }
    }
    for (const property of state.properties) {
      const value = values.get(property)!, different = !equal(value, property.before);

      if (canceled && restoreValues && !equal(readValue({ ...property, previous: property.before }), property.before)) { restoreValue(property); }
      if (!different && !property.touched && !keyed.has(property) && !property.binding?.source.created) { continue; }
      if (property.blocked && different) { throw new Error(`Cannot uniquely edit the animation driving ${property.path}.`); }
      if (!(typeof value === 'number' ? [value] : value).every(Number.isFinite)) { throw new Error('Invalid edited value.'); }
      property.touched = true;
      property.previous = value;
      const binding = property.binding;

      if (binding) {
        const { source } = binding;
        let edit = edits.get(source);

        if (!edit) {
          edit = { data: copy(source.before), paths: [] };
          edits.set(source, edit);
        }
        const next = edit.data;
        let path = binding.path;

        edit.paths.push(property.path);
        if (different || keyed.has(property)) {
          if (path === 'sizeOverLifetime.size') {
            const size = source.before.sizeOverLifetime.size;

            if (!next.sizeOverLifetime.separateAxes) {
              next.sizeOverLifetime = { ...next.sizeOverLifetime, separateAxes: true, x: copy(size), y: copy(size), z: copy(size) };
            }
            path = 'sizeOverLifetime.' + property.path.slice(-1);
          }
          const slot = field(next, path)!;

          slot.parent[slot.key] = editKeyframeValue(read(source.before, binding.path), source.normalizedTime, value, property.before, keyed.has(property));
        }
        // Resize and FFD setters also write their static definition. Keep animated bases authored.
        const base = field(property.target.definition, definitionPath(property));

        if (base) { if (property.base === undefined) { delete base.parent[base.key]; } else { base.parent[base.key] = copy(property.base); } }
      } else {
        changes.push({ kind: 'value', itemId: property.item.getInstanceId(), targetId: property.target.getInstanceId(),
          propertyPath: property.path, before: copy(property.before), after: copy(value) });
      }
    }
    const compositions = new Map<CompositionComponent, number>();

    for (const [source, { data: next, paths }] of edits) {
      source.clip.setData(next as spec.EffectsObjectData);
      if (source.created) {
        const { composition, track, clip } = source;
        const timeline = composition.timelineAsset!;
        const index = timeline.tracks.indexOf(track);

        if (source.created.active && index < 0) {
          track.registerObject(); clip.registerObject(); timeline.tracks.push(track);
          timeline.markAsChanged(); composition.setBinding(track, source.target);
        } else if (!source.created.active) {
          if (index >= 0) { timeline.tracks.splice(index, 1); }
          composition.clearBinding(track); track.dispose(); clip.dispose();
        }
      }
      compositions.set(source.composition, source.time);
      changes.push({ kind: 'clip', itemId: source.item.getInstanceId(), targetId: source.target.getInstanceId(),
        propertyPaths: paths, compositionId: source.composition.getInstanceId(), trackId: source.track.getInstanceId(),
        clipId: source.clip.getInstanceId(), time: source.time, normalizedTime: source.normalizedTime,
        ...(source.created ? { createdTrack: { active: source.created.active, data: copy(source.track.definition) } } : {}),
        before: copy(source.before) as Record<string, GizmoDataValue>, after: copy(next) as Record<string, GizmoDataValue> });
    }
    for (const [composition, time] of compositions) { composition.timelineAsset?.markAsChanged(); composition.sampleTime(time); }
    for (const target of new Set(state.properties.map(property => property.target))) {
      if (target instanceof Component) { target.onApplyAnimationProperties(); }
    }
  } catch (error) {
    if (!canceled) { updateDataEdit(state, true); }
    throw error;
  }

  return changes;
}

const epsilon = 1e-7;
const lerp = (a: number[], b: number[], t: number): number[] => a.map((value, i) => value + (b[i] - value) * t);

function split (points: number[][], t: number): number[][] {
  const a = lerp(points[0], points[1], t), b = lerp(points[1], points[2], t), c = lerp(points[2], points[3], t);
  const d = lerp(a, b, t), e = lerp(b, c, t);

  return [a, d, lerp(d, e, t), e, c];
}

function makeKey (time: number, value: number): Keyframe {
  return { time, value, inSlope: 0, outSlope: 0, inWeight: 1, outWeight: 1,
    weightedMode: WeightedMode.Both, interpolationMode: InterpolationMode.Linear };
}

function control (keys: Keyframe[], index: number, incoming: boolean): number[] {
  const key = keys[index];
  const interval = incoming ? key.time - keys[Math.max(0, index - 1)].time : keys[Math.min(keys.length - 1, index + 1)].time - key.time;
  const weighted = key.weightedMode & (incoming ? WeightedMode.In : WeightedMode.Out);
  const dx = interval / 3 * (incoming ? -1 : 1) * (weighted ? incoming ? key.inWeight : key.outWeight : 1);

  return [key.time + dx, key.value + dx * (incoming ? key.inSlope : key.outSlope)];
}

function encode (keys: Keyframe[]): spec.BezierValue {
  const data = keys.map((key, index) => {
    const incoming = index > 0 && keys[index - 1].interpolationMode === InterpolationMode.Cubic;
    const outgoing = key.interpolationMode === InterpolationMode.Cubic;
    const point = [key.time, key.value];
    const left = control(keys, index, true), right = control(keys, index, false);

    if (key.interpolationMode === InterpolationMode.Constant) {
      return incoming
        ? [spec.BezierKeyframeType.HOLD, [...left, ...point], spec.BezierKeyframeType.EASE_IN]
        : [spec.BezierKeyframeType.HOLD, point, spec.BezierKeyframeType.LINE];
    }
    if (incoming && outgoing) { return [spec.BezierKeyframeType.EASE, [...left, ...point, ...right]]; }
    if (incoming) { return [spec.BezierKeyframeType.EASE_IN, [...left, ...point]]; }
    if (outgoing) { return [spec.BezierKeyframeType.EASE_OUT, [...point, ...right]]; }

    return [spec.BezierKeyframeType.LINE, point];
  });

  return [spec.ValueType.BEZIER_CURVE, data] as spec.BezierValue;
}

/** Split at the sampled value before changing it, preserving weighted tangents and holds. */
function insert (keys: Keyframe[], time: number, sample: number): number {
  const existing = keys.findIndex(key => Math.abs(key.time - time) <= epsilon);

  if (existing >= 0) { return existing; }
  let index = keys.findIndex(key => key.time > time);
  const key = makeKey(time, sample);

  if (index < 0) { index = keys.length; }
  const left = keys[index - 1], right = keys[index];

  if (left && right) {
    key.interpolationMode = left.interpolationMode;
    if (left.interpolationMode === InterpolationMode.Cubic) {
      const points = [[left.time, left.value], control(keys, index - 1, false), control(keys, index, true), [right.time, right.value]];
      let low = 0, high = 1;

      for (let i = 0; i < 35; i++) {
        const middle = (low + high) / 2;

        if (split(points, middle)[2][0] < time) { low = middle; } else { high = middle; }
      }
      const parts = split(points, (low + high) / 2);
      const set = (target: Keyframe, incoming: boolean, point: number[], interval: number) => {
        const dx = point[0] - target.time;

        target[incoming ? 'inSlope' : 'outSlope'] = Math.abs(dx) < 1e-12 ? 0 : (point[1] - target.value) / dx;
        target[incoming ? 'inWeight' : 'outWeight'] = Math.abs(dx) * 3 / interval;
        target.weightedMode |= incoming ? WeightedMode.In : WeightedMode.Out;
      };

      set(left, false, parts[0], time - left.time);
      set(key, true, parts[1], time - left.time);
      set(key, false, parts[3], right.time - time);
      set(right, true, parts[4], right.time - time);
    }
  } else {
    key.interpolationMode = InterpolationMode.Constant;
    if (left) { left.interpolationMode = InterpolationMode.Constant; }
  }
  keys.splice(index, 0, key);

  return index;
}

function editNumber (expression: spec.FixedNumberExpression | number, time: number, value: number, forceKey = false): spec.FixedNumberExpression | number {
  if (forceKey && (typeof expression === 'number' || expression[0] === spec.ValueType.CONSTANT)) {
    const original = typeof expression === 'number' ? expression : expression[1];

    expression = [spec.ValueType.LINE, [[0, original], [1, original]]];
  }
  if (typeof expression === 'number') { return value; }
  if (expression[0] === spec.ValueType.CONSTANT) { return [spec.ValueType.CONSTANT, value]; }
  if (expression[0] === spec.ValueType.LINE) {
    const points = copy(expression[1]);
    const existing = points.find(point => Math.abs(point[0] - time) <= epsilon);

    if (existing) { existing[1] = value; } else {
      points.push([time, value]); points.sort((a, b) => a[0] - b[0]);
    }

    return [spec.ValueType.LINE, points];
  }
  if (expression[0] !== spec.ValueType.BEZIER_CURVE) { throw new Error('Unsupported numeric animation expression.'); }
  const curve = createValueGetter(expression) as BezierCurve;
  const keys = curve.getKeyFrames();

  if (!keys.length) { throw new Error('Cannot edit an empty animation curve.'); }
  const index = insert(keys, time, curve.getValue(time));

  keys[index].value = value;

  return encode(keys);
}

function editPath (expression: spec.FixedVec3Expression, time: number, value: number[]): spec.FixedVec3Expression {
  let keys: Keyframe[], points: number[][], controls: number[][];

  if (expression[0] === spec.ValueType.BEZIER_CURVE_PATH) {
    keys = (createValueGetter([spec.ValueType.BEZIER_CURVE, expression[1][0]]) as BezierCurve).getKeyFrames();
    points = copy(expression[1][1]); controls = copy(expression[1][2]);
  } else if (expression[0] === spec.ValueType.LINEAR_PATH) {
    const source = expression[1][0];

    points = copy(expression[1][1]); controls = [];
    keys = source.map((key, i) => {
      const result = makeKey(key[0], i), left = source[i - 1], right = source[i + 1];

      result.interpolationMode = InterpolationMode.Cubic;
      result.inSlope = left ? key[1] === left[1] ? 1 / (key[0] - left[0]) : key[2] / (key[1] - left[1]) : 0;
      result.outSlope = right ? right[1] === key[1] ? 1 / (right[0] - key[0]) : key[3] / (right[1] - key[1]) : 0;

      return result;
    });
    for (let i = 0; i + 1 < points.length; i++) { controls.push(lerp(points[i], points[i + 1], 1 / 3), lerp(points[i], points[i + 1], 2 / 3)); }
  } else { throw new Error('Unsupported spatial animation expression.'); }
  if (!keys.length || keys.length !== points.length || controls.length !== (points.length - 1) * 2) {
    throw new Error('Invalid spatial animation curve.');
  }
  let index = keys.findIndex(key => Math.abs(key.time - time) <= epsilon);

  if (index < 0) {
    const timing = new BezierCurve([]);

    timing.setKeyFrames(keys);
    const sample = timing.getValue(time);

    index = keys.findIndex(key => key.time > time);
    if (index < 0) { index = keys.length; }
    if (index > 0 && index < keys.length) {
      const segment = [points[index - 1], controls[index * 2 - 2], controls[index * 2 - 1], points[index]];
      const progress = (sample - keys[index - 1].value) / (keys[index].value - keys[index - 1].value || 1);
      const lengths = [0];
      let previous = segment[0];

      // Match the runtime's distance-based spatial sampling rather than treating progress as t.
      for (let i = 1; i <= 512; i++) {
        const next = split(segment, i / 512)[2];

        lengths.push(lengths[i - 1] + Math.hypot(...next.map((v, axis) => v - previous[axis]))); previous = next;
      }
      const distance = Math.max(0, Math.min(1, progress)) * lengths[512];
      const step = Math.max(1, lengths.findIndex(length => length >= distance));
      const t = (step - 1 + (distance - lengths[step - 1]) / (lengths[step] - lengths[step - 1] || 1)) / 512;
      const parts = split(segment, t);

      points.splice(index, 0, parts[2]);
      controls.splice(index * 2 - 2, 2, parts[0], parts[1], parts[3], parts[4]);
    } else {
      const point = [...points[index === 0 ? 0 : points.length - 1]];

      points.splice(index, 0, point);
      if (index === 0) { controls.unshift([...point], [...point]); } else { controls.push([...point], [...point]); }
    }
    insert(keys, time, sample);
    if (index === 0) { keys[index].value = keys[1].value - 1; }
    if (index === keys.length - 1) { keys[index].value = keys[index - 1].value + 1; }
  }
  const delta = value.map((v, axis) => v - points[index][axis]);

  points[index] = [...value];
  for (const i of [index * 2 - 1, index * 2]) {
    if (controls[i]) { controls[i] = controls[i].map((v, axis) => v + delta[axis]); }
  }

  return [spec.ValueType.BEZIER_CURVE_PATH, [encode(keys)[1], points, controls]] as spec.FixedVec3Expression;
}

/** Keep constants and unchanged channels unless a complete vertex frame is requested. */
function editKeyframeValue (expression: unknown, time: number, value: number | number[], previous: number | number[], forceKey = false): unknown {
  if (typeof value === 'number') { return editNumber(expression as spec.FixedNumberExpression, time, value, forceKey); }
  if (!Array.isArray(expression)) { throw new Error('Invalid vector animation expression.'); }
  const [type, data] = expression;

  if ([spec.ValueType.CONSTANT_VEC2, spec.ValueType.CONSTANT_VEC3, spec.ValueType.CONSTANT_VEC4, spec.ValueType.RGBA_COLOR].includes(type)) {
    if (forceKey) {
      return [value.length === 2 ? spec.ValueType.VECTOR2_CURVE : spec.ValueType.VECTOR3_CURVE,
        value.map((axis, index) => editNumber([spec.ValueType.CONSTANT, data[index]], time, axis, true))];
    }

    return [type, [...value]];
  }
  if ([spec.ValueType.VECTOR2_CURVE, spec.ValueType.VECTOR3_CURVE, spec.ValueType.VECTOR4_CURVE, spec.ValueType.COLOR_CURVE].includes(type)) {
    return [type, data.map((channel: spec.FixedNumberExpression, axis: number) =>
      !forceKey && Math.abs(value[axis] - (previous as number[])[axis]) <= epsilon ? copy(channel) : editNumber(channel, time, value[axis], forceKey))];
  }

  return editPath(expression as spec.FixedVec3Expression, time, value);
}
