import { glContext, Player, SpriteComponent, Texture } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

const json = {
  playerVersion: { web: '2.0.3', native: '0.0.1.202311221223' },
  images: [
    {
      url: 'https://mdn.alipayobjects.com/mars/afts/img/A*KJmtTp_w7roAAAAAAAAAAAAADlB4AQ/original',
      webp: 'https://mdn.alipayobjects.com/mars/afts/img/A*zmpJSa_CGzMAAAAAAAAAAAAADlB4AQ/original',
      id: '727dc33084f14406bbd7ee034eea9644',
      renderLevel: 'B+',
    },
  ],
  fonts: [],
  version: '3.0',
  shapes: [],
  plugins: [],
  type: 'ge',
  compositions: [
    {
      id: '5',
      name: '新建合成5',
      duration: 5,
      startTime: 0,
      endBehavior: 4,
      previewSize: [750, 1624],
      items: [{ id: '14b3d069cbad4cbd81d0a8731cc4aba7' }],
      camera: { fov: 60, far: 40, near: 0.1, clipMode: 1, position: [0, 0, 8], rotation: [0, 0, 0] },
      sceneBindings: [
        { key: { id: 'd4dde90c9627472cbfb5da7fd41206b0' }, value: { id: '14b3d069cbad4cbd81d0a8731cc4aba7' } },
      ],
      timelineAsset: { id: '05fe7671a5fe4ebc85989e858221be20' },
    },
  ],
  components: [
    {
      id: 'cd34e171991c4ed9b87e1b0fd1fe0985',
      item: { id: '14b3d069cbad4cbd81d0a8731cc4aba7' },
      dataType: 'SpriteComponent',
      options: { startColor: [1, 1, 1, 1] },
      renderer: { renderMode: 1, texture: { id: '8049d2c31aa44b138488490e4e8a38e3' } },
      splits: [[0, 0, 1, 1, 0]],
    },
  ],
  geometries: [],
  materials: [],
  items: [
    {
      id: '14b3d069cbad4cbd81d0a8731cc4aba7',
      name: 'sprite_1',
      duration: 5,
      type: '1',
      visible: true,
      endBehavior: 0,
      delay: 0,
      renderLevel: 'B+',
      components: [{ id: 'cd34e171991c4ed9b87e1b0fd1fe0985' }],
      transform: {
        position: { x: 0, y: 0, z: 0 },
        eulerHint: { x: 0, y: 0, z: 0 },
        anchor: { x: 0, y: 0 },
        size: { x: 3.1475, y: 3.1475 },
        scale: { x: 1, y: 1, z: 1 },
      },
      dataType: 'VFXItemData',
    },
  ],
  shaders: [],
  bins: [],
  textures: [
    { id: '8049d2c31aa44b138488490e4e8a38e3', source: { id: '727dc33084f14406bbd7ee034eea9644' }, flipY: true },
  ],
  animations: [],
  miscs: [
    {
      id: '05fe7671a5fe4ebc85989e858221be20',
      dataType: 'TimelineAsset',
      tracks: [{ id: 'd4dde90c9627472cbfb5da7fd41206b0' }],
    },
    { id: 'c513ca5487764a2da3bd686e5cc1bab7', dataType: 'ActivationPlayableAsset' },
    { id: 'c3827d36205a4e0aaeb48346283168d9', dataType: 'TransformPlayableAsset', positionOverLifetime: {} },
    { id: '9a2d0e1e8ef24be1b02ab67f8bde4a08', dataType: 'SpriteColorPlayableAsset', startColor: [1, 1, 1, 1] },
    {
      id: '58fb69f54d7f4646bb7608e39c08f515',
      dataType: 'ActivationTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 0, asset: { id: 'c513ca5487764a2da3bd686e5cc1bab7' } }],
    },
    {
      id: 'e4a44779d6d541b7b7ec2a399c4fdcb1',
      dataType: 'TransformTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 0, asset: { id: 'c3827d36205a4e0aaeb48346283168d9' } }],
    },
    {
      id: '89c2f066d38b464a8a8de4578de59ef0',
      dataType: 'SpriteColorTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 0, asset: { id: '9a2d0e1e8ef24be1b02ab67f8bde4a08' } }],
    },
    {
      id: 'd4dde90c9627472cbfb5da7fd41206b0',
      dataType: 'ObjectBindingTrack',
      children: [
        { id: '58fb69f54d7f4646bb7608e39c08f515' },
        { id: 'e4a44779d6d541b7b7ec2a399c4fdcb1' },
        { id: '89c2f066d38b464a8a8de4578de59ef0' },
      ],
      clips: [],
    },
  ],
  compositionId: '5',
};
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });

    await player.loadScene(json);

  } catch (e) {
    console.error('biz', e);
  }
})();
