import type { FancyTextEffect } from '../text-style';
import type { TextEffect } from '../text-effect-base';
import { SingleStrokeEffect, MultiStrokeEffect, GradientEffect, ShadowEffect, TextureEffect, SolidFillEffect } from './text-effects';

/**
 * 花字特效工厂
 */
export class EffectFactory {
  /**
   * 根据配置创建特效实例
   */
  static createEffect (config: FancyTextEffect): TextEffect | null {
    switch (config.type) {
      case 'single-stroke':
        return EffectFactory.createSingleStroke(config.params);
      case 'multi-stroke':
        return EffectFactory.createMultiStroke(config.params);
      case 'gradient':
        return EffectFactory.createGradient(config.params);
      case 'shadow':
        return EffectFactory.createShadow(config.params);
      case 'texture':
        return EffectFactory.createTexture(config.params);
      case 'solid-fill':
        return EffectFactory.createSolidFill(config.params);
      default:
        console.warn(`未知的特效类型: ${config.type}`);

        return null;
    }
  }

  /**
   * 创建单描边特效
   */
  private static createSingleStroke (params: any): SingleStrokeEffect {
    const { color = [1, 0, 0, 1], width = 3, unit = 'px' } = params || {};
    const strokeColor = EffectFactory.rgbaToString(color);

    return new SingleStrokeEffect(width, strokeColor, unit);
  }

  /**
   * 创建多描边特效
   */
  private static createMultiStroke (params: any): MultiStrokeEffect {
    const { strokes, perLayerFill = false, fillColor = [1, 1, 1, 1] } = params || {};

    if (strokes && Array.isArray(strokes)) {
      const layers = strokes.map((stroke: any) => ({
        width: stroke.width || 2,
        color: EffectFactory.rgbaToString(stroke.color || [1, 0, 0, 1]),
        unit: stroke.unit || 'px',
      }));

      return new MultiStrokeEffect(layers, perLayerFill, EffectFactory.rgbaToString(fillColor));
    }

    // 默认多描边配置
    return new MultiStrokeEffect();
  }

  /**
   * 创建渐变特效
   */
  private static createGradient (params: any): GradientEffect {
    const {
      colors = [
        { offset: 0, color: [1, 0, 0, 1] },
        { offset: 1, color: [0, 0, 1, 1] },
      ],
      strokeWidth = 0.09,
      strokeColor = '#F8E8A2',
    } = params || {};

    const startColor = EffectFactory.rgbaToString(colors[0]?.color || [1, 0, 0, 1]);
    const endColor = EffectFactory.rgbaToString(colors[colors.length - 1]?.color || [0, 0, 1, 1]);

    return new GradientEffect(strokeWidth, strokeColor, startColor, endColor);
  }

  /**
   * 创建投影特效
   */
  private static createShadow (params: any): ShadowEffect {
    const {
      color = [0, 0, 0, 0.8],
      offsetX = 5,
      offsetY = 5,
      strokeWidth = 0.12,
      strokeColor = '#F7A4A4',
      topStrokeWidth = 0.04,
      topStrokeColor = '#FFFFFF',
    } = params || {};

    const shadowColor = EffectFactory.rgbaToString(color);

    return new ShadowEffect(shadowColor, offsetX, offsetY, strokeWidth, strokeColor, topStrokeWidth, topStrokeColor);
  }

  /**
   * 创建纹理特效
   */
  private static createTexture (params: any): TextureEffect {
    const {
      strokeWidth = 0.04,
      strokeColor = '#9C4607',
      imageUrl = 'https://picsum.photos/200/200',
    } = params || {};

    return new TextureEffect(strokeWidth, strokeColor, imageUrl);
  }

  /**
   * 创建纯色填充特效
   */
  private static createSolidFill (params: any): SolidFillEffect {
    const { color = [1, 1, 1, 1] } = params || {};
    const fillColor = EffectFactory.rgbaToString(color);

    return new SolidFillEffect(fillColor);
  }

  /**
   * 将RGBA数组转换为CSS颜色字符串
   */
  private static rgbaToString (rgba: number[]): string {
    if (!rgba || rgba.length < 3) {return '#FFFFFF';}

    const [r, g, b, a = 1] = rgba;

    // 将0-1范围转换为0-255范围
    const red = Math.round(r * 255);
    const green = Math.round(g * 255);
    const blue = Math.round(b * 255);

    return `rgba(${red}, ${green}, ${blue}, ${a})`;
  }

  /**
   * 批量创建特效
   */
  static createEffects (configs: FancyTextEffect[]): TextEffect[] {
    if (!configs || !Array.isArray(configs)) {
      return [];
    }

    const effects: TextEffect[] = [];

    for (const config of configs) {
      const effect = EffectFactory.createEffect(config);

      if (effect) {
        effects.push(effect);
      }
    }

    return effects;
  }
}
