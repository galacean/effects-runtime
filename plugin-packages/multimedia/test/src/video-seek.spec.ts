import type { Texture } from '@galacean/effects';
import { spec } from '@galacean/effects';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';

const { expect } = chai;

interface SeekController {
  video: HTMLVideoElement,
  renderer: { texture: Texture },
  engine: { speed: number, transparentTexture: Texture, renderErrors: Set<unknown>, on: (event: string, listener: () => void) => () => void },
  item: {
    time: number,
    duration: number,
    endBehavior: spec.EndBehavior,
    parent: object,
    definition: { delay: number },
    composition: { time: number, speed: number, startTime: number, sceneRoot: { duration: number, endBehavior: spec.EndBehavior } },
  },
  seekVersion: number,
  videoSeeking: boolean,
  manualPause: boolean,
  isGotoAndStopSeeking: boolean,
  isVideoActive: boolean,
  videoDestroyed: boolean,
  replayFramePrepared: boolean,
  preparingReplayFrame: boolean,
  nativeCompositionLoop: boolean,
  manualLoop: boolean,
  lastVideoTime: number,
  pendingSeekTime: number | null,
  safePlay: () => void,
  performSeek: (time: number, clearTexture?: boolean, isGotoAndStop?: boolean) => void,
  cancelVideoSeek: () => void,
  ensureLoopFlag: () => void,
  handleCompositionEnd: () => void,
  handleDestroyBehavior: () => void,
  syncVideoToItemTime: () => void,
  prepareReplayFrame: () => boolean,
  canPreserveNativeLoop: () => boolean,
  canReusePreparedFrame: () => boolean,
  setMuted: (muted: boolean) => void,
  setLoop: (loop: boolean) => void,
  resetLoop: () => void,
}

