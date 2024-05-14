import type { Disposable } from '../utils';
import type { RenderPassAttachmentStorageType } from './render-pass';

export interface RenderbufferProps {
  storageType: RenderPassAttachmentStorageType,
  format: GLenum,
  attachment: GLenum,
}

export abstract class Renderbuffer implements Disposable {
  readonly size: [x: number, y: number] = [0, 0];
  readonly multiSample = 1;
  readonly storageType: RenderPassAttachmentStorageType;
  readonly format: GLenum;
  readonly attachment: GLenum;

  protected destroyed = false;

  static create: (props: RenderbufferProps) => Renderbuffer;

  constructor (props: RenderbufferProps) {
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

