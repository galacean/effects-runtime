import * as spec from '@galacean/effects-specification';
import type { Disposable } from '../../utils';
import { addItem, removeItem, isSimulatorCellPhone } from '../../utils';

export const EVENT_TYPE_CLICK = 'click';
export const EVENT_TYPE_TOUCH_START = 'touchstart';
export const EVENT_TYPE_TOUCH_MOVE = 'touchmove';
export const EVENT_TYPE_TOUCH_END = 'touchend';

export const InteractBehavior = spec.InteractBehavior;
export type TouchEventType = {
  x: number,
  y: number,
  vx: number,
  vy: number,
  ts: number,
  dx: number,
  dy: number,
  width: number,
  height: number,
  origin: Event,
};
export type TouchParams = {
  clientX: number,
  clientY: number,
  target: EventTarget,
};

export class EventSystem implements Disposable {
  enabled = true;

  private handlers: Record<string, ((event: TouchEventType) => void)[]> = {};
  private nativeHandlers: Record<string, (event: Event) => void> = {};

  constructor (
    private target: HTMLCanvasElement | null,
    public allowPropagation = false) {
  }

  bindListeners () {
    let x: number;
    let y: number;
    let currentTouch: Record<string, number> | 0;
    let lastTouch: Record<string, number> | 0;
    let getTouch: (event: Event) => TouchParams;

    getTouch = event => {
      return event as MouseEvent as TouchParams;
    };
    let touchstart = 'mousedown';
    let touchmove = 'mousemove';
    let touchend = 'mouseup';
    const getTouchEventValue = (event: Event, x: number, y: number, dx = 0, dy = 0): TouchEventType => {
      const { width, height } = this.target!;
      const ts = performance.now();
      let vx = 0;
      let vy = 0;

      if (lastTouch) {
        const dt = ts - lastTouch.ts;

        vx = ((dx - lastTouch.dx) / dt) || 0;
        vy = ((dy - lastTouch.dy) / dt) || 0;
        lastTouch = { dx, dy, ts };
      }

      return { x, y, vx, vy, dx, dy, ts, width, height, origin: event };
    };

    if (isSimulatorCellPhone()) {
      getTouch = event => {
        const { touches, changedTouches } = event as TouchEvent;

        return touches[0] || changedTouches[0];
      };
      touchstart = 'touchstart';
      touchmove = 'touchmove';
      touchend = 'touchend';
    }
    this.nativeHandlers = {
      [touchstart]: event => {
        if (this.enabled) {
          const touch = getTouch(event);
          const cood = getCoord(touch);

          x = cood.x;
          y = cood.y;
          lastTouch = currentTouch = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            ts: performance.now(),
            x,
            y,
          };
          this.dispatchEvent(EVENT_TYPE_TOUCH_START, getTouchEventValue(event, x, y));
        }
      },
      [touchmove]: event => {
        if (currentTouch && this.enabled) {
          const cood = getCoord(getTouch(event));

          x = cood.x;
          y = cood.y;
          this.dispatchEvent(EVENT_TYPE_TOUCH_MOVE, getTouchEventValue(event, x, y, x - currentTouch.x, y - currentTouch.y));
        }
      },
      [touchend]: event => {
        if (currentTouch && this.enabled) {
          if (!this.allowPropagation && event.cancelable) {
            event.preventDefault();
            event.stopPropagation();
          }
          const touch = getTouch(event);
          const cood = getCoord(touch);
          const dt = Math.abs(currentTouch.clientX - touch.clientX) + Math.abs(currentTouch.clientY - touch.clientY);

          x = cood.x;
          y = cood.y;
          if (dt < 4) {
            this.dispatchEvent(EVENT_TYPE_CLICK, getTouchEventValue(event, x, y));
          }
          this.dispatchEvent(EVENT_TYPE_TOUCH_END, getTouchEventValue(event, x, y, x - currentTouch.x, y - currentTouch.y));
        }
        currentTouch = 0;
      },
    };

    Object.keys(this.nativeHandlers).forEach(name => {
      this.target?.addEventListener(String(name), this.nativeHandlers[name]);
    });
  }

  dispatchEvent (type: string, event: TouchEventType) {
    const handlers = this.handlers[type];

    handlers?.forEach(fn => fn(event));
  }

  addEventListener (type: string, callback: (event: TouchEventType) => void): () => void {
    let handlers = this.handlers[type];

    if (!handlers) {
      handlers = this.handlers[type] = [];
    }
    addItem(handlers, callback);

    return () => {
      removeItem(handlers, callback);
    };
  }

  removeEventListener (type: string, callback: (event: TouchEventType) => void) {
    const handlers = this.handlers[type];

    if (handlers) {
      removeItem(handlers, callback);
    }
  }

  dispose (): void {
    if (this.target) {
      this.handlers = {};

      Object.keys(this.nativeHandlers).forEach(name => {
        this.target?.removeEventListener(String(name), this.nativeHandlers[name]);
      });
      this.nativeHandlers = {};
      this.target = null;
    }
  }
}

function getCoord (event: TouchParams) {
  const ele = event.target as HTMLElement;
  const { clientX, clientY } = event;
  const { left, top, width, height } = ele.getBoundingClientRect();
  const x = ((clientX - left) / width) * 2 - 1;
  const y = 1 - ((clientY - top) / height) * 2;

  return { x, y };
}
