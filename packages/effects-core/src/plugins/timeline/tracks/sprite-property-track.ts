import { effectsClass } from '../../../decorators';
import type { VFXItem } from '../../../vfx-item';
import type { TrackMixerPlayable } from '../playables';
import { SpritePropertyMixerPlayable } from '../playables';
import { SpriteComponent } from '../../sprite/sprite-item';
import { PropertyTrack } from './property-track';

/**
 * Sprite 属性 K 帧 track。绑定到 SpriteComponent（updateAnimatedObject），
 * mixer 取激活 clip 的 Sprite 采样值赋值 sprite 属性。
 * path（'sprite'）为编辑器元数据，mixer 直接写 boundObject.sprite。
 */
@effectsClass('SpritePropertyTrack')
export class SpritePropertyTrack extends PropertyTrack {
  override createTrackMixer (): TrackMixerPlayable {
    return new SpritePropertyMixerPlayable();
  }

  override updateAnimatedObject (boundObject: object): object {
    return (boundObject as VFXItem).getComponent(SpriteComponent);
  }
}
