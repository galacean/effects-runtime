import { AnimationStream } from './animation-stream';
import type { PlayableGraph } from './playable-graph';
import { Playable } from './playable-graph';

export class AnimationPlayable extends Playable {
  animationStream: AnimationStream;

  constructor (graph: PlayableGraph) {
    super(graph);
    this.animationStream = new AnimationStream(this);
  }
}