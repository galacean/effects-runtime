import type { FancyTextEffect, TextEffect } from './fancy-types';
import {
  SingleStrokeEffect,
  GradientEffect,
  ShadowEffect,
  TextureEffect,
  SolidFillEffect,
} from './text-effects';

function normalizeColor (rgba: number[]): [number, number, number, number] {
  if (!rgba || rgba.length < 3) {return [1, 1, 1, 1];}
  const [r, g, b, a = 1] = rgba;

  if (r > 1 || g > 1 || b > 1) {
    return [r / 255, g / 255, b / 255, a];
  }

  return [r, g, b, a];
}

export class EffectFactory {
  static createEffect (config: FancyTextEffect): TextEffect | null {
    switch (config.type) {
      case 'single-stroke':
        return new SingleStrokeEffect(
          config.params?.width ?? 1,
          normalizeColor(config.params?.color ?? [1, 1, 1, 1]),
          config.params?.unit ?? 'px',
        );
      case 'gradient':
        return new GradientEffect(
          (config.params?.colors ?? [[1, 1, 1, 1]]).map(normalizeColor),
          config.params?.angle ?? 0,
        );
      case 'shadow':
        return new ShadowEffect(
          normalizeColor(config.params?.color ?? [0, 0, 0, 1]),
          config.params?.blur ?? 2,
          config.params?.offsetX ?? 0,
          config.params?.offsetY ?? 0,
        );
      case 'texture':
        // 纹理效果需要传入 CanvasPattern
        return new TextureEffect(config.params?.pattern ?? null);
      case 'solid-fill':
        return new SolidFillEffect(
          normalizeColor(config.params?.color ?? [1, 1, 1, 1]),
        );
      default:
        console.warn(`未知的特效类型: ${config.type}`);

        return null;
    }
  }

  static createEffects (effects: FancyTextEffect[]): TextEffect[] {
    return effects
      .map(effect => this.createEffect(effect))
      .filter((effect): effect is TextEffect => effect !== null);
  }
}
