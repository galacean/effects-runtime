import { Component } from '../components';

export class SceneTicking {
  update: UpdateTickData = new UpdateTickData();
  lateUpdate: LateUpdateTickData = new LateUpdateTickData();

  addComponent (obj: Component): void {
    if (obj.onUpdate !== Component.prototype.onUpdate) {
      this.update.addComponent(obj);
    }
    if (obj.onLateUpdate !== Component.prototype.onLateUpdate) {
      this.lateUpdate.addComponent(obj);
    }
  }

  removeComponent (obj: Component): void {
    if (obj.onUpdate !== Component.prototype.onUpdate) {
      this.update.removeComponent(obj);
    }
    if (obj.onLateUpdate !== Component.prototype.onLateUpdate) {
      this.lateUpdate.removeComponent(obj);
    }
  }

  clear (): void {
    this.update.clear();
    this.lateUpdate.clear();
  }
}

class TickData {
  components: Component[] = [];
  ticks: ((dt: number) => void)[] = [];

  constructor () {
  }

  tick (dt: number) {
    this.tickComponents(this.components, dt);

    for (let i = 0;i < this.ticks.length;i++) {
      this.ticks[i](dt);
    }
  }

  tickComponents (components: Component[], dt: number): void {
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
      this.components.splice(index, 1);
    }
  }

  addTick (method: (dt: number) => void, callee: object) {
    const tick = method.bind(callee);

    if (!this.ticks.includes(tick)) {
      this.ticks.push(tick);
    }
  }

  clear (): void {
    this.components = [];
  }
}

class UpdateTickData extends TickData {
  override tickComponents (components: Component[], dt: number): void {
    for (const component of components) {
      component.onUpdate(dt);
    }
  }
}

class LateUpdateTickData extends TickData {
  override tickComponents (components: Component[], dt: number): void {
    for (const component of components) {
      component.onLateUpdate(dt);
    }
  }
}

// function compareComponents (a: Component, b: Component): number {
//   const itemA = a.item;
//   const itemB = b.item;

//   if (VFXItem.isAncestor(itemA, itemB)) {
//     return -1;
//   } else {
//     return 1;
//   }
// }
