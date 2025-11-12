import { WorkerPool } from './worker-pool';

export abstract class AbstractTranscoder {
  protected transcodeWorkerPool: WorkerPool;
  protected initPromise: Promise<any>;

  constructor (public readonly workerLimitCount: number) {}

  init () {
    if (!this.initPromise) {
      this.initPromise = this.initTranscodeWorkerPool();
    }

    return this.initPromise;
  }

  destroy () {
    this.transcodeWorkerPool?.destroy();
  }

  protected abstract initTranscodeWorkerPool (): Promise<any>;

  protected createTranscodePool (workerURL: string, wasmBuffer: ArrayBuffer) {
    this.transcodeWorkerPool = new WorkerPool(this.workerLimitCount, () => {
      return new Promise<Worker>((resolve, reject) => {
        const worker = new Worker(workerURL);
        const msg: InitMessage = {
          type: 'init',
          transcoderWasm: wasmBuffer,
        };

        function onMessage (e: MessageEvent<{ error?: Error }>) {
          if (e.data.error) {
            reject(e.data.error);
          } else {
            worker.removeEventListener('message', onMessage);
            resolve(worker);
          }
        }
        worker.addEventListener('message', onMessage);
        worker.postMessage(msg);
      });
    });

    return this.transcodeWorkerPool.prepareWorker();
  }
}

type MessageType = 'init' | 'transcode';

export interface BaseMessage {
  type: MessageType,
}

export interface InitMessage extends BaseMessage {
  type: 'init',
  transcoderWasm: ArrayBuffer,
}

export interface BinomialTranscodeMessage extends BaseMessage {
  type: 'transcode',
  format: number,
  buffer: Uint8Array,
}

export type IBinomialMessage = InitMessage | BinomialTranscodeMessage;

export type TranscodeResult = {
  width: number,
  height: number,
  hasAlpha: boolean,
  format: number,
  faces: Array<{ data: Uint8Array, width: number, height: number }>[],
  faceCount: number,
};

export type TranscodeResponse = {
  id: number,
  type: 'transcoded',
} & TranscodeResult;

export interface EncodedData {
  buffer: Uint8Array,
  levelWidth: number,
  levelHeight: number,
  uncompressedByteLength: number,
}

export interface KhronosTranscoderMessage extends BaseMessage {
  type: 'transcode',
  format: number,
  needZstd: boolean,
  data: EncodedData[][],
}

export type IKhronosMessageMessage = InitMessage | KhronosTranscoderMessage;

export function decodeText (array: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(array);
  }

  // TextDecoder polyfill
  let s = '';

  for (let i = 0, il = array.length; i < il; i++) {
    s += String.fromCharCode(array[i]);
  }

  return decodeURIComponent(encodeURIComponent(s));
}
