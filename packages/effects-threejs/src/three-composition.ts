import type { Scene, ShaderLibrary, Transform, MeshRendererOptions, EventSystem, VFXItemContent, VFXItem, MessageItem, CompositionProps } from '@galacean/effects-core';
import { Composition, CompositionComponent, RendererComponent } from '@galacean/effects-core';
import { ThreeTexture } from './three-texture';
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
  /**
   * end 状态监听函数
   *
   * @param composition - composition 对象
   * @returns
   */
  onEnd?: (composition: Composition) => void,
  /**
   * 交互元素监听函数
   *
   * @param item
   * @returns
   */
  onMessageItem?: (item: MessageItem) => void,
  /**
   * player 暂停监听函授
   *
   * @param item
   * @returns
   */
  onPlayerPause?: (item: VFXItem<VFXItemContent>) => void,
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

  constructor (props: ThreeCompositionProps, scene: Scene) {
    super(props, scene);

    this.compositionSourceManager.sourceContent?.items.forEach(item => {
      //@ts-expect-error
      const shape = item.content?.renderer?.shape;

      if (shape) {
        Object.keys(shape).forEach(name => {
          const buffer = shape[name];

          if (!ThreeComposition.shape[name]) {
            ThreeComposition.shape[name] = 0;
          }
          ThreeComposition.shape[name] += buffer.length;
        });
      }
    });
    this.rootItem.getComponent(CompositionComponent)!.resetStatus();
  }

  /**
   * 更新 video texture 数据
   */
  override updateVideo () {
    this.textures.map(tex => (tex as ThreeTexture).startVideo());
  }

  override prepareRender (): void {
    const render = this.renderer;
    const frame = this.renderFrame;

    frame._renderPasses[0].meshes.length = 0;

    // 主合成元素
    for (const vfxItem of this.rootComposition.items) {
      const rendererComponents = vfxItem.getComponents(RendererComponent);

      for (const rendererComponent of rendererComponents) {
        if (rendererComponent.isActiveAndEnabled) {
          rendererComponent.render(render);
        }
      }
    }
    // 预合成元素
    for (const refContent of this.refContent) {
      for (const vfxItem of refContent.getComponent(CompositionComponent)!.items) {
        const rendererComponents = vfxItem.getComponents(RendererComponent);

        for (const rendererComponent of rendererComponents) {
          if (rendererComponent.isActiveAndEnabled) {
            rendererComponent.render(render);
          }
        }
      }
    }
  }

  /**
   * 获取 render 参数
   *
   * @returns
   */
  override getRendererOptions (): MeshRendererOptions {
    const emptyTexture = ThreeTexture.createWithData(
      this.renderer.engine,
      {
        data: new Uint8Array(4).fill(255),
        width: 1,
        height: 1,
      });

    (emptyTexture as ThreeTexture).texture.needsUpdate = true;
    if (!this.rendererOptions) {
      this.rendererOptions = {
        emptyTexture,
        cachePrefix: '-',
      };
    }

    return this.rendererOptions;
  }
}
