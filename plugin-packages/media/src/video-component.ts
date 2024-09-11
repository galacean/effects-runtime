import type { Texture, Engine, SpriteItemProps } from '@galacean/effects-core';
import { spec, math, BaseRenderComponent, effectsClass, glContext } from '@galacean/effects-core';
/**
 * 用于创建 textItem 的数据类型, 经过处理后的 spec.TextContentOptions
 */
export interface TextItemProps extends Omit<spec.TextContent, 'renderer'> {
  listIndex?: number,
  renderer: {
    mask: number,
    texture: Texture,
  } & Omit<spec.RendererOptions, 'texture'>,
}

let seed = 0;

@effectsClass(spec.DataType.VideoComponent)
export class VideoComponent extends BaseRenderComponent {

  constructor (engine: Engine) {
    super(engine);
    this.name = 'MVideo' + seed++;
    this.geometry = this.createGeometry(glContext.TRIANGLES);
    this.setItem();
  }

  override fromData (data: SpriteItemProps): void {
    super.fromData(data);

    const { interaction, options, listIndex = 0 } = data;
    let renderer = data.renderer;

    if (!renderer) {
      //@ts-expect-error
      renderer = {};
    }

    this.interaction = interaction;

    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.BILLBOARD,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ?? this.engine.emptyTexture,
      occlusion: !!(renderer.occlusion),
      transparentOcclusion: !!(renderer.transparentOcclusion) || (renderer.maskMode === spec.MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      mask: renderer.mask ?? 0,
      maskMode: renderer.maskMode ?? spec.MaskMode.NONE,
      order: listIndex,
    };

    this.interaction = interaction;

    this.setItem();
    const startColor = options.startColor || [1, 1, 1, 1];

    this.material.setVector4('_Color', new math.Vector4().setFromArray(startColor));
  }
}
