import type { CharInfo } from './text-item';

export interface TextEffect {
  name: string,
  render(ctx: CanvasRenderingContext2D, env: TextEnv): void,
  renderDecorations?(ctx: CanvasRenderingContext2D, env: TextEnv): void,
  renderFill?(ctx: CanvasRenderingContext2D, env: TextEnv): void,
}

export interface TextEnv {
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  fontDesc: string,
  style: any, // TextStyle
  layout: any, // TextLayout
  lines: CharInfo[],
  dpr: number,
  layer: LayerManager,
}

export class LayerManager {
  private layers: Map<string, HTMLCanvasElement> = new Map();

  constructor (private width: number, private height: number) {}

  createLayer (name: string): { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');

    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d')!;

    this.layers.set(name, canvas);

    return { canvas, ctx };
  }

  getMaskLayer (env: TextEnv): { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D } {
    const { canvas, ctx } = this.createLayer('mask');

    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';

    env.lines.forEach(line => {
      const x = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((str: string, i: number) => {
        ctx.fillText(str, x + line.charOffsetX[i], line.y);
      });
    });

    return { canvas, ctx };
  }

  dispose () {
    this.layers.clear();
  }
}

/**
 * 创建文本渲染环境
 */
export function createTextEnv (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  style: any, // TextStyle
  layout: any, // TextLayout
  charsInfo: CharInfo[]
): TextEnv {
  return {
    canvas,
    ctx: context,
    fontDesc: style.fontDesc,
    style,
    layout,
    lines: charsInfo,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    layer: new LayerManager(canvas.width, canvas.height),
  };
}

/**
 * 渲染带特效的文本
 */
export function renderWithEffects (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  style: any, // TextStyle
  layout: any, // TextLayout
  charsInfo: CharInfo[],
  effects: TextEffect[]
) {
  const env = createTextEnv(canvas, context, style, layout, charsInfo);

  if (!effects || effects.length === 0) {
    // 没有特效时，交回给上层的默认绘制
    env.layer.dispose();

    return;
  }

  // 按效果数组顺序逐个执行，每个效果各自 save/restore 一次
  for (const eff of effects) {
    context.save();
    if (typeof eff.render === 'function') {
      // 优先调用 effect.render，让插件自行决定渲染顺序
      eff.render(context, env);
    } else {
      // 如果没有 render 方法，就按 renderDecorations → renderFill 执行
      eff.renderDecorations?.(context, env);
      eff.renderFill?.(context, env);
    }
    context.restore();
  }

  env.layer.dispose();
}
