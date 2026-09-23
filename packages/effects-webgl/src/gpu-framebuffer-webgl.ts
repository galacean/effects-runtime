import type {
  FramebufferProps, RenderPassStoreAction,
  Texture2DSourceOptionsFramebuffer,
} from '@galacean/effects-core';
import {
  isWebGL2, addItem, GPUFramebuffer, Texture, glContext, RenderPassAttachmentStorageType,
  RenderPassDestroyAttachmentType, TextureSourceType, TextureStoreAction,
} from '@galacean/effects-core';
import { assignInspectorName } from './gl-renderer-internal';
import { GPURenderbufferWebGL } from './gpu-renderbuffer-webgl';
import type { GPUTextureWebGL } from './gpu-texture-webgl';
import type { RenderingDeviceWebGL } from './rendering-device-webgl';

let seed = 1;

export class GPUFramebufferWebGL extends GPUFramebuffer {
  storeInvalidAttachments?: GLenum[]; // Pass渲染结束是否保留attachment的渲染内容，不保留可以提升部分性能。
  depthStencilRenderbuffer?: GPURenderbufferWebGL;
  depthTexture?: Texture;
  stencilTexture?: Texture;
  colorTextures: Texture[] = [];
  fbo?: WebGLFramebuffer;
  private props?: FramebufferProps;
  private readonly useFbo: boolean;

  private readonly attachmentTextures: WebGLTexture[] = [];

  constructor (
    device: RenderingDeviceWebGL,
    props: FramebufferProps,
  ) {
    super(device);
    const {
      depthStencilAttachment, viewport, storeAction,
      name = `GPUFramebufferWebGL${seed++}`,
    } = props;

    this.props = props;
    this.useFbo = props.attachments.length > 0;
    this.depthStencilStorageType = depthStencilAttachment?.storageType ?? RenderPassAttachmentStorageType.none;
    this.viewport = viewport;
    this.name = name;
    this.storeAction = storeAction;
  }

  override initialize (): void {
    if (this.initialized) {
      return;
    }
    if (this.props) {
      this.updateProps(this.props);
      this.props = undefined;
    } else if (this.useFbo) {
      this.createAllocation();
    }
  }

  private createAllocation (): void {
    const device = this.device as RenderingDeviceWebGL;

    const fbo = device.gl.createFramebuffer();

    if (fbo) {
      assignInspectorName(fbo, this.name, this.name);
    } else {
      throw new Error(`Failed to create WebGL framebuffer. gl isContextLost=${device.gl.isContextLost()}`);
    }
    this.fbo = fbo;
    this.initialized = true;
    device.addFramebuffer(this);
  }

  get stencilStorage (): GPURenderbufferWebGL | undefined {
    const storageType = this.depthStencilStorageType;

    if (storageType !== RenderPassAttachmentStorageType.depth_16_opaque) {
      return this.depthStencilRenderbuffer;
    }
  }

  get depthStorage (): GPURenderbufferWebGL | undefined {
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
    const width = this.viewport[2];
    const height = this.viewport[3];

    this.attachmentTextures.length = 0;
    this.colorTextures.forEach(tex => {
      const data = { width, height, data: new Uint8Array(0) };

      tex.initialize();
      tex.update({ data });
      addItem(this.attachmentTextures, (tex.getGPUTexture() as GPUTextureWebGL).textureBuffer);
    });

    if (this.stencilTexture) {
      addItem(this.attachmentTextures, (this.stencilTexture.getGPUTexture() as GPUTextureWebGL).textureBuffer);
    }

    if (this.depthTexture) {
      this.depthTexture.update({ data: { width, height, data: new Uint16Array(0) } });
      addItem(this.attachmentTextures, (this.depthTexture.getGPUTexture() as GPUTextureWebGL).textureBuffer);
    }
  }

