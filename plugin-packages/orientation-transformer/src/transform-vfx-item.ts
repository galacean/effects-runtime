import type { Engine, VFXItemProps } from '@galacean/effects';
import { VFXItem } from '@galacean/effects';
import { OrientationComponent } from './orientation-component';

export class TransformVFXItem extends VFXItem<OrientationComponent> {
  constructor (engine: Engine, props: VFXItemProps) {
    super(engine, props);

    const component = this.addComponent(OrientationComponent);

    component.fromData(props);
  }
}
