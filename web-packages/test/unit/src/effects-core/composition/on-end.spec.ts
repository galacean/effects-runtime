import { Player, spec } from '@galacean/effects';

const { expect } = chai;

describe('composition onEnd', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
    });
  });

  afterEach(() => {
    player.dispose();
    // @ts-expect-error
    player = null;
  });

  it('composition destroy', async () => {
    await test(spec.END_BEHAVIOR_DESTROY, () => {
      console.info('dispose');
    });

    expect(player.paused).to.be.false;
  });

  it('composition freeze', async () => {
    await test(spec.END_BEHAVIOR_FREEZE, () => {
      console.info('freeze');
    });

    expect(player.paused).to.be.false;
  });

  // it('composition forward', async () => {
  //   const composition = await test(spec.END_BEHAVIOR_FORWARD, ()=>{
  //     console.info('forward');
  //   });

  //   expect(player.paused).to.be.false;
  //   expect(composition.renderer).to.exist;
  // });

  it('composition restart', async () => {
    const composition = await test(spec.END_BEHAVIOR_RESTART, () => {
      console.info('restart');
    });

    expect(player.paused).to.be.false;
    expect(composition.renderer).to.exist;

    composition.gotoAndPlay(2);
    await sleep(10);
    // @ts-expect-error
    expect(composition.spy).to.has.been.called.twice;
  });

  it('call on end with url', async () => {
    const endHandler = chai.spy(() => {
      console.info('end');
    });
    const composition = await player.loadScene('https://gw.alipayobjects.com/os/gltf-asset/mars-cli/JGAMKCTBFYHP/673346023-118d4.json');

    composition.on('end', endHandler);
    composition.gotoAndPlay(1.1);
    expect(endHandler).to.has.been.called;
  });

  it('composition start time', async () => {
    const json = '{"compositionId":14,"requires":[],"compositions":[{"name":"1080-261 (1)","id":14,"startTime":1.3,"duration":2,"endBehavior":5,"camera":{"fov":60,"far":20,"near":0.1,"aspect":null,"clipMode":0,"position":[0,0,8],"rotation":[0,0,0]},"items":[{"name":"红包.png","delay":0,"id":85,"type":"1","sprite":{"options":{"startSize":6.8573,"sizeAspect":0.9897,"startColor":[8,[255,255,255]],"duration":4.125,"gravityModifier":1,"looping":false,"endBehavior":0,"renderLevel":"B+","size":[6.8573,6.928665252096595]},"transform":{"position":[5,0,0],"rotation":[0,0,0],"scale":[1,1,1],"path":["bezier",[[[0,0,0,1],[0.4646,0.4646,1,0],[1,0.4646,1,1]],[[-10.517,7.035,0],[-21.176,-1.7055,0],[-21.176,-1.7055,0]],[[-12.2935,5.5782,0],[-19.3995,-0.2487,0],[-21.176,-1.7055,0],[-21.176,-1.7055,0]]]]},"renderer":{"renderMode":1,"texture":0},"sizeOverLifetime":{"separateAxes":true,"x":0.65,"y":-0.65,"z":1},"colorOverLifetime":{"opacity":1},"rotationOverLifetime":{"angularVelocity":82,"asRotation":true},"splits":[[0.00390625,0.00390625,0.75390625,0.76171875,0]]}}],"meta":{"previewSize":[1080,260]}}],"gltf":[],"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*qjLoQ57sQ3IAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*3drrS7rLI1QAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"spines":[],"version":"0.1.47","shapes":[],"plugins":[],"type":"mars","bins":[],"textures":[{"source":0,"flipY":true}]}';
    const composition = await player.loadScene(JSON.parse(json));

    expect(composition.startTime).to.eql(1.3);
    expect(composition.time).to.eql(1.3);
  });

  async function test (endBehavior: spec.EndBehavior, fn: () => void) {
    const json = {
      'compositionId': 1,
      'requires': [],
      'compositions': [{
        'name': 'composition_1',
        'id': 1,
        'duration': 2,
        'endBehavior': endBehavior,
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
    const endHandler = chai.spy(fn);
    const composition = await player.loadScene(json);

    composition.on('end', endHandler);
    expect(endHandler).not.has.been.called;
    composition.gotoAndPlay(2.1);
    await sleep(10);
    expect(endHandler).to.has.been.called.once;

    // @ts-expect-error
    composition.spy = endHandler;

    return composition;
  }
});

function sleep (ms: number) {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}
