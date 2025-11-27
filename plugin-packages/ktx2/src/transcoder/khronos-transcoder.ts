/* eslint-disable promise/no-nesting */
import type { KTX2Container } from '../ktx2-container';
import { SupercompressionScheme } from '../ktx2-container';
import type { KTX2TargetFormat } from '../ktx2-common';
import type { DecodedData, EncodedData, KhronosTranscoderMessage, TranscodeResult } from './texture-transcoder';
import { TextureTranscoder } from './texture-transcoder';
import type { WasmTranscoder } from './khronos-workercode';
import { TranscodeWorkerCode } from './khronos-workercode';
import uastcAstcWasm from '../libs/uastc_astc.wasm';
import zstddecWasm from '../libs/zstddec.wasm';

/**
 * 主线程 ASTC/UASTC 转码器
 */
class KhronosMainThreadTranscoder {
  private context: ReturnType<typeof TranscodeWorkerCode> | null = null;

  async init (): Promise<void> {
    if (!this.context) {
      this.context = TranscodeWorkerCode();

      const transcoderWasmModule = await uastcAstcWasm();

      await this.context.initTranscoder(transcoderWasmModule);
    }
  }

  async transcode (
    data: EncodedData[][],
    needZstd: boolean,
    zstddecWasmModule?: WebAssembly.Module,
  ): Promise<DecodedData[][]> {
    await this.init();

    const wasmModule = await this.context?.getWasmPromise() as unknown as WasmTranscoder;

    return this.context!.transcode(data, needZstd, wasmModule, zstddecWasmModule);
  }

  destroy (): void {
    this.context = null;
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
    useWorker = false,
  ) {
    super(workerLimitCount);
    this.useWorker = useWorker;
  }

  async initTranscodeWorkerPool () {
    // 主线程模式
    if (!this.useWorker) {
      this.mainThreadTranscoder = new KhronosMainThreadTranscoder();
      await this.mainThreadTranscoder.init();

      return [];
    }

    // Worker 模式
    const transcoderWasm = await uastcAstcWasm();
    const funcCode = TranscodeWorkerCode.toString();
    const funcBody = funcCode.substring(funcCode.indexOf('{') + 1, funcCode.lastIndexOf('}'));

    // 移除主线程的 return 语句，添加 Worker 消息处理
    const returnIndex = funcBody.lastIndexOf('return {');
    const workerCode = funcBody.substring(0, returnIndex);

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

    // 准备编码数据
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

    let faces: Array<{ width: number, height: number, data: Uint8Array }[]>;

    // 主线程模式
    if (!this.useWorker && this.mainThreadTranscoder) {
      faces = await this.mainThreadTranscoder.transcode(encodedData, needZstd, zstddecWasmModule);
    } else {
      // WebWorker 模式
      const postMessageData: KhronosTranscoderMessage = {
        type: 'transcode',
        format: 0,
        needZstd,
        data: encodedData,
        zstddecWasmModule,
      };

      faces = await this.transcodeWorkerPool.postMessage(postMessageData);
    }

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

