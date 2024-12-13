import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { PlayableGraph } from '../../cal/playable-graph';
import type { TrackMixerPlayable } from '../playables';
import { FloatPropertyMixerPlayable } from '../playables';
import { PropertyTrack } from './property-track';

@effectsClass(spec.DataType.FloatPropertyTrack)
export class FloatPropertyTrack extends PropertyTrack {

  override createTrackMixer (graph: PlayableGraph): TrackMixerPlayable {
    const mixer = new FloatPropertyMixerPlayable(graph);

    const propertyNames = this.propertyNames;

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
