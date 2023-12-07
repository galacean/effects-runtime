import type { Composition } from '../../composition';
import { AbstractPlugin } from '../index';
import type { VFXItem } from '../../vfx-item';
import type { Mesh, RenderFrame } from '../../render';
import { DestroyOptions, addItem, removeItem } from '../../utils';
import type { TextItem } from './text-item';
import { TextVFXItem } from './text-vfx-item';

export class TextLoader extends AbstractPlugin {
  override name = 'text';
  addItems: TextVFXItem[] = [];
  removeItems: TextVFXItem[] = [];
  public readonly meshes: Mesh[] = [];

  override onCompositionDestroyed (composition: Composition) {
    if (composition.reusable) {
      this.addItems.forEach(vfxitem => {
        vfxitem.content.mesh?.mesh.dispose({ material: { textures: DestroyOptions.keep } });
      });
    } else {
      this.addItems.forEach(vfxitem => {
        vfxitem.content.mesh?.mesh.dispose();
      });
    }
  }

  override onCompositionUpdate (composition: Composition, dt: number): void {
    this.addItems.forEach(item => {
      if (!item.contentVisible) {
        item.content.mesh?.mesh.setVisible(false);

        return;
      } else {
        item.content.mesh?.mesh.setVisible(true);
      }
      item.content.updateTexture();
      if (!item.content.ended && item.content.mesh) {
        item.content.mesh.updateItem(item.content);
        item.content.mesh?.applyChange();
      }
    });
  }

  override onCompositionItemLifeBegin (composition: Composition, item: VFXItem<TextItem>) {
    if (item instanceof TextVFXItem && item.content) {
      if (!this.addItems.includes(item)) {
        addItem(this.addItems, item);
        if (!item.content.ended && item.content.mesh) {
          item.content.mesh.updateItem(item.content);
        }
        item.content.mesh?.applyChange();
      }
    }
  }

  override onCompositionReset (composition: Composition, pipeline: RenderFrame) {
  }

  override onCompositionItemRemoved (composition: Composition, item: VFXItem<TextItem>) {
    // FIXME: 此处判断有问题，item 应该先判断
    if (item instanceof TextVFXItem && item) {
      addItem(this.removeItems, item);
      if (this.addItems.includes(item)) {
        if (item.content?.mesh) {
          removeItem(this.addItems, item);
          item.content.mesh.mesh.dispose({ material: { textures: DestroyOptions.keep } });
          item.dispose();
        }
      }
    }
  }

  override prepareRenderFrame (composition: Composition, renderFrame: RenderFrame): boolean {
    this.removeItems.map(item => {
      if (item.content?.mesh) {
        renderFrame.removeMeshFromDefaultRenderPass(item.content.mesh?.mesh);
        removeItem(this.addItems, item);
        item.content.mesh.mesh.dispose({ material: { textures: DestroyOptions.keep } });
        item.dispose();
      }
    });

    this.addItems.forEach(item => {
      if (item.content.mesh) {
        renderFrame.addMeshToDefaultRenderPass(item.content.mesh?.mesh);
      }
    });
    this.removeItems.length = 0;

    return false;
  }
}
