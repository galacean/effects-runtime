import { Player, spec } from '@galacean/effects';
import { getDowngradeResult } from '@galacean/effects-plugin-alipay-downgrade';

const { expect } = chai;

describe('Player downgrade', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player({ canvas: document.createElement('canvas') });
  });

  afterEach(() => {
    player.dispose();
  });

  it('mock-pass', async () => {
    const playerFunc = chai.spy(() => 'player error');
    const catchFunc = chai.spy(() => 'catch error');
    const downgrade = await getDowngradeResult('mock-pass');
    const json = '{"compositionId":1,"requires":[],"compositions":[{"name":"composition_1","id":1,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1},"items":[{"name":"item_1","delay":0,"id":1,"type":"1","ro":0.1,"sprite":{"options":{"startLifetime":2,"startSize":1.2,"sizeAspect":1,"startColor":["color",[255,255,255]],"duration":2,"gravityModifier":1,"renderLevel":"B+"},"renderer":{"renderMode":1,"anchor":[0.5,0.5]}}}],"meta":{"previewSize":[750,1624]}}],"gltf":[],"images":[],"version":"0.9.0","shapes":[],"plugins":[],"type":"mars","_imgs":{"1":[]}}';

    try {
      const comp = await player.loadScene(JSON.parse(json), {
        pluginData: {
          downgrade,
        },
      });

      expect(comp.getEngine().renderLevel).to.equal(spec.RenderLevel.S);
      playerFunc();
    } catch (e) {
      catchFunc();
    }
    expect(playerFunc).to.have.been.called.once;
    expect(catchFunc).not.to.have.been.called();
  });

  it('mock-fail', async () => {
    const playerFunc = chai.spy(() => 'player error');
    const downgrade = await getDowngradeResult('mock-fail');
    const json = '{"compositionId":1,"requires":[],"compositions":[{"name":"composition_1","id":1,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1},"items":[{"name":"item_1","delay":0,"id":1,"type":"1","ro":0.1,"sprite":{"options":{"startLifetime":2,"startSize":1.2,"sizeAspect":1,"startColor":["color",[255,255,255]],"duration":2,"gravityModifier":1,"renderLevel":"B+"},"renderer":{"renderMode":1,"anchor":[0.5,0.5]}}}],"meta":{"previewSize":[750,1624]}}],"gltf":[],"images":[],"version":"0.9.0","shapes":[],"plugins":[],"type":"mars","_imgs":{"1":[]}}';

    try {
      await player.loadScene(JSON.parse(json), {
        pluginData: {
          downgrade,
        },
      });
      playerFunc();
    } catch (e: any) {
      expect(e.message).to.equal('Load error in plugin:onSceneLoadStart, Error: Downgraded, reason: mock.');
    }
    expect(playerFunc).not.to.have.been.called();
  });

  it('current', async () => {
    const playerFunc = chai.spy(() => 'player error');
    const catchFunc = chai.spy(() => 'catch error');
    const downgrade = await getDowngradeResult('');
    const json = '{"compositionId":1,"requires":[],"compositions":[{"name":"composition_1","id":1,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1},"items":[{"name":"item_1","delay":0,"id":1,"type":"1","ro":0.1,"sprite":{"options":{"startLifetime":2,"startSize":1.2,"sizeAspect":1,"startColor":["color",[255,255,255]],"duration":2,"gravityModifier":1,"renderLevel":"B+"},"renderer":{"renderMode":1,"anchor":[0.5,0.5]}}}],"meta":{"previewSize":[750,1624]}}],"gltf":[],"images":[],"version":"0.9.0","shapes":[],"plugins":[],"type":"mars","_imgs":{"1":[]}}';

    try {
      const comp = await player.loadScene(JSON.parse(json), {
        pluginData: {
          downgrade,
        },
      });

      expect(comp.getEngine().renderLevel).to.equal(spec.RenderLevel.S);
      playerFunc();
    } catch (e) {
      catchFunc();
    }
    expect(playerFunc).to.have.been.called.once;
    expect(catchFunc).not.to.have.been.called();
  });

  it('not downgrade', async () => {
    const playerFunc = chai.spy(() => 'player error');
    const catchFunc = chai.spy(() => 'catch error');
    const downgrade = {
      downgrade: false,
      level: spec.RenderLevel.A,
      reason: 'mock1',
    };
    const json = '{"compositionId":1,"requires":[],"compositions":[{"name":"composition_1","id":1,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1},"items":[{"name":"item_1","delay":0,"id":1,"type":"1","ro":0.1,"sprite":{"options":{"startLifetime":2,"startSize":1.2,"sizeAspect":1,"startColor":["color",[255,255,255]],"duration":2,"gravityModifier":1,"renderLevel":"B+"},"renderer":{"renderMode":1,"anchor":[0.5,0.5]}}}],"meta":{"previewSize":[750,1624]}}],"gltf":[],"images":[],"version":"0.9.0","shapes":[],"plugins":[],"type":"mars","_imgs":{"1":[]}}';

    try {
      const comp = await player.loadScene(JSON.parse(json), {
        pluginData: {
          downgrade,
        },
      });

      expect(comp.getEngine().renderLevel).to.equal(spec.RenderLevel.A);
      playerFunc();
    } catch (e) {
      catchFunc();
    }
    expect(playerFunc).to.have.been.called.once;
    expect(catchFunc).not.to.have.been.called();
  });

  it('downgrade', async () => {
    const playerFunc = chai.spy(() => 'player error');
    const catchFunc = chai.spy(() => 'catch error');
    const downgrade = {
      downgrade: true,
      level: spec.RenderLevel.A,
      reason: 'downgrade test',
    };
    const json = '{"compositionId":1,"requires":[],"compositions":[{"name":"composition_1","id":1,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1},"items":[{"name":"item_1","delay":0,"id":1,"type":"1","ro":0.1,"sprite":{"options":{"startLifetime":2,"startSize":1.2,"sizeAspect":1,"startColor":["color",[255,255,255]],"duration":2,"gravityModifier":1,"renderLevel":"B+"},"renderer":{"renderMode":1,"anchor":[0.5,0.5]}}}],"meta":{"previewSize":[750,1624]}}],"gltf":[],"images":[],"version":"0.9.0","shapes":[],"plugins":[],"type":"mars","_imgs":{"1":[]}}';

    try {
      await player.loadScene(JSON.parse(json), {
        pluginData: {
          downgrade,
        },
      });

      playerFunc();
    } catch (e: any) {
      catchFunc();
      expect(e.message).to.equal('Load error in plugin:onSceneLoadStart, Error: Downgraded, reason: downgrade test.');
    }
    expect(catchFunc).to.have.been.called.once;
    expect(playerFunc).not.to.have.been.called();
  });
});

