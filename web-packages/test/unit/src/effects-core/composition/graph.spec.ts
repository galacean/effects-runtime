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
    const graph = getCompositionGraph(json.compositions[0], json.items);

    expect(graph.nodes.map(n => n.name)).to.deep.equals(['item_6', 'null_3']);
    expect(graph.nodes[1].children.map(n => n.name)).to.deep.equals(['null_2']);
    expect(graph.nodes[1].children[0].children.map(n => n.name)).to.deep.equals(['null_4', 'null_1']);
  });
});

export function getCompositionGraph (comp, items) {
  const childrenMap = {};
  const nodeMap = {};
  const topNodes = [];
  const treeNodesMap = {};

  items.forEach(item => collectNodes(item));

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
