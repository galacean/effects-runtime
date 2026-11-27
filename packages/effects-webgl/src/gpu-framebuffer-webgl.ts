import type {
  FramebufferProps, RenderPassStoreAction,
} from '@galacean/effects-core';
import {
  isWebGL2, addItem, GPUFramebuffer, Texture, glContext, RenderPassAttachmentStorageType,
  RenderPassDestroyAttachmentType, TextureSourceType, TextureStoreAction,
} from '@galacean/effects-core';
import { assignInspectorName } from './debug-utils';
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
  private multisampleFbo?: WebGLFramebuffer;
  private readonly multisampleColorBuffers: GPURenderbufferWebGL[] = [];
  private multisampleDepthBuffer?: GPURenderbufferWebGL;
  private readonly requestedSamples: number;
  private sampleCount = 1;
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
    this.requestedSamples = props.samples ?? 1;
  }

  override get samples (): number {
    return this.sampleCount;
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
      tex.updateSource({ data });
      addItem(this.attachmentTextures, (tex.getGPUTexture() as GPUTextureWebGL).textureBuffer);
    });

    if (this.stencilTexture) {
      addItem(this.attachmentTextures, (this.stencilTexture.getGPUTexture() as GPUTextureWebGL).textureBuffer);
    }

    if (this.depthTexture) {
      this.depthTexture.updateSource({ data: { width, height, data: new Uint16Array(0) } });
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
          minFilter: glContext.NEAREST,
          magFilter: glContext.NEAREST,
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
          minFilter: glContext.NEAREST,
          magFilter: glContext.NEAREST,
          name: `${this.name}##dpthStclTex`,
        });
        this.depthTexture.initialize();
        separateDepthStencil = true;

        break;
    }

    this.storeInvalidAttachments = this.getStoreAttachments(this.storeAction, separateDepthStencil);
    this.updateAttachmentTextures();
    this.updateMultisampleBuffers();
  }

  private updateMultisampleBuffers (): void {
    const device = this.device as RenderingDeviceWebGL;
    const gl = device.gl;

    if (!isWebGL2(gl) || this.requestedSamples === 1 || !this.useFbo || this.externalStorage) {
      return;
    }

    // Unsized byte texture formats have corresponding sized renderbuffer formats.
    const sizedFormats: Record<number, GLenum> = {
      [gl.RGBA]: gl.RGBA8,
      [gl.RGB]: gl.RGB8,
      [gl.RED]: gl.R8,
      [gl.RG]: gl.RG8,
    };
    const colorFormats = this.colorTextures.map(texture => {
      const format = (texture.getGPUTexture() as GPUTextureWebGL).internalFormat;

      return sizedFormats[format] ?? format;
    });
    const depthFormat = this.depthTexture
      ? (this.depthTexture.getGPUTexture() as GPUTextureWebGL).internalFormat
      : this.depthStencilRenderbuffer?.format;
    const sizedDepthFormat = depthFormat === gl.DEPTH_STENCIL ? gl.DEPTH24_STENCIL8 : depthFormat;
    const formats = sizedDepthFormat ? [...colorFormats, sizedDepthFormat] : colorFormats;
    let supported: number[] | undefined;

    for (const format of formats) {
      const counts = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, format, gl.SAMPLES) as Int32Array);

      supported = supported ? supported.filter(count => counts.includes(count)) : counts;
    }
    const samples = Math.max(1, ...(supported ?? []).filter(count => count <= this.requestedSamples));

    if (samples === this.sampleCount &&
      this.multisampleColorBuffers.length === colorFormats.length &&
      this.multisampleColorBuffers.every((buffer, index) => buffer.format === colorFormats[index]) &&
      this.multisampleDepthBuffer?.format === sizedDepthFormat) {
      return;
    }
    this.disposeMultisampleBuffers();
    this.sampleCount = samples;
    if (samples === 1) {
      return;
    }
    for (let index = 0; index < colorFormats.length; index++) {
      const buffer = device.createRenderbuffer({
        storageType: RenderPassAttachmentStorageType.color,
        format: colorFormats[index],
        attachment: gl.COLOR_ATTACHMENT0 + index,
        samples,
      });

      buffer.initialize();
      this.multisampleColorBuffers.push(buffer);
    }
    if (sizedDepthFormat) {
      this.multisampleDepthBuffer = device.createRenderbuffer({
        storageType: this.depthStencilStorageType,
        format: sizedDepthFormat,
        attachment: this.depthStencilRenderbuffer?.attachment ?? (this.stencilTexture ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT),
        samples,
      });
      this.multisampleDepthBuffer.initialize();
    }
  }

  private bindMultisampleAttachments (): void {
    if (this.sampleCount === 1) {
      return;
    }
    const device = this.device as RenderingDeviceWebGL;
    const gl = device.gl;

    if (!this.multisampleFbo) {
      this.multisampleFbo = gl.createFramebuffer() ?? undefined;
      if (!this.multisampleFbo) {
        throw new Error(`Failed to create multisample framebuffer: ${this.name}.`);
      }
      assignInspectorName(this.multisampleFbo, `${this.name}##msaa`);
    }
    device.bindFramebuffer(gl.FRAMEBUFFER, this.multisampleFbo);
    const buffers = this.multisampleDepthBuffer
      ? [...this.multisampleColorBuffers, this.multisampleDepthBuffer]
      : this.multisampleColorBuffers;

    for (const buffer of buffers) {
      buffer.setSize(this.viewport[2], this.viewport[3]);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, buffer.attachment, gl.RENDERBUFFER, buffer.buffer);
    }
    gl.drawBuffers(this.multisampleColorBuffers.map(buffer => buffer.attachment));
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Multisample framebuffer failed. gl status=${status}, samples=${this.sampleCount}.`);
    }
  }

  override resolve (): void {
    if (!this.ready || !this.multisampleFbo || !this.fbo) {
      return;
    }
    const device = this.device as RenderingDeviceWebGL;
    const gl = device.gl;
    const readFramebuffer = device.getFramebufferBinding(gl.READ_FRAMEBUFFER);
    const drawFramebuffer = device.getFramebufferBinding(gl.DRAW_FRAMEBUFFER);
    const scissorEnabled = device.isEnabled(gl.SCISSOR_TEST);
    const [, , width, height] = this.viewport;
    const attachments = this.multisampleColorBuffers.map(buffer => buffer.attachment);
    let depthStencilMask = 0;

    if (this.depthTexture || this.depthStorage) {
      depthStencilMask |= gl.DEPTH_BUFFER_BIT;
    }
    if (this.stencilTexture || this.stencilStorage) {
      depthStencilMask |= gl.STENCIL_BUFFER_BIT;
    }
    try {
      device.disable(gl.SCISSOR_TEST);
      device.bindFramebuffer(gl.READ_FRAMEBUFFER, this.multisampleFbo);
      device.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fbo);
      for (let index = 0; index < attachments.length; index++) {
        gl.readBuffer(attachments[index]);
        gl.drawBuffers(attachments.map((attachment, i) => i === index ? attachment : gl.NONE));
        gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height,
          gl.COLOR_BUFFER_BIT | (index === 0 ? depthStencilMask : 0), gl.NEAREST);
      }
    } finally {
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.drawBuffers(attachments);
      device.bindFramebuffer(gl.READ_FRAMEBUFFER, readFramebuffer);
      device.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawFramebuffer);
      if (scissorEnabled) {
        device.enable(gl.SCISSOR_TEST);
      }
    }
  }

  private disposeMultisampleBuffers (): void {
    for (const buffer of this.multisampleColorBuffers) {
      buffer.dispose();
    }
    this.multisampleColorBuffers.length = 0;
    this.multisampleDepthBuffer?.dispose();
    this.multisampleDepthBuffer = undefined;
    if (this.multisampleFbo) {
      const device = this.device as RenderingDeviceWebGL;

      device.invalidateFramebuffer(this.multisampleFbo);
      if (!device.gl.isContextLost()) {
        device.gl.deleteFramebuffer(this.multisampleFbo);
      }
      this.multisampleFbo = undefined;
    }
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
    this.resolve();
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

    state.bindFramebuffer(gl.FRAMEBUFFER, this.ready && this.multisampleFbo ? this.multisampleFbo : this.fbo);

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
      depthTexture.updateSource({ data: { width, height, data: new Uint16Array(0) } });
      const attachment = depthTexture && stencilTexture ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;

      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, (depthTexture.getGPUTexture() as GPUTextureWebGL).textureBuffer, 0);
    }
    this.bindColorAttachments();
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer failed. gl status=${status}, gl error=${gl.getError()}, gl isContextLost=${gl.isContextLost()}. width=${width}, height=${height}.`);
    }

    this.bindMultisampleAttachments();
    this.ready = true;
  }

  override resetColorTextures (colorTextures: Texture[]) {
    this.colorTextures = colorTextures.slice();
    this.updateAttachmentTextures();
    this.updateMultisampleBuffers();
    this.ready = false;
    this.bind();
  }

  private bindColorAttachments () {
    const gl = (this.device as RenderingDeviceWebGL).gl;
    const gpuCapability = (this.device as RenderingDeviceWebGL).gpuCapability;
    const viewport = this.viewport;
    const buffers: boolean[] = [];

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
    if (this.multisampleFbo) {
      device.invalidateFramebuffer(this.multisampleFbo);
      if (!device.gl.isContextLost()) {
        device.gl.deleteFramebuffer(this.multisampleFbo);
      }
      this.multisampleFbo = undefined;
    }
    this.ready = false;
    this.attachmentTextures.length = 0;
  }

  override dispose (options?: { depthStencilAttachment?: RenderPassDestroyAttachmentType }) {
    if (this.destroyed) {
      return;
    }
    super.dispose();
    this.disposeMultisampleBuffers();
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
