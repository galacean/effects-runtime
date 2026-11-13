import { ShapeComponent, RendererComponent, Texture, TrimPathMode, spec } from '@galacean/effects';
import type { VFXItem } from '@galacean/effects';
import { detailsCustomization } from '../../../framework/registry/editor-registry';
import { DefaultObjectDetails } from '../../../ui/property-editor/default-object-details';
import type { NumberOptions, PropertyGroup } from '../../../ui/property-editor/property-sheet';
import type { Data } from '../../scene/serialization/scene-values';
import { addShapeCollectionItem, buildShapePaints, editShapeData, readShapeData, shapeCollectionActions } from './shape-paint-details';
import { buildShapeWidthProfile } from './shape-width-details';

const SHAPES = [spec.ShapePrimitiveType.Rectangle, spec.ShapePrimitiveType.Ellipse, spec.ShapePrimitiveType.Polygon, spec.ShapePrimitiveType.Star, spec.ShapePrimitiveType.Custom];
const BLENDING = [spec.BlendingMode.ALPHA, spec.BlendingMode.ADD, spec.BlendingMode.MULTIPLY, spec.BlendingMode.BRIGHTNESS,
  spec.BlendingMode.SUBTRACTION, spec.BlendingMode.STRONG_LIGHT, spec.BlendingMode.WEAK_LIGHT, spec.BlendingMode.SUPERPOSITION];
const SIDES = [spec.SideMode.DOUBLE, spec.SideMode.FRONT, spec.SideMode.BACK];
const ALIGNMENT = [0.5, 1, 0];
const DEFAULT_TRANSFORM = { position: { x: 0, y: 0, z: 0 }, eulerHint: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
  size: { x: 1, y: 1 }, anchor: { x: 0, y: 0 } };

function defaultGeometry (type: spec.ShapePrimitiveType): Data {
  switch (type) {
    case spec.ShapePrimitiveType.Ellipse: return { type, xRadius: .5, yRadius: .5 };
    case spec.ShapePrimitiveType.Polygon: return { type, pointCount: 5, radius: .5, roundness: 0 };
    case spec.ShapePrimitiveType.Star: return { type, pointCount: 5, outerRadius: .5, innerRadius: .25, outerRoundness: 0, innerRoundness: 0 };
    case spec.ShapePrimitiveType.Custom: return { type, points: [{ x: -.5, y: -.5 }, { x: .5, y: -.5 }, { x: .5, y: .5 }, { x: -.5, y: .5 }],
      easingIns: Array.from({ length: 4 }, () => ({ x: 0, y: 0 })), easingOuts: Array.from({ length: 4 }, () => ({ x: 0, y: 0 })),
      shapes: [{ close: true, indexes: Array.from({ length: 4 }, (_, point) => ({ point, easingIn: point, easingOut: point })) }] };
    default: return { type, width: 1, height: 1, roundness: 0 };
  }
}

@detailsCustomization(ShapeComponent)
export class ShapeDetailsCustomization extends DefaultObjectDetails {
  override getSearchTerms (): string[] {
    return ['Geometry', 'Type', 'Rectangle', 'Ellipse', 'Polygon', 'Star', 'Custom', 'Width', 'Height', 'Radius', 'Roundness', 'Point Count',
      'Points', 'Incoming Handles', 'Outgoing Handles', 'Paths', 'Closed', 'Anchor', 'Transform', 'Position', 'Rotation', 'Scale', 'Size',
      'Fills', 'Stroke', 'Paints', 'Color', 'Linear Gradient', 'Radial Gradient', 'Angular Gradient', 'Texture', 'Stops', 'Opacity',
      'Start Point', 'End Point', 'Scale Mode', 'Scale Factor', 'Alignment', 'Cap', 'Join', 'Miter Limit', 'Effects',
      'Width Profile', 'Width Points', 'Preset', 'Uniform', 'Wedge', 'Taper', 'Eye', 'Ascent', 'Descent', 'Segment ID', 'Bind to Contour',
      'Fill Trim Path', 'Stroke Trim Path', 'Enabled', 'Mode', 'Start', 'End', 'Offset', 'Rendering', 'Blending', 'Side',
      'Depth Write', 'Transparent Occlusion', 'Render Order', 'Mask', 'Is Mask', 'Alpha Mask', 'References', 'Inverted'];
  }

