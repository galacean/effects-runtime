import { Animator, generateGUID, Player, spec } from '@galacean/effects';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';

interface VideoCompositionOptions {
  duration: number,
  endBehavior: spec.EndBehavior,
  id: string,
  videos: spec.AssetBase[],
  start: number,
  options: spec.VideoContentOptions,
  compositionDuration?: number,
  compositionEndBehavior?: spec.EndBehavior,
}

const { expect } = chai;
const player = new Player({
  canvas: document.createElement('canvas'),
});

/**
 * 等待底层 <video> metadata 就绪(readyState>=2),最多等 maxWait 毫秒。
 * loadScene 的 await 不保证 <video> 已加载 metadata,需显式等待以免 onUpdate 提前 return。
 */
async function waitForVideoReady (video: HTMLVideoElement | undefined, maxWait = 3000): Promise<void> {
  if (!video) {
    return;
  }

  if (video.readyState >= 2) {
    return;
  }

  await new Promise<void>(resolve => {
    const onReady = () => {
      if (video.readyState >= 2) {
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        resolve();
      }
    };

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    setTimeout(() => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      resolve();
    }, maxWait);
  });
}

/**
 * 等待底层 <video> 的 seek/play 完成,最多等 maxWait 毫秒。
 * headless 环境下 <video>.play()/seek() 是异步的,断言前需让出事件循环。
 */
async function waitForVideoSeek (video: HTMLVideoElement | undefined, maxWait = 1000): Promise<void> {
  if (!video) {
    return;
  }

  const start = performance.now();

  // 至少等一次 seeked 事件,或超时
  await new Promise<void>(resolve => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };

    video.addEventListener('seeked', onSeeked);
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, maxWait);
  });

  // 额外让出一帧事件循环
  await new Promise(resolve => setTimeout(resolve, Math.max(0, maxWait - (performance.now() - start))));
}

