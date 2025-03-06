/* eslint-disable no-console */
import type { GraphNode, GraphNodeAssetData } from '@galacean/effects';
import { InvalidIndex, NodeAssetType } from '@galacean/effects';
import { AnimationClipGraphNode, AnimationRootGraphNode, Blend1DGraphNode, ConstFloatGraphNode } from './animation-graph-nodes/animation-graph-node';
import { StateMachineToolsNode } from './tools-graph/nodes/state-machine-tools-node';
import { StateToolsNode } from './tools-graph/nodes/state-tools-node';
import { TransitionConduitToolsNode, TransitionToolsNode } from './tools-graph/nodes/transition-tools-node';
import type { BaseNode } from './visual-graph/base-graph';
import type { UUID } from './visual-graph';
import type * as NodeGraph from './visual-graph';
import { ConstBoolToolsNode, ConstFloatToolsNode } from './tools-graph/nodes/const-value-tools-nodes';
import { AnimationClipToolsNode } from './tools-graph/nodes/animation-clip-tools-node';
import { BoolControlParameterToolsNode, ControlParameterToolsNode, FloatControlParameterToolsNode } from './tools-graph/nodes/parameter-tools-nodes';

export enum NodeCompilationState {
  NeedCompilation,
  AlreadyCompiled,
}

export class GraphCompilationContext {
//   private m_log: NodeCompilationLogEntry[] = [];
  private m_nodeIDToIndexMap: Map<UUID, number> = new Map();
  private m_nodeIndexToIDMap: Map<number, UUID> = new Map();
  private m_persistentNodeIndices: number[] = [];
  private m_compiledNodePaths: string[] = [];
  //   private m_nodeDefinitions: GraphNode.Definition[] = [];
  private m_nodeMemoryOffsets: number[] = [];
  private m_currentNodeMemoryOffset: number = 0;
  //   private m_graphInstanceRequiredAlignment: number = alignof(Boolean);

  private m_registeredDataSlots: UUID[] = [];
  //   private m_registeredChildGraphSlots: GraphDefinition.ChildGraphSlot[] = [];
  //   private m_registeredExternalGraphSlots: GraphDefinition.ExternalGraphSlot[] = [];
  private m_conduitSourceStateCompiledNodeIdx: number = InvalidIndex;
  private m_transitionDuration: number = 0;
  private m_transitionDurationOverrideIdx: number = InvalidIndex;

  constructor ();
  constructor (other: GraphCompilationContext);
  constructor (other?: GraphCompilationContext) {
    if (other) {
    //   this.copyFrom(other);
    }
  }

  //   Reset (): void {
  //     // this.m_log = [];
  //     this.m_nodeIDToIndexMap.clear();
  //     this.m_nodeIndexToIDMap.clear();
  //     this.m_persistentNodeIndices = [];
  //     this.m_compiledNodePaths = [];
  //     this.m_nodeDefinitions = [];
  //     this.m_nodeMemoryOffsets = [];
  //     this.m_currentNodeMemoryOffset = 0;
  //     this.m_graphInstanceRequiredAlignment = alignof(Boolean);
  //     this.m_registeredDataSlots = [];
  //     this.m_registeredChildGraphSlots = [];
  //     this.m_registeredExternalGraphSlots = [];
  //     this.m_conduitSourceStateCompiledNodeIdx = InvalidIndex;
  //     this.m_transitionDuration = 0;
  //     this.m_transitionDurationOverrideIdx = InvalidIndex;
  //   }

  // Logging
  //-------------------------------------------------------------------------

  //   LogMessage (pNode: NodeGraph.BaseNode, message: string): void;
  //   LogMessage (message: string): void;
  //   LogMessage (nodeOrMessage: NodeGraph.BaseNode | string, message?: string): void {
  //     if (typeof nodeOrMessage === 'string') {
  //       this.m_log.push(new NodeCompilationLogEntry(Severity.Info, new UUID(), nodeOrMessage));
  //     } else {
  //       this.m_log.push(new NodeCompilationLogEntry(Severity.Info, nodeOrMessage.GetID(), message!));
  //     }
  //   }

  //   LogWarning (pNode: NodeGraph.BaseNode, message: string): void;
  //   LogWarning (message: string): void;
  //   LogWarning (nodeOrMessage: NodeGraph.BaseNode | string, message?: string): void {
  //     if (typeof nodeOrMessage === 'string') {
  //       this.m_log.push(new NodeCompilationLogEntry(Severity.Warning, new UUID(), nodeOrMessage));
  //     } else {
  //       this.m_log.push(new NodeCompilationLogEntry(Severity.Warning, nodeOrMessage.GetID(), message!));
  //     }
  //   }

  //   LogError (pNode: NodeGraph.BaseNode, message: string): void;
  //   LogError (message: string): void;
  //   LogError (nodeOrMessage: NodeGraph.BaseNode | string, message?: string): void {
  //     if (typeof nodeOrMessage === 'string') {
  //       this.m_log.push(new NodeCompilationLogEntry(Severity.Error, new UUID(), nodeOrMessage));
  //     } else {
  //       this.m_log.push(new NodeCompilationLogEntry(Severity.Error, nodeOrMessage.GetID(), message!));
  //     }
  //   }

