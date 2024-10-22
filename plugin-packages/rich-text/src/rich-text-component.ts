import type {
  Texture, Engine,
} from '@galacean/effects';
import { spec, effectsClass, BaseRenderComponent } from '@galacean/effects';

/**
 * 用于创建 videoItem 的数据类型, 经过处理后的 spec.VideoContent
 */
export interface VideoItemProps extends Omit<spec.VideoComponentData, 'renderer'> {
  listIndex?: number,
  renderer: {
    mask: number,
    texture: Texture,
  } & Omit<spec.RendererOptions, 'texture'>,
}

let seed = 0;

@effectsClass(spec.DataType.RichTextComponent)
export class RichTextComponent extends BaseRenderComponent {
  constructor (engine: Engine) {
    super(engine);
    this.name = 'MRichText' + seed++;
  }
}
