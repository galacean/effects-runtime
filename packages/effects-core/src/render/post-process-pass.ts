import type * as spec from '@galacean/effects-specification';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { ShaderWithSource } from './shader';
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
import { FilterMode, RenderTextureFormat } from './framebuffer';

// Bloom 阈值 Pass
export class BloomThresholdPass extends RenderPass {
  sceneTextureHandle: RenderTargetHandle;

  private mainTexture: Texture;
  private screenMesh: Mesh;

  constructor (renderer: Renderer) {
    super(renderer);
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
    this.name = 'BloomThresholdPass';
  }

  override configure (renderer: Renderer): void {
    this.framebuffer = renderer.getTemporaryRT(this.name, renderer.getWidth(), renderer.getHeight(), 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);
    this.mainTexture = renderer.getFramebuffer().getColorTextures()[0];
    this.sceneTextureHandle.texture = this.mainTexture;
    renderer.setFramebuffer(this.framebuffer);
  }

  override execute (renderer: Renderer): void {
    renderer.clear({
      colorAction: TextureLoadAction.clear,
      depthAction: TextureLoadAction.clear,
      stencilAction: TextureLoadAction.clear,
    });
    this.screenMesh.material.setTexture('_MainTex', this.mainTexture);
    const threshold = renderer.renderingData.currentFrame.globalVolume?.bloom?.threshold ?? 1.0;

    this.screenMesh.material.setFloat('_Threshold', threshold);
    renderer.renderMeshes([this.screenMesh]);
  }

  override onCameraCleanup (renderer: Renderer): void {
    if (this.framebuffer) {
      renderer.releaseTemporaryRT(this.framebuffer);
    }
  }

  override dispose (options?: RenderPassDestroyOptions): void {
    super.dispose(options);
  }
}

export class HQGaussianDownSamplePass extends RenderPass {
  gaussianResult: RenderTargetHandle;

  private mainTexture: Texture;
  private screenMesh: Mesh;
  private readonly type: 'V' | 'H';
  private readonly level: number;

  constructor (renderer: Renderer,
    type: 'V' | 'H',
    level: number,
  ) {
    super(renderer);
    this.type = type;
    this.level = level;
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

    const fragment = type === 'H' ? gaussianDownHFrag : gaussianDownVFrag;
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
    this.name = 'GaussianDownPass' + type + level;
  }

  override configure (renderer: Renderer): void {
    const width = Math.floor(this.renderer.getWidth() / Math.pow(2, this.level + 1));
    const height = Math.floor(this.renderer.getHeight() / Math.pow(2, this.level + 1));

    this.framebuffer = renderer.getTemporaryRT(this.name, width, height, 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);
    this.mainTexture = renderer.getFramebuffer().getColorTextures()[0];
    renderer.setFramebuffer(this.framebuffer);
  }

  override execute (renderer: Renderer): void {
    renderer.clear({
      colorAction: TextureLoadAction.clear,
      depthAction: TextureLoadAction.clear,
      stencilAction: TextureLoadAction.clear,
    });
    this.screenMesh.material.setTexture('_MainTex', this.mainTexture);
    this.screenMesh.material.setVector2('_TextureSize', getTextureSize(this.mainTexture));
    renderer.renderMeshes([this.screenMesh]);
    if (this.type === 'V') {
      this.gaussianResult.texture = renderer.getFramebuffer().getColorTextures()[0];
    }
  }

  override onCameraCleanup (renderer: Renderer): void {
    if (this.framebuffer) {
      renderer.releaseTemporaryRT(this.framebuffer);
    }
  }
}

export class HQGaussianUpSamplePass extends RenderPass {
  gaussianDownSampleResult: RenderTargetHandle;

  private mainTexture: Texture;
  private screenMesh: Mesh;
  private readonly level: number;

  constructor (renderer: Renderer, level: number) {
    super(renderer);

    this.level = level;
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
    this.name = 'GaussianUpPass' + level;
  }

  override configure (renderer: Renderer): void {
    const width = Math.floor(this.renderer.getWidth() / Math.pow(2, this.level - 1));
    const height = Math.floor(this.renderer.getHeight() / Math.pow(2, this.level - 1));

    this.framebuffer = renderer.getTemporaryRT(this.name, width, height, 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);
    this.mainTexture = renderer.getFramebuffer().getColorTextures()[0];
    renderer.setFramebuffer(this.framebuffer);
  }

  override execute (renderer: Renderer): void {
    renderer.clear({
      colorAction: TextureLoadAction.clear,
      depthAction: TextureLoadAction.clear,
      stencilAction: TextureLoadAction.clear,
    });
    this.screenMesh.material.setTexture('_MainTex', this.mainTexture);
    this.screenMesh.material.setTexture('_GaussianDownTex', this.gaussianDownSampleResult.texture);
    this.screenMesh.material.setVector2('_GaussianDownTextureSize', getTextureSize(this.gaussianDownSampleResult.texture));
    renderer.renderMeshes([this.screenMesh]);
  }

  override onCameraCleanup (renderer: Renderer): void {
    if (this.framebuffer) {
      renderer.releaseTemporaryRT(this.framebuffer);
    }
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
