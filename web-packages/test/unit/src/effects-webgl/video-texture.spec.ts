import { TextureSourceType } from '@galacean/effects-core';
import { GLEngine, GLTexture } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/video-texture', () => {
  let engine: GLEngine;
  let time: number;
  let originalNow: typeof performance.now;
  let textures: GLTexture[];

  before(() => {
    engine = new GLEngine(document.createElement('canvas'), { glType: 'webgl' });
  });

  after(() => engine.dispose());

  beforeEach(() => {
    time = 0;
    textures = [];
    originalNow = performance.now;
    performance.now = () => time;
  });

  afterEach(() => {
    textures.forEach(texture => texture.dispose());
    performance.now = originalNow;
  });

  function createVideo (callbacks = true, cancel = true) {
    // Canvas 提供真实可上传的像素；补齐媒体属性，确定性地模拟视频换帧。
    const canvas = document.createElement('canvas');
    const pending = new Map<number, VideoFrameRequestCallback>();
    const cancelled: number[] = [];
    let id = 0;

    canvas.width = canvas.height = 4;
    Object.defineProperties(canvas, {
      videoWidth: { value: 4, writable: true },
      videoHeight: { value: 4, writable: true },
      readyState: { value: 2, writable: true },
      seeking: { value: false, writable: true },
      currentTime: { value: 0, writable: true },
    });
    const video = canvas as unknown as HTMLVideoElement;

    if (callbacks) {
      video.requestVideoFrameCallback = callback => {
        pending.set(++id, callback);

        return id;
      };
    }
    if (cancel) {
      video.cancelVideoFrameCallback = callbackId => {
        cancelled.push(callbackId);
        pending.delete(callbackId);
      };
    }

    return {
      video, pending, cancelled,
      frame () {
        const callbacks = Array.from(pending.values());

        pending.clear();
        callbacks.forEach(callback => callback(time, {} as VideoFrameCallbackMetadata));
      },
    };
  }

  function createTexture (video: HTMLVideoElement) {
    const texture = new GLTexture(engine, { sourceType: TextureSourceType.video, video });
    const update = texture.update.bind(texture);
    let uploads = 0;

    texture.update = options => {
      update(options);
      uploads++;
    };
    textures.push(texture);
    texture.initialize();

    return { texture, get uploads () { return uploads; } };
  }

  it('uploads only after a new video frame and coalesces multiple pending frames', async () => {
    const media = createVideo();
    const entry = createTexture(media.video);

    expect(entry.uploads).to.equal(1);
    expect(await entry.texture.uploadCurrentVideoFrame()).to.equal(false);
    media.frame();
    media.frame();
    expect(entry.uploads).to.equal(1);
    expect(media.pending.size).to.equal(1);
    expect(await entry.texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(await entry.texture.uploadCurrentVideoFrame()).to.equal(false);
    expect(entry.uploads).to.equal(2);
  });

  it('does not upload before a frame is ready or during a seek, even when forced', async () => {
    const { video } = createVideo();
    const { texture } = createTexture(video);

    Object.defineProperty(video, 'readyState', { value: 1 });
    expect(await texture.uploadCurrentVideoFrame(true)).to.equal(false);
    Object.defineProperty(video, 'readyState', { value: 2 });
    Object.defineProperty(video, 'seeking', { value: true });
    expect(await texture.uploadCurrentVideoFrame(true)).to.equal(false);
  });

  it('refreshes seeked and reloaded frames immediately without waiting for rVFC', async () => {
    const { video } = createVideo();
    const entry = createTexture(video);

    video.currentTime = 5;
    video.dispatchEvent(new Event('seeked'));
    expect(await entry.texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(await entry.texture.uploadCurrentVideoFrame()).to.equal(false);
    video.dispatchEvent(new Event('loadeddata'));
    expect(await entry.texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(await entry.texture.uploadCurrentVideoFrame(true)).to.equal(true);
    expect(entry.uploads).to.equal(4);
  });

  it('uploads resized video frames without waiting for rVFC', async () => {
    const { video } = createVideo();
    const { texture } = createTexture(video);

    (video as unknown as HTMLCanvasElement).width = 8;
    Object.defineProperty(video, 'videoWidth', { value: 8 });
    expect(await texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(texture.width).to.equal(8);
  });

  it('falls back to 30 uploads per second and skips unchanged video time', async () => {
    const { video } = createVideo(false);
    const entry = createTexture(video);

    for (let tick = 1; tick < 60; tick++) {
      time = tick * 1000 / 60;
      video.currentTime = time / 1000;
      await entry.texture.uploadCurrentVideoFrame();
    }
    expect(entry.uploads).to.be.within(29, 31);
    time = 2000;
    expect(await entry.texture.uploadCurrentVideoFrame()).to.equal(false);
    video.currentTime = 5;
    video.dispatchEvent(new Event('seeked'));
    expect(await entry.texture.uploadCurrentVideoFrame()).to.equal(true);
  });

  it('falls back when registering the native frame callback throws', async () => {
    const { video } = createVideo();

    video.requestVideoFrameCallback = () => { throw new Error('rVFC unavailable'); };
    const { texture } = createTexture(video);

    time = 40;
    video.currentTime = 0.04;
    expect(await texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(await texture.uploadCurrentVideoFrame()).to.equal(false);
  });

  it('keeps independent frame state for two textures sharing the same video', async () => {
    const media = createVideo();
    const first = createTexture(media.video);
    const second = createTexture(media.video);

    media.frame();
    expect(await first.texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(await first.texture.uploadCurrentVideoFrame()).to.equal(false);
    expect(await second.texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(media.pending.size).to.equal(2);
  });

  it('cancels old callbacks on source replacement and ignores callbacks that arrive late', async () => {
    const oldMedia = createVideo();
    const newMedia = createVideo();
    const { texture } = createTexture(oldMedia.video);
    const oldCallback = Array.from(oldMedia.pending.values())[0];

    texture.updateSource({ sourceType: TextureSourceType.video, video: newMedia.video });
    expect(oldMedia.cancelled).to.have.length(1);
    expect(oldMedia.pending.size).to.equal(0);
    oldCallback(time, {} as VideoFrameCallbackMetadata);
    expect(oldMedia.pending.size).to.equal(0);
    expect(await texture.uploadCurrentVideoFrame()).to.equal(false);
    newMedia.frame();
    expect(await texture.uploadCurrentVideoFrame()).to.equal(true);
  });

  it('stops callbacks and removes seek listeners when disposed, even without cancel support', async () => {
    const media = createVideo(true, false);
    const { texture } = createTexture(media.video);

    texture.dispose();
    media.frame();
    media.video.dispatchEvent(new Event('seeked'));
    expect(media.pending.size).to.equal(0);
    expect(await texture.uploadCurrentVideoFrame(true)).to.equal(false);
  });

  it('restores the current frame even when no new callback has arrived', async () => {
    const { video } = createVideo();
    const entry = createTexture(video);

    // 无需触发整套 context lost 流程，释放旧句柄后验证纹理恢复会强制重传。
    engine.gl.deleteTexture(entry.texture.textureBuffer);
    entry.texture.restore();
    expect(entry.uploads).to.equal(2);
    expect(await entry.texture.uploadCurrentVideoFrame()).to.equal(false);
  });

  it('keeps a pending frame available after an upload fails', async () => {
    const media = createVideo();
    const { texture } = createTexture(media.video);
    const update = texture.update;
    const failure = new Error('upload failed');

    media.frame();
    texture.update = () => { throw failure; };
    const result = await texture.uploadCurrentVideoFrame().catch(error => error);

    expect(result).to.equal(failure);
    texture.update = update;
    expect(await texture.uploadCurrentVideoFrame()).to.equal(true);
  });
});