describe('videoComponent:seek-frame', () => {
  function createFixture (startTime = 5, paused = true) {
    const video = document.createElement('video');
    const transparentTexture = {} as Texture;
    const uploadCalls: boolean[] = [];
    const seekBindings: Texture[] = [];
    const updates = new Set<() => void>();
    const frameCallbacks = new Map<number, VideoFrameRequestCallback>();
    let frameId = 0;
    let currentTime = startTime;
    let videoDuration = 5;
    let seeking = false;
    let readyState = 4;
    let upload: () => boolean | Promise<boolean> = () => Promise.resolve(true);
    let play: () => Promise<void> = () => Promise.resolve();
    let resumes = 0;
    let pauses = 0;
    const texture = {
      initialize () {},
      uploadCurrentVideoFrame (force: boolean) {
        uploadCalls.push(force);

        return upload();
      },
    } as unknown as Texture;
    let binding = texture;

    Object.defineProperties(video, {
      duration: { get: () => videoDuration },
      currentTime: {
        get: () => currentTime,
        set: (time: number) => {
          seekBindings.push(binding);
          currentTime = time;
          seeking = true;
          readyState = 1;
        },
      },
      seeking: { get: () => seeking },
      readyState: { get: () => readyState },
      paused: { get: () => paused },
    });
    video.play = () => {
      paused = false;

      return play();
    };
    video.pause = () => {
      paused = true;
      pauses++;
    };
    video.requestVideoFrameCallback = callback => {
      frameCallbacks.set(++frameId, callback);

      return frameId;
    };
    video.cancelVideoFrameCallback = id => { frameCallbacks.delete(id); };

    const component = Object.create(VideoComponent.prototype) as SeekController;
    const root = { duration: 5, endBehavior: spec.EndBehavior.restart };

    Object.assign(component, {
      video,
      renderer: { texture },
      engine: {
        speed: 1, transparentTexture, renderErrors: new Set<unknown>(),
        on: (event: string, listener: () => void) => {
          updates.add(listener);

          return () => { updates.delete(listener); };
        },
      },
      item: {
        time: 0.01,
        duration: 5,
        endBehavior: spec.EndBehavior.destroy,
        parent: root,
        definition: { delay: 0 },
        composition: { time: 0.01, speed: 1, startTime: 0, sceneRoot: root },
      },
      seekVersion: 0,
      videoSeeking: false,
      manualPause: false,
      isVideoActive: true,
      videoDestroyed: false,
      replayFramePrepared: false,
      preparingReplayFrame: false,
      nativeCompositionLoop: false,
      manualLoop: false,
      lastVideoTime: -1,
      pendingSeekTime: null,
      isGotoAndStopSeeking: false,
      safePlay: () => { resumes++; },
    });
    Object.defineProperty(component, 'material', {
      value: { setTexture: (name: string, value: Texture) => { binding = value; } },
    });

    return {
      component, video, texture, transparentTexture, uploadCalls, seekBindings,
      get binding () { return binding; },
      get resumes () { return resumes; },
      get pauses () { return pauses; },
      setDuration (duration: number) { videoDuration = duration; },
      setMediaTime (time: number) { currentTime = time; },
      setUpload (value: typeof upload) { upload = value; },
      setPlay (value: typeof play) { play = value; },
      update () { updates.forEach(listener => listener()); },
      frame (mediaTime: number) {
        currentTime = mediaTime;
        const callbacks = Array.from(frameCallbacks.values());

        frameCallbacks.clear();
        callbacks.forEach(callback => callback(0, { mediaTime } as VideoFrameCallbackMetadata));
      },
      seeked () {
        seeking = false;
        readyState = 4;
        video.dispatchEvent(new Event('seeked'));
      },
    };
  }

  async function flushPromises () {
    await Promise.resolve();
    await Promise.resolve();
  }

  it('hides the previous GPU texture before starting an ordinary replay seek', async () => {
    const fixture = createFixture();

    fixture.component.performSeek(0);
    expect(fixture.seekBindings).to.deep.equal([fixture.transparentTexture]);
    expect(fixture.binding).to.equal(fixture.transparentTexture);
    expect(fixture.component.videoSeeking).to.equal(true);
    expect(fixture.uploadCalls).to.have.length(0);
    fixture.seeked();
    await flushPromises();
    expect(fixture.uploadCalls).to.deep.equal([true]);
    expect(fixture.binding).to.equal(fixture.texture);
    expect(fixture.component.videoSeeking).to.equal(false);
  });

  it('keeps the old texture hidden until the target frame upload succeeds', async () => {
    const fixture = createFixture();
    let finishUpload!: (uploaded: boolean) => void;

    fixture.setUpload(() => new Promise(resolve => { finishUpload = resolve; }));
    fixture.component.performSeek(0);
    fixture.seeked();
    expect(fixture.binding).to.equal(fixture.transparentTexture);
    expect(fixture.component.videoSeeking).to.equal(true);
    finishUpload(true);
    await flushPromises();
    expect(fixture.binding).to.equal(fixture.texture);
  });

  it('does not restore a stale upload after another seek has started', async () => {
    const fixture = createFixture();
    let finishOldUpload!: (uploaded: boolean) => void;

    fixture.setUpload(() => new Promise(resolve => { finishOldUpload = resolve; }));
    fixture.component.performSeek(0);
    fixture.seeked();
    fixture.component.performSeek(2);
    finishOldUpload(true);
    await flushPromises();
    expect(fixture.binding).to.equal(fixture.transparentTexture);
    expect(fixture.component.videoSeeking).to.equal(true);
    fixture.setUpload(() => Promise.resolve(true));
    fixture.seeked();
    await flushPromises();
    expect(fixture.binding).to.equal(fixture.texture);
  });

  it('removes stale seek listeners when another seek replaces the request', async () => {
    const fixture = createFixture();

    fixture.component.performSeek(0);
    fixture.component.performSeek(2);
    fixture.seeked();
    await flushPromises();
    expect(fixture.uploadCalls).to.deep.equal([true]);
    expect(fixture.binding).to.equal(fixture.texture);
  });

  it('leaves an unchanged, ready frame visible without starting a redundant seek', () => {
    const fixture = createFixture(0);

    fixture.component.performSeek(0);
    expect(fixture.binding).to.equal(fixture.texture);
    expect(fixture.seekBindings).to.have.length(0);
  });

  it('does not treat an in-flight seek to the same time as already complete', () => {
    const fixture = createFixture();

    fixture.component.performSeek(0);
    fixture.component.performSeek(0);
    expect(fixture.binding).to.equal(fixture.transparentTexture);
    expect(fixture.component.videoSeeking).to.equal(true);
  });

  it('masks gotoAndStop before play resolves, then pauses after the target upload', async () => {
    const fixture = createFixture();
    let finishPlay!: () => void;

    fixture.setPlay(() => new Promise(resolve => { finishPlay = resolve; }));
    fixture.component.performSeek(0, false, true);
    expect(fixture.binding).to.equal(fixture.transparentTexture);
    expect(fixture.seekBindings).to.have.length(0);
    finishPlay();
    await flushPromises();
    fixture.seeked();
    await flushPromises();
    expect(fixture.binding).to.equal(fixture.texture);
    expect(fixture.video.paused).to.equal(true);
    expect(fixture.component.isGotoAndStopSeeking).to.equal(false);
  });

  it('ignores a pending play or seek callback after cancellation', async () => {
    const fixture = createFixture();
    let finishPlay!: () => void;

    fixture.setPlay(() => new Promise(resolve => { finishPlay = resolve; }));
    fixture.component.performSeek(0, false, true);
    fixture.component.cancelVideoSeek();
    finishPlay();
    await flushPromises();
    fixture.seeked();
    await flushPromises();
    expect(fixture.seekBindings).to.have.length(0);
    expect(fixture.uploadCalls).to.have.length(0);
  });

  it('does not reveal the old GPU frame when an upload fails', async () => {
    const fixture = createFixture();
    const error = new Error('upload failed');

    fixture.setUpload(() => Promise.reject(error));
    fixture.component.performSeek(0);
    fixture.seeked();
    await flushPromises();
    expect(fixture.binding).to.equal(fixture.transparentTexture);
    expect(fixture.component.engine.renderErrors.has(error)).to.equal(true);
  });

  it('ignores an upload rejection from a cancelled seek', async () => {
    const fixture = createFixture();
    let rejectUpload!: (error: Error) => void;
    const error = new Error('old upload failed');

    fixture.setUpload(() => new Promise((resolve, reject) => { rejectUpload = reject; }));
    fixture.component.performSeek(0);
    fixture.seeked();
    fixture.component.cancelVideoSeek();
    rejectUpload(error);
    await flushPromises();
    expect(fixture.component.engine.renderErrors.size).to.equal(0);
    expect(fixture.binding).to.equal(fixture.transparentTexture);
  });

  it('keeps the old frame hidden and reports initialization errors', async () => {
    const fixture = createFixture();
    const error = new Error('initialization failed');

    fixture.texture.initialize = () => { throw error; };
    fixture.component.performSeek(0);
    fixture.seeked();
    await flushPromises();
    expect(fixture.binding).to.equal(fixture.transparentTexture);
    expect(fixture.uploadCalls).to.have.length(0);
    expect(fixture.component.engine.renderErrors.has(error)).to.equal(true);
  });

  describe('replay optimization', () => {
    it('uses native loop across matching composition periods without seeking or clearing the texture', () => {
      const fixture = createFixture(4.99, false);

      fixture.component.ensureLoopFlag();
      expect(fixture.video.loop).to.equal(true);
      expect(fixture.component.nativeCompositionLoop).to.equal(true);
      fixture.component.handleDestroyBehavior();
      fixture.component.syncVideoToItemTime();
      fixture.component.handleCompositionEnd();
      expect(fixture.component.pendingSeekTime).to.equal(null);
      expect(fixture.seekBindings).to.have.length(0);
      expect(fixture.binding).to.equal(fixture.texture);
    });

    it('accepts a video that has already naturally wrapped to its first frame', () => {
      const fixture = createFixture(0.02, false);

      fixture.component.ensureLoopFlag();
      fixture.component.handleCompositionEnd();
      expect(fixture.component.pendingSeekTime).to.equal(null);
      expect(fixture.video.loop).to.equal(true);
    });

    it('allows 0.1 seconds of duration tolerance but rejects a larger mismatch', () => {
      const fixture = createFixture(5.06, false);

      fixture.setDuration(5.09);
      fixture.component.ensureLoopFlag();
      expect(fixture.component.nativeCompositionLoop).to.equal(true);
      fixture.component.handleCompositionEnd();
      expect(fixture.component.pendingSeekTime).to.equal(null);
      fixture.setDuration(5.11);
      fixture.component.ensureLoopFlag();
      expect(fixture.component.nativeCompositionLoop).to.equal(false);
      expect(fixture.video.loop).to.equal(false);
    });

    it('accounts for video, engine and composition playback rates', () => {
      const fixture = createFixture(9.99, false);

      fixture.setDuration(10);
      fixture.component.engine.speed = 2;
      fixture.component.item.composition.speed = 1.5;
      fixture.video.playbackRate = 6;
      fixture.component.ensureLoopFlag();
      expect(fixture.component.nativeCompositionLoop).to.equal(true);
      fixture.component.handleCompositionEnd();
      expect(fixture.component.pendingSeekTime).to.equal(null);
    });

    it('does not add a seek for phase differences after native looping was selected', () => {
      const fixture = createFixture(2, false);

      fixture.component.ensureLoopFlag();
      expect(fixture.component.canPreserveNativeLoop()).to.equal(true);
      fixture.component.handleCompositionEnd();
      expect(fixture.component.pendingSeekTime).to.equal(null);
      expect(fixture.binding).to.equal(fixture.texture);
    });

    it('respects an explicitly disabled loop and restores automatic loop on reset', () => {
      const fixture = createFixture(4.99, false);

      fixture.component.setLoop(false);
      expect(fixture.component.nativeCompositionLoop).to.equal(false);
      expect(fixture.video.loop).to.equal(false);
      fixture.component.resetLoop();
      expect(fixture.component.nativeCompositionLoop).to.equal(true);
      expect(fixture.video.loop).to.equal(true);
    });

    it('does not enable continuous native playback across an inactive delay or a shorter clip', () => {
      const fixture = createFixture();

      fixture.component.item.definition.delay = 1;
      fixture.component.ensureLoopFlag();
      expect(fixture.component.nativeCompositionLoop).to.equal(false);
      fixture.component.item.definition.delay = 0;
      fixture.component.item.duration = 4;
      fixture.component.ensureLoopFlag();
      expect(fixture.component.nativeCompositionLoop).to.equal(false);
    });

    it('waits for finite media metadata before enabling native composition looping', () => {
      const fixture = createFixture();

      for (const duration of [NaN, Infinity, 0]) {
        fixture.setDuration(duration);
        fixture.component.ensureLoopFlag();
        expect(fixture.component.nativeCompositionLoop).to.equal(false);
      }
    });

    it('waits for natural loop during the gap and reuses the frame without writing currentTime', async () => {
      const fixture = createFixture(4.99, false);
      const composition = fixture.component.item.composition;

      composition.sceneRoot.duration = 6.5;
      composition.time = 5.06;
      fixture.component.item.duration = 5.05;
      fixture.component.isVideoActive = false;
      fixture.component.ensureLoopFlag();
      fixture.component.prepareReplayFrame();
      expect(fixture.video.loop).to.equal(true);
      expect(fixture.video.paused).to.equal(false);
      fixture.frame(0);
      await flushPromises();
      expect(fixture.component.replayFramePrepared).to.equal(true);
      expect(fixture.video.paused).to.equal(true);
      expect(fixture.seekBindings).to.have.length(0);
      fixture.component.prepareReplayFrame();
      expect(fixture.seekBindings).to.have.length(0);

      composition.time = 0.01;
      fixture.component.item.time = 0.01;
      fixture.component.isVideoActive = true;
      fixture.component.syncVideoToItemTime();
      fixture.component.handleCompositionEnd();
      expect(fixture.component.pendingSeekTime).to.equal(null);
      expect(fixture.seekBindings).to.have.length(0);
      expect(fixture.binding).to.equal(fixture.texture);
    });

    it('does not resume an ended destroy video after preparing its first frame', async () => {
      const fixture = createFixture(4.999, false);

      fixture.component.item.composition.sceneRoot.duration = 6.5;
      fixture.component.ensureLoopFlag();
      fixture.component.handleDestroyBehavior();
      fixture.frame(0);
      await flushPromises();
      expect(fixture.component.replayFramePrepared).to.equal(true);
      expect(fixture.video.paused).to.equal(true);
      expect(fixture.resumes).to.equal(0);
    });

    it('does not treat the 0.1 second end tolerance as a first-frame window', async () => {
      const fixture = createFixture(4.99, false);

      fixture.component.item.composition.sceneRoot.duration = 6.5;
      fixture.component.ensureLoopFlag();
      fixture.component.prepareReplayFrame();
      fixture.frame(0.09);
      await flushPromises();
      expect(fixture.component.replayFramePrepared).to.equal(false);
      expect(fixture.video.paused).to.equal(false);
      fixture.frame(0);
      await flushPromises();
      expect(fixture.component.replayFramePrepared).to.equal(true);
      expect(fixture.seekBindings).to.have.length(0);
    });

    it('allows up to 0.1 seconds of video overrun while waiting for a native loop', () => {
      const fixture = createFixture(5, false);

      fixture.component.item.definition.delay = 1;
      fixture.component.item.duration = 5;
      fixture.component.item.composition.sceneRoot.duration = 5.9;
      fixture.component.ensureLoopFlag();
      expect(fixture.component.prepareReplayFrame()).to.equal(true);
      expect(fixture.seekBindings).to.have.length(0);
      fixture.component.cancelVideoSeek();
      fixture.component.videoSeeking = false;
      fixture.component.item.composition.sceneRoot.duration = 5.89;
      expect(fixture.component.prepareReplayFrame()).to.equal(false);
    });

    it('uses timeupdate and engine updates to detect the native loop without rVFC', async () => {
      const fixture = createFixture(4.99, false);

      fixture.component.item.composition.sceneRoot.duration = 6.5;
      Object.defineProperty(fixture.video, 'requestVideoFrameCallback', { value: undefined });
      fixture.component.prepareReplayFrame();
      fixture.setMediaTime(0);
      fixture.video.dispatchEvent(new Event('timeupdate'));
      fixture.update();
      await flushPromises();
      expect(fixture.video.paused).to.equal(true);
      expect(fixture.component.replayFramePrepared).to.equal(true);
      expect(fixture.seekBindings).to.have.length(0);
    });

    it('preserves an explicit pending seek instead of reusing a prepared frame', () => {
      const fixture = createFixture(0);

      fixture.component.replayFramePrepared = true;
      fixture.component.pendingSeekTime = 2;
      expect(fixture.component.canReusePreparedFrame()).to.equal(false);
    });

    it('keeps an independently looping shorter video running across composition restarts', () => {
      const fixture = createFixture(1, false);

      fixture.setDuration(2);
      fixture.component.item.endBehavior = spec.EndBehavior.restart;
      fixture.component.ensureLoopFlag();
      fixture.component.handleCompositionEnd();
      expect(fixture.video.loop).to.equal(true);
      expect(fixture.component.pendingSeekTime).to.equal(null);
    });

    it('waits for a slightly late video tail instead of seeking when the delayed item reactivates', async () => {
      const fixture = createFixture(4.96, false);

      fixture.component.item.definition.delay = 1;
      fixture.component.item.composition.sceneRoot.duration = 5.92;
      fixture.component.lastVideoTime = 4.9;
      fixture.component.ensureLoopFlag();
      fixture.component.syncVideoToItemTime();
      fixture.component.handleCompositionEnd();
      expect(fixture.component.preparingReplayFrame).to.equal(true);
      expect(fixture.component.pendingSeekTime).to.equal(null);
      expect(fixture.seekBindings).to.have.length(0);
      fixture.frame(0);
      await flushPromises();
      expect(fixture.component.replayFramePrepared).to.equal(true);
      expect(fixture.video.paused).to.equal(true);
    });

    it('keeps hidden preparation muted and restores the requested mute setting', async () => {
      const fixture = createFixture(4.99, false);

      fixture.component.item.composition.sceneRoot.duration = 6.5;
      fixture.video.muted = false;
      fixture.component.prepareReplayFrame();
      expect(fixture.video.muted).to.equal(true);
      fixture.component.setMuted(true);
      fixture.component.setMuted(false);
      expect(fixture.video.muted).to.equal(true);
      fixture.frame(0);
      await flushPromises();
      expect(fixture.video.muted).to.equal(false);
      expect(fixture.video.paused).to.equal(true);
    });

    it('cancels native preparation when looping is explicitly disabled', async () => {
      const fixture = createFixture(4.99, false);

      fixture.component.item.composition.sceneRoot.duration = 6.5;
      fixture.component.prepareReplayFrame();
      fixture.component.setLoop(false);
      fixture.frame(0);
      fixture.video.dispatchEvent(new Event('timeupdate'));
      fixture.update();
      await flushPromises();
      expect(fixture.component.preparingReplayFrame).to.equal(false);
      expect(fixture.component.replayFramePrepared).to.equal(false);
      expect(fixture.uploadCalls).to.have.length(0);
      expect(fixture.seekBindings).to.have.length(0);
      expect(fixture.video.loop).to.equal(false);
    });
  });
});
