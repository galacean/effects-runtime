import { Container, SizeFlags, math } from '@galacean/effects';
import type { Control } from '@galacean/effects';
import { assertFinite, growSlots, sum } from './utils';

type TrackMetrics = {
  minimum: number[],
  desired: number[],
  maximum: number[],
  expanded: boolean[],
};

/** Places visible children in LTR row-major cells without spanning. */
export class GridContainer extends Container {
  private _columns = 1;
  private _horizontalSeparation = 0;
  private _verticalSeparation = 0;

  get columns (): number {
    return this._columns;
  }

  set columns (value: number) {
    if (!Number.isInteger(value) || value < 1) {
      throw new RangeError('GridContainer columns must be an integer greater than zero.');
    }
    if (this._columns !== value) {
      this._columns = value;
      this.invalidateMeasurement();
    }
  }

  get horizontalSeparation (): number {
    return this._horizontalSeparation;
  }

  set horizontalSeparation (value: number) {
    assertFinite('GridContainer horizontalSeparation', value);
    if (this._horizontalSeparation !== value) {
      this._horizontalSeparation = value;
      this.invalidateMeasurement();
    }
  }

  get verticalSeparation (): number {
    return this._verticalSeparation;
  }

  set verticalSeparation (value: number) {
    assertFinite('GridContainer verticalSeparation', value);
    if (this._verticalSeparation !== value) {
      this._verticalSeparation = value;
      this.invalidateMeasurement();
    }
  }

  override getMinimumSize (): math.Vector2 {
    return this.measureGrid(false);
  }

  override getDesiredSize (): math.Vector2 {
    return this.measureGrid(true);
  }

  protected override sortChildren (): void {
    const children = this.getLayoutChildren();

    if (children.length === 0) {
      return;
    }
    const columnCount = Math.min(this.columns, children.length);
    const rowCount = Math.ceil(children.length / this.columns);
    const columnMetrics = this.collectTrackMetrics(children, columnCount, true);
    const rowMetrics = this.collectTrackMetrics(children, rowCount, false);
    const columnSizes = this.allocateTracks(columnMetrics, this.size.x, this.horizontalSeparation);
    const rowSizes = this.allocateTracks(rowMetrics, this.size.y, this.verticalSeparation);
    const columnPositions = this.getTrackPositions(columnSizes, this.horizontalSeparation);
    const rowPositions = this.getTrackPositions(rowSizes, this.verticalSeparation);

    for (let index = 0; index < children.length; index++) {
      const column = index % this.columns;
      const row = Math.floor(index / this.columns);

      this.fitChildInRect(children[index], {
        position: new math.Vector2(columnPositions[column], rowPositions[row]),
        size: new math.Vector2(columnSizes[column], rowSizes[row]),
      });
    }
  }

  private measureGrid (useDesired: boolean): math.Vector2 {
    const children = this.getLayoutChildren();

    if (children.length === 0) {
      return new math.Vector2();
    }
    const columnCount = Math.min(this.columns, children.length);
    const rowCount = Math.ceil(children.length / this.columns);
    const columns = this.collectTrackMetrics(children, columnCount, true);
    const rows = this.collectTrackMetrics(children, rowCount, false);
    const columnSizes = useDesired ? columns.desired : columns.minimum;
    const rowSizes = useDesired ? rows.desired : rows.minimum;

    return new math.Vector2(
      sum(columnSizes) + this.horizontalSeparation * Math.max(0, columnCount - 1),
      sum(rowSizes) + this.verticalSeparation * Math.max(0, rowCount - 1),
    );
  }

  private collectTrackMetrics (children: Control[], count: number, horizontal: boolean): TrackMetrics {
    const minimum = new Array<number>(count).fill(0);
    const desired = new Array<number>(count).fill(0);
    const maximum = new Array<number>(count).fill(0);
    const unbounded = new Array<boolean>(count).fill(false);
    const expanded = new Array<boolean>(count).fill(false);

    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      const track = horizontal ? index % this.columns : Math.floor(index / this.columns);
      const childMinimum = child.getBoundMinimumSize();
      const childDesired = child.getBoundDesiredSize();
      const childMaximum = child.getCombinedMaximumSize();
      const minimumValue = horizontal ? childMinimum.x : childMinimum.y;
      const desiredValue = horizontal ? childDesired.x : childDesired.y;
      const maximumValue = horizontal ? childMaximum.x : childMaximum.y;
      const flags = horizontal ? child.horizontalSizeFlags : child.verticalSizeFlags;

      minimum[track] = Math.max(minimum[track], minimumValue);
      desired[track] = Math.max(desired[track], desiredValue);
      if (maximumValue < 0) {
        unbounded[track] = true;
      } else {
        maximum[track] = Math.max(maximum[track], maximumValue);
      }
      expanded[track] ||= (flags & SizeFlags.Expand) !== 0;
    }
    for (let index = 0; index < count; index++) {
      maximum[index] = unbounded[index] ? -1 : Math.max(minimum[index], maximum[index]);
    }

    return { minimum, desired, maximum, expanded };
  }

  private allocateTracks (metrics: TrackMetrics, available: number, separation: number): number[] {
    const sizes = metrics.minimum.slice();
    const trackSpace = available - separation * Math.max(0, sizes.length - 1);
    const integerPixels = Number.isInteger(trackSpace)
      && metrics.minimum.every(Number.isInteger)
      && metrics.desired.every(Number.isInteger)
      && metrics.maximum.every(value => value < 0 || Number.isInteger(value));
    let extra = Math.max(0, trackSpace - sum(sizes));

    extra = growSlots(
      sizes,
      metrics.desired,
      metrics.desired.map((value, index) => Math.max(0, value - sizes[index])),
      extra,
      integerPixels,
    );
    growSlots(
      sizes,
      metrics.maximum,
      metrics.expanded.map(value => value ? 1 : 0),
      extra,
      integerPixels,
    );

    return sizes;
  }

  private getTrackPositions (sizes: number[], separation: number): number[] {
    const positions: number[] = [];
    let cursor = 0;

    for (const size of sizes) {
      positions.push(cursor);
      cursor += size + separation;
    }

    return positions;
  }

  private invalidateMeasurement (): void {
    this.updateMinimumSize();
    this.updateDesiredSize();
    this.queueSort();
  }
}
