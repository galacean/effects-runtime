import * as spec from '@galacean/effects-specification';
import { Asset } from '../../asset';
import { effectsClass } from '../../decorators';
import type { TrackAsset } from './track';
import type { Constructor } from '../../utils';

@effectsClass(spec.DataType.TimelineAsset)
export class TimelineAsset extends Asset {
  tracks: TrackAsset[] = [];

  private cacheFlattenedTracks: TrackAsset[] | null = null;

  /** Invalidates asset caches and notifies timeline instances after an edit. */
  markAsChanged (): void {
    this.cacheFlattenedTracks = null;
    this.eventEmitter.emit('changed', this);
  }

  override fromData (data: spec.TimelineAssetData): void {
    super.fromData(data);
    if (data.tracks !== undefined) {
      this.tracks = data.tracks.map(track => this.findObject<TrackAsset>(track));
      // setData emits changed after deserialization.
      this.cacheFlattenedTracks = null;
    }
  }

  get flattenedTracks () {
    if (!this.cacheFlattenedTracks) {
      this.cacheFlattenedTracks = [];
      // flatten track tree
      for (const masterTrack of this.tracks) {
        this.cacheFlattenedTracks.push(masterTrack);
        this.addSubTracksRecursive(masterTrack, this.cacheFlattenedTracks);
      }
    }

    return this.cacheFlattenedTracks;
  }

  createTrack<T extends TrackAsset> (classConstructor: Constructor<T>, parent: TrackAsset, name?: string): T {
    const newTrack = new classConstructor(this.engine);

    newTrack.name = name ? name : classConstructor.name;
    parent.addChild(newTrack);

    this.markAsChanged();

    return newTrack;
  }

  private addSubTracksRecursive (track: TrackAsset, allTracks: TrackAsset[]) {
    for (const subTrack of track.getChildTracks()) {
      allTracks.push(subTrack);
    }
    for (const subTrack of track.getChildTracks()) {
      this.addSubTracksRecursive(subTrack, allTracks);
    }
  }
}
