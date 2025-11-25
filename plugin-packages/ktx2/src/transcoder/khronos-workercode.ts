import type { EncodedData } from './texture-transcoder';

// eslint-disable-next-line compat/compat
export interface WasmTranscoder extends WebAssembly.Exports {
  memory: WebAssembly.Memory,
  transcode: (nBlocks: number) => number,
}

export interface DecoderExports {
  memory: Uint8Array,

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
 * ZSTD (Zstandard) decoder.
 */
export class ZSTDDecoder {
  public static heap: Uint8Array;
  public static IMPORT_OBJECT = {
    env: {
      emscripten_notify_memory_growth: function (): void {
        ZSTDDecoder.heap = new Uint8Array(ZSTDDecoder.instance.exports.memory.buffer);
      },
    },
  };
  public static instance: DecoderInstance;
  public initPromise: Promise<any>;

  init (zstddecWasmModule: WebAssembly.Module): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = WebAssembly
        .instantiate(zstddecWasmModule, ZSTDDecoder.IMPORT_OBJECT)
        .then(this.initInstance);
    }

    return this.initPromise;
  }

  initInstance (result: WebAssembly.Instance): void {
    ZSTDDecoder.instance = result as unknown as DecoderInstance;
    ZSTDDecoder.IMPORT_OBJECT.env.emscripten_notify_memory_growth(); // initialize heap.
  }

  decode (array: Uint8Array, uncompressedSize = 0): Uint8Array {
    if (!ZSTDDecoder.instance) {
      throw new Error('ZSTDDecoder: Await .init() before decoding.');
    }

    const exports = ZSTDDecoder.instance.exports;

    // Write compressed data into WASM memory
    const compressedSize = array.byteLength;
    const compressedPtr = exports.malloc(compressedSize);

    ZSTDDecoder.heap.set(array, compressedPtr);

    // Decompress into WASM memory
    uncompressedSize = uncompressedSize || Number(exports.ZSTD_findDecompressedSize(compressedPtr, compressedSize));
    const uncompressedPtr = exports.malloc(uncompressedSize);
    const actualSize = exports.ZSTD_decompress(uncompressedPtr, uncompressedSize, compressedPtr, compressedSize);

    if (actualSize < 0) {
      exports.free(compressedPtr);
      exports.free(uncompressedPtr);
      throw new Error('ZSTDDecoder: decompression failed.');
    }
    // Read decompressed data and free WASM memory
    const dec = ZSTDDecoder.heap.slice(uncompressedPtr, uncompressedPtr + actualSize);

    exports.free(compressedPtr);
    exports.free(uncompressedPtr);

    return dec;
  }
}

