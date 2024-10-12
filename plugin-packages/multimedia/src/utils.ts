import type { SceneLoadOptions } from '@galacean/effects';
import { loadBinary, loadVideo, spec, passRenderLevel, isFunction } from '@galacean/effects';
import { multimediaErrorMessageMap } from './constants';

export async function processMultimedia<T> (
  media: spec.AssetBase[],
  type: spec.MultimediaType,
  options: SceneLoadOptions,
): Promise<T[]> {
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

  return Promise.all(jobs) as Promise<T[]>;
}

/**
 * 判断音视频浏览器是否允许播放
 */
export async function checkAutoplayPermission () {
  const audio = document.createElement('audio');

  // src 为长度为 0.1s 的音频片段
  audio.src = 'data:audio/mpeg;base64,//uQxAACFCEW8uewc8Nfu50FhJuQAGAFJCAhaIHoMhfEnBzixrwNsCGGGmyeCECGGRKWwnB0MkzGh6Hn7JLEstwCADQsJwBAAAOOhOAGAcd0gJgTBuW7HBgJBgfvEgCAEBEiOyeTDxyiyjZLEsRDyEzMz+921nJyWJZn6w8P1769e/AYCQI6tIJAkGHL16zpxhY5VeYGCdd3/93d9w4tygIO/4IHBOD8Hz/4f+IDkEHU4n8PqBMMBCQ0iXWYFnCIGqooaZHfRqOrgxuOtjmpCJCaYjmQqDz3NJUBTFWK4soYEoCumIJzIBldNhLUmAaDzhggZmSAkr9SqAIjGJFGEMCQlIPKDMuo24qZIrKDONHWGqlZbOymMy2yhCoBQywFQAgBEsETW0hCoIkqQWBINPWa3rCoEg1MiBIEiZMUiklyMfKVqoUOxIkSMtVTMzOMSBiKJQMAiWyROrf/5mq//8mkknNBQlFjiJFHKqqr//1VV6qq3vNVVbJpFHXkijM+pIoy1VX7zPOJEkmJAJaYgpqKBgASEAAIAAAAAAAAAAAA//uSxAAD1p0iZiw9OIgAADSAAAAEYAwFApgokRqIFjigukAADJhFjIUGoGFlRAycQGC5QsJJRWdRZRVWZVNYBStcjsRuaiMSgmOQOvVAKBSBY4ygsJGDCEoUEWrE3NBfUyJSSTTiPMpDUUvrhTsC7XR/G6bx2nse52G+cjBDhQW5tan7IZREJY6ULlDpCIhCIhkPDYgFaN2//3JZVZVY6UXQO2NXV1u//P/KSqyqSai7GFdu0DEqoheCVpA1v///6qqaaaYRKqIGKpiCmooGABIQAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
  audio.muted = true;
  audio.crossOrigin = 'anonymous';

  try {
    await audio.play();
  } catch (_) {
    throw new MultimediaError(2000, multimediaErrorMessageMap[2000]);
  }
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

export class MultimediaError extends Error {
  /**
   * 报错代码
   */
  code: number;

  constructor (code: number, message: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;

    if ('captureStackTrace' in Error && isFunction(Error.captureStackTrace)) {
      Error.captureStackTrace(this, MultimediaError);
    }
  }
}
