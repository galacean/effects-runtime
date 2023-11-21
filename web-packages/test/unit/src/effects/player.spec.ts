// @ts-nocheck
import { Player } from '@galacean/effects';

const { expect } = chai;

describe('player case', () => {
  let container;
  let player;
  const json = '{"compositionId":1,"requires":[],"compositions":[{"name":"composition_1","id":1,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1},"items":[{"name":"item_1","delay":0,"id":1,"type":"1","ro":0.1,"sprite":{"options":{"startLifetime":2,"startSize":1.2,"sizeAspect":1,"startColor":["color",[255,255,255]],"duration":2,"gravityModifier":1,"renderLevel":"B+"},"renderer":{"renderMode":1}}}],"meta":{"previewSize":[750,1334]}}],"gltf":[],"images":[],"version":"0.9.0","shapes":[],"plugins":[],"type":"mars","_imgs":{"1":[]}}';

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '300px';
    container.style.height = '200px';
    document.body.appendChild(container);
  });
  afterEach(() => {
    player.pause();
    player?.dispose();
    container.remove();
    container = null;
  });

  it('if webgl2 not available, use webgl', () => {
    const canvas = document.createElement('canvas');

    canvas.getContext = function (type) {
      if (type !== 'webgl') {
        return null;
      }

      return HTMLCanvasElement.prototype.getContext.apply(this, arguments);
    };
    player = new Player({
      canvas,
      renderFramework: 'webgl2',
    });
    expect(player.gpuCapability.type).to.eql('webgl');
  });

  it('if webgl2 not available, use webgl by default', () => {
    const canvas = document.createElement('canvas');

    canvas.getContext = function (type) {
      if (type !== 'webgl') {
        return null;
      }

      return HTMLCanvasElement.prototype.getContext.apply(this, arguments);
    };
    player = new Player({
      canvas,
    });
    expect(player.gpuCapability.type).to.eql('webgl');
  });

  it('must use webgl when set webgl', () => {
    const canvas = document.createElement('canvas');

    player = new Player({
      canvas,
      renderFramework: 'webgl',
    });
    expect(player.gpuCapability.type).to.eql('webgl');
  });

  it('resize canvas when pixelRatio > 1', () => {
    player = new Player({
      container,
      pixelRatio: 2,
    });
    const { width, height, clientWidth, clientHeight } = player.canvas;

    expect(width).to.eql(600);
    expect(height).to.eql(400);
    expect(clientWidth).to.eql(300);
    expect(clientHeight).to.eql(200);
  });

  it('resize canvas when pixelRatio < 1', () => {
    player = new Player({
      container,
      pixelRatio: 0.5,
    });
    const canvas = container.querySelector('canvas');

    expect(canvas.width).to.eql(150);
    expect(canvas.height).to.eql(100);
    expect(canvas.clientWidth).to.eql(300);
    expect(canvas.clientHeight).to.eql(200);
  });

  it('keep aspect when size over 2048', () => {
    const container = document.createElement('div');

    container.style.width = '1000px';
    container.style.height = '1800px';
    document.body.appendChild(container);
    player = new Player({
      container,
      pixelRatio: 2,
    });
    const canvas = container.querySelector('canvas');

    expect(canvas.height).to.eql(2048);
    expect(canvas.width).to.eql(Math.round(2048 / 18 * 10));
  });

  it('when over sized it resize to 2048 no env', () => {
    player = new Player({
      container,
      pixelRatio: 100,
    });
    const canvas = container.querySelector('canvas');

    expect(canvas.width).to.eql(2048);
    expect(canvas.height).to.eql(Math.round(2048 / 3 * 2));
    expect(canvas.clientWidth).to.eql(300);
    expect(canvas.clientHeight).to.eql(200);
  });

  it('when over sized it resize to max texture size with env', () => {
    player = new Player({
      container,
      pixelRatio: 100,
      env: 'editor',
    });
    const canvas = container.querySelector('canvas');

    expect(canvas.width).to.eql(player.gpuCapability.detail.maxTextureSize);
    expect(canvas.height).to.eql(Math.round(player.gpuCapability.detail.maxTextureSize / 3 * 2));
    expect(canvas.clientWidth).to.eql(300);
    expect(canvas.clientHeight).to.eql(200);
  });

  it('canvas to player, reset aspect', async () => {
    const canvas = document.createElement('canvas');

    canvas.width = 100;
    canvas.height = 100;
    canvas.style.width = 50 + 'px';
    player = new Player({
      canvas,
      pixelRatio: 1,
    });
    const comp = await player.loadScene(JSON.parse(json));

    expect(comp.camera.aspect).to.eql(1);
    canvas.height = 50;
    player.resize();
    expect(comp.camera.aspect).to.eql(2);
  });

});

describe('create by gl context', function () {
  const timeout = 1500;
  let player;

  this.timeout('100s');

  afterEach(() => {
    player?.dispose();
    player = null;
  });

  it('set webgl1 context', async () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');

    player = new Player({ gl });
    expect(player.gpuCapability.type).to.eql('webgl');
    player.dispose();
    //
    player = new Player({ gl, renderFramework: 'webgl2' });
    expect(player.gpuCapability.type).to.eql('webgl');
    canvas.remove();
    await sleep(timeout);
  });

  it('set webgl2 context', async () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');

    player = new Player({ gl });
    expect(player.gpuCapability.type).to.eql('webgl2');
    player.dispose();
    //
    player = new Player({ gl, renderFramework: 'webgl' });
    expect(player.gpuCapability.type).to.eql('webgl2');
    canvas.remove();
    await sleep(timeout);
  });

  it('set two webgl1 player', async () => {
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    const gl1 = canvas1.getContext('webgl');
    const gl2 = canvas2.getContext('webgl');
    const player1 = new Player({ gl: gl1 });
    const player2 = new Player({ gl: gl2 });

    expect(player1.gpuCapability.type).to.eql(player2.gpuCapability.type);
    player1.dispose();
    player2.dispose();
    canvas1.remove();
    canvas2.remove();
    await sleep(timeout);
  });

  it('set two webgl2 player', async () => {
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    const gl1 = canvas1.getContext('webgl2');
    const gl2 = canvas2.getContext('webgl2');
    const player1 = new Player({ gl: gl1 });
    const player2 = new Player({ gl: gl2 });

    expect(player1.gpuCapability.type).to.eql(player2.gpuCapability.type);
    player1.dispose();
    player2.dispose();
    canvas1.remove();
    canvas2.remove();
    await sleep(timeout);
  });

  it('set different webgl player', async () => {
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    const gl1 = canvas1.getContext('webgl2');
    const gl2 = canvas2.getContext('webgl');
    const player1 = new Player({ gl: gl1 });

    try {
      const player2 = new Player({ gl: gl2 });

      player2.dispose();
    } catch (e) {
      expect(e.message).to.equal('Initialize player with different webgl version: old=webgl2, new=webgl');
    }
    player1.dispose();
    canvas1.remove();
    canvas2.remove();
    await sleep(timeout);
  });
});

function sleep (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
