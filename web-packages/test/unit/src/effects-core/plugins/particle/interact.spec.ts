// @ts-nocheck
import { Player, math } from '@galacean/effects';

const { Vector3 } = math;
const { expect } = chai;

describe('effects-core/plugins/particle-interaction', () => {
  const canvas = document.createElement('canvas');
  const width = 512, height = 512;

  canvas.width = width; canvas.height = height;
  const renderOptions = {
    canvas,
    pixelRatio: 1,
    manualRender: true,
    interactive: true,
  };
  let player;

  beforeEach(() => {
    player = new Player({ ...renderOptions });
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('particle hit test with interaction', async () => {
    const radius = 0.5;
    const json = `{"compositionId":5,"requires":[],"compositions":[{"name":"1","id":5,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1,"z":8},"items":[{"start3DSize":true,"endBehavior":0,"name":"item","duration":5,"delay":0.2,"id":"26","type":"2","visible":true,"renderLevel":"B+","content":{"startRotationZ":[0,0],"startRotationX":[0,0],"startRotationY":[0,0],"startDelay":[0,0],"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":2,"startSize":3,"startSpeed":0,"startColor":[8,[255,255,255]],"duration":1,"maxCount":1,"gravityModifier":1,"endBehavior":4,"renderLevel":"B+"},"emission":{"rateOverTime":1},"renderer":{"texture":0,"order":-1,"renderMode":1,"occlusion":true},"interaction":{"radius":${radius},"behavior":0,"multiple":false},"rotationOverLifetime":{"asRotation":true,"separateAxes":true,"z":[0,0],"x":[4,[0,1]],"y":[4,[0,1]]},"transform":{"position":[0,0,-0.00000463649469573113]},"splits":[[0.001953125,0.001953125,0.5,0.5,0]],"positionOverLifetime":{"startSpeed":[0,0],"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}],"previewSize":[512,512],"endBehavior":1,"startTime":0}],"gltf":[],"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*OIR4RY9qmrEAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*UI-NSIe2AywAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"version":"1.5","shapes":[],"plugins":[],"type":"mars","textures":[{"source":0,"flipY":true}]}`;
    const comp = await player.createComposition(JSON.parse(json));

    await player.gotoAndPlay(1);
    const item = comp.getItemByName('item');
    const vp = comp.camera.getViewProjectionMatrix();
    const particle = item.content;

    const pos = particle.particleMesh.getPointPosition(0);
    const inPos = vp.projectPoint(pos, new Vector3());

    player.compositions.forEach(comp => {
      const regions = comp.hitTest(inPos.x, inPos.y);

      expect(regions.length).to.not.eql(0);
      const position = regions[0].position;

      expect(position.distance(pos)).closeTo(0, 1e-6);
    });

    const outPos = pos.add([radius + 0.1, radius + 0.1, 0]);

    player.compositions.forEach(comp => {
      const regions = comp.hitTest(outPos.x, outPos.y);

      expect(regions.length).to.eql(0);
    });

  });

  it('particle hit test with force', async () => {
    const json = '{"compositionId":5,"requires":[],"compositions":[{"name":"1","id":5,"duration":5,"camera":{"fov":60,"far":20,"near":2,"position":[0,0,8],"clipMode":0,"z":8},"items":[{"start3DSize":true,"endBehavior":0,"name":"item","duration":5,"delay":0.2,"id":"26","type":"2","visible":true,"renderLevel":"B+","content":{"startRotationZ":[0,0],"startRotationX":[0,0],"startRotationY":[0,0],"startDelay":[0,0],"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":2,"startSize":3,"startSpeed":0,"startColor":[8,[255,255,255]],"duration":1,"maxCount":1,"gravityModifier":1,"endBehavior":4,"renderLevel":"B+"},"emission":{"rateOverTime":1},"renderer":{"texture":0,"order":-1,"renderMode":1,"occlusion":true},"rotationOverLifetime":{"asRotation":true,"separateAxes":true,"z":[0,0],"x":[4,[0,1]],"y":[4,[0,1]]},"transform":{"position":[0,0,-6.993612409189609e-7]},"splits":[[0.001953125,0.001953125,0.5,0.5,0]],"positionOverLifetime":{"startSpeed":[0,0],"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}],"previewSize":[0,0],"endBehavior":1,"startTime":0}],"gltf":[],"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*OIR4RY9qmrEAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*UI-NSIe2AywAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"version":"1.5","shapes":[],"plugins":[],"type":"mars","textures":[{"source":0,"flipY":true}]}';
    const comp = await player.createComposition(JSON.parse(json));

    await player.gotoAndPlay(1);
    const item = comp.getItemByName('item');
    const vp = comp.camera.getViewProjectionMatrix();
    const particle = item.content;
    const pos = particle.particleMesh.getPointPosition(0);
    const inPos = vp.projectPoint(pos, new Vector3());

    player.compositions.forEach(comp => {
      const regions = comp.hitTest(inPos.x, inPos.y, true);

      expect(regions.length).to.not.eql(0);
    });
  });

  it('particle hit test without interaction and force', async () => {
    const json = '{"compositionId":5,"requires":[],"compositions":[{"name":"1","id":5,"duration":5,"camera":{"fov":60,"far":20,"near":2,"position":[0,0,8],"clipMode":0,"z":8},"items":[{"start3DSize":true,"endBehavior":0,"name":"item","duration":5,"delay":0.2,"id":"26","type":"2","visible":true,"renderLevel":"B+","content":{"startRotationZ":[0,0],"startRotationX":[0,0],"startRotationY":[0,0],"startDelay":[0,0],"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":2,"startSize":3,"startSpeed":0,"startColor":[8,[255,255,255]],"duration":1,"maxCount":1,"gravityModifier":1,"endBehavior":4,"renderLevel":"B+"},"emission":{"rateOverTime":1},"renderer":{"texture":0,"order":-1,"renderMode":1,"occlusion":true},"rotationOverLifetime":{"asRotation":true,"separateAxes":true,"z":[0,0],"x":[4,[0,1]],"y":[4,[0,1]]},"transform":{"position":[0,0,-6.993612409189609e-7]},"splits":[[0.001953125,0.001953125,0.5,0.5,0]],"positionOverLifetime":{"startSpeed":[0,0],"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}],"previewSize":[0,0],"endBehavior":1,"startTime":0}],"gltf":[],"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*OIR4RY9qmrEAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*UI-NSIe2AywAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"version":"1.5","shapes":[],"plugins":[],"type":"mars","textures":[{"source":0,"flipY":true}]}';
    const comp = await player.createComposition(JSON.parse(json));

    await player.gotoAndPlay(1);

    const item = comp.getItemByName('item');
    const vp = comp.camera.getViewProjectionMatrix();
    const particle = item.content;
    const pos = particle.particleMesh.getPointPosition(0);
    const inPos = vp.projectPoint(pos, new Vector3());

    player.compositions.forEach(comp => {
      const regions = comp.hitTest(inPos.x, inPos.y);

      expect(regions.length).to.eql(0);
    });

    const outPos = pos.clone().add([1, 1, 0]);

    player.compositions.forEach(comp => {
      const regions = comp.hitTest(outPos.x, outPos.y);

      expect(regions.length).to.eql(0);
    });

  });
});
