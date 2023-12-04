import type { Matrix4 } from '@galacean/effects-math/es/core/index';
import type { LostHandler, RestoreHandler } from '../utils';
import type { FilterMode, FrameBuffer, RenderTextureFormat } from './frame-buffer';
import type { Mesh } from './mesh';
import type { RenderFrame, RenderingData } from './render-frame';
import type { RenderPassClearAction, RenderPassStoreAction } from './render-pass';
import type { ShaderLibrary } from './shader';
import type { Geometry } from './geometry';
import type { Material } from '../material';
import type { Engine } from '../engine';

export class Renderer implements LostHandler, RestoreHandler {
  static create: (
    canvas: HTMLCanvasElement | OffscreenCanvas,
    framework: 'webgl' | 'webgl2',
    renderOptions?: WebGLContextAttributes,
  ) => Renderer;

  engine: Engine;

  env: string;

  /**
  * 存放渲染需要用到的数据
  */
  renderingData: RenderingData;

  constructor () {
  }

  setGlobalFloat (name: string, value: number) {
    // OVERRIDE
  }

  setGlobalInt (name: string, value: number) {
    // OVERRIDE
  }

  setGlobalMatrix (name: string, value: Matrix4) {
    // OVERRIDE
  }

  getFrameBuffer (): FrameBuffer | null {
    // OVERRIDE
    return null;
  }

  setFrameBuffer (frameBuffer: FrameBuffer | null) {
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
   * 添加 webglcontextlost 事件回调
   * @override
   * @param lostHandler
   */
  addLostHandler (lostHandler: LostHandler) {
    // OVERRIDE
  }

  /**
   * 添加 webglContextrestored 事件的回调
   * @override
   * @param restoreHandler
   */
  addRestoreHandler (restoreHandler: RestoreHandler) {
    // OVERRIDE
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

  renderMeshes (meshes: Mesh[]) {
    // OVERRIDE
  }

  drawGeometry (geometry: Geometry, material: Material) {
    // OVERRIDE
  }

  getTemporaryRT (name: string, width: number, height: number, depthBuffer: number, filter: FilterMode, format: RenderTextureFormat): FrameBuffer | null {
    // OVERRIDE
    return null;
  }

  dispose (haltGL?: boolean): void {
    // OVERRIDE
  }
}
