import { GraphicsPath } from './graphics-path';

/** Source contour shared by all pieces extracted from it. */
export interface TrimContourSource {
  closed: boolean,
  segmentIds: readonly number[],
}

/** Original segment and its extracted range in normalized source-contour arc length. */
export interface TrimSegmentSource {
  segmentId: number,
  start: number,
  end: number,
}

/**
 * Trimmed geometry and source mappings keyed by instruction index in path.
 * Extracted paths only contain moveTo, lineTo, bezierCurveTo and closePath, so
 * recorded indices also identify commands after conversion to a contour path.
 * The caller owns this storage and overwrites it when reusing it as an output.
 */
export class TrimmedPathResult {
  private readonly trimmedGraphicsPath = new GraphicsPath();
  path = this.trimmedGraphicsPath;
  readonly contours = new Map<number, TrimContourSource>();
  readonly segments = new Map<number, TrimSegmentSource>();

  reset (source?: GraphicsPath): this {
    this.path = source ?? this.trimmedGraphicsPath;
    if (!source) {
      this.trimmedGraphicsPath.clear();
    }
    this.contours.clear();
    this.segments.clear();

    return this;
  }
}
