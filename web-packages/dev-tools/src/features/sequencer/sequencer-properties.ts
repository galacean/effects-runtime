import type { EffectsObject, TrackAsset, VFXItem } from '@galacean/effects';
import {
  ColorPropertyPlayableAsset, ColorPropertyTrack, FloatPropertyPlayableAsset, FloatPropertyTrack,
  MaskableGraphic, Material, ObjectReferencePropertyPlayableAsset, ObjectReferencePropertyTrack, REFERENCE_CURVE,
  RendererComponent, ShapeComponent, SpriteComponent, Vector2PropertyPlayableAsset, Vector2PropertyTrack,
  Vector3ropertyPlayableAsset, Vector3PropertyTrack, Vector4PropertyPlayableAsset, Vector4PropertyTrack, spec, math,
} from '@galacean/effects';
import { materialProperties } from '../assets/editors/material-details';
import { isPersistentResource } from '../assets/model/resource-identity';
import { propertyLabel } from '../../ui/property-editor/default-object-details';

export type SequencePropertyKind = 'float' | 'color' | 'vector2' | 'vector3' | 'vector4' | 'reference';
export type PropertyClip = FloatPropertyPlayableAsset | ColorPropertyPlayableAsset | Vector2PropertyPlayableAsset | Vector3ropertyPlayableAsset | Vector4PropertyPlayableAsset | ObjectReferencePropertyPlayableAsset;
export interface SequenceProperty {
  label: string,
  groups: string[],
  target: EffectsObject,
  path: string,
  kind: SequencePropertyKind,
  materialIndex?: number,
  minimum?: number,
  maximum?: number,
  integer?: boolean,
  referenceType?: string,
  fallback?: string,
}

export function propertyValue (target: unknown, path: string): unknown {
  for (const key of path.split('.')) {
    if (!target || typeof target !== 'object') { return; }
    target = Reflect.get(target, key);
  }

  return target;
}

export function propertyClipKind (clip: object): SequencePropertyKind | undefined {
  if (clip instanceof FloatPropertyPlayableAsset) { return 'float'; }
  if (clip instanceof ColorPropertyPlayableAsset) { return 'color'; }
  if (clip instanceof Vector2PropertyPlayableAsset) { return 'vector2'; }
  if (clip instanceof Vector3ropertyPlayableAsset) { return 'vector3'; }
  if (clip instanceof Vector4PropertyPlayableAsset) { return 'vector4'; }
  if (clip instanceof ObjectReferencePropertyPlayableAsset) { return 'reference'; }
}

export function createPropertyTrack (property: SequenceProperty): TrackAsset {
  const engine = property.target.engine;
  const constructors = {
    float: FloatPropertyTrack, color: ColorPropertyTrack, vector2: Vector2PropertyTrack,
    vector3: Vector3PropertyTrack, vector4: Vector4PropertyTrack, reference: ObjectReferencePropertyTrack,
  };
  const track = new constructors[property.kind](engine);
  const definition = {
    id: track.getInstanceId(), name: property.label, path: property.path,
    dataType: property.kind === 'reference' ? 'ObjectReferencePropertyTrack' : property.kind === 'float' ? 'FloatPropertyTrack' :
      property.kind === 'color' ? 'ColorPropertyTrack' : 'Vector' + property.kind.at(-1) + 'PropertyTrack',
    clips: [], children: [],
  };

  track.setData(definition as unknown as spec.EffectsObjectData);

  return track;
}

export function createPropertyClip (track: TrackAsset): PropertyClip | undefined {
  if (track instanceof FloatPropertyTrack) { return track.createClip(FloatPropertyPlayableAsset, track.name); }
  if (track instanceof ColorPropertyTrack) { return track.createClip(ColorPropertyPlayableAsset, track.name); }
  if (track instanceof Vector2PropertyTrack) { return track.createClip(Vector2PropertyPlayableAsset, track.name); }
  if (track instanceof Vector3PropertyTrack) { return track.createClip(Vector3ropertyPlayableAsset, track.name); }
  if (track instanceof Vector4PropertyTrack) { return track.createClip(Vector4PropertyPlayableAsset, track.name); }
  if (track instanceof ObjectReferencePropertyTrack) { return track.createClip(ObjectReferencePropertyPlayableAsset, track.name); }
}

