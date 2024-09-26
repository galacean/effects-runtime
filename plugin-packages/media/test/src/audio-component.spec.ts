import { spec } from '@galacean/effects';
import { generateGUID, Player } from '@galacean/effects';
import { AudioComponent } from '@galacean/effects-plugin-media';

export interface AudioCompositionOptions {
  duration: number,
  endBehavior: spec.EndBehavior,
  audios: spec.AssetBaseOptions[],
  start: number,
  options: spec.AudioContentOptions,
}

const { expect } = chai;
const player = new Player({
  canvas: document.createElement('canvas'),
});

describe('audioComponent ', function () {
  it('audioComponent:create', async function () {
    const id = generateGUID();
    const options: AudioCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      audios: [{ id, url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr' }],
      start: 0,
      options: { audio: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const audio = composition.getItemByName('audio');

    if (!audio) { throw new Error('audio is null'); }
    expect(audio.endBehavior).to.equal(options.endBehavior);
    expect(audio.duration).to.equal(options.duration);
    expect(audio.start).to.equal(options.start);
    const audioComponent = audio.getComponent<AudioComponent>(AudioComponent);

    expect(audioComponent).to.be.instanceOf(AudioComponent);
    composition.dispose();
  });

  it('audioComponent:destroy', async function () {
    const id = generateGUID();
    const options: AudioCompositionOptions = {
      duration: 3,
      endBehavior: spec.EndBehavior.destroy,
      audios: [{ id, url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr' }],
      start: 0,
      options: { audio: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);

    player.gotoAndPlay(4);
    const audio = composition.getItemByName('audio');

    if (!audio) { throw new Error('audio is null'); }
    const audioComponent = audio.getComponent<AudioComponent>(AudioComponent);

    expect(audioComponent).to.be.instanceOf(AudioComponent);
    expect(audioComponent.enabled).to.be.false;
    composition.dispose();

  });

  it('audioComponent:setVolume', async function () {
    const id = generateGUID();
    const options: AudioCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      audios: [{ id, url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr' }],
      start: 0,
      options: { audio: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const audio = composition.getItemByName('audio');

    if (!audio) { throw new Error('audio is null'); }
    expect(audio.endBehavior).to.equal(options.endBehavior);
    expect(audio.duration).to.equal(options.duration);
    expect(audio.start).to.equal(options.start);
    const audioComponent = audio.getComponent<AudioComponent>(AudioComponent);

    expect(audioComponent).to.be.instanceOf(AudioComponent);
    audioComponent.setVolume(0.5);
    expect(audioComponent.audioPlayer.audioSourceInfo.gainNode?.gain.value).to.equal(0.5);
    composition.dispose();
  });

  it('audioComponent:setMuted', async function () {
    const id = generateGUID();
    const options: AudioCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      audios: [{ id, url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr' }],
      start: 0,
      options: { audio: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const audio = composition.getItemByName('audio');

    if (!audio) { throw new Error('audio is null'); }
    expect(audio.endBehavior).to.equal(options.endBehavior);
    expect(audio.duration).to.equal(options.duration);
    expect(audio.start).to.equal(options.start);
    const audioComponent = audio.getComponent<AudioComponent>(AudioComponent);

    expect(audioComponent).to.be.instanceOf(AudioComponent);
    audioComponent.setMuted(false);
    expect(audioComponent.audioPlayer.audioSourceInfo.gainNode?.gain.value).to.equal(1);
    composition.dispose();
  });

  it('audioComponent:setLoop', async function () {
    const id = generateGUID();
    const options: AudioCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      audios: [{ id, url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr' }],
      start: 0,
      options: { audio: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const audio = composition.getItemByName('audio');

    if (!audio) { throw new Error('audio is null'); }
    expect(audio.endBehavior).to.equal(options.endBehavior);
    expect(audio.duration).to.equal(options.duration);
    expect(audio.start).to.equal(options.start);
    const audioComponent = audio.getComponent<AudioComponent>(AudioComponent);

    expect(audioComponent).to.be.instanceOf(AudioComponent);
    audioComponent.setLoop(true);
    expect(audioComponent.audioPlayer.audioSourceInfo.source?.loop).to.equal(true);
    composition.dispose();
  });

  it('audioComponent:setPlaybackRate', async function () {
    const id = generateGUID();
    const options: AudioCompositionOptions = {
      duration: 10,
      endBehavior: spec.EndBehavior.destroy,
      audios: [{ id, url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr' }],
      start: 0,
      options: { audio: { id } },
    };
    const videoJson = getVideoJson(options);
    const composition = await player.loadScene(videoJson);
    const audio = composition.getItemByName('audio');

    if (!audio) { throw new Error('audio is null'); }
    expect(audio.endBehavior).to.equal(options.endBehavior);
    expect(audio.duration).to.equal(options.duration);
    expect(audio.start).to.equal(options.start);
    const audioComponent = audio.getComponent<AudioComponent>(AudioComponent);

    expect(audioComponent).to.be.instanceOf(AudioComponent);
    audioComponent.setPlaybackRate(2);
    expect(audioComponent.audioPlayer.audioSourceInfo.source?.playbackRate.value).to.equal(2);
    composition.dispose();
  });
});

function getVideoJson (options: AudioCompositionOptions) {
  return {
    playerVersion: { web: '2.0.4', native: '0.0.1.202311221223' },
    images: [],
    fonts: [],
    version: '3.0',
    shapes: [],
    plugins: [],
    audios: options.audios,
    type: 'ge',
    compositions: [
      {
        id: '5',
        name: 'audioTest',
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
        dataType: 'AudioComponent',
        options: options.options,
      },
    ],
    geometries: [],
    materials: [],
    items: [
      {
        id: '147e873c89b34c6f96108ccc4d6e6f83',
        name: 'audio',
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
    textures: [],
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
