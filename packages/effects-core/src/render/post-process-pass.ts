import { GLSLVersion } from './shader';
import { glContext } from '../gl';
import { Material } from '../material';
import type { Texture } from '../texture';
import { Geometry } from './geometry';
import { Mesh } from './mesh';
import { getTextureSize } from './render-frame';
import type { RenderPassOptions } from './render-pass';
import { RenderTargetHandle, TextureStoreAction } from './render-pass';
import { RenderPass } from './render-pass';
import type { Renderer } from './renderer';
import type { ShaderWithSource } from './shader';
import { colorGradingFrag, gaussianDownHFrag, gaussianDownVFrag, gaussianUpFrag, screenMeshVert, thresholdFrag } from '../shader';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';

// Bloom 阈值 Pass
export class BloomThresholdPass extends RenderPass {
  sceneTextureHandle: RenderTargetHandle;

  private mainTexture: Texture;
  private screenMesh: Mesh;

  constructor (renderer: Renderer, option: RenderPassOptions) {
    super(renderer, option);
    const engine = this.renderer.engine;
    const geometry = Geometry.create(engine, {
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

    const material = Material.create(engine, {
      shader: {
        vertex: screenMeshVert,
        fragment: thresholdFrag,
        glslVersion: GLSLVersion.GLSL1,
      },
    });

    material.blending = false;
    material.depthTest = false;
    material.culling = false;

    this.screenMesh = Mesh.create(engine, {
      geometry, material,
      priority: 0,
    });
    this.priority = 5000;
  }

  override configure (renderer: Renderer): void {
    this.mainTexture = renderer.getFramebuffer()!.getColorTextures()[0];
    this.sceneTextureHandle.texture = this.mainTexture;
    renderer.setFramebuffer(this.framebuffer);
  }

  override execute (renderer: Renderer): void {
    renderer.clear({
      colorAction: TextureStoreAction.clear,
      depthAction: TextureStoreAction.clear,
      stencilAction: TextureStoreAction.clear,
    });
    this.screenMesh.material.setTexture('_MainTex', this.mainTexture);
    const threshold = renderer.renderingData.currentFrame.globalVolume.threshold;

    this.screenMesh.material.setFloat('_Threshold', threshold);
    renderer.renderMeshes([this.screenMesh]);
  }
}

export class HQGaussianDownSamplePass extends RenderPass {
  gaussianResult: RenderTargetHandle;

  private mainTexture: Texture;
  private screenMesh: Mesh;
  private readonly type: 'V' | 'H';

  constructor (renderer: Renderer,
    type: 'V' | 'H',
    options: RenderPassOptions,
  ) {
    super(renderer, options);
    this.type = type;
    const engine = this.renderer.engine;
    const name = 'PostProcess';
    const geometry = Geometry.create(engine, {
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

    const fragment = type == 'H' ? gaussianDownHFrag : gaussianDownVFrag;
    const shader: ShaderWithSource = {
      vertex: screenMeshVert,
      fragment,
      glslVersion: GLSLVersion.GLSL1,
    };

    const material = Material.create(engine, {
      name,
      shader,
    });

    material.blending = false;
    material.depthTest = false;
    material.culling = false;

    this.screenMesh = Mesh.create(engine, {
      name, geometry, material,
      priority: 0,
    });
    this.priority = 5000;
  }

  override configure (renderer: Renderer): void {
    this.mainTexture = renderer.getFramebuffer()!.getColorTextures()[0];
    renderer.setFramebuffer(this.framebuffer);
  }

  override execute (renderer: Renderer): void {
    renderer.clear({
      colorAction: TextureStoreAction.clear,
      depthAction: TextureStoreAction.clear,
      stencilAction: TextureStoreAction.clear,
    });
    this.screenMesh.material.setTexture('_MainTex', this.mainTexture);
    this.screenMesh.material.setVector2('_TextureSize', getTextureSize(this.mainTexture));
    renderer.renderMeshes([this.screenMesh]);
    if (this.type === 'V') {
      this.gaussianResult.texture = renderer.getFramebuffer()!.getColorTextures()[0];
    }
  }
}

export class HQGaussianUpSamplePass extends RenderPass {
  gaussianDownSampleResult: RenderTargetHandle;

  private mainTexture: Texture;
  private screenMesh: Mesh;

  constructor (renderer: Renderer, options: RenderPassOptions) {
    super(renderer, options);

    const name = 'PostProcess';
    const engine = this.renderer.engine;
    const geometry = Geometry.create(engine, {
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
    const shader: ShaderWithSource = { vertex: screenMeshVert, fragment: gaussianUpFrag };
    const material = Material.create(engine, {
      name,
      shader,
    });

    material.blending = false;
    material.depthTest = false;
    material.culling = false;

    this.screenMesh = Mesh.create(engine, {
      name, geometry, material,
      priority: 0,
    });
    this.priority = 5000;
  }

  override configure (renderer: Renderer): void {
    this.mainTexture = renderer.getFramebuffer()!.getColorTextures()[0];
    renderer.setFramebuffer(this.framebuffer);
  }

  override execute (renderer: Renderer): void {
    renderer.clear({
      colorAction: TextureStoreAction.clear,
      depthAction: TextureStoreAction.clear,
      stencilAction: TextureStoreAction.clear,
    });
    this.screenMesh.material.setTexture('_MainTex', this.mainTexture);
    this.screenMesh.material.setTexture('_GaussianDownTex', this.gaussianDownSampleResult.texture);
    this.screenMesh.material.setVector2('_GaussianDownTextureSize', getTextureSize(this.gaussianDownSampleResult.texture));
    renderer.renderMeshes([this.screenMesh]);
  }
}

// 合并Bloom的高斯模糊结果，并应用ACES Tonemapping
export class ToneMappingPass extends RenderPass {
  private screenMesh: Mesh;
  private sceneTextureHandle: RenderTargetHandle;
  private mainTexture: Texture;

  constructor (renderer: Renderer, sceneTextureHandle?: RenderTargetHandle) {
    super(renderer, {});
    const name = 'PostProcess';
    const engine = this.renderer.engine;

    this.sceneTextureHandle = sceneTextureHandle ? sceneTextureHandle : new RenderTargetHandle(engine);
    const geometry = Geometry.create(engine, {
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

    const material = Material.create(engine, {
      name,
      shader: {
        vertex: screenMeshVert,
        fragment: colorGradingFrag,
        glslVersion: GLSLVersion.GLSL1,
      },
    });

    material.blending = false;
    material.depthTest = false;
    material.culling = false;

    this.screenMesh = Mesh.create(engine, {
      name, geometry, material,
      priority: 0,
    });
    this.priority = 5000;
  }

  override configure (renderer: Renderer): void {
    this.mainTexture = renderer.getFramebuffer()!.getColorTextures()[0];
    if (!this.sceneTextureHandle.texture) {
      this.sceneTextureHandle.texture = this.mainTexture;
    }
    renderer.setFramebuffer(null);
  }

  override execute (renderer: Renderer): void {
    renderer.clear({
      colorAction: TextureStoreAction.clear,
      depthAction: TextureStoreAction.clear,
      stencilAction: TextureStoreAction.clear,
    });
    const {
      useBloom, bloomIntensity,
      brightness, saturation, contrast,
      useToneMapping,
      vignetteIntensity, vignetteSmoothness, vignetteRoundness,
    } = renderer.renderingData.currentFrame.globalVolume;

    this.screenMesh.material.setTexture('_SceneTex', this.sceneTextureHandle.texture);
    this.screenMesh.material.setFloat('_Brightness', brightness);
    this.screenMesh.material.setFloat('_Saturation', saturation);
    this.screenMesh.material.setFloat('_Contrast', contrast);

    this.screenMesh.material.setInt('_UseBloom', Number(useBloom));
    if (useBloom) {
      this.screenMesh.material.setTexture('_GaussianTex', this.mainTexture);
      this.screenMesh.material.setFloat('_BloomIntensity', bloomIntensity);
    }
    if (vignetteIntensity > 0) {
      this.screenMesh.material.setFloat('_VignetteIntensity', vignetteIntensity);
      this.screenMesh.material.setFloat('_VignetteSmoothness', vignetteSmoothness);
      this.screenMesh.material.setFloat('_VignetteRoundness', vignetteRoundness);
      this.screenMesh.material.setVector2('_VignetteCenter', new Vector2(0.5, 0.5));
      this.screenMesh.material.setVector3('_VignetteColor', new Vector3(0.0, 0.0, 0.0));
    }
    this.screenMesh.material.setInt('_UseToneMapping', Number(useToneMapping));
    renderer.renderMeshes([this.screenMesh]);
  }
}
