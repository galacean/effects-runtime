import { generateGUID, spec } from '@galacean/effects';
import type { EditorIcon } from '../../widgets/editor-icons';

export interface SceneItemType {
  type: spec.ItemType,
  label: string,
  icon: EditorIcon,
  group: string,
  empty?: boolean,
  creatable?: boolean,
}

export const SCENE_ITEM_TYPES: SceneItemType[] = [
  { type: spec.ItemType.null, label: 'Empty Item', icon: 'cube', group: 'Basic' },
  { type: spec.ItemType.composition, label: 'Composition', icon: 'sequence', group: 'Basic' },
  { type: spec.ItemType.sprite, label: 'Sprite', icon: 'sprite', group: '2D' },
  { type: spec.ItemType.text, label: 'Text', icon: 'text', group: '2D' },
  { type: spec.ItemType.richtext, label: 'Rich Text', icon: 'text', group: '2D' },
  { type: spec.ItemType.shape, label: 'Shape', icon: 'sprite', group: '2D' },
  { type: spec.ItemType.particle, label: 'Particle System', icon: 'particle', group: 'Effects' },
  { type: spec.ItemType.effect, label: 'Effect', icon: 'particle', group: 'Effects', empty: true, creatable: false },
  { type: spec.ItemType.postProcessVolume, label: 'Post Process Volume', icon: 'view', group: 'Effects' },
  { type: spec.ItemType.camera, label: 'Camera', icon: 'cameraActor', group: '3D' },
  { type: spec.ItemType.light, label: 'Light', icon: 'light', group: '3D' },
  { type: spec.ItemType.mesh, label: 'Mesh', icon: 'mesh', group: '3D', empty: true },
  { type: spec.ItemType.skybox, label: 'Skybox', icon: 'world', group: '3D', empty: true },
  { type: spec.ItemType.tree, label: 'Tree', icon: 'sources', group: '3D', creatable: false },
  { type: spec.ItemType.spine, label: 'Spine', icon: 'skeleton', group: 'Media', empty: true, creatable: false },
  { type: spec.ItemType.video, label: 'Video', icon: 'video', group: 'Media', empty: true },
  { type: spec.ItemType.audio, label: 'Audio', icon: 'audio', group: 'Media', empty: true },
  { type: spec.ItemType.interact, label: 'Interaction', icon: 'hand', group: 'Advanced' },
  { type: spec.ItemType.node, label: 'Node', icon: 'cube', group: 'Advanced', creatable: false },
  { type: spec.ItemType.plugin, label: 'Plugin', icon: 'component', group: 'Advanced', empty: true, creatable: false },
];

type Data = spec.EffectsObjectData & Record<string, any>;

export function createSceneItemTemplate (entry: SceneItemType, duration: number): { item: Data, objects: Data[] } {
  const id = generateGUID(), objects: Data[] = [];
  const component = (dataType: spec.DataType, data: Record<string, any> = {}) => {
    const result = { id: generateGUID(), dataType, item: { id }, _enabled: true, ...data };

    objects.push(result);

    return { id: result.id };
  };
  const components: { id: string }[] = [];
  const renderer = { renderMode: spec.RenderMode.MESH, anchor: [0.5, 0.5] };
  const interaction = { options: { type: spec.InteractType.CLICK, behavior: spec.InteractBehavior.NONE } };
  const typography = { text: entry.label, fontFamily: 'sans-serif', fontSize: 40,
    textColor: entry.type === spec.ItemType.richtext ? [255, 255, 255, 1] : [1, 1, 1, 1],
    fontWeight: spec.TextWeight.normal, fontStyle: spec.FontStyle.normal, letterSpace: 0,
    textAlign: spec.TextAlignment.middle, textVerticalAlign: spec.TextVerticalAlign.middle, lineHeight: 40,
    textWidth: 200, textHeight: 50, maxTextWidth: 4, maxTextHeight: 1, wrapEnabled: false, useLegacyRichText: false };

  if (entry.type === spec.ItemType.sprite) {
    components.push(component(spec.DataType.SpriteComponent, { options: { startColor: [1, 1, 1, 1] }, renderer }));
  } else if (entry.type === spec.ItemType.shape) {
    components.push(component(spec.DataType.ShapeComponent, { type: spec.ShapePrimitiveType.Rectangle, width: 1, height: 1, roundness: 0,
      fills: [{ type: spec.FillType.Solid, color: { r: 1, g: 1, b: 1, a: 1 } }], strokes: [] }));
  } else if (entry.type === spec.ItemType.text || entry.type === spec.ItemType.richtext) {
    components.push(component(entry.type === spec.ItemType.text ? spec.DataType.TextComponent : spec.DataType.RichTextComponent, { options: typography, renderer }));
  } else if (entry.type === spec.ItemType.particle) {
    components.push(component(spec.DataType.ParticleSystem, { options: { maxCount: 100, startLifetime: 2,
      startColor: [spec.ValueType.RGBA_COLOR, [1, 1, 1, 1]], startSize: 0.15, looping: true },
    emission: { rateOverTime: 10, bursts: [] }, positionOverLifetime: { startSpeed: 0.5 },
    renderer: { renderMode: spec.RenderMode.BILLBOARD, anchor: [0, 0] } }));
  } else if (entry.type === spec.ItemType.camera) {
    components.push(component(spec.DataType.CameraController, { _enabled: false, options: { fov: 60, near: 0.1, far: 100, clipMode: spec.CameraClipMode.portrait } }));
  } else if (entry.type === spec.ItemType.light) {
    components.push(component(spec.DataType.LightComponent, { lightType: spec.LightType.point, color: { r: 1, g: 1, b: 1 }, intensity: 1, range: 10 }));
  } else if (entry.type === spec.ItemType.interact) {
    components.push(component(spec.DataType.InteractComponent, interaction));
  } else if (entry.type === spec.ItemType.tree) {
    components.push(component(spec.DataType.TreeComponent));
  } else if (entry.type === spec.ItemType.postProcessVolume) {
    components.push(component(spec.DataType.PostProcessVolume));
  } else if (entry.type === spec.ItemType.composition) {
    const timeline = { id: generateGUID(), dataType: spec.DataType.TimelineAsset, tracks: [] };

    objects.push(timeline);
    components.push(component(spec.DataType.CompositionComponent, { items: [], sceneBindings: [], timelineAsset: { id: timeline.id } }));
  }
  const text = entry.type === spec.ItemType.text || entry.type === spec.ItemType.richtext;

  return { objects, item: { id, dataType: spec.DataType.VFXItemData, name: entry.label, type: entry.type,
    ...(entry.type === spec.ItemType.interact ? { content: interaction } : {}),
    duration: Math.max(0.001, duration), delay: 0, endBehavior: spec.EndBehavior.freeze, visible: true,
    components, children: [], transform: { position: { x: 0, y: 0, z: entry.type === spec.ItemType.camera ? 8 : 0 },
      eulerHint: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, size: { x: text ? 4 : 1, y: 1 }, anchor: { x: 0, y: 0 } } } };
}
