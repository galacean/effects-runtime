import { Component } from '../components';

/**
 *
 */
export class SceneTicking {
  update: UpdateTickData = new UpdateTickData();
  lateUpdate: LateUpdateTickData = new LateUpdateTickData();
  preRender: PreRenderTickData = new PreRenderTickData();

  /**
   *
   * @param obj
   */
  addComponent (obj: Component): void {
    if (obj.onUpdate !== Component.prototype.onUpdate) {
      this.update.addComponent(obj);
    }

    if (obj.onLateUpdate !== Component.prototype.onLateUpdate) {
      this.lateUpdate.addComponent(obj);
    }

    if (obj.onPreRender !== Component.prototype.onPreRender) {
      this.preRender.addComponent(obj);
    }
  }

  /**
   *
   * @param obj
   */
  removeComponent (obj: Component): void {
    if (obj.onUpdate !== Component.prototype.onUpdate) {
      this.update.removeComponent(obj);
    }

    if (obj.onLateUpdate !== Component.prototype.onLateUpdate) {
      this.lateUpdate.removeComponent(obj);
    }

    if (obj.onPreRender !== Component.prototype.onPreRender) {
      this.preRender.removeComponent(obj);
    }
  }

  setTicking (enabled: boolean): void {
    this.update.canTick = enabled;
    this.lateUpdate.canTick = enabled;
    this.preRender.canTick = enabled;
  }

  /**
   *
   */
  clear (): void {
    this.update.clear();
    this.lateUpdate.clear();
    this.preRender.clear();
  }
}

class TickData {
  components: Component[] = [];
  ticks: ((dt: number) => void)[] = [];

  canTick = true;

  tick (dt: number) {
    for (let i = 0; i < this.components.length && this.canTick; i++) {
      this.tickComponent(this.components[i], dt);
    }
    for (let i = 0; i < this.ticks.length && this.canTick; i++) {
      this.ticks[i](dt);
    }
  }

  tickComponent (component: Component, dt: number): void {
    // To be implemented in derived classes
  }

  addComponent (component: Component): void {
    if (!this.components.includes(component)) {
      this.components.push(component);
    }
  }

  removeComponent (component: Component): void {
    const index = this.components.indexOf(component);

    if (index > -1) {
      // Flax Array.Remove swaps in the last entry instead of preserving order.
      const last = this.components.pop()!;

      if (index < this.components.length) {
        this.components[index] = last;
      }
    }
  }

  addTick (method: (dt: number) => void, callee: object) {
    const tick = method.bind(callee);

    if (!this.ticks.includes(tick)) {
      this.ticks.push(tick);
    }
  }

  clear (): void {
    this.components.length = 0;
    this.ticks.length = 0;
  }
}

class UpdateTickData extends TickData {
  override tickComponent (component: Component, dt: number): void {
    component.onUpdate(dt);
  }
}

class LateUpdateTickData extends TickData {
  override tickComponent (component: Component, dt: number): void {
    component.onLateUpdate(dt);
  }
}

class PreRenderTickData extends TickData {
  override tickComponent (component: Component, dt: number): void {
    component.onPreRender();
  }
}
