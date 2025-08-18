import * as spec from '@galacean/effects-specification';
import type { GraphContext, InstantiationContext } from '../graph-context';
import type { PoseResult } from '../pose-result';
import { nodeDataClass } from '../node-asset-type';
import { GraphNodeData, InvalidIndex, PoseNode } from '../graph-node';

export enum TransitionState {
  None,
  TransitioningIn,
  TransitioningOut,
}

@nodeDataClass(spec.NodeDataType.StateNodeData)
export class StateNodeData extends GraphNodeData {
  stateName: string;
  childNodeIndex = InvalidIndex;

  override instantiate (context: InstantiationContext): void {
    const node = this.createNode(StateNode, context);

    node.childNode = context.getNode<PoseNode>(this.childNodeIndex);
  }

  override load (data: spec.StateNodeData): void {
    super.load(data);

    this.childNodeIndex = data.childNodeIndex;
    // TODO: Add to spec
    //@ts-expect-error
    this.stateName = data.stateName;
  }
}

export class StateNode extends PoseNode {
  childNode: PoseNode | null = null;

  private transitionState = TransitionState.None;
  private elapsedTimeInState = 0;
  private isFirstStateUpdate = false;

  isTransitioning () {
    return this.transitionState !== TransitionState.None;
  }

  isTransitioningIn () {
    return this.transitionState === TransitionState.TransitioningIn;
  }

  isTransitioningOut () {
    return this.transitionState === TransitionState.TransitioningOut;
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

  getElapsedTimeInState () {
    return this.elapsedTimeInState;
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
