import type { spec } from '@galacean/effects';
import { Behaviour, effectsClass } from '@galacean/effects';
import type { CompositionTransformerAcceler } from './composition-transformer-acceler';

@effectsClass('OrientationComponent')
export class OrientationComponent extends Behaviour {
  private targets: spec.PluginGyroscopeTarget[];

  override fromData (data: any) {
    super.fromData(data);

    const { targets } = data.options;

    if (targets) {
      this.targets = targets.map((t: any) => ({
        name: t.name,
        xMin: +t.xMin || 0,
        yMin: +t.yMin || 0,
        xMax: +t.xMax || 0,
        yMax: +t.yMax || 0,
        vMin: +t.vMin || 0,
        hMin: +t.hMin || 0,
        vMax: +t.vMax || 0,
        hMax: +t.hMax || 0,
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
