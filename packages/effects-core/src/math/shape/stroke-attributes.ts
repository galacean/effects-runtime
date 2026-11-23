import type * as spec from '@galacean/effects-specification';

/** Width multipliers at a position along an original contour. */
export interface VariableWidthPoint {
  /** Normalized arc length on the original contour, from 0 to 1, before trimming. */
  position: number,
  /** Width on the positive normal side, as a multiple of the base stroke width. */
  ascent: number,
  /** Width on the negative normal side, as a multiple of the base stroke width. */
  descent: number,
  /** Selects the contour containing this original segment index; position still spans the whole contour. Omit to apply to every contour. */
  segmentId?: number,
}

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
  variableWidthPoints?: VariableWidthPoint[],
}
