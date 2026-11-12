import type { Texture } from '@galacean/effects';
import { spec } from '@galacean/effects';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';

const { expect } = chai;

interface SeekController {
  video: HTMLVideoElement,
  renderer: { texture: Texture },
  engine: { speed: number, assetServer: { transparentTexture: Texture }, renderErrors: Set<unknown>, on: (event: string, listener: () => void) => () => void },
  item: {
    time: number,
    duration: number,
    endBehavior: spec.EndBehavior,
    parent: object,
    definition: { delay: number },
    composition: { time: number, speed: number, startTime: number, getPaused: () => boolean, sceneRoot: { duration: number, endBehavior: spec.EndBehavior } },
  },
  seekVersion: number,
  videoSeeking: boolean,
  manualPause: boolean,
  isGotoAndStopSeeking: boolean,
  isVideoActive: boolean,
  videoDestroyed: boolean,
  replayFramePrepared: boolean,
  firstFrameTexture?: Texture,
  preparingReplayFrame: boolean,
  nativeCompositionLoop: boolean,
  manualLoop: boolean,
  lastVideoTime: number,
  pendingSeekTime: number | null,
  safePlay: () => void,
  performSeek: (time: number, clearTexture?: boolean, isGotoAndStop?: boolean) => void,
  cancelVideoSeek: () => void,
  ensureLoopFlag: () => void,
  handleGoto: () => void,
  processPendingSeek: () => boolean,
  handleCompositionEnd: () => void,
  handleCompositionPlay: () => void,
  handleCompositionPause: () => void,
  handleDestroyBehavior: () => void,
  detectCompositionRestart: () => void,
  shouldStartVideo: () => boolean,
  startVideo: () => void,
  syncVideoToItemTime: () => void,
  prepareReplayFrame: () => boolean,
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
    let play: () => Promise<void> = () => Promise.resolve();
    let resumes = 0;
    let pauses = 0;
    const texture = {
      initialize () {},
      uploadCurrentVideoFrame (force: boolean) {
        uploadCalls.push(force);

        return true;
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
        speed: 1, assetServer: { transparentTexture }, renderErrors: new Set<unknown>(),
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
        composition: { time: 0.01, speed: 1, startTime: 0, getPaused: () => false, sceneRoot: root },
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
    expect(fixture.binding).to.equal(fixture.transparentTexture);
    await flushPromises();
    expect(fixture.uploadCalls).to.deep.equal([true]);
    expect(fixture.binding).to.equal(fixture.texture);
    expect(fixture.component.videoSeeking).to.equal(false);
  });

  it('does not restore a stale upload after another seek has started', async () => {
    const fixture = createFixture();

    fixture.component.performSeek(0);
    fixture.seeked();
    fixture.component.performSeek(2);
    await flushPromises();
    expect(fixture.binding).to.equal(fixture.transparentTexture);
    expect(fixture.component.videoSeeking).to.equal(true);
    fixture.seeked();
    await flushPromises();
    expect(fixture.binding).to.equal(fixture.texture);
  });

