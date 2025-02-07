import type { BoolValueNode, GraphNodeAssetData, StateNode } from '../..';
import type { TransitionNode } from '../..';
import { NodeAssetType } from '../..';
import { GraphNodeAsset, PoseNode, nodeAssetClass } from '../..';
import { BranchState, type GraphContext, type InstantiationContext } from '../graph-context';
import type { PoseResult } from '../pose-result';

const InvalidIndex = -1;

export interface TransitionData {
  targetStateIndex: number,
  conditionNodeIndex: number,
  transitionNodeIndex: number,
}

export interface StateData {
  stateNodeIndex: number,
  transitionDatas: TransitionData[],
}

export interface StateMachineNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.StateMachineNodeAsset,
  stateDatas: StateData[],
  defaultStateIndex: number,
}

@nodeAssetClass(NodeAssetType.StateMachineNodeAsset)
export class StateMachineNodeAsset extends GraphNodeAsset {
  stateDatas: StateData[];
  defaultStateIndex: number;

  override instantiate (context: InstantiationContext): void {
    const node = this.createNode(StateMachineNode, context);

    node.defaultStateIndex = this.defaultStateIndex;

    for (const stateData of this.stateDatas) {
      const state: StateInfo = {
        stateNode: context.getNode<StateNode>(stateData.stateNodeIndex),
        transitions: [],
      };

      node.states.push(state);

      for (const transitionData of stateData.transitionDatas) {
        const transition: TransitionInfo = {
          transitionNode: context.getNode<TransitionNode>(transitionData.transitionNodeIndex),
          conditionNode: context.getNode<BoolValueNode>(transitionData.conditionNodeIndex),
          targetStateIndex: transitionData.targetStateIndex,
        };

        state.transitions.push(transition);
      }
    }
  }

  override load (data: StateMachineNodeAssetData): void {
    super.load(data);

    this.stateDatas = data.stateDatas;
    this.defaultStateIndex = data.defaultStateIndex;
  }
}

export interface TransitionInfo {
  transitionNode: TransitionNode,
  conditionNode: BoolValueNode,
  targetStateIndex: number,
}

export interface StateInfo {
  stateNode: StateNode,
  transitions: TransitionInfo[],
}

export class StateMachineNode extends PoseNode {
  states: StateInfo[] = [];
  defaultStateIndex = InvalidIndex;
  private activeTransition: TransitionNode | null = null;
  private activeStateIndex = InvalidIndex;

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    this.markNodeActive(context);

    // Check active transition
    if (this.activeTransition !== null) {
      if (this.activeTransition.isComplete(context)) {
        this.activeTransition.shutdown(context);
        this.activeTransition = null;
      }
    }

    if (this.activeTransition === null) {
      // Update state directly
      const activeState = this.states[this.activeStateIndex].stateNode;

      result = activeState.evaluate(context, result);

      // Update node time
      this.duration = activeState.getDuration();
      this.previousTime = activeState.getPreviousTime();
      this.currentTime = activeState.getCurrentTime();
    } else {
      // Update transition
      result = this.activeTransition.evaluate(context, result);

      // Update node time
      this.duration = this.activeTransition.getDuration();
      this.previousTime = this.activeTransition.getPreviousTime();
      this.currentTime = this.activeTransition.getCurrentTime();
    }

    // Check for transitions
    if (context.branchState === BranchState.Active && !this.activeTransition) {
      this.evaluateTransitions(context, result);
    }

    return result;
  }

  private evaluateTransitions (
    context: GraphContext,
    sourceNodeResult: PoseResult
  ): void {
    const currentlyActiveStateInfo = this.states[this.activeStateIndex];

    // Check for a valid transition
    let transitionIdx = InvalidIndex;
    const numTransitions = currentlyActiveStateInfo.transitions.length;

    for (let i = 0; i < numTransitions; i++) {
      const transition = currentlyActiveStateInfo.transitions[i];

      if (transition.targetStateIndex === InvalidIndex) {
        throw new Error('Invalid target state index');
      }

      // Disallow transitions to already transitioning states unless forced
      if (this.states[transition.targetStateIndex].stateNode.isTransitioning()) {
        continue;
      }

      // Check transition conditions
      if (transition.conditionNode !== null &&
        transition.conditionNode.getValue<boolean>(context)) {
        transitionIdx = i;

        break;
      }
    }

    // Start new transition if found
    if (transitionIdx !== InvalidIndex) {
      const transition = currentlyActiveStateInfo.transitions[transitionIdx];
      const targetStateInfo = this.states[transition.targetStateIndex];

      if (this.activeTransition) {
        this.activeTransition.notifyNewTransitionStarting(context, targetStateInfo.stateNode);
      }

      // Start the new transition
      // Initialize target state based on transition settings
      transition.transitionNode.initialize(context);

      if (this.activeTransition !== null) {
        sourceNodeResult = transition.transitionNode.startTransitionFromTransition(
          context,
          sourceNodeResult,
          this.activeTransition,
          sourceNodeResult
        );
      } else {
        sourceNodeResult = transition.transitionNode.startTransitionFromState(
          context,
          sourceNodeResult,
          this.states[this.activeStateIndex].stateNode,
          sourceNodeResult
        );
      }

      this.activeTransition = transition.transitionNode;

      // Update state data
      this.shutdownTransitionConditions(context);
      this.activeStateIndex = transition.targetStateIndex;
      this.initializeTransitionConditions(context);

      // Update timing info
      this.duration = this.states[this.activeStateIndex].stateNode.getDuration();
      this.previousTime = this.states[this.activeStateIndex].stateNode.getPreviousTime();
      this.currentTime = this.states[this.activeStateIndex].stateNode.getCurrentTime();
    }
  }

  private selectDefaultState (context: GraphContext): number {
    const selectedStateIndex = this.defaultStateIndex;

    return selectedStateIndex;
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);

    this.activeStateIndex = this.selectDefaultState(context);
    const activeState = this.states[this.activeStateIndex].stateNode;

    activeState.initialize(context);

    this.duration = activeState.getDuration();
    this.previousTime = activeState.getPreviousTime();
    this.currentTime = activeState.getCurrentTime();

    this.initializeTransitionConditions(context);
  }

  protected override shutdownInternal (context: GraphContext): void {
    if (this.activeTransition !== null) {
      this.activeTransition.shutdown(context);
    }

    this.shutdownTransitionConditions(context);

    this.states[this.activeStateIndex].stateNode.shutdown(context);
    this.activeStateIndex = InvalidIndex;
    this.activeTransition = null;

    super.shutdownInternal(context);
  }

  private initializeTransitionConditions (context: GraphContext): void {
    for (const transition of this.states[this.activeStateIndex].transitions) {
      if (transition.conditionNode !== null) {
        transition.conditionNode.initialize(context);
      }
    }
  }

  private shutdownTransitionConditions (context: GraphContext): void {
    for (const transition of this.states[this.activeStateIndex].transitions) {
      if (transition.conditionNode !== null) {
        transition.conditionNode.shutdown(context);
      }
    }
  }
}