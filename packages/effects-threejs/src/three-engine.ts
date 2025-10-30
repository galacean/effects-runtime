import type { Composition, EngineOptions } from '@galacean/effects-core';
import { Engine, GPUCapability } from '@galacean/effects-core';
import type * as THREE from 'three';
import { ThreeRenderer } from './three-renderer';

export interface ThreeEngineOptions {
  threeCamera?: THREE.Camera,
  composition: Composition,
  threeGroup: THREE.Group,
}

/**
 * 挂载着合成需要的全局对象等
 */
export class ThreeEngine extends Engine {
  threeCamera?: THREE.Camera;
  threeGroup: THREE.Group;
  composition: Composition;

  constructor (gl: WebGLRenderingContext | WebGL2RenderingContext, options?: EngineOptions) {
    super(gl.canvas as HTMLCanvasElement, options);

    this.renderer = new ThreeRenderer(this);
    this.gpuCapability = new GPUCapability(gl);
  }

  setOptions (threeEngineOptions: ThreeEngineOptions) {
    const { threeCamera, threeGroup, composition } = threeEngineOptions;

    this.threeCamera = threeCamera;
    this.threeGroup = threeGroup;
    this.composition = composition;
  }
}