  // General Compilation
  //-------------------------------------------------------------------------

  GetUUIDToRuntimeIndexMap (): Map<UUID, number> {
    return this.m_nodeIDToIndexMap;
  }

  GetRuntimeIndexToUUIDMap (): Map<number, UUID> {
    return this.m_nodeIndexToIDMap;
  }

  GetRegisteredDataSlots () {
    return this.m_registeredDataSlots;
  }

  //   GetDefinition<T extends GraphNode>(
  //     pNode: NodeGraph.BaseNode,
  //     outDefinition: { definition: T['Definition'] | null }
  //   ): NodeCompilationState {
  //     const foundIndex = this.m_nodeIDToIndexMap.get(pNode.GetID());

  //     if (foundIndex !== undefined) {
  //       outDefinition.definition = this.m_nodeDefinitions[foundIndex] as T['Definition'];

  //       return NodeCompilationState.AlreadyCompiled;
  //     }

  //     //-------------------------------------------------------------------------

  //     console.assert(this.m_nodeDefinitions.length < 0xFFFF);
  //     const pDefinition = new T['Definition']();

  //     this.m_nodeDefinitions.push(pDefinition);
  //     this.m_compiledNodePaths.push(pNode.GetStringPathFromRoot());
  //     pDefinition.m_nodeIdx = this.m_nodeDefinitions.length - 1;

  //     // Add to map
  //     this.m_nodeIDToIndexMap.set(pNode.GetID(), pDefinition.m_nodeIdx);
  //     this.m_nodeIndexToIDMap.set(pDefinition.m_nodeIdx, pNode.GetID());

  //     // Add to persistent nodes list
  //     this.TryAddPersistentNode(pNode, pDefinition);

  //     // Update instance requirements
  //     this.m_graphInstanceRequiredAlignment = Math.max(
  //       this.m_graphInstanceRequiredAlignment,
  //       alignof(T)
  //     );
  //     const requiredNodePadding = calculatePaddingForAlignment(
  //       this.m_currentNodeMemoryOffset,
  //       alignof(T)
  //     );

  //     // Set current node offset
  //     this.m_nodeMemoryOffsets.push(this.m_currentNodeMemoryOffset + requiredNodePadding);

  //     // Shift memory offset to take into account the current node size
  //     this.m_currentNodeMemoryOffset += sizeof(T) + requiredNodePadding;

  //     outDefinition.definition = pDefinition;

  //     return NodeCompilationState.NeedCompilation;
  //   }

  RegisterDataSlotNode (nodeID: UUID): number {
    console.assert(!this.m_registeredDataSlots.includes(nodeID));
    const slotIdx = this.m_registeredDataSlots.length;

    this.m_registeredDataSlots.push(nodeID);

    return slotIdx;
  }

  //   RegisterExternalGraphSlotNode (nodeIdx: number, slotID: StringID): number {
  //     const newSlot = new GraphDefinition.ExternalGraphSlot(nodeIdx, slotID);

  //     console.assert(nodeIdx !== InvalidIndex && slotID.IsValid());

  //     for (const existingSlot of this.m_registeredExternalGraphSlots) {
  //       console.assert(existingSlot.m_nodeIdx !== nodeIdx && existingSlot.m_slotID !== slotID);
  //     }

  //     const slotIdx = this.m_registeredExternalGraphSlots.length;

  //     this.m_registeredExternalGraphSlots.push(newSlot);

  //     return slotIdx;
  //   }

  //   RegisterChildGraphNode (nodeIdx: number, nodeID: UUID): number {
  //     const dataSlotIdx = this.RegisterDataSlotNode(nodeID);
  //     const newSlot = new GraphDefinition.ChildGraphSlot(nodeIdx, dataSlotIdx);

  //     this.m_registeredChildGraphSlots.push(newSlot);

  //     return this.m_registeredChildGraphSlots.length - 1;
  //   }

  // State Machine Compilation
  //-------------------------------------------------------------------------

  BeginConduitCompilation (sourceStateNodeIdx: number): void {
    console.assert(this.m_conduitSourceStateCompiledNodeIdx === InvalidIndex);
    console.assert(sourceStateNodeIdx !== InvalidIndex);
    this.m_conduitSourceStateCompiledNodeIdx = sourceStateNodeIdx;
  }

  EndConduitCompilation (): void {
    console.assert(this.m_conduitSourceStateCompiledNodeIdx !== InvalidIndex);
    this.m_conduitSourceStateCompiledNodeIdx = InvalidIndex;
  }

  IsCompilingConduit (): boolean {
    return this.m_conduitSourceStateCompiledNodeIdx !== InvalidIndex;
  }

  GetConduitSourceStateIndex (): number {
    console.assert(this.m_conduitSourceStateCompiledNodeIdx !== InvalidIndex);

    return this.m_conduitSourceStateCompiledNodeIdx;
  }

