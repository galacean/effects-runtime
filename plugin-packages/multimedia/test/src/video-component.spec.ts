import type { Composition } from '@galacean/effects';
import { DataAsset, generateGUID, Player, Texture, TextureSourceType, VFXItem, spec } from '@galacean/effects';
import type { VideoItemProps } from '@galacean/effects-plugin-multimedia';
import { processMultimedia, VideoComponent } from '@galacean/effects-plugin-multimedia';

interface VideoCompositionOptions {
  duration: number,
  endBehavior: spec.EndBehavior,
  id: string,
  videos: spec.AssetBase[],
  start: number,
  options: Omit<VideoItemProps['options'], 'video'> & { video?: spec.DataPath },
  compositionDuration?: number,
  compositionEndBehavior?: spec.EndBehavior,
}

const { expect } = chai;
const player = new Player({
  canvas: document.createElement('canvas'),
});

describe('videoComponent ', function () {
  it('videoComponent:create', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id }, volume: 0.4, muted: true, playbackRate: 2 },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.video!.volume).to.equal(0.4);
    expect(videoComponent.video!.muted).to.be.true;
    expect(videoComponent.video!.preservesPitch).to.be.false;
    expect(videoComponent.video!.playbackRate).to.equal(2);
    expect(videoComponent.video!.loop).to.be.false;
    composition.dispose();
  });

  it('videoComponent:dispose', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 2,
      endBehavior: spec.EndBehavior.destroy,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    player.gotoAndPlay(4);

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.isVideoActive).to.be.false;

    composition.dispose();
  });

  it('videoComponent:getDuration', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    const duration = videoComponent.getDuration();
    //@ts-expect-error
    const videoAsset = videoComponent.engine.effectsObjectServer.objectInstance[options.id].data;

    expect(duration).to.equal(videoAsset.duration);

    composition.dispose();
  });

  it('videoComponent:delayed video starts from local zero', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 4.0417,
      endBehavior: spec.EndBehavior.destroy,
      compositionDuration: 8,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 2.3,
      options: { video: { id }, muted: true },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    if (!video) { throw new Error('video is null'); }
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.isVideoActive).to.be.false;
    expect(videoComponent.video?.paused).to.be.true;
    expect(videoComponent.getCurrentTime()).to.equal(0);

    player.gotoAndPlay(options.start);

    expect(videoComponent.isVideoActive).to.be.true;
    expect(videoComponent.getCurrentTime()).to.be.within(0, 0.1);
    composition.dispose();
  });

  it('videoComponent:setCurrentTime', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    const videoAsset = videoComponent.video!;

    videoComponent.setMuted(false);
    await new Promise<void>(resolve => {
      videoAsset.addEventListener('seeked', () => resolve(), { once: true });
      videoComponent.setCurrentTime(3);
      videoComponent.onUpdate(0);
    });
    expect(videoAsset.currentTime).to.be.closeTo(3, 0.1);
    expect(videoAsset.muted).to.be.false;
    composition.dispose();
  });

  it('videoComponent:setLoop', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    videoComponent.setLoop(true);
    //@ts-expect-error
    const videoAsset = videoComponent.engine.effectsObjectServer.objectInstance[options.id].data;

    expect(videoAsset.loop).to.equal(true);
    composition.dispose();
  });

  it('videoComponent:setMuted', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    videoComponent.setMuted(true);
    //@ts-expect-error
    const videoAsset = videoComponent.engine.effectsObjectServer.objectInstance[options.id].data;

    expect(videoAsset.muted).to.equal(true);
    composition.dispose();
  });

  it('videoComponent:setVolume', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    videoComponent.setVolume(0.5);
    //@ts-expect-error
    const videoAsset = videoComponent.engine.effectsObjectServer.objectInstance[options.id].data;

    expect(videoAsset.volume).to.equal(0.5);
    composition.dispose();
  });

  it('videoComponent:setPlaybackRate', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    videoComponent.setPlaybackRate(0.5);
    //@ts-expect-error
    const videoAsset = videoComponent.engine.effectsObjectServer.objectInstance[options.id].data;

    expect(videoAsset.playbackRate).to.equal(0.5);
    composition.dispose();
  });

  it('videoComponent:transparent video', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      compositionDuration: 20,
      id,
      videos: [{
        id,
        url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
      }],
      start: 0,
      options: { video: { id }, transparent: true },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    player.gotoAndPlay(11);

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.isVideoActive).to.be.false;
    // @ts-expect-error
    expect(videoComponent.transparent).to.be.true;
    expect(videoComponent.material.isMacroEnabled('TRANSPARENT_VIDEO')).to.be.true;

    composition.dispose();
  });

  it('videoComponent:component destroy & composition forward', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      compositionDuration: 20,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    player.gotoAndPlay(11);

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.isVideoActive).to.be.false;

    composition.dispose();
  });

  it('videoComponent:component destroy & composition destroy', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      compositionEndBehavior: spec.EndBehavior.destroy,
      compositionDuration: 20,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    player.gotoAndPlay(11);

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.isVideoActive).to.be.false;

    composition.dispose();
  });

  it('videoComponent:component destroy & composition freeze', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      compositionEndBehavior: spec.EndBehavior.freeze,
      compositionDuration: 20,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    player.gotoAndPlay(11);

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.isVideoActive).to.be.false;

    composition.dispose();
  });

  it('videoComponent:component freeze', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.freeze,
      compositionDuration: 20,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    await new Promise<void>(resolve => {
      videoComponent.video!.addEventListener('seeked', () => resolve(), { once: true });
      player.gotoAndPlay(11);
    });
    videoComponent.onUpdate(0);
    expect(videoComponent.isVideoActive).to.be.true;
    expect(videoComponent.getCurrentTime()).to.be.closeTo(Math.min(options.duration, videoComponent.getDuration()), 0.01);
    expect(videoComponent.video?.paused).to.be.true;
    composition.dispose();
  });

  it('videoComponent:component restart', async function () {
    const id = generateGUID();
    const options: VideoCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.restart,
      id,
      videos: [
        {
          id,
          url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr',
        },
      ],
      start: 0,
      options: { video: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const video = composition.getItemByName('video');

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    await new Promise<void>(resolve => {
      videoComponent.video!.addEventListener('seeked', () => resolve(), { once: true });
      player.gotoAndPlay(12);
    });
    expect(videoComponent.isVideoActive).to.be.true;
    expect(videoComponent.getCurrentTime()).to.be.within(2, 2.1);
    composition.dispose();
  });
});

