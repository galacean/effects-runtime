/* eslint-disable @typescript-eslint/no-unused-vars */
import { BinomialTranscoder } from './transcoder/binomial-transcoder';
import { DFDTransferFunction, KTX2Container } from './ktx2-container';
import { KTX2TargetFormat, TextureFormat } from './ktx2-target-format';
import type { TranscodeResult } from './transcoder/abstract-transcoder';
import type { Engine } from '../../engine';
import { GLCapabilityType } from '../../render/gpu-capability';
import { loadBinary } from '../../downloader';
import type { Texture2DSourceOptionsCompressed, TextureDataType } from '../types';
import { TextureSourceType } from '../types';
import { glContext } from '../../gl';
import { SourceType } from '../../plugins';
export class KTX2Loader {
  private static _isBinomialInit: boolean = false;
  private static _binomialLLCTranscoder: BinomialTranscoder;
  private static _priorityFormats = {
    etc1s: [
      KTX2TargetFormat.ETC,
      KTX2TargetFormat.BC7,
      KTX2TargetFormat.ASTC,
      KTX2TargetFormat.BC1_BC3,
      KTX2TargetFormat.PVRTC,
    ],
    uastc: [
      KTX2TargetFormat.ASTC,
      KTX2TargetFormat.BC7,
      KTX2TargetFormat.ETC,
      KTX2TargetFormat.BC1_BC3,
      KTX2TargetFormat.PVRTC,
    ],
  };
  private static _capabilityMap: Partial<Record<KTX2TargetFormat, Partial<Record<DFDTransferFunction, GLCapabilityType[]>>>> = {
    [KTX2TargetFormat.ASTC]: {
      [DFDTransferFunction.linear]: [GLCapabilityType.astc, GLCapabilityType.astc_webkit],
      [DFDTransferFunction.sRGB]: [GLCapabilityType.astc, GLCapabilityType.astc_webkit],
    },
    [KTX2TargetFormat.ETC]: {
      [DFDTransferFunction.linear]: [GLCapabilityType.etc, GLCapabilityType.etc_webkit],
      [DFDTransferFunction.sRGB]: [GLCapabilityType.etc, GLCapabilityType.etc_webkit],
    },
    [KTX2TargetFormat.BC7]: {
      [DFDTransferFunction.linear]: [GLCapabilityType.bptc],
      [DFDTransferFunction.sRGB]: [GLCapabilityType.bptc],
    },
    [KTX2TargetFormat.BC1_BC3]: {
      [DFDTransferFunction.linear]: [GLCapabilityType.s3tc],
      [DFDTransferFunction.sRGB]: [GLCapabilityType.s3tc_srgb],
    },
    [KTX2TargetFormat.PVRTC]: { [DFDTransferFunction.linear]: [GLCapabilityType.pvrtc, GLCapabilityType.pvrtc_webkit] },
  };

  private static _getBinomialLLCTranscoder (workerCount: number = 4) {
    KTX2Loader._isBinomialInit = true;

    return (this._binomialLLCTranscoder ??= new BinomialTranscoder(workerCount));
  }

  static isPowerOfTwo (value: number) {
    return (value & (value - 1)) === 0 && value !== 0;
  }

  private static _decideTargetFormat (
    engine: Engine,
    ktx2Container: KTX2Container,
    priorityFormats?: KTX2TargetFormat[]
  ): KTX2TargetFormat {
    const { isSRGB, pixelWidth, pixelHeight } = ktx2Container;
    const targetFormat = this._detectSupportedFormat(engine, priorityFormats ?? [], isSRGB) as KTX2TargetFormat;

    if (
      targetFormat === KTX2TargetFormat.PVRTC &&
      (!KTX2Loader.isPowerOfTwo(pixelWidth) || !KTX2Loader.isPowerOfTwo(pixelHeight) || pixelWidth !== pixelHeight)
    ) {
      console.warn('PVRTC image need power of 2 and width===height, downgrade to RGBA8');

      return KTX2TargetFormat.R8G8B8A8;
    }

    if (targetFormat === null) {
      console.warn('Can\'t support any compressed texture, downgrade to RGBA8');

      return KTX2TargetFormat.R8G8B8A8;
    }

    return targetFormat;
  }

