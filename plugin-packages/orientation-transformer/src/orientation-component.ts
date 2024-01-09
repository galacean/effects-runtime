import type { SceneData, Deserializer } from '@galacean/effects-core';
import { ItemBehaviour } from '@galacean/effects-core';
import type { CompositionTransformerTarget } from './composition-transformer-acceler';
import type { CompositionTransformerAcceler } from './composition-transformer-acceler';

export class OrientationComponent extends ItemBehaviour {
  private targets: CompositionTransformerTarget[];

  override fromData (data: any) {
    super.fromData(data);

    const { targets } = data.content.options;

    if (targets) {
      this.targets = targets.map((t: any) => ({
        name: t.name,
        xMin: +t.xMin || 0,
        yMin: +t.yMin || 0,
        xMax: +t.xMax || 0,
        yMax: +t.yMax || 0,
      }));
    }

  }

  override start () {
    const transformer = this.item.composition?.loaderData.deviceTransformer as CompositionTransformerAcceler;

    if (transformer) {
      this.targets?.forEach(target => transformer.addTarget(target));
      transformer.initComposition();
    }
  }

  override update (dt: number) {
    const transformer = this.item.composition?.loaderData.deviceTransformer as CompositionTransformerAcceler;

    if (transformer) {
      transformer.updateOrientation();
    }
  }

  override onDestroy () {
    this.targets?.forEach(target => this.item.composition?.loaderData.deviceTransformer?.removeTarget(target.name));
  }
}
