import type * as spec from '@galacean/effects-specification';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { GLSLVersion } from './shader';
import { glContext } from '../gl';
import { Material } from '../material';
import { TextureLoadAction, type Texture } from '../texture';
import { Geometry } from './geometry';
import { Mesh } from './mesh';
import { getTextureSize } from './render-frame';
import type { RenderPassDestroyOptions } from './render-pass';
import { RenderTargetHandle, RenderPass } from './render-pass';
import type { Renderer } from './renderer';
import { colorGradingFrag, gaussianDownHFrag, gaussianDownVFrag, gaussianUpFrag, screenMeshVert, thresholdFrag } from '../shader';
import { FilterMode, type Framebuffer, RenderTextureFormat } from './framebuffer';

// Bloom Pass - 包含阈值提取、高斯模糊（Down Sample 和 Up Sample）
export class BloomPass extends RenderPass {
  sceneTextureHandle: RenderTargetHandle;

  private readonly iterationCount: number;
  private thresholdMaterial: Material;
  private downSampleHMaterial: Material;
  private downSampleVMaterial: Material;
  private upSampleMaterial: Material;
  private tempRTs: Framebuffer[] = [];
  private thresholdRT: Framebuffer;
  private mainTexture: Texture;

  constructor (renderer: Renderer, iterationCount = 4) {
    super(renderer);
    this.iterationCount = iterationCount;

    const engine = this.renderer.engine;

    // Threshold material
    this.thresholdMaterial = Material.create(engine, {
      shader: {
        vertex: screenMeshVert,
        fragment: thresholdFrag,
        glslVersion: GLSLVersion.GLSL1,
      },
    });
    this.thresholdMaterial.blending = false;
    this.thresholdMaterial.depthTest = false;
    this.thresholdMaterial.culling = false;

    // Down sample H material
    this.downSampleHMaterial = Material.create(engine, {
      shader: {
        vertex: screenMeshVert,
        fragment: gaussianDownHFrag,
        glslVersion: GLSLVersion.GLSL1,
      },
    });
    this.downSampleHMaterial.blending = false;
    this.downSampleHMaterial.depthTest = false;
    this.downSampleHMaterial.culling = false;

    // Down sample V material
    this.downSampleVMaterial = Material.create(engine, {
      shader: {
        vertex: screenMeshVert,
        fragment: gaussianDownVFrag,
        glslVersion: GLSLVersion.GLSL1,
      },
    });
    this.downSampleVMaterial.blending = false;
    this.downSampleVMaterial.depthTest = false;
    this.downSampleVMaterial.culling = false;

    // Up sample material
    this.upSampleMaterial = Material.create(engine, {
      shader: {
        vertex: screenMeshVert,
        fragment: gaussianUpFrag,
        glslVersion: GLSLVersion.GLSL1,
      },
    });
    this.upSampleMaterial.blending = false;
    this.upSampleMaterial.depthTest = false;
    this.upSampleMaterial.culling = false;

    this.priority = 5000;
    this.name = 'BloomPass';
  }

  override configure (renderer: Renderer): void {
    // 获取场景纹理用于 ToneMappingPass
    this.mainTexture = renderer.getFramebuffer().getColorTextures()[0];
    this.sceneTextureHandle.texture = this.mainTexture;
  }

  override execute (renderer: Renderer): void {
    const baseWidth = renderer.getWidth();
    const baseHeight = renderer.getHeight();

    // 1. Threshold pass - 提取高亮区域
    const threshold = renderer.renderingData.currentFrame.globalVolume?.bloom?.threshold ?? 1.0;

    this.thresholdRT = renderer.getTemporaryRT('_BloomThreshold', baseWidth, baseHeight, 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);
    this.thresholdMaterial.setFloat('_Threshold', threshold);
    renderer.blit(this.mainTexture, this.thresholdRT, this.thresholdMaterial);

    let currentTexture = this.thresholdRT.getColorTextures()[0];

    // 2. Down sample passes
    for (let i = 0; i < this.iterationCount; i++) {
      const downWidth = Math.floor(baseWidth / Math.pow(2, i + 1));
      const downHeight = Math.floor(baseHeight / Math.pow(2, i + 1));

      // Horizontal pass
      const tempH = renderer.getTemporaryRT(`_BloomDownH${i}`, downWidth, downHeight, 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);

      this.downSampleHMaterial.setVector2('_TextureSize', getTextureSize(currentTexture));
      renderer.blit(currentTexture, tempH, this.downSampleHMaterial);

      // Vertical pass
      const tempV = renderer.getTemporaryRT(`_BloomDownV${i}`, downWidth, downHeight, 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);

      this.downSampleVMaterial.setVector2('_TextureSize', getTextureSize(tempH.getColorTextures()[0]));
      renderer.blit(tempH.getColorTextures()[0], tempV, this.downSampleVMaterial);

      // 释放 H pass RT，保留 V pass RT 用于 up sample
      renderer.releaseTemporaryRT(tempH);
      this.tempRTs.push(tempV);
      currentTexture = tempV.getColorTextures()[0];
    }

    // 释放 threshold RT
    renderer.releaseTemporaryRT(this.thresholdRT);

    // 3. Up sample passes
    for (let i = this.iterationCount - 1; i > 0; i--) {
      const upWidth = Math.floor(baseWidth / Math.pow(2, i - 1));
      const upHeight = Math.floor(baseHeight / Math.pow(2, i - 1));

      const tempUp = renderer.getTemporaryRT(`_BloomUp${i}`, upWidth, upHeight, 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);

      // 获取下一层的 down sample 结果
      const downSampleTexture = this.tempRTs[i - 1].getColorTextures()[0];

      this.upSampleMaterial.setTexture('_GaussianDownTex', downSampleTexture);
      this.upSampleMaterial.setVector2('_GaussianDownTextureSize', getTextureSize(downSampleTexture));
      renderer.blit(currentTexture, tempUp, this.upSampleMaterial);

      currentTexture = tempUp.getColorTextures()[0];
      this.tempRTs.push(tempUp);
    }

    // 设置最终输出到当前 framebuffer
    renderer.setFramebuffer(this.tempRTs[this.tempRTs.length - 1]);
  }

