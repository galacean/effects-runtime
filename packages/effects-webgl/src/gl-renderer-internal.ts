import type { Disposable, LostHandler, Material, Geometry } from '@galacean/effects-core';
import { TextureSourceType, addItem, removeItem, LOG_TYPE } from '@galacean/effects-core';
import type { GLFrameBuffer } from './gl-frame-buffer';
import type { GLGeometry } from './gl-geometry';
import type { GLGPUBuffer } from './gl-gpu-buffer';
import type { GLPipelineContext } from './gl-pipeline-context';
import type { GLRenderBuffer } from './gl-render-buffer';
import { GLTexture } from './gl-texture';
import { GLVertexArrayObject } from './gl-vertex-array-object';
import type { GLEngine } from './gl-engine';
import type { GLMaterial } from './gl-material';

let seed = 1;

export class GLRendererInternal implements Disposable, LostHandler {
  emptyTexture2D: GLTexture;
  emptyTextureCube: GLTexture;
  pipelineContext: GLPipelineContext;
  gl: WebGLRenderingContext | WebGL2RenderingContext;

  readonly name: string;
  readonly textures: GLTexture[] = [];

  private readonly renderBuffers: GLRenderBuffer[] = [];
  private readonly frameBuffers: GLFrameBuffer[] = [];
  private sourceFbo: WebGLFramebuffer | null;
  private targetFbo: WebGLFramebuffer | null;
  private destroyed = false;

  constructor (public engine: GLEngine) {
    const d = { width: 1, height: 1, data: new Uint8Array([255]) };
    const pipelineContext = engine.getGLPipelineContext();
    const gl = pipelineContext.gl;

    this.gl = gl;
    this.pipelineContext = pipelineContext;
    this.emptyTexture2D = new GLTexture(
      engine,
      {
        data: d,
        sourceType: TextureSourceType.data,
        format: gl.LUMINANCE,
        internalFormat: gl.LUMINANCE,
        type: gl.UNSIGNED_BYTE,
      }
    );
    this.emptyTexture2D.initialize();
    this.emptyTextureCube = new GLTexture(
      engine,
      {
        target: gl.TEXTURE_CUBE_MAP,
        cube: [d, d, d, d, d, d],
        sourceType: TextureSourceType.data,
        format: gl.LUMINANCE,
        internalFormat: gl.LUMINANCE,
        type: gl.UNSIGNED_BYTE,
      }
    );
    this.emptyTextureCube.initialize();
    this.name = 'GLGPURenderer' + seed;

    seed++;
  }

  get height () {
    return this.gl?.drawingBufferHeight;
  }

  get width () {
    return this.gl?.drawingBufferWidth;
  }

  get canvas () {
    return this.gl.canvas;
  }

  get isDestroyed () {
    return this.destroyed;
  }

  copy2 (source: GLTexture, target: GLTexture) {
    const gl = this.gl as WebGL2RenderingContext;

    if (gl) {
      if (!this.sourceFbo) {
        this.sourceFbo = gl.createFramebuffer();
      }
      if (!this.targetFbo) {
        this.targetFbo = gl.createFramebuffer();
      }
      const state = this.pipelineContext;
      const COLOR_ATTACHMENT0 = gl.COLOR_ATTACHMENT0;

      state.bindFramebuffer(gl.FRAMEBUFFER, this.sourceFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, COLOR_ATTACHMENT0, gl.TEXTURE_2D, source.textureBuffer, 0);
      state.bindFramebuffer(gl.FRAMEBUFFER, this.targetFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.textureBuffer, 0);
      state.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sourceFbo);
      state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.targetFbo);
      const filter = source.getWidth() === source.getHeight() && target.getWidth() == target.getHeight() ? gl.NEAREST : gl.LINEAR;

