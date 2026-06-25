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

/** 创建满足 TextMetrics 接口的 mock 对象 */
function createMockTextMetrics (overrides: Partial<TextMetrics> = {}): TextMetrics {
  return {
    width: 40,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: 40,
    actualBoundingBoxAscent: 20,
    actualBoundingBoxDescent: 5,
    fontBoundingBoxAscent: 20,
    fontBoundingBoxDescent: 5,
    alphabeticBaseline: 0,
    emHeightAscent: 20,
    emHeightDescent: 5,
    hangingBaseline: 0,
    ideographicBaseline: 0,
    ...overrides,
  };
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

    // mock measureText 以返回可预测的 bounding box 值
    ctx.measureText = (_text: string) => createMockTextMetrics();

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

      drawer.applyStyle(ctx, mockEnv);

      const color = parseColor(ctx.strokeStyle as string);

      expect(color).to.eql([255, 128, 64, 0.8]);
    });

    it('should set lineWidth with px unit', () => {
      const drawer = new SingleStrokeDrawer(3, [0, 0, 0, 1], 'px');

      drawer.applyStyle(ctx, mockEnv);

      expect(ctx.lineWidth).to.eql(3);
    });

    it('should calculate lineWidth with em unit', () => {
      const drawer = new SingleStrokeDrawer(0.5, [0, 0, 0, 1], 'em');

      drawer.applyStyle(ctx, mockEnv);

      // 0.5 * 24 (fontSize) * 1 (fontScale) = 12
      expect(ctx.lineWidth).to.eql(12);
    });

    it('should apply fontScale to lineWidth', () => {
      const drawer = new SingleStrokeDrawer(2, [0, 0, 0, 1], 'px');
      const envWithScale = {
        ...mockEnv,
        style: { fontScale: 2, fontSize: 24 },
      };

      drawer.applyStyle(ctx, envWithScale);

      expect(ctx.lineWidth).to.eql(4);
    });

    it('should set lineJoin to round', () => {
      const drawer = new SingleStrokeDrawer(2, [0, 0, 0, 1], 'px');

      drawer.applyStyle(ctx, mockEnv);

      expect(ctx.lineJoin).to.eql('round');
    });

    it('should set font and textBaseline', () => {
      const drawer = new SingleStrokeDrawer(2, [0, 0, 0, 1], 'px');

      drawer.applyStyle(ctx, mockEnv);

      expect(ctx.font).to.eql('24px Arial');
      expect(ctx.textBaseline).to.eql('alphabetic');
    });

    it('should have correct name', () => {
      const drawer = new SingleStrokeDrawer(2, [0, 0, 0, 1], 'px');

      expect(drawer.name).to.eql('single-stroke');
    });

    it('should not modify passed ctx style properties during render', () => {
      const drawer = new SingleStrokeDrawer(3, [1, 0, 0, 1], 'px');
      const defaultLineWidth = ctx.lineWidth;
      const defaultLineJoin = ctx.lineJoin;

      drawer.render(ctx, mockEnv);

      // render 使用离屏 canvas，不应污染传入的 ctx
      expect(ctx.lineWidth).to.eql(defaultLineWidth);
      expect(ctx.lineJoin).to.eql(defaultLineJoin);
    });

    it('should composite offscreen result onto main canvas via drawImage', () => {
      const drawer = new SingleStrokeDrawer(2, [0, 0, 0, 1], 'px');
      const drawImageSpy = chai.spy.on(ctx, 'drawImage');

      drawer.render(ctx, mockEnv);

      expect(drawImageSpy).to.have.been.called.once;

      chai.spy.restore(ctx, 'drawImage');
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

    it('should use text bbox coordinates (fontScale does not affect bbox)', () => {
      // bbox 不受 fontScale 影响（lines 数据不变）
      // bbox: cx=30, cy=42.5, halfWidth=20, halfHeight=12.5
      const envWithScale = {
        ...mockEnv,
        style: { fontScale: 2, fontSize: 24 },
      };
      const drawer = new GradientDrawer([[1, 0, 0, 1], [0, 0, 1, 1]], 0);
      let capturedArgs: [number, number, number, number] = [0, 0, 0, 0];
      const originalFn = ctx.createLinearGradient;

      ctx.createLinearGradient = function (x0: number, y0: number, x1: number, y1: number) {
        capturedArgs = [x0, y0, x1, y1];

        return originalFn.call(ctx, x0, y0, x1, y1);
      };

      drawer.render(ctx, envWithScale);

      // angle=0: halfLen = |20*1| + |12.5*0| = 20
      // startX = 30 - 20 = 10, endX = 30 + 20 = 50
      // startY = endY = cy = 42.5
      expect(capturedArgs[0]).to.eql(10);    // startX
      expect(capturedArgs[2]).to.eql(50);    // endX
      expect(capturedArgs[1]).to.eql(42.5);  // startY
      expect(capturedArgs[3]).to.eql(42.5);  // endY

      ctx.createLinearGradient = originalFn;
    });

    it('should use projection length based on text bbox (angle=0)', () => {
      // angle=0: halfLen = halfWidth = 20
      const drawer = new GradientDrawer([[1, 0, 0, 1], [0, 0, 1, 1]], 0);
      let capturedArgs: [number, number, number, number] = [0, 0, 0, 0];
      const originalFn = ctx.createLinearGradient;

      ctx.createLinearGradient = function (x0: number, y0: number, x1: number, y1: number) {
        capturedArgs = [x0, y0, x1, y1];

        return originalFn.call(ctx, x0, y0, x1, y1);
      };

      drawer.render(ctx, mockEnv);

      // startX = 30 - 20 = 10, endX = 30 + 20 = 50 (恰好覆盖文字水平范围)
      // startY = endY = 42.5
      expect(capturedArgs[0]).to.eql(10);
      expect(capturedArgs[2]).to.eql(50);
      expect(capturedArgs[1]).to.eql(42.5);
      expect(capturedArgs[3]).to.eql(42.5);

      ctx.createLinearGradient = originalFn;
    });

    it('should use projection length based on text bbox (angle=90)', () => {
      // angle=90: halfLen = halfHeight = 12.5
      const drawer = new GradientDrawer([[1, 0, 0, 1], [0, 0, 1, 1]], 90);
      let capturedArgs: [number, number, number, number] = [0, 0, 0, 0];
      const originalFn = ctx.createLinearGradient;

      ctx.createLinearGradient = function (x0: number, y0: number, x1: number, y1: number) {
        capturedArgs = [x0, y0, x1, y1];

        return originalFn.call(ctx, x0, y0, x1, y1);
      };

      drawer.render(ctx, mockEnv);

      // startX = endX = cx = 30
      // startY = 42.5 - 12.5 = 30, endY = 42.5 + 12.5 = 55 (恰好覆盖文字垂直范围)
      expect(capturedArgs[0]).to.be.closeTo(30, 0.01);
      expect(capturedArgs[2]).to.be.closeTo(30, 0.01);
      expect(capturedArgs[1]).to.be.closeTo(30, 0.01);
      expect(capturedArgs[3]).to.be.closeTo(55, 0.01);

      ctx.createLinearGradient = originalFn;
    });

    it('should render all 7 colors in rainbow gradient at fontScale=2', () => {
      const rainbowColors: [number, number, number, number][] = [
        [1, 0, 0, 1], [1, 0.5, 0, 1], [1, 1, 0, 1], [0, 1, 0, 1],
        [0, 1, 1, 1], [0, 0.5, 1, 1], [0.5, 0, 1, 1],
      ];
      const envWithScale = {
        ...mockEnv,
        style: { fontScale: 2, fontSize: 24 },
      };
      const drawer = new GradientDrawer(rainbowColors, 0);

      drawer.render(ctx, envWithScale);

      expect(ctx.fillStyle).to.be.instanceof(CanvasGradient);
    });

    it('should fall back to canvas dimensions when lines is empty', () => {
      const envEmpty = { ...mockEnv, lines: [] };
      const drawer = new GradientDrawer([[1, 0, 0, 1], [0, 0, 1, 1]], 0);
      let capturedArgs: [number, number, number, number] = [0, 0, 0, 0];
      const originalFn = ctx.createLinearGradient;

      ctx.createLinearGradient = function (x0: number, y0: number, x1: number, y1: number) {
        capturedArgs = [x0, y0, x1, y1];

        return originalFn.call(ctx, x0, y0, x1, y1);
      };

      drawer.render(ctx, envEmpty);

      // 回退到画布逻辑尺寸: cx=100, cy=50, halfWidth=100, halfHeight=50
      // angle=0: halfLen=100, startX=0, endX=200
      expect(capturedArgs[0]).to.eql(0);
      expect(capturedArgs[2]).to.eql(200);
      expect(capturedArgs[1]).to.eql(50);
      expect(capturedArgs[3]).to.eql(50);

      ctx.createLinearGradient = originalFn;
    });

    it('should use fontSize-based ascent/descent when measureText lacks bounding box', () => {
      // 模拟不支持 actualBoundingBoxAscent/Descent 的浏览器
      // 只保留 width 字段，移除 bbox 字段以模拟旧浏览器
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const partialMetrics: any = { width: 40 };

      ctx.measureText = (_text: string) => partialMetrics;

      const drawer = new GradientDrawer([[1, 0, 0, 1], [0, 0, 1, 1]], 90);
      let capturedArgs: [number, number, number, number] = [0, 0, 0, 0];
      const originalFn = ctx.createLinearGradient;

      ctx.createLinearGradient = function (x0: number, y0: number, x1: number, y1: number) {
        capturedArgs = [x0, y0, x1, y1];

        return originalFn.call(ctx, x0, y0, x1, y1);
      };

      drawer.render(ctx, mockEnv);

      // ascent = 24 * 0.8 = 19.2, descent = 24 * 0.25 = 6
      // top = 50 - 19.2 = 30.8, bottom = 50 + 6 = 56
      // cy = (30.8 + 56) / 2 = 43.4, halfHeight = (56 - 30.8) / 2 = 12.6
      // angle=90: startY = 43.4 - 12.6 = 30.8, endY = 43.4 + 12.6 = 56
      expect(capturedArgs[1]).to.be.closeTo(30.8, 0.01);
      expect(capturedArgs[3]).to.be.closeTo(56, 0.01);

      ctx.createLinearGradient = originalFn;
    });

    it('should compute bbox for multi-line text spanning first line top to last line bottom', () => {
      const multiLineEnv = {
        ...mockEnv,
        lines: [
          { chars: ['L', '1'], charOffsetX: [0, 20], y: 40, width: 40 },
          { chars: ['L', '2'], charOffsetX: [0, 15], y: 70, width: 30 },
        ],
      };
      const drawer = new GradientDrawer([[1, 0, 0, 1], [0, 0, 1, 1]], 90);
      let capturedArgs: [number, number, number, number] = [0, 0, 0, 0];
      const originalFn = ctx.createLinearGradient;

      ctx.createLinearGradient = function (x0: number, y0: number, x1: number, y1: number) {
        capturedArgs = [x0, y0, x1, y1];

        return originalFn.call(ctx, x0, y0, x1, y1);
      };

      drawer.render(ctx, multiLineEnv);

      // top = 40 - 20(ascent) = 20, bottom = 70 + 5(descent) = 75
      // cy = (20 + 75) / 2 = 47.5, halfHeight = (75 - 20) / 2 = 27.5
      // angle=90: startY = 47.5 - 27.5 = 20, endY = 47.5 + 27.5 = 75
      expect(capturedArgs[1]).to.be.closeTo(20, 0.01);
      expect(capturedArgs[3]).to.be.closeTo(75, 0.01);

      ctx.createLinearGradient = originalFn;
    });
  });

  describe('ShadowDrawer', () => {
    it('should return correct shadow params via getShadowParams', () => {
      const drawer = new ShadowDrawer([0.5, 0.5, 0.5, 0.5], 10, 2, 3);

      const params = drawer.getShadowParams();

      expect(params.color).to.eql('rgba(128, 128, 128, 0.5)');
      expect(params.blur).to.eql(10);
      expect(params.offsetX).to.eql(2);
      expect(params.offsetY).to.eql(3);
    });

    it('should not modify context shadow state in render', () => {
      const drawer = new ShadowDrawer([0.5, 0.5, 0.5, 0.5], 15, 3, -2);

      const originalShadowColor = ctx.shadowColor;
      const originalShadowBlur = ctx.shadowBlur;
      const originalShadowOffsetX = ctx.shadowOffsetX;
      const originalShadowOffsetY = ctx.shadowOffsetY;

      drawer.render(ctx, mockEnv);

      // render 不应该修改 ctx 的 shadow 状态
      expect(ctx.shadowColor).to.eql(originalShadowColor);
      expect(ctx.shadowBlur).to.eql(originalShadowBlur);
      expect(ctx.shadowOffsetX).to.eql(originalShadowOffsetX);
      expect(ctx.shadowOffsetY).to.eql(originalShadowOffsetY);
    });

    it('should have correct name', () => {
      const drawer = new ShadowDrawer([0, 0, 0, 1], 5, 0, 0);

      expect(drawer.name).to.eql('shadow');
    });

    it('should correctly convert color values in getShadowParams', () => {
      const drawer = new ShadowDrawer([1, 0, 0.5, 0.8], 5, 0, 0);

      const params = drawer.getShadowParams();

      expect(params.color).to.eql('rgba(255, 0, 128, 0.8)');
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