  it('keeps only the newest seek active, including repeated targets', async () => {
    const fixture = createFixture();

    fixture.component.performSeek(0);
    fixture.component.performSeek(0);
    expect(fixture.component.videoSeeking).to.equal(true);
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

  it('holds the current frame while seeking to a nonzero time', async () => {
    for (const [start, target] of [[0.5, 2], [2, 1]]) {
      const fixture = createFixture(start, false);

      fixture.component.performSeek(target);
      expect(fixture.seekBindings).to.deep.equal([fixture.texture]);
      expect(fixture.binding).to.equal(fixture.texture);
      expect(fixture.uploadCalls).to.have.length(0);
      fixture.seeked();
      await flushPromises();
      expect(fixture.uploadCalls).to.deep.equal([true]);
      expect(fixture.binding).to.equal(fixture.texture);
    }
  });

  it('keeps an explicit backward goto target when reentering an ended video', async () => {
    const fixture = createFixture(2.8, false);
    const { component } = fixture;

    component.item.composition.sceneRoot.endBehavior = spec.EndBehavior.forward;
    component.lastVideoTime = 2.8;
    component.videoDestroyed = true;
    component.item.time = component.item.composition.time = 1;
    component.handleGoto();
    component.processPendingSeek();
    fixture.seeked();
    await flushPromises();
    component.detectCompositionRestart();
    expect(component.videoDestroyed).to.equal(false);
    expect(component.pendingSeekTime).to.equal(null);
    expect(fixture.video.currentTime).to.equal(1);
    expect(fixture.binding).to.equal(fixture.texture);
    expect(fixture.resumes).to.equal(1);
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

  it('keeps the previous frame hidden and reports preparation failures', async () => {
    for (const operation of ['initialize', 'uploadCurrentVideoFrame'] as const) {
      const fixture = createFixture();
      const error = new Error(`${operation} failed`);

      fixture.texture[operation] = () => { throw error; };
      fixture.component.performSeek(0);
      fixture.seeked();
      await flushPromises();
      expect(fixture.binding).to.equal(fixture.transparentTexture);
      expect(fixture.component.engine.renderErrors.has(error)).to.equal(true);
    }
  });

  describe('replay optimization', () => {
    it('reuses a ready native head but resets other playback positions', () => {
      for (const time of [0.005, 4.99, 2]) {
        const fixture = createFixture(time, false);

        fixture.component.ensureLoopFlag();
        expect(fixture.video.loop).to.equal(true);
        fixture.component.handleDestroyBehavior();
        fixture.component.syncVideoToItemTime();
        fixture.component.handleCompositionEnd();
        expect(fixture.component.pendingSeekTime).to.equal(null);
        expect(fixture.seekBindings).to.have.length(time === 0.005 ? 0 : 1);
        expect(fixture.video.currentTime).to.be.at.most(0.005);
        expect(fixture.binding).to.equal(time === 0.005 ? fixture.texture : fixture.transparentTexture);
      }
    });

    it('requires finite, matching durations and an active clip for continuous native looping', () => {
      for (const [duration, clipDuration, delay, expected] of [
        [5.09, 5, 0, true],
        [5.11, 5, 0, false],
        [5, 4, 0, false],
        [5, 5, 1, false],
        [NaN, 5, 0, false],
        [Infinity, 5, 0, false],
        [0, 5, 0, false],
      ] as const) {
        const fixture = createFixture();

        fixture.setDuration(duration);
        fixture.component.item.duration = clipDuration;
        fixture.component.item.definition.delay = delay;
        fixture.component.ensureLoopFlag();
        expect(fixture.video.loop, `duration=${duration}, clip=${clipDuration}, delay=${delay}`).to.equal(expected);
      }
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
      expect(fixture.video.currentTime).to.equal(0);
      expect(fixture.video.playbackRate).to.equal(6);
    });

    it('shows the cached head immediately while a looping video seeks for composition replay', async () => {
      const fixture = createFixture(1.4, false);
      const { component, video } = fixture;
      const firstFrame = {} as Texture;

      component.firstFrameTexture = firstFrame;
      component.item.endBehavior = spec.EndBehavior.restart;
      component.item.composition.sceneRoot.duration = 6.5;
      component.ensureLoopFlag();
      component.handleCompositionEnd();
      expect(video.currentTime).to.equal(0);
      expect(fixture.seekBindings).to.deep.equal([firstFrame]);
      expect(fixture.binding).to.equal(firstFrame);
      fixture.seeked();
      await flushPromises();
      expect(fixture.binding).to.equal(fixture.texture);

      component.performSeek(2);
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
      fixture.frame(0.09);
      await flushPromises();
      expect(fixture.component.replayFramePrepared).to.equal(false);
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

    it('keeps a faster destroy video hidden until the next composition cycle', async () => {
      const fixture = createFixture(4.999, false);
      const { component, video } = fixture;
      const composition = component.item.composition;

      component.firstFrameTexture = {} as Texture;
      video.playbackRate = 2;
      component.item.time = composition.time = 2.5;
      component.detectCompositionRestart();
      component.ensureLoopFlag();
      component.handleDestroyBehavior();
      expect(component.videoDestroyed).to.equal(false);
      fixture.setMediaTime(video.duration);
      component.handleDestroyBehavior();
      fixture.frame(0);
      await flushPromises();
      expect(component.replayFramePrepared).to.equal(true);
      expect(video.paused).to.equal(true);
      expect(fixture.binding).to.equal(fixture.transparentTexture);
      expect(component.shouldStartVideo()).to.equal(false);

      component.item.time = composition.time = 4.9;
      component.detectCompositionRestart();
      component.handleCompositionPlay();
      expect(component.shouldStartVideo()).to.equal(false);
      expect(fixture.resumes).to.equal(0);
      expect(fixture.binding).to.equal(fixture.transparentTexture);

      component.item.time = composition.time = 0.01;
      component.detectCompositionRestart();
      expect(component.shouldStartVideo()).to.equal(true);
      component.startVideo();
      component.handleCompositionEnd();
      expect(fixture.binding).to.equal(fixture.texture);
      expect(fixture.resumes).to.equal(1);
      expect(component.pendingSeekTime).to.equal(null);
      expect(fixture.seekBindings).to.have.length(0);
    });

    it('allows playback when a prepared frame finishes uploading after the composition restarts', async () => {
      const fixture = createFixture(5, false);
      const { component, video } = fixture;
      const composition = component.item.composition;

      video.playbackRate = 2;
      component.item.time = composition.time = 2.5;
      component.detectCompositionRestart();
      component.ensureLoopFlag();
      component.handleDestroyBehavior();
      fixture.frame(0);

      component.item.time = composition.time = 0.01;
      component.detectCompositionRestart();
      component.handleCompositionEnd();
      expect(component.shouldStartVideo()).to.equal(false);
      expect(fixture.binding).to.equal(fixture.transparentTexture);
      component.item.time = composition.time = 0.2;
      await flushPromises();
      expect(component.shouldStartVideo()).to.equal(true);
      component.startVideo();
      expect(fixture.binding).to.equal(fixture.texture);
      expect(fixture.resumes).to.equal(1);
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

    it('returns a shorter looping video to its head when the composition restarts', () => {
      const fixture = createFixture(1, false);

      fixture.setDuration(2);
      fixture.component.item.endBehavior = spec.EndBehavior.restart;
      fixture.component.ensureLoopFlag();
      fixture.component.handleCompositionEnd();
      expect(fixture.video.loop).to.equal(true);
      expect(fixture.component.pendingSeekTime).to.equal(null);
      expect(fixture.video.currentTime).to.equal(0);
      expect(fixture.seekBindings).to.have.length(1);
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

    it('resumes hidden frame preparation after a composition pause without seeking', async () => {
      const fixture = createFixture(4.96, false);
      const { component, video } = fixture;
      let paused = false;

      component.item.composition.sceneRoot.duration = 6.5;
      component.item.composition.getPaused = () => paused;
      component.isVideoActive = false;
      component.videoDestroyed = true;
      component.safePlay = () => { void video.play(); };
      video.muted = false;
      expect(component.prepareReplayFrame()).to.be.true;
      paused = true;
      component.handleCompositionPause();
      expect(video.paused).to.be.true;
      expect(video.muted).to.be.true;

      paused = false;
      component.manualPause = true;
      component.handleCompositionPlay();
      expect(video.paused).to.be.true;
      component.manualPause = false;
      component.handleCompositionPlay();
      expect(video.paused).to.be.false;
      expect(video.muted).to.be.true;
      fixture.frame(0);
      await flushPromises();
      expect(component.preparingReplayFrame).to.be.false;
      expect(component.videoSeeking).to.be.false;
      expect(component.replayFramePrepared).to.be.true;
      expect(video.paused).to.be.true;
      expect(video.muted).to.be.false;
      expect(fixture.seekBindings).to.have.length(0);
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
