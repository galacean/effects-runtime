import type { Scene, ShaderLibrary, Transform, MeshRendererOptions, EventSystem, VFXItemContent, VFXItem, MessageItem, CompositionProps } from '@galacean/effects-core';
import { Composition } from '@galacean/effects-core';
import { ThreeRenderFrame } from './three-render-frame';
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
  handleEnd?: (composition: Composition) => void,
  /**
   * 交互元素监听函数
   *
   * @param item
   * @returns
   */
  handleMessageItem?: (item: MessageItem) => void,
  /**
   * player 暂停监听函授
   *
   * @param item
   * @returns
   */
  handlePlayerPause?: (item: VFXItem<VFXItemContent>) => void,
}

export interface ThreeCompositionProps extends CompositionBaseProps {
  /**
   * 指定合成名字
   */
  compositionName?: string,
  /**
   * 是否多合成
   */
  multipleCompositions?: boolean,
}

/**
 * composition 抽象类的实现
 */
export class ThreeComposition extends Composition {
  /**
   * 发射器形状缓存 map
   */
  static shape: Record<string, number> = {};

  /**
   * 相机参数
   */
  threeCamera: THREE.Camera;

  constructor (props: CompositionProps, scene: Scene) {
    super(props, scene);
    this.compositionSourceManager.sourceContent?.items.forEach(item => {
      const shape = item.content.renderer.shape;

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
    this.content.start();
  }

  /**
   * 开始
   */
  override createRenderFrame () {
    this.renderFrame = new ThreeRenderFrame({
      camera: this.camera,
      keepColorBuffer: this.keepColorBuffer,
      renderer: this.renderer,
    });
  }

  /**
   * 更新 video texture 数据
   */
  override updateVideo () {
    this.textures.map(tex => (tex as ThreeTexture).startVideo());
  }

  /**
   * 更新相机
   */
  override updateCamera () {
    const renderFrame = (this.renderFrame as ThreeRenderFrame);

    // TODO: 这些后面可以挪到renderframe中去，目前composition干的事太多了
    if (renderFrame.threeCamera) {
      renderFrame.updateMatrix();
    } else {
      renderFrame.updateUniform();
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
