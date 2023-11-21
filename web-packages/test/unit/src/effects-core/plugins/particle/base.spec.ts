// @ts-nocheck
import { Player, ParticleSystem, spec } from '@galacean/effects';

const { expect } = chai;

describe('effects-core/plugins/particle-base', function () {
  let player;
  const canvas = document.createElement('canvas');
  const renderOptions = {
    canvas,
    pixelRatio: 1,
    manualRender: true,
    interactive: true,
  };

  beforeEach(()=>{
    player = new Player({ ...renderOptions });
  });

  after(()=>{
    player.dispose();
    player = null;
  });

  it('particle options', async () => {
    const options = {
      'startLifetime': 2,
      'startSize': 3,
      'startSpeed': 0,
      'startColor': [
        8,
        [
          255,
          255,
          255,
        ],
      ],
      'duration': 1,
      'maxCount': 1,
      'gravityModifier': 1,
      'endBehavior': 4,
      'renderLevel': 'B+',
    };
    const json = generateScene(options);
    const scene = await player.createComposition(JSON.parse(json));

    await player.gotoAndPlay(0.01);
    const item = scene.getItemByName('item');
    const ps = item.content;

    expect(ps).to.be.an.instanceof(ParticleSystem);
    expect(ps.options.startLifetime.getValue()).to.eql(2, 'startLifetime');
    expect(ps.options.startSize.getValue()).to.eql(3, 'startSize');
    expect(ps.options.startSpeed.getValue()).to.eql(0, 'startSpeed');
    expect(ps.options.startColor.getValue()).to.eql([255, 255, 255], 'startColor');
    expect(ps.options.duration).to.eql(5, 'duration');
    expect(ps.options.maxCount).to.eql(1, 'maxCount');
    expect(ps.options.gravityModifier.getValue()).to.eql(1, 'gravityModifier');
    expect(ps.options.endBehavior).to.eql(spec.END_BEHAVIOR_DESTROY, 'endBehavior');
    expect(ps.options.looping).to.eql(false, 'looping');
  });

  it('particle colors', async () => {
    const json = '{"compositionId":5,"requires":[],"compositions":[{"name":"1","id":5,"duration":5,"camera":{"fov":60,"far":20,"near":2,"position":[0,0,8],"clipMode":0,"z":8},"items":[{"start3DSize":true,"endBehavior":0,"name":"pure","duration":5,"delay":0.2,"id":"26","type":"2","visible":true,"renderLevel":"B+","content":{"startRotationZ":[0,0],"startRotationX":[0,0],"startRotationY":[0,0],"startDelay":[0,0],"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":2,"startSize":3,"startSpeed":0,"startColor":[8,[255,255,255]],"duration":1,"maxCount":1,"gravityModifier":1,"endBehavior":4,"renderLevel":"B+"},"emission":{"rateOverTime":1},"renderer":{"texture":0,"order":-1,"renderMode":1,"occlusion":true},"rotationOverLifetime":{"asRotation":true,"separateAxes":true,"z":[0,0],"x":[4,[0,1]],"y":[4,[0,1]]},"transform":{"position":[0,0,-6.993612409189609e-7]},"splits":[[0.001953125,0.001953125,0.5,0.5,0]],"positionOverLifetime":{"startSpeed":[0,0],"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"gradient","start3DSize":true,"endBehavior":0,"duration":5,"delay":0.2,"id":"26","type":"2","visible":true,"renderLevel":"B+","content":{"startRotationZ":[0,0],"startRotationX":[0,0],"startRotationY":[0,0],"startDelay":[0,0],"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":2,"startSize":3,"startSpeed":0,"startColor":[9,[[0,0.8588235294117647,0.09411764705882353,0.09411764705882353,1],[1,0.6980392156862745,0.32941176470588235,0.32941176470588235,1]]],"duration":1,"maxCount":1,"gravityModifier":1,"endBehavior":4,"renderLevel":"B+"},"emission":{"rateOverTime":1},"renderer":{"texture":0,"order":-1,"renderMode":1,"occlusion":true},"rotationOverLifetime":{"asRotation":true,"separateAxes":true,"z":[0,0],"x":[4,[0,1]],"y":[4,[0,1]]},"transform":{"position":[0,0,-6.993612409189609e-7]},"splits":[[0.001953125,0.001953125,0.5,0.5,0]],"positionOverLifetime":{"startSpeed":[0,0],"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"colors","start3DSize":true,"endBehavior":0,"duration":5,"delay":0.2,"id":"26","type":"2","visible":true,"renderLevel":"B+","content":{"startRotationZ":[0,0],"startRotationX":[0,0],"startRotationY":[0,0],"startDelay":[0,0],"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":2,"startSize":3,"startSpeed":0,"startColor":[13,[[1,1,1,1],[0,0,0,1]]],"duration":1,"maxCount":1,"gravityModifier":1,"endBehavior":4,"renderLevel":"B+"},"emission":{"rateOverTime":1},"renderer":{"texture":0,"order":-1,"renderMode":1,"occlusion":true},"rotationOverLifetime":{"asRotation":true,"separateAxes":true,"z":[0,0],"x":[4,[0,1]],"y":[4,[0,1]]},"transform":{"position":[0,0,-6.993612409189609e-7]},"splits":[[0.001953125,0.001953125,0.5,0.5,0]],"positionOverLifetime":{"startSpeed":[0,0],"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}],"previewSize":[0,0],"endBehavior":1,"startTime":0}],"gltf":[],"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*OIR4RY9qmrEAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*UI-NSIe2AywAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"version":"1.5","shapes":[],"plugins":[],"type":"mars","textures":[{"source":0,"flipY":true}]}';
    const comp = await player.createComposition(JSON.parse(json));

    await player.gotoAndPlay(0.01);
    const pure = comp.getItemByName('pure');
    const colors = comp.getItemByName('colors');
    const gradient = comp.getItemByName('gradient');

    expect(pure.content.options.startColor.getValue()).to.eql([255, 255, 255], 'pure color');
    expect(gradient.content.options.startColor.stops).to.eql([
      { stop: 0, color: [0.8588235294117647, 0.09411764705882353, 0.09411764705882353, 1] },
      { stop: 1, color: [0.6980392156862745, 0.32941176470588235, 0.32941176470588235, 1] },
    ], 'colors');
    expect(colors.content.options.startColor.items).to.eql([
      [1, 1, 1, 1],
      [0, 0, 0, 1],
    ], 'gradient');

  });
});

