import { Engine, Texture, TextureSourceType } from '@galacean/effects';
import type { GPUTextureWebGL, RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/video-texture', () => {
  let engine: Engine;
  let textures: Texture[];

  before(() => {
    engine = new Engine(document.createElement('canvas'), { glType: 'webgl' });
  });

  after(() => engine.dispose());

  beforeEach(() => {
    textures = [];
  });

  afterEach(() => {
    textures.forEach(texture => texture.dispose());
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
        callbacks.forEach(callback => callback(0, {} as VideoFrameCallbackMetadata));
      },
    };
  }

  function createTexture (video: HTMLVideoElement) {
    const texture = new Texture(engine, { sourceType: TextureSourceType.video, video });
    const gpu = texture.getGPUTexture();
    const update = gpu.update.bind(gpu);
    let uploads = 0;

    gpu.update = (source, options) => {
      update(source, options);
      uploads++;
    };
    textures.push(texture);
    texture.initialize();

    return { texture, get uploads () { return uploads; } };
  }

  it('coalesces new frames independently for textures sharing a video', () => {
    const media = createVideo();
    const entry = createTexture(media.video);
    const shared = createTexture(media.video);

    expect(entry.uploads).to.equal(1);
    expect(entry.texture.uploadCurrentVideoFrame()).to.equal(false);
    media.frame();
    media.frame();
    expect(entry.uploads).to.equal(1);
    expect(media.pending.size).to.equal(2);
    expect(entry.texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(entry.texture.uploadCurrentVideoFrame()).to.equal(false);
    expect(shared.texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(shared.texture.uploadCurrentVideoFrame()).to.equal(false);
    expect(entry.uploads).to.equal(2);
  });

  it('does not upload before a frame is ready or during a seek, even when forced', () => {
    const { video } = createVideo();
    const { texture } = createTexture(video);

    Object.defineProperty(video, 'readyState', { value: 1 });
    expect(texture.uploadCurrentVideoFrame(true)).to.equal(false);
    Object.defineProperty(video, 'readyState', { value: 2 });
    Object.defineProperty(video, 'seeking', { value: true });
    expect(texture.uploadCurrentVideoFrame(true)).to.equal(false);
  });

  it('refreshes seeked and reloaded frames immediately without waiting for rVFC', () => {
    const { video } = createVideo();
    const entry = createTexture(video);

    video.currentTime = 5;
    video.dispatchEvent(new Event('seeked'));
    expect(entry.texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(entry.texture.uploadCurrentVideoFrame()).to.equal(false);
    video.dispatchEvent(new Event('loadeddata'));
    expect(entry.texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(entry.texture.uploadCurrentVideoFrame(true)).to.equal(true);
    expect(entry.uploads).to.equal(4);
  });

  it('uploads resized video frames without waiting for rVFC', () => {
    const { video } = createVideo();
    const { texture } = createTexture(video);

    (video as unknown as HTMLCanvasElement).width = 8;
    Object.defineProperty(video, 'videoWidth', { value: 8 });
    expect(texture.uploadCurrentVideoFrame()).to.equal(true);
    expect(texture.width).to.equal(8);
  });

  it('uploads on every update when frame callbacks are missing or fail', () => {
    for (const failure of ['missing', 'initial', 'later']) {
      const media = createVideo(failure !== 'missing');
      const { video } = media;
      const fail = () => { throw new Error('rVFC unavailable'); };

      if (failure === 'initial') {
        video.requestVideoFrameCallback = fail;
      }
      const entry = createTexture(video);

      if (failure === 'later') {
        video.requestVideoFrameCallback = fail;
        media.frame();
      }
      for (const time of [0, 0, 1 / 120, 2 / 120]) {
        video.currentTime = time;
        expect(entry.texture.uploadCurrentVideoFrame()).to.equal(true);
      }
      expect(entry.uploads).to.equal(5);
    }
  });

  it('cancels old callbacks on source replacement and ignores callbacks that arrive late', () => {
    const oldMedia = createVideo();
    const newMedia = createVideo();
    const { texture } = createTexture(oldMedia.video);
    const oldCallback = Array.from(oldMedia.pending.values())[0];

    texture.updateSource({ sourceType: TextureSourceType.video, video: newMedia.video });
    expect(oldMedia.cancelled).to.have.length(1);
    expect(oldMedia.pending.size).to.equal(0);
    oldCallback(0, {} as VideoFrameCallbackMetadata);
    expect(oldMedia.pending.size).to.equal(0);
    expect(texture.uploadCurrentVideoFrame()).to.equal(false);
    newMedia.frame();
    expect(texture.uploadCurrentVideoFrame()).to.equal(true);
  });

  it('stops callbacks and removes seek listeners when disposed, even without cancel support', () => {
    const media = createVideo(true, false);
    const { texture } = createTexture(media.video);

    texture.dispose();
    media.frame();
    media.video.dispatchEvent(new Event('seeked'));
    expect(media.pending.size).to.equal(0);
    expect(texture.uploadCurrentVideoFrame(true)).to.equal(false);
  });

  it('restores the current frame even when no new callback has arrived', () => {
    const { video } = createVideo();
    const entry = createTexture(video);

    // 无需触发整套 context lost 流程，释放旧句柄后验证纹理恢复会强制重传。
    const device = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
    const gpu = entry.texture.getGPUTexture() as GPUTextureWebGL;

    device.gl.deleteTexture(gpu.textureBuffer);
    entry.texture.restore();
    expect(entry.uploads).to.equal(2);
    expect(entry.texture.uploadCurrentVideoFrame()).to.equal(false);
  });

  it('keeps a pending frame available after an upload fails', () => {
    const media = createVideo();
    const { texture } = createTexture(media.video);
    const update = texture.update;
    const failure = new Error('upload failed');

    media.frame();
    texture.update = () => { throw failure; };
    expect(() => texture.uploadCurrentVideoFrame()).to.throw(failure);
    texture.update = update;
    expect(texture.uploadCurrentVideoFrame()).to.equal(true);
  });
});