  override build (group: PropertyGroup): void {
    const component = this.target as ShapeComponent;
    const geometry = group.group('Geometry', 'Geometry');

    this.buildGeometry(geometry, component);
    buildShapePaints(group.group('Fills', 'Fills'), component, 'fills');
    const stroke = group.group('Stroke', 'Stroke');
    const canAlignStroke = (): boolean => {
      const data = this.read(component);

      return data.type !== spec.ShapePrimitiveType.Custom || data.shapes.some((path: Data) => path.close && path.indexes.length > 1);
    };

    this.number(stroke, component, 'Width', 'strokeWidth', { min: 0 }, 1);
    stroke.choice('Alignment', { read: () => canAlignStroke() ? Math.max(0, ALIGNMENT.indexOf(this.read(component).strokeAlignment)) : 0,
      write: index => { if (canAlignStroke()) { editShapeData(component, data => { data.strokeAlignment = ALIGNMENT[index]; }); } } },
    ['Center', 'Inside', 'Outside'], { enabled: canAlignStroke });
    stroke.choice('Cap', { read: () => this.read(component).strokeCap,
      write: value => editShapeData(component, data => { data.strokeCap = value; }) }, ['Butt', 'Round', 'Square']);
    stroke.choice('Join', { read: () => this.read(component).strokeJoin,
      write: value => editShapeData(component, data => { data.strokeJoin = value; }) }, ['Round', 'Bevel', 'Miter']);
    this.number(stroke, component, 'Miter Limit', 'strokeMiterLimit', { min: 1, step: .1, precision: 1 }, 10);
    buildShapeWidthProfile(stroke.group('WidthProfile', 'Width Profile'), component);
    buildShapePaints(stroke.group('Paints', 'Paints'), component, 'strokes');
    const effects = group.group('Effects', 'Effects', false);

    this.buildTrimPath(effects.group('FillTrim', 'Fill Trim Path', false), component, 'fillTrimPath');
    this.buildTrimPath(effects.group('StrokeTrim', 'Stroke Trim Path', false), component, 'strokeTrimPath');
    this.buildRenderer(group.group('Rendering', 'Rendering', false), component);
    this.buildMask(group.group('Mask', 'Mask', false), component);
  }

  private read (component: ShapeComponent): Data { return readShapeData(component); }

  private number (group: PropertyGroup, component: ShapeComponent, title: string, key: string, options: NumberOptions = {}, fallback = 0): void {
    group.number(title, { read: () => this.read(component)[key] ?? fallback,
      write: value => editShapeData(component, data => { data[key] = value; }) }, { step: .01, precision: 3, ...options });
  }

  private buildGeometry (group: PropertyGroup, component: ShapeComponent): void {
    group.clear();
    group.choice('Type', { read: () => Math.max(0, SHAPES.indexOf(this.read(component).type)), write: index => {
      if (this.read(component).type === SHAPES[index]) { return; }
      editShapeData(component, data => {
        for (const key of Object.keys(component.shape)) { if (key !== 'transform') { delete data[key]; } }
        Object.assign(data, defaultGeometry(SHAPES[index]));
      }); this.buildGeometry(group, component); group.sheet.filter(group.sheet.query);
    } }, ['Rectangle', 'Ellipse', 'Polygon', 'Star', 'Custom Path']);
    switch (this.read(component).type) {
      case spec.ShapePrimitiveType.Rectangle:
        this.number(group, component, 'Width', 'width', { min: 0 });
        this.number(group, component, 'Height', 'height', { min: 0 });
        this.number(group, component, 'Roundness', 'roundness', { min: 0, max: 100, suffix: '%' });

        break;
      case spec.ShapePrimitiveType.Ellipse:
        this.number(group, component, 'X Radius', 'xRadius', { min: 0 });
        this.number(group, component, 'Y Radius', 'yRadius', { min: 0 });

        break;
      case spec.ShapePrimitiveType.Polygon:
        this.number(group, component, 'Point Count', 'pointCount', { min: 3, step: 1, precision: 0 });
        this.number(group, component, 'Radius', 'radius', { min: 0 });
        this.number(group, component, 'Roundness', 'roundness', { min: 0, max: 100, suffix: '%' });

        break;
      case spec.ShapePrimitiveType.Star:
        this.number(group, component, 'Point Count', 'pointCount', { min: 2, step: 1, precision: 0 });
        this.number(group, component, 'Outer Radius', 'outerRadius', { min: 0 });
        this.number(group, component, 'Inner Radius', 'innerRadius', { min: 0 });
        this.number(group, component, 'Outer Roundness', 'outerRoundness', { min: 0, max: 100, suffix: '%' });
        this.number(group, component, 'Inner Roundness', 'innerRoundness', { min: 0, max: 100, suffix: '%' });

        break;
      case spec.ShapePrimitiveType.Custom:
        this.buildCustomGeometry(group.group('Custom', 'Path Geometry'), component);

        break;
    }
    this.buildTransform(group.group('Transform', 'Geometry Transform', false), () => this.read(component).transform,
      value => editShapeData(component, data => { if (value) { data.transform = value; } else { delete data.transform; } }));
  }

