import type { TextEnv } from '../text-effect-base';
import type { TextEffect } from '../text-effect-base';

// 将宽度转换为像素值，支持 px 和 em 单位
function toPxWidth (width: number, unit: 'px' | 'em', env: TextEnv): number {
  const px = unit === 'em' ? width * env.style.fontSize : width;

  return px * (env.style.fontScale || 1);
}

/**
 * 单描边特效 - 只负责描边装饰
 */
export class SingleStrokeEffect implements TextEffect {
  name = 'single-stroke';

  constructor (
    private strokeWidth: number = 4,
    private strokeColor: string = '#FF3F89',
    private unit: 'px' | 'em' = 'px'
  ) {}

  // 保持向后兼容的完整渲染方法
  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    this.renderDecorations(ctx, env);
  }

  // 只绘制描边装饰
  renderDecorations (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 确保初始状态干净
    ctx.shadowColor = 'transparent';

    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = toPxWidth(this.strokeWidth, this.unit, env);  // 支持 px 和 em 单位
    ctx.strokeStyle = this.strokeColor;

    env.lines.forEach(line => {
      const x = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((str: string, i: number) => {
        ctx.strokeText(str, x + line.charOffsetX[i], line.y);
      });
    });
  }

  // 单描边特效不负责填充
  renderFill (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 不执行任何填充操作
  }
}

/**
 * 纯色填充特效 - 只负责填充
 */
export class SolidFillEffect implements TextEffect {
  name = 'solid-fill';

  constructor (
    private fillColor: string = '#FFBCD7'
  ) {}

  // 保持向后兼容的完整渲染方法
  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    this.renderFill(ctx, env);
  }

  // 纯填充特效不负责装饰
  renderDecorations (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 不执行任何装饰操作
  }

  // 只负责填充
  renderFill (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 确保初始状态干净
    ctx.shadowColor = 'transparent';

    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.fillColor;

    env.lines.forEach(line => {
      const x = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((str: string, i: number) => {
        ctx.fillText(str, x + line.charOffsetX[i], line.y);
      });
    });
  }
}

/**
 * 多描边特效 - 只负责装饰（描边）
 */
export class MultiStrokeEffect implements TextEffect {
  name = 'multi-stroke';

  constructor (
    private layers?: Array<{ width: number, color: string, unit?: 'px' | 'em' }>,
    private perLayerFill = false,
    private fillColor: string = '#FFFFFF'
  ) {
    if (!this.layers) {
      this.layers = [
        { width: 15, color: '#C048C5' },
        { width: 12, color: '#7057CF' },
        { width: 9, color: '#86E431' },
        { width: 6, color: '#FF865B' },
        { width: 3, color: '#FC3081' },
      ];
    }
  }

  // 保持向后兼容的完整渲染方法
  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    for (const layer of this.layers || []) {
      const unit = layer.unit || 'px';

      ctx.lineWidth = toPxWidth(layer.width, unit, env);  // 支持 px 和 em 单位
      ctx.strokeStyle = layer.color;

      env.lines.forEach(line => {
        const x0 = env.layout.getOffsetX(env.style, line.width);

        for (let i = 0; i < line.chars.length; i++) {
          const x = x0 + line.charOffsetX[i], y = line.y;

          ctx.strokeText(line.chars[i], x, y);
          if (this.perLayerFill) {
            ctx.fillStyle = layer.color;
            ctx.fillText(line.chars[i], x, y);
          }
        }
      });
    }

    // 如果不使用 perLayerFill，则使用统一的 fillColor 填充
    if (!this.perLayerFill) {
      ctx.fillStyle = this.fillColor;
      env.lines.forEach(line => {
        const x = env.layout.getOffsetX(env.style, line.width);

        line.chars.forEach((str: string, i: number) => {
          ctx.fillText(str, x + line.charOffsetX[i], line.y);
        });
      });
    }
  }

  // 只绘制描边装饰
  renderDecorations (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    // 绘制多层描边
    if (this.layers) {
      for (const layer of this.layers) {
        const unit = layer.unit || 'px';

        ctx.lineWidth = toPxWidth(layer.width, unit, env);  // 支持 px 和 em 单位
        ctx.strokeStyle = layer.color;

        env.lines.forEach(line => {
          const x = env.layout.getOffsetX(env.style, line.width);

          line.chars.forEach((str: string, i: number) => {
            ctx.strokeText(str, x + line.charOffsetX[i], line.y);
          });
        });
      }
    }
  }

  // 填充文字
  renderFill (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 确保初始状态干净
    ctx.shadowColor = 'transparent';

    ctx.fillStyle = this.fillColor;
    env.lines.forEach(line => {
      const x = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((str: string, i: number) => {
        ctx.fillText(str, x + line.charOffsetX[i], line.y);
      });
    });
  }
}

/**
 * 渐变特效 - 只负责填充
 */
export class GradientEffect implements TextEffect {
  name = 'gradient';

  constructor (
    private strokeWidth: number = 0.09,
    private strokeColor: string = '#F8E8A2',
    private startColor: string = '#FF3A3A',
    private endColor: string = '#A80101'
  ) {}

