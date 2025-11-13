import type { Matrix4, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { RendererComponent } from '../components';
import type { Engine } from '../engine';
import type { Material } from '../material';
import type { LostHandler, RestoreHandler } from '../utils';
import type { FilterMode, Framebuffer, RenderTextureFormat } from './framebuffer';
import type { Geometry } from './geometry';
import type { RenderFrame, RenderingData } from './render-frame';
import type { RenderPassClearAction, RenderPassStoreAction } from './render-pass';
import type { ShaderLibrary } from './shader';

export class Renderer implements LostHandler, RestoreHandler {
  static create: (engine: Engine) => Renderer;

  engine: Engine;
  /**
  * 存放渲染需要用到的数据
  */
  renderingData: RenderingData;
  protected currentFramebuffer: Framebuffer;

  constructor (engine: Engine) {
    this.engine = engine;
  }

  setGlobalFloat (name: string, value: number) {
    // OVERRIDE
  }

  setGlobalInt (name: string, value: number) {
    // OVERRIDE
  }

  setGlobalVector4 (name: string, value: Vector4) {
    // OVERRIDE
  }

  setGlobalVector3 (name: string, value: Vector3) {
    // OVERRIDE
  }

  setGlobalMatrix (name: string, value: Matrix4) {
    // OVERRIDE
  }

  getFramebuffer (): Framebuffer {
    return this.currentFramebuffer;
  }

  setFramebuffer (framebuffer: Framebuffer | null) {
    // OVERRIDE
  }

  setViewport (x: number, y: number, width: number, height: number) {
    // OVERRIDE
  }

  resize (canvasWidth: number, canvasHeight: number) {
    // OVERRIDE
  }

  clear (action: RenderPassClearAction | RenderPassStoreAction) {
    // OVERRIDE
  }

  getWidth (): number {
    // OVERRIDE
    return 0;
  }

  getHeight (): number {
    // OVERRIDE
    return 0;
  }

  /**
   * @override
   * @param e
   */
  lost (e: Event): void {
    // OVERRIDE
  }

  /**
   * @override
   */
  restore (): void {
    // OVERRIDE
  }

  /**
   *
   * @override
   * @returns
   */
  getShaderLibrary (): ShaderLibrary | undefined {
    // OVERRIDE
    return undefined;
  }

  renderRenderFrame (renderFrame: RenderFrame) {
    // OVERRIDE
  }

  renderMeshes (meshes: RendererComponent[]) {
    // OVERRIDE
  }

  drawGeometry (geometry: Geometry, matrix: Matrix4, material: Material, subMeshIndex = 0) {
    // OVERRIDE
  }

  getTemporaryRT (name: string, width: number, height: number, depthBuffer: number, filter: FilterMode, format: RenderTextureFormat): Framebuffer | null {
    // OVERRIDE
    return null;
  }

  dispose (): void {
    // OVERRIDE
  }
}
