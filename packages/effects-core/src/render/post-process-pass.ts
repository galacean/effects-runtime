import { ResourceData } from './resource-data';
import type * as spec from '@galacean/effects-specification';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { GLSLVersion } from './shader';
import { glContext } from '../gl';
import { Material } from '../material';
import { Geometry } from './geometry';
import { VertexBuffer } from './vertex-buffer';
import { Mesh } from './mesh';
import { getTextureSize } from './rendering-data';
import type { RenderingData } from './rendering-data';
import type { RenderPassDestroyOptions } from './render-pass';
import { RenderPass, RenderPassEvent } from './render-pass';
import type { Renderer } from './renderer';
import { colorGradingFrag, gaussianDownHFrag, gaussianDownVFrag, gaussianUpFrag, screenMeshVert, thresholdFrag } from '../shader';
import { FilterMode, type Framebuffer, RenderTextureFormat } from './framebuffer';

// Bloom Pass - 包含阈值提取、高斯模糊（Down Sample 和 Up Sample）
export class BloomPass extends RenderPass {
  private readonly iterationCount: number;
  private thresholdMaterial: Material;
  private downSampleHMaterial: Material;
  private downSampleVMaterial: Material;
  private upSampleMaterial: Material;

  constructor (renderer: Renderer, iterationCount = 4) {
    super(renderer);
    this.iterationCount = iterationCount;
    this.renderPassEvent = RenderPassEvent.BeforeRenderingPostProcessing;
    this.name = 'BloomPass';
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
  }

  override execute (renderer: Renderer, data: RenderingData): void {
    const resourceData = data.frameData.get(ResourceData);

    if (!data.options?.globalVolume?.bloom?.active) {
      return;
    }
    const sceneColor = resourceData.cameraColor!;
    const tempRTs: Framebuffer[] = [];
    const baseWidth = Math.max(1, sceneColor.getWidth());
    const baseHeight = Math.max(1, sceneColor.getHeight());
    const iterationCount = Math.max(1, Math.min(this.iterationCount, Math.floor(Math.log2(Math.min(baseWidth, baseHeight)))));

    // 1. Threshold pass - 提取高亮区域
    const threshold = data.options?.globalVolume?.bloom?.threshold ?? 1.0;

    const thresholdRT = renderer.getTemporaryRT('_BloomThreshold', baseWidth, baseHeight, 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);

    this.thresholdMaterial.setFloat('_Threshold', threshold);
    renderer.blit(sceneColor, thresholdRT, this.thresholdMaterial);

    let currentRT = thresholdRT;
    let currentTexture = currentRT.getColorTextures()[0];

    // 2. Down sample passes
    for (let i = 0; i < iterationCount; i++) {
      const downWidth = Math.max(1, Math.floor(baseWidth / Math.pow(2, i + 1)));
      const downHeight = Math.max(1, Math.floor(baseHeight / Math.pow(2, i + 1)));

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
      tempRTs.push(tempV);
      currentRT = tempV;
      currentTexture = currentRT.getColorTextures()[0];
    }

    // 释放 threshold RT
    renderer.releaseTemporaryRT(thresholdRT);

    // 3. Up sample passes
    for (let i = iterationCount - 1; i > 0; i--) {
      const upWidth = Math.floor(baseWidth / Math.pow(2, i - 1));
      const upHeight = Math.floor(baseHeight / Math.pow(2, i - 1));

      const tempUp = renderer.getTemporaryRT(`_BloomUp${i}`, upWidth, upHeight, 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);

      // 获取下一层的 down sample 结果
      const downSampleTexture = tempRTs[i - 1].getColorTextures()[0];

      this.upSampleMaterial.setTexture('_GaussianDownTex', downSampleTexture);
      this.upSampleMaterial.setVector2('_GaussianDownTextureSize', getTextureSize(downSampleTexture));
      renderer.blit(currentTexture, tempUp, this.upSampleMaterial);

      currentRT = tempUp;
      currentTexture = currentRT.getColorTextures()[0];
      tempRTs.push(tempUp);
    }

    // Keep the final output until camera cleanup so later passes can sample it.
    resourceData.bloom = currentRT;
    for (const rt of tempRTs) {
      if (rt !== currentRT) {
        renderer.releaseTemporaryRT(rt);
      }
    }
  }

