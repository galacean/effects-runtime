import type { GLRenderer } from '@galacean/effects';
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
    const { gl } = (player.renderer as GLRenderer).context;
    const ext = gl?.getExtension('WEBGL_lose_context');

    player.on('webglcontextlost', event => {
      lost();
    });

    player.on('webglcontextrestored', () => {
      restored();
    });

    ext?.loseContext();

    // 添加延迟以确保上下文有足够的时间恢复
    await new Promise(resolve => setTimeout(resolve, 100));

    ext?.restoreContext();

    // 再次添加延迟以确保恢复事件被触发
    await new Promise(resolve => setTimeout(resolve, 100));

    player.dispose();

    expect(lost).to.have.been.called.once;
    expect(restored).to.have.been.called.once;
  });
});
