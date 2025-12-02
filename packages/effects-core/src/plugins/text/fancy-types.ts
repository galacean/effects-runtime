export interface FancyTextEffect {
  type: 'single-stroke' | 'gradient' | 'shadow' | 'texture' | 'solid-fill',
  params?: Record<string, any>,
}

export interface FancyTextStyle {
  effects: FancyTextEffect[],
  editableParams?: string[],
  enablePreset?: boolean,
  presetName?: string,
}

export interface TextEnv {
  fontDesc: string,
  style: any,
  layout: any,
  lines: any[],
  layer: {
    dispose: () => void,
  },
  canvas: HTMLCanvasElement,
}

export interface TextEffect {
  name?: string,
  render?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
  renderDecorations?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
  renderFill?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
}
