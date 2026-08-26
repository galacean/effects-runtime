import {
  Control,
  EventEmitter,
  MouseFilter,
  effectsClass,
  math,
} from '@galacean/effects';
import type {
  ControlEvent,
  Engine,
  EventEmitterListener,
  Rect,
  Texture,
  TextureRegion,
} from '@galacean/effects';
import { AxisStretchMode, Side } from './enums';
import type { NinePatchRectData } from '../data';

export type NinePatchRectEvent = ControlEvent & {
  textureChanged: [texture: Texture | null],
};

type AxisSegment = {
  destination: number,
  source: number,
};

@effectsClass('NinePatchRect')
export class NinePatchRect extends Control {
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
    const sourceX = splitAxis(source.position.x, source.size.x,
      this.getPatchMargin(Side.Left), this.getPatchMargin(Side.Right));
    const sourceY = splitAxis(source.position.y, source.size.y,
      this.getPatchMargin(Side.Top), this.getPatchMargin(Side.Bottom));
    const destinationX = splitAxis(0, this.width,
      this.getPatchMargin(Side.Left), this.getPatchMargin(Side.Right));
    const destinationY = splitAxis(0, this.height,
      this.getPatchMargin(Side.Top), this.getPatchMargin(Side.Bottom));

    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        if (!this.drawCenter && row === 1 && column === 1) {
          continue;
        }
        const horizontalMode = column === 1 ? this.horizontalAxisStretchMode : AxisStretchMode.Stretch;
        const verticalMode = row === 1 ? this.verticalAxisStretchMode : AxisStretchMode.Stretch;

        this.drawPatch(destinationX[column], destinationY[row], sourceX[column], sourceY[row],
          horizontalMode, verticalMode);
      }
    }
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

  private drawPatch (
    destinationX: AxisSegment,
    destinationY: AxisSegment,
    sourceX: AxisSegment,
    sourceY: AxisSegment,
    horizontalMode: AxisStretchMode,
    verticalMode: AxisStretchMode,
  ): void {
    if (destinationX.destination <= 0 || destinationY.destination <= 0
      || sourceX.destination <= 0 || sourceY.destination <= 0) {
      return;
    }

    const columns = getTiles(destinationX.destination, sourceX.destination, horizontalMode);
    const rows = getTiles(destinationY.destination, sourceY.destination, verticalMode);
    let y = destinationY.source;

    for (const row of rows) {
      let x = destinationX.source;

      for (const column of columns) {
        this.drawPatchTile(
          x, y, column.destination, row.destination,
          sourceX.source, sourceY.source, sourceX.destination, sourceY.destination,
          column.sourceRatio, row.sourceRatio,
        );
        x += column.destination;
      }
      y += row.destination;
    }
  }

  private drawPatchTile (
    x: number,
    y: number,
    width: number,
    height: number,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    horizontalRatio: number,
    verticalRatio: number,
  ): void {
    const texture = this.texture;

    if (!texture) {
      return;
    }
    const region: TextureRegion = {
      u0: sourceX / texture.width,
      u1: (sourceX + sourceWidth * horizontalRatio) / texture.width,
      v0: 1 - (sourceY + sourceHeight * verticalRatio) / texture.height,
      v1: 1 - sourceY / texture.height,
    };

    this.drawTexture(x, y, width, height, texture, region, this.tint);
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

function splitAxis (start: number, size: number, firstMargin: number, lastMargin: number): AxisSegment[] {
  const totalMargin = firstMargin + lastMargin;
  const scale = totalMargin > size && totalMargin > 0 ? size / totalMargin : 1;
  const first = firstMargin * scale;
  const last = lastMargin * scale;
  const middle = Math.max(0, size - first - last);

  return [
    { destination: first, source: start },
    { destination: middle, source: start + first },
    { destination: last, source: start + size - last },
  ];
}

function getTiles (destination: number, source: number, mode: AxisStretchMode): Array<{
  destination: number,
  sourceRatio: number,
}> {
  if (mode === AxisStretchMode.Stretch || source <= 0) {
    return [{ destination, sourceRatio: 1 }];
  }

  const count = Math.max(1, Math.ceil(destination / source));

  if (mode === AxisStretchMode.TileFit) {
    const size = destination / count;

    return Array.from({ length: count }, () => ({ destination: size, sourceRatio: 1 }));
  }

  const tiles = [];
  let remaining = destination;

  while (remaining > 0) {
    const size = Math.min(source, remaining);

    tiles.push({ destination: size, sourceRatio: size / source });
    remaining -= size;
  }

  return tiles;
}
