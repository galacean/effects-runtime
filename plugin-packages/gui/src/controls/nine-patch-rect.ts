import {
  EventEmitter,
  effectsClass,
  math,
} from '@galacean/effects';
import type {
  Engine,
  EventEmitterListener,
  Texture,
} from '@galacean/effects';
import { Control } from '../core/control';
import type { ControlEvent, Rect } from '../core/control';
import { MouseFilter } from '../core/enums';
import { AxisStretchMode, Side } from './enums';
import type { NinePatchRectData } from '../data';

export type NinePatchRectEvent = ControlEvent & {
  textureChanged: [texture: Texture | null],
};

@effectsClass('NinePatchRect')
export class NinePatchRect extends Control {
  static override readonly themeType: string = 'NinePatchRect';
  private readonly ninePatchEventEmitter = new EventEmitter<NinePatchRectEvent>();
  private readonly patchMargins = [0, 0, 0, 0];
  private _texture: Texture | null = null;
  private _regionRect: Rect;

  drawCenter = true;
  horizontalAxisStretchMode = AxisStretchMode.Stretch;
  verticalAxisStretchMode = AxisStretchMode.Stretch;
  tint = new math.Color(1, 1, 1, 1);

  constructor (engine: Engine, texture: Texture | null = null) {
    super(engine);
    this._texture = texture;
    this._regionRect = {
      position: new math.Vector2(),
      size: new math.Vector2(),
    };
    this.mouseFilter = MouseFilter.Ignore;
  }

  get texture (): Texture | null {
    return this._texture;
  }

  set texture (value: Texture | null) {
    if (this._texture !== value) {
      this._texture = value;
      this.updateDesiredSize();
      this.ninePatchEventEmitter.emit('textureChanged', value);
    }
  }

  get regionRect (): Rect {
    return {
      position: this._regionRect.position.clone(),
      size: this._regionRect.size.clone(),
    };
  }

  set regionRect (value: Rect) {
    this.setRegionRect(value.position.x, value.position.y, value.size.x, value.size.y);
  }

  override on<E extends keyof NinePatchRectEvent> (
    eventName: E,
    listener: EventEmitterListener<NinePatchRectEvent[E]>,
  ): void {
    if (eventName === 'textureChanged') {
      this.ninePatchEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName, listener as never);
    }
  }

  override off<E extends keyof NinePatchRectEvent> (
    eventName: E,
    listener: EventEmitterListener<NinePatchRectEvent[E]>,
  ): void {
    if (eventName === 'textureChanged') {
      this.ninePatchEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName, listener as never);
    }
  }

  setRegionRect (x: number, y: number, width: number, height: number): void {
    if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) {
      throw new RangeError('NinePatchRect region must be finite and non-negative.');
    }
    this._regionRect.position.set(x, y);
    this._regionRect.size.set(width, height);
    this.updateDesiredSize();
  }

  setPatchMargin (side: Side, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError('NinePatchRect patch margin must be finite and non-negative.');
    }
    if (this.patchMargins[side] !== value) {
      this.patchMargins[side] = value;
      this.updateMinimumSize();
    }
  }

  getPatchMargin (side: Side): number {
    return this.patchMargins[side] ?? 0;
  }

  override getMinimumSize (): math.Vector2 {
    return new math.Vector2(
      this.getPatchMargin(Side.Left) + this.getPatchMargin(Side.Right),
      this.getPatchMargin(Side.Top) + this.getPatchMargin(Side.Bottom),
    );
  }

  override getDesiredSize (): math.Vector2 {
    const source = this.getSourceRect();

    return new math.Vector2(source.size.x, source.size.y);
  }

  override draw (): void {
    const texture = this.texture;

    if (!texture || this.width <= 0 || this.height <= 0) {
      return;
    }

    const source = this.getSourceRect();

    this.drawNinePatch(0, 0, this.width, this.height, texture, {
      sourceX: source.position.x,
      sourceY: source.position.y,
      sourceWidth: source.size.x,
      sourceHeight: source.size.y,
      marginLeft: this.getPatchMargin(Side.Left),
      marginTop: this.getPatchMargin(Side.Top),
      marginRight: this.getPatchMargin(Side.Right),
      marginBottom: this.getPatchMargin(Side.Bottom),
      horizontalMode: this.horizontalAxisStretchMode,
      verticalMode: this.verticalAxisStretchMode,
      drawCenter: this.drawCenter,
    }, this.tint);
  }

  private getSourceRect (): Rect {
    const texture = this.texture;

    if (!texture) {
      return { position: new math.Vector2(), size: new math.Vector2() };
    }
    if (this._regionRect.size.x > 0 && this._regionRect.size.y > 0) {
      return this.regionRect;
    }

    return {
      position: new math.Vector2(),
      size: new math.Vector2(texture.width, texture.height),
    };
  }

  override fromData (data: NinePatchRectData): void {
    super.fromData(data);
    if (data.texture !== undefined) {
      this.texture = data.texture ? this.engine.findObject<Texture>(data.texture) : null;
    }
    if (data.regionRect !== undefined) {
      this.setRegionRect(
        data.regionRect.position[0], data.regionRect.position[1],
        data.regionRect.size[0], data.regionRect.size[1],
      );
    }
    if (data.patchMarginLeft !== undefined) {
      this.setPatchMargin(Side.Left, data.patchMarginLeft);
    }
    if (data.patchMarginTop !== undefined) {
      this.setPatchMargin(Side.Top, data.patchMarginTop);
    }
    if (data.patchMarginRight !== undefined) {
      this.setPatchMargin(Side.Right, data.patchMarginRight);
    }
    if (data.patchMarginBottom !== undefined) {
      this.setPatchMargin(Side.Bottom, data.patchMarginBottom);
    }
    if (data.drawCenter !== undefined) {
      this.drawCenter = data.drawCenter;
    }
    if (data.horizontalAxisStretchMode !== undefined) {
      this.horizontalAxisStretchMode = data.horizontalAxisStretchMode;
    }
    if (data.verticalAxisStretchMode !== undefined) {
      this.verticalAxisStretchMode = data.verticalAxisStretchMode;
    }
    if (data.tint !== undefined) {
      this.tint.copyFrom(data.tint);
    }
  }
}
