import type { KTX2TargetFormat } from '../ktx2-common';
import type { TranscodeResult } from './abstract-transcoder';
import { AbstractTranscoder } from './abstract-transcoder';
import { TranscodeWorkerCode, init, transcode, _init } from './binomial-workercode';

/** @internal */
export class BinomialLLCTranscoder extends AbstractTranscoder {
  constructor (workerLimitCount: number) {
    super(workerLimitCount);
  }

  initTranscodeWorkerPool () {
    return Promise.all([
      // eslint-disable-next-line compat/compat
      fetch('https://mdn.alipayobjects.com/rms/afts/file/A*nG8SR6vCgXgAAAAAAAAAAAAAARQnAQ/basis_transcoder.js').then(
        res => res.text()
      ),
      // eslint-disable-next-line compat/compat
      fetch('https://mdn.alipayobjects.com/rms/afts/file/A*qEUfQ7317KsAAAAAAAAAAAAAARQnAQ/basis_transcoder.wasm').then(
        res => res.arrayBuffer()
      ),
    ]).then(([jsCode, wasmBuffer]) => {
      if (this.workerLimitCount === 0) {
        return new Promise<any>((resolve, reject) => {
          const scriptDom = document.createElement('script');

          scriptDom.src = URL.createObjectURL(new Blob([jsCode], { type: 'application/javascript' }));
          document.body.appendChild(scriptDom);
          scriptDom.onload = () => {
            // eslint-disable-next-line promise/catch-or-return, promise/no-nesting
            init(wasmBuffer).then(() => {
              resolve(null);
            });
          };
          scriptDom.onerror = () => {
            reject();
          };
        });
      } else {
        const funcCode = TranscodeWorkerCode.toString();
        const transcodeString = funcCode.substring(funcCode.indexOf('{'), funcCode.lastIndexOf('}') + 1);

        const workerCode = `
        ${jsCode}
        ${transcode.toString()}
        ${transcodeString}
        `;

        const workerURL = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));

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
}
