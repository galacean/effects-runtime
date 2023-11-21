// @ts-nocheck
import { Player, spec } from '@galacean/effects';
import { ModelTreeVFXItem } from '@galacean/effects-plugin-model';
import { generateComposition } from './utilities';

const { expect } = chai;

describe('tree item', () => {
  let player;

  before(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      manualRender: true,
    });
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('build deep tree', async () => {
    const comp = await createComposition(
      [{
        type: 'tree',
        children: [0],
        nodes: [
          { id: 'root', transform: { position: [1, 0, 0] }, children: [1, 3] },
          { id: 'r2', children: [2] },
          { id: 'r2-2', transform: { position: [1, 0, 1] } },
          { id: 'r3' },
        ],
      }],
      player,
    );
    const treeItem = comp.items[0];

    expect(treeItem.type).to.eql('tree');
    expect(treeItem).to.be.an.instanceof(ModelTreeVFXItem);
    expect(treeItem.content.nodes.length).to.eql(1);
    const root = treeItem.content.nodes[0];

    expect(root.id).to.eql('^root');
    expect(root.children.length).to.eql(2);
    expect(root.children[1]).to.contains({ id: '^r3' });
    const child = root.children[0];

    expect(child.id).to.eql('^r2');
    expect(child.children.length).to.eql(1);
    const grandChild = child.children[0];

    expect(grandChild.id).to.eql('^r2-2');
    const worldPos = [];

    grandChild.transform.assignWorldTRS(worldPos);
    expect(grandChild.transform.position).to.deep.equals([1, 0, 1]);
    expect(worldPos).to.deep.equals([2, 0, 1]);
  });

  it('set node as parent', async () => {
    const comp = await createComposition(
      [
        {
          type: 'tree',
          children: [0],
          id: 't',
          nodes: [
            { id: 'root', transform: { position: [1, 0, 0] }, children: [1, 2] },
            { id: 'r2', transform: { position: [0, 0, 1] } },
            { transform: { position: [1, 0, 1] } },
          ],
        },
        { parentId: 't^r2', transform: { position: [1, 0, 0] }, id: 'i1' },
        { parentId: 't^2', transform: { position: [0, 1, 0] }, id: 'i2' },
      ],
      player,
    );
    const pos = [];
    const treeItem = comp.items[0];
    const root = treeItem.content.nodes[0];
    const treeItem1 = comp.items[1];

    expect(root.transform.parentTransform).to.eql(treeItem.transform, 'rootTransform');
    expect(root.children[0]).to.contains({ id: '^r2' });
    expect(root.children[1]).to.contains({ id: '^2' });

    expect(treeItem1.parent).to.eql(treeItem);
    expect(treeItem1.transform.parentTransform).to.eql(treeItem.content.getNodeById('r2').transform, '^r2');
    expect(comp.items[2].parent).to.eql(treeItem);
    expect(comp.items[2].transform.parentTransform).to.eql(treeItem.content.getNodeById('2').transform, '^2');

    comp.items[2].transform.assignWorldTRS(pos);
    expect(comp.items[2].transform.position).to.eql([0, 1, 0]);
    expect(comp.items[2].transform.parentTransform.position).to.eql([1, 0, 1]);
    expect(comp.items[2].transform.parentTransform.parentTransform.position).to.deep.equals([1, 0, 0]);
    expect(pos).to.deep.equals([2, 1, 1]);
  });

  it('grand children tree', async () => {
    const comp = await createComposition(
      [
        {
          type: 'tree',
          children: [0],
          id: 't0',
          nodes: [
            { id: 'r0', transform: { position: [1, 0, 0] } },
          ],
        },
        {
          type: 'tree',
          children: [0],
          id: 't1',
          parentId: 't0^r0',
          nodes: [
            { id: 'r1', transform: { position: [0, 1, 0] } },
          ],
        },
        { parentId: 't1^r1', transform: { position: [0, 0, 1] }, id: 'i1' },
      ],
      player,
    );
    const treeItem = comp.items[0];
    const treeItem1 = comp.items[1];
    const treeItem2 = comp.items[2];

    expect(treeItem1.parent).to.eql(treeItem);
    expect(treeItem1.transform.parentTransform).to.eql(treeItem.content.nodes[0].transform);
    expect(treeItem2.parent).to.eql(treeItem1);
    expect(treeItem2.transform.parentTransform).to.eql(treeItem1.content.nodes[0].transform);
    expect(treeItem2.getCurrentPosition()).to.eql([1, 1, 1]);
  });

  it('wrong children index', async () => {
    const comp = await createComposition(
      [{
        type: 'tree',
        children: [0],
        nodes: [
          { id: 'root', transform: { position: [1, 0, 0] }, children: [1, 4] },
          { id: 'r2', children: [2] },
          { id: 'r2-2', transform: { position: [1, 0, 1] }, children: [2] },
          { id: 'r3' },
        ],
      }],
      player,
    );
    const treeItem = comp.items[0];
    const nodeR2 = treeItem.content.getNodeById('r2');

    expect(treeItem.content.getNodeById('root').children).to.deep.equals([nodeR2]);
    expect(treeItem.content.getNodeById('r2-2').children.length).to.eql(0);
  });

  it('end behavior destroy children', async () => {
    const comp = await createComposition(
      [
        {
          type: 'tree',
          children: [0],
          id: 't1',
          duration: 2,
          endBehavior: spec.END_BEHAVIOR_DESTROY_CHILDREN,
          nodes: [
            { id: 'r1', transform: { position: [1, 0, 0] } },
          ],
        },
        { parentId: 't1^r1', duration: 5, transform: { position: [0, 0, 1] }, id: 'i1' },
        { duration: 5, transform: { position: [0, 0, 1] }, id: 'i2' },
      ],
      player,
    );
    const i1 = comp.items[2];

    expect(comp.items.length).to.eql(3);
    comp.gotoAndStop(2.1);
    expect(comp.items.length).to.deep.equals(1);
  });

  it('end behavior destroy children deep', async () => {
    const comp = await createComposition(
      [
        {
          type: 'tree',
          children: [0],
          id: 't1',
          duration: 2,
          endBehavior: spec.END_BEHAVIOR_DESTROY_CHILDREN,
          nodes: [
            { id: 'r1', transform: { position: [1, 0, 0] } },
          ],
        },
        {
          parentId: 't1^r1',
          endBehavior: spec.END_BEHAVIOR_DESTROY_CHILDREN,
          duration: 5,
          transform: { position: [0, 0, 1] },
          id: 'i1',
        },
        {
          parentId: 'i1',
          endBehavior: spec.END_BEHAVIOR_DESTROY_CHILDREN,
          duration: 5,
          transform: { position: [0, 0, 1] },
          id: 'i2',
        },
      ],
      player,
    );

    expect(comp.items.length).to.eql(3);
    comp.gotoAndStop(2.1);
    expect(comp.items).to.deep.equals([]);
  });
});

