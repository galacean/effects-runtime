import type { IBinomialMessage, TranscodeResult } from './abstract-transcoder';

/** @internal */
export function TranscodeWorkerCode () {
  let initPromise: any;

  const init = function (wasmBinary?: ArrayBuffer | undefined) {
    if (!initPromise) {
      initPromise = new Promise((resolve, reject) => {
        const BasisModule = {
          wasmBinary,
          onRuntimeInitialized: () => resolve(BasisModule),
          onAbort: reject,
        };

        (self as any)['BASIS'](BasisModule);
      }).then((BasisModule: any) => {
        BasisModule.initializeBasis();

        return BasisModule.KTX2File;
      });
    }

    return initPromise;
  };

  self.onmessage = function onmessage (event: MessageEvent<IBinomialMessage>) {
    const message = event.data;

    switch (message.type) {
      case 'init':
        init(message.transcoderWasm)
          .then(() => {
            self.postMessage('init-completed');
          })
          .catch((e: any) => self.postMessage({ error: e }));

        break;
      case 'transcode':
        init()
          .then((KTX2File: any) => {
            const result = transcode(message.buffer, message.format, KTX2File);

            // @ts-expect-error
            result.type = 'transcoded';
            self.postMessage(result);
          })
          .catch((e: any) => self.postMessage({ error: e }));

        break;
    }
  };
}

export const _init = function init () {
  let initPromise: any;

  return function init (wasmBinary?: ArrayBuffer) {
    if (!initPromise) {
      initPromise = new Promise((resolve, reject) => {
        const BasisModule = {
          wasmBinary,
          onRuntimeInitialized: () => resolve(BasisModule),
          onAbort: reject,
        };

        (self as any)['BASIS'](BasisModule);
      }).then((BasisModule: any) => {
        BasisModule.initializeBasis();

        return BasisModule.KTX2File;
      });
    }

    return initPromise;
  };
};

export const init = _init();

export function transcode (buffer: Uint8Array, targetFormat: any, KTX2File: any): TranscodeResult {
  enum BasisFormat {
    ETC1 = 0,
    ETC2 = 1,
    PVRTC1_4_RGB = 8,
    PVRTC1_4_RGBA = 9,
    ASTC_4x4 = 10,
    RGBA8 = 13
  }

  enum TargetFormat {
    ASTC,
    PVRTC,
    ETC,
    R8,
    RG8,
    RGBA8
  }

  function getTranscodeFormatFromTarget (target: TargetFormat, hasAlpha: boolean) {
    switch (target) {
      case TargetFormat.ETC:
        return hasAlpha ? BasisFormat.ETC2 : BasisFormat.ETC1;
      case TargetFormat.PVRTC:
        return hasAlpha ? BasisFormat.PVRTC1_4_RGBA : BasisFormat.PVRTC1_4_RGB;
      case TargetFormat.RGBA8:
        return BasisFormat.RGBA8;
      case TargetFormat.ASTC:
        return BasisFormat.ASTC_4x4;
    }
  }

  function concat (arrays: Uint8Array[]) {
    if (arrays.length === 1) {return arrays[0];}
    let totalByteLength = 0;

    for (let i = 0; i < arrays.length; i++) {
      totalByteLength += arrays[i].byteLength;
    }

    const result = new Uint8Array(totalByteLength);

    let byteOffset = 0;

    for (let i = 0; i < arrays.length; i++) {
      result.set(arrays[i], byteOffset);
      byteOffset += arrays[i].byteLength;
    }

    return result;
  }
  const ktx2File = new KTX2File(new Uint8Array(buffer));

  function cleanup () {
    ktx2File.close();
    ktx2File.delete();
  }

  if (!ktx2File.isValid()) {
    cleanup();
    throw new Error('Invalid or unsupported .ktx2 file');
  }

  if (!ktx2File.startTranscoding()) {
    cleanup();
    throw new Error('KTX2 startTranscoding failed');
  }

  const width: number = ktx2File.getWidth();
  const height: number = ktx2File.getHeight();
  const layerCount = ktx2File.getLayers() || 1;
  const levelCount = ktx2File.getLevels();
  const hasAlpha = ktx2File.getHasAlpha();
  const faceCount = ktx2File.getFaces();
  const format = getTranscodeFormatFromTarget(targetFormat, hasAlpha);
  const faces = new Array(faceCount);

  for (let face = 0; face < faceCount; face++) {
    const mipmaps = new Array(levelCount);

    for (let mip = 0; mip < levelCount; mip++) {
      const layerMips: Uint8Array[] = new Array(layerCount);
      let mipWidth: number = 0, mipHeight: number = 0;

      for (let layer = 0; layer < layerCount; layer++) {
        const levelInfo = ktx2File.getImageLevelInfo(mip, layer, face);

        mipWidth = levelInfo.origWidth;
        mipHeight = levelInfo.origHeight;

        const dst = new Uint8Array(ktx2File.getImageTranscodedSizeInBytes(mip, layer, 0, format));

        const status = ktx2File.transcodeImage(dst, mip, layer, face, format, 0, -1, -1);

        if (!status) {
          cleanup();
          throw new Error('transcodeImage failed.');
        }
        layerMips[layer] = dst;
      }

      mipmaps[mip] = {
        data: concat(layerMips),
        width: mipWidth,
        height: mipHeight,
      };
    }
    faces[face] = mipmaps;
  }

  cleanup();

  return {
    faces,
    width,
    height,
    hasAlpha,
    faceCount: faceCount,
    format: format!,
  };
}
