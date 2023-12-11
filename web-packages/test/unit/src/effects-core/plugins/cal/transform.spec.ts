// @ts-nocheck
import { Player, Transform } from '@galacean/effects';
import { sanitizeNumbers } from '../../../utils';

const { expect } = chai;

describe('calculate item transform', () => {
  let player;
  const canvas = document.createElement('canvas');

  beforeEach(() => {
    player = new Player({
      canvas,
      manualRender: true,
    });
  });

  afterEach(() => {
    player.dispose();
    player = null;
  });

  // if parent lifetime not begin, it will not affect children
  it('cascade transform for delay and end', async () => {
    const comp = await generateComposition(
      [
        { id: '1', name: 'p', transform: { position: [1, 0, 0] }, delay: 0.5, duration: 1 },
        { id: '2', parentId: '1', name: 'x', transform: { position: [0, 1, 0] }, duration: 5 },
      ],
      player,
    );
    const item = comp.getItemByName('x');
    const parent = comp.getItemByName('p');

    expect(sanitizeNumbers(item.transform.getWorldPosition().toArray())).to.deep.equals([0, 1, 0], 'world 0');
    expect(sanitizeNumbers(item.transform.position.toArray())).to.deep.equals([0, 1, 0], 'local 0');
    comp.gotoAndStop(comp.time + 0.6);
    expect(item.transform.parentTransform).to.eql(parent.transform, 'item transform t1');
    expect(sanitizeNumbers(item.transform.getWorldPosition().toArray())).to.deep.equals([1, 1, 0], 'world 1');
    expect(sanitizeNumbers(item.transform.position.toArray())).to.deep.equals([0, 1, 0], 'local 1');

    comp.gotoAndStop(comp.time + 1);
    expect(item.transform.parentTransform).to.eql(comp.content.transform, 'item transform t2');
    expect(sanitizeNumbers(item.transform.getWorldPosition().toArray())).to.deep.equals([0, 1, 0], 'world 0');
    expect(sanitizeNumbers(item.transform.position.toArray())).to.deep.equals([0, 1, 0], 'local 0');
  });

  it('transform set rotation', () => {
    const t = new Transform();

    t.setRotation(0, 30, 0);
    const r = t.rotation.toArray();

    expect(new Float32Array(sanitizeNumbers(r))).to.deep.equal(new Float32Array([0, 30, 0]));
  });

});

async function generateComposition (items, player, playerOptions) {
  const json = {
    requires: [],
    compositionId: '17',
    bins: [],
    textures: [],
    'compositions': [{
      'name': 'composition_1',
      'id': '17',
      'duration': 15,
      'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
      'items': items.map((item, i) => ({
        'name': item.name || ('null_' + i),
        'delay': item.delay || 0,
        'id': item.id || (10086 + i),
        'parentId': item.parentId,
        'type': '3',
        'endBehavior': 0,
        'duration': item.duration || 2,
        'renderLevel': 'B+',
        content: {
          options: {
            startColor: [
              1,
              1,
              1,
              1,
            ],
          },
          positionOverLifetime: { },
        },
        transform: item.transform,
      })),
      'previewSize': [750, 1334],
    }],
    playerVersion: {
      web: '2.4.5',
      native: '1.0.0.231013104006',
    },
    images: [],
    fonts: [],
    spines: [],
    version: '2.1',
    shapes: [],
    plugins: [],
    type: 'mars',
  };

  const scene = await player.createComposition(json);

  await player.gotoAndPlay(0.01);

  return scene;
}
