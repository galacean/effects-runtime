import type { Disposable, LostHandler, Material, Geometry } from '@galacean/effects-core';
import { TextureSourceType, addItem, logger, removeItem } from '@galacean/effects-core';
import type { GLFramebuffer } from './gl-framebuffer';
import type { GLGeometry } from './gl-geometry';
import type { GLGPUBuffer } from './gl-gpu-buffer';
import type { GLMaterial } from './gl-material';
import type { GLPipelineContext } from './gl-pipeline-context';
import type { GLRenderbuffer } from './gl-renderbuffer';
import { GLTexture } from './gl-texture';
import { GLVertexArrayObject } from './gl-vertex-array-object';
import type { GLEngine } from './gl-engine';
import type { GLShaderVariant } from './gl-shader';

let seed = 1;

export class GLRendererInternal implements Disposable, LostHandler {
  emptyTexture2D: GLTexture;
  emptyTextureCube: GLTexture;
  pipelineContext: GLPipelineContext;
  gl: WebGLRenderingContext | WebGL2RenderingContext;

  readonly name: string;
  readonly textures: GLTexture[] = [];

  private readonly renderbuffers: GLRenderbuffer[] = [];
  private readonly framebuffers: GLFramebuffer[] = [];
  private sourceFbo: WebGLFramebuffer | null;
  private targetFbo: WebGLFramebuffer | null;
  private destroyed = false;

  constructor (
    public engine: GLEngine,
  ) {
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

    if (!gl) {
      return;
    }

    if (!this.sourceFbo) {
      this.sourceFbo = gl.createFramebuffer();
    }
    if (!this.targetFbo) {
      this.targetFbo = gl.createFramebuffer();
    }
    const state = this.pipelineContext;

    state.bindFramebuffer(gl.FRAMEBUFFER, this.sourceFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, source.textureBuffer, 0);
    state.bindFramebuffer(gl.FRAMEBUFFER, this.targetFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.textureBuffer, 0);
    state.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sourceFbo);
    state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.targetFbo);

    const filter = source.getWidth() === source.getHeight() && target.getWidth() == target.getHeight() ? gl.NEAREST : gl.LINEAR;

    gl.blitFramebuffer(0, 0, source.getWidth(), source.getHeight(), 0, 0, target.getWidth(), target.getHeight(), gl.COLOR_BUFFER_BIT, filter);
    state.bindFramebuffer(gl.FRAMEBUFFER, null);
    state.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  resetColorAttachments (rp: GLFramebuffer, colors: GLTexture[]) {
    rp.bind();
    rp.resetColorTextures(colors);
  }

  createGLRenderbuffer (renderbuffer: GLRenderbuffer): WebGLRenderbuffer | null {
    const rb = this.gl.createRenderbuffer();

    if (rb) {
      addItem(this.renderbuffers, renderbuffer);
    }

    return rb;
  }

  resize (width: number, height: number): void {
    const gl = this.gl;

    if (gl && gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) {
      gl.canvas.width = width;
      gl.canvas.height = height;
      gl.viewport(0, 0, width, height);
      this.framebuffers.forEach(framebuffer => {
        const viewport = framebuffer.viewport;

        if (!framebuffer.isCustomViewport) {
          framebuffer.resize(viewport[0], viewport[1], width * framebuffer.viewportScale, height * framebuffer.viewportScale);
        }
      });
    }
  }

  drawGeometry (geometry: Geometry, material: Material, subMeshIndex: number): void {
    if (!this.gl) {
      console.warn('GLGPURenderer has not bound a gl object, unable to render geometry.');

      return;
    }
    const glGeometry = geometry as GLGeometry;
    const glMaterial = material as GLMaterial;
    const program = (glMaterial.shaderVariant as GLShaderVariant).program;

    if (!program) {
      return;
    }

    const vao = program.setupAttributes(glGeometry);
    const gl = this.gl;
    const indicesBuffer = glGeometry.indicesBuffer;
    let offset = glGeometry.drawStart;
    let count = glGeometry.drawCount;
    const mode = glGeometry.mode;
    const subMeshes = glGeometry.subMeshes;

    if (subMeshes && subMeshes.length) {
      const subMesh = subMeshes[subMeshIndex];

      // FIXME: 临时处理3D线框状态下隐藏模型
      if (count < 0) {
        return;
      }
      offset = subMesh.offset;
      if (indicesBuffer) {
        count = subMesh.indexCount ?? 0;
      } else {
        count = subMesh.vertexCount;
      }
    }
    if (indicesBuffer) {
      gl.drawElements(mode, count, indicesBuffer.type, offset ?? 0);
    } else {
      gl.drawArrays(mode, offset, count);
    }
    vao?.unbind();
  }

  createGLFramebuffer (framebuffer: GLFramebuffer, name?: string): WebGLFramebuffer | null {
    const fbo = this.gl.createFramebuffer();

    if (fbo) {
      addItem(this.framebuffers, framebuffer);
      assignInspectorName(fbo, name, name);
    } else {
      throw new Error('Failed to create WebGL framebuffer');
    }

    return fbo;
  }

  /**创建包裹VAO对象。 */
  createVAO (name?: string): GLVertexArrayObject | undefined {
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

  deleteGLFramebuffer (framebuffer: GLFramebuffer) {
    if (framebuffer && !this.destroyed) {
      this.gl.deleteFramebuffer(framebuffer.fbo as WebGLFramebuffer);
      removeItem(this.framebuffers, framebuffer);
      delete framebuffer.fbo;
    }
  }

  deleteGLRenderbuffer (renderbuffer: GLRenderbuffer) {
    if (renderbuffer && !this.destroyed) {
      this.gl.deleteRenderbuffer(renderbuffer.buffer);
      removeItem(this.renderbuffers, renderbuffer);
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
      this.framebuffers.forEach(fb => this.deleteGLFramebuffer(fb));
      this.framebuffers.length = 0;
      this.renderbuffers.forEach(rb => this.deleteGLRenderbuffer(rb));
      this.renderbuffers.length = 0;
      this.textures.forEach(tex => this.deleteGLTexture(tex));
      this.textures.length = 0;
    }
  }

  lost (e: Event) {
    logger.error(`WebGL context lost, destroying glRenderer by default to prevent memory leaks. Event target: ${e.target}.`);
    this.deleteResource();
  }

  dispose () {
    this.deleteResource();
    // @ts-expect-error safe to assign
    this.emptyTexture2D = this.emptyTextureCube = this.pipelineContext = this.gpu = this.gl = null;
    this.destroyed = true;
  }
}

export function assignInspectorName (
  obj: Record<string, any> | null,
  name?: string,
  id?: string,
) {
  if (name === undefined || obj === null) {
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
