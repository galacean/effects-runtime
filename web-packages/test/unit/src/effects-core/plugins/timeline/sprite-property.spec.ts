import {
  Player, Sprite, SpriteComponent, Texture, generateGUID,
} from '@galacean/effects';

const { expect } = chai;

/**
 * 构造 sprite 属性 K 帧场景：
 * - sprite item + SpriteComponent（初始引用 spriteA）
 * - 2 个 Sprite 资产（spriteA / spriteB，rect 不同，引用同一纹理）
 * - ObjectBindingTrack 绑 item → SpritePropertyTrack（path='sprite'）
 *   clip duration=2，keyframes [[0, spriteA], [0.5, spriteB]]（归一化时间）
 */
const buildKFrameScene = (clipStart = 0) => {
  const itemID = generateGUID();
  const componentID = generateGUID();
  const compositionID = generateGUID();
  const imageID = generateGUID();
  const textureID = generateGUID();
  const spriteAID = generateGUID();
  const spriteBID = generateGUID();
  const timelineAssetID = generateGUID();
  const bindingTrackID = generateGUID();
  const spritePropertyTrackID = generateGUID();
  const playableAssetID = generateGUID();

  // spriteA: rect=[0.25,0.25,0.5,0.5]；spriteB: rect=[0,0,0.5,0.5]（UV 不同，便于断言切换）
  const rectA = [0.25, 0.25, 0.5, 0.5];
  const rectB = [0, 0, 0.5, 0.5];

  return {
    json: {
      'images': [
        { 'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*MeN0T6slLYEAAAAAAAAAAAAADlB4AQ/original', 'id': imageID },
      ],
      'fonts': [],
      'version': '3.7',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': compositionID,
          'name': 'sprite K 帧',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 5,
          'previewSize': [0, 0],
          'items': [{ 'id': itemID }],
          'camera': { 'fov': 60, 'far': 1000, 'near': 0.3, 'clipMode': 0, 'position': [0, 0, 8], 'rotation': [0, 0, 0] },
          'sceneBindings': [
            { 'key': { 'id': bindingTrackID }, 'value': { 'id': itemID } },
          ],
          'timelineAsset': { 'id': timelineAssetID },
        },
      ],
      'components': [
        {
          'id': componentID,
          'dataType': 'SpriteComponent',
          'item': { 'id': itemID },
          'sprite': { 'id': spriteAID },
          'renderer': { 'renderMode': 1 },
          'options': { 'startColor': [1, 1, 1, 1] },
        },
      ],
      'items': [
        {
          'id': itemID, 'duration': 5, 'type': '1', 'visible': true, 'endBehavior': 0, 'delay': 0,
          'name': 'sprite_1', 'renderLevel': 'B+', 'dataType': 'VFXItemData',
          'components': [{ 'id': componentID }],
          'transform': { 'position': { 'x': 0, 'y': 0, 'z': 0 }, 'eulerHint': { 'x': 0, 'y': 0, 'z': 0 }, 'scale': { 'x': 1, 'y': 1, 'z': 1 } },
        },
      ],
      'geometries': [], 'materials': [], 'shaders': [], 'bins': [], 'animations': [],
      'textures': [
        {
          'sourceType': 2, 'keepImageSource': true, 'minFilter': 9729, 'magFilter': 9729,
          'id': textureID, 'dataType': 'Texture', 'source': { 'id': imageID }, 'flipY': true,
        },
      ],
      'miscs': [
        { 'id': timelineAssetID, 'dataType': 'TimelineAsset', 'tracks': [{ 'id': bindingTrackID }] },
        { 'id': bindingTrackID, 'dataType': 'ObjectBindingTrack', 'children': [{ 'id': spritePropertyTrackID }], 'clips': [] },
        {
          'id': spritePropertyTrackID,
          'dataType': 'SpritePropertyTrack',
          'path': 'sprite',
          'children': [],
          'clips': [
            { 'start': clipStart, 'duration': 2, 'endBehavior': 0, 'asset': { 'id': playableAssetID } },
          ],
        },
        {
          'id': playableAssetID,
          'dataType': 'SpritePropertyPlayableAsset',
          'keyframes': [
            [0.0, { 'id': spriteAID }],
            [0.5, { 'id': spriteBID }],
          ],
        },
        { 'id': spriteAID, 'dataType': 'Sprite', 'texture': { 'id': textureID }, 'rect': rectA, 'flipUv': 0 },
        { 'id': spriteBID, 'dataType': 'Sprite', 'texture': { 'id': textureID }, 'rect': rectB, 'flipUv': 0 },
      ],
      'compositionId': compositionID,
    },
    spriteAID, spriteBID, textureID, rectA, rectB,
  };
};

