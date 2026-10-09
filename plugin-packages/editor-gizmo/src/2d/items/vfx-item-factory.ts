/* eslint-disable @typescript-eslint/no-extraneous-class */
import { type Component, type Composition, type Constructor, VFXItem } from '@galacean/effects';

/** 创建 VFXItem、挂载组件并加入合成的底层工厂。 */
export class VFXItemFactory {
  /**
   * 创建并挂载 VFXItem。
   * @param composition 目标合成
   * @param parent 父元素
   * @param name 元素名称
   * @param types 待挂载的组件类型
   * @returns 新建的 VFXItem
   */
  static createVFXItem (
    composition: Composition,
    parent = null,
    name = 'NewVFXItem',
    ...types: Constructor<Component>[]
  ): VFXItem {
    const vfxItem = new VFXItem(composition.engine);

    vfxItem.name = name;
    for (const type of types) {
      vfxItem.addComponent(type);
    }

    composition.addItem(vfxItem);
    // @ts-expect-error rootComposition.items 的类型未公开受支持的写入操作。
    composition.rootComposition.items.push(vfxItem);

    if (parent) {
      vfxItem.setParent(parent);
    }

    return vfxItem;
  }
}
