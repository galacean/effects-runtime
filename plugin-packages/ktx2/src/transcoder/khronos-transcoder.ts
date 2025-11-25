/* eslint-disable promise/no-nesting */
import type { KTX2Container } from '../ktx2-container';
import { SupercompressionScheme } from '../ktx2-container';
import type { KTX2TargetFormat } from '../ktx2-common';
import type { EncodedData, KhronosTranscoderMessage, TranscodeResult } from './texture-transcoder';
import { TextureTranscoder } from './texture-transcoder';
import { generateWorkerBlobCode, initTranscoder, transcodeData } from './khronos-workercode';
import uastcAstcWasm from '../libs/uastc_astc.wasm';
import zstddecWasm from '../libs/zstddec.wasm';

/**
 * 主线程 ASTC/UASTC 转码器
 */
class KhronosMainThreadTranscoder {
  private wasmTranscoder: any = null;
  private wasmTranscoderPromise: Promise<any> | null = null;

  async init (): Promise<void> {
    if (!this.wasmTranscoderPromise) {
      this.wasmTranscoderPromise = this.initWasm();
    }

    await this.wasmTranscoderPromise;
  }

  private async initWasm (): Promise<any> {
    const transcoderWasmModule = await uastcAstcWasm();

    this.wasmTranscoder = await initTranscoder(transcoderWasmModule);

    return this.wasmTranscoder;
  }

  async transcode (
    data: EncodedData[][],
    needZstd: boolean,
    zstddecWasmModule?: WebAssembly.Module,
  ): Promise<Array<{ width: number, height: number, data: Uint8Array }[]>> {
    if (!this.wasmTranscoder) {
      await this.init();
    }

    if (!this.wasmTranscoder) {
      throw new Error('WASM transcoder not initialized');
    }

    return transcodeData(data, needZstd, this.wasmTranscoder, zstddecWasmModule);
  }

  destroy (): void {
    this.wasmTranscoder = null;
    this.wasmTranscoderPromise = null;
  }
}

/**
 * KTX2 Khronos ASTC/UASTC 转码器
 * 支持主线程和 Worker 两种执行模式
 */
export class KhronosTranscoder extends TextureTranscoder {
  private mainThreadTranscoder: KhronosMainThreadTranscoder | null = null;
  private workerURL?: string;
  private useWorker: boolean;

  constructor (
    workerLimitCount: number,
    public readonly type: KTX2TargetFormat,
    useWorker: boolean = false,
  ) {
    super(workerLimitCount);
    this.useWorker = useWorker;
  }

  async initTranscodeWorkerPool () {
    if (!this.useWorker) {
      this.mainThreadTranscoder = new KhronosMainThreadTranscoder();
      await this.mainThreadTranscoder.init();

      return [];
    }

    const transcoderWasm = await uastcAstcWasm();
    const workerCode = generateWorkerBlobCode();
    const workerURL = URL.createObjectURL(
      new Blob([workerCode], {
        type: 'application/javascript',
      })
    );

    this.workerURL = workerURL;

    return this.createTranscodePool(workerURL, transcoderWasm);
  }

  async transcode (ktx2Container: KTX2Container): Promise<TranscodeResult> {
    const needZstd = ktx2Container.supercompressionScheme === SupercompressionScheme.Zstd;
    const levelCount = ktx2Container.levels.length;
    const faceCount = ktx2Container.faceCount;

    const encodedData: EncodedData[][] = new Array<EncodedData[]>(faceCount);

    for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
      const mipmapData = new Array(levelCount);

      for (let mipmapIndex = 0; mipmapIndex < levelCount; mipmapIndex++) {
        const level = ktx2Container.levels[mipmapIndex];
        const levelWidth = Math.floor(ktx2Container.pixelWidth / (1 << mipmapIndex)) || 1;
        const levelHeight = Math.floor(ktx2Container.pixelHeight / (1 << mipmapIndex)) || 1;
        const originBuffer = level.levelData.buffer;
        const originOffset = level.levelData.byteOffset;
        const originByteLength = level.levelData.byteLength;

        mipmapData[mipmapIndex] = {
          buffer: new Uint8Array(originBuffer, originOffset, originByteLength),
          levelWidth,
          levelHeight,
          uncompressedByteLength: level.uncompressedByteLength,
        };
      }
      encodedData[faceIndex] = mipmapData;
    }

    const zstddecWasmModule = needZstd ? await zstddecWasm() : undefined;

    // 主线程模式
    if (this.useWorker === false && this.mainThreadTranscoder) {
      const faces = await this.mainThreadTranscoder.transcode(encodedData, needZstd, zstddecWasmModule);

      return {
        width: ktx2Container.pixelWidth,
        height: ktx2Container.pixelHeight,
        hasAlpha: true,
        format: 0,
        faces,
        faceCount,
      };
    }

    // WebWorker 模式
    const postMessageData: KhronosTranscoderMessage = {
      type: 'transcode',
      format: 0,
      needZstd,
      data: encodedData,
      zstddecWasmModule,
    };

    const faces = await this.transcodeWorkerPool.postMessage(postMessageData);

    return {
      width: ktx2Container.pixelWidth,
      height: ktx2Container.pixelHeight,
      hasAlpha: true,
      format: 0,
      faces,
      faceCount,
    };
  }

  override destroy (): void {
    super.destroy();

    if (this.mainThreadTranscoder) {
      this.mainThreadTranscoder.destroy();
      this.mainThreadTranscoder = null;
    }

    if (this.workerURL) {
      URL.revokeObjectURL(this.workerURL);
      this.workerURL = undefined;
    }
  }
}

