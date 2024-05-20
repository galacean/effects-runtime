import type { DataPath, EffectsObjectData } from '@galacean/effects-specification';
import type { Playable } from './playable-graph';
import { PlayableAsset } from './playable-graph';
import type { Track } from './track';
import { effectsClass } from '../../decorators';

export interface TimelineAssetData extends EffectsObjectData {
  tracks: DataPath[],
}

@effectsClass('TimelineAsset')
export class TimelineAsset extends PlayableAsset {
  tracks: Track[];

  override createPlayable (): Playable {
    throw new Error('Method not implemented.');
  }

  override fromData (data: TimelineAssetData): void {
    this.tracks = data.tracks as Track[];
  }
}