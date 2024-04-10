import type { spec, Composition } from '@galacean/effects';
import { VFXItem } from '@galacean/effects';
import type { CompositionTransformerAcceler } from './composition-transformer-acceler';
import type { TransformItem } from './transform-item';

export class TransformVFXItem extends VFXItem<TransformItem> {
  private targets?: any[];

  override get type () {
    return 'orientation-transformer' as spec.ItemType;
  }

  override onConstructed (options: any) {
    const { targets } = options.content.options;

    if (targets) {
      this.targets = targets.map((t: any) => ({
        name: t.name,
        xMin: +t.xMin || 0,
        yMin: +t.yMin || 0,
        xMax: +t.xMax || 0,
        yMax: +t.yMax || 0,
        hMin: +t.hMin || 0,
        vMin: +t.vMin || 0,
        hMax: +t.hMax || 0,
        vMax: +t.vMax || 0,
      }));
    }
  }

  override onItemRemoved (composition: Composition) {
    this.targets?.forEach(target => composition.loaderData.deviceTransformer?.removeTarget(target.name));
  }

  protected override doCreateContent (composition: Composition) {
    const transformer = composition.loaderData.deviceTransformer as CompositionTransformerAcceler;

    if (transformer) {
      this.targets?.forEach(target => transformer.addTarget(target));
      transformer.initComposition();
    }

    return {};
  }
}
