import type { Disposable, FrameBufferProps, RenderBuffer, Renderer, RenderPassStoreAction, Texture, Texture2DSourceOptionsFrameBuffer } from '@galacean/effects-core';
import { isWebGL2, addItem, FrameBuffer, glContext, GPUCapability, RenderPassAttachmentStorageType, RenderPassDestroyAttachmentType, TextureSourceType, TextureStoreAction } from '@galacean/effects-core';
import { GLRenderBuffer } from './gl-render-buffer';
import type { GLRenderer } from './gl-renderer';
import { GLTexture } from './gl-texture';
import type { GLEngine } from './gl-engine';

let seed = 1;

export class GLFrameBuffer extends FrameBuffer implements Disposable {
  storeInvalidAttachments?: GLenum[]; // Pass渲染结束是否保留attachment的渲染内容，不保留可以提升部分性能。
  depthStencilRenderBuffer?: GLRenderBuffer;
  depthTexture?: GLTexture;
  stencilTexture?: GLTexture;
  colorTextures: GLTexture[];
  fbo?: WebGLFramebuffer;
  engine: GLEngine;

  readonly renderer: GLRenderer;

  private readonly attachmentTextures: WebGLTexture[] = [];

  constructor (
    props: FrameBufferProps,
    renderer: Renderer,
  ) {
    super();
    this.renderer = renderer as GLRenderer;
    this.engine = renderer.engine as GLEngine;
    const { depthStencilAttachment, viewport, isCustomViewport, viewportScale = 1, storeAction, name = `GLFrameBuffer${seed++}` } = props;

    this.depthStencilStorageType = depthStencilAttachment?.storageType ?? RenderPassAttachmentStorageType.none;
    this.viewport = viewport;
    this.isCustomViewport = !!isCustomViewport;
    this.viewportScale = viewportScale;
    this.name = name;
    this.storeAction = storeAction;
    this.updateProps(props);
  }

  override get stencilStorage (): RenderBuffer | undefined {
    const storageType = this.depthStencilStorageType;

    if (storageType !== RenderPassAttachmentStorageType.depth_16_opaque) {
      return this.depthStencilRenderBuffer;
    }
  }

