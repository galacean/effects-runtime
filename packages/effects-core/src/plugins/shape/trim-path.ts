import type { ContourMeasure } from './contour-measure';
import { ContourMeasureIter } from './contour-measure';
import type { GraphicsPath } from './graphics-path';
import type { TrimmedPathResult } from './trimmed-path-result';

// TODO: Move to spec.
export interface TrimPathData {
  start: number,
  end: number,
  offset: number,
  mode: TrimPathMode,
}

export enum TrimPathMode {
  Synchronized,
  Sequential
}

export class TrimPath {
  start = 0;
  end = 1;
  offset = 0;
  mode = TrimPathMode.Synchronized;

  clone (): TrimPath {
    const trimPath = new TrimPath();

    trimPath.start = this.start;
    trimPath.end = this.end;
    trimPath.offset = this.offset;
    trimPath.mode = this.mode;

    return trimPath;
  }

  /** Writes trimmed geometry and source mappings into the caller-owned result. */
  createTrimmedPath (source: GraphicsPath, screenScale: number, result: TrimmedPathResult): TrimmedPathResult {
    if (this.isIdentity()) {
      return result.reset(source);
    }

    const contours = new ContourMeasureIter(source, screenScale).toArray();

    result.reset();

    if (contours.length === 0) {
      return result;
    }

    if (this.mode === TrimPathMode.Sequential) {
      this.applySequentialTrimPath(contours, result);
    } else {
      this.applySynchronizedTrimPath(contours, result);
    }

    return result;
  }

  isIdentity (): boolean {
    return this.start === 0 && this.end === 1;
  }

  fromData (data: TrimPathData) {
    this.start = data.start;
    this.end = data.end;
    this.offset = data.offset;
    this.mode = data.mode;
  }

  private normalizeTrimOffset (): number {
    return ((this.offset % 1) + 1) % 1;
  }

  private applySequentialTrimPath (
    contours: ContourMeasure[],
    result: TrimmedPathResult,
  ): void {
    let totalLength = 0;

    for (const contour of contours) {
      totalLength += contour.length();
    }

    if (totalLength <= 0) {
      return;
    }

    const renderOffset = this.normalizeTrimOffset();
    let startLength = totalLength * (this.start + renderOffset);
    let endLength = totalLength * (this.end + renderOffset);

    if (endLength < startLength) {
      const swap = startLength;

      startLength = endLength;
      endLength = swap;
    }

    if (startLength > totalLength) {
      startLength -= totalLength;
      endLength -= totalLength;
    }

    const pieces: Array<{ contourIndex: number, startLength: number, endLength: number }> = [];
    let index = 0;

    while (endLength > 0) {
      const contourIndex = index % contours.length;
      const contour = contours[contourIndex];
      const contourLength = contour.length();

      if (startLength < contourLength) {
        pieces.push({ contourIndex, startLength, endLength });
        endLength -= contourLength;
        startLength = 0;
      } else {
        startLength -= contourLength;
        endLength -= contourLength;
      }

      index++;
    }

    let previousContourIndex = -1;

    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const contour = contours[piece.contourIndex];
      const contourLength = contour.length();

      contour.getSegment(
        piece.startLength,
        piece.endLength,
        result.path,
        previousContourIndex !== piece.contourIndex || !contour.isClosed(),
        result,
      );

      if (piece.startLength === 0 && piece.endLength - piece.startLength >= contourLength && contour.isClosed()) {
        result.path.closePath();
      }

      previousContourIndex = piece.contourIndex;
    }
  }

  private applySynchronizedTrimPath (
    contours: ContourMeasure[],
    result: TrimmedPathResult,
  ): void {
    const renderOffset = this.normalizeTrimOffset();

    for (const contour of contours) {
      const contourLength = contour.length();
      let startLength = contourLength * (this.start + renderOffset);
      let endLength = contourLength * (this.end + renderOffset);

      if (endLength < startLength) {
        const swap = startLength;

        startLength = endLength;
        endLength = swap;
      }

      if (startLength >= contourLength) {
        startLength -= contourLength;
        endLength -= contourLength;
      }

      contour.getSegment(startLength, endLength, result.path, true, result);

      while (endLength > contourLength) {
        startLength = 0;
        endLength -= contourLength;
        contour.getSegment(startLength, endLength, result.path, !contour.isClosed(), result);
      }

      if (this.start === 0 && this.end === 1 && contour.isClosed()) {
        result.path.closePath();
      }
    }
  }
}
