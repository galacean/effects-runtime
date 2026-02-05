import type {
  Scene, ShaderLibrary, Transform, EventSystem, CompositionProps,
} from '@galacean/effects-core';
import { Composition, RendererComponent } from '@galacean/effects-core';
import type THREE from 'three';

/**
 * 基础 composition 参数
 */
export interface CompositionBaseProps {
  /**
   * 画布宽度
   */
  width?: number,
  /**
   * 画布高度
   */
  height?: number,
  event?: EventSystem,
  /**
   * 播放速度
   */
  speed?: number,
  reusable?: boolean,
  baseRenderOrder?: number,
  /**
   * 合成基础变换
   */
  transform?: Transform,
  /**
   * Shader 库
   */
  shaderLibrary?: ShaderLibrary,
}

export interface ThreeCompositionProps extends CompositionProps {
  /**
   * Three.js 中的相机对象
   */
  threeCamera?: THREE.Camera,
  /**
   * Three.js 中的 Group 对象
   */
  threeGroup?: THREE.Group,
}

/**
 * composition 抽象类的实现
 */
export class ThreeComposition extends Composition {
  /**
   * 发射器形状缓存 map
   */
  static shape: Record<string, number> = {};

  constructor (
    props: ThreeCompositionProps,
    scene: Scene,
  ) {
    super(props, scene);
  }

  override prepareRender (): void {
    const render = this.renderer;
    const frame = this.renderFrame;

    frame._renderPasses[0].meshes.length = 0;

    this.rootItem.getComponent(RendererComponent).render(render);
  }
}
