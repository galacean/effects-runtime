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
