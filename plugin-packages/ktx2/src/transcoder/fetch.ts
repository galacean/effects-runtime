import { Downloader } from '@galacean/effects';

const downloader = new Downloader();

export function loadWasm (url: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    downloader.downloadBinary(
      url,
      resolve,
      (status, responseText) => {
        reject(`Couldn't load wasm ${JSON.stringify(url)}: status ${status}, ${responseText}`);
      });
  });
}

export function loadScript (url: string) {
  return new Promise<string>((resolve, reject) => {
    downloader.downloadText(
      url,
      resolve,
      (status, responseText) => {
        reject(`Couldn't load script ${JSON.stringify(url)}: status ${status}, ${responseText}`);
      });
  });
}
