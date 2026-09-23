import type { RestoreHandler } from '../utils';
import { GPUResource } from '../gpu-resource';
import type { RenderingDevice } from '../rendering-device';
import type { RenderPassAttachmentStorageType } from './render-pass';

export interface RenderbufferProps {
  storageType: RenderPassAttachmentStorageType,
  format: GLenum,
  attachment: GLenum,
}

export abstract class GPURenderbuffer extends GPUResource implements RestoreHandler {
  readonly size: [x: number, y: number] = [0, 0];
  readonly multiSample = 1;
  readonly storageType: RenderPassAttachmentStorageType;
  readonly format: GLenum;
  readonly attachment: GLenum;

  constructor (device: RenderingDevice, props: RenderbufferProps) {
    super(device);
    const { storageType, format, attachment } = props;

    this.storageType = storageType;
    this.format = format;
    this.attachment = attachment;
  }

  abstract initialize (): void;

  abstract setSize (width: number, height: number): void;

  abstract restore (): void;
}

