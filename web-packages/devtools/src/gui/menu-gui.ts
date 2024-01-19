import type { VFXItemContent } from '@galacean/effects';
import { EffectComponent, VFXItem, type Composition } from '@galacean/effects';
import { M_DUCK, G_QUAD, G_CUBE } from '@galacean/effects-assets';

export class MenuGui {
  composition: Composition;

  constructor () {}

  setComposition (composition: Composition) {
    this.composition = composition;
  }

  async createEffectItem (parent?: VFXItem<VFXItemContent>) {
    const composition = this.composition;
    const engine = composition.getEngine();
    const effectItem = new VFXItem(engine);

    effectItem.duration = 1000;
    //@ts-expect-error
    effectItem.type = 'ECS';
    const effectComponent = effectItem.addComponent(EffectComponent);

    const trailMaterialData = M_DUCK.exportObjects[0];
    const quadGeometryData = G_CUBE.exportObjects[0];

    effectComponent.geometry = await engine.deserializer.loadGUIDAsync(quadGeometryData.id);
    effectComponent.material = await engine.deserializer.loadGUIDAsync('f23adccff3694fd98a0b905c9698188a');
    composition.addItem(effectItem);
    if (parent) {
      effectItem.setParent(parent);
    }

    return effectItem;
  }
}
