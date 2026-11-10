import type { TrimPathData, VariableWidthPoint } from '@galacean/effects';
import { generateGUID, spec, TrimPathMode } from '@galacean/effects';
import { createSceneItemData } from '../../features/scene/factories/scene-item-factory';
import { createEmptyScene } from '../../features/scene/factories/scene-template';

/** Closed and open cubic paths for comparing stroke profiles and trim settings. */
export function createVectorStrokeScene (): spec.JSONScene {
  const scene = createEmptyScene();
  const composition = scene.compositions[0];
  const root = scene.components[0] as spec.CompositionComponentData;
  const timeline = scene.miscs[0] as spec.TimelineAssetData;
  const trim: TrimPathData = { start: 0, end: 1, offset: 0, mode: TrimPathMode.Synchronized };

  scene.version = spec.JSONSceneVersion['3_8'];
  composition.name = 'Vector Strokes';
  composition.previewSize = [750, 750];
  composition.camera.position = [0, 0, 5];
  for (const closed of [true, false]) {
    const { item, objects } = createSceneItemData({ type: spec.ItemType.shape, label: closed ? 'Closed Path' : 'Open Path' }, composition.duration);
    const color = closed ? { r: 1, g: 0.7, b: 0.35, a: 1 } : { r: 0.4, g: 0.85, b: 0.94, a: 1 };
    const shape: spec.CustomShapeData & { strokeAlignment: number, variableWidthPoints: VariableWidthPoint[], fillTrimPath: TrimPathData, strokeTrimPath: TrimPathData } = {
      id: objects[0].id, item: { id: item.id }, dataType: spec.DataType.ShapeComponent,
      type: spec.ShapePrimitiveType.Custom,
      points: closed
        ? [{ x: -0.4, y: 0 }, { x: 0, y: 0.3 }, { x: 0.4, y: 0 }, { x: 0, y: -0.3 }]
        : [{ x: -0.4, y: -0.12 }, { x: -0.13, y: 0.12 }, { x: 0.13, y: -0.12 }, { x: 0.4, y: 0.12 }],
      easingIns: closed
        ? [{ x: 0, y: -0.166 }, { x: -0.221, y: 0 }, { x: 0, y: 0.166 }, { x: 0.221, y: 0 }]
        : [{ x: 0, y: 0 }, { x: -0.1, y: 0 }, { x: -0.1, y: 0 }, { x: -0.1, y: 0 }],
      easingOuts: closed
        ? [{ x: 0, y: 0.166 }, { x: 0.221, y: 0 }, { x: 0, y: -0.166 }, { x: -0.221, y: 0 }]
        : [{ x: 0.1, y: 0 }, { x: 0.1, y: 0 }, { x: 0.1, y: 0 }, { x: 0, y: 0 }],
      shapes: [{ close: closed, indexes: [0, 1, 2, 3].map(index => ({ point: index, easingIn: index, easingOut: index })) }],
      fills: closed ? [{ type: spec.FillType.Solid, color: { ...color, a: 0.12 } }] : [],
      strokes: [{ type: spec.FillType.Solid, color }],
      strokeWidth: closed ? 0.04 : 0.08, strokeAlignment: 0.5, strokeCap: spec.LineCap.Round, strokeJoin: spec.LineJoin.Round,
      variableWidthPoints: closed ? [] : [{ position: 0, ascent: 0, descent: 0 }, { position: .5, ascent: .5, descent: .5 }, { position: 1, ascent: 0, descent: 0 }],
      fillTrimPath: { ...trim }, strokeTrimPath: { ...trim },
    };
    const bindingId = generateGUID(), activationId = generateGUID(), clipId = generateGUID();
    const tracks: (spec.EffectsObjectData & Record<string, unknown>)[] = [
      { id: clipId, dataType: spec.DataType.ActivationPlayableAsset },
      { id: activationId, dataType: spec.DataType.ActivationTrack, children: [], clips: [
        { start: 0, duration: composition.duration, endBehavior: spec.EndBehavior.freeze, asset: { id: clipId } },
      ] },
      { id: bindingId, dataType: spec.DataType.ObjectBindingTrack, children: [{ id: activationId }], clips: [] },
    ];

    item.transform.position.x = closed ? -0.65 : 0.65;
    composition.children!.push({ id: item.id });
    scene.items.push(item as unknown as spec.VFXItemData);
    scene.components.push(shape);
    root.items.push({ id: item.id });
    root.sceneBindings.push({ key: { id: bindingId }, value: { id: item.id } });
    timeline.tracks.push({ id: bindingId });
    scene.miscs.push(...tracks);
  }

  return scene;
}