  // 保持向后兼容的完整渲染方法
  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    this.renderDecorations(ctx, env);
    this.renderFill(ctx, env);
  }

  // 绘制描边装饰
  renderDecorations (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 确保初始状态干净
    ctx.shadowColor = 'transparent';

    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    const fontSize = env.style.fontSize * env.style.fontScale;

    // 描边
    ctx.lineWidth = this.strokeWidth * fontSize;
    ctx.strokeStyle = this.strokeColor;

    env.lines.forEach(line => {
      const x = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((str: string, i: number) => {
        ctx.strokeText(str, x + line.charOffsetX[i], line.y);
      });
    });
  }

  // 渐变填充
  renderFill (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';

    // 创建渐变
    const gradient = ctx.createLinearGradient(
      0,
      0,
      0,
      env.canvas.height
    );

    gradient.addColorStop(0, this.startColor);
    gradient.addColorStop(1, this.endColor);

    // 渐变填充
    ctx.fillStyle = gradient;
    env.lines.forEach(line => {
      const x = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((str: string, i: number) => {
        ctx.fillText(str, x + line.charOffsetX[i], line.y);
      });
    });
  }
}

/**
 * 投影特效 - 只负责装饰（阴影）
 */
export class ShadowEffect implements TextEffect {
  name = 'shadow';

  constructor (
    private shadowColor: string = '#EE4949',
    private shadowOffsetX: number = 2,
    private shadowOffsetY: number = 2,
    private blur: number = 5,
    private strokeWidth: number = 0.12,
    private strokeColor: string = '#F7A4A4',
    private topStrokeWidth: number = 0.04,
    private topStrokeColor: string = '#FFFFFF'
  ) {}

  // 保持向后兼容的完整渲染方法
  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    this.renderDecorations(ctx, env);
  }

  // 只绘制阴影装饰
  renderDecorations (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 确保初始状态干净
    ctx.shadowColor = 'transparent';

    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    const fontSize = env.style.fontSize * env.style.fontScale;

    // 底层：粗描边 + 投影
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.blur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
    ctx.lineWidth = this.strokeWidth * fontSize;
    ctx.strokeStyle = this.strokeColor;

    env.lines.forEach(line => {
      const x = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((str: string, i: number) => {
        ctx.strokeText(str, x + line.charOffsetX[i], line.y);
      });
    });

    // 关闭阴影，画上层细描边
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = this.topStrokeWidth * fontSize;
    ctx.strokeStyle = this.topStrokeColor;

    env.lines.forEach(line => {
      const x = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((str: string, i: number) => {
        ctx.strokeText(str, x + line.charOffsetX[i], line.y);
      });
    });
  }

  // 阴影特效不负责填充
  renderFill (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 不执行任何填充操作
  }
}

/**
 * 纹理特效 - 只负责填充
 */
export class TextureEffect implements TextEffect {
  name = 'texture';
  private pattern: CanvasPattern | null = null;
  private image: HTMLImageElement | null = null;
  private imageLoaded = false;
  private onLoadCallback: (() => void) | null = null;

  constructor (
    private strokeWidth: number = 0.04,
    private strokeColor: string = '#9C4607',
    private imageUrl: string = 'https://picsum.photos/200/200'
  ) {
    this.loadImage();
  }

  // 设置加载完成回调
  setOnLoadCallback (callback: () => void): void {
    this.onLoadCallback = callback;
    // 如果图片已经加载完成，立即调用回调
    if (this.imageLoaded) {
      callback();
    }
  }

  private loadImage (): void {
    this.image = new Image();
    // 判断是否为绝对 URL
    try {
      new URL(this.imageUrl);
      // 如果是绝对 URL，设置 crossOrigin
      this.image.crossOrigin = 'anonymous';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // 如果不是绝对 URL（本地路径），不设置 crossOrigin
    }
    this.image.src = this.imageUrl;
    this.image.onload = () => {
      this.imageLoaded = true;
      // 缓存 Image 和 Pattern
      if (this.image) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (ctx) {
          this.pattern = ctx.createPattern(this.image, 'repeat');
        }
      }
      // 图片加载完成后调用回调
      if (this.onLoadCallback) {
        this.onLoadCallback();
      }
    };
  }

  // 保持向后兼容的完整渲染方法
  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    this.renderDecorations(ctx, env);
    this.renderFill(ctx, env);
  }

  // 绘制描边装饰
  renderDecorations (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 确保初始状态干净
    ctx.shadowColor = 'transparent';

    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    const fontSize = env.style.fontSize * env.style.fontScale;

    // 描边
    ctx.lineWidth = this.strokeWidth * fontSize;
    ctx.strokeStyle = this.strokeColor;

    env.lines.forEach(line => {
      const x = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((str: string, i: number) => {
        ctx.strokeText(str, x + line.charOffsetX[i], line.y);
      });
    });
  }

  // 纹理填充
  renderFill (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';

    // 纹理填充
    if (this.pattern) {
      ctx.fillStyle = this.pattern;
    } else {
      // 降级为渐变
      const gradient = ctx.createLinearGradient(0, 0, 0, env.canvas.height);

      gradient.addColorStop(0, '#FF3A3A');
      gradient.addColorStop(1, '#A80101');
      ctx.fillStyle = gradient;
    }

    env.lines.forEach(line => {
      const x = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((str: string, i: number) => {
        ctx.fillText(str, x + line.charOffsetX[i], line.y);
      });
    });
  }
}