describe('videoComponent:playbackRate', function () {
  this.timeout(15000);

  for (const configuredRate of [undefined, 2]) {
    it(`preserves the ${configuredRate ?? 'default'} rate through automatic updates and manual overrides`, async function () {
      const id = generateGUID();
      const engine = player.renderer.engine;
      const previousSpeed = engine.speed;
      const composition = await player.loadScene(getVideoJson({
        duration: 30,
        compositionDuration: 30,
        endBehavior: spec.EndBehavior.restart,
        id,
        videos: [{ id, url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr' }],
        start: 0,
        options: { video: { id }, muted: true, playbackRate: configuredRate },
      }));
      const component = composition.getItemByName('video')!.getComponent(VideoComponent);
      const baseRate = configuredRate ?? 1;

      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(component.video!.playbackRate).to.equal(baseRate);

        composition.speed = 1.5;
        engine.speed = 0.5;
        component.onUpdate(0);
        expect(component.video!.playbackRate).to.equal(baseRate * 0.75);

        component.setPlaybackRate(0.75);
        component.onUpdate(0);
        expect(component.video!.playbackRate).to.equal(0.75);

        component.resetPlaybackRate();
        component.onUpdate(0);
        expect(component.video!.playbackRate).to.equal(baseRate * 0.75);
      } finally {
        engine.speed = previousSpeed;
        composition.dispose();
      }
    });
  }
});

describe('videoComponent:texture binding', function () {
  let player: Player;
  let composition: Composition;
  let component: VideoComponent;
  let video: HTMLVideoElement;
  let texture: Texture;

  beforeEach(async function () {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true, doNotHandleContextLost: false });
    composition = await player.loadScene(getVideoJson({
      duration: 30,
      endBehavior: spec.EndBehavior.restart,
      id: generateGUID(),
      videos: [],
      start: 0,
      options: { volume: 0.4, muted: true, playbackRate: 2 },
    }), { autoplay: false });
    component = composition.getItemByName('video')!.getComponent(VideoComponent);
    video = document.createElement('video');
    texture = Texture.create(player.renderer.engine, { sourceType: TextureSourceType.video, video });
  });

  afterEach(function () {
    composition.dispose();
    texture.dispose();
    player.dispose();
  });

  it('applies configured settings after a placeholder and resetting manual overrides', function () {
    component.setTexture(player.renderer.engine.assetServer.whiteTexture);
    expect(component.video).to.be.undefined;

    component.setLoop(false);
    component.setPlaybackRate(0.75);
    component.resetLoop();
    component.resetPlaybackRate();
    component.setTexture(texture);

    expect(component.video).to.equal(video);
    expect(component.material.getTexture('_MainTex')).to.equal(texture);
    expect(video.volume).to.equal(0.4);
    expect(video.muted).to.be.true;
    expect(video.preservesPitch).to.be.false;
    expect(video.playbackRate).to.equal(2);
    expect(video.loop).to.be.true;
  });

  it('uses defaults when the component is created without serialized data', function () {
    const item = new VFXItem(player.renderer.engine);
    const addedComponent = item.addComponent(VideoComponent);

    composition.addItem(item);
    item.endBehavior = spec.EndBehavior.freeze;
    video.volume = 0.2;
    video.muted = true;
    video.loop = true;
    video.playbackRate = 1.5;
    addedComponent.setTexture(texture);

    expect(video.volume).to.equal(1);
    expect(video.muted).to.be.false;
    expect(video.loop).to.be.false;
    expect(video.playbackRate).to.equal(1);
  });

  it('applies the latest settings and rewinds the first setVideo binding', async function () {
    const fromVideo = Texture.fromVideo;

    video.currentTime = 0.005;
    Texture.fromVideo = async () => texture;
    try {
      composition.speed = 1.5;
      player.renderer.engine.speed = 0.5;
      const pending = component.setVideo('delayed-video.mp4');

      component.setVolume(0);
      component.setMuted(false);
      component.setLoop(false);
      component.setPlaybackRate(0.75);
      await pending;
      expect(component.video).to.equal(video);
      expect(video.currentTime).to.equal(0);
      expect(video.volume).to.equal(0);
      expect(video.muted).to.be.false;
      expect(video.playbackRate).to.equal(0.75);
      expect(video.loop).to.be.false;
    } finally {
      Texture.fromVideo = fromVideo;
    }
  });

  for (const method of ['setTexture', 'setVideo'] as const) {
    it(`pauses a ${method} URL replacement when the composition is paused`, async function () {
      const fromVideo = Texture.fromVideo;
      let paused = false;
      const currentTime = method === 'setVideo' ? 0 : 1;

      Object.defineProperties(video, {
        readyState: { get: () => 4 },
        currentTime: { get: () => currentTime },
        paused: { get: () => paused },
      });
      video.play = async () => { paused = false; };
      video.pause = () => { paused = true; };
      component.isVideoActive = true;
      Texture.fromVideo = async () => texture;
      try {
        expect(composition.getPaused()).to.be.true;
        await component[method]('replacement.mp4');
        expect(video.paused).to.be.true;
        expect(video.currentTime).to.equal(currentTime);
        expect(component.material.getTexture('_MainTex')).to.equal(texture);
      } finally {
        Texture.fromVideo = fromVideo;
      }
    });
  }

  it('keeps the newest URL when video loads finish out of order', async function () {
    const fromVideo = Texture.fromVideo;
    const obsoleteVideo = document.createElement('video');
    const obsolete = Texture.create(player.engine, { sourceType: TextureSourceType.video, video: obsoleteVideo });
    const loads = new Map<string, (texture: Texture) => void>();
    let pauses = 0;

    obsoleteVideo.pause = () => { pauses++; };
    Texture.fromVideo = url => new Promise(resolve => { loads.set(url, resolve); });
    try {
      const first = component.setTexture('first.mp4');
      const second = component.setVideo('second.mp4');

      loads.get('second.mp4')!(texture);
      await second;
      video.currentTime = 3;
      loads.get('first.mp4')!(obsolete);
      await first;
      expect(component.video).to.equal(video);
      expect(video.currentTime).to.equal(3);
      expect(component.material.getTexture('_MainTex')).to.equal(texture);
      expect(video.volume).to.equal(0.4);
      expect(obsolete.isRegistered).to.be.false;
      expect(pauses).to.equal(1);
    } finally {
      Texture.fromVideo = fromVideo;
      obsolete.dispose();
    }
  });

  it('resumes hidden preparation after a pause and stops it on disposal without destroying the borrowed texture', function () {
    let paused = false;

    Object.defineProperties(video, {
      readyState: { get: () => 4 },
      duration: { get: () => 5 },
      currentTime: { get: () => 4.99 },
      paused: { get: () => paused },
    });
    video.play = async () => { paused = false; };
    video.pause = () => { paused = true; };
    composition.sceneRoot.endBehavior = spec.EndBehavior.restart;
    composition.sceneRoot.duration = 6.5;
    component.item.endBehavior = spec.EndBehavior.destroy;
    component.item.duration = 5;
    Object.defineProperty(composition, 'time', { value: 5.05 });
    component.setTexture(texture);
    component.setMuted(false);
    component.onDisable();
    expect(video.paused).to.be.false;
    expect(video.muted).to.be.true;
    expect(video.loop).to.be.true;

    composition.play();
    composition.pause();
    expect(video.paused).to.be.true;
    composition.play();
    expect(video.paused).to.be.false;

    component.dispose();
    expect(video.paused).to.be.true;
    expect(video.muted).to.be.false;
    expect(video.loop).to.be.false;
    expect(texture.isDestroyed).to.be.false;
  });

  it('keeps a faster destroy video hidden until the composition restarts from its prepared head', async function () {
    let mediaTime = 5;
    let compositionTime = 2.5;
    let paused = false;
    let seeks = 0;

    Object.defineProperties(video, {
      readyState: { get: () => 4 },
      duration: { get: () => 5 },
      currentTime: { get: () => mediaTime, set: value => { mediaTime = value; seeks++; } },
      paused: { get: () => paused },
    });
    video.play = async () => { paused = false; };
    video.pause = () => { paused = true; };
    texture.initialize = () => {};
    texture.uploadCurrentVideoFrame = () => true;
    composition.sceneRoot.endBehavior = spec.EndBehavior.restart;
    composition.sceneRoot.duration = 5;
    Object.defineProperty(composition, 'time', { get: () => compositionTime });
    component.item.endBehavior = spec.EndBehavior.destroy;
    component.item.duration = 5;
    component.item.time = 2.5;
    component.setTexture(texture);
    component.isVideoActive = true;
    composition.play();
    component.onUpdate(0);
    mediaTime = 0;
    video.dispatchEvent(new Event('timeupdate'));
    await Promise.resolve();
    await Promise.resolve();

    compositionTime = component.item.time = 4.9;
    component.onUpdate(0);
    expect(video.paused).to.be.true;
    expect(component.material.getTexture('_MainTex')).to.equal(player.engine.assetServer.transparentTexture);

    compositionTime = component.item.time = 0;
    composition.emit('end', { composition });
    component.onUpdate(0);
    expect(video.paused).to.be.false;
    expect(video.currentTime).to.equal(0);
    expect(seeks).to.equal(0);
    expect(component.material.getTexture('_MainTex')).to.equal(texture);
  });

  it('releases owned URL textures on replacement, disposal and late loading', async function () {
    const fromVideo = Texture.fromVideo;
    const unloads = [0, 0, 0];
    const videos = unloads.map((_, index) => {
      const media = document.createElement('video');

      media.preload = 'none';
      media.src = `owned-${index}.mp4`;
      media.load = () => { unloads[index]++; };

      return media;
    });
    const textures = videos.map(video => Texture.create(player.engine, { sourceType: TextureSourceType.video, video }));
    let index = 0;

    Texture.fromVideo = async () => textures[index++];
    try {
      expect(composition.textures).to.have.length(0);
      await component.setVideo('first.mp4');
      component.setTexture(textures[0]);
      expect(textures[0].isDestroyed).to.be.false;
      await component.setTexture('second.mp4');
      expect(textures[0].isDestroyed).to.be.true;
      expect(textures[1].isDestroyed).to.be.false;
      let finish!: (texture: Texture) => void;

      Texture.fromVideo = () => new Promise(resolve => { finish = resolve; });
      const pending = component.setVideo('third.mp4');

      composition.dispose();
      expect(textures[1].isDestroyed).to.be.true;
      finish(textures[2]);
      await pending;
      expect(component.video).to.be.undefined;
      expect(textures.map(texture => texture.isDestroyed)).to.deep.equal([true, true, true]);
      expect(videos.map(video => video.getAttribute('src'))).to.deep.equal([null, null, null]);
      expect(unloads).to.deep.equal([1, 1, 1]);
    } finally {
      Texture.fromVideo = fromVideo;
      textures.forEach(texture => texture.dispose());
    }
  });

  it('preserves scene ownership and a borrowed texture sharing the replaced video', async function () {
    const fromVideo = Texture.fromVideo;
    const sceneTexture = Texture.create(player.engine, {
      sourceType: TextureSourceType.data,
      data: { data: new Uint8Array([255, 255, 255, 255]), width: 1, height: 1 },
    });
    const sharedTexture = texture.clone();
    const item = new VFXItem(player.engine);
    const otherComponent = item.addComponent(VideoComponent);
    let unloads = 0;

    video.preload = 'none';
    video.src = 'shared.mp4';
    video.load = () => { unloads++; };
    composition.addItem(item);
    composition.textures.push(sceneTexture);
    component.setTexture(sceneTexture);
    Texture.fromVideo = async () => texture;
    try {
      await component.setVideo('owned.mp4');
      otherComponent.setTexture(sharedTexture);
      component.setTexture(sharedTexture);
      expect(texture.isDestroyed).to.be.true;
      expect(composition.textures).to.deep.equal([sceneTexture]);
      component.dispose();
      expect(sharedTexture.isDestroyed).to.be.false;
      expect(otherComponent.material.getTexture('_MainTex')).to.equal(sharedTexture);
      expect(sceneTexture.isDestroyed).to.be.false;
      composition.dispose();
      expect(sceneTexture.isDestroyed).to.be.true;
      expect(sharedTexture.isDestroyed).to.be.false;
      expect(video.getAttribute('src')).to.equal('shared.mp4');
      expect(unloads).to.equal(0);
    } finally {
      Texture.fromVideo = fromVideo;
      sharedTexture.dispose();
    }
  });

  it('releases bound and pending URL textures when fromData binds an external video', async function () {
    const fromVideo = Texture.fromVideo;
    const owned = Texture.create(player.engine, { sourceType: TextureSourceType.video, video: document.createElement('video') });
    const obsolete = Texture.create(player.engine, { sourceType: TextureSourceType.video, video: document.createElement('video') });
    const asset = new DataAsset<HTMLVideoElement>(player.engine);
    let finish!: (texture: Texture) => void;

    asset.data = video;
    Texture.fromVideo = async () => owned;
    try {
      await component.setVideo('owned.mp4');
      Texture.fromVideo = () => new Promise(resolve => { finish = resolve; });
      const pending = component.setVideo('pending.mp4');

      component.fromData({
        id: component.getInstanceId(),
        dataType: spec.DataType.VideoComponent,
        item: { id: component.item.getInstanceId() },
        options: { video: { id: asset.getInstanceId() } },
        renderer: { texture },
      });
      expect(owned.isDestroyed).to.be.true;
      finish(obsolete);
      await pending;
      expect(obsolete.isDestroyed).to.be.true;
      expect(component.video).to.equal(video);
      expect(component.material.getTexture('_MainTex')).to.equal(texture);
      component.dispose();
      expect(texture.isDestroyed).to.be.false;
    } finally {
      Texture.fromVideo = fromVideo;
      owned.dispose();
      obsolete.dispose();
    }
  });

  it('uses an independent first frame on replay and releases it on rebinding and disposal', function () {
    composition.sceneRoot.endBehavior = spec.EndBehavior.restart;
    const sources = ['#ff0000', '#0000ff'].map(color => {
      const image = document.createElement('canvas');

      image.width = image.height = 2;
      Object.assign(image, { videoWidth: 2, videoHeight: 2, readyState: 4, currentTime: 0, pause () {}, load () {} });
      const context = image.getContext('2d')!;

      context.fillStyle = color;
      context.fillRect(0, 0, 2, 2);

      return Texture.create(player.engine, { sourceType: TextureSourceType.video, video: image as unknown as HTMLVideoElement });
    });
    const asset = new DataAsset<HTMLVideoElement>(player.engine);

    asset.data = (sources[1].source as { video: HTMLVideoElement }).video;
    try {
      component.setTexture(sources[0]);
      const cache = component as unknown as { firstFrameTexture: Texture };
      const firstFrame = cache.firstFrameTexture;
      const snapshot = (firstFrame.source as { image: HTMLCanvasElement }).image;
      const source = (sources[0].source as { video: HTMLVideoElement }).video;

      (source as unknown as HTMLCanvasElement).getContext('2d')!.clearRect(0, 0, 2, 2);
      expect(Array.from(snapshot.getContext('2d')!.getImageData(0, 0, 1, 1).data)).to.deep.equal([255, 0, 0, 255]);
      component.isVideoActive = true;
      source.currentTime = 1;
      composition.emit('end', { composition });
      expect(source.currentTime).to.equal(0);
      expect(component.material.getTexture('_MainTex')).to.equal(firstFrame);
      const data: VideoItemProps = {
        id: component.getInstanceId(),
        dataType: spec.DataType.VideoComponent,
        item: { id: component.item.getInstanceId() },
        options: { video: { id: asset.getInstanceId() } },
        renderer: { texture: sources[1] },
      };

      component.fromData(data);
      component.isVideoActive = true;
      asset.data.currentTime = 1;
      composition.emit('end', { composition });
      const image = (cache.firstFrameTexture.source as { image: HTMLCanvasElement }).image;

      expect(firstFrame.isDestroyed).to.be.true;
      expect(component.video).to.equal(asset.data);
      expect(component.material.getTexture('_MainTex')).to.equal(cache.firstFrameTexture);
      expect(Array.from(image.getContext('2d')!.getImageData(0, 0, 1, 1).data)).to.deep.equal([0, 0, 255, 255]);
      const replacementFrame = cache.firstFrameTexture;

      component.setTexture(texture);
      expect(replacementFrame.isDestroyed).to.be.true;
      component.setTexture(sources[1]);
      const lastFrame = cache.firstFrameTexture;

      component.dispose();
      expect(lastFrame.isDestroyed).to.be.true;
    } finally {
      sources.forEach(source => source.dispose());
    }
  });

  it('starts a replacement while the previous video still has a pending play', async function () {
    component.setTexture(texture);
    let rejectPlay!: (error: Error) => void;
    let oldPauses = 0;
    let replacementPlays = 0;
    const replacementVideo = document.createElement('video');
    const replacement = Texture.create(player.engine, { sourceType: TextureSourceType.video, video: replacementVideo });

    video.play = () => new Promise((_resolve, reject) => { rejectPlay = reject; });
    video.pause = () => { oldPauses++; };
    replacementVideo.play = async () => { replacementPlays++; };
    try {
      component.playVideo();
      component.setTexture(replacement);
      component.playVideo();
      rejectPlay(new DOMException('old playback interrupted', 'AbortError'));
      await Promise.resolve();
      await Promise.resolve();
      expect(oldPauses).to.equal(1);
      expect(replacementPlays).to.equal(1);
      expect(player.engine.renderErrors.size).to.equal(0);
    } finally {
      replacement.dispose();
    }
  });

  it('does not let a pending play pause the video after it is resumed', async function () {
    component.setTexture(texture);
    let paused = true;
    const plays: (() => void)[] = [];

    Object.defineProperty(video, 'paused', { get: () => paused });
    video.play = () => {
      paused = false;

      return new Promise(resolve => { plays.push(resolve); });
    };
    video.pause = () => { paused = true; };
    component.playVideo();
    component.pauseVideo();
    component.playVideo();
    plays.forEach(resolve => resolve());
    await Promise.resolve();
    await Promise.resolve();
    expect(plays).to.have.length(2);
    expect(paused).to.be.false;
  });

  for (const usePlaceholder of [false, true]) {
    it(`applies serialized settings to a new video after binding (placeholder: ${usePlaceholder})`, function () {
      component.setTexture(texture);
      if (usePlaceholder) {
        component.setTexture(player.renderer.engine.assetServer.whiteTexture);
      }
      const replacementVideo = document.createElement('video');
      const asset = new DataAsset<HTMLVideoElement>(player.renderer.engine);

      replacementVideo.muted = true;
      asset.data = replacementVideo;
      component.fromData({
        id: component.getInstanceId(),
        dataType: spec.DataType.VideoComponent,
        item: { id: component.item.getInstanceId() },
        options: { video: { id: asset.getInstanceId() }, volume: 0.2, muted: false, playbackRate: 0.75 },
        renderer: { texture: component.renderer.texture },
      });

      expect(component.video).to.equal(replacementVideo);
      expect(replacementVideo.volume).to.equal(0.2);
      expect(replacementVideo.muted).to.be.false;
      expect(replacementVideo.playbackRate).to.equal(0.75);
      expect(replacementVideo.loop).to.be.true;
      expect(video.volume).to.equal(0.4);
      expect(video.muted).to.be.true;
    });
  }

  it('applies the scaled playback rate on first binding', function () {
    composition.speed = 1.5;
    player.renderer.engine.speed = 0.5;
    component.setTexture(texture);
    expect(video.playbackRate).to.equal(1.5);
  });

  it('preserves replacement volume, mute, loop, and rate after switching back to an image', function () {
    component.setTexture(texture);
    component.setVolume(0.1);
    component.setMuted(true);
    component.setLoop(true);
    component.setPlaybackRate(0.5);
    const replacementVideo = document.createElement('video');
    const replacement = Texture.create(player.renderer.engine, { sourceType: TextureSourceType.video, video: replacementVideo });

    replacementVideo.volume = 0.8;
    replacementVideo.muted = false;
    replacementVideo.loop = false;
    replacementVideo.playbackRate = 1.25;
    try {
      component.setTexture(player.renderer.engine.assetServer.whiteTexture);
      component.setTexture(replacement);
      expect(replacementVideo.preservesPitch).to.be.false;
      expect(replacementVideo.volume).to.equal(0.8);
      expect(replacementVideo.muted).to.be.false;
      expect(replacementVideo.loop).to.be.false;
      expect(replacementVideo.playbackRate).to.equal(1.25);
    } finally {
      replacement.dispose();
    }
  });
});