  private buildCustomGeometry (group: PropertyGroup, component: ShapeComponent): void {
    group.clear();
    const rebuild = (): void => this.buildCustomGeometry(group, component);

    for (const [key, title] of [['points', 'Points'], ['easingIns', 'Incoming Handles'], ['easingOuts', 'Outgoing Handles']] as const) {
      const vectors = group.group(key, title, false);
      const read = (): Data[] => this.read(component)[key];

      read().forEach((_, index) => {
        const point = vectors.group(String(index), 'Index ' + index);

        point.vector('Position', { read: () => [read()[index].x, read()[index].y],
          write: values => editShapeData(component, data => { data[key][index] = { x: values[0], y: values[1] }; }) }, 2);
        shapeCollectionActions(point, [{ label: 'Remove ' + title, action: () => editShapeData(component, data => {
          data[key].splice(index, 1);
          const field = key === 'points' ? 'point' : key === 'easingIns' ? 'easingIn' : 'easingOut';

          for (const path of data.shapes) {
            if (field === 'point') { path.indexes = path.indexes.filter((node: Data) => node.point !== index); }
            for (const node of path.indexes) {
              if (node[field] > index) { node[field]--; } else if (node[field] === index) { node[field] = Math.max(0, Math.min(index, data[key].length - 1)); }
            }
          }
        }) }], rebuild);
      });
      addShapeCollectionItem(vectors, 'Add ' + (key === 'points' ? 'Point' : 'Handle'), () => editShapeData(component, data => data[key].push({ x: 0, y: 0 })), rebuild);
    }
    const paths = group.group('Paths', 'Paths');

    (this.read(component).shapes as Data[]).forEach((_, index) => {
      const path = paths.group(String(index), 'Path ' + (index + 1));
      const read = (): Data => this.read(component).shapes[index];
      const edit = (update: (path: Data) => void): void => editShapeData(component, data => update(data.shapes[index]));

      path.boolean('Closed', { read: () => read().close, write: value => edit(path => { path.close = value; }) });
      shapeCollectionActions(path, [{ label: 'Remove Path', action: () => editShapeData(component, data => data.shapes.splice(index, 1)) }], rebuild);
      (read().indexes as Data[]).forEach((_, vertex) => {
        const node = path.group('Vertex' + vertex, 'Vertex ' + (vertex + 1), false);

        for (const [key, label, source] of [['point', 'Anchor', 'points'], ['easingIn', 'Incoming Handle', 'easingIns'], ['easingOut', 'Outgoing Handle', 'easingOuts']] as const) {
          node.number(label, { read: () => read().indexes[vertex][key], write: value => edit(path => { path.indexes[vertex][key] = Math.round(value); }) },
            { min: 0, max: Math.max(0, this.read(component)[source].length - 1), step: 1, precision: 0 });
        }
        shapeCollectionActions(node, [{ label: 'Remove Vertex', action: () => edit(path => path.indexes.splice(vertex, 1)) }], rebuild);
      });
      addShapeCollectionItem(path, 'Add Vertex', () => edit(path => path.indexes.push({ point: 0, easingIn: 0, easingOut: 0 })), rebuild);
      this.buildTransform(path.group('Transform', 'Path Transform', false), () => read().transform,
        value => edit(path => { if (value) { path.transform = value; } else { delete path.transform; } }));
    });
    addShapeCollectionItem(paths, 'Add Path', () => editShapeData(component, data => data.shapes.push({ close: false, indexes: [] })), rebuild);
  }

  private buildTransform (group: PropertyGroup, read: () => Data | undefined, write: (value: Data | undefined) => void): void {
    group.boolean('Enabled', { read: () => !!read(), write: value => write(value ? structuredClone(DEFAULT_TRANSFORM) : undefined) });
    for (const [key, label, count] of [['position', 'Position', 3], ['eulerHint', 'Rotation', 3], ['scale', 'Scale', 3], ['size', 'Size', 2], ['anchor', 'Anchor', 2]] as const) {
      group.vector(label, { read: () => {
        const value = read()?.[key] ?? DEFAULT_TRANSFORM[key];

        return [value.x, value.y, 'z' in value ? value.z : 0].slice(0, count);
      },
      write: values => {
        const value = read();

        if (value) { value[key] = count === 3 ? { x: values[0], y: values[1], z: values[2] } : { x: values[0], y: values[1] }; write(value); }
      } }, count, { enabled: () => !!read() });
    }
  }