  override onCameraCleanup (renderer: Renderer, data: RenderingData): void {
    const resourceData = data.frameData.get(ResourceData);

    const empty = renderer.engine.transparentTexture;

    this.thresholdMaterial.setTexture('_MainTex', empty);
    this.downSampleHMaterial.setTexture('_MainTex', empty);
    this.downSampleVMaterial.setTexture('_MainTex', empty);
    this.upSampleMaterial.setTexture('_MainTex', empty);
    this.upSampleMaterial.setTexture('_GaussianDownTex', empty);
    if (resourceData.bloom) {
      renderer.releaseTemporaryRT(resourceData.bloom);
      resourceData.bloom = undefined;
    }
  }

  override dispose (options?: RenderPassDestroyOptions): void {
    if (this.isDisposed) {
      return;
    }
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

  constructor (renderer: Renderer) {
    super(renderer);
    this.renderPassEvent = RenderPassEvent.BeforeRenderingPostProcessing;
    this.name = 'ToneMappingPass';
    const name = 'PostProcess';
    const engine = this.renderer.engine;

    const geometry = Geometry.create(engine, {
      name,
      mode: glContext.TRIANGLE_STRIP,
      attributes: {
        [VertexBuffer.PositionKind]: {
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

    // Scene RT stores premultiplied color; preserve earlier compositions when presenting it.
    material.blending = true;
    material.blendFunction = [glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];
    material.depthTest = false;
    material.depthMask = false;
    material.culling = false;

    this.screenMesh = Mesh.create(engine, {
      name, geometry, material,
      priority: 0,
    });
  }

  override execute (renderer: Renderer, data: RenderingData): void {
    const resourceData = data.frameData.get(ResourceData);

    renderer.setFramebuffer(data.options?.target ?? null);

    const globalVolume = data.options?.globalVolume;

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

    this.screenMesh.material.setTexture('_SceneTex', resourceData.cameraColor!);
    this.screenMesh.material.setTexture('_GaussianTex', resourceData.bloom?.getColorTextures()[0] ?? resourceData.cameraColor!);
    this.screenMesh.material.setFloat('_BloomIntensity', bloom.active ? bloom.intensity : 0);

    this.screenMesh.material.setFloat('_Brightness', colorAdjustments.active ? Math.pow(2, colorAdjustments.brightness) : 1);
    this.screenMesh.material.setFloat('_Saturation', colorAdjustments.active ? (colorAdjustments.saturation * 0.01) + 1 : 1);
    this.screenMesh.material.setFloat('_Contrast', colorAdjustments.active ? (colorAdjustments.contrast * 0.01) + 1 : 1);

    this.screenMesh.material.setInt('_UseBloom', Number(bloom.active));
    this.screenMesh.material.setFloat('_VignetteIntensity', vignette.active ? vignette.intensity : 0);
    if (vignette.active && vignette.intensity > 0) {
      this.screenMesh.material.setFloat('_VignetteSmoothness', vignette.smoothness);
      this.screenMesh.material.setFloat('_VignetteRoundness', vignette.roundness);
      this.screenMesh.material.setVector2('_VignetteCenter', new Vector2(0.5, 0.5));
      this.screenMesh.material.setVector3('_VignetteColor', new Vector3(0.0, 0.0, 0.0));
    }
    this.screenMesh.material.setInt('_UseToneMapping', Number(tonemapping.active));
    renderer.renderMeshes([this.screenMesh]);
  }

  override onCameraCleanup (renderer: Renderer): void {
    this.screenMesh.material.setTexture('_SceneTex', renderer.engine.transparentTexture);
    this.screenMesh.material.setTexture('_GaussianTex', renderer.engine.transparentTexture);
  }

  override dispose (options?: RenderPassDestroyOptions): void {
    if (this.isDisposed) {
      return;
    }
    this.screenMesh.dispose();
    super.dispose(options);
  }

}
