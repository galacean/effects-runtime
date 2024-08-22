import { Behaviour } from '../components/component';

export class SceneTicking {
  update: UpdateTickData = new UpdateTickData();
  lateUpdate: LateUpdateTickData = new LateUpdateTickData();

  addBehaviour (obj: Behaviour): void {
    if (obj.onUpdate !== Behaviour.prototype.onUpdate) {
      this.update.addBehaviour(obj);
    }
    if (obj.onLateUpdate !== Behaviour.prototype.onLateUpdate) {
      this.lateUpdate.addBehaviour(obj);
    }
  }

  removeBehaviour (obj: Behaviour): void {
    if (obj.onUpdate !== Behaviour.prototype.onUpdate) {
      this.update.removeBehaviour(obj);
    }
    if (obj.onLateUpdate !== Behaviour.prototype.onLateUpdate) {
      this.lateUpdate.removeBehaviour(obj);
    }
  }

  clear (): void {
    this.update.clear();
    this.lateUpdate.clear();
  }
}

class TickData {
  behaviours: Behaviour[] = [];
  ticks: ((dt: number) => void)[] = [];

  constructor () {
  }

  tick (dt: number) {
    this.tickBehaviours(this.behaviours, dt);

    for (let i = 0;i < this.ticks.length;i++) {
      this.ticks[i](dt);
    }
  }

  tickBehaviours (behaviours: Behaviour[], dt: number): void {
    // To be implemented in derived classes
  }

  addBehaviour (behaviour: Behaviour): void {
    if (!this.behaviours.includes(behaviour)) {
      this.behaviours.push(behaviour);
    }
  }

  removeBehaviour (behaviour: Behaviour): void {
    const index = this.behaviours.indexOf(behaviour);

    if (index > -1) {
      this.behaviours.splice(index, 1);
    }
  }

  addTick (method: (dt: number) => void, callee: object) {
    const tick = method.bind(callee);

    if (!this.ticks.includes(tick)) {
      this.ticks.push(tick);
    }
  }

  clear (): void {
    this.behaviours = [];
  }
}

class UpdateTickData extends TickData {
  override tickBehaviours (behaviours: Behaviour[], dt: number): void {
    for (const behavior of behaviours) {
      if (!behavior.isActiveAndEnabled) {
        continue;
      }
      behavior.onUpdate(dt);
    }
  }
}

class LateUpdateTickData extends TickData {
  override tickBehaviours (behaviours: Behaviour[], dt: number): void {
    for (const behavior of behaviours) {
      if (!behavior.isActiveAndEnabled) {
        continue;
      }
      behavior.onLateUpdate(dt);
    }
  }
}

// function compareBehaviours (a: Behaviour, b: Behaviour): number {
//   const itemA = a.item;
//   const itemB = b.item;

//   if (VFXItem.isAncestor(itemA, itemB)) {
//     return -1;
//   } else {
//     return 1;
//   }
// }