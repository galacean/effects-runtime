import type { VFXItemContent } from '@galacean/effects';
import { EffectComponent, VFXItem, type Composition } from '@galacean/effects';

export class MenuGui {
  composition: Composition;

  constructor () { }

  setComposition (composition: Composition) {
    this.composition = composition;
  }

  async createEffectItem (name: string, geometryGuid: string, parent?: VFXItem<VFXItemContent>,) {
    const composition = this.composition;
    const engine = composition.getEngine();
    const effectItem = new VFXItem(engine);

    effectItem.name = name;
    effectItem.duration = 1000;
    //@ts-expect-error
    effectItem.type = 'ECS';
    const effectComponent = effectItem.addComponent(EffectComponent);

    effectComponent.geometry = await engine.assetLoader.loadGUIDAsync(geometryGuid);
    effectComponent.material = await engine.assetLoader.loadGUIDAsync('f23adccff3694fd98a0b905c9698188a');
    composition.addItem(effectItem);
    if (parent) {
      effectItem.setParent(parent);
    }

    return effectItem;
  }
}
