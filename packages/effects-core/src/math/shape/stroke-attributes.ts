import type * as spec from '@galacean/effects-specification';

/** Appearance and boundary settings used when expanding a shape's stroke. */
export interface StrokeAttributes {
  /** Base stroke width in path coordinates. */
  width: number,
  /** 0 outside, 0.5 centered, 1 inside a closed source contour. Open source contours ignore this setting. */
  alignment: number,
  cap: spec.LineCap,
  join: spec.LineJoin,
  miterLimit: number,
  /** Omit or leave empty for a uniform width; 0.5 on each side gives the base width. */
  variableWidthPoints?: spec.VariableWidthPoint[],
}
