import { AnimationPlayable } from './animation-playable';
import { AnimationStream } from './animation-stream';

export class AnimationMixerPlayable extends AnimationPlayable {

  override processFrame (dt: number): void {
    for (const playable of this.getInputs()) {
      const animationPlayable = playable as AnimationPlayable;

      // TODO 多动画片段根据权重混合
    //   this.animationStream = animationClipPlayable.animationStream;
    }
  }
}