import type { spec } from '@galacean/effects';
import {
  Player, Sprite, SpriteComponent, SpriteRotation, Texture, generateGUID,
} from '@galacean/effects';

const { expect } = chai;

/**
 * 构造一张已切好区域的 Sprite 资产，验证 SpriteComponent 引用它的数据流（新数据路径）：
 * - texture 引用被正确解析为 Texture 实例（fromData 用 findObject 解析，不覆盖回裸 {id}）
 * - _MainTex 重绑到 sprite.texture（否则采白纹理黑屏）
 * - rect + rotation 驱动 geometry UV
 */
const buildScene = (opt: { spriteID: string, rect: spec.vec4, rotation: SpriteRotation }) => {
  const itemID = generateGUID();
  const componentID = generateGUID();
  const compositionID = generateGUID();
  const imageID = generateGUID();
  const textureID = generateGUID();
  const { spriteID, rect, rotation } = opt;

  return {
    json: {
      'images': [
        { 'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*MeN0T6slLYEAAAAAAAAAAAAADlB4AQ/original', 'id': imageID },
      ],
      'spines': [],
      'version': '3.0',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': compositionID,
          'name': 'Sprite 资产',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 2,
          'previewSize': [0, 0],
          'items': [{ id: itemID }],
          'camera': { 'fov': 60, 'far': 1000, 'near': 0.3, 'clipMode': 0, 'position': [0, 0, 8], 'rotation': [0, 0, 0] },
          sceneBindings: [],
        },
      ],
      'components': [
        {
          id: componentID,
          dataType: 'SpriteComponent',
          item: { id: itemID },
          // 关键：通过 sprite 引用 Sprite 资产，而非 renderer.texture
          sprite: { id: spriteID },
          renderer: { renderMode: 1 },
          options: { startColor: [1, 1, 1, 1] },
        },
      ],
      'miscs': [
        {
          id: spriteID,
          dataType: 'Sprite',
          texture: { id: textureID },
          rect,
          rotation,
        },
      ],
      'items': [
        {
          id: itemID, duration: 5, type: '1', visible: true, endBehavior: 0, delay: 0,
          name: 'sprite_1', dataType: 'VFXItemData', components: [{ id: componentID }],
        },
      ],
      'materials': [], 'shaders': [], 'geometries': [], 'bins': [],
      'renderLevel': 'B+', 'requires': [], 'compositionId': compositionID,
      'textures': [
        {
          sourceType: 2, keepImageSource: true, minFilter: 9729, magFilter: 9729,
          id: textureID, dataType: 'Texture', source: { id: imageID }, flipY: true,
        },
      ],
    },
    textureID,
  };
};

/**
 * 构造老版本数据（renderer.texture + splits，无 sprite），验证 version37Migration
 * 把它转成 Sprite 资产 + 组件 sprite 引用，且渲染结果与旧 splits 一致（faithful）。
 */
const buildLegacyScene = (opt: { splits: spec.SplitParameter, textureID: string }) => {
  const itemID = generateGUID();
  const componentID = generateGUID();
  const compositionID = generateGUID();
  const imageID = generateGUID();
  const { splits, textureID } = opt;

  return {
    json: {
      'images': [
        { 'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*MeN0T6slLYEAAAAAAAAAAAAADlB4AQ/original', 'id': imageID },
      ],
      'spines': [],
      'version': '3.0',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': compositionID,
          'name': '老数据',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 2,
          'previewSize': [0, 0],
          'items': [{ id: itemID }],
          'camera': { 'fov': 60, 'far': 1000, 'near': 0.3, 'clipMode': 0, 'position': [0, 0, 8], 'rotation': [0, 0, 0] },
          sceneBindings: [],
        },
      ],
      'components': [
        {
          id: componentID,
          dataType: 'SpriteComponent',
          item: { id: itemID },
          // 老数据：renderer.texture + splits，无 sprite
          renderer: { renderMode: 1, texture: { id: textureID } },
          splits: [splits],
          options: { startColor: [1, 1, 1, 1] },
        },
      ],
      'items': [
        {
          id: itemID, duration: 5, type: '1', visible: true, endBehavior: 0, delay: 0,
          name: 'sprite_1', dataType: 'VFXItemData', components: [{ id: componentID }],
        },
      ],
      'materials': [], 'shaders': [], 'geometries': [], 'bins': [], 'miscs': [],
      'renderLevel': 'B+', 'requires': [], 'compositionId': compositionID,
      'textures': [
        {
          sourceType: 2, keepImageSource: true, minFilter: 9729, magFilter: 9729,
          id: textureID, dataType: 'Texture', source: { id: imageID }, flipY: true,
        },
      ],
    },
  };
};