export function propertyTrackKind (track: TrackAsset): SequencePropertyKind | undefined {
  if (track instanceof FloatPropertyTrack) { return 'float'; }
  if (track instanceof ColorPropertyTrack) { return 'color'; }
  if (track instanceof Vector2PropertyTrack) { return 'vector2'; }
  if (track instanceof Vector3PropertyTrack) { return 'vector3'; }
  if (track instanceof Vector4PropertyTrack) { return 'vector4'; }
  if (track instanceof ObjectReferencePropertyTrack) { return 'reference'; }
}

export function vectorValues (value: unknown, kind: SequencePropertyKind): number[] {
  const fields = kind === 'color' ? ['r', 'g', 'b', 'a'] : kind === 'vector2' ? ['x', 'y'] : kind === 'vector3' ? ['x', 'y', 'z'] : ['x', 'y', 'z', 'w'];

  return fields.map(key => {
    const number = value && typeof value === 'object' ? Reflect.get(value, key) : undefined;

    return typeof number === 'number' && Number.isFinite(number) ? number : kind === 'color' ? 1 : 0;
  });
}

/** Authorable properties share the same runtime track and curve formats as imported scenes. */
export function sequenceProperties (item: VFXItem): SequenceProperty[] {
  const result: SequenceProperty[] = [];
  const add = (target: EffectsObject, path: string, label: string, groups: string[], kind: SequencePropertyKind = 'float', options: Partial<SequenceProperty> = {}): void => {
    const value = propertyValue(resolvePropertyTarget(target, options.materialIndex), path);

    if (kind === 'float' ? typeof value !== 'number' || !Number.isFinite(value) : kind !== 'reference' && (!value || typeof value !== 'object')) { return; }
    result.push({ target, path, label, groups, kind, ...options });
  };

  for (const component of item.components) {
    if (component instanceof MaskableGraphic) {
      for (const [index, axis] of ['r', 'g', 'b'].entries()) {
        add(component, 'colors._Color.' + axis, ['Red', 'Green', 'Blue'][index], ['Color'], 'float', { materialIndex: 0, minimum: 0, maximum: 1 });
      }
    }
    if (component instanceof SpriteComponent) { add(component, 'sprite', 'Sprite', ['Sprite'], 'reference', { referenceType: 'Sprite' }); }
    if (component instanceof ShapeComponent) {
      const shape = component.shape as unknown as Record<string, unknown>;

      for (const key of ['width', 'height', 'roundness', 'xRadius', 'yRadius', 'pointCount', 'radius', 'innerRadius', 'outerRadius', 'innerRoundness', 'outerRoundness']) {
        if (typeof shape[key] === 'number') { add(component, 'shape.' + key, propertyLabel(key), ['Shape'], 'float', { minimum: key === 'pointCount' ? 3 : 0, integer: key === 'pointCount' }); }
      }
      add(component, 'strokeWidth', 'Stroke Width', ['Shape'], 'float', { minimum: 0 });
      for (const name of ['points', 'easingIns', 'easingOuts']) {
        const points = shape[name];

        if (Array.isArray(points)) { points.forEach((_point, index) => add(component, 'shape.' + name + '.' + index, 'Point ' + (index + 1), ['Shape', propertyLabel(name)], 'vector2')); }
      }
      for (const name of ['fillTrimPath', 'strokeTrimPath']) {
        for (const field of ['start', 'end', 'offset']) { add(component, name + '.' + field, propertyLabel(field), ['Shape', propertyLabel(name)], 'float', field === 'offset' ? {} : { minimum: 0, maximum: 1 }); }
      }
      for (const name of ['fills', 'strokes']) {
        const paints = Reflect.get(component, name) as { type: spec.FillType, gradientStops?: { stops: unknown[] } }[];

        paints.forEach((paint, index) => {
          const prefix = name + '.' + index, groups = ['Shape', name === 'fills' ? 'Fill' : 'Stroke', 'Element ' + (index + 1)];

          if (paint.type === spec.FillType.Solid) { add(component, prefix + '.color', 'Color', groups, 'color', { minimum: 0, maximum: 1 }); } else if (paint.gradientStops) {
            add(component, prefix + '.startPoint', 'Start Point', groups, 'vector2', { minimum: 0, maximum: 1 });
            add(component, prefix + '.endPoint', 'End Point', groups, 'vector2', { minimum: 0, maximum: 1 });
            paint.gradientStops.stops.forEach((_stop, stop) => {
              add(component, prefix + '.gradientStops.stops.' + stop + '.color', 'Color ' + (stop + 1), [...groups, 'Gradient Stops'], 'color', { minimum: 0, maximum: 1 });
            });
          }
        });
      }
    }
    if (component.definition.dataType === 'FFDComponent') {
      const points = Reflect.get(component, 'controlPoints') as unknown[] | undefined;

      points?.forEach((_point, index) => add(component, 'controlPoints.' + index, 'Point ' + (index + 1), ['FFD', 'Control Points'], 'vector3'));
    }
    if (component instanceof RendererComponent) {
      component.materials.forEach((material, materialIndex) => {
        if (!isPersistentResource(material, component.engine, 'material')) { return; }
        const properties = materialProperties(material.shader?.shaderData.properties, material.definition);
        const groups = ['Materials', material.name || 'Element ' + (materialIndex + 1)];

        for (const property of properties) {
          if (property.toggle || component instanceof MaskableGraphic && property.name === '_Color') { continue; }
          const kind = property.type === 'Color' ? 'color' : property.type === 'Vector' ? 'vector4' : property.type === '2D' ? 'reference' :
            property.type === 'Int' || property.type === 'Float' ? 'float' : undefined;

          if (!kind) { continue; }
          const field = property.type === 'Int' ? 'ints' : kind === 'color' ? 'colors' : kind === 'vector4' ? 'vector4s' : kind === 'reference' ? 'textures' : 'floats';

          result.push({ target: component, path: field + '.' + property.name, label: property.label, groups, kind, materialIndex,
            minimum: property.range?.[0] ?? (kind === 'color' ? 0 : undefined), maximum: property.range?.[1] ?? (kind === 'color' && !property.hdr ? 1 : undefined), integer: property.type === 'Int', referenceType: kind === 'reference' ? 'Texture' : undefined, fallback: property.fallback });
        }
      });
    }
  }

  return result;
}