export function transcodeASTC (
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

export async function initTranscoder (transcoderWasmModule: WebAssembly.Module): Promise<WasmTranscoder> {
  // eslint-disable-next-line compat/compat
  const moduleWrapper = await WebAssembly.instantiate(transcoderWasmModule, {
    // eslint-disable-next-line compat/compat
    env: { memory: new WebAssembly.Memory({ initial: 16 }) },
  });

  return moduleWrapper.exports as WasmTranscoder;
}

export async function transcodeData (
  data: EncodedData[][],
  needZstd: boolean,
  transcoderWasmModule: WasmTranscoder,
  zstddecWasmModule?: WebAssembly.Module,
): Promise<Array<{ width: number, height: number, data: Uint8Array }[]>> {
  const zstdDecoder = new ZSTDDecoder();
  const faceCount = data.length;
  const result = new Array<{
    width: number,
    height: number,
    data: Uint8Array,
  }[]>(faceCount);
  const decodedLevelCache = needZstd ? new Map<number, Uint8Array>() : undefined;

  if (needZstd && zstddecWasmModule) {
    await zstdDecoder.init(zstddecWasmModule);
  }

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    const mipmapCount = data[faceIndex].length;
    const decodedData = new Array<{
      width: number,
      height: number,
      data: Uint8Array,
    }>(mipmapCount);

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
}

/**
 * 生成 Worker Blob 完整代码的辅助函数。
 */
export function generateWorkerBlobCode (): string {
  return `
// ZSTDDecoder class
class ZSTDDecoder {
  static heap;
  static IMPORT_OBJECT = {
    env: {
      emscripten_notify_memory_growth: function () {
        ZSTDDecoder.heap = new Uint8Array(ZSTDDecoder.instance.exports.memory.buffer);
      },
    },
  };
  static instance;
  initPromise;

  init (zstddecWasmModule) {
    if (!this.initPromise) {
      this.initPromise = WebAssembly
        .instantiate(zstddecWasmModule, ZSTDDecoder.IMPORT_OBJECT)
        .then((result) => this.initInstance(result));
    }

    return this.initPromise;
  }

  initInstance (result) {
    ZSTDDecoder.instance = result;
    ZSTDDecoder.IMPORT_OBJECT.env.emscripten_notify_memory_growth();
  }

  decode (array, uncompressedSize = 0) {
    if (!ZSTDDecoder.instance) {
      throw new Error('ZSTDDecoder: Await .init() before decoding.');
    }

    const exports = ZSTDDecoder.instance.exports;
    const compressedSize = array.byteLength;
    const compressedPtr = exports.malloc(compressedSize);

    ZSTDDecoder.heap.set(array, compressedPtr);

    uncompressedSize = uncompressedSize || Number(exports.ZSTD_findDecompressedSize(compressedPtr, compressedSize));
    const uncompressedPtr = exports.malloc(uncompressedSize);
    const actualSize = exports.ZSTD_decompress(uncompressedPtr, uncompressedSize, compressedPtr, compressedSize);
    
    if (actualSize < 0) {
      exports.free(compressedPtr);
      exports.free(uncompressedPtr);
      throw new Error('ZSTDDecoder: decompression failed');
    }
    const dec = ZSTDDecoder.heap.slice(uncompressedPtr, uncompressedPtr + actualSize);

    exports.free(compressedPtr);
    exports.free(uncompressedPtr);

    return dec;
  }
}

// transcodeASTC function
function transcodeASTC (wasmTranscoder, compressedData, width, height) {
  const nBlocks = ((width + 3) >> 2) * ((height + 3) >> 2);
  const texMemoryPages = (nBlocks * 16 + 65535) >> 16;
  const memory = wasmTranscoder.memory;
  const delta = texMemoryPages + 1 - (memory.buffer.byteLength >> 16);

  if (delta > 0) { memory.grow(delta); }

  const textureView = new Uint8Array(memory.buffer, 65536, nBlocks * 16);

  textureView.set(compressedData);

  return wasmTranscoder.transcode(nBlocks) === 0 ? textureView : null;
}

// initTranscoder function
async function initTranscoder (transcoderWasmModule) {
  const moduleWrapper = await WebAssembly.instantiate(transcoderWasmModule, {
    env: { memory: new WebAssembly.Memory({ initial: 16 }) },
  });

  return moduleWrapper.exports;
}

// transcodeData function
async function transcodeData (data, needZstd, transcoderWasmModule, zstddecWasmModule) {
  const zstdDecoder = new ZSTDDecoder();
  const faceCount = data.length;
  const result = new Array(faceCount);
  const decodedLevelCache = needZstd ? new Map() : undefined;

  if (needZstd && zstddecWasmModule) {
    await zstdDecoder.init(zstddecWasmModule);
  }

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    const mipmapCount = data[faceIndex].length;
    const decodedData = new Array(mipmapCount);

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
}

// Worker message handler
const context = { wasmPromise: undefined };

self.onmessage = function onmessage (event) {
  const message = event.data;

  switch (message.type) {
    case 'init':
      context.wasmPromise = initTranscoder(message.transcoderWasm)
        .then((wasm) => {
          self.postMessage('init-completed');
          return wasm;
        })
        .catch((error) => {
          self.postMessage({ error });
          throw error;
        });

      break;
    case 'transcode':
      if (!context.wasmPromise) {
        self.postMessage({ error: new Error('Transcoder not initialized. Call init first.') });
        break;
      }

      context.wasmPromise
        .then((transcoderWasmModule) => {
          return transcodeData(message.data, message.needZstd, transcoderWasmModule, message.zstddecWasmModule);
        })
        .then((decodedData) => {
          self.postMessage(decodedData);
        })
        .catch((error) => self.postMessage({ error }));

      break;
  }
};
  `;
}
