import type { EventData } from './EventData';

/** Stores the current pose values for an {@link Event}.
 *
 * See Timeline {@link Timeline#apply()},
 * AnimationStateListener {@link AnimationStateListener#event()}, and
 * [Events](http://esotericsoftware.com/spine-events) in the Spine User Guide. */
export class Event {
  data: EventData;
  intValue = 0;
  floatValue = 0;
  stringValue: string | null = null;
  time = 0;
  volume = 0;
  balance = 0;

  constructor (time: number, data: EventData) {
    if (!data) {throw new Error('data cannot be null.');}
    this.time = time;
    this.data = data;
  }
}
