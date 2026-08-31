import {
  effectsClass,
  math,
} from '@galacean/effects';
import type { Engine, Texture, TextureRegion, spec } from '@galacean/effects';
import { Control } from '../core/control';
import { MouseFilter } from '../core/enums';
import { TextureExpandMode, TextureStretchMode } from './enums';

const FULL_REGION: TextureRegion = { u0: 0, v0: 0, u1: 1, v1: 1 };

@effectsClass('TextureRect')
export class TextureRect extends Control {
  static override readonly themeType: string = 'TextureRect';
  private _texture: Texture | null = null;
  private _expandMode = TextureExpandMode.KeepSize;
  private _stretchMode = TextureStretchMode.Scale;

  flipH = false;
  flipV = false;
  tint = new math.Color(1, 1, 1, 1);

  constructor (engine: Engine, texture: Texture | null = null) {
    super(engine);
    this._texture = texture;
    this.mouseFilter = MouseFilter.Ignore;
    this.on('sizeChanged', () => this.controlSizeChanged());
  }

  get texture (): Texture | null {
    return this._texture;
  }

  set texture (value: Texture | null) {
    if (this._texture !== value) {
      this._texture = value;
      this.updateMinimumSize();
      this.updateDesiredSize();
    }
  }

  get expandMode (): TextureExpandMode {
    return this._expandMode;
  }

  set expandMode (value: TextureExpandMode) {
    if (this._expandMode !== value) {
      this._expandMode = value;
      this.updateMinimumSize();
    }
  }

  get stretchMode (): TextureStretchMode {
    return this._stretchMode;
  }

  set stretchMode (value: TextureStretchMode) {
    this._stretchMode = value;
  }

  override getMinimumSize (): math.Vector2 {
    const width = this.texture?.width ?? 0;
    const height = this.texture?.height ?? 0;

    switch (this.expandMode) {
      case TextureExpandMode.KeepSize:
        return new math.Vector2(width, height);
      case TextureExpandMode.IgnoreSize:
        return new math.Vector2();
      case TextureExpandMode.FitWidth:
        return new math.Vector2(height, 0);
      case TextureExpandMode.FitWidthProportional:
        return new math.Vector2(height > 0 ? this.height * width / height : 0, 0);
      case TextureExpandMode.FitHeight:
        return new math.Vector2(0, width);
      case TextureExpandMode.FitHeightProportional:
        return new math.Vector2(0, width > 0 ? this.width * height / width : 0);
      default:
        return new math.Vector2();
    }
  }

  override getDesiredSize (): math.Vector2 {
    return new math.Vector2(this.texture?.width ?? 0, this.texture?.height ?? 0);
  }

  override draw (): void {
    const texture = this.texture;

    if (!texture || texture.width <= 0 || texture.height <= 0 || this.width <= 0 || this.height <= 0) {
      return;
    }

    switch (this.stretchMode) {
      case TextureStretchMode.Scale:
        this.drawRegion(0, 0, this.width, this.height, FULL_REGION);

        break;
      case TextureStretchMode.Tile:
        this.drawTiled(texture.width, texture.height);

        break;
      case TextureStretchMode.Keep:
        this.drawRegion(0, 0, texture.width, texture.height, FULL_REGION);

        break;
      case TextureStretchMode.KeepCentered:
        this.drawRegion(
          (this.width - texture.width) * 0.5, (this.height - texture.height) * 0.5,
          texture.width, texture.height, FULL_REGION,
        );

        break;
      case TextureStretchMode.KeepAspect:
        this.drawAspect(false);

        break;
      case TextureStretchMode.KeepAspectCentered:
        this.drawAspect(true);

        break;
      case TextureStretchMode.KeepAspectCovered:
        this.drawCovered();

        break;
    }
  }

  private drawAspect (centered: boolean): void {
    const texture = this.texture;

    if (!texture) {
      return;
    }
    const scale = Math.min(this.width / texture.width, this.height / texture.height);
    const width = texture.width * scale;
    const height = texture.height * scale;
    const x = centered ? (this.width - width) * 0.5 : 0;
    const y = centered ? (this.height - height) * 0.5 : 0;

    this.drawRegion(x, y, width, height, FULL_REGION);
  }

  private drawCovered (): void {
    const texture = this.texture;

    if (!texture) {
      return;
    }
    const sourceRatio = texture.width / texture.height;
    const destinationRatio = this.width / this.height;
    let region = FULL_REGION;

    if (sourceRatio > destinationRatio) {
      const visible = destinationRatio / sourceRatio;
      const margin = (1 - visible) * 0.5;

      region = { u0: margin, v0: 0, u1: 1 - margin, v1: 1 };
    } else if (sourceRatio < destinationRatio) {
      const visible = sourceRatio / destinationRatio;
      const margin = (1 - visible) * 0.5;

      region = { u0: 0, v0: margin, u1: 1, v1: 1 - margin };
    }
    this.drawRegion(0, 0, this.width, this.height, region);
  }

  private drawTiled (tileWidth: number, tileHeight: number): void {
    for (let y = 0; y < this.height; y += tileHeight) {
      const height = Math.min(tileHeight, this.height - y);
      const verticalRatio = height / tileHeight;

      for (let x = 0; x < this.width; x += tileWidth) {
        const width = Math.min(tileWidth, this.width - x);
        const horizontalRatio = width / tileWidth;

        this.drawRegion(x, y, width, height, {
          u0: 0,
          v0: 1 - verticalRatio,
          u1: horizontalRatio,
          v1: 1,
        });
      }
    }
  }

  private drawRegion (x: number, y: number, width: number, height: number, region: TextureRegion): void {
    const texture = this.texture;

    if (!texture || width <= 0 || height <= 0) {
      return;
    }
    this.drawTexture(x, y, width, height, texture, {
      u0: this.flipH ? region.u1 : region.u0,
      v0: this.flipV ? region.v1 : region.v0,
      u1: this.flipH ? region.u0 : region.u1,
      v1: this.flipV ? region.v0 : region.v1,
    }, this.tint);
  }

  private controlSizeChanged (): void {
    if (this.expandMode === TextureExpandMode.FitWidthProportional
      || this.expandMode === TextureExpandMode.FitHeightProportional) {
      this.updateMinimumSize();
    }
  }

  override fromData (data: spec.TextureRectData): void {
    super.fromData(data);
    if (data.texture !== undefined) {
      this.texture = data.texture ? this.engine.findObject<Texture>(data.texture) : null;
    }
    if (data.expandMode !== undefined) {
      this.expandMode = data.expandMode;
    }
    if (data.stretchMode !== undefined) {
      this.stretchMode = data.stretchMode;
    }
    if (data.flipH !== undefined) {
      this.flipH = data.flipH;
    }
    if (data.flipV !== undefined) {
      this.flipV = data.flipV;
    }
    if (data.tint !== undefined) {
      this.tint.copyFrom(data.tint);
    }
  }
}
