import { Player, spec } from '@galacean/effects';
import { loadSceneAndPlay, sanitizeNumbers } from './utils';

const { expect } = chai;

describe('core/plugins/sprite/transform', () => {
  let player: Player;

  before(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      manualRender: true,
    });
  });

  after(() => {
    player && player.dispose();
  });

  // 直接设置tranform
  it('set sprite item transform', async () => {
    const items = generateItem([{ id: '1', name: 'simple', position: [0, 1, 0], rotation: [0, 90, 0], size: 0.15 }]);
    const comp = await loadSceneAndPlay(player, items, 0.01);

    const item = comp.getItemByName('simple');

    const position = item?.transform.getWorldPosition().toArray();
    const rotation = item?.transform.getWorldRotation().toArray();

    expect(position).to.deep.equals([0, 1, 0], 'position');
    expect(rotation?.[0]).to.eql(0);
    expect(rotation?.[1]).to.eql(90);
    expect(rotation?.[2] === 0).to.be.true;
    expect(item?.transform.size.x).to.be.closeTo(0.15, 0.0001);
    expect(item?.transform.size.y).to.be.closeTo(0.15, 0.0001);
  });

  // transform受k帧曲线影响
  it('set sprite item path transform', async () => {
    const opts = [{
      name: 'sprite_1',
      id: '1',
    }];
    const items = generateItem(opts) as spec.SpriteItem[];

    items.map(item => {
      item.content.positionOverLifetime!.path = [22, [[[3, [0, 0, 0.0667, 0], 1], [2, [0.1333, 1, 0.2, 1], 1]], [[0, 0, 0], [1, 2, 0]], [[0.3333, 0.6667, 0], [0.6667, 1.3333, 0]]]];
    });
    const comp = await loadSceneAndPlay(player, items, 1);
    const item = comp.getItemByName('sprite_1')!;
    const worldTransform = item.getWorldTransform();

    const pos = worldTransform.position.toArray();
    const epsilon = [Math.abs(pos[0] - 1), Math.abs(pos[1] - 2), Math.abs(pos[2] - 0)];

    expect(epsilon[0]).to.be.closeTo(0, 0.001);
    expect(epsilon[1]).to.be.closeTo(0, 0.001);
    expect(epsilon[2]).to.be.closeTo(0, 0.001);
  });

  // transform 受空节点父节点的影响
  it('item transform will scaleBy null parent size ', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: true, size: 2 },
      { id: '2', name: 'sp', parentId: '1', position: [0, 1, 0] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), 1);
    const item = comp.getItemByName('sp')!;

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
    const comp = await loadSceneAndPlay(player, generateItem(opts), 1);
    const item = comp.getItemByName('sp')!;

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
    const comp = await loadSceneAndPlay(player, generateItem(opts), 1);
    const item = comp.getItemByName('sp')!;

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
    const comp = await loadSceneAndPlay(player, generateItem(opts), 1);
    const item = comp.getItemByName('sp')!;

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
    const items = generateItem(opts) as spec.SpriteItem[];

    items[0].content.positionOverLifetime!.path = [22, [[[3, [0, 0, 0.0667, 0], 1], [2, [0.1333, 1, 0.2, 1], 1]], [[0, 0, 0], [1, 2, 0]], [[0.3333, 0.6667, 0], [0.6667, 1.3333, 0]]]];

    const comp = await loadSceneAndPlay(player, items, 1);
    const item = comp.getItemByName('sp')!;
    const worldTransform = item.getWorldTransform();
    const pos = worldTransform.position.toArray();

    expect(pos[0]).to.be.closeTo(1.0, 0.001);
    expect(pos[1]).to.be.closeTo(2.0, 0.001);
    expect(pos[2]).to.be.closeTo(0, 0.001);
  });

  // transform 受图层父节点的路径影响
  it('item transform affected by sprite parent\'s path', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: false },
      { id: '2', name: 'sp', parentId: '1' },
    ];
    const items = generateItem(opts) as spec.SpriteItem[];

    items[0].content.positionOverLifetime!.path = [22, [[[3, [0, 0, 0.0667, 0], 1], [2, [0.1333, 1, 0.2, 1], 1]], [[0, 0, 0], [1, 2, 0]], [[0.3333, 0.6667, 0], [0.6667, 1.3333, 0]]]];
    const comp = await loadSceneAndPlay(player, items, 1);
    const item = comp.getItemByName('sp')!;
    const worldTransform = item.getWorldTransform();

    expect(worldTransform.position.toArray()).to.deep.equals([1, 2, 0]);
  });

  // 多个空父节点同时影响position
  it('item tranform will cascade multiple null parent\'s position', async () => {
    const opts = [
      { id: '1', name: 'p', isNull: true, position: [0, 1, 0] },
      { id: '2', isNull: true, name: 'sp', parentId: '1', position: [1, 0, 0] },
      { id: '3', name: 'spp', parentId: '2', position: [0, 0, 1] },
    ];
    const comp = await loadSceneAndPlay(player, generateItem(opts), 1);
    const item = comp.getItemByName('sp')!;

    expect(item.transform.position.toArray()).to.deep.equals([1, 0, 0]);
    let worldTransform = item.getWorldTransform();

    expect(sanitizeNumbers(worldTransform.position.toArray())).to.deep.equals([1, 1, 0]);
    const item2 = comp.getItemByName('spp')!;

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
    const comp = await loadSceneAndPlay(player, generateItem(opts), 1);
    const item = comp.getItemByName('sp')!;

    expect(item.transform.position.toArray()).to.deep.equals([1, 0, 0]);
    let worldTransform = item.getWorldTransform();

    expect(sanitizeNumbers(worldTransform.position.toArray())).to.deep.equals([1, 1, 0]);
    const item2 = comp.getItemByName('spp')!;

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
    const comp = await loadSceneAndPlay(player, generateItem(opts), 0.01);
    const item = comp.getItemByName('sp')!;
    const item2 = comp.getItemByName('spp')!;

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
    const comp = await loadSceneAndPlay(player, generateItem(opts), 0.01);
    const pt = comp.getItemByName('sp')!.transform;
    const sppt = comp.getItemByName('spp')!.transform;

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
    const comp = await loadSceneAndPlay(player, generateItem(opts), 0.01);
    const pt = comp.getItemByName('sp')!.transform;
    const sppt = comp.getItemByName('spp')!.transform;

    expect(new Float32Array(sanitizeNumbers(pt.rotation.toArray()))).to.deep.equals(new Float32Array([0, 0, 60]));
    expect(new Float32Array(sanitizeNumbers(sppt.getWorldRotation().toArray()))).to.deep.equals(new Float32Array([0, 0, 90]));
    expect(sppt.position.toArray()).to.deep.equals([1, 0, 0]);
  });
});

function generateItem (opts: Record<string, any>[]) {
  return opts.map(opt => ({
    'id': opt.id,
    'name': opt.name,
    'duration': opt.duration ?? 2,
    'type': opt.isNull ? spec.ItemType.null : spec.ItemType.sprite,
    'parentId': opt.parentId,
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
  })) as spec.Item[];
}
