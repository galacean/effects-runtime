import type { GraphNodeAsset } from '..';
import type { Constructor } from '../../utils';

export enum NodeAssetType {
  AnimationClipNodeAsset = 'AnimationClipNodeAsset',
  AnimationRootNodeAsset = 'AnimationRootNodeAsset',
  Blend1DNodeAsset = 'Blend1DNodeAsset',
  ConstFloatNodeAsset = 'ConstFloatNodeAsset',
  ControlParameterFloatNodeAsset = 'ControlParameterFloatNodeAsset',
  StateMachineNodeAsset = 'StateMachineNodeAsset',
  TransitionNodeAsset = 'TransitionNodeAsset',
  StateNodeAsset = 'StateNodeAsset'
}

const nodeAssetClassStore: Record<string, any> = {};

export function nodeAssetClass (className: string) {
  return (target: Object, context?: unknown) => {
    if (nodeAssetClassStore[className]) {
      console.warn(`NodeAsset Class ${className} is already registered.`);
    }
    nodeAssetClassStore[className] = target;
  };
}

export function getNodeAssetClass (className: string): Constructor<GraphNodeAsset> | null {
  return nodeAssetClassStore[className];
}