  override onCameraCleanup (renderer: Renderer): void {
    // 释放所有临时 RT
    for (let i = 0; i < this.tempRTs.length; i++) {
      renderer.releaseTemporaryRT(this.tempRTs[i]);
    }

    this.tempRTs = [];
  }

  override dispose (options?: RenderPassDestroyOptions): void {
    this.thresholdMaterial.dispose();
    this.downSampleHMaterial.dispose();
    this.downSampleVMaterial.dispose();
    this.upSampleMaterial.dispose();
    super.dispose(options);
  }
}

// 合并Bloom的高斯模糊结果，并应用ACES Tonemapping
export class ToneMappingPass extends RenderPass {
  private screenMesh: Mesh;
  private sceneTextureHandle: RenderTargetHandle;
  private mainTexture: Texture;

  constructor (renderer: Renderer, sceneTextureHandle?: RenderTargetHandle) {
    super(renderer);
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
    this.name = 'ToneMappingPass';
  }

  override configure (renderer: Renderer): void {
    this.mainTexture = renderer.getFramebuffer().getColorTextures()[0];
    if (!this.sceneTextureHandle.texture) {
      this.sceneTextureHandle.texture = this.mainTexture;
    }
    renderer.setFramebuffer(null);
  }

  override execute (renderer: Renderer): void {
    renderer.clear({
      colorAction: TextureLoadAction.clear,
      depthAction: TextureLoadAction.clear,
      stencilAction: TextureLoadAction.clear,
    });
    const globalVolume = renderer.renderingData.currentFrame.globalVolume;

    const bloom: spec.Bloom = {
      threshold: 0,
      intensity: 0,
      active: false,
      ...globalVolume?.bloom,
    };

    const vignette: spec.Vignette = {
      intensity: 0,
      smoothness: 0,
      roundness: 0,
      active: false,
      ...globalVolume?.vignette,
    };

    const colorAdjustments: spec.ColorAdjustments = {
      brightness: 0,
      saturation: 0,
      contrast: 0,
      active: false,
      ...globalVolume?.colorAdjustments,
    };

    const tonemapping: spec.Tonemapping = {
      active: false,
      ...globalVolume?.tonemapping,
    };

    this.screenMesh.material.setTexture('_SceneTex', this.sceneTextureHandle.texture);

    this.screenMesh.material.setFloat('_Brightness', Math.pow(2, colorAdjustments.brightness));
    this.screenMesh.material.setFloat('_Saturation', (colorAdjustments.saturation * 0.01) + 1);
    this.screenMesh.material.setFloat('_Contrast', (colorAdjustments.contrast * 0.01) + 1);

    this.screenMesh.material.setInt('_UseBloom', Number(bloom.active));
    if (bloom.active) {
      this.screenMesh.material.setTexture('_GaussianTex', this.mainTexture);
      this.screenMesh.material.setFloat('_BloomIntensity', bloom.intensity);
    }
    if (vignette.intensity > 0) {
      this.screenMesh.material.setFloat('_VignetteIntensity', vignette.intensity);
      this.screenMesh.material.setFloat('_VignetteSmoothness', vignette.smoothness);
      this.screenMesh.material.setFloat('_VignetteRoundness', vignette.roundness);
      this.screenMesh.material.setVector2('_VignetteCenter', new Vector2(0.5, 0.5));
      this.screenMesh.material.setVector3('_VignetteColor', new Vector3(0.0, 0.0, 0.0));
    }
    this.screenMesh.material.setInt('_UseToneMapping', Number(tonemapping.active));
    renderer.renderMeshes([this.screenMesh]);
  }
}
