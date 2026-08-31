import {
  effectsClass,
  math,
} from '@galacean/effects';
import type { Engine, spec } from '@galacean/effects';
import { Container, SizeFlags } from '../core/control';
import type { Control } from '../core/control';
import { LayoutAlignment, Orientation } from './enums';
import { alignmentOffset, assertEnumValue, growSlots, sum } from './utils';

/** Places visible children in a single horizontal or vertical row. */
export class BoxContainer extends Container {
  static override readonly themeType: string = 'BoxContainer';
  private _orientation = Orientation.Horizontal;
  private _alignment = LayoutAlignment.Begin;
  private _reverse = false;

  get orientation (): Orientation {
    return this._orientation;
  }

  set orientation (value: Orientation) {
    assertEnumValue('BoxContainer orientation', value, Orientation.Vertical);
    if (this._orientation !== value) {
      this._orientation = value;
      this.invalidateMeasurement();
    }
  }

  get alignment (): LayoutAlignment {
    return this._alignment;
  }

  set alignment (value: LayoutAlignment) {
    assertEnumValue('BoxContainer alignment', value, LayoutAlignment.End);
    if (this._alignment !== value) {
      this._alignment = value;
      this.queueSort();
    }
  }

  get reverse (): boolean {
    return this._reverse;
  }

  set reverse (value: boolean) {
    if (this._reverse !== value) {
      this._reverse = value;
      this.queueSort();
    }
  }

  override getMinimumSize (): math.Vector2 {
    return this.measureChildren(false);
  }

  override getDesiredSize (): math.Vector2 {
    return this.measureChildren(true);
  }

  protected override sortChildren (): void {
    const children = this.getLayoutChildren();

    if (this.reverse) {
      children.reverse();
    }
    if (children.length === 0) {
      return;
    }

    const horizontal = this.orientation === Orientation.Horizontal;
    const availableMain = horizontal ? this.size.x : this.size.y;
    const availableCross = horizontal ? this.size.y : this.size.x;
    const separation = this.getThemeConstant('separation');
    const gapTotal = separation * (children.length - 1);
    const slotSpace = availableMain - gapTotal;
    const minimums = children.map(child => this.getMainSize(child.getBoundMinimumSize()));
    const desired = children.map(child => this.getMainSize(child.getBoundDesiredSize()));
    const maximums = children.map(child => this.getMainSize(child.getCombinedMaximumSize()));
    const sizes = minimums.slice();
    const integerPixels = Number.isInteger(slotSpace)
      && minimums.every(Number.isInteger)
      && desired.every(Number.isInteger)
      && maximums.every(value => value < 0 || Number.isInteger(value));
    let extra = Math.max(0, slotSpace - sum(sizes));

    extra = growSlots(
      sizes,
      desired,
      desired.map((value, index) => Math.max(0, value - sizes[index])),
      extra,
      integerPixels,
    );
    growSlots(
      sizes,
      maximums,
      children.map(child => this.isMainExpanded(child) ? child.stretchRatio : 0),
      extra,
      integerPixels,
    );

    const usedMain = sum(sizes) + gapTotal;
    let cursor = alignmentOffset(this.alignment, Math.max(0, availableMain - usedMain));

    for (let index = 0; index < children.length; index++) {
      const mainSize = sizes[index];
      const position = horizontal ? new math.Vector2(cursor, 0) : new math.Vector2(0, cursor);
      const size = horizontal
        ? new math.Vector2(mainSize, availableCross)
        : new math.Vector2(availableCross, mainSize);

      this.fitChildInRect(children[index], { position, size });
      cursor += mainSize + separation;
    }
  }

  private measureChildren (useDesired: boolean): math.Vector2 {
    const children = this.getLayoutChildren();
    let main = 0;
    let cross = 0;

    for (const child of children) {
      const childSize = useDesired ? child.getBoundDesiredSize() : child.getBoundMinimumSize();

      main += this.getMainSize(childSize);
      cross = Math.max(cross, this.getCrossSize(childSize));
    }
    if (children.length > 1) {
      main += this.getThemeConstant('separation') * (children.length - 1);
    }

    return this.orientation === Orientation.Horizontal
      ? new math.Vector2(main, cross)
      : new math.Vector2(cross, main);
  }

  private getMainSize (size: math.Vector2): number {
    return this.orientation === Orientation.Horizontal ? size.x : size.y;
  }

  private getCrossSize (size: math.Vector2): number {
    return this.orientation === Orientation.Horizontal ? size.y : size.x;
  }

  private isMainExpanded (child: Control): boolean {
    const flags = this.orientation === Orientation.Horizontal
      ? child.horizontalSizeFlags
      : child.verticalSizeFlags;

    return (flags & SizeFlags.Expand) !== 0;
  }

  private invalidateMeasurement (): void {
    this.updateMinimumSize();
    this.updateDesiredSize();
    this.queueSort();
  }

  override fromData (data: spec.BoxContainerData): void {
    super.fromData(data);
    if (data.alignment !== undefined) {
      this.alignment = data.alignment;
    }
    if (data.reverse !== undefined) {
      this.reverse = data.reverse;
    }
  }
}

@effectsClass('HBoxContainer')
export class HBoxContainer extends BoxContainer {
  static override readonly themeType: string = 'HBoxContainer';
  constructor (engine: Engine) {
    super(engine);
    this.orientation = Orientation.Horizontal;
  }
}

@effectsClass('VBoxContainer')
export class VBoxContainer extends BoxContainer {
  static override readonly themeType: string = 'VBoxContainer';
  constructor (engine: Engine) {
    super(engine);
    this.orientation = Orientation.Vertical;
  }
}
