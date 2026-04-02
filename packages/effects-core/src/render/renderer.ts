import type { Matrix4, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { RendererComponent } from '../components';
import type { Engine } from '../engine';
import { Material } from '../material';
import { sortByOrder } from '../utils';
import type { FilterMode, Framebuffer, RenderTextureFormat } from './framebuffer';
import { Geometry } from './geometry';
import type { RenderFrame } from './render-frame';
import type { RenderPass, RenderPassClearAction } from './render-pass';
import type { ShaderLibrary } from './shader';
import type { Texture } from '../texture';
import { math } from '..';
import { glContext } from '../gl';

// Blit shader 定义
const BLIT_VERTEX_SHADER = `
precision highp float;
attribute vec2 aPos;
varying vec2 vTex;
void main(){
    gl_Position = vec4(aPos, 0.0, 1.0);
    vTex = (aPos + vec2(1.0)) / 2.0;
}`;

const BLIT_FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vTex;
uniform sampler2D _MainTex;
void main(){
    gl_FragColor = texture2D(_MainTex, vTex);
}`;

export class Renderer {
  static create: (engine: Engine) => Renderer;

  /**
  * 存放渲染需要用到的数据
  */
  // renderingData: RenderingData;
  protected currentFramebuffer: Framebuffer | null = null;
  protected disposed = false;

  private blitGeometry: Geometry | null = null;
  private blitMaterial: Material | null = null;

  constructor (public engine: Engine) {
  }

  get renderingData () {
    return this.engine.renderingData;
  }

  setGlobalFloat (name: string, value: number) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.floats[name] = value;
  }

  setGlobalVector4 (name: string, value: Vector4) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.vector4s[name] = value;
  }

  setGlobalInt (name: string, value: number) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.ints[name] = value;
  }

  setGlobalMatrix (name: string, value: Matrix4) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.matrices[name] = value;
  }

  setGlobalVector3 (name: string, value: Vector3) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.vector3s[name] = value;
  }

  getFramebuffer (): Framebuffer {
    return this.currentFramebuffer as Framebuffer;
  }

  setFramebuffer (framebuffer: Framebuffer | null) {
    if (framebuffer) {
      this.currentFramebuffer = framebuffer;
      this.currentFramebuffer.bind();
      this.setViewport(framebuffer.viewport[0], framebuffer.viewport[1], framebuffer.viewport[2], framebuffer.viewport[3]);
    } else {
      this.currentFramebuffer = null;
      this.engine.bindSystemFramebuffer();
      this.setViewport(0, 0, this.getWidth(), this.getHeight());
    }
  }

  setViewport (x: number, y: number, width: number, height: number) {
    this.engine.viewport(x, y, width, height);
  }

  clear (action: RenderPassClearAction) {
    this.engine.clear(action);
  }

  getWidth (): number {
    return this.engine.getWidth();
  }

  getHeight (): number {
    return this.engine.getHeight();
  }

  /**
   *
   * @override
   * @returns
   */
  getShaderLibrary (): ShaderLibrary | null {
    return this.engine.getShaderLibrary();
  }

  renderRenderFrame (renderFrame: RenderFrame) {
    const frame = renderFrame;
    const passes = frame.renderPasses;

    if (this.disposed) {
      console.error('Renderer is destroyed, target: GLRenderer.');

      return;
    }

    frame.renderer.engine.getShaderLibrary()?.compileAllShaders();
    frame.setup();

    this.setFramebuffer(null);

    const currentCamera = frame.camera;

    this.renderingData.currentFrame = frame;
    this.renderingData.currentCamera = currentCamera;

    this.setGlobalMatrix('effects_MatrixInvV', currentCamera.getInverseViewMatrix());
    this.setGlobalMatrix('effects_MatrixV', currentCamera.getViewMatrix());
    this.setGlobalMatrix('effects_MatrixVP', currentCamera.getViewProjectionMatrix());
    this.setGlobalMatrix('_MatrixP', currentCamera.getProjectionMatrix());
    this.setGlobalVector3('effects_WorldSpaceCameraPos', currentCamera.position);

    // 根据 priority 排序 pass
    sortByOrder(passes);

    for (const pass of passes) {
      this.renderRenderPass(pass);
    }

    for (const pass of passes) {
      pass.onCameraCleanup(this);
    }
  }

  renderRenderPass (pass: RenderPass): void {
    this.renderingData.currentPass = pass;
    // 配置当前 renderer 的 RT
    pass.configure(this);
    // 执行当前 pass
    pass.execute(this);
  }

  renderMeshes (meshes: RendererComponent[]) {
    for (const mesh of meshes) {
      mesh.render(this);
    }
  }

  drawGeometry (geometry: Geometry, matrix: Matrix4, material: Material, subMeshIndex = 0) {
    this.engine.drawGeometry(geometry, matrix, material, subMeshIndex);
  }

  getTemporaryRT (
    name: string,
    width: number,
    height: number,
    depthBuffer: number,
    filter: FilterMode,
    format: RenderTextureFormat,
  ): Framebuffer {
    return this.engine.renderTargetPool.get(name, width, height, depthBuffer, filter, format);
  }

  releaseTemporaryRT (rt: Framebuffer): void {
    this.engine.renderTargetPool.release(rt);
  }

  /**
   * 将源纹理复制到目标 Framebuffer，可使用自定义材质进行处理
   * @param source - 源纹理
   * @param destination - 目标 Framebuffer，如果为 null 则渲染到屏幕
   * @param material - 可选的自定义材质，不传则使用默认复制材质
   */
  blit (source: Texture, destination: Framebuffer | null, material?: Material): void {
    // 懒加载创建 blit geometry
    if (!this.blitGeometry) {
      this.blitGeometry = Geometry.create(this.engine, {
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
    }

    // 懒加载创建默认 blit material
    if (!this.blitMaterial) {
      this.blitMaterial = Material.create(this.engine, {
        shader: {
          vertex: BLIT_VERTEX_SHADER,
          fragment: BLIT_FRAGMENT_SHADER,
        },
      });
      this.blitMaterial.blending = false;
      this.blitMaterial.depthTest = false;
      this.blitMaterial.culling = false;
    }

    const blitMat = material || this.blitMaterial;

    // 设置源纹理
    blitMat.setTexture('_MainTex', source);

    // 保存当前 framebuffer
    const prevFramebuffer = this.currentFramebuffer;

    // 设置目标
    if (destination) {
      const [x, y, width, height] = destination.viewport;

      this.setFramebuffer(destination);
      this.setViewport(x, y, width, height);
    } else {
      // 渲染到屏幕
      this.setFramebuffer(null);
      this.setViewport(0, 0, this.getWidth(), this.getHeight());
    }

    this.drawGeometry(this.blitGeometry, math.Matrix4.IDENTITY, blitMat);

    // 恢复之前的 framebuffer
    this.setFramebuffer(prevFramebuffer);
  }

  dispose (): void {
    if (this.disposed) {
      return;
    }

    this.blitGeometry?.dispose();
    this.blitGeometry = null;
    this.blitMaterial?.dispose();
    this.blitMaterial = null;

    this.disposed = true;
  }

  private checkGlobalUniform (name: string) {
    const globalUniforms = this.renderingData.currentFrame.globalUniforms;

    if (!globalUniforms.uniforms.includes(name)) {
      globalUniforms.uniforms.push(name);
    }
  }
}