  override get depthStorage (): RenderBuffer | undefined {
    if (this.depthStencilStorageType !== RenderPassAttachmentStorageType.stencil_8_opaque) {
      return this.depthStencilRenderBuffer;
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

  private updateProps (props: FrameBufferProps) {
    const renderer = this.renderer;
    const gpuCapability = this.engine.gpuCapability;
    const depthStencilAttachment = props.depthStencilAttachment ?? { storageType: RenderPassAttachmentStorageType.none };
    const willUseFbo = props.attachments.length > 0;

    this.externalStorage = false;
    let separateDepthStencil = true;

    if (props.attachments.length > 1 && !gpuCapability.detail.drawBuffers) {
      throw Error('multiple color attachments not support');
    }
    const optDepthStencilTex: GLTexture | undefined = props.depthStencilAttachment?.texture as GLTexture;
    const readableDepthStencilTextures = gpuCapability.detail.readableDepthStencilTextures;

    this.colorTextures = props.attachments.slice() as GLTexture[];
    if (!willUseFbo && depthStencilAttachment.storageType !== RenderPassAttachmentStorageType.none) {
      throw Error('use depth stencil attachment without color attachments');
    }
    if (willUseFbo) {
      this.fbo = renderer.glRenderer.createGLFrameBuffer(this, this.name) as WebGLFramebuffer;
    }
    const storageType = depthStencilAttachment.storageType;

    if (storageType === RenderPassAttachmentStorageType.depth_stencil_opaque) {
      if (depthStencilAttachment.storage) {
        if (depthStencilAttachment.storage instanceof GLRenderBuffer) {
          this.depthStencilRenderBuffer = depthStencilAttachment.storage;
          this.externalStorage = true;
        } else {
          throw Error('invalid depth stencil attachment storage');
        }
      } else {
        this.depthStencilRenderBuffer = new GLRenderBuffer({
          format: glContext.DEPTH_STENCIL,
          attachment: glContext.DEPTH_STENCIL_ATTACHMENT,
          storageType,
        }, renderer.glRenderer);
      }
      separateDepthStencil = false;
    } else if (storageType === RenderPassAttachmentStorageType.depth_16_opaque) {
      if (depthStencilAttachment.storage) {
        if (depthStencilAttachment.storage instanceof GLRenderBuffer) {
          this.depthStencilRenderBuffer = depthStencilAttachment.storage;
          this.externalStorage = true;
        } else {
          throw Error('invalid depth attachment storage');
        }
      } else {
        this.depthStencilRenderBuffer = new GLRenderBuffer({
          attachment: glContext.DEPTH_ATTACHMENT,
          format: glContext.DEPTH_COMPONENT16,
          storageType,
        }, renderer.glRenderer);
      }
    } else if (storageType === RenderPassAttachmentStorageType.stencil_8_opaque) {
      if (depthStencilAttachment.storage) {
        if (depthStencilAttachment.storage instanceof GLRenderBuffer) {
          this.depthStencilRenderBuffer = depthStencilAttachment.storage;
          this.externalStorage = true;
        } else {
          throw Error('invalid stencil attachment storage');
        }
      } else {
        this.depthStencilRenderBuffer = new GLRenderBuffer({
          attachment: glContext.STENCIL_ATTACHMENT,
          format: glContext.STENCIL_INDEX8,
          storageType,
        }, renderer.glRenderer);
      }
    } else if (storageType === RenderPassAttachmentStorageType.depth_16_texture) {
      if (!readableDepthStencilTextures) {
        throw Error('depth texture is not support in framebuffer');
      }
      this.depthTexture = optDepthStencilTex ?? new GLTexture(this.engine, {
        sourceType: TextureSourceType.framebuffer,
        format: glContext.DEPTH_COMPONENT,
        internalFormat: gpuCapability.internalFormatDepth16,
        type: glContext.UNSIGNED_SHORT,
        name: `${this.name}##depthTex`,
      });
      this.depthTexture.initialize();
    } else if (storageType === RenderPassAttachmentStorageType.depth_24_stencil_8_texture) {
      if (!readableDepthStencilTextures) {
        throw Error('depth stencil texture is not support in framebuffer');
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
    }
    this.storeInvalidAttachments = this.getStoreAttachments(this.storeAction, separateDepthStencil);
    this.updateAttachmentTextures();
  }

  private getStoreAttachments (storeAction: RenderPassStoreAction, separateDepthStencil: boolean): GLenum[] | undefined {
    const gl = this.renderer.glRenderer.gl as WebGL2RenderingContext;
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
    const att = this.storeInvalidAttachments;

    if (att?.length) {
      const gl = this.renderer.glRenderer.gl as WebGL2RenderingContext;

      gl.invalidateFramebuffer(gl.FRAMEBUFFER, att);
    }
    this.renderer.pipelineContext.bindSystemFramebuffer();
  }

  override bind () {
    const gl = this.renderer.glRenderer.gl;
    const state = this.renderer.pipelineContext;

    if (this.fbo) {
      const FRAMEBUFFER = gl.FRAMEBUFFER;
      const [x, y, width, height] = this.viewport;

      state.bindFramebuffer(FRAMEBUFFER, this.fbo);

      // TODO 不在bind中设置viewport
      state.viewport(x, y, width, height);
      const emptyTexture = this.renderer.glRenderer.emptyTexture2D.textureBuffer;

      // in case frame texture loop
      Object.keys(state.textureUnitDict).forEach(unit => {
        const texture = state.textureUnitDict[unit];

        if (
          texture !== emptyTexture &&
          texture &&
          this.attachmentTextures.includes(texture)
        ) {
          state.activeTexture(+unit);
          this.renderer.glRenderer.emptyTexture2D.bind();
        }
      });

      // FIXME: 没有pipeline对象的临时方案
      for (let i = 0; i < 4; i++) {
        state.activeTexture(gl.TEXTURE0 + i);
        this.renderer.glRenderer.emptyTexture2D.bind();
      }
      if (!this.ready) {
        const { depthStencilRenderBuffer, depthTexture, stencilTexture } = this;

        state.activeTexture(gl.TEXTURE0);
        if (depthStencilRenderBuffer) {
          depthStencilRenderBuffer.setSize(width, height);
          gl.framebufferRenderbuffer(FRAMEBUFFER, depthStencilRenderBuffer.attachment, gl.RENDERBUFFER, depthStencilRenderBuffer.buffer);
        } else if (depthTexture) {
          // 解决RenderPass在Clone深度贴图时width和height丢失的问题
          (depthTexture.source as Texture2DSourceOptionsFrameBuffer).data = { width, height };
          depthTexture.update({ data: { width, height, data: new Uint16Array(0) } });
          const attachment = depthTexture && stencilTexture ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;

          gl.framebufferTexture2D(FRAMEBUFFER, attachment, gl.TEXTURE_2D, depthTexture.textureBuffer, 0);
        }
        this.resetColorTextures(this.colorTextures);
        const status = gl.checkFramebufferStatus(FRAMEBUFFER);

        if (status !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error(`Framebuffer failed, status: ${status}, error: ${gl.getError()}`);
        }
        this.ready = true;
      }
    }
  }

  override resetColorTextures (colorTextures?: Texture[]) {
    const colors = colorTextures as GLTexture[];
    const gl: WebGLRenderingContext = this.renderer.glRenderer.gl;
    const gpuCapability = this.engine.gpuCapability;
    const viewport = this.viewport;
    const buffers: boolean[] = [];

    if (colors) {
      for (const texture of colors) {
        texture.initialize();
      }
      this.colorTextures = colors.slice();
    }
    this.renderer.pipelineContext.activeTexture(gl.TEXTURE0);

    this.colorTextures.forEach((tex, index) => {
      const width = viewport[2];
      const height = viewport[3];
      const data = { width: width, height: height, data: new Uint8Array(0) };

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

  override dispose (opt?: { depthStencilAttachment?: RenderPassDestroyAttachmentType }) {
    const renderer = this.renderer;

    if (renderer) {
      renderer.glRenderer.deleteGLFrameBuffer(this);
      delete this.fbo;
      const clearAttachment = opt?.depthStencilAttachment ? opt.depthStencilAttachment : RenderPassDestroyAttachmentType.force;

      if (clearAttachment === RenderPassDestroyAttachmentType.force || (clearAttachment === RenderPassDestroyAttachmentType.keepExternal && !this.externalStorage)) {
        this.depthStencilRenderBuffer?.dispose();
        this.depthTexture?.dispose();
      }
      // @ts-expect-error safe to assign
      this.renderer = this.stencilRenderBuffer = this.depthStencilRenderBuffer = null;
    }
  }
}
