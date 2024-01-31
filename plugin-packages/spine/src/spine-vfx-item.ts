import { VFXItem } from '@galacean/effects';
import type { Engine, VFXItemProps } from '@galacean/effects';
import type { SlotGroup } from './slot-group';
import { SpineComponent } from './spine-component';

export type SpineContent = SlotGroup | undefined;

// TODO: [1.31] @十弦 https://github.com/galacean/effects-runtime/commits/main/plugin-packages/spine/src/spine-vfx-item.ts
export class SpineVFXItem extends VFXItem<SpineContent> {
  constructor (engine: Engine, props: VFXItemProps) {
    super(engine, props);
    const component = this.addComponent(SpineComponent);

    component.fromData(props);
  }
}

