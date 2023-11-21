import type { TextureRegion } from '../Texture';
import type { Slot } from '../Slot';
import type { HasTextureRegion } from './HasTextureRegion';
import { ArrayUtils } from '../../utils';

export class Sequence {
  private static _nextID = 0;

  id = Sequence.nextID();
  regions: TextureRegion[];
  start = 0;
  digits = 0;
  /** The index of the region to show for the setup pose. */
  setupIndex = 0;

  constructor (count: number) {
    this.regions = new Array<TextureRegion>(count);
  }

  copy (): Sequence {
    const copy = new Sequence(this.regions.length);

    ArrayUtils.arrayCopy(this.regions, 0, copy.regions, 0, this.regions.length);
    copy.start = this.start;
    copy.digits = this.digits;
    copy.setupIndex = this.setupIndex;

    return copy;
  }

  apply (slot: Slot, attachment: HasTextureRegion) {
    let index = slot.sequenceIndex;

    if (index == -1) {index = this.setupIndex;}
    if (index >= this.regions.length) {index = this.regions.length - 1;}
    const region = this.regions[index];

    if (attachment.region != region) {
      attachment.region = region;
      attachment.updateRegion();
    }
  }

  getPath (basePath: string, index: number): string {
    let result = basePath;
    const frame = (this.start + index).toString();

    for (let i = this.digits - frame.length; i > 0; i--) {result += '0';}
    result += frame;

    return result;
  }

  private static nextID (): number {
    return Sequence._nextID++;
  }
}

export enum SequenceMode {
  hold = 0,
  once = 1,
  loop = 2,
  pingpong = 3,
  onceReverse = 4,
  loopReverse = 5,
  pingpongReverse = 6
}

export const SequenceModeValues = [
  SequenceMode.hold,
  SequenceMode.once,
  SequenceMode.loop,
  SequenceMode.pingpong,
  SequenceMode.onceReverse,
  SequenceMode.loopReverse,
  SequenceMode.pingpongReverse,
];
