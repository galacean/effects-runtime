import { VFXItem } from '@galacean/effects';
import type { Engine, VFXItemProps } from '@galacean/effects';
import type { SlotGroup } from './slot-group';
import { SpineComponent } from './spine-component';

export type SpineContent = SlotGroup | undefined;

export class SpineVFXItem extends VFXItem<SpineContent> {
  constructor (engine: Engine, props: VFXItemProps) {
    super(engine, props);
    const component = this.addComponent(SpineComponent);

    component.fromData(props);
  }
}

