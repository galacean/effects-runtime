import { isAndroid } from './utils';

type SuccessHandler<T> = (data: T) => void;
type ErrorHandler = (status: number, responseText: string) => void;
/**
 *
 */
type VideoLoadOptions = {
  /**
   * 视频是否循环播放
   */
  loop?: boolean,
};

/**
 * JSON 值，它可以是字符串、数字、布尔值、对象或者 JSON 值的数组。
 *
 * @typedef {string | number | boolean | {[key: string]: JSONValue} | JSONValue[]} JSONValue
 */
export type JSONValue =
  | string
  | number
  | boolean
  | { [key: string]: JSONValue }
  | JSONValue[];

/**
 * 负责下载各种资源，并提供了一些异步加载和缓存管理的功能
 */
export class Downloader {
  /**
   * 存储多个回调函数的对象
   */
  private callbacks: Record<string, Function[]> = {};

  /**
   * 下载一个 JSON 文件
   * @param url - 要下载的 JSON 文件的 URL
   * @param onSuccess - 下载成功后的回调函数
   * @param onError - 下载失败后的回调函数
   */
  downloadJSON (url: string, onSuccess: SuccessHandler<JSONValue>, onError: ErrorHandler) {
    this.download(url, 'json', onSuccess, onError);
  }

  /**
   * 下载一个二进制文件
   * @param url - 要下载的二进制文件的 URL
   * @param onSuccess - 下载成功后的回调函数
   * @param onError - 下载失败后的回调函数
   */
  downloadBinary (url: string, onSuccess: SuccessHandler<ArrayBuffer>, onError: ErrorHandler) {
    this.download(url, 'arraybuffer', onSuccess, onError);
  }

  /**
   * 下载一个 Blob 文件
   * @param url - 要下载的 Blob 文件的 URL
   * @param onSuccess - 下载成功后的回调函数
   * @param onError - 下载失败后的回调函数
   */
  downloadBlob (url: string, onSuccess: SuccessHandler<Blob>, onError: ErrorHandler) {
    this.download(url, 'blob', onSuccess, onError);
  }

  private download (url: string, responseType: XMLHttpRequestResponseType = 'json', onSuccess: SuccessHandler<any>, onError: ErrorHandler) {
    if (this.start(url, onSuccess, onError)) {
      return;
    }

    const xhr = new XMLHttpRequest();
    const handleError = () => {
      this.finish(url, xhr.status, xhr.response);
    };
    const handleLoad = () => {
      if (xhr.status == 200 || xhr.status == 0) {
        this.finish(url, 200, xhr.response);
      } else {
        handleError();
      }
    };

    xhr.responseType = responseType;
    xhr.addEventListener('load', handleLoad);
    xhr.addEventListener('error', handleError);
    xhr.open('GET', url, true);
    xhr.send();
  }

  private start (url: string, onSuccess: SuccessHandler<any>, onError: ErrorHandler) {
    let callbacks = this.callbacks[url];

    try {
      if (callbacks) { return true; }
      this.callbacks[url] = callbacks = [];
    } finally {
      callbacks.push(onSuccess, onError);
    }
  }

  private finish (url: string, status: number, data: any) {
    const callbacks = this.callbacks[url];

    delete this.callbacks[url];
    const args = status == 200 || status == 0 ? [data] : [status, data];

    for (let i = args.length - 1, n = callbacks.length; i < n; i += 2) {
      callbacks[i].apply(null, args);
    }
  }
}

let webPFailed = false;

/**
 * 异步加载一个 WebP 图片文件，如果不支持 WebP，则加载 PNG 图片文件
 * @param png - PNG 图片文件的 URL
 * @param webp - WebP 图片文件的 URL
 */
export async function loadWebPOptional (png: string, webp?: string) {
  if (webPFailed || !webp) {
    const image = await loadImage(png);

    return { image, url: png };
  }

  try {
    const image = await loadImage(webp);

    return { image, url: webp };
  } catch (e) {
    webPFailed = true;
    const image = await loadImage(png);

    return { image, url: png };
  }
}

/**
 * 异步加载一个图片文件
 * @param source - 图片文件的 URL、Blob 或 HTMLImageElement 对象
 */
export async function loadImage (
  source: string | Blob | HTMLImageElement,
): Promise<HTMLImageElement> {
  let url = '';
  let revokeURL: boolean;

  // 1. string | Blob | HTMLImageElement 处理逻辑
  if (source instanceof HTMLImageElement) {
    if (source.complete) {
      return source;
    }
    url = source.src;
  } else if (source instanceof Blob) {
    url = URL.createObjectURL(source);
    revokeURL = true;
  } else if (typeof source === 'string') {
    url = source;
  }

  // 2. 非法类型
  if (!url) {
    throw new Error(`Invalid url type: ${JSON.stringify(source)}`);
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();

    if (!/^data:/.test(url)) {
      img.crossOrigin = '*';
    }
    img.onload = () => {
      img.onload = null;
      if (revokeURL) {
        URL.revokeObjectURL(url);
      }

      return resolve(img);
    };
    img.onerror = e => {
      img.onerror = null;
      if (revokeURL) {
        URL.revokeObjectURL(url);
      }

      return reject(`Load image fail: ${JSON.stringify(e)}`);
    };
    img.src = url;
  });

}

/**
 * 异步加载一个二进制文件
 * @param url - 二进制文件的 URL
 */
export async function loadBinary (url: string): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    new Downloader().downloadBinary(
      url,
      resolve,
      (status, responseText) => {
        reject(`Couldn't load bins ${url}: status ${status}, ${responseText}`);
      });
  });
}

/**
 * 异步加载一个 Blob 文件
 * @param url - Blob 文件的 URL
 */
export async function loadBlob (url: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    new Downloader().downloadBlob(
      url,
      resolve,
      (status, responseText) => {
        reject(`Couldn't load blob ${url}: status ${status}, ${responseText}`);
      });
  });
}

/**
 * 异步加载一个视频文件
 * @param url - 视频文件的 URL 或 MediaProvider 对象
 * @param options - 加载参数
 */
export async function loadVideo (url: string | MediaProvider, options: VideoLoadOptions = {}): Promise<HTMLVideoElement> {
  const video = document.createElement('video');

  if (typeof url === 'string') {
    video.src = url;
  } else {
    video.srcObject = url;
  }
  video.crossOrigin = 'anonymous';
  video.muted = true;
  if (options.loop) {
    video.addEventListener('ended', () => video.play());
  }
  if (isAndroid()) {
    video.setAttribute('renderer', 'standard');
  }
  video.setAttribute('playsinline', 'playsinline');

  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const pending = video.play();

    if (pending) {
      void pending.then(() => resolve(video));
    } else {
      video.addEventListener('loadeddata', function listener () {
        resolve(video);
        video.removeEventListener('loadeddata', listener);
      }, true);
    }
    video.addEventListener('error', e => {
      reject(e);
    });
  });
}
