import type {
  Texture, Engine } from '@galacean/effects';
import {
  TextLayout,
  TextStyle,
} from '@galacean/effects';
import { spec, effectsClass, BaseRenderComponent, glContext, canvasPool } from '@galacean/effects';
import { generateProgram } from './rich-text-parser';

/**
 * 用于创建 textItem 的数据类型, 经过处理后的 spec.TextContentOptions
 */

export interface RichTextItemProps extends Omit<RichtextOptions, 'renderer'> {
  interaction?: {
    /**
     * 交互行为
     */
    behavior: spec.InteractBehavior,
  },
  options: RichtextOptions,
  listIndex?: number,
  renderer: {
    mask: number,
    texture: Texture,
  } & Omit<spec.RendererOptions, 'texture'>,
}

export interface RichtextOptions {
  text: string,
  fontSize: number,
  fontFamily: string,
  textAlign: spec.TextAlignment,
  fontWeight: spec.TextWeight,
  fontStyle: spec.FontStyle,
  textWidth: number,
  textHeight: number,
  textColor: spec.vec4,
}

let seed = 0;

@effectsClass('RichTextComponent')
export class RichTextComponent extends BaseRenderComponent {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  textStyle: TextStyle;
  textLayout: TextLayout;
  processedTexts: Array<{ text: string, options: RichtextOptions }> = [];
  constructor (engine: Engine) {
    super(engine);
    this.name = 'MRichText' + seed++;
    this.geometry = this.createGeometry(glContext.TRIANGLES);
    this.canvas = canvasPool.getCanvas();
    canvasPool.saveCanvas(this.canvas);
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  override fromData (data: RichTextItemProps): void {
    super.fromData(data);
    const { interaction, options, listIndex = 0 } = data;
    let renderer = data.renderer;

    if (!renderer) {
      renderer = {} as any;
    }

    this.interaction = interaction;
    this.updateWithOptions(options);

    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.BILLBOARD,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ?? this.engine.emptyTexture,
      occlusion: !!renderer.occlusion,
      transparentOcclusion: !!renderer.transparentOcclusion || (renderer.maskMode === spec.MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      mask: renderer.mask ?? 0,
      maskMode: renderer.maskMode ?? spec.MaskMode.NONE,
      order: listIndex,
    };

    const processedTextAndContext: Array<{ text: string, context: Record<string, string | undefined> }> = [];

    const program = generateProgram((text, context) => {
      processedTextAndContext.push({ text, context });
    });

    program(options.text);

    // console.log(processedTextAndContext);

    // console.log(data);
  }

  updateWithOptions (options: spec.TextContentOptions) {
    this.textStyle = new TextStyle(options);
    this.textLayout = new TextLayout(options);
  }

}
