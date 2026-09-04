import type { Engine } from '@galacean/effects';
import { EventSystem } from '@galacean/effects';

const { expect } = chai;

describe('core/interact/event-system', () => {
  it('supports a mini-program canvas without DOM attribute and style methods', () => {
    const listeners = new Map<string, EventListener[]>();
    const canvas = {
      width: 100,
      height: 100,
      style: {},
      addEventListener (name: string, listener: EventListener) {
        const handlers = listeners.get(name) ?? [];

        handlers.push(listener);
        listeners.set(name, handlers);
      },
      removeEventListener (name: string, listener: EventListener) {
        const handlers = listeners.get(name);

        if (handlers) {
          const index = handlers.indexOf(listener);

          if (index >= 0) {
            handlers.splice(index, 1);
          }
        }
      },
      getBoundingClientRect () {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          width: 100,
          height: 100,
          right: 100,
          bottom: 100,
          toJSON: () => ({}),
        };
      },
    } as unknown as HTMLCanvasElement;
    const eventSystem = new EventSystem({ compositions: [] } as unknown as Engine);

    expect(() => eventSystem.bindListeners(canvas)).not.to.throw();
    expect(listeners.get('touchstart')).to.have.length(1);
    expect(() => eventSystem.dispose()).not.to.throw();
    expect(listeners.get('touchstart')).to.have.length(0);
  });
});
