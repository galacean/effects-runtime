// @ts-nocheck
import { Player, ParticleVFXItem, ParticleSystem, PathSegments } from '@galacean/effects';
import { sanitizeNumbers } from '../../../utils';

const { expect } = chai;

describe('effects-core/plugins/particle-transform', () => {
  let player;

  beforeEach(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  afterEach(() => {
    player.dispose();
  });

  it('set transform', async () => {
    const comp = await generateComposition(player, [{ name: '1', type: '2', transform: { position: [0, 1, 0], rotation: [0, 90, 0] } }]);
    const item = comp.getItemByName('1');

    expect(item).to.be.an.instanceof(ParticleVFXItem);
    const t = item.getWorldTransform();

    expect(sanitizeNumbers(t.getWorldPosition())).to.deep.equals([0, 1, 0]);
    expect(sanitizeNumbers(t.getWorldRotation())).to.deep.equals([0, 90, 0]);
  });

  it('set null parent transform', async () => {
    const comp = await generateComposition(player, [
      { parentId: '1', type:'2', id: '2', name: '2', transform: { position: [0, 1, 0], scale: [1, 1, 1], rotation: [0, 0, 0] } },
      { type: '3', id: '1', transform: { position: [1, 0, 0] }, scale: [1, 1, 1], rotation: [0, 0, 0] }]);
    const item = comp.getItemByName('2');

    expect(item).to.be.an.instanceof(ParticleVFXItem);
    const t = item.getWorldTransform();

    expect(sanitizeNumbers(t.position)).to.deep.equals([1, 1, 0]);
    expect(sanitizeNumbers(item.transform.position)).to.deep.equals([0, 1, 0]);
  });

  it('set sprite parent transform', async () => {
    const comp = await generateComposition(player, [
      { parentId: '1', type:'2', id: '2', name: '2', transform: { position: [0, 1, 0], scale: [1, 1, 1], rotation: [0, 0, 0] } },
      { type: '1', id: '1', transform: { position: [1, 0, 0] }, scale: [1, 1, 1], rotation: [0, 0, 0] }]);
    const item = comp.getItemByName('2');

    expect(item).to.be.an.instanceof(ParticleVFXItem);
    const t = item.getWorldTransform();

    expect(sanitizeNumbers(t.position)).to.deep.equals([1, 1, 0]);
    expect(sanitizeNumbers(item.transform.position)).to.deep.equals([0, 1, 0]);
  });

  it('set particle parent transform', async () => {
    const comp = await generateComposition(player, [
      { parentId: '1', type:'2', id: '2', name: '2', transform: { position: [0, 1, 0], scale: [1, 1, 1], rotation: [0, 0, 0] } },
      { type: '2', id: '1', transform: { position: [1, 0, 0] }, scale: [1, 1, 1], rotation: [0, 0, 0] }]);
    const item = comp.getItemByName('2');

    expect(item).to.be.an.instanceof(ParticleVFXItem);
    const t = item.getWorldTransform();

    expect(sanitizeNumbers(t.position)).to.deep.equals([1, 1, 0]);
    expect(sanitizeNumbers(item.transform.position)).to.deep.equals([0, 1, 0]);
  });

  it('cascade null parent transform', async () => {
    const comp = await generateComposition(player, [
      { parentId: '3', type:'2', id: 2, name: '2', transform: { position: [1, 0, 0] } },
      { type: '3', id: '3', parentId: '1', transform: { position: [1, 0, 0] } },
      { type: '3', id: '1', size: 2, transform: { rotation: [0, 0, 90] } },
    ]);

    const item = comp.getItemByName('2');

    expect(item).to.be.an.instanceof(ParticleVFXItem);
    const t = item.getWorldTransform();

    expect(sanitizeNumbers(t.position, Number.EPSILON * 5)).to.deep.equals([0, -2, 0]);
    expect(sanitizeNumbers(item.transform.position)).to.deep.equals([1, 0, 0]);
  });

  it('cascade sprite parent transform', async () => {
    const comp = await generateComposition(player, [
      { parentId: '3', type:'2', id: 2, name: '2', transform: { position: [1, 0, 0] } },
      { type: '1', id: '3', parentId: '1', transform: { position: [1, 0, 0] } },
      { type: '1', id: '1', size: 2, transform: { rotation: [0, 0, 90] } },
    ]);

    const item = comp.getItemByName('2');

    expect(item).to.be.an.instanceof(ParticleVFXItem);
    const t = item.getWorldTransform();

    expect(sanitizeNumbers(t.position, Number.EPSILON * 5)).to.deep.equals([0, -2, 0]);
    expect(sanitizeNumbers(item.transform.position)).to.deep.equals([1, 0, 0]);
  });

  it('cascade sprite parent transform', async () => {
    const comp = await generateComposition(player, [
      { parentId: '3', type:'2', id: 2, name: '2', transform: { position: [1, 0, 0] } },
      { type: '2', id: '3', parentId: '1', transform: { position: [1, 0, 0] } },
      { type: '2', id: '1', size: 2, transform: { rotation: [0, 0, 90] } },
    ]);

    const item = comp.getItemByName('2');

    expect(item).to.be.an.instanceof(ParticleVFXItem);
    const t = item.getWorldTransform();

    expect(sanitizeNumbers(t.position, Number.EPSILON * 5)).to.deep.equals([0, -2, 0]);
    expect(sanitizeNumbers(item.transform.position)).to.deep.equals([1, 0, 0]);

  });

  it('cascade null and sprite parent transform', async () => {
    const comp = await generateComposition(player, [
      { parentId: '3', type:'2', id: 2, name: '2', transform: { position: [1, 0, 0] } },
      { type: '1', id: '3', parentId: '1', transform: { position: [1, 0, 0] } },
      { type: '3', id: '1', size: 2, transform: { rotation: [0, 0, 90] } },
    ]);

    const item = comp.getItemByName('2');

    expect(item).to.be.an.instanceof(ParticleVFXItem);
    const t = item.getWorldTransform();

    expect(sanitizeNumbers(t.position, Number.EPSILON * 5)).to.deep.equals([0, -2, 0]);
    expect(sanitizeNumbers(item.transform.position)).to.deep.equals([1, 0, 0]);
  });

  it('transform affects particle start position', async () => {
    const comp = await generateComposition(player, [
      { id: 2, type:'2', name: '1', transform: { position: [1, 0, 0] } },
    ]);

    comp.forwardTime(1);
    const item = comp.getItemByName('1');

    expect(item).to.be.an.instanceof(ParticleVFXItem);
    const particle = item.content;
    const pos = particle.particleMesh.getPointPosition(0);

    expect(sanitizeNumbers(pos)).to.deep.equals([1, 0, 0]);
  });

  it('world transform affects particle start position', async () => {
    const comp = await generateComposition(player, [
      { id: 2, name: '1', type:'2', parentId: '1', transform: { position: [1, 0, 0], scale: [1, 1, 1], rotation: [0, 0, 0] } },
      { type:'3', id: '1', transform: { position: [1, 0, 0], rotation: [0, 0, 90], scale: [1, 1, 1] } },
    ]);

    comp.forwardTime(1);
    const item = comp.getItemByName('1');

    expect(item).to.be.an.instanceof(ParticleVFXItem);
    const particle = item.content;
    const pos = particle.particleMesh.getPointPosition(0);

    sanitizeNumbers(item.getWorldTransform().position).forEach((v, i) => {
      expect(v).closeTo([1, -1, 0][i], 1e-6);
    });
    sanitizeNumbers(pos).forEach((v, i) => {
      expect(v).closeTo([1, -1, 0][i], 1e-6);
    });
  });

  it('transform path with asMovement', async () => {
    const comp = await generateComposition(player, [{
      name: 'item',
      type: '2',
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, -180],
        path: [7, [[[0, 0, 1, 1], [1, 1, 1, 1]], [[0, -1.5, -1], [0.2, 1.2, 0]], [[1, 1, 0], [2, 1, 0]]]],
      },
      velocityOverLifetime: {
        asMovement: true,
        speedOverLifetime: 0,
      },
    }]);
    const item = comp.getItemByName('item');

    expect(item).to.be.instanceof(ParticleVFXItem);
    const ps = item.content;

    expect(ps).to.be.an.instanceof(ParticleSystem);
    const { position, rotation, path } = ps.basicTransform;

    expect(sanitizeNumbers(rotation)).to.eql([0, 0, -180]);
    expect(position.toArray()).to.eql([0, 0, 0]);
    expect(path).to.be.an.instanceof(PathSegments);
    expect(path.keys).to.eql([[0, 0, 1, 1], [1, 1, 1, 1]]);
    expect(path.values).to.eql([[0, -1.5, -1], [0.2, 1.2, 0]]);
    expect(ps.particleMesh.linearVelOverLifetime.asMovement).to.be.true;
    expect(ps.particleMesh.speedOverLifetime).to.not.exist;
  });
});

