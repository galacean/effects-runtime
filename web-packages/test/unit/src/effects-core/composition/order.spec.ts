// @ts-nocheck
import { Player } from '@galacean/effects';

const { expect } = chai;

describe('composition order', () => {
  let player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('composition play with order', async () => {
    await player.loadScene([
      generateScene('c1'),
      generateScene('c2'),
      generateScene('c3'),
    ]);
    player.gotoAndStop(0);
    const c1 = player.getCompositionByName('c1');
    const c2 = player.getCompositionByName('c2');
    const c3 = player.getCompositionByName('c3');

    expect(c1.getIndex()).to.be.equals(0);
    expect(c2.getIndex()).to.be.equals(1);
    expect(c3.getIndex()).to.be.equals(2);
    c1.setIndex(3);
    player.gotoAndStop(0);
    expect(c1.getIndex()).to.be.equals(3);
  });
});

function generateScene (name) {
  return {
    'compositionId': 1,
    'requires': [],
    'compositions': [{
      'name': name,
      'id': 1,
      'duration': 5,
      'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
      'items': [{
        'name': 'item_1',
        'delay': 0,
        'id': 2,
        'type': '1',
        'parentId': 3,
        'ro': 0.01,
        'sprite': {
          'options': {
            'startLifetime': 2,
            'startSize': 1,
            'sizeAspect': 1,
            'startColor': [8, [243, 11, 11, 1]],
            'duration': 2,
            'gravityModifier': 1,
            'renderLevel': 'B+',
            'looping': true,
          }, 'renderer': { 'renderMode': 1, 'anchor': [0.5, 0.5] },
        },
      }, {
        'name': 'item_1',
        'delay': 0,
        'id': 1,
        'type': '1',
        'parentId': 3,
        'ro': 0.01,
        'sprite': {
          'options': {
            'startLifetime': 2,
            'startSize': 1,
            'sizeAspect': 1,
            'startColor': [8, [255, 255, 255]],
            'duration': 2,
            'gravityModifier': 1,
            'renderLevel': 'B+',
            'looping': true,
          },
          'renderer': { 'renderMode': 1, 'anchor': [1, 0.5] },
          'transform': { 'position': [1, 1, -0.0000023182466755145015] },
        },
      }, {
        'name': 'null_2',
        'delay': 0,
        'id': 3,
        'type': '3',
        'cal': {
          'options': {
            'duration': 2,
            'startSize': 2,
            'sizeAspect': 1,
            'relative': true,
            'renderLevel': 'B+',
            'looping': true,
          },
          'transform': { 'position': [0, 0, 0], 'rotation': [0, 0, 0] },
          'rotationOverLifetime': { 'asRotation': true, 'angularVelocity': ['lines', [[0, 0], [0.5, 90], [1, 0]]] },
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
  };
}