export function resolvePropertyTarget (target: EffectsObject, materialIndex?: number): object | undefined {
  return materialIndex === undefined ? target : target instanceof RendererComponent ? target.materials[materialIndex] : undefined;
}

/** Initialize a shader default only when its property is explicitly added to the timeline. */
export function initializeProperty (property: SequenceProperty): void {
  const target = resolvePropertyTarget(property.target, property.materialIndex);

  if (!(target instanceof Material) || propertyValue(target, property.path) !== undefined) { return; }
  const name = property.path.slice(property.path.indexOf('.') + 1);
  const components = property.fallback?.match(/^\s*\(([^)]+)\)/)?.[1].split(',').map(Number);
  const vector = components?.length === 4 && components.every(Number.isFinite) ? components : property.kind === 'color' ? [1, 1, 1, 1] : [0, 0, 0, 0];

  if (property.kind === 'float') {
    const value = Number(property.fallback) || 0;

    if (property.integer) { target.setInt(name, Math.round(value)); } else { target.setFloat(name, value); }
  } else if (property.kind === 'color') {
    target.setColor(name, new math.Color(...vector as spec.vec4));
  } else if (property.kind === 'vector4') {
    target.setVector4(name, new math.Vector4(...vector as spec.vec4));
  } else if (property.kind === 'reference') {
    target.setTexture(name, target.engine.assetServer.whiteTexture);
  }
}

export function initialPropertyCurve (kind: SequencePropertyKind, value: unknown): unknown {
  if (kind === 'reference') { return [REFERENCE_CURVE, value && typeof value === 'object' && 'getInstanceId' in value ? [[0, { id: (value as EffectsObject).getInstanceId() }]] : []]; }
  if (kind === 'float') { return [spec.ValueType.CONSTANT, typeof value === 'number' ? value : 0]; }
  const types = { color: spec.ValueType.COLOR_CURVE, vector2: spec.ValueType.VECTOR2_CURVE, vector3: spec.ValueType.VECTOR3_CURVE, vector4: spec.ValueType.VECTOR4_CURVE };

  return [types[kind], vectorValues(value, kind).map(number => [spec.ValueType.CONSTANT, number])];
}
