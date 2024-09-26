import { generateGUID, Player, spec } from '@galacean/effects';
import { VideoComponent } from '@galacean/effects-plugin-media';

export interface VideoCompositionOptions {
  duration: number,
  endBehavior: spec.EndBehavior,
  id: string,
  videos: spec.AssetBaseOptions[],
  start: number,
  options: spec.VideoContentOptions,
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
          url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr',
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
    expect(video.start).to.equal(options.start);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
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
          url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr',
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
    expect(video.start).to.equal(options.start);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.enabled).to.be.false;

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
          url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr',
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
    expect(video.start).to.equal(options.start);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    const duration = videoComponent.getDuration();
    //@ts-expect-error
    const videoAsset = videoComponent.engine.objectInstance[options.id].data;

    expect(duration).to.equal(videoAsset.duration);

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
          url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr',
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
    expect(video.start).to.equal(options.start);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    videoComponent.setCurrentTime(3);
    //@ts-expect-error
    const videoAsset = videoComponent.engine.objectInstance[options.id].data;

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
          url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr',
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
    expect(video.start).to.equal(options.start);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    videoComponent.setLoop(true);
    //@ts-expect-error
    const videoAsset = videoComponent.engine.objectInstance[options.id].data;

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
          url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr',
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
    expect(video.start).to.equal(options.start);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    videoComponent.setMuted(true);
    //@ts-expect-error
    const videoAsset = videoComponent.engine.objectInstance[options.id].data;

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
          url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr',
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
    expect(video.start).to.equal(options.start);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    videoComponent.setVolume(0.5);
    //@ts-expect-error
    const videoAsset = videoComponent.engine.objectInstance[options.id].data;

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
          url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr',
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
    expect(video.start).to.equal(options.start);
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    videoComponent.setPlaybackRate(0.5);
    //@ts-expect-error
    const videoAsset = videoComponent.engine.objectInstance[options.id].data;

    expect(videoAsset.playbackRate).to.equal(0.5);
    composition.dispose();
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
        duration: 10,
        startTime: 0,
        endBehavior: 2,
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
          'texture': {
            'id': 'b582d21fdd524c4684f1c057b220ddd0',
          },
        },
      },
    ],
    textures: [
      {
        'id': 'b582d21fdd524c4684f1c057b220ddd0',
        'source': {
          'id': options.id,
        },
        'flipY': true,
      },
    ],
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
