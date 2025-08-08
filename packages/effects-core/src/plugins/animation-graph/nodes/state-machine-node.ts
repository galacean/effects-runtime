import * as spec from '@galacean/effects-specification';
import { BranchState, type GraphContext, type InstantiationContext } from '../graph-context';
import type { PoseResult } from '../pose-result';
import { nodeDataClass } from '../node-asset-type';
import type { BoolValueNode } from '../graph-node';
import { GraphNodeData, InvalidIndex, PoseNode } from '../graph-node';
import type { StateNode, StateNodeData } from './state-node';
import type { TransitionNode } from './transition-node';

@nodeDataClass(spec.NodeDataType.StateMachineNodeData)
export class StateMachineNodeData extends GraphNodeData {
  machineName: string;
  stateDatas: spec.StateData[];
  defaultStateIndex: number;

  override instantiate (context: InstantiationContext): void {
    const node = this.createNode(StateMachineNode, context);

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

  override load (data: spec.StateMachineNodeData): void {
    super.load(data);

    this.stateDatas = data.stateDatas;
    this.defaultStateIndex = data.defaultStateIndex;
    // TODO: Add to spec
    //@ts-expect-error
    this.machineName = data.machineName;
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
  private activeTransition: TransitionNode | null = null;
  private activeStateIndex = InvalidIndex;

  getCurrentStateName (): string {
    return this.states[this.activeStateIndex].stateNode.getNodeData<StateNodeData>().stateName;
  }

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
    if (context.branchState === BranchState.Active) {
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
        throw new Error('Invalid target state index.');
      }

      // Disallow transitions to already transitioning states unless forced
      if (this.states[transition.targetStateIndex].stateNode.isTransitioning()) {
        continue;
      }

      let canEnterTransition = false;

      // HasExitTime override transition condition
      if (transition.transitionNode.hasExitTime) {
        const stateNode = currentlyActiveStateInfo.stateNode;

        if (stateNode.getElapsedTimeInState() / stateNode.getDuration() > transition.transitionNode.exitTime) {
          canEnterTransition = true;
        }
      } else if (transition.conditionNode !== null && transition.conditionNode.getValue<boolean>(context)) {  // Check transition conditions
        canEnterTransition = true;
      }

      if (canEnterTransition) {
        transitionIdx = i;

        break;
      }
    }

    // Start new transition if found
    if (transitionIdx !== InvalidIndex) {
      const transition = currentlyActiveStateInfo.transitions[transitionIdx];
      // const targetStateInfo = this.states[transition.targetStateIndex];

      // if (this.activeTransition) {
      //   this.activeTransition.notifyNewTransitionStarting(context, targetStateInfo.stateNode);
      // }

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
    const selectedStateIndex = this.getNodeData<StateMachineNodeData>().defaultStateIndex;

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
