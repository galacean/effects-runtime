import type { Composition, Disposable } from '@galacean/effects';
import { AbstractPlugin } from '@galacean/effects';
import { CompositionTransformerAcceler } from './composition-transformer-acceler';
import type { OrientationAdapterAcceler } from './orientation-adapter-acceler';
import { getAccelerAdapter } from './orientation-adapter-acceler';

export class OrientationPluginLoader extends AbstractPlugin implements Disposable {
  override order = 90;

  private adapter: OrientationAdapterAcceler | null = null;

  override onCompositionConstructed (composition: Composition) {
    this.adapter = getAdapter();
    this.adapter?.connect();
    this.bindAccelerDocumentEvent();

    const transformer = composition.loaderData.deviceTransformer = new CompositionTransformerAcceler(composition);

    this.adapter?.addTransformer(transformer);
  }

  override onCompositionUpdate (composition: Composition) {
    const transformer = composition.loaderData.deviceTransformer as CompositionTransformerAcceler;

    if (transformer) {
      transformer.updateOrientation();
    }
  }

  override onCompositionDestroyed (composition: Composition): void {
    const empty = this.adapter?.removeTransformer(composition.loaderData.deviceTransformer);

    if (empty) {
      this.adapter?.disconnect();
    }
  }

  private handleConnect = () => {
    if (!closeManually) {
      this.adapter?.connect();
    }
  };

  private handleDisconnect = () => {
    this.adapter?.disconnect();
  };

  private bindAccelerDocumentEvent () {
    this.unbindAccelerDocumentEvent(); // 保证全局只监听一份
    document.addEventListener('resume', this.handleConnect, false);
    document.addEventListener('pause', this.handleDisconnect, false);
    document.addEventListener('back', this.handleDisconnect, false);
  }

  private unbindAccelerDocumentEvent () {
    document.removeEventListener('resume', this.handleConnect);
    document.removeEventListener('pause', this.handleDisconnect);
    document.removeEventListener('back', this.handleDisconnect);
  }

  dispose (): void {
    getAdapter().disconnect();
    this.unbindAccelerDocumentEvent();
  }
}

// 是否是手动关闭，如果是，那么 resume 时不要恢复
let closeManually = false;

/**
 *
 * @returns
 */
export function getAdapter () {
  // 运动感应类型（默认使用加速度，Native 环境使用陀螺仪）
  return getAccelerAdapter();
}

export function closeDeviceMotion () {
  closeManually = true;
  getAdapter().disconnect();
}

export function openDeviceMotion () {
  closeManually = false;
  getAdapter().connect();
}
