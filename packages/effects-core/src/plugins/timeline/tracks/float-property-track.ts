import { effectsClass, serialize } from '../../../decorators';
import type { PlayableGraph, Playable } from '../../cal/playable-graph';
import { FloatPropertyMixerPlayable } from '../playables';
import { TrackAsset } from '../track';

@effectsClass('FloatPropertyTrack')
export class FloatPropertyTrack extends TrackAsset {
  @serialize()
  path = '';

  propertyNames: string[] = [];

  override createTrackMixer (graph: PlayableGraph): Playable {
    const mixer = new FloatPropertyMixerPlayable(graph);

    const propertyNames = this.path.split('.');

    this.propertyNames = propertyNames;

    if (propertyNames.length > 0) {
      const propertyName = propertyNames[propertyNames.length - 1];

      mixer.propertyName = propertyName;
    }

    return mixer;
  }

  override updateAnimatedObject () {
    const propertyNames = this.propertyNames;
    let target: Record<string, any> = this.parent.boundObject;

    for (let i = 0; i < propertyNames.length - 1; i++) {
      const property = target[propertyNames[i]];

      if (property === undefined) {
        console.error('The ' + propertyNames[i] + ' property of ' + target + ' was not found');
      }
      target = property;
    }

    this.boundObject = target;
  }
}
