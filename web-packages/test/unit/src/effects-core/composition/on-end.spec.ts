// @ts-nocheck
import { Player, Texture, spec } from '@galacean/effects';

const { expect } = chai;

describe('composition onEnd', () => {
  let player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  afterEach(() => {
    player.resume();
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('composition destroy', async () => {
    await test(spec.END_BEHAVIOR_DESTROY, 'dispose');
    expect(player.paused).to.be.false;
  });

  it('composition pause', async () => {
    await test(spec.END_BEHAVIOR_PAUSE, 'pause');
    expect(player.paused).to.be.true;
  });

  it('composition forward', async () => {
    const comp = await test(spec.END_BEHAVIOR_FORWARD, 'forward');

    expect(player.paused).to.be.false;
    expect(comp.renderer).to.exist;
  });

  it('composition restart', async () => {
    const comp = await test(spec.END_BEHAVIOR_RESTART, 'restart');

    expect(player.paused).to.be.false;
    expect(comp.renderer).to.exist;
    const spy = comp.handleEnd;

    comp.forwardTime(2);
    await sleep(10);
    expect(spy).to.has.been.called.twice;
  });

  it('composition pause and destroy', async () => {
    const comp = await test(spec.END_BEHAVIOR_PAUSE_AND_DESTROY, 'pause & dispose');

    expect(player.paused).to.be.true;
    // TODO 销毁逻辑
    // expect(comp.renderer).not.exist;
  });

  it('call onEnd url', async () => {
    const scn = await player.loadScene('https://gw.alipayobjects.com/os/gltf-asset/mars-cli/JGAMKCTBFYHP/673346023-118d4.json');
    const onEnd = chai.spy('onEnd');
    const comp = await player.play(scn, { onEnd });

    comp.forwardTime(1.1);
    expect(onEnd).to.has.been.called;
  });

  it('composition start time', async () => {
    const scn = await player.loadScene({
      'compositionId': 14,
      'requires': [],
      'compositions': [{
        'name': '1080-261 (1)',
        'id': 14,
        startTime: 1.3,
        'duration': 2,
        'endBehavior': 5,
        'camera': {
          'fov': 60,
          'far': 20,
          'near': 0.1,
          'aspect': null,
          'clipMode': 0,
          'position': [0, 0, 8],
          'rotation': [0, 0, 0],
        },
        'items': [{
          'name': '红包.png',
          'delay': 0,
          'id': 85,
          'type': '1',
          'sprite': {
            'options': {
              'startSize': 6.8573,
              'sizeAspect': 0.9897,
              'startColor': [8, [255, 255, 255]],
              'duration': 4.125,
              'gravityModifier': 1,
              'looping': false,
              'endBehavior': 0,
              'renderLevel': 'B+',
              'size': [6.8573, 6.928665252096595],
            },
            'transform': {
              'position': [5, 0, 0],
              'rotation': [0, 0, 0],
              'scale': [1, 1, 1],
              'path': ['bezier', [[[0, 0, 0, 1], [0.4646, 0.4646, 1, 0], [1, 0.4646, 1, 1]], [[-10.517, 7.035, 0], [-21.176, -1.7055, 0], [-21.176, -1.7055, 0]], [[-12.2935, 5.5782, 0], [-19.3995, -0.2487, 0], [-21.176, -1.7055, 0], [-21.176, -1.7055, 0]]]],
            },
            'renderer': { 'renderMode': 1, 'texture': 0 },
            'sizeOverLifetime': { 'separateAxes': true, 'x': 0.65, 'y': -0.65, 'z': 1 },
            'colorOverLifetime': { 'opacity': 1 },
            'rotationOverLifetime': { 'angularVelocity': 82, 'asRotation': true },
            'splits': [[0.00390625, 0.00390625, 0.75390625, 0.76171875, 0]],
          },
        }],
        'meta': { 'previewSize': [1080, 260] },
      }],
      'gltf': [],
      'images': [{
        'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*qjLoQ57sQ3IAAAAAAAAAAAAADlB4AQ/original',
        'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*3drrS7rLI1QAAAAAAAAAAAAADlB4AQ/original',
        'renderLevel': 'B+',
      }],
      'spines': [],
      'version': '0.1.47',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      'bins': [],
      'textures': [{ 'source': 0, 'flipY': true }],
    });
    const comp = await player.play(scn);

    expect(comp.startTime).to.eql(1.3);
    expect(comp.time).to.eql(1.3);
  });

  async function test (endBehavior, label) {
    const json = {
      'compositionId': 1,
      'requires': [],
      'compositions': [{
        'name': 'composition_1',
        'id': 1,
        'duration': 2,
        endBehavior,
        'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
        'items': [{
          'name': 'item_1',
          'delay': 0,
          'id': 1,
          'type': '1',
          'ro': 0.1,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.2,
              'sizeAspect': 1,
              'startColor': [8, [255, 255, 255]],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
            }, 'renderer': { 'renderMode': 1 },
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
    const onEnd = chai.spy(label);
    const scn = await player.loadScene(json);
    const comp = await player.play(scn, { onEnd });

    expect(onEnd).not.has.been.called;
    comp.forwardTime(2.1);
    await sleep(10);
    expect(onEnd).to.has.been.called.once;

    comp.handleEnd = onEnd;

    return comp;
  }
});

describe('offload texture', () => {
  let player;

  before(() => {
    // TODO manualRender: false时测试通过，但是会持续console错误，和销毁逻辑有关。
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  afterEach(() => {
    player.resume();
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('offload url image', async () => {
    const scn = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*puemTqmp78EAAAAAAAAAAAAADlB4AQ');
    const comp = await player.play(scn);
    const tex = comp.textures[0];

    expect(tex.width).to.eql(2048);
    expect(tex.height).to.eql(2048);
    player.pause({ offloadTexture: true });

    expect(tex.width).to.eql(1);
    expect(tex.height).to.eql(1);
    await player.resume();
    expect(tex.width).to.eql(2048);
    expect(tex.height).to.eql(2048);
  });

  it('keepResource makes scene to be played multiple times', async () => {
    const scn = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*puemTqmp78EAAAAAAAAAAAAADlB4AQ');
    let comp = await player.play(scn, { keepResource: true, currentTime: 0.2 });
    const tex = comp.textures[0];

    expect(tex).to.exist;
    expect(tex).to.be.an.instanceof(Texture);
    comp.dispose();
    expect(tex.isDestroyed).to.be.false;
    comp = await player.play(scn, { currentTime: 0.2 });
    comp.dispose();

    // TODO 销毁逻辑
    //expect(tex.isDestroyed).to.be.true;
  });
});

function sleep (ms) {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}
