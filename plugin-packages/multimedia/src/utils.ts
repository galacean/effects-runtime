import type { SceneLoadOptions } from '@galacean/effects';
import { loadBinary, loadVideo, spec, passRenderLevel, isFunction } from '@galacean/effects';
import { multimediaErrorMessageMap } from './constants';

/**
 * 处理多媒体资源加载
 * @param media - 多媒体资源数组
 * @param type - 多媒体类型（视频或音频）
 * @param options - 场景加载选项
 * @returns 加载完成的多媒体资源数组
 */
export async function processMultimedia<T> (
  media: spec.AssetBase[],
  type: spec.MultimediaType,
  options: SceneLoadOptions,
): Promise<T[]> {
  const { renderLevel } = options;
  const jobs = media.map(medium => {
    if (passRenderLevel(medium.renderLevel, renderLevel)) {
      if (type === spec.MultimediaType.video) {
        const videoURL = getVideoUrl(medium, options);
        const url = new URL(videoURL, location.href).href;

        return loadVideo(url);
      } else if (type === spec.MultimediaType.audio) {
        const url = new URL(medium.url, location.href).href;

        return loadAudio(url);
      }
    }

    throw new Error(`Invalid ${type} source: ${JSON.stringify(media)}.`);
  });

  return Promise.all(jobs) as Promise<T[]>;
}

/**
 * 判断音视频浏览器是否允许播放
 * @throws {MultimediaError} 当浏览器不允许自动播放时抛出错误
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
 * @param url - 音频文件的 URL
 * @returns 返回 AudioBuffer（如果支持 AudioContext）或 HTMLAudioElement
 * @throws {Error} 当音频加载失败时抛出错误
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

/**
 * 多媒体错误类
 */
export class MultimediaError extends Error {
  /**
   * 报错代码
   */
  code: number;

  /**
   * @param code - 错误代码
   * @param message - 错误信息
   */
  constructor (code: number, message: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;

    if ('captureStackTrace' in Error && isFunction(Error.captureStackTrace)) {
      Error.captureStackTrace(this, MultimediaError);
    }
  }
}

/**
 * 检查浏览器是否支持播放指定的 HEVC 编解码器
 * @param codec - HEVC 编解码器
 * @returns 如果浏览器可能或确定支持该编解码器，则返回 true，否则返回 false
 */
export function canPlayHevcCodec (codec: spec.HevcVideoCodec): boolean {
  const video = document.createElement('video');
  const contentType = `video/mp4; codecs="${codec}"`;
  const result = video.canPlayType(contentType);

  return result === 'probably' || result === 'maybe';
}

/**
 * 将编解码器字符串解析为 HEVC 视频编解码器枚举值
 * @param codec - 编解码器字符串（可以是枚举值或枚举名称）
 * @returns 对应的 HEVC 视频编解码器枚举值，如果无效则返回 undefined
 */
export function parseCodec (codec: string): spec.HevcVideoCodec | undefined {
  // 传入的是完整的枚举值
  if (isCodecValue(codec)) {
    return codec;
  }

  // 传入的是枚举名称
  if (isCodecKey(codec)) {
    return spec.HevcVideoCodec[codec];
  }

  return undefined;
}

/**
 * 检查给定字符串是否为有效的 HEVC 枚举值
 * @param codec - 待检查的字符串
 * @returns 如果是有效的枚举值则返回 true
 */
function isCodecValue (codec: string): codec is spec.HevcVideoCodec {
  return Object
    .keys(spec.HevcVideoCodec)
    .some(key =>
      spec.HevcVideoCodec[key as keyof typeof spec.HevcVideoCodec] as string === codec
    );
}

/**
 * 检查给定字符串是否为有效的 HEVC 枚举键名
 * @param codec - 待检查的字符串
 * @returns 如果是有效的枚举键名则返回 true
 */
function isCodecKey (codec: string): codec is keyof typeof spec.HevcVideoCodec {
  return codec in spec.HevcVideoCodec;
}

/**
 * 获取视频 URL，根据配置和浏览器能力选择最优的视频源
 * @param medium - 媒体资源对象
 * @param options - 场景加载选项
 * @returns 最优的视频 URL（优先返回 HEVC 格式，如果支持的话）
 */
function getVideoUrl (medium: spec.VideoInfo, options: SceneLoadOptions) {
  if (!options.useHevcVideo) {
    return medium.url;
  }

  const { hevc } = medium;

  if (!hevc?.url || !hevc?.codec) {
    return medium.url;
  }

  const codec = parseCodec(hevc.codec);

  return (codec && canPlayHevcCodec(codec)) ? hevc.url : medium.url;
}
