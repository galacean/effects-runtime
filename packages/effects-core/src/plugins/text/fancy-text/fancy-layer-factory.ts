import type { FancyRenderLayer, TextLayerDrawer } from './fancy-types';
import {
  SingleStrokeDrawer,
  GradientDrawer,
  ShadowDrawer,
  TextureDrawer,
  SolidFillDrawer,
} from './text-layer-drawers';

/**
 * 花字层工厂：从层配置创建对应的层绘制器（TextLayerDrawer 实例）
 */
export class FancyLayerFactory {
  static createDrawerFromLayer (layer: FancyRenderLayer): TextLayerDrawer | null {
    switch (layer.kind) {
      case 'single-stroke':
        return new SingleStrokeDrawer(
          layer.params.width,
          layer.params.color,
          layer.params.unit ?? 'px',
        );
      case 'gradient':
        return new GradientDrawer(
          layer.params.colors,
          layer.params.angle ?? 0,
        );
      case 'shadow':
        return new ShadowDrawer(
          layer.params.color,
          layer.params.blur,
          layer.params.offsetX,
          layer.params.offsetY,
        );
      case 'texture':
        return new TextureDrawer(layer.runtimePattern ?? null);
      case 'solid-fill':
        return new SolidFillDrawer(
          layer.params.color,
        );
      default: {
        const _never: never = layer;

        console.warn('未知的花字层种类:', _never);

        return null;
      }
    }
  }

  static createDrawersFromLayers (layers: FancyRenderLayer[]): TextLayerDrawer[] {
    return layers
      .map(layer => this.createDrawerFromLayer(layer))
      .filter((drawer): drawer is TextLayerDrawer => drawer !== null);
  }
}
