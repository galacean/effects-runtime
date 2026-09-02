import type { GLEngine } from '@galacean/effects';
import { Player } from '@galacean/effects';

const { expect } = chai;

describe('player/event', () => {
  let player: Player;

  afterEach(() => {
    player.dispose();
    // @ts-expect-error
    player = null;
  });

  it('play pause/resume', async () => {
    player = new Player({
      canvas: document.createElement('canvas'),
    });
    const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*de0NTrRAyzoAAAAAAAAAAAAADlB4AQ';
    let index = 0;

    await player.loadScene(json);
    player.pause();
    await player.resume();
    player.on('update', (info: { playing: boolean }) => {
      if (index === 0) {
        expect(info.playing).to.be.false;
      } else {
        expect(info.playing).to.be.true;
      }

      index += 1;
    });

    player.dispose();
  });

  it('dispose preserves a caller-owned canvas for reuse', () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');

    container.style.width = '64px';
    container.style.height = '64px';
    container.appendChild(canvas);
    document.body.appendChild(container);
    player = new Player({ canvas, manualRender: true });

    expect(player.engine.ownsCanvas).to.equal(false);

    player.dispose();

    expect(canvas.parentNode).to.equal(container);
    container.remove();
  });

  it('dispose releases a Player-owned canvas', () => {
    const container = document.createElement('div');

    container.style.width = '64px';
    container.style.height = '64px';
    document.body.appendChild(container);
    player = new Player({ container, manualRender: true });
    const canvas = player.canvas;

    expect(player.engine.ownsCanvas).to.equal(true);
    player.dispose();

    expect(canvas.parentNode).to.equal(null);
    container.remove();
  });

  it('player lost/restored', async () => {
    player = new Player({
      canvas: document.createElement('canvas'),
    });
    const lost = chai.spy();
    const restored = chai.spy();
    const { gl } = (player.renderer.engine as GLEngine).context;
    const ext = gl?.getExtension('WEBGL_lose_context');
    const lostEvent = new Promise<void>(resolve => {
      player.on('webglcontextlost', () => {
        lost();
        resolve();
      });
    });
    const restoredEvent = new Promise<void>(resolve => {
      player.on('webglcontextrestored', () => {
        restored();
        resolve();
      });
    });

    expect(ext).to.exist;
    ext!.loseContext();
    await lostEvent;
    await new Promise(resolve => { setTimeout(resolve); });
    ext!.restoreContext();
    await restoredEvent;

    player.dispose();

    expect(lost).to.have.been.called.once;
    expect(restored).to.have.been.called.once;
  });
});
