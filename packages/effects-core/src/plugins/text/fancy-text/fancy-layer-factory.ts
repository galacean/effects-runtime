import type { FancyRenderLayer, TextLayerDrawer } from './fancy-types';
import {
  SingleStrokeDrawer,
  GradientDrawer,
  ShadowDrawer,
  TextureDrawer,
  SolidFillDrawer,
} from './text-layer-drawers';

function normalizeColor (rgba: number[]): [number, number, number, number] {
  if (!rgba || rgba.length < 3) {return [1, 1, 1, 1];}
  const [r, g, b, a = 1] = rgba;

  if (r > 1 || g > 1 || b > 1) {
    return [r / 255, g / 255, b / 255, a];
  }

  return [r, g, b, a];
}

/**
 * 花字层工厂：从层配置创建对应的层绘制器（TextLayerDrawer 实例）
 */
export class FancyLayerFactory {
  static createDrawerFromLayer (layer: FancyRenderLayer): TextLayerDrawer | null {
    switch (layer.kind) {
      case 'single-stroke':
        return new SingleStrokeDrawer(
          layer.params?.width ?? 1,
          normalizeColor(layer.params?.color ?? [1, 1, 1, 1]),
          layer.params?.unit ?? 'px',
        );
      case 'gradient':
        return new GradientDrawer(
          (layer.params?.colors ?? [[1, 1, 1, 1]]).map(normalizeColor),
          layer.params?.angle ?? 0,
        );
      case 'shadow':
        return new ShadowDrawer(
          normalizeColor(layer.params?.color ?? [0, 0, 0, 1]),
          layer.params?.blur ?? 2,
          layer.params?.offsetX ?? 0,
          layer.params?.offsetY ?? 0,
        );
      case 'texture':
        return new TextureDrawer(layer.params?.pattern ?? null);
      case 'solid-fill':
        return new SolidFillDrawer(
          normalizeColor(layer.params?.color ?? [1, 1, 1, 1]),
        );
      default:
        console.warn(`未知的花字层种类: ${layer.kind}`);

        return null;
    }
  }

  static createDrawersFromLayers (layers: FancyRenderLayer[]): TextLayerDrawer[] {
    return layers
      .map(layer => this.createDrawerFromLayer(layer))
      .filter((drawer): drawer is TextLayerDrawer => drawer !== null);
  }
}
