import { Asset, Player, spec } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';
import { AudioComponent, checkAutoplayPermission, loadAudio } from '@galacean/effects-plugin-multimedia';

const duration = 5.0;
const endBehavior = spec.EndBehavior.destroy;
const delay = 3;
const json = {
  playerVersion: { web: '2.0.4', native: '0.0.1.202311221223' },
  images: [
    {
      url: 'https://mdn.alipayobjects.com/mars/afts/img/A*t0FNRqje9OcAAAAAAAAAAAAADlB4AQ/original',
      webp: 'https://mdn.alipayobjects.com/mars/afts/img/A*3kxITrXVFsMAAAAAAAAAAAAADlB4AQ/original',
      id: '8fe7723c56254da9b2cd57a4589d4329',
      renderLevel: 'B+',
    },
  ],
  fonts: [],
  version: '3.0',
  shapes: [],
  plugins: ['video', 'audio'],
  type: 'ge',
  compositions: [
    {
      id: '5',
      name: 'comp1',
      duration: 10,
      startTime: 0,
      endBehavior: 2,
      previewSize: [750, 1624],
      items: [
        { id: '14b3d069cbad4cbd81d0a8731cc4aba7' },
        { id: '147e873c89b34c6f96108ccc4d6e6f83' },
        { id: '8b526e86ce154031a76f9176e7224f89' },
      ],
      camera: { fov: 60, far: 40, near: 0.1, clipMode: 1, position: [0, 0, 8], rotation: [0, 0, 0] },
      sceneBindings: [
        { key: { id: 'b2bd20ced8044fa8a1fd39149a3271d5' }, value: { id: '14b3d069cbad4cbd81d0a8731cc4aba7' } },
        { key: { id: 'fbc814afc3014b9fa1ddc416c87036d8' }, value: { id: '147e873c89b34c6f96108ccc4d6e6f83' } },
        { key: { id: '54f5ac560cef4c82a40720fe588dfcfd' }, value: { id: '8b526e86ce154031a76f9176e7224f89' } },
      ],
      timelineAsset: { id: '28e2d15bfce443258bad609ca56fbb68' },
    },
  ],
  components: [
    {
      id: '2d6ad26344fa4f58af2ca2bc6b63818d',
      item: { id: '14b3d069cbad4cbd81d0a8731cc4aba7' },
      dataType: 'VideoComponent',
      options: {
        startColor: [1, 1, 1, 1],
        video: {
          id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      },
      renderer: { renderMode: 1, texture: { id: 'd546cda394bb484d9bf4af217184e94e' } },
      splits: [[0, 0, 1, 1, 0]],
    },
    {
      id: '61b52540d9614a8da88c7a4a439b57f3',
      item: { id: '147e873c89b34c6f96108ccc4d6e6f83' },
      dataType: 'AudioComponent',
      options: {
        audio: {
          id: 'cccccccccccccccccccccccccccccccc',
        },
      },
    },
    {
      id: 'fe5ad4a8a1f74530a1bfb6c914019608',
      item: { id: '8b526e86ce154031a76f9176e7224f89' },
      dataType: 'ParticleSystem',
      shape: { type: 1, radius: 1, arc: 360, arcMode: 0, alignSpeedDirection: false, shape: 'Sphere' },
      renderer: { renderMode: 1, anchor: [0, 0] },
      emission: { rateOverTime: [0, 5] },
      options: {
        maxCount: 10,
        startLifetime: [0, 1.2],
        startDelay: [0, 0],
        particleFollowParent: false,
        start3DSize: false,
        startRotationZ: [0, 0],
        startColor: [8, [1, 1, 1, 1]],
        startSize: [0, 0.2],
        sizeAspect: [0, 1],
      },
      positionOverLifetime: { startSpeed: [0, 1], gravity: [0, 0, 0], gravityOverLifetime: [0, 1] },
    },
  ],
  geometries: [],
  materials: [],
  items: [
    {
      id: '14b3d069cbad4cbd81d0a8731cc4aba7',
      name: 'video',
      duration: 5,
      type: '1',
      visible: true,
      endBehavior: 5,
      delay: 0,
      renderLevel: 'B+',
      components: [{ id: '2d6ad26344fa4f58af2ca2bc6b63818d' }],
      transform: {
        position: { x: 0, y: 0, z: 0 },
        eulerHint: { x: 0, y: 0, z: 0 },
        anchor: { x: 0, y: 0 },
        size: { x: 3.1475, y: 3.1475 },
        scale: { x: 1, y: 1, z: 1 },
      },
      dataType: 'VFXItemData',
    },
    {
      id: '147e873c89b34c6f96108ccc4d6e6f83',
      name: 'audio',
      duration,
      type: '1',
      visible: true,
      endBehavior,
      delay,
      renderLevel: 'B+',
      components: [{ id: '61b52540d9614a8da88c7a4a439b57f3' }],
      transform: {
        position: { x: 0, y: 4.6765, z: 0 },
        eulerHint: { x: 0, y: 0, z: 0 },
        anchor: { x: 0, y: 0 },
        size: { x: 3.1492, y: 3.1492 },
        scale: { x: 1, y: 1, z: 1 },
      },
      dataType: 'VFXItemData',
    },
    {
      id: '8b526e86ce154031a76f9176e7224f89',
      name: 'particle_2',
      duration: 5,
      type: '2',
      visible: true,
      endBehavior: 4,
      delay: 0,
      renderLevel: 'B+',
      content: {
        dataType: 'ParticleSystem',
        shape: { type: 1, radius: 1, arc: 360, arcMode: 0, alignSpeedDirection: false, shape: 'Sphere' },
        renderer: { renderMode: 1, anchor: [0, 0] },
        emission: { rateOverTime: [0, 5] },
        options: {
          maxCount: 10,
          startLifetime: [0, 1.2],
          startDelay: [0, 0],
          particleFollowParent: false,
          start3DSize: false,
          startRotationZ: [0, 0],
          startColor: [8, [1, 1, 1, 1]],
          startSize: [0, 0.2],
          sizeAspect: [0, 1],
        },
        positionOverLifetime: { startSpeed: [0, 1], gravity: [0, 0, 0], gravityOverLifetime: [0, 1] },
      },
      components: [{ id: 'fe5ad4a8a1f74530a1bfb6c914019608' }],
      transform: { position: { x: 0, y: 0, z: 0 }, eulerHint: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      dataType: 'VFXItemData',
    },
  ],
  videos: [
    {
      url: 'https://gw.alipayobjects.com/v/huamei_s9rwo4/afts/video/A*pud9Q7-6P7QAAAAAAAAAAAAADiqKAQ',
      id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      renderLevel: 'B+',
    },
  ],
  audios: [
    {
      url: 'https://mdn.alipayobjects.com/huamei_s9rwo4/afts/file/A*zERYT5qS-7kAAAAAAAAAAAAADiqKAQ',
      id: 'cccccccccccccccccccccccccccccccc',
      renderLevel: 'B+',
    },
  ],
  shaders: [],
  bins: [],
  textures: [
    { id: 'd546cda394bb484d9bf4af217184e94e', source: { id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }, flipY: true },
  ],
  animations: [],
  miscs: [
    {
      id: '28e2d15bfce443258bad609ca56fbb68',
      dataType: 'TimelineAsset',
      tracks: [
        { id: 'b2bd20ced8044fa8a1fd39149a3271d5' },
        { id: 'fbc814afc3014b9fa1ddc416c87036d8' },
        { id: '54f5ac560cef4c82a40720fe588dfcfd' },
      ],
    },
    { id: '3c2ceabd3f6a47b8bf0710d1e3906642', dataType: 'ActivationPlayableAsset' },
    {
      id: '878aa596a1ca474189dc14c4e5b472e8',
      dataType: 'TransformPlayableAsset',
      positionOverLifetime: {
        path: [
          22,
          [
            [
              [4, [0, -1]],
              [4, [0.992, 0]],
            ],
            [
              [-3.524964052019925, 0, 0],
              [0, 0, 0],
            ],
            [
              [-2.3499760346799503, 0, 0],
              [-1.1749880173399756, 0, 0],
            ],
          ],
        ],
      },
    },
    { id: 'eb2ef6afc750499a93c11c0fb9ba04e3', dataType: 'SpriteColorPlayableAsset', startColor: [1, 1, 1, 1] },
    {
      id: '951dcf1cd08d40909a2cfbb2e4860886',
      dataType: 'ActivationTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: '3c2ceabd3f6a47b8bf0710d1e3906642' } }],
    },
    {
      id: '21abdd82324d4754b8fc3737846c4c88',
      dataType: 'TransformTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: '878aa596a1ca474189dc14c4e5b472e8' } }],
    },
    {
      id: '0e6cbef7789845bcb11ca5b9ea233011',
      dataType: 'SpriteColorTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: 'eb2ef6afc750499a93c11c0fb9ba04e3' } }],
    },
    {
      id: 'b2bd20ced8044fa8a1fd39149a3271d5',
      dataType: 'ObjectBindingTrack',
      children: [
        { id: '951dcf1cd08d40909a2cfbb2e4860886' },
        { id: '21abdd82324d4754b8fc3737846c4c88' },
        { id: '0e6cbef7789845bcb11ca5b9ea233011' },
      ],
      clips: [],
    },
    { id: '0455d9dd0c08438bacae2a1f389fd1b9', dataType: 'ActivationPlayableAsset' },
    { id: '1447e12aafa04939ab9fa15b9e46362e', dataType: 'TransformPlayableAsset', positionOverLifetime: {} },
    { id: '55167a8ecdf44789bfcd8fdb42f7b8f1', dataType: 'SpriteColorPlayableAsset', startColor: [1, 1, 1, 1] },
    {
      id: '1865c395b5ad42a09f4e8f8c9074da35',
      dataType: 'ActivationTrack',
      children: [],
      clips: [{ start: delay, duration, endBehavior, asset: { id: '0455d9dd0c08438bacae2a1f389fd1b9' } }],
    },
    {
      id: '35f9056d99074eeaa2be2a2ab2f81237',
      dataType: 'TransformTrack',
      children: [],
      clips: [{ start: delay, duration, endBehavior, asset: { id: '1447e12aafa04939ab9fa15b9e46362e' } }],
    },
    {
      id: '6d04569674bb491ab56114e9a7b88b4b',
      dataType: 'SpriteColorTrack',
      children: [],
      clips: [{ start: delay, duration, endBehavior, asset: { id: '55167a8ecdf44789bfcd8fdb42f7b8f1' } }],
    },
    {
      id: 'fbc814afc3014b9fa1ddc416c87036d8',
      dataType: 'ObjectBindingTrack',
      children: [
        { id: '1865c395b5ad42a09f4e8f8c9074da35' },
        { id: '35f9056d99074eeaa2be2a2ab2f81237' },
        { id: '6d04569674bb491ab56114e9a7b88b4b' },
      ],
      clips: [],
    },
    { id: 'e1fa79bd7e2e448fb7b1902e76d1dd65', dataType: 'ActivationPlayableAsset' },
    {
      id: 'ce386d52216b4d2b83fd94f770553715',
      dataType: 'ActivationTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 4, asset: { id: 'e1fa79bd7e2e448fb7b1902e76d1dd65' } }],
    },
    {
      id: '54f5ac560cef4c82a40720fe588dfcfd',
      dataType: 'ObjectBindingTrack',
      children: [{ id: 'ce386d52216b4d2b83fd94f770553715' }],
      clips: [],
    },
  ],
  compositionId: '5',
};
let player: Player;
const container = document.getElementById('J-container');
const addButton = document.getElementById('J-add');
const updateButton = document.getElementById('J-update');
const inputEle = document.getElementById('J-input') as HTMLInputElement;

(async () => {
  try {
    player = new Player({
      container,
    });

    await checkAutoplayPermission();

    await player.loadScene(json);
  } catch (e) {
    console.error('biz', e);
  }
})();

addButton?.addEventListener('click', async () => {
  const value = inputEle.value;

  if (value) {
    const item = player.getCompositionByName('comp1')?.getItemByName('video');
    const audio = await loadAudio(value);
    const audioAsset = new Asset<HTMLAudioElement | AudioBuffer>(player.renderer.engine);

    audioAsset.data = audio;

    if (!item) {
      return;
    }
    const audioComponent = item.addComponent(AudioComponent);

    audioComponent.item = item;
    audioComponent.fromData({
      options: {
        //@ts-expect-error
        audio: audioAsset,
      },
    });
  }
});

updateButton?.addEventListener('click', async () => {
  const value = inputEle.value;

  if (value) {
    const audioComponent = player
      .getCompositionByName('comp1')
      ?.getItemByName('audio')
      ?.getComponent(AudioComponent);

    if (audioComponent) {
      audioComponent.setAudioSource(await loadAudio(value));
    }
  }
});
