import type { Engine } from '../../engine';
import { EventEmitter } from '../../event-emitter';

export enum EventType {
  CLICK = 'click',
  TOUCH_START = 'touchstart',
  TOUCH_MOVE = 'touchmove',
  TOUCH_END = 'touchend',
}

interface SystemEventMap {
  [EventType.CLICK]: (event: Event) => void,
  [EventType.TOUCH_START]: (event: Event) => void,
  [EventType.TOUCH_MOVE]: (event: Event) => void,
  [EventType.TOUCH_END]: (event: Event) => void,
}

export class System {
  constructor (engine: Engine, envetTarget: HTMLCanvasElement) {
  }
}
