import type { ShapeComponent, VariableWidthPoint } from '@galacean/effects';
import type { PropertyGroup } from '../../../ui/property-editor/property-sheet';
import { STROKE_WIDTH_PRESETS as PRESETS } from '../../scene/factories/stroke-width-presets';
import { addShapeCollectionItem, editShapeData, readShapeData, shapeCollectionActions } from './shape-paint-details';

function presetIndex (points: VariableWidthPoint[]): number {
  const index = PRESETS.findIndex(preset => preset.points.length === points.length && points.every((point, i) => {
    const reference = preset.points[i];

    return point.segmentId === undefined && point.position === reference.position && point.ascent === reference.ascent && point.descent === reference.descent;
  }));

  return index === -1 ? PRESETS.length : index;
}

/** Edit both sides of the width profile and optional contour bindings. */
export function buildShapeWidthProfile (group: PropertyGroup, component: ShapeComponent): void {
  group.clear();
  const read = (): VariableWidthPoint[] => readShapeData(component).variableWidthPoints as VariableWidthPoint[];
  const edit = (update: (points: VariableWidthPoint[]) => void): void => editShapeData(component, data => update(data.variableWidthPoints as VariableWidthPoint[]));
  const rebuild = (): void => buildShapeWidthProfile(group, component);

  group.choice('Preset', { read: () => presetIndex(read()), write: index => {
    if (index === presetIndex(read())) { return; }
    editShapeData(component, data => {
      data.variableWidthPoints = index < PRESETS.length ? structuredClone(PRESETS[index].points)
        : [0, .5, 1].map(position => ({ position, ascent: .5, descent: .5 }));
    });
    rebuild(); group.sheet.filter(group.sheet.query);
  } }, [...PRESETS.map(preset => preset.name), 'Custom']);
  shapeCollectionActions(group, [
    { label: 'Sort Width Points', action: () => edit(points => points.sort((a, b) => a.position - b.position)) },
    { label: 'Reset Width Profile', action: () => edit(points => points.splice(0)) },
  ], rebuild);
  addShapeCollectionItem(group, 'Reverse Profile', () => edit(points => {
    points.forEach(point => { point.position = 1 - point.position; }); points.reverse();
  }), rebuild);
  const controls = group.group('Points', 'Width Points', false);

  controls.readOnly('Count', () => String(read().length));
  read().forEach((_, index) => {
    const point = controls.group(String(index), 'Width Point ' + (index + 1), false);
    const value = (): VariableWidthPoint => read()[index];
    const update = (change: (point: VariableWidthPoint) => void): void => edit(points => change(points[index]));

    point.number('Position', { read: () => value().position, write: position => update(point => { point.position = position; }) },
      { step: .01, precision: 3, min: 0, max: 1 }, { tooltip: 'Normalized distance along the original contour, from 0 to 1.' });
    for (const [key, title] of [['ascent', 'Ascent'], ['descent', 'Descent']] as const) {
      point.number(title, { read: () => value()[key], write: width => update(point => { point[key] = width; }) },
        { step: .05, precision: 3, min: 0, suffix: '×' }, { tooltip: 'Width on this side of the path, multiplied by the base stroke width.' });
    }
    const bound = (): boolean => value().segmentId !== undefined;

    point.boolean('Bind to Contour', { read: bound, write: enabled => update(point => {
      if (enabled) { point.segmentId = 0; } else { delete point.segmentId; }
    }) });
    point.number('Segment ID', { read: () => value().segmentId ?? 0,
      write: id => update(point => { if (bound()) { point.segmentId = Math.round(id); } }) },
    { step: 1, precision: 0, min: 0 }, { enabled: bound, tooltip: 'Apply to the contour containing this path segment. Segment indices start at 0 across all paths.' });
    shapeCollectionActions(point, [
      { label: 'Duplicate Width Point', action: () => edit(points => points.splice(index + 1, 0, { ...points[index] })) },
      { label: 'Remove Width Point', action: () => edit(points => points.splice(index, 1)) },
    ], rebuild);
  });
  addShapeCollectionItem(controls, 'Add Width Point', () => edit(points => {
    const sorted = [{ position: 0, ascent: .5, descent: .5 }, ...points, { position: 1, ascent: .5, descent: .5 }].sort((a, b) => a.position - b.position);
    let index = 0;

    for (let i = 1; i < sorted.length - 1; i++) {
      if (sorted[i + 1].position - sorted[i].position > sorted[index + 1].position - sorted[index].position) { index = i; }
    }
    const a = sorted[index], b = sorted[index + 1];

    points.push({ position: (a.position + b.position) / 2, ascent: (a.ascent + b.ascent) / 2, descent: (a.descent + b.descent) / 2 });
    points.sort((a, b) => a.position - b.position);
  }), rebuild);
}
