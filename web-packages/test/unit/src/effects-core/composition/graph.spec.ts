// @ts-nocheck
import { getStandardJSON } from '@galacean/effects';

const { expect } = chai;

describe('composition graph', () => {
  it('build null item tree', () => {
    const json = getStandardJSON({
      'compositionId': 1,
      'requires': [],
      'compositions': [{
        'name': 'composition_1',
        'id': 1,
        'duration': 5,
        'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
        'items': [{
          'name': 'item_6',
          'delay': 0,
          'id': 6,
          'type': '1',
          'ro': 0.01,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.2,
              'sizeAspect': 1,
              'startColor': [8, [255, 255, 255]],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
            }, 'renderer': { 'renderMode': 1, 'anchor': [0.5, 0.5] },
          },
        }, {
          'name': 'null_3',
          'delay': 0,
          'id': 4,
          'type': '3',
          'cal': {
            'options': {
              'duration': 2,
              'startSize': 1,
              'sizeAspect': 1,
              'relative': true,
              'renderLevel': 'B+',
            },
          },
        }, {
          'name': 'null_4',
          'delay': 0,
          'id': 5,
          'type': '3',
          'parentId': 3,
          'cal': {
            'options': {
              'duration': 2,
              'startSize': 1,
              'sizeAspect': 1,
              'relative': true,
              'renderLevel': 'B+',
            },
          },
        }, {
          'name': 'null_2',
          'delay': 0,
          'id': 3,
          'type': '3',
          'parentId': 4,
          'cal': {
            'options': {
              'duration': 2,
              'startSize': 1,
              'sizeAspect': 1,
              'relative': true,
              'renderLevel': 'B+',
            },
          },
        }, {
          'name': 'null_1',
          'delay': 0,
          'id': 2,
          'type': '3',
          'parentId': 3,
          'cal': {
            'options': {
              'duration': 2,
              'startSize': 1,
              'sizeAspect': 1,
              'relative': true,
              'renderLevel': 'B+',
            },
          },
        }, {
          'name': 'item_1',
          'delay': 0,
          'id': 1,
          'type': '1',
          'parentId': 2,
          'ro': 0.01,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.2,
              'sizeAspect': 1,
              'startColor': [8, [255, 255, 255]],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
            }, 'renderer': { 'renderMode': 1, 'anchor': [0.5, 0.5] },
          },
        }],
        'meta': { 'previewSize': [750, 1334] },
      }],
      'gltf': [],
      'images': [],
      'version': '0.9.0',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      '_imgs': { '1': [] },
    });
    const graph = getCompositionGraph(json.compositions[0]);

    expect(graph.nodes.map(n => n.name)).to.deep.equals(['item_6', 'null_3']);
    expect(graph.nodes[1].children.map(n => n.name)).to.deep.equals(['null_2']);
    expect(graph.nodes[1].children[0].children.map(n => n.name)).to.deep.equals(['null_4', 'null_1']);
    expect(JSON.parse(JSON.stringify(graph))).to.deep.equals({
      'name': 'composition_1',
      'id': '1',
      'nodes': [{
        'name': 'item_6',
        'type': '1',
        'id': '6',
        'transform': { 'scale': [1.2, 1.2, 1] },
      }, {
        'name': 'null_3',
        'type': '3',
        'id': '4',
        'transform': { 'scale': [1, 1, 1] },
        'children': [{
          'name': 'null_2',
          'type': '3',
          'id': '3',
          'transform': { 'scale': [1, 1, 1] },
          'parentId': '4',
          'children': [{
            'name': 'null_4',
            'type': '3',
            'id': '5',
            'transform': { 'scale': [1, 1, 1] },
            'parentId': '3',
          }, {
            'name': 'null_1',
            'type': '3',
            'id': '2',
            'transform': { 'scale': [1, 1, 1] },
            'parentId': '3',
            'children': [{
              'name': 'item_1',
              'type': '1',
              'id': '1',
              'transform': { 'scale': [1.2, 1.2, 1] },
              'parentId': '2',
            }],
          }],
        }],
      }],
    });
  });

  it('build tree item graph', () => {
    const scene = generateScene([{
      type: 'tree',
      id: 'rp',
      children: [0],
      nodes: [
        { id: 'root', transform: { position: [1, 0, 0] }, children: [1, 3] },
        { id: 'r2', children: [2] },
        { id: 'r2-2', transform: { position: [1, 0, 1] } },
        { id: 'r3' },
      ],
    }]);

    const graph = getCompositionGraph(scene.compositions[0]);

    expect(JSON.parse(JSON.stringify(graph))).to.deep.equals({
      'name': 'composition_1',
      'id': '1',
      'nodes': [{
        'name': 'tree_0',
        'type': 'tree',
        'id': 'rp',
        'transform': {},
        'children': [{
          'type': 'tree',
          'id': 'rp^root',
          'transform': { 'position': [1, 0, 0] },
          'parentId': 'rp',
          'subType': 'node',
          'children': [{
            'type': 'tree',
            'id': 'rp^r2',
            'parentId': 'rp',
            'subType': 'node',
            'children': [{
              'type': 'tree',
              'id': 'rp^r2-2',
              'transform': { 'position': [1, 0, 1] },
              'parentId': 'rp',
              'subType': 'node',
            }],
          }, { 'type': 'tree', 'id': 'rp^r3', 'parentId': 'rp', 'subType': 'node' }],
        }],
      }],
    });
  });

  it('build tree item with null item graph', () => {
    const scene = generateScene([{
      type: 'tree',
      id: 'rp',
      children: [0],
      nodes: [
        { id: 'root', transform: { position: [1, 0, 0] }, children: [1] },
        { id: 'r2', children: [2] },
        { id: 'r2-2', transform: { position: [1, 0, 1] } },
        { id: 'r3' },
      ],
    }, { type: 'cal', id: 'null', parentId: 'rp^r2-2' }]);

    const graph = getCompositionGraph(scene.compositions[0]);

    expect(graph.nodes[0].children[0].id).to.eql('rp^root');
    expect(graph.nodes[0].children[0].children[0].id).to.eql('rp^r2');
    expect(graph.nodes[0].children[0].children[0].children[0].id).to.eql('rp^r2-2');
    expect(graph.nodes[0].children[0].children[0].children[0].children[0].id).to.eql('null');
    expect(JSON.parse(JSON.stringify(graph))).to.deep.equals({
      'name': 'composition_1',
      'id': '1',
      'nodes': [{
        'name': 'tree_0',
        'type': 'tree',
        'id': 'rp',
        'transform': {},
        'children': [{
          'type': 'tree',
          'id': 'rp^root',
          'transform': { 'position': [1, 0, 0] },
          'parentId': 'rp',
          'subType': 'node',
          'children': [{
            'type': 'tree',
            'id': 'rp^r2',
            'parentId': 'rp',
            'subType': 'node',
            'children': [{
              'type': 'tree',
              'id': 'rp^r2-2',
              'transform': { 'position': [1, 0, 1] },
              'parentId': 'rp',
              'subType': 'node',
              'children': [{
                'name': 'null_1',
                'type': '3',
                'id': 'null',
                'transform': { 'scale': [1, 1, 1] },
                'parentId': 'rp^r2-2',
              }],
            }],
          }],
        }],
      }],
    });
  });

  function generateScene (items) {
    return getStandardJSON({
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
          endBehavior: item.endBehavior,
          [item.type === 'tree' ? 'content' : 'cal']: {
            'options': {
              'duration': item.duration || 2,
              'startSize': 1,
              'sizeAspect': 1,
              'relative': true,
              'renderLevel': 'B+',
              endBehavior: item.endBehavior,
              tree: {
                nodes: item.nodes,
                children: item.children,
              },
            },
            transform: item.transform,
          },
        })),
        'meta': { 'previewSize': [750, 1334] },
      }],
      'gltf': [],
      'images': [],
      'version': '0.8.9',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      '_imgs': { '1': [] },
    });
  }
});

