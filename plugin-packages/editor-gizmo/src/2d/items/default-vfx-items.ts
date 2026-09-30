/* eslint-disable @typescript-eslint/no-extraneous-class */
import {
  AssetManager,
  type Composition,
  PrecompositionManager,
  SpriteComponent,
  spec,
  TextComponent,
  type VFXItem,
  CompositionComponent,
} from '@galacean/effects';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';
import { VFXItemFactory } from './vfx-item-factory';

/** 创建内置类型 VFXItem 的便捷工厂。 */
export class DefaultVFXItems {
  /**
   * 创建空元素。
   * @param composition 目标合成
   * @param parent 父元素
   * @param name 元素名称
   * @returns 新建的空元素
   */
  static createEmpty (composition: Composition, parent = null, name = 'NewVFXItem'): VFXItem {
    const vfxItem = VFXItemFactory.createVFXItem(composition, parent, name);

    vfxItem.type = spec.ItemType.null;

    return vfxItem;
  }

  /**
   * 创建图片元素。
   * @param composition 目标合成
   * @param parent 父元素
   * @param name 元素名称
   * @returns 新建的图片元素
   */
  static createSprite (composition: Composition, parent = null, name = 'NewSprite'): VFXItem {
    const vfxItem = VFXItemFactory.createVFXItem(composition, parent, name, SpriteComponent);

    vfxItem.type = spec.ItemType.sprite;

    return vfxItem;
  }

  /**
   * 创建文本元素。
   * @param composition 目标合成
   * @param parent 父元素
   * @param name 元素名称
   * @returns 新建的文本元素
   */
  static createText (composition: Composition, parent = null, name = 'NewText'): VFXItem {
    const vfxItem = VFXItemFactory.createVFXItem(composition, parent, name, TextComponent);

    vfxItem.type = spec.ItemType.text;

    return vfxItem;
  }

  /**
   * 创建视频元素。
   * @param composition 目标合成
   * @param parent 父元素
   * @param name 元素名称
   * @returns 新建的视频元素
   */
  static createVideo (composition: Composition, parent = null, name = 'NewVideo'): VFXItem {
    const vfxItem = VFXItemFactory.createVFXItem(composition, parent, name, VideoComponent);

    vfxItem.type = spec.ItemType.video;

    return vfxItem;
  }

  /**
   * 加载并创建特效合成元素。
   * @param composition 目标合成
   * @param effects 特效地址或场景数据
   * @param parent 父元素
   * @param urlname 元素名称
   * @returns 新建的特效元素
   */
  static async createEffects (
    composition: Composition,
    effects: string | spec.JSONScene,
    parent = null,
    urlname = 'NewEffects',
  ): Promise<VFXItem> {
    const preComposition = await AssetManager.loadPrecomposition(effects, { autoplay: false });
    const vfxItem = PrecompositionManager.instantiate(preComposition, composition);

    vfxItem.name = urlname;
    vfxItem.type = spec.ItemType.composition;

    vfxItem.getComponent(CompositionComponent).endBehavior = vfxItem.endBehavior;

    if (parent) {
      vfxItem.setParent(parent);
    }

    return vfxItem;
  }
}
