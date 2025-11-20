import { getConfig } from '@galacean/effects';
import type { KTX2TargetFormat } from '../ktx2-common';
import type { TranscodeResult } from './texture-transcoder';
import { TextureTranscoder } from './texture-transcoder';
import { TranscodeWorkerCode, init, transcode, _init } from './binomial-workercode';
import { BASIS_TRANSCODER_JS, BASIS_TRANSCODER_WASM } from '../constants';
import { loadScript, loadWasm } from './fetch';

export class BinomialLLCTranscoder extends TextureTranscoder {
  private blobURL?: string;
  private scriptElement?: HTMLScriptElement;

  constructor (workerLimitCount: number) {
    super(workerLimitCount);
  }

  async initTranscodeWorkerPool () {
    const [jsCode, wasmBuffer] = await Promise.all([
      loadScript(getConfig(BASIS_TRANSCODER_JS)),
      loadWasm(getConfig(BASIS_TRANSCODER_WASM)),
    ]);

    if (this.workerLimitCount === 0) {
      // 使用主线程
      return new Promise<any>((resolve, reject) => {
        const scriptDom = document.createElement('script');
        const blobURL = URL.createObjectURL(new Blob([jsCode], { type: 'application/javascript' }));

        this.blobURL = blobURL;
        this.scriptElement = scriptDom;

        scriptDom.src = blobURL;
        document.body.appendChild(scriptDom);

        scriptDom.onload = () => {
          init(wasmBuffer).then(() => {
            URL.revokeObjectURL(blobURL);
            this.blobURL = undefined;
            resolve(null);
          }).catch((err: any) => {
            this.cleanup();
            reject(err);
          });
        };

        scriptDom.onerror = () => {
          this.cleanup();
          reject(new Error('Failed to load transcoder script'));
        };
      });
    } else {
      // 使用 Worker
      const funcCode = TranscodeWorkerCode.toString();
      const transcodeString = funcCode.substring(funcCode.indexOf('{'), funcCode.lastIndexOf('}') + 1);

      const workerCode = `
        ${jsCode}
        ${transcode.toString()}
        ${transcodeString}
        `;

      const workerURL = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));

      this.blobURL = workerURL;

      return this.createTranscodePool(workerURL, wasmBuffer);
    }
  }

  transcode (buffer: Uint8Array, format: KTX2TargetFormat): Promise<TranscodeResult> {
    if (this.workerLimitCount === 0) {
      return init().then((KTX2File: any) => transcode(buffer, format, KTX2File));
    } else {
      return this.transcodeWorkerPool.postMessage({
        buffer,
        format,
        type: 'transcode',
      });
    }
  }

  private cleanup (): void {
    // 清理 script 元素
    if (this.scriptElement?.parentNode) {
      this.scriptElement.parentNode.removeChild(this.scriptElement);
      this.scriptElement = undefined;
    }

    // 清理 Blob URL
    if (this.blobURL) {
      URL.revokeObjectURL(this.blobURL);
      this.blobURL = undefined;
    }
  }

  /**
   * 销毁转码器，释放所有资源
   */
  override destroy (): void {
    super.destroy();
    this.cleanup();
  }
}