describe('core/plugins/sprite/sprite-asset', () => {
  let player: Player;

  before(() => {
    const canvas = document.createElement('canvas');

    player = new Player({ canvas, pixelRatio: 1, manualRender: true, interactive: true });
  });

  after(() => {
    player && player.dispose();
  });

  // 新 Sprite 资产被组件引用：纹理引用解析、_MainTex 重绑、UV 切片
  it('sprite asset referenced by component', async () => {
    const spriteID = generateGUID();
    const { json, textureID } = buildScene({ spriteID, rect: [0.25, 0.25, 0.5, 0.5], rotation: SpriteRotation.None });
    const comp = await player.loadScene(json);

    player.gotoAndPlay(0.01);

    const spriteComp = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);
    const sprite = spriteComp.sprite;

    // P0#1：texture 被解析为 Texture 实例，而非裸 {id}
    expect(sprite, 'sprite').to.be.instanceOf(Sprite);
    expect(sprite.texture, 'sprite.texture').to.be.instanceOf(Texture);
    expect(sprite.texture.getInstanceId(), 'sprite.texture.guid').to.eql(textureID);

    // P0#2：_MainTex 重绑到 sprite.texture，而非 super.fromData 设置的白纹理
    const mainTex = spriteComp.material.getTexture('_MainTex')!;

    expect(mainTex, '_MainTex').to.equal(sprite.texture);
    expect(mainTex.getInstanceId(), '_MainTex.guid').to.eql(textureID);

    // rect 还原 splits 驱动 geometry UV：rect=[0.25,0.25,0.5,0.5], flip=0
    // 顶点 aPos 顺序 [(-0.5,0.5),(-0.5,-0.5),(0.5,0.5),(0.5,-0.5)] →
    // aUV = [0.25,0.75, 0.25,0.25, 0.75,0.75, 0.75,0.25]
    const aUV = spriteComp.geometry.getAttributeData('aUV') as Float32Array;

    expect(aUV[0]).to.be.closeTo(0.25, 1e-4);
    expect(aUV[1]).to.be.closeTo(0.75, 1e-4);
    expect(aUV[4]).to.be.closeTo(0.75, 1e-4);
    expect(aUV[5]).to.be.closeTo(0.75, 1e-4);
  });

  // rotation=1 时 UV 旋转 90°
  it('sprite asset rotation rotates UV', async () => {
    const spriteID = generateGUID();
    const { json } = buildScene({ spriteID, rect: [0.25, 0.25, 0.5, 0.5], rotation: SpriteRotation.Rotate90 });
    const comp = await player.loadScene(json);

    player.gotoAndPlay(0.01);

    const spriteComp = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);
    const aUV = spriteComp.geometry.getAttributeData('aUV') as Float32Array;

    // flip=1：(-0.5,0.5) 旋转 -90° → (0.5,0.5) → uv=(0.75,0.75)
    expect(aUV[0]).to.be.closeTo(0.75, 1e-4);
    expect(aUV[1]).to.be.closeTo(0.75, 1e-4);
  });

  // 运行时通过 sprite setter 切换资产：重建 _MainTex 与 UV
  it('sprite setter switches sprite at runtime', async () => {
    const spriteID = generateGUID();
    const { json } = buildScene({ spriteID, rect: [0.25, 0.25, 0.5, 0.5], rotation: SpriteRotation.None });
    const comp = await player.loadScene(json);

    player.gotoAndPlay(0.01);

    const spriteComp = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);
    const oldTex = spriteComp.material.getTexture('_MainTex')!;

    const newSprite = new Sprite(player.renderer.engine);

    newSprite.texture = oldTex;
    newSprite.rect = [0, 0, 0.5, 0.5];
    newSprite.rotation = SpriteRotation.None;
    spriteComp.sprite = newSprite;

    expect(spriteComp.sprite).to.equal(newSprite);
    expect(spriteComp.material.getTexture('_MainTex')).to.equal(newSprite.texture);

    // rect=[0,0,0.5,0.5], flip=0 → aUV[0]=0（原来 0.25）
    const aUV = spriteComp.geometry.getAttributeData('aUV') as Float32Array;

    expect(aUV[0]).to.be.closeTo(0, 1e-4);
    expect(aUV[1]).to.be.closeTo(0.5, 1e-4);
  });

  // 反序列化：fromData 手动用 findObject 把 {id} 解析为 Texture 实例（非裸 {id}）
  it('sprite asset deserialize resolves texture reference', () => {
    const engine = player.renderer.engine;
    const spriteID = generateGUID();
    const data = {
      id: spriteID,
      dataType: 'Sprite' as unknown as spec.DataType,
      texture: { id: engine.whiteTexture.getInstanceId() },
      rect: [0.1, 0.2, 0.3, 0.4] as spec.vec4,
      rotation: SpriteRotation.Rotate90,
    };

    engine.addEffectsObjectData(data as spec.EffectsObjectData);

    const sprite = engine.findObject<Sprite>({ id: spriteID });

    expect(sprite, 'deserialized sprite').to.be.instanceOf(Sprite);
    // fromData 用 findObject 解析，texture 是 Texture 实例而非裸 {id}
    expect(sprite.texture, 'deserialized texture').to.be.instanceOf(Texture);
    expect(sprite.texture).to.equal(engine.whiteTexture);
    expect(sprite.rect).to.eql([0.1, 0.2, 0.3, 0.4]);
    expect(sprite.rotation).to.eql(1);
  });

  // 老数据（renderer.texture + splits）经 version37Migration 迁移为 Sprite 资产
  it('legacy splits migrates to sprite asset', async () => {
    const textureID = generateGUID();
    const splits: spec.SplitParameter = [0.25, 0.25, 0.5, 0.5, 0];
    const { json } = buildLegacyScene({ splits, textureID });
    const comp = await player.loadScene(json);

    player.gotoAndPlay(0.01);

    const spriteComp = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);
    const sprite = spriteComp.sprite;

    // 迁移产物：组件持有 sprite，rect/rotation 由 splits[0] 还原，纹理指向原 texture
    expect(sprite, 'migrated sprite').to.be.instanceOf(Sprite);
    expect(sprite.rect, 'rect').to.eql([0.25, 0.25, 0.5, 0.5]);
    expect(sprite.rotation, 'rotation').to.eql(0);
    expect(sprite.texture, 'texture').to.be.instanceOf(Texture);
    expect(sprite.texture.getInstanceId(), 'texture.guid').to.eql(textureID);
    expect(spriteComp.material.getTexture('_MainTex'), '_MainTex').to.equal(sprite.texture);

    // faithful：UV 与直接构造同 rect/flip 的 sprite 一致
    const aUV = spriteComp.geometry.getAttributeData('aUV') as Float32Array;

    expect(aUV[0]).to.be.closeTo(0.25, 1e-4);
    expect(aUV[1]).to.be.closeTo(0.75, 1e-4);
    expect(aUV[4]).to.be.closeTo(0.75, 1e-4);
    expect(aUV[5]).to.be.closeTo(0.75, 1e-4);
  });

  // 老数据 flip=1 迁移后 UV 旋转一致
  it('legacy splits flip migrates to sprite asset', async () => {
    const textureID = generateGUID();
    const splits: spec.SplitParameter = [0.25, 0.25, 0.5, 0.5, 1];
    const { json } = buildLegacyScene({ splits, textureID });
    const comp = await player.loadScene(json);

    player.gotoAndPlay(0.01);

    const spriteComp = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);
    const sprite = spriteComp.sprite;

    expect(sprite.rotation, 'rotation').to.eql(1);

    const aUV = spriteComp.geometry.getAttributeData('aUV') as Float32Array;

    // flip=1：(-0.5,0.5) 旋转 -90° → (0.5,0.5) → uv=(0.75,0.75)
    expect(aUV[0]).to.be.closeTo(0.75, 1e-4);
    expect(aUV[1]).to.be.closeTo(0.75, 1e-4);
  });
});
