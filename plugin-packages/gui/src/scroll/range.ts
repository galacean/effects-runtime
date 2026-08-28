import { EventEmitter } from '@galacean/effects';
import type { Engine, EventEmitterListener } from '@galacean/effects';
import { Control } from '../core/control';
import type { ControlEvent } from '../core/control';
import type { RangeData } from '../data';

export type RangeEvent = ControlEvent & {
  changed: [],
  valueChanged: [value: number],
};

type SharedRange = {
  value: number,
  minValue: number,
  maxValue: number,
  step: number,
  page: number,
  exponentialRatio: boolean,
  allowGreater: boolean,
  allowLesser: boolean,
  owners: Set<Range>,
};

/** Numeric value model shared by scroll bars and future slider controls. */
export class Range extends Control {
  static override readonly themeType: string = 'Range';
  private shared: SharedRange;
  private _rounded = false;
  private suppressSignals = false;
  private readonly rangeEventEmitter = new EventEmitter<RangeEvent>();

  constructor (engine: Engine) {
    super(engine);
    this.shared = createSharedRange();
    this.shared.owners.add(this);
  }

  get minValue (): number {
    return this.shared.minValue;
  }

  set minValue (value: number) {
    this.setMinValue(value);
  }

  get maxValue (): number {
    return this.shared.maxValue;
  }

  set maxValue (value: number) {
    this.setMaxValue(value);
  }

  get step (): number {
    return this.shared.step;
  }

  set step (value: number) {
    this.setStep(value);
  }

  get page (): number {
    return this.shared.page;
  }

  set page (value: number) {
    this.setPage(value);
  }

  get value (): number {
    return this.shared.value;
  }

  set value (value: number) {
    this.setValue(value);
  }

  get ratio (): number {
    return this.getAsRatio();
  }

  set ratio (value: number) {
    this.setAsRatio(value);
  }

  get exponentialRatio (): boolean {
    return this.shared.exponentialRatio;
  }

  set exponentialRatio (value: boolean) {
    this.shared.exponentialRatio = value;
  }

  get rounded (): boolean {
    return this._rounded;
  }

  set rounded (value: boolean) {
    this._rounded = value;
  }

  get allowGreater (): boolean {
    return this.shared.allowGreater;
  }

  set allowGreater (value: boolean) {
    this.shared.allowGreater = value;
  }

  get allowLesser (): boolean {
    return this.shared.allowLesser;
  }

  set allowLesser (value: boolean) {
    this.shared.allowLesser = value;
  }

