import type {
  Disposable, FramebufferProps, Renderbuffer, Renderer, RenderPassStoreAction, Texture,
  Texture2DSourceOptionsFramebuffer,
} from '@galacean/effects-core';
import {
  isWebGL2, addItem, Framebuffer, glContext, RenderPassAttachmentStorageType,
  RenderPassDestroyAttachmentType, TextureSourceType, TextureStoreAction,
} from '@galacean/effects-core';
import { GLRenderbuffer } from './gl-renderbuffer';
import type { GLRenderer } from './gl-renderer';
import { GLTexture } from './gl-texture';
import type { GLEngine } from './gl-engine';

let seed = 1;

export class GLFramebuffer extends Framebuffer implements Disposable {
  storeInvalidAttachments?: GLenum[]; // Pass渲染结束是否保留attachment的渲染内容，不保留可以提升部分性能。
  depthStencilRenderbuffer?: GLRenderbuffer;
  depthTexture?: GLTexture;
  stencilTexture?: GLTexture;
  colorTextures: GLTexture[];
  fbo?: WebGLFramebuffer;
  engine: GLEngine;

  readonly renderer: GLRenderer;

  private readonly attachmentTextures: WebGLTexture[] = [];

  constructor (
    props: FramebufferProps,
    renderer: Renderer,
  ) {
    super();
    const {
      depthStencilAttachment, viewport, storeAction,
      name = `GLFramebuffer${seed++}`,
    } = props;

    this.renderer = renderer as GLRenderer;
    this.engine = renderer.engine as GLEngine;
    this.depthStencilStorageType = depthStencilAttachment?.storageType ?? RenderPassAttachmentStorageType.none;
    this.viewport = viewport;
    this.name = name;
    this.storeAction = storeAction;
    this.updateProps(props);
  }

  override get stencilStorage (): Renderbuffer | undefined {
    const storageType = this.depthStencilStorageType;

    if (storageType !== RenderPassAttachmentStorageType.depth_16_opaque) {
      return this.depthStencilRenderbuffer;
    }
  }

  override get depthStorage (): Renderbuffer | undefined {
    if (this.depthStencilStorageType !== RenderPassAttachmentStorageType.stencil_8_opaque) {
      return this.depthStencilRenderbuffer;
    }
  }

  override getDepthTexture (): Texture | undefined {
    return this.depthTexture;
  }

  override getStencilTexture (): Texture | undefined {
    return this.stencilTexture;
  }

  override getColorTextures (): Texture[] {
    return this.colorTextures;
  }

  private updateAttachmentTextures () {
    this.attachmentTextures.length = 0;
    this.colorTextures.forEach(tex => {
      tex.initialize();
      addItem(this.attachmentTextures, tex.textureBuffer);
    });
    if (this.stencilTexture) {
      addItem(this.attachmentTextures, this.stencilTexture.textureBuffer);
    }
    if (this.depthTexture) {
      addItem(this.attachmentTextures, this.depthTexture.textureBuffer);
    }
  }

