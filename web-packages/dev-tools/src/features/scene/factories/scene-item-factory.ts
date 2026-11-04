import { generateGUID, spec } from '@galacean/effects';

export interface SceneItemOptions { type: spec.ItemType, label: string }

type Data = spec.EffectsObjectData & Record<string, any>;

export function createSceneItemData (entry: SceneItemOptions, duration: number): { item: Data, objects: Data[] } {
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
  } else if (entry.type === spec.ItemType.video) {
    components.push(component(spec.DataType.VideoComponent, { options: { startColor: [1, 1, 1, 1], playbackRate: 1, volume: 1, muted: false, transparent: false }, renderer }));
  } else if (entry.type === spec.ItemType.audio) {
    components.push(component(spec.DataType.AudioComponent, { options: { playbackRate: 1, volume: 1, muted: false } }));
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
  } else if (entry.type === spec.ItemType.mesh) {
    const geometry = createMeshGeometry(), material = { id: generateGUID(), name: 'Mesh Material', dataType: spec.DataType.Material,
      shader: { id: spec.BuiltinObjectGUID.UnlitShader }, stringTags: { RenderType: spec.RenderType.Opaque, RenderFace: spec.RenderFace.Front },
      macros: [], ints: {}, floats: { ZWrite: 1, ZTest: 1 }, vector4s: {}, colors: { _BaseColorFactor: { r: 1, g: 1, b: 1, a: 1 } }, textures: {} };

    objects.push(geometry, material);
    components.push(component(spec.DataType.MeshComponent, { geometry: { id: geometry.id }, materials: [{ id: material.id }],
      interaction: { type: spec.ModelBoundingType.box, center: [0, 0, 0], size: [1, 1, 1] } }));
  } else if (entry.type === spec.ItemType.skybox) {
    components.push(component(spec.DataType.SkyboxComponent, { renderable: false, intensity: 1, reflectionsIntensity: 1,
      irradianceCoeffs: new Array(27).fill(0), specularImageSize: 0, specularMipCount: 0 }));
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
  } else if (entry.type !== spec.ItemType.null) {
    throw new Error('Unsupported scene item type: ' + entry.type);
  }
  const text = entry.type === spec.ItemType.text || entry.type === spec.ItemType.richtext;

  return { objects, item: { id, dataType: spec.DataType.VFXItemData, name: entry.label, type: entry.type,
    ...(entry.type === spec.ItemType.interact ? { content: interaction } : {}),
    duration: Math.max(0.001, duration), delay: 0, endBehavior: spec.EndBehavior.freeze, visible: true,
    components, children: [], transform: { position: { x: 0, y: 0, z: entry.type === spec.ItemType.camera ? 8 : 0 },
      eulerHint: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, size: { x: text ? 4 : 1, y: 1 }, anchor: { x: 0, y: 0 } } } };
}

function createMeshGeometry (): Data {
  const positions = new Float32Array([-.5, -.5, -.5, .5, -.5, -.5, .5, .5, -.5, -.5, .5, -.5, -.5, -.5, .5, .5, -.5, .5, .5, .5, .5, -.5, .5, .5]);
  const indices = new Uint16Array([4, 5, 6, 4, 6, 7, 1, 0, 3, 1, 3, 2, 0, 4, 7, 0, 7, 3, 5, 1, 2, 5, 2, 6, 3, 7, 6, 3, 6, 2, 0, 1, 5, 0, 5, 4]);
  const bytes = new Uint8Array(positions.byteLength + indices.byteLength);

  bytes.set(new Uint8Array(positions.buffer)); bytes.set(new Uint8Array(indices.buffer), positions.byteLength);

  return { id: generateGUID(), name: 'Mesh Geometry', dataType: spec.DataType.Geometry, mode: spec.GeometryType.TRIANGLES,
    vertexData: { vertexCount: positions.length / 3, channels: [{ semantic: spec.VertexBufferSemantic.Position, offset: 0, format: spec.VertexFormatType.Float32, dimension: 3 }] },
    indexFormat: spec.IndexFormatType.UInt16, indexOffset: positions.byteLength, subMeshes: [{ offset: 0, vertexCount: positions.length / 3, indexCount: indices.length }],
    buffer: btoa(String.fromCharCode(...bytes)) };
}
