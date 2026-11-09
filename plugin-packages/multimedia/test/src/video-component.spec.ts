import type { Composition } from '@galacean/effects';
import { generateGUID, Player, Texture, TextureSourceType, VFXItem, spec } from '@galacean/effects';
import type { VideoItemProps } from '@galacean/effects-plugin-multimedia';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';

interface VideoCompositionOptions {
  duration: number,
  endBehavior: spec.EndBehavior,
  id: string,
  videos: spec.AssetBase[],
  start: number,
  options: VideoItemProps['options'],
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
    videoComponent.setCurrentTime(3);
    //@ts-expect-error
    const videoAsset = videoComponent.engine.effectsObjectServer.objectInstance[options.id].data;

    expect(videoAsset.currentTime).to.equal(3);
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
    // @ts-expect-error
    const macros = videoComponent.material.shader.shaderData.macros;

    macros.forEach((macro: [string, boolean]) => {
      if (macro[0] === 'TRANSPARENT') {
        expect(macro[1]).to.be.true;
      }
    });

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

    player.gotoAndPlay(11);

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.isVideoActive).to.be.true;
    expect(videoComponent.getCurrentTime()).to.be.within(1, 1.1);
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

    player.gotoAndPlay(12);

    if (!video) { throw new Error('video is null'); }
    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
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
    it(`keeps the newest ${method} URL when video loads finish out of order`, async function () {
      const fromVideo = Texture.fromVideo;
      const obsoleteVideo = document.createElement('video');
      const obsolete = Texture.create(player.engine, { sourceType: TextureSourceType.video, video: obsoleteVideo });
      const loads = new Map<string, (texture: Texture) => void>();
      let pauses = 0;

      obsoleteVideo.pause = () => { pauses++; };
      Texture.fromVideo = url => new Promise(resolve => { loads.set(url, resolve); });
      try {
        const first = component[method]('first.mp4');
        const second = component[method]('second.mp4');

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
  }

  it('lets a direct texture binding supersede a pending URL', async function () {
    const fromVideo = Texture.fromVideo;
    let finish!: (texture: Texture) => void;
    const placeholder = player.engine.assetServer.whiteTexture;

    Texture.fromVideo = () => new Promise(resolve => { finish = resolve; });
    try {
      const pending = component.setTexture('pending.mp4');

      component.setTexture(placeholder);
      finish(texture);
      await pending;
      expect(component.video).to.be.undefined;
      expect(component.material.getTexture('_MainTex')).to.equal(placeholder);
      expect(texture.isRegistered).to.be.false;
    } finally {
      Texture.fromVideo = fromVideo;
    }
  });

  it('releases a URL texture that finishes loading after component disposal', async function () {
    const fromVideo = Texture.fromVideo;
    let finish!: (texture: Texture) => void;

    Texture.fromVideo = () => new Promise(resolve => { finish = resolve; });
    try {
      const pending = component.setTexture('pending.mp4');

      component.dispose();
      finish(texture);
      await pending;
      expect(component.video).to.be.undefined;
      expect(texture.isRegistered).to.be.false;
    } finally {
      Texture.fromVideo = fromVideo;
    }
  });

  it('keeps a replaced texture available for context restoration and engine cleanup', function () {
    const original = Texture.create(player.engine, {
      sourceType: TextureSourceType.data,
      data: { data: new Uint8Array([255, 255, 255, 255]), width: 1, height: 1 },
    });
    let restores = 0;

    original.initialize();
    original.restore = () => { restores++; };
    component.setTexture(original);
    component.setTexture(texture);
    player.engine.effectsObjectServer.restoreGraphicsResources();
    expect(restores).to.equal(1);
    player.dispose();
    expect(original.isRegistered).to.be.false;
    expect(() => original.initialize()).to.throw();
  });

  it('retains an independent first frame and releases it on replacement and disposal', function () {
    composition.sceneRoot.endBehavior = spec.EndBehavior.restart;
    const image = document.createElement('canvas');

    image.width = image.height = 2;
    Object.assign(image, { videoWidth: 2, videoHeight: 2, readyState: 4, currentTime: 0, pause () {}, load () {} });
    const context = image.getContext('2d')!;

    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 2, 2);
    const source = Texture.create(player.engine, { sourceType: TextureSourceType.video, video: image as unknown as HTMLVideoElement });
    const cache = component as unknown as { firstFrameTexture?: Texture };

    try {
      component.setTexture(source);
      const firstFrame = cache.firstFrameTexture!;
      const snapshot = (firstFrame.source as { image: HTMLCanvasElement }).image;

      context.fillStyle = '#0000ff';
      context.fillRect(0, 0, 2, 2);
      expect(Array.from(snapshot.getContext('2d')!.getImageData(0, 0, 1, 1).data)).to.deep.equal([255, 0, 0, 255]);
      component.setTexture(texture);
      expect(firstFrame.isDestroyed).to.be.true;
      component.setTexture(source);
      const nextFrame = cache.firstFrameTexture!;

      component.dispose();
      expect(nextFrame.isDestroyed).to.be.true;
    } finally {
      source.dispose();
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
      expect(composition.textures).to.include(texture);
      expect(composition.textures).not.to.include(originalTexture);
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
    const originalTexture = component.renderer.texture;
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
      originalTexture.dispose();
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
    composition.gotoAndStop(0.995);
    await new Promise(resolve => setTimeout(resolve, 100));
    await video.play();
    component.onUpdate(0);
    expect(video.paused).to.be.false;

    composition.gotoAndStop(1);
    await new Promise(resolve => setTimeout(resolve, 100));
    await video.play();
    component.onUpdate(0);
    expect(video.paused).to.be.true;
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

  for (const autoplay of [false, true, undefined]) {
    it(`respects autoplay=${autoplay}`, async function () {
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
        const composition = await currentPlayer.loadScene(scene, autoplay === undefined ? {} : { autoplay });
        const video = composition.getItemByName('video')!.getComponent(VideoComponent).video!;

        await new Promise(resolve => setTimeout(resolve, 300));
        if (autoplay === false) {
          expect(composition.getPaused()).to.be.true;
          expect(video.paused).to.be.true;
          expect(video.currentTime).to.equal(0);
          currentPlayer.play();
          await new Promise(resolve => setTimeout(resolve, 300));
        }
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
  }
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