  private updateProps (props: FramebufferProps) {
    const renderer = this.renderer;
    const gpuCapability = this.engine.gpuCapability;
    const depthStencilAttachment = props.depthStencilAttachment ?? { storageType: RenderPassAttachmentStorageType.none };
    const willUseFbo = props.attachments.length > 0;
    let separateDepthStencil = true;

    this.externalStorage = false;

    if (props.attachments.length > 1 && !gpuCapability.detail.drawBuffers) {
      throw new Error('Multiple color attachments not support.');
    }

    const optDepthStencilTex: GLTexture | undefined = props.depthStencilAttachment?.texture as GLTexture;
    const readableDepthStencilTextures = gpuCapability.detail.readableDepthStencilTextures;
    const { storageType, storage } = depthStencilAttachment;

    this.colorTextures = props.attachments.slice() as GLTexture[];

    if (!willUseFbo && storageType !== RenderPassAttachmentStorageType.none) {
      throw new Error('Use depth stencil attachment without color attachments.');
    }
    if (willUseFbo) {
      this.fbo = renderer.createGLFramebuffer(this.name) as WebGLFramebuffer;
    }

    switch (storageType) {
      case RenderPassAttachmentStorageType.depth_stencil_opaque:
        if (storage) {
          if (storage instanceof GLRenderbuffer) {
            this.depthStencilRenderbuffer = storage;
            this.externalStorage = true;
          } else {
            throw new Error('Invalid depth stencil attachment storage.');
          }
        } else {
          this.depthStencilRenderbuffer = new GLRenderbuffer({
            format: glContext.DEPTH_STENCIL,
            attachment: glContext.DEPTH_STENCIL_ATTACHMENT,
            storageType,
          }, renderer);
        }
        separateDepthStencil = false;

        break;
      case RenderPassAttachmentStorageType.depth_16_opaque:
        if (storage) {
          if (storage instanceof GLRenderbuffer) {
            this.depthStencilRenderbuffer = storage;
            this.externalStorage = true;
          } else {
            throw new Error('Invalid depth attachment storage.');
          }
        } else {
          this.depthStencilRenderbuffer = new GLRenderbuffer({
            attachment: glContext.DEPTH_ATTACHMENT,
            format: glContext.DEPTH_COMPONENT16,
            storageType,
          }, renderer);
        }

        break;
      case RenderPassAttachmentStorageType.stencil_8_opaque:
        if (storage) {
          if (storage instanceof GLRenderbuffer) {
            this.depthStencilRenderbuffer = storage;
            this.externalStorage = true;
          } else {
            throw new Error('Invalid stencil attachment storage.');
          }
        } else {
          this.depthStencilRenderbuffer = new GLRenderbuffer({
            attachment: glContext.STENCIL_ATTACHMENT,
            format: glContext.STENCIL_INDEX8,
            storageType,
          }, renderer);
        }

        break;
      case RenderPassAttachmentStorageType.depth_16_texture:
        if (!readableDepthStencilTextures) {
          throw new Error('Depth texture is not support in framebuffer.');
        }
        this.depthTexture = optDepthStencilTex ?? new GLTexture(this.engine, {
          sourceType: TextureSourceType.framebuffer,
          format: glContext.DEPTH_COMPONENT,
          internalFormat: gpuCapability.internalFormatDepth16,
          type: glContext.UNSIGNED_SHORT,
          name: `${this.name}##depthTex`,
        });
        this.depthTexture.initialize();

        break;
      case RenderPassAttachmentStorageType.depth_24_stencil_8_texture:
        if (!readableDepthStencilTextures) {
          throw new Error('Depth stencil texture is not support in framebuffer.');
        }
        this.depthTexture = this.stencilTexture = optDepthStencilTex ?? new GLTexture(this.engine, {
          sourceType: TextureSourceType.framebuffer,
          format: glContext.DEPTH_STENCIL,
          internalFormat: gpuCapability.internalFormatDepth24_stencil8,
          type: gpuCapability.UNSIGNED_INT_24_8,
          name: `${this.name}##dpthStclTex`,
        });
        this.depthTexture.initialize();
        separateDepthStencil = true;

        break;
    }

    this.storeInvalidAttachments = this.getStoreAttachments(this.storeAction, separateDepthStencil);
    this.updateAttachmentTextures();
  }

  private getStoreAttachments (
    storeAction: RenderPassStoreAction,
    separateDepthStencil: boolean,
  ): GLenum[] | undefined {
    const gl = this.renderer.gl as WebGL2RenderingContext;
    const colorLen = this.colorTextures.length;

    if (storeAction && isWebGL2(gl) && colorLen > 0) {
      const attachments: GLenum[] = [];

      if (storeAction.depthAction === TextureStoreAction.clear && this.depthStorage) {
        addItem(attachments, separateDepthStencil ? gl.DEPTH_ATTACHMENT : gl.DEPTH_STENCIL_ATTACHMENT);
      }
      if (storeAction.stencilAction === TextureStoreAction.clear && this.stencilStorage) {
        addItem(attachments, separateDepthStencil ? gl.STENCIL_ATTACHMENT : gl.DEPTH_STENCIL_ATTACHMENT);
      }
      if (storeAction.colorAction === TextureStoreAction.clear) {
        for (let i = 0; i < colorLen; i++) {
          addItem(attachments, (gl as unknown as Record<string, GLenum>)[`COLOR_ATTACHMENT${i}`]);
        }
      }

      return attachments;
    }
  }

  override unbind () {
    const attachments = this.storeInvalidAttachments;

    if (attachments?.length) {
      const gl = this.renderer.gl;

      if (isWebGL2(gl)) {
        gl.invalidateFramebuffer(gl.FRAMEBUFFER, attachments);
      }
    }
    (this.renderer.engine as GLEngine).bindSystemFramebuffer();
  }

