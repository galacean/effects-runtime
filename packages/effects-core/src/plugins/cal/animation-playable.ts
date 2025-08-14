import { AnimationStream } from './animation-stream';
import { Playable } from './playable-graph';

export class AnimationPlayable extends Playable {
  animationStream: AnimationStream;

  constructor () {
    super();
    this.animationStream = new AnimationStream(this);
  }
}