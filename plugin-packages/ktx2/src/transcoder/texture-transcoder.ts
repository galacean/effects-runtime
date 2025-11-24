import { WorkerPool } from './worker-pool';

export abstract class TextureTranscoder {
  protected transcodeWorkerPool: WorkerPool;
  protected initPromise: Promise<Worker[]>;

  constructor (
    public readonly workerLimitCount: number,
  ) { }

  init () {
    if (!this.initPromise) {
      this.initPromise = this.initTranscodeWorkerPool();
    }

    return this.initPromise;
  }

  destroy () {
    this.transcodeWorkerPool?.destroy();
  }

  protected abstract initTranscodeWorkerPool (): Promise<Worker[]>;

  protected createTranscodePool (workerURL: string, transcoderWasm: WebAssembly.Module) {
    this.transcodeWorkerPool = new WorkerPool(this.workerLimitCount, () => {
      return new Promise<Worker>((resolve, reject) => {
        const worker = new Worker(workerURL);
        const msg: InitMessage = {
          type: 'init',
          transcoderWasm,
        };
        const cleanup = () => {
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
        };

        function onMessage (e: MessageEvent<{ error?: Error }>) {
          if (e.data.error) {
            reject(e.data.error);
          } else {
            worker.removeEventListener('message', onMessage);
            resolve(worker);
          }
        }
        function onError (e: ErrorEvent) {
          cleanup();
          worker.terminate();
          reject(e.error ?? new Error(e.message || 'Worker init error'));
        }
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
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
  transcoderWasm: WebAssembly.Module,
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
  zstddecWasmModule?: WebAssembly.Module,
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
