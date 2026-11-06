import { loadVideo } from '@galacean/effects';

const { expect } = chai;

describe('core/video-loading', () => {
  let video: HTMLVideoElement;

  beforeEach(() => {
    video = document.createElement('video');
    Object.defineProperty(video, 'src', { value: '', writable: true });
    video.load = chai.spy();
    video.play = chai.spy(() => Promise.resolve());
    const createElement = document.createElement.bind(document);

    chai.spy.on(document, 'createElement', (tag: string, options?: ElementCreationOptions) =>
      tag === 'video' ? video : createElement(tag, options));
  });

  afterEach(() => chai.spy.restore(document));

  it('waits for canplay without starting a preloaded video', async () => {
    let ready = false;
    const pending = loadVideo('video.mp4', false).then(result => {
      ready = true;

      return result;
    });

    expect(video.preload).to.equal('auto');
    expect(video.load).to.have.been.called.once;
    video.dispatchEvent(new Event('loadeddata'));
    await Promise.resolve();
    expect(ready).to.be.false;
    expect(video.play).not.to.have.been.called();
    video.dispatchEvent(new Event('canplay'));
    expect(await pending).to.equal(video);
    expect(video.paused).to.be.true;
    expect(video.currentTime).to.equal(0);
  });

  it('keeps the default playback behavior for existing video texture callers', async () => {
    const pending = loadVideo('video.mp4');

    expect(video.play).to.have.been.called.once;
    video.dispatchEvent(new Event('loadeddata'));
    expect(await pending).to.equal(video);
  });

  it('rejects a preload failure instead of waiting indefinitely for canplay', async () => {
    const result = loadVideo('broken.mp4', false).catch(error => error);

    video.dispatchEvent(new Event('error'));
    expect(await result).to.equal('Load video fail.');
  });
});