async function generateComposition (player, opts) {
  const json = {
    'compositionId': 5,
    'requires': [],
    'compositions': [
      {
        'name': '1',
        'id': 5,
        'duration': 5,
        'camera': {
          'fov': 30,
          'far': 20,
          'near': 0.1,
          'position': [
            0,
            0,
            8,
          ],
          'clipMode': 1,
          'z': 8,
        },
        'items': opts.map((opt, i) => (
          {
            'start3DSize': true,
            'endBehavior': 0,
            'name': opt.name || ('item_' + i),
            'duration': 5,
            'delay': opt.delay || 0,
            'id': opt.id || i,
            'parentId': opt.parentId,
            'type': opt.type,
            'visible': true,
            'renderLevel': 'B+',
            'content': {
              'startRotationZ': [0, 0],
              'startRotationX': [0, 0],
              'startRotationY': [0, 0],
              'startDelay': [0, 0],
              'shape': { 'type': 0, 'radius': 1, 'arc': 360, 'arcMode': 0, 'alignSpeedDirection': false, 'shape': 'None' },
              'options': {
                'startLifetime': 0,
                'startSize': opt.size || 1,
                'startSpeed': 0,
                'startColor': [
                  8,
                  [
                    255,
                    255,
                    255,
                  ],
                ],
                'duration': opt.duration || 2,
                'maxCount': 10,
                'gravityModifier': 1,
                'endBehavior': 4,
                'renderLevel': 'B+',
              },
              'emission': {
                'rateOverTime': 1,
              },
              emitterTransform: { path: opt.transform.path },
              'renderer': {
                'order': -1,
                'renderMode': 1,
                'occlusion': true,
              },
              'interaction': {
                'radius': 1,
                'behavior': 0,
                'multiple': false,
              },
              rotationOverLifetime: opt.rotationOverLifetime,
              'positionOverLifetime': {
                'asMovement': true,
                'linearX': [0, 0],
                'linearY': [0, 0],
                'linearZ': [0, 0],
                'asRotation': false,
                'orbitalX': [0, 0],
                'orbitalY': [0, 0],
                'orbitalZ': [0, 0],
                'orbCenter': [0, 0, 0],
                'forceTarget': false,
                'gravity': [0, 0, 0],
                'gravityOverLifetime': [0, 1],
              },
              velocityOverLifetime: opt.velocityOverLifetime,
            },
            'transform': opt.transform,
          }
        )),
        'previewSize': [
          512,
          512,
        ],
        'endBehavior': 1,
        'startTime': 0,
      },
    ],
    'gltf': [],
    'images': [],
    'version': '1.5',
    'shapes': [],
    'plugins': [],
    'type': 'mars',
    'textures': [],
  };
  const scene = await player.loadScene(json);

  player.gotoAndStop(0.01);

  return scene;
}
