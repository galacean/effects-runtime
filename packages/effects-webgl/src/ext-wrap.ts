import type { Disposable, FrameBuffer, Renderer, SharedShaderWithSource } from '@galacean/effects-core';
import {
  createShaderWithMarcos,
  glContext,
  GLSLVersion,
  RenderPass,
  ShaderType,
  TextureLoadAction,
  TextureSourceType,
  Mesh,
} from '@galacean/effects-core';
import type { GLFrameBuffer } from './gl-frame-buffer';
import { GLGeometry } from './gl-geometry';
import { GLMaterial } from './gl-material';
import type { GLRenderer } from './gl-renderer';
import type { GLTexture } from './gl-texture';

/**
 * 常用的 GPU 方法，不是规范必须实现的
 */
export interface RendererExtensions {
  copyTexture?: (source: GLTexture, tex: GLTexture) => void,
  resetColorAttachments?: (rp: RenderPass, colorAttachments: GLTexture[]) => void,
}

const copyShaderId = '$mri-internal-copy';

export class ExtWrap implements RendererExtensions, Disposable {
  private copyRenderPass?: RenderPass;

  constructor (
    public readonly renderer: GLRenderer
  ) {
    if (renderer.engine.gpuCapability.level === 1) {
      this.copyRenderPass = this.createCopyRenderPass().initialize(renderer);
      const shaderSource = this.copyRenderPass.meshes[0].material.shaderSource as SharedShaderWithSource;

      renderer.pipelineContext.shaderLibrary.addShader(shaderSource);
    }
  }

  resetColorAttachments (rp: RenderPass, colorTextures: GLTexture[]) {
    if (this.renderer) {
      rp.resetColorAttachments(colorTextures);
    }
  }

  copyTexture (source: GLTexture, tex: GLTexture): void {
    if (!this.renderer) {
      return;
    }

    source.initialize();
    tex.initialize();
    tex.updateSource({
      sourceType: TextureSourceType.framebuffer,
      data: {
        width: tex.getWidth() || source.getWidth(),
        height: tex.getHeight() || source.getHeight(),
      },
    });
    if (this.renderer.engine.gpuCapability.level === 2) {
      this.copy2(source, tex);
    } else {
      this.copy1(source, tex);
    }
  }

  copy2 (source: GLTexture, target: GLTexture) {
    // 保存当前的 fbo
    const frameBuffer = this.renderer.getFrameBuffer();

    this.renderer?.glRenderer.copy2(source, target);
    // 还原 fbo
    this.renderer.setFrameBuffer(frameBuffer);
  }

  copy1 (source: GLTexture, target: GLTexture) {
    const rp = this.copyRenderPass;

    if (rp) {
      const renderer = this.renderer;

      if (renderer) {
        const fb = rp.frameBuffer as GLFrameBuffer;

        fb.viewport[2] = target.getWidth() || source.getWidth();
        fb.viewport[3] = target.getHeight() || source.getHeight();
        renderer.glRenderer.resetColorAttachments(fb, [target]);
        const mesh = rp.meshes[0];

        mesh.material.setTexture('uTex', source);
        renderer.renderRenderPass(rp);
      }
    }
  }

  private createCopyRenderPass (): RenderPass {
    const name = 'mri-copy-mesh';
    const attachment = { texture: { format: glContext.RGBA } };
    const engine = this.renderer.engine;
    const geometry = new GLGeometry(
      engine,
      {
        name,
        mode: glContext.TRIANGLE_STRIP,
        attributes: {
          aPos: {
            type: glContext.FLOAT,
            size: 2,
            data: new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]),
          },
        },
        drawCount: 4,
      });
    const vertexShader = `
        precision highp float;
      attribute vec2 aPos;
      varying vec2 vTex;
      void main(){
         gl_Position = vec4(aPos,0.,1.0);
         vTex = (aPos + vec2(1.))/2.;
       }
      `;
    const fragmentShader = `
        precision highp float;
      varying vec2 vTex;
      uniform sampler2D uTex;
      void main(){gl_FragColor = texture2D(uTex,vTex);}
      `;
    const { level } = engine.gpuCapability;
    const material = new GLMaterial(
      engine,
      {
        name,
        shader: {
          cacheId: copyShaderId,
          name,
          vertex: createShaderWithMarcos([], vertexShader, ShaderType.vertex, level),
          fragment: createShaderWithMarcos([], fragmentShader, ShaderType.fragment, level),
          glslVersion: level === 2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1,
        },
      });

    material.blending = false;
    material.depthTest = false;
    material.culling = false;

    const mesh = new Mesh(engine, {
      name, geometry, material,
      priority: 0,
    });

    return new CopyTexturePass(this.renderer, {
      name: 'mri-copy-rp',
      clearAction: {
        colorAction: TextureLoadAction.whatever,
      },
      attachments: [attachment],
      meshes: [mesh],
    });
  }

  dispose () {
    if (this.renderer) {
      this.copyRenderPass?.dispose();
      // @ts-expect-error
      this.renderer = undefined;
    }
  }
}

class CopyTexturePass extends RenderPass {
  currentFrameBuffer: FrameBuffer;

  override configure (renderer: Renderer): void {
    this.currentFrameBuffer = renderer.getFrameBuffer()!;
    renderer.setFrameBuffer(this.frameBuffer!);
  }

  override execute (renderer: Renderer): void {
    if (this.clearAction) {
      renderer.clear(this.clearAction);
    }
    renderer.renderMeshes(this.meshes);
    if (this.storeAction) {
      renderer.clear(this.storeAction);
    }
    renderer.setFrameBuffer(this.currentFrameBuffer);
  }
}
