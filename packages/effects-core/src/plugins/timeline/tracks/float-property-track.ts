import { effectsClass, serialize } from '../../../decorators';
import type { PlayableGraph, Playable } from '../../cal/playable-graph';
import { FloatPropertyMixerPlayable } from '../playables';
import { TrackAsset } from '../track';

@effectsClass('FloatPropertyTrack')
export class FloatPropertyTrack extends TrackAsset {
  @serialize()
  path = '';

  propertyName = '';

  override createTrackMixer (graph: PlayableGraph): Playable {
    const mixer = new FloatPropertyMixerPlayable(graph);

    mixer.propertyName = this.propertyName;

    return mixer;
  }

  override resolveBinding () {
    const propertyNames = this.path.split('.');
    let target: Record<string, any> = this.parent.boundObject;

    for (let i = 0; i < propertyNames.length - 1; i++) {
      const property = target[propertyNames[i]];

      if (property === undefined) {
        console.error('The ' + propertyNames[i] + ' property of ' + target + ' was not found');
      }
      target = property;
    }

    if (propertyNames.length > 0) {
      this.propertyName = propertyNames[propertyNames.length - 1];
    }

    this.boundObject = target;
  }
}
