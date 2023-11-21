import type { Disposable } from '../utils';
import type { RenderPassAttachmentStorageType } from './render-pass';

export interface RenderBufferProps {
  storageType: RenderPassAttachmentStorageType,
  format: GLenum,
  attachment: GLenum,
}

export abstract class RenderBuffer implements Disposable {
  readonly size: [x: number, y: number] = [0, 0];
  readonly multiSample = 1;
  readonly storageType: RenderPassAttachmentStorageType;
  readonly format: GLenum;
  readonly attachment: GLenum;

  protected destroyed = false;

  static create: (props: RenderBufferProps) => RenderBuffer;

  constructor (props: RenderBufferProps) {
    const { storageType, format, attachment } = props;

    this.storageType = storageType;
    this.format = format;
    this.attachment = attachment;
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  abstract setSize (width: number, height: number): void;

  abstract dispose (): void;
}

