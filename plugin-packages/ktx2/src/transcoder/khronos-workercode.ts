/* eslint-disable compat/compat */
/* eslint-disable promise/no-nesting */
import type { DecodedData, EncodedData } from './texture-transcoder';

// eslint-disable-next-line compat/compat
export interface WasmTranscoder extends WebAssembly.Exports {
  memory: WebAssembly.Memory,
  transcode: (nBlocks: number) => number,
}

export interface DecoderExports {
  memory: WebAssembly.Memory,
  ZSTD_findDecompressedSize: (compressedPtr: number, compressedSize: number) => number,
  ZSTD_decompress: (
    uncompressedPtr: number,
    uncompressedSize: number,
    compressedPtr: number,
    compressedSize: number,
  ) => number,
  malloc: (ptr: number) => number,
  free: (ptr: number) => void,
}

export interface DecoderInstance {
  readonly exports: DecoderExports,
}

/**
 * 转码核心代码
 * 主线程调用时会返回 API 对象
 * Worker 中使用时需要拼接消息处理代码
 */
export function TranscodeWorkerCode () {
  let wasmPromise: Promise<WebAssembly.Exports>;

  /**
   * ZSTD (Zstandard) decoder.
   */
  class ZSTDDecoder {
    public heap: Uint8Array = new Uint8Array(0);
    public instance: DecoderInstance | null = null;
    public importObject = {
      env: {
        emscripten_notify_memory_growth: (): void => {
          this.heap = new Uint8Array(this.instance!.exports.memory.buffer);
        },
      },
    };
    public initPromise: Promise<void> | undefined;

    init (zstddecWasmModule: WebAssembly.Module): Promise<void> {
      if (!this.initPromise) {
        this.initPromise = WebAssembly
          .instantiate(zstddecWasmModule, this.importObject)
          .then((result: WebAssembly.Instance) => {
            this.instance = result as unknown as DecoderInstance;
            this.importObject.env.emscripten_notify_memory_growth();
          });
      }

      return this.initPromise;
    }

    decode (array: Uint8Array, uncompressedSize = 0): Uint8Array {
      if (!this.instance) {
        throw new Error('ZSTDDecoder: Await .init() before decoding.');
      }

      const exports = this.instance.exports;
      const compressedSize = array.byteLength;
      const compressedPtr = exports.malloc(compressedSize);

      this.heap.set(array, compressedPtr);

      uncompressedSize = uncompressedSize || Number(exports.ZSTD_findDecompressedSize(compressedPtr, compressedSize));
      const uncompressedPtr = exports.malloc(uncompressedSize);
      const actualSize = exports.ZSTD_decompress(uncompressedPtr, uncompressedSize, compressedPtr, compressedSize);

      if (actualSize < 0) {
        exports.free(compressedPtr);
        exports.free(uncompressedPtr);
        throw new Error('ZSTDDecoder: decompression failed.');
      }

      // Read decompressed data and free WASM memory
      const dec = this.heap.slice(uncompressedPtr, uncompressedPtr + actualSize);

      exports.free(compressedPtr);
      exports.free(uncompressedPtr);

      return dec;
    }
  }

  function transcodeASTC (
    wasmTranscoder: WasmTranscoder,
    compressedData: Uint8Array,
    width: number,
    height: number,
  ) {
    const nBlocks = ((width + 3) >> 2) * ((height + 3) >> 2);
    const texMemoryPages = (nBlocks * 16 + 65535) >> 16;
    const memory = wasmTranscoder.memory;
    const delta = texMemoryPages + 1 - (memory.buffer.byteLength >> 16);

    if (delta > 0) { memory.grow(delta); }

    const textureView = new Uint8Array(memory.buffer, 65536, nBlocks * 16);

    textureView.set(compressedData);

    return wasmTranscoder.transcode(nBlocks) === 0 ? textureView : null;
  }

  function initTranscoder (transcoderWasmModule: WebAssembly.Module) {
    wasmPromise = WebAssembly
      .instantiate(transcoderWasmModule, {
        env: { memory: new WebAssembly.Memory({ initial: 16 }) },
      })
      .then(moduleWrapper => moduleWrapper.exports);

    return wasmPromise;
  }

  const zstdDecoder = new ZSTDDecoder();

  function transcode (
    data: EncodedData[][],
    needZstd: boolean,
    transcoderWasmModule: WasmTranscoder,
    zstddecWasmModule?: WebAssembly.Module,
  ) {
    const faceCount = data.length;
    const result: DecodedData[][] = new Array(faceCount);
    const decodedLevelCache = needZstd ? new Map() : undefined;
    let promise = Promise.resolve();

    if (needZstd && zstddecWasmModule) {
      void zstdDecoder.init(zstddecWasmModule);
      promise = zstdDecoder.initPromise!;
    }

    return promise.then(() => {
      for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
        const mipmapCount = data[faceIndex].length;
        const decodedData: DecodedData[] = new Array(mipmapCount);

        for (let i = 0; i < mipmapCount; i++) {
          const { buffer, levelHeight, levelWidth, uncompressedByteLength } = data[faceIndex][i];
          let levelBuffer = buffer;

          if (needZstd) {
            let decoded = decodedLevelCache?.get(i);

            if (!decoded) {
              decoded = zstdDecoder.decode(buffer.slice(), uncompressedByteLength);
              decodedLevelCache?.set(i, decoded);
            }
            levelBuffer = decoded;
          }

          const faceByteLength = levelBuffer.byteLength / faceCount;
          const originByteOffset = levelBuffer.byteOffset;
          const decodedBuffer = transcodeASTC(
            transcoderWasmModule,
            new Uint8Array(levelBuffer.buffer, originByteOffset + faceIndex * faceByteLength, faceByteLength),
            levelWidth,
            levelHeight
          );

          if (decodedBuffer) {
            decodedData[i] = {
              // use wasm memory as buffer, should slice to avoid duplicate
              data: decodedBuffer.slice(),
              width: levelWidth,
              height: levelHeight,
            };
          } else {
            throw new Error('buffer decoded error');
          }
        }
        result[faceIndex] = decodedData;
      }

      return result;
    });
  }

  // 仅在 Worker 环境中注册消息处理，避免在主线程调用时污染 window.onmessage
  // Worker 环境中没有 window 对象
  if (typeof window === 'undefined') {
    self.onmessage = function onmessage (event) {
      const message = event.data;

      switch (message.type) {
        case 'init':
          initTranscoder(message.transcoderWasm)
            .then(() => {
              self.postMessage('init-completed');
            })
            .catch(error => {
              self.postMessage({ error });
            });

          break;
        case 'transcode':
          if (!wasmPromise) {
            self.postMessage({ error: new Error('Transcoder not initialized.') });

            break;
          }

          wasmPromise
            .then(transcoderWasmModule => {
              transcode(
                message.data,
                message.needZstd,
                transcoderWasmModule as unknown as WasmTranscoder,
                message.zstddecWasmModule,
              ).then(decodedData => {
                self.postMessage(decodedData);
              }).catch(error => self.postMessage({ error }));
            })
            .catch(error => {
              self.postMessage({ error });
            });

          break;
      }
    };
  }

  // 主线程使用
  return {
    ZSTDDecoder,
    transcodeASTC,
    initTranscoder,
    zstdDecoder,
    transcode,
    getWasmPromise: () => wasmPromise,
  };
}
