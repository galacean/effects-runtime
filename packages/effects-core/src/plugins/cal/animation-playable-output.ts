import type { AnimationPlayable } from './animation-playable';
import { PlayableOutput } from './playable-graph';

export class AnimationPlayableOutput extends PlayableOutput {

  override processFrame (dt: number): void {
    // TODO 采样动画数据到绑定元素
    // const animationStream = (this.sourcePlayable as AnimationPlayable).animationStream;
  }
}