      gl.blitFramebuffer(0, 0, source.getWidth(), source.getHeight(), 0, 0, target.getWidth(), target.getHeight(), gl.COLOR_BUFFER_BIT, filter);
      state.bindFramebuffer(gl.FRAMEBUFFER, null);
      state.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
  }

  resetColorAttachments (rp: GLFrameBuffer, colors: GLTexture[]) {
    rp.bind();
    rp.resetColorTextures(colors);
  }

  createGLRenderBuffer (renderbuffer: GLRenderBuffer): WebGLRenderbuffer | null {
    const rb = this.gl.createRenderbuffer();

    if (rb) {
      addItem(this.renderBuffers, renderbuffer);
    }

    return rb;
  }

  resize (width: number, height: number): void {
    const gl = this.gl;

    if (gl && gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) {
      gl.canvas.width = width;
      gl.canvas.height = height;
      gl.viewport(0, 0, width, height);
      this.frameBuffers.forEach(frameBuffer => {
        const viewport = frameBuffer.viewport;

        if (!frameBuffer.isCustomViewport) {
          frameBuffer.resize(viewport[0], viewport[1], width * frameBuffer.viewportScale, height * frameBuffer.viewportScale);
        }
      });
    }
  }

  drawGeometry (geometry: Geometry, material: Material): void {
    if (!this.gl) {
      console.warn('GLGPURenderer没有绑定gl对象, 无法绘制geometry');

      return;
    }
    const glGeometry = geometry as GLGeometry;
    const glMaterial = material as GLMaterial;
    const program = glMaterial.shader.program;

    if (!program) {
      console.warn('Material ' + glMaterial.name + ' 的shader着色器程序未初始化。');

      return;
    }

    const vao = program.setupAttributes(glGeometry);

    const gl = this.gl;
    const indicesBuffer = glGeometry.indicesBuffer;
    const offset = glGeometry.drawStart;
    const mode = glGeometry.mode;
    let count = glGeometry.drawCount;

    if (indicesBuffer) {
      const { type, elementCount } = indicesBuffer;

      count = isNaN(count) ? elementCount : count;
      if (count > 0) {
        gl.drawElements(mode, count, type, offset ?? 0);
      }
    } else if (count > 0) {
      gl.drawArrays(mode, offset, count);
    }

    vao?.unbind();
  }

  createGLFrameBuffer (frameBuffer: GLFrameBuffer, name?: string): WebGLFramebuffer | null {
    const fbo = this.gl.createFramebuffer();

    if (fbo) {
      addItem(this.frameBuffers, frameBuffer);
      assignInspectorName(fbo, name, name);
    }

    return fbo;
  }

  /**创建包裹VAO对象。 */
  createVAO (name: string): GLVertexArrayObject | undefined {
    const ret = new GLVertexArrayObject(this.engine, name);

    return ret;
  }

  deleteGLTexture (texture: GLTexture) {
    if (texture.textureBuffer && !this.destroyed) {
      this.gl.deleteTexture(texture.textureBuffer);
      removeItem(this.textures, texture);
      // @ts-expect-error
      delete texture.textureBuffer;
    }
  }

  deleteGPUBuffer (buffer: GLGPUBuffer | null) {
    if (buffer && !this.destroyed) {
      this.gl.deleteBuffer(buffer.glBuffer);
      // @ts-expect-error
      delete buffer.glBuffer;
    }
  }

  deleteGLFrameBuffer (frameBuffer: GLFrameBuffer) {
    if (frameBuffer && !this.destroyed) {
      this.gl.deleteFramebuffer(frameBuffer.fbo as WebGLFramebuffer);
      removeItem(this.frameBuffers, frameBuffer);
      delete frameBuffer.fbo;
    }
  }

  deleteGLRenderBuffer (renderbuffer: GLRenderBuffer) {
    if (renderbuffer && !this.destroyed) {
      this.gl.deleteRenderbuffer(renderbuffer.buffer);
      removeItem(this.renderBuffers, renderbuffer);
      // @ts-expect-error
      delete renderbuffer.buffer;
    }
  }

  private deleteResource () {
    const gl = this.gl;

    if (gl) {
      gl.deleteFramebuffer(this.sourceFbo);
      gl.deleteFramebuffer(this.targetFbo);
      this.emptyTexture2D.dispose();
      this.emptyTextureCube.dispose();
      this.frameBuffers.forEach(fb => this.deleteGLFrameBuffer(fb));
      this.frameBuffers.length = 0;
      this.renderBuffers.forEach(rb => this.deleteGLRenderBuffer(rb));
      this.renderBuffers.length = 0;
      this.textures.forEach(tex => this.deleteGLTexture(tex));
      this.textures.length = 0;
    }
  }

  lost (e: Event) {
    console.error({
      content: 'gl lost, destroy glRenderer by default',
      type: LOG_TYPE,
    }, e.target);
    this.deleteResource();
  }

  dispose (haltGL?: boolean) {
    this.deleteResource();
    const gl = this.gl;

    if (gl && haltGL) {
      const ex = gl.getExtension('WEBGL_lose_context');

      ex?.loseContext();
    }
    // @ts-expect-error safe to assign
    this.emptyTexture2D = this.emptyTextureCube = this.pipelineContext = this.gpu = this.gl = null;
    this.destroyed = true;
  }
}

export function assignInspectorName (
  obj: Record<string, any>,
  name?: string,
  id?: string,
) {
  if (name === undefined) {
    return;
  }

  obj.__SPECTOR_Metadata = { name };
  if (obj.__SPECTOR_Object_TAG) {
    obj.__SPECTOR_Object_TAG.displayText = name;
    if (id) {
      obj.__SPECTOR_Object_TAG.id = id;
    }
  } else {
    obj.__SPECTOR_Object_TAG = {
      displayText: name,
      id: '',
    };
  }
}
