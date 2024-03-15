// @ts-nocheck
import { Player, disableAllPlayer } from '@galacean/effects';
import { getDowngradeResult, checkDowngradeResult } from '@galacean/effects-plugin-downgrade';

const { expect } = chai;

describe('downgrade plugin', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player({ canvas: document.createElement('canvas') });
  });

  afterEach(() => {
    player.dispose();
  });

  it('fake downgrade', async () => {
    const downgrade = getDowngradeResult('mock-fail');
    const catchFunc = chai.spy('error');
    const json = '{"compositionId":1,"requires":[],"compositions":[{"name":"composition_1","id":1,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1},"items":[{"name":"item_1","delay":0,"id":1,"type":"1","ro":0.1,"sprite":{"options":{"startLifetime":2,"startSize":1.2,"sizeAspect":1,"startColor":["color",[255,255,255]],"duration":2,"gravityModifier":1,"renderLevel":"B+"},"renderer":{"renderMode":1,"anchor":[0.5,0.5]}}}],"meta":{"previewSize":[750,1624]}}],"gltf":[],"images":[],"version":"0.9.0","shapes":[],"plugins":[],"type":"mars","_imgs":{"1":[]}}';

    try {
      await player.loadScene(JSON.parse(json), {
        pluginData: {
          downgrade,
        },
      });
    } catch (e) {
      catchFunc();
    }

    expect(catchFunc).to.has.been.called.once;
  });

  it('protect webgl lost', async () => {
    const canvas = document.createElement('canvas');
    const gl = player.renderer.glRenderer.gl;

    gl.getExtension('WEBGL_lose_context').loseContext();
    const spy = canvas.getContext = chai.spy('getContext');

    expect(() => new Player({ canvas })).to.throw(/does not support WebGL or the WebGL version is incorrect/);
    expect(spy).not.to.has.been.called.once;
    disableAllPlayer(false);
  });

  it('when webgl lost, new player will destroy', () => {
    const gl = player.renderer.glRenderer.gl;
    const canvas = document.createElement('canvas');
    const spy = canvas.getContext = chai.spy('getContext');
    const catchFunc = chai.spy('error');

    player.canvas.addEventListener('webglcontextlost', () => {
      try {
        const p2 = new Player({ canvas });

        expect(spy).not.to.has.been.called.once;
        expect(p2.canvas).to.not.exist;
        expect(p2.container).to.not.exist;
        expect(p2.renderer).to.not.exist;
      } catch (e) {
        catchFunc();
      }

      expect(catchFunc).to.has.been.called.once;
    });

    gl.getExtension('WEBGL_lose_context').loseContext();
    disableAllPlayer(false);
  });
});

