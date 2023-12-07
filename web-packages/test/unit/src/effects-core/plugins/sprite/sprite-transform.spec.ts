// @ts-nocheck
import { Player, spec } from '@galacean/effects';
import { loadSceneAndPlay, sanitizeNumbers, generateSceneJSON } from './utils';

const { expect } = chai;

describe('sprite transform', () => {
  let player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  after(() => {
    player && player.dispose();
  });

  // 直接设置tranform
  it('set sprite item transform', async () => {
    const items = generateItem([{ id: '1', name: 'simple', position: [0, 1, 0], rotation: [0, 90, 0], size: 0.15 }]);
    const comp = await loadSceneAndPlay(player, items, { currentTime: 0.01 });

    const item = comp.getItemByName('simple');

    const position = item.transform.getWorldPosition().toArray();
    const rotation = item.transform.getWorldRotation().toArray();
    const scale = item.content.basicTransform.scale;

    expect(position).to.deep.equals([0, 1, 0], 'position');
    expect(rotation[0]).to.eql(0);
    expect(rotation[1]).to.eql(90);
    expect(rotation[2] === 0).to.be.true;
    expect(scale.x).to.be.closeTo(0.15, 0.0001);
    expect(scale.y).to.be.closeTo(0.15, 0.0001);
    const spriteGroup = comp.loaderData.spriteGroup;
    const mesh = spriteGroup.meshes[0];
    const data = mesh.material.getMatrixArray('uMainData');

    expect(new Float32Array(data.slice(0, 16))).to.deep.equals(new Float32Array([
      0, 1, 0, 0,
      1, 1, item.lifetime, 0,
      0, -0.7071067690849304, 0, 0.7071067690849304,
      1, 1, 1, 1,
    ]));
  });

  // transform受k帧曲线影响
  it('set sprite item path transform', async () => {
    const opts = [{
      name: 'sprite_1',
      id: '1',
    }];
    const items = generateItem(opts);

    items.map(item => {
      item.content.positionOverLifetime.path = [7, [[[0, 0, 1, 1], [0.375, 0.375, 1, 1], [1, 0.375, 1, 1]], [[0, 0, 0], [2, 1.5, 0], [2, 1.5, 0]], [[1, 0, -0], [1, 1.5, -0], [2, 1.5, -0], [2, 1.5, -0]]]];
    });
    const comp = await loadSceneAndPlay(player, items, { currentTime: 1 });
    const item = comp.getItemByName('sprite_1');
    const worldTransform = item.getWorldTransform();

    expect(worldTransform.position.toArray()).to.deep.equals([2, 1.5, 0]);
  });

  // transform 受空节点父节点的影响
  it('item transform will scaleBy null parent size ', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: true, size: 2 },
      { id: '2', name: 'sp', parentId: '1', position: [0, 1, 0] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), { currentTime: 1 });
    const item = comp.getItemByName('sp');

    expect(item.transform.position.toArray()).to.deep.equals([0, 1, 0]);
    const worldTransform = item.getWorldTransform();

    expect(worldTransform.position.toArray()).to.deep.equals([0, 2, 0]);
  });

  // transform 受图层父节点的影响
  it('item transform will scaleBy sprite parent size ', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: false, size: 2 },
      { id: '2', name: 'sp', parentId: '1', position: [0, 1, 0] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), { currentTime: 1 });
    const item = comp.getItemByName('sp');

    expect(item.transform.position.toArray()).to.deep.equals([0, 1, 0]);
    const worldTransform = item.getWorldTransform();

    expect(worldTransform.position.toArray()).to.deep.equals([0, 1, 0]);
  });

  // transform 受父节点的旋转影响
  it('item transform affected by null parent\'s rotate', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: true, rotation: [0, 0, 90] },
      { id: '2', name: 'sp', parentId: '1', position: [1, 0, 0] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), { currentTime: 1 });
    const item = comp.getItemByName('sp');

    expect(item.transform.position.toArray()).to.deep.equals([1, 0, 0]);
    const worldTransform = item.getWorldTransform();

    expect(sanitizeNumbers(worldTransform.position.toArray())).to.deep.equals([0, -1, 0]);
  });

  // transform 受图层父节点的旋转影响
  it('item transform affected by sprite parent\'s rotate', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: false, rotation: [0, 0, 90] },
      { id: '2', name: 'sp', parentId: '1', position: [1, 0, 0] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), { currentTime: 1 });
    const item = comp.getItemByName('sp');

    expect(item.transform.position.toArray()).to.deep.equals([1, 0, 0]);
    const worldTransform = item.getWorldTransform();

    expect(sanitizeNumbers(worldTransform.position.toArray())).to.deep.equals([0, -1, 0]);
  });

  // transform 受图层父节点的路径影响
  it('item transform affected by null parent\'s path', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: true },
      { id: '2', name: 'sp', parentId: '1' },
    ];
    const items = generateItem(opts);

    items[0].content.positionOverLifetime.path = [7, [[[0, 0, 1, 1], [0.375, 0.375, 1, 1], [1, 0.375, 1, 1]], [[0, 0, 0], [2, 1.5, 0], [2, 1.5, 0]], [[1, 0, -0], [1, 1.5, -0], [2, 1.5, -0], [2, 1.5, -0]]]];
    const comp = await loadSceneAndPlay(player, items, { currentTime: 1 });
    const item = comp.getItemByName('sp');
    const worldTransform = item.getWorldTransform();

    expect(worldTransform.position.toArray()).to.deep.equals([2, 1.5, 0]);
  });

  // transform 受图层父节点的路径影响
  it('item transform affected by sprite parent\'s path', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: false },
      { id: '2', name: 'sp', parentId: '1' },
    ];
    const items = generateItem(opts);

    items[0].content.positionOverLifetime.path = [7, [[[0, 0, 1, 1], [0.375, 0.375, 1, 1], [1, 0.375, 1, 1]], [[0, 0, 0], [2, 1.5, 0], [2, 1.5, 0]], [[1, 0, -0], [1, 1.5, -0], [2, 1.5, -0], [2, 1.5, -0]]]];
    const comp = await loadSceneAndPlay(player, items, { currentTime: 1 });
    const item = comp.getItemByName('sp');
    const worldTransform = item.getWorldTransform();

    expect(worldTransform.position.toArray()).to.deep.equals([2, 1.5, 0]);
  });

  // 多个空父节点同时影响position
  it('item tranform will cascade multiple null parent\'s position', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: true, position: [0, 1, 0] },
      { id: '2', isNull: true, name: 'sp', parentId: '1', position: [1, 0, 0] },
      { id: '3', name: 'spp', parentId: '2', position: [0, 0, 1] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), { currentTime: 1 });
    const item = comp.getItemByName('sp');

    expect(item.transform.position.toArray()).to.deep.equals([1, 0, 0]);
    let worldTransform = item.getWorldTransform();

    expect(sanitizeNumbers(worldTransform.position.toArray())).to.deep.equals([1, 1, 0]);
    const item2 = comp.getItemByName('spp');

    expect(item2.transform.position.toArray()).to.deep.equals([0, 0, 1]);
    worldTransform = item2.getWorldTransform();
    expect(sanitizeNumbers(worldTransform.position.toArray())).to.deep.equals([1, 1, 1]);
  });

  // 多个图层父节点同时影响position
  it('item tranform will cascade multiple sprite parent\'s position', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: false, position: [0, 1, 0] },
      { id: '2', isNull: false, name: 'sp', parentId: '1', position: [1, 0, 0] },
      { id: '3', name: 'spp', parentId: '2', position: [0, 0, 1] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), { currentTime: 1 });
    const item = comp.getItemByName('sp');

    expect(item.transform.position.toArray()).to.deep.equals([1, 0, 0]);
    let worldTransform = item.getWorldTransform();

    expect(sanitizeNumbers(worldTransform.position.toArray())).to.deep.equals([1, 1, 0]);
    const item2 = comp.getItemByName('spp');

    expect(item2.transform.position.toArray()).to.deep.equals([0, 0, 1]);
    worldTransform = item2.getWorldTransform();
    expect(sanitizeNumbers(worldTransform.position.toArray())).to.deep.equals([1, 1, 1]);
  });

  // transform 受多个空父节点的size影响
  it('item transform will cascade multiple null parent\'s size', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: true, size: 2 },
      { id: '2', isNull: true, name: 'sp', parentId: '1', size: 3 },
      { id: '3', name: 'spp', parentId: '2', position: [0, 0, 1] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), { currentTime: 0.01 });
    const item = comp.getItemByName('sp');
    const item2 = comp.getItemByName('spp');

    expect(sanitizeNumbers(item.transform.scale.toArray())).to.deep.equals([3, 3, 3]);
    expect(sanitizeNumbers(item.transform.getWorldScale().toArray())).to.deep.equals([6, 6, 6]);
    expect(item2.transform.position.toArray()).to.deep.equals([0, 0, 1]);
  });

  // transform 受多个空父节点的旋转影响
  it('item transform will cascade multiple null parent\'s rotate', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: true, rotation: [0, 0, 30] },
      { id: '2', isNull: true, name: 'sp', parentId: '1', rotation: [0, 0, 60] },
      { id: '3', name: 'spp', parentId: '2', position: [1, 0, 0] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), { currentTime: 0.01 });
    const pt = comp.getItemByName('sp').transform;
    const sppt = comp.getItemByName('spp').transform;

    expect(new Float32Array(sanitizeNumbers(pt.rotation.toArray()))).to.deep.equals(new Float32Array([0, 0, 60]));
    expect(new Float32Array(sanitizeNumbers(sppt.getWorldRotation().toArray()))).to.deep.equals(new Float32Array([0, 0, 90]));
    expect(sppt.position.toArray()).to.deep.equals([1, 0, 0]);
  });

  // transform 受多个父节点的旋转影响
  it('item transform will cascade multiple sprite parent\'s rotate', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: false, rotation: [0, 0, 30] },
      { id: '2', isNull: false, name: 'sp', parentId: '1', rotation: [0, 0, 60] },
      { id: '3', name: 'spp', parentId: '2', position: [1, 0, 0] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), { currentTime: 0.01 });
    const pt = comp.getItemByName('sp').transform;
    const sppt = comp.getItemByName('spp').transform;

    expect(new Float32Array(sanitizeNumbers(pt.rotation.toArray()))).to.deep.equals(new Float32Array([0, 0, 60]));
    expect(new Float32Array(sanitizeNumbers(sppt.getWorldRotation().toArray()))).to.deep.equals(new Float32Array([0, 0, 90]));
    expect(sppt.position.toArray()).to.deep.equals([1, 0, 0]);
  });

});

function generateItem (opts) {
  return opts.map(opt => ({
    'id': opt.id,
    'name': opt.name,
    'duration': opt.duration ?? 2,
    'type': opt.isNull ? spec.ItemType.null : spec.ItemType.sprite,
    parentId: opt.parentId,
    'visible': true,
    'endBehavior': 5,
    'delay': opt.delay ?? 0,
    'renderLevel': 'B+',
    'content': {
      'options': {
        'startColor': [1, 1, 1, 1],
      },
      'renderer': {
        'renderMode': 1,
        'texture': 0,
        'blending': 0,
        'side': 1032,
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
  }));
}
