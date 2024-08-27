/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import type { Engine, SpriteItemProps } from '@galacean/effects-core';
import { effectsClass, spec, applyMixins, canvasPool, TextComponentBase } from '@galacean/effects-core';
import { ThreeSpriteComponent } from './three-sprite-component';

export interface ThreeTextComponent extends TextComponentBase { }

/**
 * @since 2.0.0
 * @internal
 */
@effectsClass(spec.DataType.TextComponent)
export class ThreeTextComponent extends ThreeSpriteComponent {
  isDirty = true;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;

  constructor (engine: Engine, props?: spec.TextContent) {
    super(engine, props as unknown as SpriteItemProps);

    this.canvas = canvasPool.getCanvas();
    canvasPool.saveCanvas(this.canvas);
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });

    if (!props) {
      return;
    }

    const { options } = props;

    this.updateWithOptions(options);
    this.updateTexture(false);
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);
    this.updateTexture(false);
  }

  override fromData (data: SpriteItemProps): void {
    super.fromData(data);
    const options = data.options as spec.TextContentOptions;

    this.updateWithOptions(options);
    // Text
    this.updateTexture(false);
  }

  updateWithOptions (options: spec.TextContentOptions) {
    // OVERRIDE by mixins
  }

  updateTexture (flipY = true) {
    // OVERRIDE by mixins
  }
}

applyMixins(ThreeTextComponent, [TextComponentBase]);