  override bind () {
    if (!this.fbo) {
      return;
    }

    const gl = this.renderer.gl;
    const state = this.renderer.engine as GLEngine;
    const [x, y, width, height] = this.viewport;

    state.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

    // TODO 不在bind中设置viewport
    state.viewport(x, y, width, height);
    const whiteTexture = this.renderer.engine.whiteTexture as GLTexture;
    const whiteWebGLTexture = whiteTexture.textureBuffer;

    // in case frame texture loop
    Object.keys(state.textureUnitDict).forEach(unit => {
      const texture = state.textureUnitDict[unit];

      if (
        texture &&
        texture !== whiteWebGLTexture &&
        this.attachmentTextures.includes(texture)
      ) {
        state.activeTexture(+unit);
        whiteTexture.bind();
      }
    });

    // FIXME: 没有pipeline对象的临时方案
    for (let i = 0; i < 4; i++) {
      state.activeTexture(gl.TEXTURE0 + i);
      whiteTexture.bind();
    }

    if (this.ready) {
      return;
    }

    const { depthStencilRenderbuffer, depthTexture, stencilTexture } = this;

    state.activeTexture(gl.TEXTURE0);
    if (depthStencilRenderbuffer) {
      depthStencilRenderbuffer.setSize(width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, depthStencilRenderbuffer.attachment, gl.RENDERBUFFER, depthStencilRenderbuffer.buffer);
    } else if (depthTexture) {
      // 解决RenderPass在Clone深度贴图时width和height丢失的问题
      (depthTexture.source as Texture2DSourceOptionsFramebuffer).data = { width, height };
      depthTexture.update({ data: { width, height, data: new Uint16Array(0) } });
      const attachment = depthTexture && stencilTexture ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;

      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, depthTexture.textureBuffer, 0);
    }
    this.resetColorTextures(this.colorTextures);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer failed. gl status=${status}, gl error=${gl.getError()}, gl isContextLost=${gl.isContextLost()}. width=${width}, height=${height}.`);
    }

    this.ready = true;
  }

  override resetColorTextures (colorTextures?: Texture[]) {
    const colors = colorTextures as GLTexture[];
    const gl = this.renderer.gl;
    const gpuCapability = this.engine.gpuCapability;
    const viewport = this.viewport;
    const buffers: boolean[] = [];

    if (colors) {
      for (const texture of colors) {
        texture.initialize();
      }
      this.colorTextures = colors.slice();
    }
    (this.renderer.engine as GLEngine).activeTexture(gl.TEXTURE0);

    this.colorTextures.forEach((tex, index) => {
      const width = viewport[2];
      const height = viewport[3];
      const data = { width, height, data: new Uint8Array(0) };

      tex.update({ data });
      gpuCapability.framebufferTexture2D(gl, gl.FRAMEBUFFER, index, gl.TEXTURE_2D, tex.textureBuffer);
      buffers.push(true);
    });
    gpuCapability.drawBuffers(gl, buffers);
    this.updateAttachmentTextures();
  }

  override resize (x: number, y: number, width: number, height: number) {
    const [preX, preY, preWidth, preHeight] = this.viewport;

    if (preX !== x || preY !== y || preWidth !== width || preHeight !== height) {
      this.viewport = [x, y, width, height];
      this.ready = false;
      this.bind();
    }
  }

  override dispose (options?: { depthStencilAttachment?: RenderPassDestroyAttachmentType }) {
    if (this.renderer) {
      this.renderer.deleteGLFramebuffer(this);
      delete this.fbo;
      const clearAttachment = options?.depthStencilAttachment ? options.depthStencilAttachment : RenderPassDestroyAttachmentType.force;

      if (
        clearAttachment === RenderPassDestroyAttachmentType.force || (
          clearAttachment === RenderPassDestroyAttachmentType.keepExternal &&
          !this.externalStorage
        )
      ) {
        this.depthStencilRenderbuffer?.dispose();
        this.depthTexture?.dispose();
      }

      for (const texture of this.colorTextures) {
        texture.dispose();
      }

      this.stencilTexture?.dispose();

      // @ts-expect-error safe to assign
      this.renderer = this.stencilRenderbuffer = this.depthStencilRenderbuffer = null;
    }
  }
}