  override on<E extends keyof RangeEvent> (
    eventName: E,
    listener: EventEmitterListener<RangeEvent[E]>,
  ): void {
    if (eventName === 'changed' || eventName === 'valueChanged') {
      this.rangeEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName, listener as never);
    }
  }

  override off<E extends keyof RangeEvent> (
    eventName: E,
    listener: EventEmitterListener<RangeEvent[E]>,
  ): void {
    if (eventName === 'changed' || eventName === 'valueChanged') {
      this.rangeEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName, listener as never);
    }
  }

  setValue (value: number): void {
    const previous = this.shared.value;

    this.shared.value = this.calculateValue(value);
    if (!valuesEqual(previous, this.shared.value)) {
      this.notifyValueChanged();
    }
  }

  setValueNoSignal (value: number): void {
    const previous = this.shared.value;

    this.shared.value = this.calculateValue(value);
    if (!valuesEqual(previous, this.shared.value)) {
      for (const owner of this.shared.owners) {
        owner.valueChanged(this.shared.value);
      }
    }
  }

  setMinValue (value: number): void {
    assertFinite('Range minValue', value);
    if (this.shared.minValue === value) {
      return;
    }
    this.shared.minValue = value;
    this.shared.maxValue = Math.max(this.shared.maxValue, value);
    this.shared.page = clamp(this.shared.page, 0, this.shared.maxValue - value);
    this.setValue(this.shared.value);
    this.notifyChanged();
  }

  setMaxValue (value: number): void {
    assertFinite('Range maxValue', value);
    const maximum = Math.max(value, this.shared.minValue);

    if (this.shared.maxValue === maximum) {
      return;
    }
    this.shared.maxValue = maximum;
    this.shared.page = clamp(this.shared.page, 0, maximum - this.shared.minValue);
    this.setValue(this.shared.value);
    this.notifyChanged();
  }

  setStep (value: number): void {
    assertFinite('Range step', value);
    if (this.shared.step === value) {
      return;
    }
    this.shared.step = value;
    this.notifyChanged();
  }

  setPage (value: number): void {
    assertFinite('Range page', value);
    const page = clamp(value, 0, this.shared.maxValue - this.shared.minValue);

    if (this.shared.page === page) {
      return;
    }
    this.shared.page = page;
    this.setValue(this.shared.value);
    this.notifyChanged();
  }

  setAsRatio (ratio: number): void {
    assertFinite('Range ratio', ratio);
    const normalized = clamp(ratio, 0, 1);
    let value: number;

    if (this.shared.exponentialRatio && this.shared.minValue >= 0 && this.shared.maxValue > 0) {
      const minimum = this.shared.minValue === 0 ? 0 : Math.log2(this.shared.minValue);
      const maximum = Math.log2(this.shared.maxValue);

      value = 2 ** (minimum + (maximum - minimum) * normalized);
    } else {
      const span = this.shared.maxValue - this.shared.minValue;

      value = this.shared.minValue + span * normalized;
      if (this.shared.step > 0) {
        value = this.shared.minValue + Math.round(span * normalized / this.shared.step) * this.shared.step;
      }
    }
    this.setValue(clamp(value, this.shared.minValue, this.shared.maxValue));
  }

  getAsRatio (): number {
    const span = this.shared.maxValue - this.shared.minValue;

    if (span === 0) {
      return 1;
    }
    const value = clamp(this.shared.value, this.shared.minValue, this.shared.maxValue);

    if (this.shared.exponentialRatio && this.shared.minValue >= 0 && this.shared.maxValue > 0) {
      if (value <= 0) {
        return 0;
      }
      const minimum = this.shared.minValue === 0 ? 0 : Math.log2(this.shared.minValue);
      const maximum = Math.log2(this.shared.maxValue);

      return clamp((Math.log2(value) - minimum) / (maximum - minimum), 0, 1);
    }

    return clamp((value - this.shared.minValue) / span, 0, 1);
  }

  share (range: Range): void {
    if (range === this) {
      return;
    }
    range.attachShared(this.shared);
    range.rangeEventEmitter.emit('changed');
    range.rangeEventEmitter.emit('valueChanged', range.value);
  }

  unshare (): void {
    const previous = this.shared;
    const shared = createSharedRange();

    shared.value = previous.value;
    shared.minValue = previous.minValue;
    shared.maxValue = previous.maxValue;
    shared.step = previous.step;
    shared.page = previous.page;
    shared.exponentialRatio = previous.exponentialRatio;
    shared.allowGreater = previous.allowGreater;
    shared.allowLesser = previous.allowLesser;
    this.attachShared(shared);
  }

  override dispose (): void {
    this.shared.owners.delete(this);
    super.dispose();
  }

  protected valueChanged (value: number): void {}

  private calculateValue (value: number): number {
    if (Number.isNaN(value)) {
      return value;
    }
    assertFinite('Range value', value);
    let calculated = value;

    if (this.shared.step > 0) {
      calculated = snapFrom(this.shared.minValue, calculated, this.shared.step);
    }
    if (this._rounded) {
      calculated = Math.round(calculated);
    }
    if (!this.shared.allowGreater) {
      calculated = Math.min(calculated, this.shared.maxValue - this.shared.page);
    }
    if (!this.shared.allowLesser) {
      calculated = Math.max(calculated, this.shared.minValue);
    }

    return calculated;
  }

  private attachShared (shared: SharedRange): void {
    if (this.shared === shared) {
      return;
    }
    this.shared.owners.delete(this);
    this.shared = shared;
    shared.owners.add(this);
  }

  private notifyValueChanged (): void {
    for (const owner of this.shared.owners) {
      owner.valueChanged(this.shared.value);
      if (!this.suppressSignals) {
        owner.rangeEventEmitter.emit('valueChanged', this.shared.value);
      }
    }
  }

  private notifyChanged (): void {
    for (const owner of this.shared.owners) {
      if (!this.suppressSignals) {
        owner.rangeEventEmitter.emit('changed');
      }
    }
  }

  override fromData (data: RangeData): void {
    this.suppressSignals = true;
    super.fromData(data);
    if (data.allowGreater !== undefined) {
      this.allowGreater = data.allowGreater;
    }
    if (data.allowLesser !== undefined) {
      this.allowLesser = data.allowLesser;
    }
    if (data.exponentialRatio !== undefined) {
      this.exponentialRatio = data.exponentialRatio;
    }
    if (data.rounded !== undefined) {
      this.rounded = data.rounded;
    }
    if (data.minValue !== undefined) {
      this.setMinValue(data.minValue);
    }
    if (data.maxValue !== undefined) {
      this.setMaxValue(data.maxValue);
    }
    if (data.step !== undefined) {
      this.setStep(data.step);
    }
    if (data.page !== undefined) {
      this.setPage(data.page);
    }
    if (data.value !== undefined) {
      this.setValueNoSignal(data.value);
    }
    this.suppressSignals = false;
  }
}

function createSharedRange (): SharedRange {
  return {
    value: 0,
    minValue: 0,
    maxValue: 100,
    step: 1,
    page: 0,
    exponentialRatio: false,
    allowGreater: false,
    allowLesser: false,
    owners: new Set(),
  };
}

function snapFrom (minimum: number, value: number, step: number): number {
  return Number((minimum + Math.round((value - minimum) / step) * step).toPrecision(15));
}

function valuesEqual (left: number, right: number): boolean {
  return left === right || (Number.isNaN(left) && Number.isNaN(right));
}

function clamp (value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertFinite (name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}