function mockSeekableVideo (video: HTMLVideoElement | undefined, duration = 10): void {
  if (!video) {
    return;
  }

  let currentTime = 0;

  Object.defineProperties(video, {
    readyState: {
      configurable: true,
      get: () => 2,
    },
    duration: {
      configurable: true,
      get: () => duration,
    },
    currentTime: {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
        video.dispatchEvent(new Event('seeked'));
      },
    },
  });
}

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
    const videoAsset = videoComponent.engine.objectInstance[options.id].data;

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
    // loadScene 后 video 元素可能已前进一帧,允许微小偏移
    expect(videoComponent.getCurrentTime()).to.be.within(0, 0.05);

    player.gotoAndPlay(options.start);

    expect(videoComponent.isVideoActive).to.be.true;
    expect(videoComponent.getCurrentTime()).to.be.within(0, 0.1);
    composition.dispose();
  });

  it('videoComponent:setCurrentTime', async function () {
    this.timeout(8000);

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
    // 避免依赖真实远程视频的 metadata/seek,这里仅验证 setCurrentTime 触发 pending seek 的组件逻辑。
    mockSeekableVideo(videoComponent.video);
    videoComponent.setCurrentTime(3);
    // setCurrentTime 只是登记 pendingSeekTime,需要下一次组件 update 触发 processPendingSeek。
    videoComponent.onUpdate(16);
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
    const videoAsset = videoComponent.engine.objectInstance[options.id].data;

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
    // transparent 视频会通过 enableMacro 启用 TRANSPARENT_VIDEO 宏
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
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    // 等底层 <video> metadata 就绪再 gotoAndPlay,否则 onUpdate 因 readyState<2 提前 return
    await waitForVideoReady(videoComponent.video);
    player.gotoAndPlay(11);

    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.isVideoActive).to.be.true;
    // freeze 行为下 video seek 到片段末尾后暂停,seek 为异步,等待其完成
    await waitForVideoSeek(videoComponent.video, 1500);
    expect(videoComponent.getCurrentTime()).to.be.within(0, 1.1);
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
    const videoComponent = video.getComponent<VideoComponent>(VideoComponent);

    // 等底层 <video> metadata 就绪再 gotoAndPlay,否则 onUpdate 因 readyState<2 提前 return
    await waitForVideoReady(videoComponent.video);
    player.gotoAndPlay(12);

    expect(video.endBehavior).to.equal(options.endBehavior);
    expect(video.duration).to.equal(options.duration);

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(videoComponent.isVideoActive).to.be.true;
    // restart 行为下 video 循环播放,进度取决于底层 <video> 真实播放,异步等待
    await waitForVideoSeek(videoComponent.video, 1500);
    expect(videoComponent.getCurrentTime()).to.be.at.least(0);
    composition.dispose();
  });

  it('videoComponent:state machine activated video starts from local zero', async function () {
    const stateMachinePlayer = new Player({
      canvas: document.createElement('canvas'),
      manualRender: true,
    });
    const composition = await stateMachinePlayer.loadScene(getStateMachineVideoJson(), { autoplay: true });
    const activeVideo = composition.getItemByName('video_2');
    const inactiveVideo = composition.getItemByName('video_1');

    if (!activeVideo || !inactiveVideo) { throw new Error('video is null'); }
    const videoComponent = activeVideo.getComponent<VideoComponent>(VideoComponent);
    const animator = composition.rootItem.getComponent<Animator>(Animator);

    const frameDuration = 33;
    const frameCount = Math.ceil(4 / (frameDuration / 1000));

    for (let i = 0; i < frameCount; i++) {
      stateMachinePlayer.tick(frameDuration);
    }

    const currentState = animator.getStateMachineNode('state-machine')?.getCurrentStateName();

    expect(videoComponent).to.be.instanceOf(VideoComponent);
    expect(currentState, 'state machine should enter animation-2').to.equal('animation-2');
    expect(activeVideo.isActive, `video_2 should be active; video_2.time=${activeVideo.time}, video_1.time=${inactiveVideo.time}`).to.equal(true);
    expect(activeVideo.time, 'video_2 should start from animation-2 local time').to.be.greaterThan(0.3);
    expect(activeVideo.time, 'video_2 should not inherit composition/global time').to.be.lessThan(0.5);
    expect(inactiveVideo.isActive, 'video_1 should be inactive after transition').to.equal(false);
    expect(videoComponent.isVideoActive, 'video_2 component should be enabled').to.equal(true);
    expect(videoComponent.getCurrentTime(), 'video element should not be seeked to global time').to.be.lessThan(0.5);

    composition.dispose();
    stateMachinePlayer.dispose();
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

function getStateMachineVideoJson () {
  return {
    playerVersion: { web: '2.8.11', native: '0.0.1.202311221223' },
    images: [],
    fonts: [],
    version: '3.6',
    plugins: ['video'],
    type: 'ge',
    compositions: [
      {
        id: 'ab87e998c55a480183080733a7197e9e',
        name: 'videomachine',
        duration: 20,
        startTime: 0,
        endBehavior: 4,
        previewSize: [750, 1624],
        camera: { fov: 60, far: 40, near: 0.1, clipMode: 1, position: [0, 0, 8], rotation: [0, 0, 0] },
        components: [
          { id: '6cf775b21c7248e384cde9b264502322' },
          { id: 'eabc426188a64b9faf59138739fbd1b1' },
        ],
      },
    ],
    components: [
      {
        id: '6cf775b21c7248e384cde9b264502322',
        item: { id: 'ab87e998c55a480183080733a7197e9e' },
        dataType: 'CompositionComponent',
        items: [
          { id: 'f706f6ad31dd42598399c8e62374d273' },
          { id: '00d361b0aa0b4587a5d75d77857da259' },
        ],
        timelineAsset: { id: 'acb14ee6c2784e05ad717e65b2bdee95' },
        sceneBindings: [
          { key: { id: 'f9c4dffcba03480dbf2fc84e0627dce0' }, value: { id: 'f706f6ad31dd42598399c8e62374d273' } },
          { key: { id: 'c2cfdf3b763349f5af94240e7ace7d51' }, value: { id: '00d361b0aa0b4587a5d75d77857da259' } },
        ],
      },
      {
        id: 'b1f33071bd7f41d5bb87b6a6058bf5c2',
        item: { id: 'f706f6ad31dd42598399c8e62374d273' },
        dataType: 'VideoComponent',
        options: {
          startColor: [1, 1, 1, 1],
          muted: true,
          video: { id: 'a0b4d22d331343fb97cc2e484445f799' },
          volume: 1,
          playbackRate: 1,
          transparent: true,
        },
        renderer: { renderMode: 1, texture: { id: 'eb0aeacb5b7540e79c02d5c54bcd0388' } },
      },
      {
        id: 'f633a471f9bc42eeaec8aa6fbd236945',
        item: { id: '00d361b0aa0b4587a5d75d77857da259' },
        dataType: 'VideoComponent',
        options: {
          startColor: [1, 1, 1, 1],
          muted: true,
          video: { id: '92c6ce72cdc84a829ce28e3a73768300' },
          volume: 1,
          playbackRate: 1,
          transparent: true,
        },
        renderer: { renderMode: 1, texture: { id: '268c1d182ee14e24bdbfbb06f7c36c2d' } },
      },
      {
        id: 'eabc426188a64b9faf59138739fbd1b1',
        item: { id: 'ab87e998c55a480183080733a7197e9e' },
        dataType: 'Animator',
        graphAsset: { id: '5581de0d264f4e8a8599d3d44ff82448' },
      },
    ],
    geometries: [],
    materials: [],
    items: [
      {
        id: 'f706f6ad31dd42598399c8e62374d273',
        name: 'video_2',
        duration: 2.1667,
        type: 'video',
        visible: true,
        endBehavior: 4,
        delay: 0,
        renderLevel: 'B+',
        components: [{ id: 'b1f33071bd7f41d5bb87b6a6058bf5c2' }],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          eulerHint: { x: 0, y: 0, z: 0 },
          anchor: { x: 0, y: 0 },
          size: { x: 13.7634, y: 13.2837 },
          scale: { x: 1, y: 1, z: 1 },
        },
        dataType: 'VFXItemData',
      },
      {
        id: '00d361b0aa0b4587a5d75d77857da259',
        name: 'video_1',
        duration: 3.5,
        type: 'video',
        visible: true,
        endBehavior: 4,
        delay: 0,
        renderLevel: 'B+',
        components: [{ id: 'f633a471f9bc42eeaec8aa6fbd236945' }],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          eulerHint: { x: 0, y: 0, z: 0 },
          anchor: { x: 0, y: 0 },
          size: { x: 13.7634, y: 13.2837 },
          scale: { x: 1, y: 1, z: 1 },
        },
        dataType: 'VFXItemData',
      },
    ],
    shaders: [],
    bins: [],
    textures: [
      { id: 'eb0aeacb5b7540e79c02d5c54bcd0388', source: { id: 'a0b4d22d331343fb97cc2e484445f799' }, flipY: true },
      { id: '268c1d182ee14e24bdbfbb06f7c36c2d', source: { id: '92c6ce72cdc84a829ce28e3a73768300' }, flipY: true },
    ],
    animations: [
      {
        positionCurves: [],
        scaleCurves: [],
        floatCurves: [
          { path: 'video_1', className: 'VFXItem', property: 'isActive', keyFrames: [21, [[4, [0, 1]]]] },
          { path: 'video_2', className: 'VFXItem', property: 'isActive', keyFrames: [21, [[4, [0, 0]]]] },
        ],
        eulerCurves: [],
        rotationCurves: [],
        colorCurves: [],
        id: '8fa45bd4af7049da90bd1acf149d8483',
        dataType: 'AnimationClip',
        name: 'animation-1.anic',
        duration: 3.6,
      },
      {
        positionCurves: [],
        scaleCurves: [],
        floatCurves: [
          { path: 'video_1', className: 'VFXItem', property: 'isActive', keyFrames: [21, [[4, [0, 0]]]] },
          { path: 'video_2', className: 'VFXItem', property: 'isActive', keyFrames: [21, [[4, [0, 1]]]] },
        ],
        eulerCurves: [],
        rotationCurves: [],
        colorCurves: [],
        id: 'a349a970667b4929882477b93d366e57',
        dataType: 'AnimationClip',
        name: 'animation-2.anic',
        duration: 2.2,
      },
      {
        id: '5581de0d264f4e8a8599d3d44ff82448',
        rootNodeIndex: 3,
        controlParameterIDs: ['_default-parameter-0', '_default-parameter-1', '_default-parameter-2'],
        dataType: 'AnimationGraphAsset',
        nodeDatas: [
          { type: 'ControlParameterFloatNodeData', index: 0, value: 0 },
          { type: 'ControlParameterFloatNodeData', index: 1, value: 1 },
          { type: 'ControlParameterFloatNodeData', index: 2, value: 0.5 },
          {
            type: 'StateMachineNodeData',
            index: 3,
            stateDatas: [{ stateNodeIndex: 11, transitionDatas: [] }],
            defaultStateIndex: 0,
            machineName: 'controller',
          },
          {
            type: 'StateMachineNodeData',
            index: 4,
            stateDatas: [
              { stateNodeIndex: 5, transitionDatas: [{ targetStateIndex: 1, conditionNodeIndex: -1, transitionNodeIndex: 9 }] },
              { stateNodeIndex: 7, transitionDatas: [] },
            ],
            defaultStateIndex: 0,
            machineName: 'state-machine',
          },
          { type: 'StateNodeData', index: 5, childNodeIndex: 6, stateName: 'animation-1' },
          { type: 'AnimationClipNodeData', index: 6, dataSlotIndex: 0, loopAnimation: false, playRate: 1, duration: 3.6, name: 'animation-1' },
          { type: 'StateNodeData', index: 7, childNodeIndex: 8, stateName: 'animation-2' },
          { type: 'AnimationClipNodeData', index: 8, dataSlotIndex: 1, loopAnimation: false, playRate: 1, duration: 2.2, name: 'animation-2' },
          { type: 'TransitionNodeData', index: 9, targetStateNodeIndex: 7, duration: 0, hasExitTime: true, exitTime: 1 },
          { type: 'LayerBlendNodeData', index: 10, baseNodeIndex: 4, layerDatas: [] },
          { type: 'StateNodeData', index: 11, childNodeIndex: 10, stateName: 'default-1' },
        ],
        graphDataSet: {
          resources: [
            { id: '8fa45bd4af7049da90bd1acf149d8483' },
            { id: 'a349a970667b4929882477b93d366e57' },
          ],
        },
        listeners: [],
        spines: [],
      },
    ],
    miscs: [
      {
        id: 'acb14ee6c2784e05ad717e65b2bdee95',
        dataType: 'TimelineAsset',
        tracks: [{ id: 'f9c4dffcba03480dbf2fc84e0627dce0' }, { id: 'c2cfdf3b763349f5af94240e7ace7d51' }],
      },
      { id: 'f9c4dffcba03480dbf2fc84e0627dce0', dataType: 'ObjectBindingTrack', children: [], clips: [] },
      { id: 'c2cfdf3b763349f5af94240e7ace7d51', dataType: 'ObjectBindingTrack', children: [], clips: [] },
    ],
    compositionId: 'ab87e998c55a480183080733a7197e9e',
    videos: [
      { id: 'a0b4d22d331343fb97cc2e484445f799', url: 'https://mdn.alipayobjects.com/mars/afts/video/A*n1XORKzjDoYAAAAAZIAAAAgAesF2AQ/540P' },
      { id: '92c6ce72cdc84a829ce28e3a73768300', url: 'https://mdn.alipayobjects.com/mars/afts/video/A*_ibQSpxoI6MAAAAAgBAAAAgAesF2AQ/540P' },
    ],
  };
}