describe('videoComponent:setVideo', function () {
  this.timeout(15000);

  const url = 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr';
  const replacementUrl = 'https://mdn.alipayobjects.com/huamei_p0cigc/afts/file/A*ZOgXRbmVlsIAAAAAAAAAAAAADoB5AQ';
  let composition: Composition;
  let component: VideoComponent;

  beforeEach(async function () {
    const id = generateGUID();

    composition = await player.loadScene(getVideoJson({
      duration: 30,
      compositionDuration: 30,
      endBehavior: spec.EndBehavior.restart,
      id,
      videos: [{ id, url }],
      start: 0,
      options: { video: { id }, muted: true },
    }));
    component = composition.getItemByName('video')!.getComponent(VideoComponent);
  });

  afterEach(function () {
    composition?.dispose();
  });

  it('keeps the current image visible during forward and backward goto and pauses after gotoAndStop', async function () {
    const video = component.video!;
    const texture = component.renderer.texture;

    for (const time of [1, 2, 0.5]) {
      const seeked = new Promise<void>(resolve => video.addEventListener('seeked', () => resolve(), { once: true }));

      composition.gotoAndPlay(time);
      component.onUpdate(0);
      expect(component.material.getTexture('_MainTex')).to.equal(texture);
      await seeked;
      expect(video.currentTime).to.be.closeTo(time, 0.1);
    }
    const seeked = new Promise<void>(resolve => video.addEventListener('seeked', () => resolve(), { once: true }));

    composition.gotoAndStop(0.25);
    expect(component.material.getTexture('_MainTex')).to.equal(texture);
    await seeked;
    component.onUpdate(0);
    expect(video.currentTime).to.be.closeTo(0.25, 0.01);
    expect(video.paused).to.be.true;
  });

  it('explicitly rewinds the loaded URL and retains automatic playback settings', async function () {
    const originalTexture = component.renderer.texture;
    const fromVideo = Texture.fromVideo;
    const texture = await fromVideo(replacementUrl, player.renderer.engine);
    const video = (texture.source as { video: HTMLVideoElement }).video;

    video.pause();
    await new Promise<void>(resolve => {
      video.addEventListener('seeked', () => resolve(), { once: true });
      video.currentTime = 1;
    });
    composition.pause();
    composition.speed = 1.5;
    component.setVolume(0.4);
    component.setMuted(false);
    Texture.fromVideo = async (url, engine) => {
      expect(url).to.equal(replacementUrl);
      expect(engine).to.equal(player.renderer.engine);

      return texture;
    };
    try {
      await component.setVideo(replacementUrl);
      expect(component.video).to.equal(video);
      expect(video.currentTime).to.equal(0);
      if (video.seeking) {
        await new Promise<void>(resolve => video.addEventListener('seeked', () => resolve(), { once: true }));
      }
      expect(video.volume).to.equal(1);
      expect(video.muted).to.be.true;
      expect(component.material.getTexture('_MainTex')).to.equal(texture);
      expect(composition.textures).to.include(originalTexture);
      expect(composition.textures).not.to.include(texture);
      composition.play();
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(video.paused).to.be.false;
      expect(video.currentTime).to.be.within(0.01, 1);
      expect(video.loop).to.be.true;
      expect(video.playbackRate).to.equal(1.5);
      composition.dispose();
      expect(texture.isDestroyed).to.be.true;
    } finally {
      Texture.fromVideo = fromVideo;
      originalTexture.dispose();
      if (!texture.isDestroyed) { texture.dispose(); }
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  });

  it('preserves the existing texture position and manual playback mode', async function () {
    const texture = await Texture.fromVideo(replacementUrl, player.renderer.engine);
    const video = (texture.source as { video: HTMLVideoElement }).video;

    try {
      video.pause();
      await new Promise<void>(resolve => {
        video.addEventListener('seeked', () => resolve(), { once: true });
        video.currentTime = 1;
      });
      video.volume = 0.3;
      video.muted = false;
      video.loop = false;
      video.playbackRate = 1.5;
      composition.pause();
      component.setVolume(0.8);
      component.setMuted(true);
      component.setLoop(true);
      component.setPlaybackRate(0.5);
      component.setTexture(texture);

      expect(component.video).to.equal(video);
      expect(video.currentTime).to.equal(1);
      expect(video.paused).to.be.true;
      composition.play();
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(video.volume).to.equal(0.3);
      expect(video.muted).to.be.false;
      expect(video.loop).to.be.false;
      expect(video.playbackRate).to.equal(1.5);
    } finally {
      composition.dispose();
      texture.dispose();
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  });

  it('uploads the final video frame when a replacement freezes at double speed', async function () {
    const originalTexture = component.renderer.texture;

    try {
      await component.setVideo('https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*RHk_SYRqMMwAAAAAYaAAAAgAesF2AQ');
      component.item.endBehavior = spec.EndBehavior.freeze;
      component.setLoop(false);
      component.setPlaybackRate(2);
      const video = component.video!;
      const texture = component.renderer.texture;
      const upload = texture.uploadCurrentVideoFrame.bind(texture);
      let lastUploadedTime = -1;

      texture.uploadCurrentVideoFrame = force => {
        lastUploadedTime = video.currentTime;

        return upload(force);
      };
      await new Promise<void>((resolve, reject) => {
        const deadline = performance.now() + 5000;
        const timer = window.setInterval(() => {
          if (video.paused && video.currentTime >= video.duration - 0.01) {
            window.clearInterval(timer);
            resolve();
          } else if (performance.now() > deadline) {
            window.clearInterval(timer);
            reject(new Error('Video did not reach its end'));
          }
        }, 20);
      });
      component.onUpdate(0);
      expect(video.currentTime).to.equal(video.duration);
      expect(lastUploadedTime).to.equal(video.currentTime);
    } finally {
      originalTexture.dispose();
    }
  });

  it('freezes at the composition endpoint without stopping within the seek tolerance', async function () {
    const video = component.video!;

    composition.sceneRoot.duration = 1;
    composition.sceneRoot.endBehavior = spec.EndBehavior.freeze;

    for (const time of [0.995, 1]) {
      composition.gotoAndStop(time);
      if (video.seeking) {
        await new Promise<void>(resolve => video.addEventListener('seeked', () => resolve(), { once: true }));
      }
      component.onUpdate(0);
      await video.play();
      component.onUpdate(0);
      expect(video.paused).to.equal(time === 1);
    }
  });

  it('keeps the current video when loading a replacement fails', async function () {
    const video = component.video!;
    const texture = component.renderer.texture;

    component.setVolume(0.4);
    let failed = false;

    try {
      await component.setVideo('data:video/mp4;base64,AAAA');
    } catch {
      failed = true;
    }
    expect(failed).to.be.true;
    expect(component.video).to.equal(video);
    expect(component.renderer.texture).to.equal(texture);
    expect(video.volume).to.equal(0.4);
  });
});

describe('videoComponent:loadScene autoplay', function () {
  this.timeout(15000);

  it('waits for canplay before completing video preloading without playing it', async function () {
    const video = document.createElement('video');
    const createElement = document.createElement.bind(document);

    Object.defineProperty(video, 'src', { value: '', writable: true });
    video.load = chai.spy();
    video.play = chai.spy(() => Promise.resolve());
    chai.spy.on(document, 'createElement', (tag: string, options?: ElementCreationOptions) =>
      tag === 'video' ? video : createElement(tag, options));
    try {
      let ready = false;
      const pending = processMultimedia<HTMLVideoElement>([{ id: 'video', url: 'video.mp4' }], spec.MultimediaType.video, {}).then(result => {
        ready = true;

        return result;
      });

      expect(video.preload).to.equal('auto');
      expect(video.load).to.have.been.called.once;
      video.dispatchEvent(new Event('loadeddata'));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(ready).to.be.false;
      video.dispatchEvent(new Event('canplay'));
      expect(await pending).to.deep.equal([video]);
      expect(video.play).not.to.have.been.called();
    } finally {
      chai.spy.restore(document);
    }
  });

  it('keeps a preloaded video paused until the composition starts', async function () {
    const currentPlayer = new Player({ canvas: document.createElement('canvas') });
    const id = generateGUID();

    try {
      const scene = getVideoJson({
        duration: 30,
        compositionDuration: 30,
        endBehavior: spec.EndBehavior.restart,
        id,
        videos: [{ id, url: 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr' }],
        start: 0,
        options: { video: { id }, muted: true },
      });
      const composition = await currentPlayer.loadScene(scene, { autoplay: false });
      const video = composition.getItemByName('video')!.getComponent(VideoComponent).video!;

      await new Promise(resolve => setTimeout(resolve, 300));
      expect(composition.getPaused()).to.be.true;
      expect(video.paused).to.be.true;
      expect(video.currentTime).to.equal(0);
      currentPlayer.play();
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(composition.getPaused()).to.be.false;
      expect(video.paused).to.be.false;
      expect(video.currentTime).to.be.greaterThan(0.05);

      composition.pause();
      const pausedTime = video.currentTime;

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(video.paused).to.be.true;
      expect(video.currentTime).to.be.closeTo(pausedTime, 0.02);
      expect(currentPlayer.engine.renderErrors.size).to.equal(0);
    } finally {
      currentPlayer.dispose();
    }
  });
});

function getVideoJson (options: VideoCompositionOptions) {
  return {
    playerVersion: { web: '2.0.4', native: '0.0.1.202311221223' },
    images: [],
    fonts: [],
    version: '3.0',
    shapes: [],
    plugins: [],
    videos: options.videos,
    type: 'ge',
    compositions: [
      {
        id: '5',
        name: 'videoTest',
        duration: options.compositionDuration || 10,
        startTime: 0,
        endBehavior: options.compositionEndBehavior || spec.EndBehavior.forward,
        previewSize: [750, 1624],
        items: [{ id: '147e873c89b34c6f96108ccc4d6e6f83' }],
        camera: { fov: 60, far: 40, near: 0.1, clipMode: 1, position: [0, 0, 8], rotation: [0, 0, 0] },
        sceneBindings: [
          { key: { id: 'c3cffe498bec4da195ecb68569806ca4' }, value: { id: '147e873c89b34c6f96108ccc4d6e6f83' } },
        ],
        timelineAsset: { id: '71ed8f480c64458d94593279bcf831aa' },
      },
    ],
    components: [
      {
        id: '6dc07c93b035442a93dc3f3ebdba0796',
        item: { id: '147e873c89b34c6f96108ccc4d6e6f83' },
        dataType: 'VideoComponent',
        options: options.options,
        renderer: {
          'renderMode': 1,
          'texture': options.videos.length ? {
            'id': 'b582d21fdd524c4684f1c057b220ddd0',
          } : undefined,
        },
      },
    ],
    textures: options.videos.length ? [
      {
        'id': 'b582d21fdd524c4684f1c057b220ddd0',
        'source': {
          'id': options.id,
        },
        'flipY': true,
      },
    ] : [],
    geometries: [],
    materials: [],
    items: [
      {
        id: '147e873c89b34c6f96108ccc4d6e6f83',
        name: 'video',
        duration: options.duration,
        type: '1',
        visible: true,
        endBehavior: options.endBehavior,
        delay: options.start,
        renderLevel: 'B+',
        components: [{ id: '6dc07c93b035442a93dc3f3ebdba0796' }],
        transform: {
          position: { x: 0, y: 4.6765, z: 0 },
          eulerHint: { x: 0, y: 0, z: 0 },
          anchor: { x: 0, y: 0 },
          size: { x: 3.1492, y: 3.1492 },
          scale: { x: 1, y: 1, z: 1 },
        },
        dataType: 'VFXItemData',
      },
    ],
    shaders: [],
    bins: [],
    animations: [],
    miscs: [
      {
        id: '71ed8f480c64458d94593279bcf831aa',
        dataType: 'TimelineAsset',
        tracks: [{ id: 'c3cffe498bec4da195ecb68569806ca4' }],
      },
      { id: 'acfa5d2ad9be40f991db5e9d93864803', dataType: 'ActivationPlayableAsset' },
      { id: '063079d00a6749419976693d32f0d42a', dataType: 'TransformPlayableAsset', positionOverLifetime: {} },
      {
        id: 'b5b10964ddb54ce29ed1370c62c02e89',
        dataType: 'ActivationTrack',
        children: [],
        clips: [{ start: options.start, duration: options.duration, endBehavior: options.endBehavior, asset: { id: 'acfa5d2ad9be40f991db5e9d93864803' } }],
      },
      {
        id: '0259077ac16c4c498fcc91ed341f1909',
        dataType: 'TransformTrack',
        children: [],
        clips: [{ start: options.start, duration: options.duration, endBehavior: options.endBehavior, asset: { id: '063079d00a6749419976693d32f0d42a' } }],
      },
      {
        id: 'c3cffe498bec4da195ecb68569806ca4',
        dataType: 'ObjectBindingTrack',
        children: [
          { id: 'b5b10964ddb54ce29ed1370c62c02e89' },
          { id: '0259077ac16c4c498fcc91ed341f1909' },
        ],
        clips: [],
      },
    ],
    compositionId: '5',
  };
}
