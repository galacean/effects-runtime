import { restoreTestState } from '../helpers/spies';
import type { VideoComponent } from '@galacean/effects-plugin-multimedia';
import { pauseVideoComponent, playVideoComponent } from '../../../../../../plugin-packages/editor-gizmo/src/2d/items/media-controls';

const { expect } = chai;

describe('plugin-editor-gizmo/media-controls', () => {
  afterEach(restoreTestState);

  function createPendingPlay () {
    let resolvePlay!: () => void;
    let rejectPlay!: (error: unknown) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolvePlay = resolve;
      rejectPlay = reject;
    });

    return { promise, reject: rejectPlay, resolve: resolvePlay };
  }

  function createVideoComponent (playPromise?: Promise<void>) {
    return {
      pauseVideo: chai.spy(),
      playVideo: chai.spy(),
      playPromise: playPromise ?? null,
    } as unknown as VideoComponent;
  }

  describe('video component media controls', () => {
    it('等待在途 play 完成后再暂停', async () => {
      const pendingPlay = createPendingPlay();
      const videoComponent = createVideoComponent(pendingPlay.promise);

      pauseVideoComponent(videoComponent);

      expect(videoComponent.pauseVideo).not.to.have.been.called();

      pendingPlay.resolve();
      await pendingPlay.promise;

      expect(videoComponent.pauseVideo).to.have.been.called.once;
    });

    it('在途 play 拒绝时也收敛暂停且消费拒绝分支', async () => {
      const pendingPlay = createPendingPlay();
      const videoComponent = createVideoComponent(pendingPlay.promise);

      pauseVideoComponent(videoComponent);
      pendingPlay.reject(new DOMException('play interrupted', 'AbortError'));
      await pendingPlay.promise.then(() => { throw new Error('Expected promise to reject'); }, error => expect((error?.['name'] === 'AbortError')).to.equal(true));

      expect(videoComponent.pauseVideo).to.have.been.called.once;
    });

    it('再次播放会撤销尚未落地的暂停请求', async () => {
      const pendingPlay = createPendingPlay();
      const videoComponent = createVideoComponent(pendingPlay.promise);

      pauseVideoComponent(videoComponent);
      playVideoComponent(videoComponent);
      pendingPlay.resolve();
      await pendingPlay.promise;

      expect(videoComponent.playVideo).to.have.been.called.once;
      expect(videoComponent.pauseVideo).not.to.have.been.called();
    });

    it('没有在途 play 时同步暂停', () => {
      const videoComponent = createVideoComponent();

      pauseVideoComponent(videoComponent);

      expect(videoComponent.pauseVideo).to.have.been.called.once;
    });
  });
});
