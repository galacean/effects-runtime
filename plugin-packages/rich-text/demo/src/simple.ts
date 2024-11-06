import { Player, spec } from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';

const json = {
  playerVersion: { web: '2.0.6', native: '0.0.1.202311221223' },
  images: [],
  fonts: [],
  version: '3.0',
  shapes: [],
  plugins: ['richtext'],
  type: 'ge',
  compositions: [
    {
      id: '9',
      name: 'richtext',
      duration: 5,
      startTime: 0,
      endBehavior: 5,
      previewSize: [750, 1624],
      items: [{ id: '41716f6d8a1748a2b09fd36a09c91fd4' }],
      camera: { fov: 60, far: 40, near: 0.1, clipMode: 1, position: [0, 0, 8], rotation: [0, 0, 0] },
      sceneBindings: [
        { key: { id: 'ac2826cbde3d4b2aa6a2bc99b34eef7d' }, value: { id: '41716f6d8a1748a2b09fd36a09c91fd4' } },
      ],
      timelineAsset: { id: '420a2bf13d60445aa8e42e71cb248d8d' },
    },
  ],
  components: [
    {
      id: 'a7f9b9e3127e4ffa9682f7692ce90e09',
      item: { id: '41716f6d8a1748a2b09fd36a09c91fd4' },
      dataType: 'RichTextComponent',
      options: {
        text: '  We are <b>absolutely <i>definitely</i> not</b> \nWe are <color=green>green</color> with envy \nWe are <b>DDDD</b> amused. \nWe are <b>not</b> amused. \nWe are <i>usually</i> not amused. \nWe are <size=50>largely</size> unaffected. \nWe are <color=#ff0000ff>colorfully</color> amused \n88<size=10>$</size>',
        fontFamily: 'sans-serif',
        fontSize: 30,
        textColor: [255, 255, 10, 1],
        fontWeight: 'bold',
        textAlign: 1,
        fontStyle: 'normal',
      },
      renderer: { renderMode: 1 },
    },
  ],
  geometries: [],
  materials: [],
  items: [
    {
      id: '41716f6d8a1748a2b09fd36a09c91fd4',
      name: 'richtext',
      duration: 5,
      type: 'text',
      visible: true,
      endBehavior: 5,
      delay: 0,
      renderLevel: 'B+',
      transform: {
        position: { x: 0.2202, y: 2.5601, z: 0 },
        eulerHint: { x: 0, y: 0, z: 0 },
        scale: { x: 2.2803, y: 1.5492, z: 1 },
      },
      components: [{ id: 'a7f9b9e3127e4ffa9682f7692ce90e09' }],
      dataType: 'VFXItemData',
    },
  ],
  shaders: [],
  bins: [],
  textures: [],
  animations: [],
  miscs: [
    {
      id: '420a2bf13d60445aa8e42e71cb248d8d',
      dataType: 'TimelineAsset',
      tracks: [{ id: 'ac2826cbde3d4b2aa6a2bc99b34eef7d' }],
    },
    { id: '6ab1609043ee4e1db92bcfa6d2587045', dataType: 'ActivationPlayableAsset' },
    { id: '394c84cd0cec4295993206d2a0f74695', dataType: 'TransformPlayableAsset', positionOverLifetime: {} },
    { id: 'da4c8f544dd44c20b93d6098c93398e2', dataType: 'SpriteColorPlayableAsset' },
    {
      id: '99811f1e59d44335a27c58e44b5ede02',
      dataType: 'ActivationTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: '6ab1609043ee4e1db92bcfa6d2587045' } }],
    },
    {
      id: '563df4e1a3ec44bcb4632b1c31feb5ba',
      dataType: 'TransformTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: '394c84cd0cec4295993206d2a0f74695' } }],
    },
    {
      id: '18e32d67d8154082b6235d009a73d782',
      dataType: 'SpriteColorTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: 'da4c8f544dd44c20b93d6098c93398e2' } }],
    },
    {
      id: 'ac2826cbde3d4b2aa6a2bc99b34eef7d',
      dataType: 'ObjectBindingTrack',
      children: [
        { id: '99811f1e59d44335a27c58e44b5ede02' },
        { id: '563df4e1a3ec44bcb4632b1c31feb5ba' },
        { id: '18e32d67d8154082b6235d009a73d782' },
      ],
      clips: [],
    },
  ],
  compositionId: '9',
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