  private buildTrimPath (group: PropertyGroup, component: ShapeComponent, key: 'fillTrimPath' | 'strokeTrimPath'): void {
    const read = (): Data | undefined => this.read(component)[key];
    const enabled = (): boolean => !!read();

    group.boolean('Enabled', { read: enabled, write: value => editShapeData(component, data => {
      if (value) { data[key] = { start: 0, end: 1, offset: 0, mode: TrimPathMode.Synchronized }; } else { delete data[key]; }
    }) });
    group.choice('Mode', { read: () => read()?.mode ?? TrimPathMode.Synchronized, write: value => editShapeData(component, data => { data[key].mode = value; }) },
      ['Synchronized', 'Sequential'], { enabled });
    for (const [label, property] of [['Start', 'start'], ['End', 'end'], ['Offset', 'offset']] as const) {
      group.number(label, { read: () => read()?.[property] ?? (property === 'end' ? 1 : 0),
        write: value => editShapeData(component, data => { data[key][property] = value; }) },
      { step: .01, min: property === 'offset' ? -10 : 0, max: property === 'offset' ? 10 : 1, precision: 3 }, { enabled });
    }
  }

  private buildRenderer (group: PropertyGroup, component: ShapeComponent): void {
    const read = (): Data => this.read(component).renderer;
    const edit = (update: (renderer: Data) => void): void => editShapeData(component, data => update(data.renderer));

    group.choice('Blending', { read: () => Math.max(0, BLENDING.indexOf(read().blending)), write: index => edit(renderer => { renderer.blending = BLENDING[index]; }) },
      ['Alpha', 'Add', 'Multiply', 'Brightness', 'Subtract', 'Strong Light', 'Weak Light', 'Superposition']);
    group.choice('Side', { read: () => Math.max(0, SIDES.indexOf(read().side)), write: index => edit(renderer => { renderer.side = SIDES[index]; }) }, ['Double', 'Front', 'Back']);
    group.boolean('Depth Write', { read: () => read().occlusion, write: value => edit(renderer => { renderer.occlusion = value; }) });
    group.boolean('Transparent Occlusion', { read: () => read().transparentOcclusion, write: value => edit(renderer => { renderer.transparentOcclusion = value; }) });
    group.reference('Texture', { read: () => read().texture ? component.findObject<Texture>(read().texture) : null,
      write: texture => edit(renderer => { if (texture instanceof Texture) { renderer.texture = { id: texture.getInstanceId() }; } else { delete renderer.texture; } }) }, 'Texture');
    this.buildRenderingProperties(group);
  }

  private buildMask (group: PropertyGroup, component: ShapeComponent): void {
    group.clear();
    const read = (): Data => this.read(component).mask;
    const edit = (update: (mask: Data) => void): void => editShapeData(component, data => update(data.mask));
    const rebuild = (): void => this.buildMask(group, component);

    group.boolean('Is Mask', { read: () => read().isMask, write: value => edit(mask => { mask.isMask = value; }) });
    group.boolean('Alpha Mask', { read: () => read().alphaMaskEnabled, write: value => edit(mask => { mask.alphaMaskEnabled = value; }) });
    const references = group.group('References', 'References');
    const candidates: { component: RendererComponent, label: string }[] = [];
    const visit = (item: VFXItem, path: string): void => {
      const label = path ? path + ' / ' + item.name : item.name;

      for (const renderer of item.components) {
        if (renderer instanceof RendererComponent && renderer !== component) {
          candidates.push({ component: renderer, label: label + ' (' + renderer.constructor.name + ')' });
        }
      }
      item.children.forEach(child => visit(child, label));
    };
    const root = component.item.composition?.sceneRoot;

    if (root) { visit(root, ''); }

    (read().references as Data[]).forEach((_, index) => {
      const reference = references.group(String(index), 'Mask ' + (index + 1));
      const value = (): Data => read().references[index];

      reference.choice('Mask', { read: () => candidates.findIndex(candidate => candidate.component === (value().mask ? component.findObject(value().mask) : null)) + 1,
        write: selected => edit(mask => {
          if (selected) { mask.references[index].mask = { id: candidates[selected - 1].component.getInstanceId() }; } else { delete mask.references[index].mask; }
        }) }, ['None', ...candidates.map(candidate => candidate.label)]);
      reference.boolean('Inverted', { read: () => value().inverted ?? false, write: value => edit(mask => { mask.references[index].inverted = value; }) });
      shapeCollectionActions(reference, [{ label: 'Remove Mask', action: () => edit(mask => mask.references.splice(index, 1)) }], rebuild);
    });
    if (read().references.length < 254) {
      addShapeCollectionItem(references, 'Add Mask Reference', () => edit(mask => mask.references.push({ inverted: false })), rebuild);
    }
  }
}
