import type { Engine, VFXItemProps } from '@galacean/effects';
import { VFXItem } from '@galacean/effects';
import { OrientationComponent } from './orientation-component';

/**
 * 水平旋转变化起始角（手机处于改角度时无变化）
 */
export const VERTICAL_INIT_DEGREE = 45;

export class TransformVFXItem extends VFXItem<OrientationComponent> {
  constructor (engine: Engine, props: VFXItemProps) {
    super(engine, props);

    const component = this.addComponent(OrientationComponent);

    component.fromData(props);
  }
}
