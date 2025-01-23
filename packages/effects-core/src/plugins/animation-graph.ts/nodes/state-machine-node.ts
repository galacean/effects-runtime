import type { BoolValueNode, GraphNodeAssetData, StateNode } from '../..';
import type { TransitionNode } from '../..';
import { NodeAssetType } from '../..';
import { GraphNodeAsset, PoseNode, nodeAssetClass } from '../..';
import type { GraphContext, InstantiationContext } from '../graph-context';
import type { PoseResult } from '../pose-result';

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

    for (const stateData of this.stateDatas) {
      const state: StateInfo = {
        stateNode: null,
        transitions: [],
      };

      node.states.push(state);
      state.stateNode = context.getNode<StateNode>(stateData.stateNodeIndex);

      for (const transitionData of stateData.transitionDatas) {
        const transition: TransitionInfo = {
          transitionNode: null,
          conditionNode: null,
          targetStateIndex: transitionData.targetStateIndex,
        };

        state.transitions.push(transition);

        transition.transitionNode = context.getNode<TransitionNode>(transitionData.transitionNodeIndex);
        transition.conditionNode = context.getNode<BoolValueNode>(transitionData.conditionNodeIndex);
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
  transitionNode: TransitionNode | null,
  conditionNode: BoolValueNode | null,
  targetStateIndex: number,
}

export interface StateInfo {
  stateNode: StateNode | null,
  transitions: TransitionInfo[],
}

export class StateMachineNode extends PoseNode {
  states: StateInfo[] = [];
  private activeTransition: TransitionNode | null = null;
  private activeStateIndex = -1;

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    throw new Error('Method not implemented.');
  }
}