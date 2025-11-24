import type { KTX2Container } from '../ktx2-container';
import { SupercompressionScheme } from '../ktx2-container';
import type { KTX2TargetFormat } from '../ktx2-common';
import type { EncodedData, KhronosTranscoderMessage, TranscodeResult } from './texture-transcoder';
import { TextureTranscoder } from './texture-transcoder';
import { TranscodeWorkerCode } from './khronos-workercode';
import uastcAstcWasm from '../libs/uastc_astc.wasm';
import zstddecWasm from '../libs/zstddec.wasm';

export class KhronosTranscoder extends TextureTranscoder {
  private workerURL?: string;

  constructor (
    workerLimitCount: number,
    public readonly type: KTX2TargetFormat,
  ) {
    super(workerLimitCount);
  }

  async initTranscodeWorkerPool () {
    const transcoderWasm = await uastcAstcWasm();
    const funcCode = TranscodeWorkerCode.toString();
    const workerURL = URL.createObjectURL(
      new Blob([funcCode.substring(funcCode.indexOf('{') + 1, funcCode.lastIndexOf('}'))], {
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
    const decodedData: TranscodeResult = {
      width: ktx2Container.pixelWidth,
      height: ktx2Container.pixelHeight,
      // @ts-expect-error TODO: mipmaps 类型待确认
      mipmaps: null,
    };
    const zstddecWasmModule = await zstddecWasm();

    const postMessageData: KhronosTranscoderMessage = {
      type: 'transcode',
      format: 0,
      needZstd,
      data: new Array<EncodedData[]>(faceCount),
      zstddecWasmModule,
    };

    const messageData = postMessageData.data;

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
      messageData[faceIndex] = mipmapData;
    }

    const faces = await this.transcodeWorkerPool.postMessage(postMessageData);

    decodedData.faces = faces;
    decodedData.hasAlpha = true;

    return decodedData;
  }

  override destroy (): void {
    super.destroy();

    if (this.workerURL) {
      URL.revokeObjectURL(this.workerURL);
      this.workerURL = undefined;
    }
  }
}