async function createComposition (items, player, playerOptions) {
  const json = {
    'compositionId': 1,
    'requires': [],
    'compositions': [{
      'name': 'composition_1',
      'id': 1,
      'duration': 5,
      'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
      'items': items.map((item, i) => ({
        'name': item.name || (`${item.type === 'tree' ? item.type : 'null'}_${i}`),
        'delay': item.delay || 0,
        'id': item.id || (10086 + i),
        'parentId': item.parentId,
        type: item.type || '3',
        'duration': item.duration || 2,
        endBehavior: item.endBehavior ?? spec.END_BEHAVIOR_FREEZE,
        transform: item.transform,
        [item.type === 'tree' ? 'content' : 'cal']: {
          'options': {
            'duration': item.duration || 2,
            'startSize': 1,
            'sizeAspect': 1,
            'relative': true,
            'renderLevel': 'B+',
            endBehavior: item.endBehavior ?? spec.END_BEHAVIOR_FREEZE,
            tree: {
              nodes: item.nodes,
              children: item.children,
            },
          },
        },
      })),
      'meta': { 'previewSize': [750, 1334] },
    }],
    'gltf': [],
    'images': [],
    'version': '2.1',
    'shapes': [],
    'plugins': [],
  };

  return generateComposition(player, json, {}, { currentTime: 0.01, pauseOnFirstFrame: true, ...playerOptions });
}
