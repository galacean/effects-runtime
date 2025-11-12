/* eslint-disable compat/compat */
import type { KTX2TargetFormat } from '../ktx2-common';
import type { TranscodeResult } from './abstract-transcoder';
import { AbstractTranscoder } from './abstract-transcoder';
import { TranscodeWorkerCode, init, transcode, _init } from './binomial-workercode';

/** @internal */
export class BinomialLLCTranscoder extends AbstractTranscoder {
  private blobURL?: string;
  private scriptElement?: HTMLScriptElement;

  constructor (workerLimitCount: number) {
    super(workerLimitCount);
  }

  initTranscodeWorkerPool () {
    return Promise.all([
      fetch('https://mdn.alipayobjects.com/rms/afts/file/A*nG8SR6vCgXgAAAAAAAAAAAAAARQnAQ/basis_transcoder.js').then(
        res => res.text()
      ),
      fetch('https://mdn.alipayobjects.com/rms/afts/file/A*qEUfQ7317KsAAAAAAAAAAAAAARQnAQ/basis_transcoder.wasm').then(
        res => res.arrayBuffer()
      ),
    ]).then(([jsCode, wasmBuffer]) => {
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
        //使用worker
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
    });
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
