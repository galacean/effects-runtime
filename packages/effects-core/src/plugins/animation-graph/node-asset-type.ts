import type { GraphNodeData } from '..';
import type { Constructor } from '../../utils';

export enum NodeDataType {
  AnimationClipNodeData = 'AnimationClipNodeData',
  BlendNodeData = 'BlendNodeData',
  ApplyAdditiveNodeData = 'ApplyAdditiveNodeData',

  StateMachineNodeData = 'StateMachineNodeData',
  TransitionNodeData = 'TransitionNodeData',
  StateNodeData = 'StateNodeData',

  ConstFloatNodeData = 'ConstFloatNodeData',
  ConstBoolNodeData = 'ConstBoolNodeData',

  ControlParameterBoolNodeData = 'ControlParameterBoolNodeData',
  ControlParameterFloatNodeData = 'ControlParameterFloatNodeData',
  ControlParameterTriggerNodeData = 'ControlParameterTriggerNodeData',

  NotNodeData = 'NotNodeData',
  AndNodeData = 'AndNodeData',
  OrNodeData = 'OrNodeData',

  EqualNodeData = 'EqualNodeData',
  GreaterNodeData = 'GreaterNodeData',
  LessNodeData = 'LessNodeData'
}

const nodeDataClassStore: Record<string, any> = {};

export function nodeDataClass (className: string) {
  return (target: Object, context?: unknown) => {
    if (nodeDataClassStore[className]) {
      console.warn(`NodeData Class ${className} is already registered.`);
    }
    nodeDataClassStore[className] = target;
  };
}

export function getNodeDataClass (className: string): Constructor<GraphNodeData> | null {
  return nodeDataClassStore[className];
}

// TODO Add to spec
export namespace Spec {
  export interface GraphNodeData {
    type: string,
    index: number,
  }

  export interface AnimationClipNodeData extends GraphNodeData {
    type: NodeDataType.AnimationClipNodeData,
    dataSlotIndex: number,
    playRate?: number,
    loopAnimation?: boolean,
  }

  export interface EqualNodeData extends GraphNodeData {
    type: NodeDataType.EqualNodeData,
    inputValueNodeIndex: number,
    comparandValueNodeIndex: number,
  }

  export interface BlendNodeData extends GraphNodeData {
    type: NodeDataType.BlendNodeData,
    sourceNodeIndex0: number,
    sourceNodeIndex1: number,
    inputParameterValueNodeIndex: number,
  }

  export interface ApplyAdditiveNodeData extends GraphNodeData {
    type: NodeDataType.ApplyAdditiveNodeData,
    baseNodeIndex: number,
    additiveNodeIndex: number,
    inputParameterValueNodeIndex: number,
  }

  export interface AndNodeData extends GraphNodeData {
    type: NodeDataType.AndNodeData,
    conditionNodeIndices: number[],
  }

  export interface OrNodeAssetData extends GraphNodeData {
    type: NodeDataType.OrNodeData,
    conditionNodeIndices: number[],
  }
  export interface NotNodeAssetData extends GraphNodeData {
    type: NodeDataType.NotNodeData,
    inputValueNodeIndex: number,
  }

  export interface ConstFloatNodeData extends GraphNodeData {
    type: NodeDataType.ConstFloatNodeData,
    value: number,
  }

  export interface ConstBoolNodeData extends GraphNodeData {
    type: NodeDataType.ConstBoolNodeData,
    value: boolean,
  }

  export interface ControlParameterFloatNodeData extends GraphNodeData {
    type: NodeDataType.ControlParameterFloatNodeData,
    value: number,
  }

  export interface ControlParameterBoolNodeData extends GraphNodeData {
    type: NodeDataType.ControlParameterBoolNodeData,
    value: boolean,
  }

  export interface FloatComparisonNodeData extends GraphNodeData {
    inputValueNodeIndex: number,
    comparandValueNodeIndex: number,
  }

  export interface LessNodeData extends FloatComparisonNodeData {
    type: NodeDataType.LessNodeData,
  }

  export interface GreaterNodeData extends FloatComparisonNodeData {
    type: NodeDataType.EqualNodeData,
  }

  export interface StateMachineNodeData extends GraphNodeData {
    type: NodeDataType.StateMachineNodeData,
    stateDatas: StateData[],
    defaultStateIndex: number,
  }

  export interface TransitionData {
    targetStateIndex: number,
    conditionNodeIndex: number,
    transitionNodeIndex: number,
  }

  export interface StateData {
    stateNodeIndex: number,
    transitionDatas: TransitionData[],
  }

  export interface StateNodeData extends GraphNodeData {
    type: NodeDataType.StateNodeData,
    childNodeIndex: number,
  }

  export interface TransitionNodeData extends GraphNodeData {
    type: NodeDataType.TransitionNodeData,
    duration: number,
    hasExitTime: boolean,
    exitTime: number,
    targetStateNodeIndex: number,
  }
}
