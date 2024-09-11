import { glContext, Player, SpriteComponent, Texture } from '@galacean/effects';
import '@galacean/effects-plugin-media';

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
  videos: [
    {
      url: 'https://gw.alipayobjects.com/v/huamei_p0cigc/afts/video/A*7gPzSo3RxlQAAAAAAAAAAAAADtN3AQ',
      id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      renderLevel: 'B+',
    },
  ],
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
      options: { startColor: [0, 1, 1, 1] },
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
    { id: '8049d2c31aa44b138488490e4e8a38e3', source: { id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }, flipY: true },
    // { id: '8049d2c31aa44b138488490e4e8a38e3', source: { id: '727dc33084f14406bbd7ee034eea9644' }, flipY: true },
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
    { id: '9a2d0e1e8ef24be1b02ab67f8bde4a08', dataType: 'SpriteColorPlayableAsset', startColor: [0, 1, 1, 1] },
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

const json1 = {
  playerVersion: { web: '2.0.4', native: '0.0.1.202311221223' },
  images: [],
  fonts: [
    {
      fontFamily: 'f_1_000_WYUE_MFJianHei-Regular',
      fontURL: 'https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*lulXQrwiazwAAAAAAAAAAAAADsF2AQ',
    },
  ],
  version: '3.0',
  shapes: [],
  plugins: [],
  type: 'ge',
  compositions: [
    {
      id: '1',
      name: '自定义字体',
      duration: 5,
      startTime: 0,
      endBehavior: 2,
      previewSize: [750, 1624],
      items: [{ id: '39699f936d5c4b7f9cc64513b5fd5cec' }],
      camera: { fov: 60, far: 40, near: 0.1, clipMode: 1, position: [0, 0, 8], rotation: [0, 0, 0] },
      sceneBindings: [
        { key: { id: '0a63f716cd494783bee295ff1211df6e' }, value: { id: '39699f936d5c4b7f9cc64513b5fd5cec' } },
      ],
      timelineAsset: { id: '667a177a9596474cbf15bdddfe9e9a94' },
    },
  ],
  components: [
    {
      id: 'a75ccb76b7b84ca3a63f4c4c149dde36',
      item: { id: '39699f936d5c4b7f9cc64513b5fd5cec' },
      dataType: 'TextComponent',
      options: {
        text: '我是自定义字体',
        fontFamily: 'f_1_000_WYUE_MFJianHei-Regular',
        fontSize: 101,
        textColor: [90, 0, 255, 1],
        fontWeight: 'normal',
        letterSpace: 0,
        textAlign: 1,
        fontStyle: 'normal',
        autoWidth: false,
        textWidth: 624,
        textHeight: 317,
        lineHeight: 158.721,
        size: [7.6721, 3.8975],
      },
      renderer: { renderMode: 1 },
    },
  ],
  geometries: [],
  materials: [],
  items: [
    {
      id: '39699f936d5c4b7f9cc64513b5fd5cec',
      name: 'text_2',
      duration: 5,
      type: 'text',
      visible: true,
      endBehavior: 5,
      delay: 0,
      renderLevel: 'B+',
      transform: {
        position: { x: -3.6649, y: 6.3537, z: 0 },
        eulerHint: { x: null, y: null, z: 300 },
        scale: { x: 7.6721, y: 3.8975, z: 1 },
      },
      components: [{ id: 'a75ccb76b7b84ca3a63f4c4c149dde36' }],
      dataType: 'VFXItemData',
    },
  ],
  shaders: [],
  bins: [],
  textures: [],
  animations: [],
  miscs: [
    {
      id: '667a177a9596474cbf15bdddfe9e9a94',
      dataType: 'TimelineAsset',
      tracks: [{ id: '0a63f716cd494783bee295ff1211df6e' }],
    },
    { id: '23198b6e4ad641e3a89831bcb3a89faa', dataType: 'ActivationPlayableAsset' },
    {
      id: '8aa4cdbcc9a0451e9e69df8a0f08f579',
      dataType: 'TransformPlayableAsset',
      positionOverLifetime: {
        asMovement: true,
        linearX: [
          21,
          [
            [3, [0, 0, 0.4, 0]],
            [2, [0.5999999999999999, 2.421015624999999, 1, 2.421015624999999]],
          ],
        ],
        linearY: [0, 0],
        linearZ: [0, 0],
        asRotation: false,
        orbitalX: [0, 0],
        orbitalY: [0, 0],
        orbitalZ: [0, 0],
        orbCenter: [0, 0, 0],
        speedOverLifetime: [0, 1],
      },
      sizeOverLifetime: { size: [0, 5.3999999999999995] },
    },
    {
      id: 'f46e9a8e448048af86e18ad10e360bea',
      dataType: 'SpriteColorPlayableAsset',
      colorOverLifetime: {
        color: [
          9,
          [
            [0.14, 236, 41, 41, 255],
            [0.15, 183, 173, 173, 255],
            [1, 62, 103, 90, 255],
          ],
        ],
        opacity: [
          21,
          [
            [4, [0, 1]],
            [4, [0.744, 1]],
          ],
        ],
      },
    },
    {
      id: '85c04fccc9864f869d6b39169936990d',
      dataType: 'ActivationTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: '23198b6e4ad641e3a89831bcb3a89faa' } }],
    },
    {
      id: '56a8b0d13813414bb39163193672f010',
      dataType: 'TransformTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: '8aa4cdbcc9a0451e9e69df8a0f08f579' } }],
    },
    {
      id: '51fecb193a164044837cbeb9166bff9a',
      dataType: 'SpriteColorTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: 'f46e9a8e448048af86e18ad10e360bea' } }],
    },
    {
      id: '0a63f716cd494783bee295ff1211df6e',
      dataType: 'ObjectBindingTrack',
      children: [
        { id: '85c04fccc9864f869d6b39169936990d' },
        { id: '56a8b0d13813414bb39163193672f010' },
        { id: '51fecb193a164044837cbeb9166bff9a' },
      ],
      clips: [],
    },
  ],
  compositionId: '1',
};
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });

    await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*3aSZTY9edaAAAAAAAAAAAAAADlB4AQ');
  } catch (e) {
    console.error('biz', e);
  }
})();
