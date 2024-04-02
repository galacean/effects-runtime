import type { VFXItem, VFXItemContent } from '../../vfx-item';
import { Playable, PlayableAsset, PlayableOutput } from './playable-graph';

/**
 * @since 2.0.0
 * @internal
 */
export class Track extends PlayableAsset {
  id: string;
  name: string;
  bindingItem: VFXItem<VFXItemContent>;

  private clips: TimelineClip[] = [];
  private clipSeed = 0;

  createOutput (): PlayableOutput {
    const output = new PlayableOutput();

    return output;
  }

  /**
   * 重写该方法以创建自定义混合器
   */
  createMixerPlayable (): Playable {
    return new Playable();
  }

  override createPlayable (): Playable {
    const defaultMixPlayable = this.createMixerPlayable();

    for (const clip of this.clips) {
      defaultMixPlayable.connect(clip.playable);
    }

    return defaultMixPlayable;
  }

  createClip<T extends Playable> (
    classConstructor: new () => T,
    name?: string,
  ): TimelineClip {
    const newClip = new TimelineClip();

    newClip.playable = new classConstructor();
    newClip.name = name ? name : 'TimelineClip' + newClip.id;
    this.addClip(newClip);

    return newClip;
  }

  getClips (): TimelineClip[] {
    return this.clips;
  }

  findClip (name: string): TimelineClip | undefined {
    for (const clip of this.clips) {
      if (clip.name === name) {
        return clip;
      }
    }
  }

  private addClip (clip: TimelineClip): void {
    clip.playable.bindingItem = this.bindingItem;
    clip.id = (this.clipSeed++).toString();
    this.clips.push(clip);
  }
}

/**
 * @since 2.0.0
 * @internal
 */
export class TimelineClip {
  id: string;
  name: string;
  start = 0;
  duration = 0;
  playable: Playable;
}
