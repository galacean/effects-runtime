import { PoseNode } from '../..';
import type { GraphContext } from '../graph-context';
import type { PoseResult } from '../pose-result';

export enum TransitionState {
  None,
  TransitioningIn,
  TransitioningOut,
}

export class StateNode extends PoseNode {
  private transitionState = TransitionState.None;
  private childNode: PoseNode | null = null;
  private elapsedTimeInState = 0;
  private isFirstStateUpdate = false;

  isTransitioning () {
    return this.transitionState !== TransitionState.None;
  }

  isTransitioningIn () {
    return this.transitionState == TransitionState.TransitioningIn;
  }

  isTransitioningOut () {
    return this.transitionState == TransitionState.TransitioningOut;
  }

  startTransitionIn (context: GraphContext) {
    this.transitionState = TransitionState.TransitioningIn;
  }

  startTransitionOut (context: GraphContext) {
    this.transitionState = TransitionState.TransitioningOut;
  }

  setTransitioningState (newState: TransitionState) {
    this.transitionState = newState;
  }

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    this.markNodeActive(context);

    // 更新子节点
    if (this.childNode !== null && this.childNode.isValid()) {
      result = this.childNode.evaluate(context, result);
      this.duration = this.childNode.getDuration();
      this.previousTime = this.childNode.getPreviousTime();
      this.currentTime = this.childNode.getCurrentTime();
    }

    // 跟踪在状态中花费的时间
    this.elapsedTimeInState += context.deltaTime;
    this.isFirstStateUpdate = false;

    return result;
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.transitionState = TransitionState.None;
    this.elapsedTimeInState = 0;
    this.previousTime = this.currentTime = 0;
    this.duration = 0;
    if (this.childNode !== null) {
      this.childNode.initialize(context);
      if (this.childNode.isValid()) {
        this.duration = this.childNode.getDuration();
        this.previousTime = this.childNode.getPreviousTime();
        this.currentTime = this.childNode.getCurrentTime();
      }
    }

    // Flag this as the first update for this state, this will cause state entry events to be sampled for at least one update
    this.isFirstStateUpdate = true;
  }

  protected override shutdownInternal (context: GraphContext): void {
    if (this.childNode !== null) {
      this.childNode.shutdown(context);
    }
    this.transitionState = TransitionState.None;
    super.shutdownInternal(context);
  }
}