import type { Composition } from '../../composition';
import type { Engine } from '../../engine';
import type { Disposable } from '../../utils';
import { addItem, isSimulatorCellPhone, logger, removeItem } from '../../utils';
import { PointerEventData, type Region } from './click-handler';

export const EVENT_TYPE_CLICK = 'click';
export const EVENT_TYPE_TOUCH_START = 'touchstart';
export const EVENT_TYPE_TOUCH_MOVE = 'touchmove';
export const EVENT_TYPE_TOUCH_END = 'touchend';

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

export enum PointerEventType {
  PointerDown,
  PointerUp,
  PointerMove
}

export class EventSystem implements Disposable {
  enabled = true;
  skipPointerMovePicking = true;

  private handlers: Record<string, ((event: TouchEventType) => void)[]> = {};
  private nativeHandlers: Record<string, (event: Event) => void> = {};
  private target: HTMLCanvasElement | null = null;

  constructor (
    public engine: Engine,
    public allowPropagation = false,
  ) { }

  bindListeners (target: HTMLCanvasElement | null) {
    this.target = target;
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
    let touchcancel = 'mouseleave';

    const getTouchEventValue = (event: Event, x: number, y: number, dx = 0, dy = 0): TouchEventType => {
      let vx = 0;
      let vy = 0;
      const ts = performance.now();

      if (!this.target) {
        logger.warn('Trigger TouchEvent after EventSystem is disposed.');

        return {
          x, y, vx: 0, vy, dx, dy, ts, width: 0, height: 0, origin: event,
        };
      }
      const { width, height } = this.target;

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
      touchcancel = 'touchcancel';
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
    this.nativeHandlers[touchcancel] = this.nativeHandlers[touchend];

    Object.keys(this.nativeHandlers).forEach(name => {
      this.target?.addEventListener(String(name), this.nativeHandlers[name]);
    });

    this.addEventListener(EVENT_TYPE_CLICK, this.onClick.bind(this));
    this.addEventListener(EVENT_TYPE_TOUCH_START, this.onPointerDown.bind(this));
    this.addEventListener(EVENT_TYPE_TOUCH_END, this.onPointerUp.bind(this));
    this.addEventListener(EVENT_TYPE_TOUCH_MOVE, this.onPointerMove.bind(this));
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

  private onClick (e: TouchEventType) {
    const { x, y } = e;
    const hitResults: Region[] = [];

    // 收集所有的点击测试结果，click 回调执行可能会对 composition 点击结果有影响，放在点击测试执行完后再统一触发。
    for (const composition of this.engine.compositions) {
      hitResults.push(...composition.hitTest(x, y));
    }

    for (const hitResult of hitResults) {
      const hitComposition = hitResult.item.composition;

      if (!hitComposition) {
        continue;
      }

      const clickInfo = {
        ...hitResult,
        compositionId: hitComposition.id,
        compositionName: hitComposition.name,
      };

      hitResult.item.emit('click', hitResult);
      hitComposition.emit('click', clickInfo);
      this.engine.emit('click', clickInfo);
    }
  }

  private onPointerDown (e: TouchEventType) {
    this.handlePointerEvent(e, PointerEventType.PointerDown);
  }

  private onPointerUp (e: TouchEventType) {
    this.handlePointerEvent(e, PointerEventType.PointerUp);
  }

  private onPointerMove (e: TouchEventType) {
    this.handlePointerEvent(e, PointerEventType.PointerMove);
  }

  private handlePointerEvent (e: TouchEventType, type: PointerEventType) {
    let hitRegion: Region | null = null;
    const { x, y, width, height } = e;

    if (!(type === PointerEventType.PointerMove && this.skipPointerMovePicking)) {
      for (const composition of this.engine.compositions) {
        const regions = composition.hitTest(x, y);

        if (regions.length > 0) {
          hitRegion = regions[regions.length - 1];
        }
      }
    }

    const eventData = new PointerEventData();

    eventData.position.x = (x + 1) / 2 * width;
    eventData.position.y = (y + 1) / 2 * height;
    eventData.delta.x = e.vx * width;
    eventData.delta.y = e.vy * height;

    const raycast = eventData.pointerCurrentRaycast;

    if (hitRegion) {
      raycast.point = hitRegion.position;
      raycast.item = hitRegion.item;
    }

    let eventName: 'pointerdown' | 'pointerup' | 'pointermove' = 'pointerdown';

    switch (type) {
      case PointerEventType.PointerDown:
        eventName = 'pointerdown';

        break;
      case PointerEventType.PointerUp:
        eventName = 'pointerup';

        break;
      case PointerEventType.PointerMove:
        eventName = 'pointermove';

        break;
    }

    if (hitRegion) {
      const hitItem = hitRegion.item;
      const hitComposition = hitItem.composition as Composition;

      hitItem.emit(eventName, eventData);
      hitComposition.emit(eventName, eventData);
      this.engine.emit(eventName, eventData);
    }
  }

  dispose (): void {
    if (this.target) {
      this.handlers = {};

      Object.keys(this.nativeHandlers).forEach(name => {
        this.target?.removeEventListener(String(name), this.nativeHandlers[name]);
      });
      this.nativeHandlers = {};
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
