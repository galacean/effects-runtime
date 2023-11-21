import * as spec from '@galacean/effects-specification';

const renderLevelPassSet: Record<string, string[]> = {
  [spec.RenderLevel.S]: [spec.RenderLevel.S, spec.RenderLevel.BPlus, spec.RenderLevel.APlus],
  [spec.RenderLevel.A]: [spec.RenderLevel.A, spec.RenderLevel.BPlus, spec.RenderLevel.APlus],
  [spec.RenderLevel.B]: [spec.RenderLevel.B, spec.RenderLevel.BPlus],
};

export function passRenderLevel (l: string | undefined, renderLevel?: string): boolean {
  if (!l || !renderLevel) {
    return true;
  }

  const arr = renderLevelPassSet[renderLevel];

  if (arr) {
    return arr.includes(l);
  }

  return false;
}
