import { Player } from '@galacean/effects';

/**
 * 多 TransformTrack 叠加 demo：移动 + 缩放 + 旋转 三条轨道同时作用于一个 sprite。
 *
 * 所有 track 统一为 additive 语义，在 base pose 上叠加：
 * - Track 1：X 轴路径位移 0 → 4.3064
 * - Track 2：均匀缩放 1 → 1.73
 * - Track 3：Z 轴旋转 0 → 360°
 *
 * 预期：sprite 边向右移动，边放大，边旋转。
 */
const scene = {
  playerVersion: { web: '2.8.11', native: '0.0.1.202311221223' },
  fonts: [],
  version: '3.6',
  plugins: [],
  type: 'ge',
  compositions: [
    {
      id: 'comp_1',
      name: 'multi-transform-track',
      duration: 5,
      startTime: 0,
      endBehavior: 4,
      previewSize: [750, 1624],
      camera: {
        fov: 60, far: 40, near: 0.1, clipMode: 1,
        position: [0, 0, 8], rotation: [0, 0, 0],
      },
      components: [{ id: 'comp_component_1' }],
    },
  ],
  components: [
    {
      id: 'comp_component_1',
      item: { id: 'comp_1' },
      dataType: 'CompositionComponent',
      items: [{ id: 'sprite_1' }],
      timelineAsset: { id: 'timeline_1' },
      sceneBindings: [
        { key: { id: 'obt_1' }, value: { id: 'sprite_1' } },
      ],
    },
    {
      id: 'sprite_component_1',
      item: { id: 'sprite_1' },
      dataType: 'SpriteComponent',
      options: { startColor: [1, 1, 1, 1] },
      renderer: {
        renderMode: 1,
        texture: { id: 'tex_1' },
      },
      splits: [[0, 0, 0.78125, 0.78125, 0]],
    },
  ],
  geometries: [],
  materials: [],
  items: [
    {
      id: 'sprite_1',
      name: 'sprite_1',
      duration: 5,
      type: '1',
      visible: true,
      endBehavior: 4,
      delay: 0,
      renderLevel: 'B+',
      components: [{ id: 'sprite_component_1' }],
      transform: {
        position: { x: -2.15, y: 0, z: 0 },
        eulerHint: { x: 0, y: 0, z: 0 },
        anchor: { x: 0, y: 0 },
        size: { x: 3, y: 3 },
        scale: { x: 1, y: 1, z: 1 },
      },
      dataType: 'VFXItemData',
    },
  ],
  shaders: [],
  bins: [],
  textures: [
    {
      id: 'tex_1',
      source: { id: 'img_1' },
      flipY: true,
    },
  ],
  images: [
    {
      id: 'img_1',
      renderLevel: 'B+',
      url: 'https://mdn.alipayobjects.com/mars/afts/file/A*K4gpRZUptkkAAAAAQtAAAAgAelB4AQ/original',
      webp: 'https://mdn.alipayobjects.com/mars/afts/file/A*qzcOTqR0oBwAAAAAQeAAAAgAelB4AQ/original',
    },
  ],
  animations: [],
  miscs: [
    // TimelineAsset
    {
      id: 'timeline_1',
      dataType: 'TimelineAsset',
      tracks: [{ id: 'obt_1' }],
    },
    // ActivationPlayableAsset
    { id: 'activation_asset_1', dataType: 'ActivationPlayableAsset' },
    // SpriteColorPlayableAsset
    {
      id: 'color_asset_1',
      dataType: 'SpriteColorPlayableAsset',
      startColor: [1, 1, 1, 1],
    },
    // ---- Track 1：X 轴路径位移（override）----
    {
      id: 'transform_asset_move',
      dataType: 'TransformPlayableAsset',
      positionOverLifetime: {
        path: [
          22,
          [
            [[4, [0, 0]], [4, [0.612, 1]]],
            [[0, 0, 0], [4.3064, 0, 0]],
            [[1.4355, 0, 0], [2.8709, 0, 0]],
          ],
        ],
      },
    },
    // ---- Track 2：均匀缩放 1 → 1.73（additive）----
    {
      id: 'transform_asset_scale',
      dataType: 'TransformPlayableAsset',
      positionOverLifetime: {},
      sizeOverLifetime: {
        size: [21, [[4, [0, 1]], [4, [0.618, 1.73]]]],
      },
    },
    // ---- Track 3：Z 轴旋转 0 → 360°（additive）----
    {
      id: 'transform_asset_rotate',
      dataType: 'TransformPlayableAsset',
      positionOverLifetime: {},
      rotationOverLifetime: {
        z: [21, [[4, [0, 0]], [4, [0.616, 360]]]],
        asRotation: true,
      },
    },
    // ActivationTrack
    {
      id: 'activation_track_1',
      dataType: 'ActivationTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 4, asset: { id: 'activation_asset_1' } }],
    },
    // TransformTrack 1：移动
    {
      id: 'transform_track_move',
      dataType: 'TransformTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 4, asset: { id: 'transform_asset_move' } }],
    },
    // TransformTrack 2：缩放
    {
      id: 'transform_track_scale',
      dataType: 'TransformTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 4, asset: { id: 'transform_asset_scale' } }],
    },
    // TransformTrack 3：旋转
    {
      id: 'transform_track_rotate',
      dataType: 'TransformTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 4, asset: { id: 'transform_asset_rotate' } }],
    },
    // SpriteColorTrack
    {
      id: 'color_track_1',
      dataType: 'SpriteColorTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 4, asset: { id: 'color_asset_1' } }],
    },
    // ObjectBindingTrack：绑定 sprite_1，包含所有子 track
    {
      id: 'obt_1',
      dataType: 'ObjectBindingTrack',
      children: [
        { id: 'activation_track_1' },
        { id: 'transform_track_move' },
        { id: 'transform_track_scale' },
        { id: 'transform_track_rotate' },
        { id: 'color_track_1' },
      ],
      clips: [],
    },
  ],
  compositionId: 'comp_1',
};

const container = document.getElementById('J-container');

void (async () => {
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    onError: err => {
      console.error('biz', err.message);
    },
  });

  await player.loadScene(scene);
})();