export function getCompositionGraph (comp) {
  const childrenMap = {};
  const nodeMap = {};
  const topNodes = [];
  const treeNodesMap = {};

  comp.items.forEach(item => collectNodes(item));

  function collectNodes (item, treeNodeChildren) {
    const node = {
      name: item.name,
      type: item.type,
      id: item.id,
      transform: item.transform,
      parentId: item.parentId,
    };
    const pid = node.parentId;

    if (pid) {
      if (!childrenMap[pid]) {
        childrenMap[pid] = [];
      }
      childrenMap[pid].push(node);
    } else {
      topNodes.push(node);
    }
    nodeMap[node.id] = node;
    if (node.type === 'tree') {
      let children;
      let nodes;
      const isTreeNode = node.id.includes('^');

      if (isTreeNode) {
        nodes = treeNodesMap[node.id.slice(0, node.id.indexOf('^'))];
        children = treeNodeChildren;
        node.subType = 'node';
        node.parentId = replaceTreeParentId(node.parentId);
      } else {
        nodes = (item).content.options.tree.nodes;
        children = (item).content.options.tree.children;
        treeNodesMap[item.id] = nodes;
      }
      children?.forEach(index => {
        const tn = nodes[index];

        collectNodes({
          name: tn.name,
          type: 'tree',
          id: `${replaceTreeParentId(item.id)}^${(tn.id || index)}`,
          transform: tn.transform,
          parentId: item.id,
        }, tn.children);
      });
    }
  }

  Object.values(nodeMap).forEach(node => {
    const children = childrenMap[node.id];

    if (children) {
      node.children = children;
    }
  });

  return {
    name: comp.name,
    id: comp.id,
    nodes: topNodes,
  };
}

function replaceTreeParentId (str) {
  const idx = str.indexOf('^');

  return idx > -1 ? str.substring(0, idx) : str;
}
