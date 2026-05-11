import type { VFXItem } from '../vfx-item';

export interface AnimationEventReference {
  data: AnimationEventInfo,
  currentTime: number,
  deltaTime: number,
}

export interface AnimationEventInfo {
  name: string,
  startTime: number,
  duration: number,
  event: AnimationEvent,
}

export interface AnimationEventData {
  typeName: string,
}

export interface AnimationEventInfoData {
  name: string,
  startTime: number,
  duration?: number,
  eventData?: AnimationEventData,
}

export class AnimationEvent {
  onEvent (item: VFXItem, eventReference: AnimationEventReference): void {
    // Override
  }
}

export class NotifyEvent extends AnimationEvent {
  override onEvent (item: VFXItem, eventReference: AnimationEventReference): void {
    item.emit('animationevent', eventReference);
  }
}
