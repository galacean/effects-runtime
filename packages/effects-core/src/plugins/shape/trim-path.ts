import type { ContourMeasure } from './contour-measure';
import { ContourMeasureIter } from './contour-measure';
import { GraphicsPath } from './graphics-path';

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
  private trimmedGraphicsPath = new GraphicsPath();

  clone (): TrimPath {
    const trimPath = new TrimPath();

    trimPath.start = this.start;
    trimPath.end = this.end;
    trimPath.offset = this.offset;
    trimPath.mode = this.mode;

    return trimPath;
  }

  createTrimmedPath (source: GraphicsPath, screenScale: number): GraphicsPath {
    if (this.isIdentity()) {
      return source;
    }

    const contours = new ContourMeasureIter(source, screenScale).toArray();

    this.trimmedGraphicsPath.clear();

    if (contours.length === 0) {
      return this.trimmedGraphicsPath;
    }

    if (this.mode === TrimPathMode.Sequential) {
      this.applySequentialTrimPath(contours, this.trimmedGraphicsPath);
    } else {
      this.applySynchronizedTrimPath(contours, this.trimmedGraphicsPath);
    }

    return this.trimmedGraphicsPath;
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
    destination: GraphicsPath,
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
      endLength += totalLength;
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
        destination,
        previousContourIndex !== piece.contourIndex || !contour.isClosed(),
      );

      if (piece.startLength === 0 && piece.endLength - piece.startLength >= contourLength && contour.isClosed()) {
        destination.closePath();
      }

      previousContourIndex = piece.contourIndex;
    }
  }

  private applySynchronizedTrimPath (
    contours: ContourMeasure[],
    destination: GraphicsPath,
  ): void {
    const renderOffset = this.normalizeTrimOffset();

    for (const contour of contours) {
      const contourLength = contour.length();
      let startLength = contourLength * (this.start + renderOffset);
      let endLength = contourLength * (this.end + renderOffset);

      if (endLength < startLength) {
        endLength += contourLength;
      }

      if (startLength >= contourLength) {
        startLength -= contourLength;
        endLength -= contourLength;
      }

      contour.getSegment(startLength, endLength, destination, true);

      while (endLength > contourLength) {
        startLength = 0;
        endLength -= contourLength;
        contour.getSegment(startLength, endLength, destination, !contour.isClosed());
      }

      if (this.start === 0 && this.end === 1 && contour.isClosed()) {
        destination.closePath();
      }
    }
  }
}