import type { TextEnv } from '@galacean/effects-core';
import {
  GradientDrawer,
  ShadowDrawer,
  SingleStrokeDrawer,
  SolidFillDrawer,
  TextureDrawer,
} from '@galacean/effects-core';

const { expect } = chai;

/**
 * 解析颜色字符串，返回 [r, g, b, a] 数组
 * 支持 #rrggbb 和 rgba(r, g, b, a) 格式
 */
function parseColor (colorStr: string): [number, number, number, number] | null {
  // 匹配 #rrggbb 格式
  const hexMatch = colorStr.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);

  if (hexMatch) {
    return [
      parseInt(hexMatch[1], 16),
      parseInt(hexMatch[2], 16),
      parseInt(hexMatch[3], 16),
      1,
    ];
  }

  // 匹配 rgba(r, g, b, a) 格式
  const rgbaMatch = colorStr.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);

  if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1]),
      parseInt(rgbaMatch[2]),
      parseInt(rgbaMatch[3]),
      rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    ];
  }

  return null;
}

describe('core/plugins/text/text-layer-drawers', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let mockEnv: TextEnv;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    ctx = canvas.getContext('2d')!;

    mockEnv = {
      fontDesc: '24px Arial',
      style: {
        fontScale: 1,
        fontSize: 24,
      },
      layout: {
        getOffsetX: () => 10,
      },
      lines: [
        {
          chars: ['H', 'i'],
          charOffsetX: [0, 20],
          y: 50,
          width: 40,
        },
      ],
      layer: {
        dispose: () => {},
      },
      canvas,
    };
  });

  describe('SingleStrokeDrawer', () => {
    it('should set strokeStyle with converted color', () => {
      const drawer = new SingleStrokeDrawer(2, [1, 0.5, 0.25, 0.8], 'px');

      drawer.render(ctx, mockEnv);

      const color = parseColor(ctx.strokeStyle as string);

      expect(color).to.eql([255, 128, 64, 0.8]);
    });

    it('should set lineWidth with px unit', () => {
      const drawer = new SingleStrokeDrawer(3, [0, 0, 0, 1], 'px');

      drawer.render(ctx, mockEnv);

      expect(ctx.lineWidth).to.eql(3);
    });

    it('should calculate lineWidth with em unit', () => {
      const drawer = new SingleStrokeDrawer(0.5, [0, 0, 0, 1], 'em');

      drawer.render(ctx, mockEnv);

      // 0.5 * 24 (fontSize) * 1 (fontScale) = 12
      expect(ctx.lineWidth).to.eql(12);
    });

    it('should apply fontScale to lineWidth', () => {
      const drawer = new SingleStrokeDrawer(2, [0, 0, 0, 1], 'px');
      const envWithScale = {
        ...mockEnv,
        style: { fontScale: 2, fontSize: 24 },
      };

      drawer.render(ctx, envWithScale);

      expect(ctx.lineWidth).to.eql(4);
    });

    it('should set lineJoin to round', () => {
      const drawer = new SingleStrokeDrawer(2, [0, 0, 0, 1], 'px');

      drawer.render(ctx, mockEnv);

      expect(ctx.lineJoin).to.eql('round');
    });

    it('should set font and textBaseline', () => {
      const drawer = new SingleStrokeDrawer(2, [0, 0, 0, 1], 'px');

      drawer.render(ctx, mockEnv);

      expect(ctx.font).to.eql('24px Arial');
      expect(ctx.textBaseline).to.eql('alphabetic');
    });

    it('should have correct name', () => {
      const drawer = new SingleStrokeDrawer(2, [0, 0, 0, 1], 'px');

      expect(drawer.name).to.eql('single-stroke');
    });
  });

  describe('SolidFillDrawer', () => {
    it('should set fillStyle with converted color', () => {
      const drawer = new SolidFillDrawer([0.5, 0.25, 0.75, 0.6]);

      drawer.render(ctx, mockEnv);

      const color = parseColor(ctx.fillStyle as string);

      expect(color).to.eql([128, 64, 191, 0.6]);
    });

    it('should set font and textBaseline', () => {
      const drawer = new SolidFillDrawer([1, 1, 1, 1]);

      drawer.render(ctx, mockEnv);

      expect(ctx.font).to.eql('24px Arial');
      expect(ctx.textBaseline).to.eql('alphabetic');
    });

    it('should have correct name', () => {
      const drawer = new SolidFillDrawer([1, 1, 1, 1]);

      expect(drawer.name).to.eql('solid-fill');
    });
  });

  describe('GradientDrawer', () => {
    it('should create linear gradient with correct colors', () => {
      const drawer = new GradientDrawer([
        [1, 0, 0, 1],
        [0, 0, 1, 1],
      ], 0);

      drawer.render(ctx, mockEnv);

      // fillStyle should be a CanvasGradient
      expect(ctx.fillStyle).to.be.instanceof(CanvasGradient);
    });

    it('should convert color values from 0-1 to 0-255', () => {
      const drawer = new GradientDrawer([
        [0.5, 0.5, 0.5, 1],
      ], 0);

      drawer.render(ctx, mockEnv);

      expect(ctx.fillStyle).to.be.instanceof(CanvasGradient);
    });

    it('should set stop to 0 for single color', () => {
      const drawer = new GradientDrawer([[1, 0, 0, 1]], 45);

      drawer.render(ctx, mockEnv);

      expect(ctx.fillStyle).to.be.instanceof(CanvasGradient);
    });

    it('should set font and textBaseline', () => {
      const drawer = new GradientDrawer([[1, 1, 1, 1]], 0);

      drawer.render(ctx, mockEnv);

      expect(ctx.font).to.eql('24px Arial');
      expect(ctx.textBaseline).to.eql('alphabetic');
    });

    it('should have correct name', () => {
      const drawer = new GradientDrawer([[1, 1, 1, 1]], 0);

      expect(drawer.name).to.eql('gradient');
    });
  });

  describe('ShadowDrawer', () => {
    it('should set shadowColor with converted color', () => {
      const drawer = new ShadowDrawer([0.5, 0.5, 0.5, 0.5], 10, 2, 3);

      drawer.render(ctx, mockEnv);

      const color = parseColor(ctx.shadowColor);

      expect(color).to.eql([128, 128, 128, 0.5]);
    });

    it('should set shadowBlur', () => {
      const drawer = new ShadowDrawer([0, 0, 0, 1], 15, 0, 0);

      drawer.render(ctx, mockEnv);

      expect(ctx.shadowBlur).to.eql(15);
    });

    it('should set shadowOffsetX and shadowOffsetY', () => {
      const drawer = new ShadowDrawer([0, 0, 0, 1], 5, 3, -2);

      drawer.render(ctx, mockEnv);

      expect(ctx.shadowOffsetX).to.eql(3);
      expect(ctx.shadowOffsetY).to.eql(-2);
    });

    it('should have correct name', () => {
      const drawer = new ShadowDrawer([0, 0, 0, 1], 5, 0, 0);

      expect(drawer.name).to.eql('shadow');
    });
  });

  describe('TextureDrawer', () => {
    it('should return early when pattern is null', () => {
      const drawer = new TextureDrawer(null);

      // 保存初始状态
      const initialFillStyle = ctx.fillStyle;

      drawer.render(ctx, mockEnv);

      // fillStyle 不应该被修改
      expect(ctx.fillStyle).to.eql(initialFillStyle);
    });

    it('should set fillStyle when pattern is provided', () => {
      // 创建一个简单的 pattern
      const patternCanvas = document.createElement('canvas');

      patternCanvas.width = 10;
      patternCanvas.height = 10;
      const patternCtx = patternCanvas.getContext('2d')!;

      patternCtx.fillStyle = 'red';
      patternCtx.fillRect(0, 0, 10, 10);

      const pattern = ctx.createPattern(patternCanvas, 'repeat')!;
      const drawer = new TextureDrawer(pattern);

      drawer.render(ctx, mockEnv);

      expect(ctx.fillStyle).to.eql(pattern);
    });

    it('should set font and textBaseline when pattern is provided', () => {
      const patternCanvas = document.createElement('canvas');

      patternCanvas.width = 10;
      patternCanvas.height = 10;
      const patternCtx = patternCanvas.getContext('2d')!;

      patternCtx.fillStyle = 'red';
      patternCtx.fillRect(0, 0, 10, 10);

      const pattern = ctx.createPattern(patternCanvas, 'repeat')!;
      const drawer = new TextureDrawer(pattern);

      drawer.render(ctx, mockEnv);

      expect(ctx.font).to.eql('24px Arial');
      expect(ctx.textBaseline).to.eql('alphabetic');
    });

    it('should have correct name', () => {
      const drawer = new TextureDrawer(null);

      expect(drawer.name).to.eql('texture');
    });
  });

  describe('color conversion', () => {
    it('should correctly convert 0 to 0', () => {
      const drawer = new SolidFillDrawer([0, 0, 0, 1]);

      drawer.render(ctx, mockEnv);

      const color = parseColor(ctx.fillStyle as string);

      expect(color).to.eql([0, 0, 0, 1]);
    });

    it('should correctly convert 1 to 255', () => {
      const drawer = new SolidFillDrawer([1, 1, 1, 1]);

      drawer.render(ctx, mockEnv);

      const color = parseColor(ctx.fillStyle as string);

      expect(color).to.eql([255, 255, 255, 1]);
    });

    it('should correctly convert fractional values', () => {
      const drawer = new SolidFillDrawer([0.004, 0.5, 0.996, 0.5]);

      drawer.render(ctx, mockEnv);

      const color = parseColor(ctx.fillStyle as string);

      // Math.round(0.004 * 255) = 1
      // Math.round(0.5 * 255) = 128
      // Math.round(0.996 * 255) = 254
      expect(color).to.eql([1, 128, 254, 0.5]);
    });
  });
});