  BeginTransitionConditionsCompilation (
    transitionDuration: number,
    transitionDurationOverrideIdx: number
  ): void {
    this.m_transitionDuration = transitionDuration;
    this.m_transitionDurationOverrideIdx = transitionDurationOverrideIdx;
  }

  EndTransitionConditionsCompilation (): void {
    this.m_transitionDuration = 0;
    this.m_transitionDurationOverrideIdx = InvalidIndex;
  }

  GetCompiledTransitionDurationOverrideIdx (): number {
    console.assert(this.m_conduitSourceStateCompiledNodeIdx !== InvalidIndex);

    return this.m_transitionDurationOverrideIdx;
  }

  GetCompiledTransitionDuration (): number {
    console.assert(this.m_conduitSourceStateCompiledNodeIdx !== InvalidIndex);

    return this.m_transitionDuration;
  }

  //   private TryAddPersistentNode (pNode: NodeGraph.BaseNode, pDefinition: GraphNode.Definition): void {
  //     // Implementation here
  //   }

  //   private copyFrom (other: GraphCompilationContext): void {
  //     // Deep copy implementation
  //   }

  nodeAssetDatas: GraphNodeAssetData[] = [];

  private compilationStates: NodeCompilationState[] = [];

  // getNodeAssetData (node: BaseNode): GraphNodeAssetData {
  //   //@ts-expect-error
  //   const cachedIndex = this.uuidToRuntimeIndex.get(node.getUID());

  //   if (cachedIndex !== undefined) {
  //     this.compilationStates[cachedIndex] = NodeCompilationState.AlreadyCompiled;

  //     return this.nodeAssetDatas[cachedIndex];
  //   }

  //   const type = this.getNodeAssetType(node) ?? '';
  //   const nodeAssetData: GraphNodeAssetData = {
  //     type,
  //     index: this.nodeAssetDatas.length,
  //   };

  //   this.nodeAssetDatas.push(nodeAssetData);
  //   this.compilationStates.push(NodeCompilationState.NeedCompilation);
  //   //@ts-expect-error
  //   this.uuidToRuntimeIndex.set(node.getUID(), nodeAssetData.index);

  //   return nodeAssetData;
  // }

  getGraphNodeAssetData<T extends GraphNodeAssetData>(node: BaseNode): T {
    const cachedIndex = this.m_nodeIDToIndexMap.get(node.m_ID);

    if (cachedIndex !== undefined) {
      this.compilationStates[cachedIndex] = NodeCompilationState.AlreadyCompiled;

      return this.nodeAssetDatas[cachedIndex] as T;
    }

    const type = this.getNodeAssetType(node) ?? '';
    const nodeAssetData: GraphNodeAssetData = {
      type,
      index: this.nodeAssetDatas.length,
    };

    this.nodeAssetDatas.push(nodeAssetData);
    this.m_compiledNodePaths.push(node.GetStringPathFromRoot());
    this.compilationStates.push(NodeCompilationState.NeedCompilation);

    // Add to map
    this.m_nodeIDToIndexMap.set(node.GetID(), nodeAssetData.index);
    this.m_nodeIndexToIDMap.set(nodeAssetData.index, node.GetID());

    return nodeAssetData as T;
  }

  checkNodeCompilationState (data: GraphNodeAssetData): boolean {
    return this.compilationStates[data.index] === NodeCompilationState.AlreadyCompiled;
  }

  reset () {
    this.nodeAssetDatas = [];
    this.compilationStates = [];

    this.m_nodeIDToIndexMap.clear();
    this.m_nodeIndexToIDMap.clear();
    this.m_persistentNodeIndices = [];
    this.m_compiledNodePaths = [];
    this.m_nodeMemoryOffsets = [];
    this.m_currentNodeMemoryOffset = 0;
    // this.m_graphInstanceRequiredAlignment = alignof(Boolean);
    this.m_registeredDataSlots = [];
    // this.m_registeredChildGraphSlots = [];
    // this.m_registeredExternalGraphSlots = [];
    this.m_conduitSourceStateCompiledNodeIdx = InvalidIndex;
    this.m_transitionDuration = 0;
    this.m_transitionDurationOverrideIdx = InvalidIndex;
  }

  private getNodeAssetType (node: BaseNode) {
    if (node instanceof AnimationClipToolsNode) {
      return NodeAssetType.AnimationClipNodeAsset;
    } else if (node instanceof StateMachineToolsNode) {
      return NodeAssetType.StateMachineNodeAsset;
    } else if (node instanceof StateToolsNode) {
      return NodeAssetType.StateNodeAsset;
    } else if (node instanceof TransitionToolsNode) {
      return NodeAssetType.TransitionNodeAsset;
    } else if (node instanceof ConstFloatToolsNode) {
      return NodeAssetType.ConstFloatNodeAsset;
    } else if (node instanceof ConstBoolToolsNode) {
      return NodeAssetType.ConstBoolNodeAsset;
    } else if (node instanceof FloatControlParameterToolsNode) {
      return NodeAssetType.ControlParameterFloatNodeAsset;
    } else if (node instanceof BoolControlParameterToolsNode) {
      return NodeAssetType.ControlParameterBoolNodeAsset;
    }
  }
}