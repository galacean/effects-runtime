import { math, spec, Texture } from '@galacean/effects';
import type { ShapeComponent } from '@galacean/effects';
import type { PropertyGroup } from '../../../ui/property-editor/property-sheet';
import type { Data } from '../../scene/serialization/scene-values';
import { readShapeComponentData, applyShapeComponentData } from '../../scene/serialization/shape-component-data';

const shapeDataCache = new WeakMap<ShapeComponent, { definition: object, shape: object, enabled: boolean, data: Data }>();

/** Share one snapshot across synchronous field refreshes, expiring before the next UI task. */
export function readShapeData (component: ShapeComponent): Data {
  const cached = shapeDataCache.get(component);

  if (cached?.definition === component.definition && cached.shape === component.shape && cached.enabled === component.enabled) { return cached.data; }
  const snapshot = { definition: component.definition, shape: component.shape, enabled: component.enabled, data: readShapeComponentData(component) };

  shapeDataCache.set(component, snapshot);
  queueMicrotask(() => { if (shapeDataCache.get(component) === snapshot) { shapeDataCache.delete(component); } });

  return snapshot.data;
}

export function editShapeData (component: ShapeComponent, update: (data: Data) => void): void {
  const data = readShapeComponentData(component);

  update(data); applyShapeComponentData(component, data); shapeDataCache.delete(component);
}

export function shapeCollectionActions (
  group: PropertyGroup,
  actions: { label: string, enabled?: boolean, action(): void }[],
  rebuild: () => void,
): void {
  group.actions = owner => actions.map(action => ({ ...action, action: () => {
    group.sheet.edit.change(action.label, owner, action.action); group.sheet.edit.finish(owner); rebuild(); group.sheet.filter(group.sheet.query);
  } }));
}

export function addShapeCollectionItem (group: PropertyGroup, title: string, action: () => void, rebuild: () => void): void {
  group.button(' ', title, button => {
    group.sheet.edit.change(title, button, action); group.sheet.edit.finish(button); rebuild(); group.sheet.filter(group.sheet.query);
  });
}

function makePaint (type: spec.FillType, previous: Data = {}): Data {
  if (type === spec.FillType.Solid) {
    return { type, color: previous.color ?? { r: 1, g: 1, b: 1, a: 1 } };
  }
  if (type === spec.FillType.Texture) {
    return { type, scaleMode: spec.TexturePaintScaleMode.Fill, scalingFactor: 1, opacity: 1,
      textureTransform: { offset: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 } };
  }

  return { type, startPoint: previous.startPoint ?? { x: 0, y: 0 }, endPoint: previous.endPoint ?? { x: 1, y: 0 },
    gradientStops: previous.gradientStops ?? [spec.ValueType.GRADIENT_COLOR, [[0, 1, 1, 1, 1], [1, 0, 0, 0, 1]]] };
}

