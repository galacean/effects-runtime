import type { FramebufferProps } from '@galacean/effects';
import { GPUFramebufferWebGL } from '@galacean/effects-webgl';
import type { EditorRenderingDevice } from './editor-rendering-device';

/** Resolves multisampled scene geometry into a texture for editor presentation. */
export class EditorRenderTarget extends GPUFramebufferWebGL {
  readonly samples: number;
  private multisampleFramebuffer?: WebGLFramebuffer;
  private colorBuffer?: WebGLRenderbuffer;
  private depthBuffer?: WebGLRenderbuffer;
  private allocatedWidth = 0;
  private allocatedHeight = 0;
  private pending = false;
  private readonly colorFormat: GLenum;

  constructor (private readonly editorDevice: EditorRenderingDevice, props: FramebufferProps) {
    const gl = editorDevice.gl;
    const colorFormat = props.attachments[0].source.type === gl.HALF_FLOAT ? gl.RGBA16F : gl.RGBA8;
    const colors: Int32Array = gl.getInternalformatParameter(gl.RENDERBUFFER, colorFormat, gl.SAMPLES);
    const depths: Int32Array = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, gl.SAMPLES);
    const samples = Math.max(0, ...Array.from(colors).filter(count => count <= 4 && depths.includes(count)));

    super(editorDevice, samples > 1 ? { ...props, depthStencilAttachment: undefined } : props);
    this.colorFormat = colorFormat; this.samples = samples;
  }

  get drawFramebuffer (): WebGLFramebuffer | undefined { return this.multisampleFramebuffer; }

  get byteSize (): number {
    const colorBytes = this.colorFormat === this.editorDevice.gl.RGBA16F ? 8 : 4;

    return this.viewport[2] * this.viewport[3] * (this.samples > 1 ? colorBytes + this.samples * (colorBytes + 4) : colorBytes + 4);
  }

  override bind (): void {
    if (!this.ready || this.samples <= 1) { super.bind(); }
    if (this.samples <= 1) { return; }
    const device = this.editorDevice, gl = device.gl;
    const [x, y, width, height] = this.viewport;

    if (!this.multisampleFramebuffer) {
      this.multisampleFramebuffer = gl.createFramebuffer()!;
      this.colorBuffer = gl.createRenderbuffer()!; this.depthBuffer = gl.createRenderbuffer()!;
    }
    device.bindFramebuffer(gl.FRAMEBUFFER, this.multisampleFramebuffer);
    if (this.allocatedWidth !== width || this.allocatedHeight !== height) {
      device.bindRenderbuffer(gl.RENDERBUFFER, this.colorBuffer!);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, this.colorFormat, width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.colorBuffer!);
      device.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer!);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.DEPTH24_STENCIL8, width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer!);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Unable to allocate multisampled editor viewport ${width}x${height}.`);
      }
      this.allocatedWidth = width; this.allocatedHeight = height;
    }
    device.setViewport(x, y, width, height);
    device.setMultisampleTarget(this); this.pending = true;
  }

  override resize (x: number, y: number, width: number, height: number): void {
    if (this.viewport[2] !== width || this.viewport[3] !== height) { this.editorDevice.resolveFramebuffer(); }
    super.resize(x, y, width, height);
  }

  resolve (): void {
    if (!this.pending || !this.multisampleFramebuffer || !this.fbo) { return; }
    const gl = this.editorDevice.gl, width = this.allocatedWidth, height = this.allocatedHeight;
    const read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const draw = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const scissor = gl.isEnabled(gl.SCISSOR_TEST);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.multisampleFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fbo);
    if (scissor) { gl.disable(gl.SCISSOR_TEST); }
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw);
    if (scissor) { gl.enable(gl.SCISSOR_TEST); }
    this.pending = false;
  }

  protected override onReleaseGPU (): void {
    const device = this.editorDevice, gl = device.gl;

    if (this.multisampleFramebuffer) { device.invalidateFramebuffer(this.multisampleFramebuffer); }
    if (this.colorBuffer) { device.invalidateRenderbuffer(this.colorBuffer); }
    if (this.depthBuffer) { device.invalidateRenderbuffer(this.depthBuffer); }
    if (!gl.isContextLost()) {
      if (this.multisampleFramebuffer) { gl.deleteFramebuffer(this.multisampleFramebuffer); }
      if (this.colorBuffer) { gl.deleteRenderbuffer(this.colorBuffer); }
      if (this.depthBuffer) { gl.deleteRenderbuffer(this.depthBuffer); }
    }
    this.multisampleFramebuffer = undefined; this.colorBuffer = this.depthBuffer = undefined;
    this.allocatedWidth = this.allocatedHeight = 0; this.pending = false;
    super.onReleaseGPU();
  }
}