  private updateProps (props: FramebufferProps) {
    const gpuCapability = (this.device as RenderingDeviceWebGL).gpuCapability;
    const depthStencilAttachment = props.depthStencilAttachment ?? { storageType: RenderPassAttachmentStorageType.none };
    const willUseFbo = this.useFbo;
    let separateDepthStencil = true;

    this.externalStorage = false;

    if (props.attachments.length > 1 && !gpuCapability.detail.drawBuffers) {
      throw new Error('Multiple color attachments not support.');
    }

    const optDepthStencilTex: Texture | undefined = props.depthStencilAttachment?.texture as Texture;
    const readableDepthStencilTextures = gpuCapability.detail.readableDepthStencilTextures;
    const { storageType, storage } = depthStencilAttachment;

    this.colorTextures = props.attachments.slice();

    if (!willUseFbo && storageType !== RenderPassAttachmentStorageType.none) {
      throw new Error('Use depth stencil attachment without color attachments.');
    }
    if (willUseFbo) {
      this.createAllocation();
    }

    switch (storageType) {
      case RenderPassAttachmentStorageType.depth_stencil_opaque:
        if (storage) {
          if (storage instanceof GPURenderbufferWebGL) {
            this.depthStencilRenderbuffer = storage;
            this.externalStorage = true;
          } else {
            throw new Error('Invalid depth stencil attachment storage.');
          }
        } else {
          this.depthStencilRenderbuffer = (this.device as RenderingDeviceWebGL).createRenderbuffer({
            format: glContext.DEPTH_STENCIL,
            attachment: glContext.DEPTH_STENCIL_ATTACHMENT,
            storageType,
          });
          this.depthStencilRenderbuffer.initialize();
        }
        separateDepthStencil = false;

        break;
      case RenderPassAttachmentStorageType.depth_16_opaque:
        if (storage) {
          if (storage instanceof GPURenderbufferWebGL) {
            this.depthStencilRenderbuffer = storage;
            this.externalStorage = true;
          } else {
            throw new Error('Invalid depth attachment storage.');
          }
        } else {
          this.depthStencilRenderbuffer = (this.device as RenderingDeviceWebGL).createRenderbuffer({
            attachment: glContext.DEPTH_ATTACHMENT,
            format: glContext.DEPTH_COMPONENT16,
            storageType,
          });
          this.depthStencilRenderbuffer.initialize();
        }

        break;
      case RenderPassAttachmentStorageType.stencil_8_opaque:
        if (storage) {
          if (storage instanceof GPURenderbufferWebGL) {
            this.depthStencilRenderbuffer = storage;
            this.externalStorage = true;
          } else {
            throw new Error('Invalid stencil attachment storage.');
          }
        } else {
          this.depthStencilRenderbuffer = (this.device as RenderingDeviceWebGL).createRenderbuffer({
            attachment: glContext.STENCIL_ATTACHMENT,
            format: glContext.STENCIL_INDEX8,
            storageType,
          });
          this.depthStencilRenderbuffer.initialize();
        }

        break;
      case RenderPassAttachmentStorageType.depth_16_texture:
        if (!readableDepthStencilTextures) {
          throw new Error('Depth texture is not support in framebuffer.');
        }
        this.depthTexture = optDepthStencilTex ?? new Texture(this.device!.engine, {
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
        this.depthTexture = this.stencilTexture = optDepthStencilTex ?? new Texture(this.device!.engine, {
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
    const gl = (this.device as RenderingDeviceWebGL).gl;
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
      const gl = (this.device as RenderingDeviceWebGL).gl;

      if (isWebGL2(gl)) {
        gl.invalidateFramebuffer(gl.FRAMEBUFFER, attachments);
      }
    }
    (this.device as RenderingDeviceWebGL).bindSystemFramebuffer();
  }

  override bind () {
    if (!this.fbo) {
      return;
    }

    const gl = (this.device as RenderingDeviceWebGL).gl;
    const state = this.device as RenderingDeviceWebGL;
    const [x, y, width, height] = this.viewport;

    state.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

    // TODO 不在bind中设置viewport
    state.setViewport(x, y, width, height);
    const whiteTexture = this.device!.engine.assetServer.whiteTexture;
    const whiteGPUTexture = whiteTexture.getGPUTexture() as GPUTextureWebGL;
    const whiteWebGLTexture = whiteGPUTexture.textureBuffer;

    // in case frame texture loop
    Object.keys(state.textureUnitDict).forEach(unit => {
      const texture = state.textureUnitDict[unit];

      if (
        texture &&
        texture !== whiteWebGLTexture &&
        this.attachmentTextures.includes(texture)
      ) {
        state.activeTexture(+unit);
        whiteGPUTexture.bind();
      }
    });

    // FIXME: 没有pipeline对象的临时方案
    for (let i = 0; i < 4; i++) {
      state.activeTexture(gl.TEXTURE0 + i);
      whiteGPUTexture.bind();
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

      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, (depthTexture.getGPUTexture() as GPUTextureWebGL).textureBuffer, 0);
    }
    this.resetColorTextures(this.colorTextures);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer failed. gl status=${status}, gl error=${gl.getError()}, gl isContextLost=${gl.isContextLost()}. width=${width}, height=${height}.`);
    }

    this.ready = true;
  }

  override resetColorTextures (colorTextures?: Texture[]) {
    const colors = colorTextures as Texture[];
    const gl = (this.device as RenderingDeviceWebGL).gl;
    const gpuCapability = (this.device as RenderingDeviceWebGL).gpuCapability;
    const viewport = this.viewport;
    const buffers: boolean[] = [];

    if (colors) {
      for (const texture of colors) {
        texture.initialize();
      }
      this.colorTextures = colors.slice();
    }
    (this.device as RenderingDeviceWebGL).activeTexture(gl.TEXTURE0);

    this.colorTextures.forEach((tex, index) => {
      const width = viewport[2];
      const height = viewport[3];
      const data = { width, height, data: new Uint8Array(0) };

      tex.update({ data });
      gpuCapability.framebufferTexture2D(gl, gl.FRAMEBUFFER, index, gl.TEXTURE_2D, (tex.getGPUTexture() as GPUTextureWebGL).textureBuffer);
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

  /**
   * 上下文恢复后重建 framebuffer 句柄。
   * 内部 renderbuffer 由RenderingDevice 的 renderbuffers 列表统一恢复，此处不重复处理。
   * 附件纹理由各自 Texture.restore 恢复，此处仅重置 ready 并清空附件缓存，
   * 让下次 bind 用各纹理的最新句柄重新挂载。
   */
  override restore (): void {
    if (!this.device || !this.useFbo) {
      return;
    }
    this.releaseGPU();
    this.initialize();
  }

  protected override onReleaseGPU (): void {
    const device = this.device as RenderingDeviceWebGL;

    device.invalidateFramebuffer(this.fbo!);
    if (!device.gl.isContextLost()) {
      device.gl.deleteFramebuffer(this.fbo!);
    }
    this.fbo = undefined;
    this.ready = false;
    this.attachmentTextures.length = 0;
  }

  override dispose (options?: { depthStencilAttachment?: RenderPassDestroyAttachmentType }) {
    if (this.destroyed) {
      return;
    }
    super.dispose();
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

    this.depthStencilRenderbuffer = undefined;
    this.depthTexture = this.stencilTexture = undefined;
    this.colorTextures = [];
    this.props = undefined;
  }
}
