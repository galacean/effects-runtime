// @ts-nocheck
import {
  Player, spec, Texture,
  setSpriteMeshMaxItemCountByGPU,
  setMaxSpriteMeshItemCount,
  setSpriteMeshMaxFragmentTextures,
} from '@galacean/effects';
import { generateSceneJSON, mapSpriteGroupItemIndices, mapSplitItemNames } from './utils';

const { expect } = chai;

// 测试sprite-group中的每个函数 每个it的title中[]内为对应的函数名
describe('combine sprite meshes according to items', () => {
  let player, engine;

  before(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      manualRender: true,
    });
    engine = player.renderer.engine;
  });

  after(() => {
    player && player.dispose();
    engine = null;
  });

  beforeEach(() => {
    player && player.destroyCurrentCompositions();
  });

  // 不可见的元素不参与合并
  it('[getMeshSplits] combine composition items ignore invisible items', async () => {
    const comp = await player.loadScene(generateSceneByOpts([
      {},
      { delay: 1 },
      {},
      { blending: 1, delay: 1 },
      {},
      {},
    ]));

    player.gotoAndPlay(0.01);
    const spriteGroup = comp.loaderData.spriteGroup;
    let splits = spriteGroup.getMeshSplits(comp.items, 0, comp.items.length - 1, true);

    expect(splits.length).to.eql(3);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1', 'item_2']);
    expect(mapSplitItemNames(splits[1])).to.deep.equal(['item_3']);
    expect(mapSplitItemNames(splits[2])).to.deep.equal(['item_4', 'item_5']);
    const item1 = comp.getItemByName('item_1');
    const item3 = comp.getItemByName('item_3');

    expect(item1.contentVisible).to.be.false;
    expect(item3.contentVisible).to.be.false;
    splits = spriteGroup.getMeshSplits(comp.items);
    expect(splits.length).to.eql(1);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_2', 'item_4', 'item_5']);
  });

  // 粒子元素不参与合并
  it('[getMeshSplits] combine composition items ignore invisible items and other type', async () => {

    const comp = await player.loadScene(generateSceneByOpts([
      {}, { delay: 1 }, {},
      { blending: 1, delay: 1 },
      {}, //4
      { isParticle: true }, {}, { blending: 1 }, {}, //6,7,8
      { isParticle: true, delay: 1 }, {}, //10
    ]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    let splits = spriteGroup.getMeshSplits(comp.items, 0, comp.items.length - 1, true);

    expect(splits.length).to.eql(7);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1', 'item_2']);
    expect(mapSplitItemNames(splits[1])).to.deep.equal(['item_3']);
    expect(mapSplitItemNames(splits[2])).to.deep.equal(['item_4']);
    expect(mapSplitItemNames(splits[3])).to.deep.equal(['item_6']);
    expect(mapSplitItemNames(splits[4])).to.deep.equal(['item_7']);
    expect(mapSplitItemNames(splits[5])).to.deep.equal(['item_8']);
    expect(mapSplitItemNames(splits[6])).to.deep.equal(['item_10']);
    splits = spriteGroup.getMeshSplits(comp.items);
    expect(splits.length).to.eql(4);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_2', 'item_4']);
    expect(mapSplitItemNames(splits[1])).to.deep.equal(['item_6']);
    expect(mapSplitItemNames(splits[2])).to.deep.equal(['item_7']);
    expect(mapSplitItemNames(splits[3])).to.deep.equal(['item_8', 'item_10']);
  });

  // 具有相同cacheId（材质状态）的会合并
  it('[getMeshSplits] combine same cacheId sprite', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{
      blending: 2,
      renderMode: 1,
      side: spec.SideMode.FRONT,
    }, {
      blending: 2,
      renderMode: 1,
      side: spec.SideMode.FRONT,
    }]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(1);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1']);
  });

  // 具有不同cacheId（材质状态）的不会合并
  it('[getMeshSplits] spilt different renderId siblings', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{ blending: 1 }, { blending: 0 }]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(2);
    expect(splits[0].items.map(i => i.name)).to.deep.equal(['item_0']);
    expect(splits[1].items.map(i => i.name)).to.deep.equal(['item_1']);
  });

  // 每个mesh允许容纳的最多item不超过maxSpriteMeshItemCount
  it('[getMeshSplits] combine items count less than maxSpriteMeshItemCount', async () => {
    const originalDetail = engine.gpuCapability.detail;

    engine.gpuCapability.detail.maxVertexUniforms = 128; // 此时一个mesh最多容纳16个item
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
    const comp = await player.loadScene(generateSceneByOpts(new Array(17).fill({})));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(2);
    expect(splits[0].items.map(i => i.name)).to.deep.equal(new Array(16).fill('item').map((name, i) => `${name}_${i}`));
    expect(splits[1].items.map(i => i.name)).to.deep.equal(['item_16']);
    engine.gpuCapability.detail.maxVertexUniforms = 128;
    engine.gpuCapability.detail = originalDetail;
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // getMeshSplits包含的item数量不超过maxSpriteTextureCount
  it('[getMeshSplits] meshSplit\'s item count no more than maxSpriteTextureCount', async () => {
    setSpriteMeshMaxFragmentTextures(3);
    setMaxSpriteMeshItemCount(4);
    const comp = await player.loadScene(generateSceneByOpts([{
      texture: Texture.createWithData(engine, { data: new Uint8Array(4), width: 1, height: 1 }),
    }, {
      texture: Texture.createWithData(engine, { data: new Uint8Array(4), width: 1, height: 1 }),
    },
    {
      texture: Texture.createWithData(engine, { data: new Uint8Array(4), width: 1, height: 1 }),
    },
    {
      delay: 0.5,
      name: 'm',
      texture: Texture.createWithData(engine, { data: new Uint8Array(4), width: 1, height: 1 }),
    },
    {
      texture: Texture.createWithData(engine, { data: new Uint8Array(4), width: 1, height: 1 }),
    },
    {
      texture: Texture.createWithData(engine, { data: new Uint8Array(4), width: 1, height: 1 }),
    },
    ]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    let splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(2);
    comp.forwardTime(1);
    splits = spriteGroup.meshSplits;
    expect(splits.length).to.eql(2);
    expect(splits[1].items[0].name).to.eql('m');

    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 添加1个item到meshSplit
  it('[addMeshSplitsItem] add first item with splits', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = [];
    const items = [];
    const add = spriteGroup.addMeshSplitsItem(items, comp.items[0], splits);

    expect(add).to.be.an('array').with.lengthOf(1);
    expect(splits).to.deep.equal(add);
    expect(items).to.deep.equal(comp.items);
  });

  // 添加2个item到meshSplit
  it('[addMeshSplitsItem] add 2 items with splits', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = [];
    const items = [];

    spriteGroup.addMeshSplitsItem(items, comp.items[0], splits);
    const add = spriteGroup.addMeshSplitsItem(items, comp.items[1], splits);

    expect(items).to.deep.equal(comp.items);
    expect(add).to.be.an('array').with.lengthOf(0);
    expect(splits).to.be.an('array').with.lengthOf(1);
    expect(splits[0]).to.includes({ indexStart: 0, indexEnd: 1 });
    expect(splits[0].items).to.deep.equal(items);
  });

  // 按照指定顺序添加item到meshSplit
  it('[addMeshSplitsItem] add 3 items with splits order independent', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = [];
    const items = [];
    const listIndices = comp.items.map(item => item.listIndex);

    expect(listIndices).to.eql([0, 1, 2]);
    spriteGroup.addMeshSplitsItem(items, comp.items[0], splits);
    spriteGroup.addMeshSplitsItem(items, comp.items[2], splits);
    spriteGroup.addMeshSplitsItem(items, comp.items[1], splits);
    check('0-2-1-');

    splits.length = 0;
    items.length = 0;
    spriteGroup.addMeshSplitsItem(items, comp.items[1], splits);
    spriteGroup.addMeshSplitsItem(items, comp.items[2], splits);
    spriteGroup.addMeshSplitsItem(items, comp.items[0], splits);

    check('1-2-0-');

    function check (name) {
      expect(items).to.deep.equal(comp.items);
      expect(splits).to.be.an('array').with.lengthOf(1);
      expect(splits[0]).to.includes({ indexStart: 0, indexEnd: 2 });
      expect(splits[0].items).to.deep.equal(items);
    }
  });

  // 按照指定顺序添加item到meshSplit
  it('[addMeshSplitsItem] add 4 items with splits', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, {}, {}]));

    setMaxSpriteMeshItemCount(3);
    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = [];
    const items = [];
    const orders = [
      [0, 1, 2, 3],
      [2, 1, 3, 0],
      [3, 2, 0, 1],
      [1, 3, 0, 2],
    ];

    orders.forEach(order => {
      splits.length = 0;
      items.length = 0;
      for (let i = 0; i < order.length; i++) {
        spriteGroup.addMeshSplitsItem(items, comp.items[order[i]], splits);
      }
      check(order.join('-') + ':');
    });

    function check (name) {
      expect(items).to.deep.equal(comp.items);
      expect(splits).to.be.an('array').with.lengthOf(2);
      expect(splits[0]).to.includes({ indexStart: 0, indexEnd: 2 });
      expect(splits[0].items).to.deep.equal(items.slice(0, 3));
      expect(splits[1]).to.includes({ indexStart: 3, indexEnd: 3 });
      expect(splits[1].items).to.deep.equal(items.slice(3));
    }

    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 添加cacheId不同的item到meshSplit
  it('[addMeshSplitsItem] add different cacheId item with splits', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, { blending: 1 }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = [];
    const items = [];

    spriteGroup.addMeshSplitsItem(items, comp.items[0], splits);
    const add = spriteGroup.addMeshSplitsItem(items, comp.items[1], splits);

    spriteGroup.addMeshSplitsItem(items, comp.items[2], splits);
    expect(items).to.deep.equal(comp.items);
    expect(add).to.be.an('array').with.lengthOf(1);
    expect(splits).to.be.an('array').with.lengthOf(3);
    expect(splits[0]).to.includes({ indexStart: 0, indexEnd: 0 });
    expect(splits[0].items).to.deep.equal([items[0]]);
    expect(splits[1]).to.includes({ indexStart: 1, indexEnd: 1 });
    expect(splits[1].items).to.deep.equal([items[1]]);
    expect(splits[2]).to.includes({ indexStart: 2, indexEnd: 2 });
    expect(splits[2].items).to.deep.equal([items[2]]);
  });

  // 不同cacheId的不放在一个meshSplit
  it('[addMeshSplitsItem] add different cacheId item with splits ignore order', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, { blending: 1 }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = [];
    const items = [];

    spriteGroup.addMeshSplitsItem(items, comp.items[0], splits);
    spriteGroup.addMeshSplitsItem(items, comp.items[2], splits);
    const add = spriteGroup.addMeshSplitsItem(items, comp.items[1], splits);

    expect(items).to.deep.equal(comp.items);
    expect(add).to.be.an('array').with.lengthOf(2);
    expect(splits).to.be.an('array').with.lengthOf(3);
    expect(splits[0]).to.includes({ indexStart: 0, indexEnd: 0 });
    expect(splits[0].items).to.deep.equal([items[0]]);
    expect(splits[1]).to.includes({ indexStart: 1, indexEnd: 1 });
    expect(splits[1].items).to.deep.equal([items[1]]);
    expect(splits[2]).to.includes({ indexStart: 2, indexEnd: 2 });
    expect(splits[2].items).to.deep.equal([items[2]]);
  });

  // 粒子元素在中间 前后的item不会放到同一个meshSplit
  it('[addMeshSplitsItem] add particle with splits', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, { isParticle: true }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = [];
    const items = [];

    for (let i = 0; i < comp.items.length; i++) {
      spriteGroup.addMeshSplitsItem(items, comp.items[i], splits);
    }
    expect(items).to.deep.equal(comp.items);
    expect(splits).to.be.an('array').with.lengthOf(2);
    expect(splits[0]).to.includes({ indexStart: 0, indexEnd: 0 });
    expect(splits[0].items).to.deep.equal([items[0]]);
    expect(splits[1]).to.includes({ indexStart: 2, indexEnd: 2 });
    expect(splits[1].items).to.deep.equal([items[2]]);
  });

  // 粒子元素最后添加 前后的item放到同一个meshSplit
  it('[addMeshSplitsItem] add particle with splits order independent', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, { isParticle: true }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = [];
    const items = [];

    spriteGroup.addMeshSplitsItem(items, comp.items[0], splits);
    spriteGroup.addMeshSplitsItem(items, comp.items[2], splits);
    spriteGroup.addMeshSplitsItem(items, comp.items[1], splits);
    expect(items).to.deep.equal(comp.items);
    expect(splits).to.be.an('array').with.lengthOf(2);
    expect(splits[0]).to.includes({ indexStart: 0, indexEnd: 0 });
    expect(splits[0].items).to.deep.equal([items[0]]);
    expect(splits[1]).to.includes({ indexStart: 2, indexEnd: 2 });
    expect(splits[1].items).to.deep.equal([items[2]]);
  });

  // 从meshSplit中删除指定元素
  it('[removeMeshSplitsItem] delete sprite items', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const items = comp.items;
    const splits = spriteGroup.getMeshSplits(items);

    spriteGroup.removeMeshSplitsItem(items, items[0], splits);
    expect(splits.length).to.eql(1);
    const split = splits[0];

    expect(split.items.map(i => i.name)).to.deep.equal(['item_1']);
  });

  // 第一张meshSplit中元素被删除 合并后一张meshSplit
  it('[removeMeshSplitsItem] combine to first mesh after item removed from it', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, {}, {}]));

    setMaxSpriteMeshItemCount(3);
    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(2);
    const items = comp.items;
    const firstItem = items[0];

    firstItem.lifetime = 0;
    spriteGroup.removeMeshSplitsItem(items, firstItem, splits);
    expect(splits.length).to.eql(1);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_1', 'item_2', 'item_3']);
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 最后一张meshSplit中元素被删空 合并到前一张meshSplit
  it('[removeMeshSplitsItem] combine to last mesh after item remove', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, {}, {}]));

    setMaxSpriteMeshItemCount(3);
    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);
    const items = comp.items;
    const item = items[3];

    item.lifetime = 0;
    spriteGroup.removeMeshSplitsItem(items, item, splits);
    expect(splits.length).to.eql(1);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1', 'item_2']);
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 中间meshSplit中元素被删空 合并前或后一张meshSplit
  it('[removeMeshSplitsItem] combine middle mesh after invisible', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, {}, {}, {}, {}, {}]));

    setMaxSpriteMeshItemCount(3);
    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(3);
    const items = comp.items;
    const item = items[3];

    item.lifetime = 0;
    spriteGroup.removeMeshSplitsItem(items, item, splits);
    expect(splits.length).to.eql(2);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1', 'item_2']);
    expect(mapSplitItemNames(splits[1])).to.deep.equal(['item_4', 'item_5', 'item_6']);
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // meshSplit的cacheId不同时 无法合并
  it('[removeMeshSplitsItem] will not combine different cache mesh after invisible', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, { blending: 1 }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(3);
    const items = comp.items;
    const item = items[0];

    item.lifetime = 0;
    spriteGroup.removeMeshSplitsItem(items, item, splits);
    expect(splits.length).to.eql(3);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_1']);
    expect(mapSplitItemNames(splits[1])).to.deep.equal(['item_2']);
    expect(mapSplitItemNames(splits[2])).to.deep.equal(['item_3']);
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 具有相同cacheId的mesh在中间mesh移除后会被合并
  it('[removeMeshSplitsItem] combine meshes with same cacheId after mesh between them has been removed', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, { blending: 1 }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(3);
    const items = comp.items;
    const item = items[2];

    item.lifetime = 0;
    spriteGroup.removeMeshSplitsItem(items, item, splits);
    expect(splits.length).to.eql(1);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1', 'item_3']);
  });

  // 具有相同cacheId的mesh在中间其它类型元素结束后会合并
  it('[combineSplits] combine mesh for same cacheId after different type invisible', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, { isParticle: true }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(2);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1']);
    expect(mapSplitItemNames(splits[1])).to.deep.equal(['item_3']);
    const items = comp.items;
    const item = items[2];

    item.lifetime = -0.1;
    spriteGroup.combineSplits(items, 1, splits);
    expect(splits.length).to.eql(1);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1', 'item_3']);
  });

  // 具有相同cacheId的mesh在中间其它类型元素移除后会合并
  it('[combineSplits] combine mesh for same cacheId after different type delete', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, { isParticle: true }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(2);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1']);
    expect(mapSplitItemNames(splits[1])).to.deep.equal(['item_3']);
    const items = comp.items;

    items.splice(2, 1);
    spriteGroup.combineSplits(items, 1, splits);
    expect(splits.length).to.eql(1);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1', 'item_3']);
  });

  // 两个meshSplit中间有其它类型元素时不合并
  it('[combineSplits] no combine mesh if there is different type', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, { isParticle: true }, { isParticle: true }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(2);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1']);
    expect(mapSplitItemNames(splits[1])).to.deep.equal(['item_4']);
    const items = comp.items;

    items.splice(2, 1);
    spriteGroup.combineSplits(items, 1, splits);
    expect(splits.length).to.eql(2);
    expect(mapSplitItemNames(splits[0])).to.deep.equal(['item_0', 'item_1']);
    expect(mapSplitItemNames(splits[1])).to.deep.equal(['item_4']);
  });

  // 合成播放结束后移除items和对应的meshSplits
  it('[diffMeshSplits] remove all items when end without triggering error', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, {}, {}, {}]));

    setMaxSpriteMeshItemCount(3);
    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;
    const splits = spriteGroup.getMeshSplits(comp.items);

    expect(splits.length).to.eql(2);
    comp.forwardTime(5);
    expect(spriteGroup.meshSplits.length).to.eql(0);
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // meshSplit元素删空后 会在diffMeshSplits().remove中返回用于删除spriteMesh
  it('[diffMeshSplits] diff mesh when item is deleted', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    spriteGroup.resetMeshSplits(comp);
    spriteGroup.addItem(comp.items[0]);
    let ret = spriteGroup.diffMeshSplits();

    expect(ret).to.be.an('object');
    expect(ret.add).to.be.an('array').that.with.lengthOf(1);

    spriteGroup.removeItem(comp.items[0]);

    ret = spriteGroup.diffMeshSplits();
    expect(ret).to.be.an('object');
    expect(ret.remove).to.be.an('array').that.with.lengthOf(1);
    expect(spriteGroup.meshSplits.length).is.to.eql(0);
    expect(spriteGroup.meshes.length).is.to.eql(0);
  });

  // meshSplit渲染顺序修改后 会在diffMeshSplits().modify中返回
  it('[diffMeshSplits] diff mesh to modify priority', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    spriteGroup.resetMeshSplits();
    comp.items.forEach(item => spriteGroup.addItem(item));
    spriteGroup.diffMeshSplits();
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_1', 'item_2']);
    expect(spriteGroup.meshes[0].priority).is.to.eql(comp.items[0].listIndex);
    spriteGroup.removeItem(comp.items[0]);
    const ret = spriteGroup.diffMeshSplits();

    expect(ret).to.be.an('object');
    expect(ret.modify).to.be.an('array').that.with.lengthOf(1);
    expect(spriteGroup.meshSplits.length).is.to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_1', 'item_2']);
    expect(spriteGroup.meshes).to.be.an('array').that.to.deep.equal(ret.modify);
    expect(spriteGroup.meshes[0].priority).is.to.eql(comp.items[1].listIndex, 'listIndex');
  });

  // 元素间的粒子元素移除后 diffMeshSplits()会把他们合并到一个meshSplit 并返回需要删除的那一个
  it('[diffMeshSplits] diff mesh to combine when particle delete', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, { isParticle: true }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    spriteGroup.resetMeshSplits();
    comp.items.forEach(item => spriteGroup.addItem(item));
    spriteGroup.diffMeshSplits();
    spriteGroup.removeItem(comp.items[1]);
    const ret = spriteGroup.diffMeshSplits();

    expect(ret).to.be.an('object');
    expect(ret.remove).to.be.an('array').that.with.lengthOf(1);
    expect(spriteGroup.meshSplits.length).to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_2']);
    expect(spriteGroup.meshes).to.be.an('array').that.includes(spriteGroup.meshSplits[0].spriteMesh.mesh)
      .not.to.have.members(ret.remove);
  });

  // 元素间的图层元素移除后 diffMeshSplits()会把他们合并到一个meshSplit 并返回需要删除的那一个
  it('[diffMeshSplits] diff mesh to combine when middle item delete', async () => {
    setMaxSpriteMeshItemCount(3);
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, {}, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    spriteGroup.resetMeshSplits();
    comp.items.forEach(item => spriteGroup.addItem(item));
    spriteGroup.diffMeshSplits();
    expect(spriteGroup.meshSplits.length).is.eql(2);
    spriteGroup.removeItem(comp.items[1]);
    const ret = spriteGroup.diffMeshSplits();

    expect(ret).to.be.an('object');
    expect(ret.remove).to.be.an('array').that.with.lengthOf(1);
    expect(spriteGroup.meshSplits.length).to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_2', 'item_3']);
    expect(spriteGroup.meshes).to.be.an('array').that.includes(spriteGroup.meshSplits[0].spriteMesh.mesh)
      .not.to.have.members(ret.remove);
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 排在最后的图层元素移除后 diffMeshSplits()会返回需要删除的那个meshSplit
  it('[diffMeshSplits] diff mesh to combine when last item delete', async () => {
    setMaxSpriteMeshItemCount(3);
    const comp = await player.loadScene(generateSceneByOpts([{}, {}, {}, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    spriteGroup.resetMeshSplits();
    comp.items.forEach(item => spriteGroup.addItem(item));
    spriteGroup.diffMeshSplits();
    expect(spriteGroup.meshSplits.length).is.eql(2);
    spriteGroup.removeItem(comp.items[3]);
    const ret = spriteGroup.diffMeshSplits();

    expect(ret).to.be.an('object');
    expect(ret.remove).to.be.an('array').that.with.lengthOf(1);
    expect(spriteGroup.meshSplits.length).to.eql(1);
    expect(spriteGroup.meshes.length).to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_1', 'item_2']);
    expect(spriteGroup.meshes).to.be.an('array').that.includes(spriteGroup.meshSplits[0].spriteMesh.mesh)
      .not.to.have.members(ret.remove);
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 删除多个元素 diffMeshSplits()会尝试合并剩余的到一个meshSplit 并返回需要删除的
  it('[diffMeshSplits] diff mesh to combine when multiple items are deleted', async () => {
    setMaxSpriteMeshItemCount(3);
    const comp = await player.loadScene(generateSceneByOpts([{}, { isParticle: true }, {}, {}, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    spriteGroup.resetMeshSplits();
    comp.items.forEach(item => spriteGroup.addItem(item));
    spriteGroup.diffMeshSplits();
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_2', 'item_3', 'item_4']);
    expect(spriteGroup.meshSplits.length).is.eql(2);

    spriteGroup.removeItem(comp.items[1]);
    spriteGroup.removeItem(comp.items[2]);
    const ret = spriteGroup.diffMeshSplits();

    expect(ret).to.be.an('object');
    expect(ret.remove).to.be.an('array').that.with.lengthOf(1);
    expect(spriteGroup.meshSplits.length).to.eql(1);
    expect(spriteGroup.meshes.length).to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_3', 'item_4']);
    expect(spriteGroup.meshes).to.be.an('array').that.includes(spriteGroup.meshSplits[0].spriteMesh.mesh);
    expect(spriteGroup.meshes).not.includes(ret.remove[0]);
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 删除多个其它类型的元素 diffMeshSplits()会尝试合并剩余的到一个meshSplit 并返回需要删除的
  it('[diffMeshSplits] diff mesh to combine when multiple other type items are deleted', async () => {
    setMaxSpriteMeshItemCount(3);
    const comp = await player.loadScene(generateSceneByOpts([{}, { isParticle: true }, {}, { isParticle: true }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    spriteGroup.resetMeshSplits();
    comp.items.forEach(item => spriteGroup.addItem(item));
    spriteGroup.diffMeshSplits();
    expect(spriteGroup.meshSplits.length).is.eql(3);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_2']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[2])).to.deep.equal(['item_4']);

    spriteGroup.removeItem(comp.items[1]);
    spriteGroup.removeItem(comp.items[3]);
    const ret = spriteGroup.diffMeshSplits();

    expect(ret).to.be.an('object');
    expect(ret.remove).to.be.an('array').that.with.lengthOf(2);
    expect(spriteGroup.meshSplits.length).to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_2', 'item_4']);
    expect(spriteGroup.meshes).to.be.an('array')
      .with.lengthOf(1)
      .that.includes(spriteGroup.meshSplits[0].spriteMesh.mesh)
      .not.to.have.members(ret.remove);
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 删除多个其它类型的元素 diffMeshSplits()会尝试合并剩余的到一个meshSplit 并返回需要删除的
  it('[diffMeshSplits] diff mesh to combine when multiple other type items are deleted', async () => {
    setMaxSpriteMeshItemCount(3);
    const comp = await player.loadScene(generateSceneByOpts([{}, { isParticle: true }, { isParticle: true }, {}, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    spriteGroup.resetMeshSplits();
    comp.items.forEach(item => spriteGroup.addItem(item));
    spriteGroup.diffMeshSplits();
    expect(spriteGroup.meshSplits.length).is.eql(2);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_3', 'item_4']);
    spriteGroup.removeItem(comp.items[1]);
    spriteGroup.removeItem(comp.items[2]);
    const ret = spriteGroup.diffMeshSplits();

    expect(ret).to.be.an('object');
    expect(ret.remove).to.be.an('array').that.with.lengthOf(1);
    expect(spriteGroup.meshSplits.length).to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_3', 'item_4']);
    expect(spriteGroup.meshes).to.be.an('array')
      .with.lengthOf(1)
      .that.includes(spriteGroup.meshSplits[0].spriteMesh.mesh)
      .not.to.have.members(ret.remove);
    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 元素结束后 diff算法会从把它从meshSplits的items中移除
  it('[diffMeshSplits] sprite group meshes will be combined after item end', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, { blending: 2, duration: 0.5 }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    expect(spriteGroup.meshSplits.length).to.eql(3);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_1']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[2])).to.deep.equal(['item_2']);
    player.gotoAndStop(comp.time + 1);
    player.tick(1);
    expect(spriteGroup.meshSplits.length).to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_2']);
  });

  // 元素开始后 diff算法会从把它添加到meshSplits的items中
  it('[diffMeshSplits] sprite group meshes will be combined after item life begin', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, { blending: 2, delay: 1 }, {}]));

    player.gotoAndStop(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    expect(spriteGroup.meshSplits.length).to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_2']);
    player.gotoAndStop(comp.time + 1);
    player.tick(1);
    expect(spriteGroup.meshSplits.length).to.eql(3);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_1']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[2])).to.deep.equal(['item_2']);
    player.gotoAndStop(comp.time + 1);
    player.tick(1);
    expect(spriteGroup.meshSplits.length).to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_1']);
  });

  // 元素中间插入其它类型元素 原本在1张meshSplit上的会被拆开
  it('[diffMeshSplits] when delayed, sprite group meshes will be seperated [particle]', async () => {
    const comp = await player.loadScene(generateSceneByOpts([{}, { isParticle: true, delay: 1 }, {}]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    expect(spriteGroup.meshSplits.length).to.eql(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_2']);
    player.gotoAndStop(comp.time + 1);
    player.tick(1);
    expect(spriteGroup.meshSplits.length).to.eql(2);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_2']);
    player.gotoAndStop(comp.time + 1);
    player.tick(1);
    expect(spriteGroup.meshSplits.length).to.eql(0);
  });

  // 元素中间的其它类型元素结束后 允许时合并相邻的2张meshSplit
  it('[diffMeshSplits] combine mesh 1&2 when particle item between them is removed', async () => {
    const comp = await player.loadScene(generateSceneByOpts([
      { duration: 5, blending: 2 },
      { duration: 5 },
      { isParticle: true, duration: 0.5 },
      { duration: 5 }]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    expect(spriteGroup.meshSplits.length).to.eql(3);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_1']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[2])).to.deep.equal(['item_3']);
    comp.forwardTime(3.5);
    expect(spriteGroup.meshSplits.length).to.eql(2);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_1', 'item_3']);
  });

  // 元素中间的其它类型元素结束后 允许时合并相邻的2张meshSplit
  it('[diffMeshSplits] combine mesh 2&3 when removed', async () => {
    const comp = await player.loadScene(generateSceneByOpts([
      { duration: 5, blending: 2 },
      { duration: 5, blending: 3 },
      { duration: 1, blending: 2 },
      { duration: 5, blending: 3 },
      { duration: 5, blending: 0 }]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    expect(spriteGroup.meshSplits.length).to.eql(5);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_1']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[2])).to.deep.equal(['item_2']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[3])).to.deep.equal(['item_3']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[4])).to.deep.equal(['item_4']);
    comp.forwardTime(3.5);
    expect(spriteGroup.meshSplits.length).to.eql(3);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_1', 'item_3']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[2])).to.deep.equal(['item_4']);
  });

  // 元素中间的其它类型元素开始后 1张meshSplit会被拆开
  it('[diffMeshSplits] when delayed, sprite group meshes will be combined[mix]', async () => {
    const comp = await player.loadScene(generateSceneByOpts([
      { duration: 2 },
      { duration: 3 },
      { isParticle: true, delay: 1, duration: 2 },
      { delay: 1, duration: 3 },
      { duration: 3 },
    ]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    //t0
    expect(spriteGroup.meshSplits.length).to.eql(1, 't0');
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_1', 'item_4']);
    player.gotoAndStop(comp.time + 1);
    player.tick(1);
    //t1
    expect(spriteGroup.meshSplits.length).to.eql(2, 't1');
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_1'], 't1');
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_3', 'item_4'], 't1');
    player.gotoAndStop(comp.time + 1);
    player.tick(1);
    //t2
    expect(spriteGroup.meshSplits.length).to.eql(2, 't2');
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_1'], 't2');
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_3', 'item_4'], 't2');
    //t3
    player.gotoAndStop(comp.time + 1.1);
    player.tick(1.1);

    expect(spriteGroup.meshSplits.length).to.eql(1, 't3');
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_3', 'item_4'], 't3');

    //t4
    player.gotoAndStop(comp.time + 1.1);
    player.tick(1);
    expect(spriteGroup.meshSplits.length).to.eql(1);
  });

  // 新增元素到合适的meshSplit上
  it('[diffMeshSplits] new added items in between', async () => {
    setMaxSpriteMeshItemCount(3);
    const comp = await player.loadScene(generateSceneByOpts([
      { duration: 2 },
      { duration: 2 },
      { duration: 2 },
      //
      { duration: 2 },
      { delay: 1, duration: 3 },
      { duration: 2 },
      //
      { duration: 2 },
      { duration: 3 },
    ]));

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    expect(spriteGroup.meshSplits.length).to.eql(3);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_1', 'item_2']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_3', 'item_5', 'item_6']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[2])).to.deep.equal(['item_7']);
    comp.forwardTime(1.1);
    expect(spriteGroup.meshSplits.length).to.eql(3);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['item_0', 'item_1', 'item_2']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['item_3', 'item_4', 'item_5']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[2])).to.deep.equal(['item_6', 'item_7']);

    setSpriteMeshMaxItemCountByGPU(engine.gpuCapability.detail);
  });

  // 灵感中心 爱心光效  spriteGroup中的items按照listIndex增序排列
  it('combine complex scene', async () => {
    const comp = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*5UwfQKX8IlwAAAAAAAAAAAAADlB4AQ');

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    expect(spriteGroup.meshSplits).to.be.an('array').with.lengthOf(4);
    expect(mapSpriteGroupItemIndices(spriteGroup)).to.deep.equal([0, 1, 2, 3, 4, 5, 6]);
  });

  // 灵感中心 发光过渡期  spriteGroup中的可见items按照listIndex增序排列
  it('combine complex scene 2', async () => {
    const comp = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*wEElT58Av8IAAAAAAAAAAAAADlB4AQ');

    player.gotoAndPlay(0.01);

    const spriteGroup = comp.loaderData.spriteGroup;

    expect(spriteGroup.meshSplits).to.be.an('array').with.lengthOf(1);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['黑背景层', '徽章模糊光-1', '银徽章']);
    expect(mapSpriteGroupItemIndices(spriteGroup)).to.deep.equal([0, 1, 2]);
    comp.forwardTime(1.1);
    expect(spriteGroup.meshSplits).to.be.an('array').with.lengthOf(3);
    expect(mapSplitItemNames(spriteGroup.meshSplits[0])).to.deep.equal(['黑背景层', '徽章模糊光-2']);
    expect(mapSplitItemNames(spriteGroup.meshSplits[1])).to.deep.equal(['白徽章强抖动']);
    expect(mapSpriteGroupItemIndices(spriteGroup)).to.deep.equal([0, 3, 4, 7]);
  });
});

// 按照在传入的参数数组中的index 元素名字设置为'item_${index}'
const generateSceneByOpts = opts => generateSceneJSON(opts.map((opt, i) => opt.isParticle ? ({
  'id': opt.id,
  'name': opt.name ?? `item_${i}`,
  'duration': opt.duration ?? 2,
  'type': '2',
  'visible': true,
  'endBehavior': 0,
  'delay': opt.delay ?? 0,
  'renderLevel': 'B+',
  'content': {
    'shape': {
      'type': 1,
      'radius': 1,
      'arc': 360,
      'arcMode': 0,
      'alignSpeedDirection': false,
      'shape': 'Sphere',
    },
    'options': {
      'startColor': [8, [1, 1, 1, 1]],
      'maxCount': 10,
      'startLifetime': [0, 1.2],
      'startDelay': [0, 0],
      'startSize': [0, 0.2],
      'sizeAspect': [0, 1],
      'start3DSize': false,
      'startRotationZ': [0, 0],
      'particleFollowParent': false,
    },
    'renderer': {
      'renderMode': 1,
    },
    'emission': {
      'rateOverTime': [0, 5],
    },
    'positionOverLifetime': {
      'startSpeed': [0, 1],
      'gravity': [0, 0, 0],
      'gravityOverLifetime': [0, 1],
    },
  },
  'transform': {
    'position': opt.position ?? [0, 0, 0],
    'rotation': opt.rotation ?? [0, 0, 0],
    'scale': [opt.size ?? 1, opt.size ?? 1, 1],
  },
}) : ({
  'id': opt.id,
  'name': opt.name ?? `item_${i}`,
  'duration': opt.duration ?? 2,
  'type': '1',
  'visible': true,
  'endBehavior': 0,
  'delay': opt.delay ?? 0,
  'renderLevel': 'B+',
  'content': {
    'options': {
      'startColor': [1, 1, 1, 1],
    },
    'renderer': {
      'renderMode': opt.renderMode ?? 1,
      'texture': opt.texture,
      'blending': opt.blending ?? 0,
      'side': opt.side ?? spec.SideMode.DOUBLE,
      'occlusion': false,
      'transparentOcclusion': false,
      'maskMode': 0,
    },
    'positionOverLifetime': {
      'direction': [0, 0, 0],
      'startSpeed': 0,
      'gravity': [0, 0, 0],
      'gravityOverLifetime': [0, 1],
    },
  },
  'transform': {
    'position': opt.position ?? [0, 0, 0],
    'rotation': opt.rotation ?? [0, 0, 0],
    'scale': [opt.size ?? 1, opt.size ?? 1, 1],
  },
})));
