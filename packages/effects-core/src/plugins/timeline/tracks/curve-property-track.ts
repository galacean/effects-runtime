import { effectsClass, serialize } from '../../../decorators';
import type { PlayableGraph, Playable } from '../../cal/playable-graph';
import { CurvePropertyMixerPlayable } from '../playables/curve-property-mixer-playable';
import { TrackAsset } from '../track';

export enum PropertyType {
  Unknown,
  Number,
  Vector2,
  Vector3,
  Vector4,
  Quaternion,
  Color,
}

@effectsClass('CurvePropertyTrack')
export class CurvePropertyTrack extends TrackAsset {
  @serialize()
  path = '';

  @serialize()
  propertyType = PropertyType.Unknown;
  propertyName = '';

  override createTrackMixer (graph: PlayableGraph): Playable {
    const mixer = new CurvePropertyMixerPlayable(graph);

    mixer.propertyName = this.propertyName;
    mixer.propertyType = this.propertyType;

    return mixer;
  }

  override resolveBinding () {
    const propertyNames = this.path.split('.');
    let target: Record<string, any> = this.parent.boundObject;

    for (let i = 0;i < propertyNames.length - 1;i++) {
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