const generateScene = options => {
  return `{"compositionId":5,"requires":[],"compositions":[{"name":"1","id":5,"duration":5,"camera":{"fov":60,"far":20,"near":2,"position":[0,0,8],"clipMode":0,"z":8},"items":[{"start3DSize":true,"endBehavior":0,"name":"item","duration":5,"delay":0.2,"id":"26","type":"2","visible":true,"renderLevel":"B+","content":{"startRotationZ":[0,0],"startRotationX":[0,0],"startRotationY":[0,0],"startDelay":[0,0],"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":${JSON.stringify(options)},"emission":{"rateOverTime":1},"renderer":{"texture":0,"order":-1,"renderMode":1,"occlusion":true},"rotationOverLifetime":{"asRotation":true,"separateAxes":true,"z":[0,0],"x":[4,[0,1]],"y":[4,[0,1]]},"transform":{"position":[0,0,-6.993612409189609e-7]},"splits":[[0.001953125,0.001953125,0.5,0.5,0]],"positionOverLifetime":{"startSpeed":[0,0],"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}],"previewSize":[0,0],"endBehavior":1,"startTime":0}],"gltf":[],"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*OIR4RY9qmrEAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*UI-NSIe2AywAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"version":"1.5","shapes":[],"plugins":[],"type":"mars","textures":[{"source":0,"flipY":true}]}`;
};