export function buildShapePaints (parent: PropertyGroup, component: ShapeComponent, key: 'fills' | 'strokes'): void {
  parent.clear();
  const name = key === 'fills' ? 'Fill' : 'Stroke';
  const read = (): Data[] => readShapeData(component)[key];
  const edit = (update: (paints: Data[]) => void): void => editShapeData(component, data => update(data[key]));
  const rebuild = (): void => buildShapePaints(parent, component, key);

  read().forEach((_, index) => {
    const group = parent.group(String(index), `${name} ${index + 1}`, index === 0);
    const paint = (): Data => read()[index];
    const update = (change: (paint: Data) => void): void => edit(paints => change(paints[index]));

    shapeCollectionActions(group, [
      { label: 'Move Up', enabled: index > 0, action: () => edit(paints => { [paints[index - 1], paints[index]] = [paints[index], paints[index - 1]]; }) },
      { label: 'Move Down', enabled: index < read().length - 1, action: () => edit(paints => { [paints[index], paints[index + 1]] = [paints[index + 1], paints[index]]; }) },
      { label: 'Duplicate ' + name, action: () => edit(paints => paints.splice(index + 1, 0, structuredClone(paints[index]))) },
      { label: 'Remove ' + name, action: () => edit(paints => paints.splice(index, 1)) },
    ], rebuild);
    group.choice('Type', { read: () => paint().type, write: type => {
      if (paint().type === type) { return; }
      edit(paints => { paints[index] = makePaint(type, paints[index]); }); rebuild();
    } }, ['Solid', 'Linear Gradient', 'Radial Gradient', 'Angular Gradient', 'Texture']);
    if (paint().type === spec.FillType.Solid) {
      group.color('Color', { read: () => new math.Color().copyFrom(paint().color), write: color => update(value => { value.color = { r: color.r, g: color.g, b: color.b, a: color.a }; }) });
    } else if (paint().type === spec.FillType.Texture) {
      group.reference('Texture', { read: () => paint().texture ? component.findObject<Texture>(paint().texture) : null,
        write: texture => update(value => { if (texture instanceof Texture) { value.texture = { id: texture.getInstanceId() }; } else { delete value.texture; } }) }, 'Texture');
      group.choice('Scale Mode', { read: () => paint().scaleMode, write: value => update(paint => { paint.scaleMode = value; }) }, ['Fill', 'Fit', 'Crop', 'Tile']);
      group.number('Scale Factor', { read: () => paint().scalingFactor, write: value => update(paint => { paint.scalingFactor = value; }) }, { step: .01, min: .001, precision: 3 });
      group.number('Opacity', { read: () => paint().opacity, write: value => update(paint => { paint.opacity = value; }) }, { step: .01, min: 0, max: 1, precision: 2 });
      for (const key of ['offset', 'scale'] as const) {
        group.vector(key === 'offset' ? 'Offset' : 'Scale', { read: () => {
          const value = paint().textureTransform[key];

          return [value.x, value.y];
        },
        write: values => update(paint => { paint.textureTransform[key] = { x: values[0], y: values[1] }; }) }, 2);
      }
      group.number('Rotation', { read: () => paint().textureTransform.rotation * 180 / Math.PI,
        write: degrees => update(paint => { paint.textureTransform.rotation = degrees * Math.PI / 180; }) }, { step: 1, suffix: '°', precision: 1 });
    } else {
      for (const key of ['startPoint', 'endPoint'] as const) {
        group.vector(key === 'startPoint' ? 'Start Point' : 'End Point', { read: () => [paint()[key].x, paint()[key].y],
          write: values => update(paint => { paint[key] = { x: values[0], y: values[1] }; }) }, 2);
      }
      const stops = group.group('Stops', 'Color Stops');

      (paint().gradientStops[1] as number[][]).forEach((_, stopIndex) => {
        const stop = stops.group(String(stopIndex), 'Stop ' + (stopIndex + 1));
        const readStop = (): number[] => paint().gradientStops[1][stopIndex];

        stop.number('Position', { read: () => readStop()[0], write: value => update(paint => {
          const stops = paint.gradientStops[1] as number[][];

          stops[stopIndex][0] = Math.max(stops[stopIndex - 1]?.[0] ?? 0, Math.min(stops[stopIndex + 1]?.[0] ?? 1, value));
        }) }, { step: .01, min: 0, max: 1, precision: 3 });
        stop.color('Color', { read: () => new math.Color(readStop()[1], readStop()[2], readStop()[3], readStop()[4]),
          write: color => update(paint => { paint.gradientStops[1][stopIndex] = [readStop()[0], color.r, color.g, color.b, color.a]; }) });
        shapeCollectionActions(stop, [{ label: 'Remove Stop', enabled: paint().gradientStops[1].length > 2,
          action: () => update(paint => paint.gradientStops[1].splice(stopIndex, 1)) }], rebuild);
      });
      stops.button(' ', 'Add Color Stop', button => {
        stops.sheet.edit.change('Add Color Stop', button, () => update(paint => {
          const values = paint.gradientStops[1] as number[][];
          let at = 0;

          for (let i = 1; i < values.length - 1; i++) {
            if (values[i + 1][0] - values[i][0] > values[at + 1][0] - values[at][0]) { at = i; }
          }
          values.splice(at + 1, 0, values[at].map((value, channel) => (value + values[at + 1][channel]) / 2));
        }));
        stops.sheet.edit.finish(button); rebuild();
      }, undefined, { enabled: () => paint().gradientStops[1].length < 8 });
    }
  });
  if (!read().length) { parent.readOnly('Layers', () => 'None'); }
  addShapeCollectionItem(parent, 'Add ' + name, () => edit(paints => paints.push(makePaint(spec.FillType.Solid))), rebuild);
}
