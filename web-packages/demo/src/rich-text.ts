import { Player, TextComponent } from '@galacean/effects';

const json = {
  playerVersion: { web: '2.0.6', native: '0.0.1.202311221223' },
  images: [],
  fonts: [],
  version: '3.0',
  shapes: [],
  plugins: [],
  type: 'ge',
  compositions: [
    {
      id: '9',
      name: '新建合成8',
      duration: 5,
      startTime: 0,
      endBehavior: 2,
      previewSize: [750, 1624],
      items: [{ id: '2cc1a2c732d54b3cafddda20685b7116' }],
      camera: { fov: 60, far: 40, near: 0.1, clipMode: 1, position: [0, 0, 8], rotation: [0, 0, 0] },
      sceneBindings: [
        { key: { id: 'b9e3bd2ee2ac473ca6061f315f91bbff' }, value: { id: '2cc1a2c732d54b3cafddda20685b7116' } },
      ],
      timelineAsset: { id: 'f6663fa5c1a148909f06b8b9a1ed3ded' },
    },
  ],
  components: [
    {
      id: '58bc2616b7c545dfa58384fb715c5dfb',
      item: { id: '2cc1a2c732d54b3cafddda20685b7116' },
      dataType: 'TextComponent',
      options: {
        text: '2222222',
        fontFamily: 'monospace',
        fontSize: 40,
        textColor: [255, 255, 255, 1],
        fontWeight: 'normal',
        letterSpace: 0,
        textAlign: 1,
        fontStyle: 'normal',
        autoWidth: true,
        textWidth: 171,
        textHeight: 63,
        lineHeight: 62.86,
        size: [2.1024599641731534, 0.7745905131164235],
      },
      renderer: { renderMode: 1 },
    },
  ],
  geometries: [],
  materials: [],
  items: [
    {
      id: '2cc1a2c732d54b3cafddda20685b7116',
      name: 'richtext',
      duration: 5,
      type: 'text',
      visible: true,
      endBehavior: 5,
      delay: 0,
      renderLevel: 'B+',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        eulerHint: { x: 0, y: 0, z: 0 },
        scale: { x: 2.1025, y: 0.7746, z: 1 },
      },
      components: [{ id: '58bc2616b7c545dfa58384fb715c5dfb' }],
      dataType: 'VFXItemData',
    },
  ],
  shaders: [],
  bins: [],
  textures: [],
  animations: [],
  miscs: [
    {
      id: 'f6663fa5c1a148909f06b8b9a1ed3ded',
      dataType: 'TimelineAsset',
      tracks: [{ id: 'b9e3bd2ee2ac473ca6061f315f91bbff' }],
    },
    { id: 'fe7dffd021ee439d9be6143cce98a258', dataType: 'ActivationPlayableAsset' },
    { id: '6f8018e1bc1e4b26b4daaf0a09cf2169', dataType: 'TransformPlayableAsset', positionOverLifetime: {} },
    { id: 'f7f7c2622bcc429d88fb66eca98171c7', dataType: 'SpriteColorPlayableAsset' },
    {
      id: '261db92ad05548f1aa8df9ac251a9ac8',
      dataType: 'ActivationTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: 'fe7dffd021ee439d9be6143cce98a258' } }],
    },
    {
      id: 'e25497bd846c456a9505b8670cdb602b',
      dataType: 'TransformTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: '6f8018e1bc1e4b26b4daaf0a09cf2169' } }],
    },
    {
      id: '7402d470e0ac43ffbd6ebf237942400d',
      dataType: 'SpriteColorTrack',
      children: [],
      clips: [{ start: 0, duration: 5, endBehavior: 5, asset: { id: 'f7f7c2622bcc429d88fb66eca98171c7' } }],
    },
    {
      id: 'b9e3bd2ee2ac473ca6061f315f91bbff',
      dataType: 'ObjectBindingTrack',
      children: [
        { id: '261db92ad05548f1aa8df9ac251a9ac8' },
        { id: 'e25497bd846c456a9505b8670cdb602b' },
        { id: '7402d470e0ac43ffbd6ebf237942400d' },
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

    const compostion = await player.loadScene(json, {
      variables: {
        text_1: 'Galacean Effects'.toLocaleUpperCase().split('').reverse().join(''),
      },
    });
    const textItem = compostion.getItemByName('text_2');
    const textComponent = textItem?.getComponent(TextComponent);

    textComponent?.setTextColor([255, 0, 0, 1]);

    setTimeout(() => {
      textComponent?.setText('基于 Web\n效果丰富，氛围粒子、陀螺仪特效、3D 模型渲染\n100%还原');
    }, 1500);
  } catch (e) {
    console.error('biz', e);
  }
})();
