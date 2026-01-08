import type { AnimationClip } from './animation-clip';
import type { VFXItem } from '../vfx-item';

export interface AnimationEventReference {
  event: AnimationEventInfo,
  currentTime: number,
  deltaTime: number,
}

export interface AnimationEventInfo {
  name: string,
  startTime: number,
  duration: number,
  event: AnimationEvent,
  clip: AnimationClip,
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
  onEvent (item: VFXItem, animation: AnimationClip, eventReference: AnimationEventReference): void {
    // Override
  }
}

export class NotifyEvent extends AnimationEvent {
  override onEvent (item: VFXItem, animation: AnimationClip, eventReference: AnimationEventReference): void {
    item.emit('animationevent', eventReference);
  }
}