describe('core/plugins/timeline/sprite-property', () => {
  let player: Player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), pixelRatio: 1, manualRender: true });
  });

  after(() => {
    player && player.dispose();
  });

  // 单 clip 多关键帧：t<0.5 取 spriteA，t≥0.5 切 spriteB
  it('sprite property keyframe switches sprite', async () => {
    const { json, spriteAID, spriteBID, textureID, rectA } = buildKFrameScene();
    const comp = await player.loadScene(json);

    const spriteComp = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);

    // clip duration=2，keyframes 归一化 [0, 0.5]
    // t=0.1 → local 0.1 → 0.05 < 0.5 → spriteA
    player.gotoAndStop(0.1);
    let sprite = spriteComp.sprite;

    expect(sprite, 'sprite at 0.1').to.be.instanceOf(Sprite);
    expect(sprite.getInstanceId(), 'spriteA at 0.1').to.eql(spriteAID);
    expect(spriteComp.material.getTexture('_MainTex')!.getInstanceId(), 'tex at 0.1').to.eql(textureID);
    // aUV 对应 rectA=[0.25,0.25,0.5,0.5]：顶点 (-0.5,0.5) → uv=(0.25,0.75)
    const aUV = spriteComp.geometry.getAttributeData('aUV') as Float32Array;

    expect(aUV[0]).to.be.closeTo(rectA[0], 1e-4);
    expect(aUV[1]).to.be.closeTo(rectA[1] + rectA[3], 1e-4);

    // t=1.1 → local 1.1 → 0.55 ≥ 0.5 → spriteB
    player.gotoAndStop(1.1);
    sprite = spriteComp.sprite;
    expect(sprite.getInstanceId(), 'spriteB at 1.1').to.eql(spriteBID);
  });

  // 阶梯边界：恰在关键帧 0.5 时刻（local time=1.0）取该帧 spriteB
  it('sprite property keyframe step boundary', async () => {
    const { json, spriteAID, spriteBID } = buildKFrameScene();
    const comp = await player.loadScene(json);

    const spriteComp = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);

    // local=1.0 → 0.5，time ≤ t 规则取 spriteB
    player.gotoAndStop(1.0);
    expect(spriteComp.sprite.getInstanceId(), 'boundary 1.0').to.eql(spriteBID);
    // local=0.99 → 0.495 < 0.5 取 spriteA
    player.gotoAndStop(0.99);
    expect(spriteComp.sprite.getInstanceId(), 'before boundary 0.99').to.eql(spriteAID);
  });

  // clip 外（clip start=1）不切换：保持初始 spriteA
  it('sprite property keyframe out of clip keeps initial', async () => {
    const { json, spriteAID } = buildKFrameScene(1);
    const comp = await player.loadScene(json);

    const spriteComp = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);

    player.gotoAndStop(0.5);
    // clip 未开始，mixer 无激活 clip，保持 fromData 设的初始 spriteA
    expect(spriteComp.sprite.getInstanceId(), 'out of clip').to.eql(spriteAID);
  });

  // 关键帧 {id} 解析为 Sprite 实例
  it('sprite property keyframe resolves sprite reference', async () => {
    const { json, spriteAID } = buildKFrameScene();
    const comp = await player.loadScene(json);

    const spriteComp = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);

    player.gotoAndStop(0.1);
    // setter 后 sprite 是 Sprite 实例，texture 是 Texture 实例
    expect(spriteComp.sprite, 'sprite instance').to.be.instanceOf(Sprite);
    expect(spriteComp.sprite.texture, 'texture instance').to.be.instanceOf(Texture);
    expect(spriteComp.sprite.getInstanceId(), 'spriteA id').to.eql(spriteAID);
  });
});