  private static _detectSupportedFormat (
    engine: Engine,
    priorityFormats: KTX2TargetFormat[],
    isSRGB: boolean
  ): KTX2TargetFormat | null {
    for (let i = 0; i < priorityFormats.length; i++) {
      const format = priorityFormats[i];
      const capabilities =
        this._capabilityMap[format]?.[isSRGB ? DFDTransferFunction.sRGB : DFDTransferFunction.linear];

      if (capabilities) {
        for (let j = 0; j < capabilities.length; j++) {
          if (engine.gpuCapability.canIUse(capabilities[j])) {
            return format;
          }
        }
      } else {
        switch (priorityFormats[i]) {
          case KTX2TargetFormat.R8G8B8A8:
            return format;
          case KTX2TargetFormat.R8:
          case KTX2TargetFormat.R8G8:
            if (engine.gpuCapability.isWebGL2) {return format;}
        }
      }
    }

    return null;
  }

  async initialize (engine: Engine,
    isSRGB: boolean,
    workerCount: number): Promise<void> {
    await this.load('https://mdn.alipayobjects.com/oasis_be/afts/img/A*iaD4QaUJRKoAAAAAAAAAAAAADkp5AQ/original/DefaultTexture.ktx2', engine).then(() => {}
    );

    return KTX2Loader._getBinomialLLCTranscoder(workerCount).init();
  }

  /** @internal */
  static _parseBuffer (buffer: Uint8Array, engine: Engine) {
    const ktx2Container = new KTX2Container(buffer);

    const formatPriorities = KTX2Loader._priorityFormats[ktx2Container.isUASTC ? 'uastc' : 'etc1s'];
    const targetFormat = KTX2Loader._decideTargetFormat(engine, ktx2Container, formatPriorities);

    const binomialLLCWorker = KTX2Loader._getBinomialLLCTranscoder();

    const transcodeResultPromise = binomialLLCWorker.init().then(() => binomialLLCWorker.transcode(buffer, targetFormat));

    return transcodeResultPromise.then(result => {
      return {
        ktx2Container,
        engine,
        result,
        targetFormat,
        params: ktx2Container.keyValue['GalaceanTextureParams'] as Uint8Array,
      };
    });
  }

  private static _getEngineTextureFormat (
    basisFormat: KTX2TargetFormat,
    transcodeResult: TranscodeResult
  ): TextureFormat {
    const { hasAlpha } = transcodeResult;

    switch (basisFormat) {
      case KTX2TargetFormat.ASTC:
        return TextureFormat.ASTC_4x4;
      case KTX2TargetFormat.ETC:
        return hasAlpha ? TextureFormat.ETC2_RGBA8 : TextureFormat.ETC2_RGB;
      case KTX2TargetFormat.BC7:
        return TextureFormat.BC7;
      case KTX2TargetFormat.BC1_BC3:
        return hasAlpha ? TextureFormat.BC3 : TextureFormat.BC1;
      case KTX2TargetFormat.PVRTC:
        return hasAlpha ? TextureFormat.PVRTC_RGBA4 : TextureFormat.PVRTC_RGB4;
      case KTX2TargetFormat.R8G8B8A8:
        return TextureFormat.R8G8B8A8;
    }

    return TextureFormat.R8G8B8;
  }

  /** @internal */
  static _createTextureByBuffer (
    engine: Engine,
    ktx2Container: KTX2Container,
    transcodeResult: TranscodeResult,
    targetFormat: KTX2TargetFormat,
    params?: Uint8Array,
  ) {
    const gl = glContext;
    const { width, height, faces, hasAlpha } = transcodeResult;
    const faceCount = faces.length;
    const mipmaps = faces[0];
    const mipmap = mipmaps.length > 1;
    const engineFormat = this._getEngineTextureFormat(targetFormat, transcodeResult);
    const sourceType = TextureSourceType.compressed;
    const target = faceCount === 6 ? glContext.TEXTURE_CUBE_MAP : glContext.TEXTURE_2D;
    //补充这里
    const isSRGB = ktx2Container.isSRGB;
  }

  async load (url: string, engine: Engine) {
    const buffer = new Uint8Array(await loadBinary(url));

    KTX2Loader._parseBuffer(new Uint8Array(buffer), engine)
      .then(({ ktx2Container, engine, result, targetFormat, params }) =>
        KTX2Loader._createTextureByBuffer(engine, ktx2Container, result, targetFormat, params)
      ).catch(()=>{});
  }
}