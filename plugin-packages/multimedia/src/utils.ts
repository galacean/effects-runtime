import type { SceneLoadOptions } from '@galacean/effects';
import { loadBinary, loadVideo, spec, passRenderLevel } from '@galacean/effects';

export async function processMultimedia (
  media: spec.AssetBase[],
  type: spec.MultimediaType,
  options: SceneLoadOptions,
): Promise<(HTMLVideoElement)[] | (HTMLAudioElement | AudioBuffer)[]> {
  const { renderLevel } = options;
  const jobs = media.map(medium => {
    if (passRenderLevel(medium.renderLevel, renderLevel)) {
      const url = new URL(medium.url, location.href).href;

      if (type === spec.MultimediaType.video) {
        return loadVideo(url);
      } else if (type === spec.MultimediaType.audio) {
        return loadAudio(url);
      }
    }

    throw new Error(`Invalid ${type} source: ${JSON.stringify(media)}.`);
  });

  return Promise.all(jobs);
}

/**
 * 异步加载一个音频文件
 * @param url - 音频文件的 URL 或 MediaProvider 对象
 */
export async function loadAudio (url: string): Promise<HTMLAudioElement | AudioBuffer> {
  const isSupportAudioContext = !!window['AudioContext'];

  if (isSupportAudioContext) {
    try {
      const audioContext = new AudioContext();
      const buffer = await loadBinary(url);
      const decodedData = await audioContext.decodeAudioData(buffer);

      return decodedData;
    } catch (_) {
      throw new Error(`Failed to load audio from ${url}.`);
    }
  }

  return new Promise((resolve, reject) => {
    const audio = new Audio();

    // 设置音频源
    if (typeof url === 'string') {
      audio.src = url;
    } else {
      audio.srcObject = url;
    }

    audio.muted = false;

    // 监听加载事件
    audio.addEventListener('canplaythrough', () => {
      resolve(audio);
    });

    // 监听错误事件
    audio.addEventListener('error', () => {
      reject(new Error(`Failed to load audio from ${audio.src}.`));
    });

    // 开始加载音频
    audio.load();
  });
}
