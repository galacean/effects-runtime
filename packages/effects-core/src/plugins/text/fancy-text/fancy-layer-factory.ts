import type { FancyRenderLayer, TextLayerDrawer } from './fancy-types';
import {
  GlowDrawer,
  GradientDrawer,
  ShadowDrawer,
  SingleStrokeDrawer,
  SolidFillDrawer,
  TextureDrawer,
} from './text-layer-drawers';

/** 花字层工厂 */
export class FancyLayerFactory {
  static createDrawerFromLayer (layer: FancyRenderLayer): TextLayerDrawer | null {
    let drawer: TextLayerDrawer | null = null;

    switch (layer.kind) {
      case 'single-stroke':
        drawer = new SingleStrokeDrawer(layer.params.width, layer.params.color, layer.params.unit ?? 'px');

        break;
      case 'gradient':
        drawer = new GradientDrawer(layer.params.colors, layer.params.angle ?? 0);

        break;
      case 'shadow':
        drawer = new ShadowDrawer(layer.params.color, layer.params.blur, layer.params.offsetX, layer.params.offsetY);

        break;
      case 'glow':
        drawer = new GlowDrawer(layer.params.color, layer.params.blur, layer.params.intensity ?? 1);

        break;
      case 'texture':
        drawer = new TextureDrawer(layer.runtimePattern ?? null, layer.params.opacity ?? 1);

        break;
      case 'solid-fill':
        drawer = new SolidFillDrawer(layer.params.color);

        break;
      default: {
        const _never: never = layer;

        console.warn('未知的花字层种类:', _never);

        return null;
      }
    }

    if (drawer && layer.category) {
      drawer.category = layer.category;
    }

    return drawer;
  }

  static createDrawersFromLayers (layers: FancyRenderLayer[]): TextLayerDrawer[] {
    return layers
      .map(layer => this.createDrawerFromLayer(layer))
      .filter((drawer): drawer is TextLayerDrawer => drawer !== null);
  }
}
