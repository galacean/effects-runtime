/* eslint-disable no-console */
// @ts-nocheck
import { EntryStateOverrideConduitToolsNode, GlobalTransitionConduitToolsNode, StateMachineGraph } from '../graphs/state-machine-graph';
import { FlowToolsNode, GraphValueType } from './flow-tools-node';
import { StateToolsNode } from './state-tools-node';
import { ImGui } from '../../../../imgui/index';
import { Colors } from '../colors';
import * as NodeGraph from '../../visual-graph';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

type Color = ImGui.Color;
const Color = ImGui.Color;

// StateMachineToolsNode class
export class StateMachineToolsNode extends FlowToolsNode {
  constructor () {
    super();
    this.CreateOutputPin('Pose', GraphValueType.Pose);
    this.m_name = 'SM';

    // Create graph
    const pStateMachineGraph = this.CreateChildGraph<StateMachineGraph>(StateMachineGraph);

    // Create conduits
    pStateMachineGraph.CreateNode(EntryStateOverrideConduitToolsNode);
    pStateMachineGraph.CreateNode(GlobalTransitionConduitToolsNode);

    // Create default state
    const pDefaultStateNode = pStateMachineGraph.CreateNode(StateToolsNode);

    pDefaultStateNode.SetPosition(new ImVec2(0, 150));
    pStateMachineGraph.SetDefaultEntryState(pDefaultStateNode.GetID());

    // Update dependent nodes
    this.GetEntryStateOverrideConduit().UpdateConditionsNode();
    this.GetGlobalTransitionConduit().UpdateTransitionNodes();
  }

  override IsRenameable (): boolean {
    return true;
  }

  override RequiresUniqueName (): boolean {
    return true;
  }

  override GetTypeName (): string {
    return 'State Machine';
  }

  override GetCategory (): string {
    return 'Animation';
  }

  override GetTitleBarColor (): Color {
    return new Color(Colors.DarkOrange);
  }

  GetAllowedParentGraphTypes (): TBitFlags<GraphType> {
    return new TBitFlags<GraphType>(GraphType.BlendTree);
  }

  override OnShowNode (): void {
    super.OnShowNode();
    this.GetEntryStateOverrideConduit().UpdateConditionsNode();
    this.GetGlobalTransitionConduit().UpdateTransitionNodes();
  }

  private GetEntryStateOverrideConduit (): EntryStateOverrideConduitToolsNode {
    const pStateMachineGraph = this.GetChildGraph() as StateMachineGraph;
    const foundNodes = pStateMachineGraph.FindAllNodesOfType<EntryStateOverrideConduitToolsNode>(
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Exact
    );

    console.assert(foundNodes.length === 1);

    return foundNodes[0];
  }

  private GetGlobalTransitionConduit (): GlobalTransitionConduitToolsNode {
    const pStateMachineGraph = this.GetChildGraph() as StateMachineGraph;
    const foundNodes = pStateMachineGraph.FindAllNodesOfType<GlobalTransitionConduitToolsNode>(
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Exact
    );

    console.assert(foundNodes.length === 1);

    return foundNodes[0];
  }

  override Compile (context: GraphCompilationContext): number {
    const pDefinition: StateMachineNode.Definition | null = null;
    const state = context.GetDefinition<StateMachineNode>(this, pDefinition);

    if (state !== NodeCompilationState.NeedCompilation) {
      return pDefinition!.m_nodeIdx;
    }

    // Get all necessary nodes for compilation
    //-------------------------------------------------------------------------

    const pStateMachineGraph = this.GetChildGraph() as StateMachineGraph;
    const stateNodes = pStateMachineGraph.FindAllNodesOfType<StateToolsNode>(
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Derived
    );
    const numStateNodes = stateNodes.length;

    console.assert(numStateNodes >= 1);

    const conduitNodes = pStateMachineGraph.FindAllNodesOfType<TransitionConduitToolsNode>();
    const numConduitNodes = conduitNodes.length;

    const globalTransitionNodes = this.GetGlobalTransitionConduit().GetSecondaryGraph().FindAllNodesOfType<GlobalTransitionToolsNode>();

    // Compile all states
    //-------------------------------------------------------------------------

    const pEntryConditionsConduit = this.GetEntryStateOverrideConduit();

    const IDToStateIdxMap = new Map<UUID, StateMachineNode.StateIndex>();
    const IDToCompiledNodeIdxMap = new Map<UUID, number>();

    for (let i = 0; i < numStateNodes; i++) {
      const pStateNode = stateNodes[i];

      // Compile state node
      const stateDefinition = pDefinition!.m_stateDefinition.emplace_back();

      stateDefinition.m_stateNodeIdx = this.CompileState(context, pStateNode);
      if (stateDefinition.m_stateNodeIdx === InvalidIndex) {
        return InvalidIndex;
      }

      // Compile entry condition if it exists
      const pEntryConditionNode = pEntryConditionsConduit.GetEntryConditionNodeForState(pStateNode.GetID());

      if (pEntryConditionNode !== null) {
        stateDefinition.m_entryConditionNodeIdx = pEntryConditionNode.Compile(context);
        if (stateDefinition.m_entryConditionNodeIdx === InvalidIndex) {
          return InvalidIndex;
        }
      }

      IDToStateIdxMap.set(pStateNode.GetID(), i as StateMachineNode.StateIndex);
      IDToCompiledNodeIdxMap.set(pStateNode.GetID(), stateDefinition.m_stateNodeIdx);
    }

    // Compile all transitions
    //-------------------------------------------------------------------------

    for (let i = 0; i < numStateNodes; i++) {
      const pStartStateNode = stateNodes[i];

      // Check all conduits for any starting at the specified state
      //-------------------------------------------------------------------------

      // We need to ignore any global transitions that we have an explicit conduit for
      const globalTransitionNodesCopy = [...globalTransitionNodes];
      const RemoveFromGlobalTransitions = (endStateID: UUID) => {
        const index = globalTransitionNodesCopy.findIndex(node => node.GetEndStateID() === endStateID);

        if (index !== -1) {
          globalTransitionNodesCopy.splice(index, 1);
        }
      };

      const TryCompileTransition = (pTransitionNode: TransitionToolsNode, endStateID: UUID): boolean => {
        // Transitions are only enabled if a condition is connected to them
        const pConditionNode = pTransitionNode.GetConnectedInputNode<FlowToolsNode>(0);

        if (pConditionNode !== null) {
          const transitionDefinition = pDefinition!.m_stateDefinition[i].m_transitionDefinition.emplace_back();

          transitionDefinition.m_targetStateIdx = IDToStateIdxMap.get(endStateID)!;

          // Compile transition node
          //-------------------------------------------------------------------------

          transitionDefinition.m_transitionNodeIdx = this.CompileTransition(
            context,
            pTransitionNode,
            IDToCompiledNodeIdxMap.get(endStateID)!
          );
          transitionDefinition.m_canBeForced = pTransitionNode.m_canBeForced;
          if (transitionDefinition.m_transitionNodeIdx === InvalidIndex) {
            return false;
          }

          // Compile condition tree
          //-------------------------------------------------------------------------

          const pCompiledTransitionDefinition: TransitionNode.Definition | null = null;
          const state = context.GetDefinition<TransitionNode>(pTransitionNode, pCompiledTransitionDefinition);

          console.assert(state === NodeCompilationState.AlreadyCompiled);

          context.BeginTransitionConditionsCompilation(
            pCompiledTransitionDefinition!.m_duration,
            pCompiledTransitionDefinition!.m_durationOverrideNodeIdx
          );
          transitionDefinition.m_conditionNodeIdx = pConditionNode.Compile(context);
          if (transitionDefinition.m_conditionNodeIdx === InvalidIndex) {
            return false;
          }
          context.EndTransitionConditionsCompilation();
        }

        return true;
      };

      // Remove ourselves state from the global transitions copy
      RemoveFromGlobalTransitions(pStartStateNode.GetID());

      // Compile conduits
      for (let c = 0; c < numConduitNodes; c++) {
        const pConduit = conduitNodes[c];

        if (pConduit.GetStartStateID() !== pStartStateNode.GetID()) {
          continue;
        }

        RemoveFromGlobalTransitions(pConduit.GetEndStateID());

        const foundSourceStateIter = IDToCompiledNodeIdxMap.get(pConduit.GetStartStateID());

        console.assert(foundSourceStateIter !== undefined);
        context.BeginConduitCompilation(foundSourceStateIter!);

        // Compile transitions in conduit
        const transitionNodes = pConduit.GetSecondaryGraph().FindAllNodesOfType<TransitionToolsNode>();

        for (const pTransitionNode of transitionNodes) {
          if (!TryCompileTransition(pTransitionNode, pConduit.GetEndStateID())) {
            return InvalidIndex;
          }
        }

        context.EndConduitCompilation();
      }

      // Global transitions
      //-------------------------------------------------------------------------
      // Compile all global transitions from this state to others

      for (const pGlobalTransition of globalTransitionNodesCopy) {
        const foundSourceStateIter = IDToCompiledNodeIdxMap.get(pStartStateNode.GetID());

        console.assert(foundSourceStateIter !== undefined);

        if (!TryCompileTransition(pGlobalTransition, pGlobalTransition.GetEndStateID())) {
          return InvalidIndex;
        }
      }
    }

    //-------------------------------------------------------------------------

    pDefinition!.m_defaultStateIndex = IDToStateIdxMap.get(pStateMachineGraph.GetDefaultEntryStateID())!;

    return pDefinition!.m_nodeIdx;
  }

  private CompileState (context: GraphCompilationContext, pStateNode: StateToolsNode): number {
    console.assert(pStateNode !== null);

    const pDefinition: StateNode.Definition | null = null;
    const state = context.GetDefinition<StateNode>(pStateNode, pDefinition);

    console.assert(state === NodeCompilationState.NeedCompilation);

    //-------------------------------------------------------------------------

    const ReflectStateEvents = (IDs: StringID[], outEvents: StringID[]) => {
      for (const ID of IDs) {
        if (ID.IsValid()) {
          if (!outEvents.includes(ID)) {
            outEvents.push(ID);
          }
        } else {
          context.LogWarning(this, 'Invalid state event detected and ignored!');
        }
      }
    };

    ReflectStateEvents(pStateNode.m_events, pDefinition!.m_entryEvents);
    ReflectStateEvents(pStateNode.m_entryEvents, pDefinition!.m_entryEvents);

    ReflectStateEvents(pStateNode.m_events, pDefinition!.m_executeEvents);
    ReflectStateEvents(pStateNode.m_executeEvents, pDefinition!.m_executeEvents);

    ReflectStateEvents(pStateNode.m_events, pDefinition!.m_exitEvents);
    ReflectStateEvents(pStateNode.m_exitEvents, pDefinition!.m_exitEvents);

    //-------------------------------------------------------------------------

    if (pStateNode.IsOffState()) {
      pDefinition!.m_childNodeIdx = InvalidIndex;
      pDefinition!.m_isOffState = true;
    } else {
      // Compile Blend Tree
      //-------------------------------------------------------------------------

      const resultNodes = pStateNode.GetChildGraph().FindAllNodesOfType<ResultToolsNode>(
        NodeGraph.SearchMode.Localized,
        NodeGraph.SearchTypeMatch.Derived
      );

      console.assert(resultNodes.length === 1);
      const pBlendTreeRoot = resultNodes[0];

      console.assert(pBlendTreeRoot !== null);

      const pBlendTreeNode = pBlendTreeRoot.GetConnectedInputNode<FlowToolsNode>(0);

      if (pBlendTreeNode !== null) {
        pDefinition!.m_childNodeIdx = pBlendTreeNode.Compile(context);
        if (pDefinition!.m_childNodeIdx === InvalidIndex) {
          return InvalidIndex;
        }
      }

      // Compile Layer Data
      //-------------------------------------------------------------------------

      const dataNodes = pStateNode.GetSecondaryGraph()
        .FindAllNodesOfType<StateLayerDataToolsNode>();

      console.assert(dataNodes.length === 1);
      const pLayerData = dataNodes[0];

      console.assert(pLayerData !== null);

      const pLayerWeightNode = pLayerData.GetConnectedInputNode<FlowToolsNode>(0);

      if (pLayerWeightNode !== null) {
        pDefinition!.m_layerWeightNodeIdx = pLayerWeightNode.Compile(context);
        if (pDefinition!.m_layerWeightNodeIdx === InvalidIndex) {
          return InvalidIndex;
        }
      }

      const pLayerRootMotionWeightNode = pLayerData.GetConnectedInputNode<FlowToolsNode>(1);

      if (pLayerRootMotionWeightNode !== null) {
        pDefinition!.m_layerRootMotionWeightNodeIdx = pLayerRootMotionWeightNode.Compile(context);
        if (pDefinition!.m_layerRootMotionWeightNodeIdx === InvalidIndex) {
          return InvalidIndex;
        }
      }

      const pLayerMaskNode = pLayerData.GetConnectedInputNode<FlowToolsNode>(2);

      if (pLayerMaskNode !== null) {
        pDefinition!.m_layerBoneMaskNodeIdx = pLayerMaskNode.Compile(context);
        if (pDefinition!.m_layerBoneMaskNodeIdx === InvalidIndex) {
          return InvalidIndex;
        }
      }

      // Transfer additional state events
      //-------------------------------------------------------------------------

      const ReflectTimedStateEvents = (
        timedEvents: StateToolsNode.TimedStateEvent[],
        outEvents: StateNode.TimedEvent[]
      ) => {
        for (const evt of timedEvents) {
          if (evt.m_ID.IsValid()) {
            outEvents.push(new StateNode.TimedEvent(evt.m_ID, evt.m_timeValue));
          } else {
            context.LogWarning(this, 'Invalid state event detected and ignored!');
          }
        }
      };

      ReflectTimedStateEvents(pStateNode.m_timeRemainingEvents, pDefinition!.m_timedRemainingEvents);
      ReflectTimedStateEvents(pStateNode.m_timeElapsedEvents, pDefinition!.m_timedElapsedEvents);
    }

    //-------------------------------------------------------------------------

    return pDefinition!.m_nodeIdx;
  }

  private CompileTransition (
    context: GraphCompilationContext,
    pTransitionNode: TransitionToolsNode,
    targetStateNodeIdx: number
  ): number {
    console.assert(pTransitionNode !== null);
    const pDefinition: TransitionNode.Definition | null = null;
    const state = context.GetDefinition<TransitionNode>(pTransitionNode, pDefinition);

    if (state === NodeCompilationState.AlreadyCompiled) {
      return pDefinition!.m_nodeIdx;
    }

    //-------------------------------------------------------------------------

    const pDurationOverrideNode = pTransitionNode.GetConnectedInputNode<FlowToolsNode>(1);

    if (pDurationOverrideNode !== null) {
      pDefinition!.m_durationOverrideNodeIdx = pDurationOverrideNode.Compile(context);
      if (pDefinition!.m_durationOverrideNodeIdx === InvalidIndex) {
        return InvalidIndex;
      }
    }

    const pSyncEventOffsetOverrideNode = pTransitionNode.GetConnectedInputNode<FlowToolsNode>(2);

    if (pSyncEventOffsetOverrideNode !== null) {
      pDefinition!.m_syncEventOffsetOverrideNodeIdx = pSyncEventOffsetOverrideNode.Compile(context);
      if (pDefinition!.m_syncEventOffsetOverrideNodeIdx === InvalidIndex) {
        return InvalidIndex;
      }
    }

    const pStartBoneMaskNode = pTransitionNode.GetConnectedInputNode<FlowToolsNode>(3);

    if (pStartBoneMaskNode !== null) {
      pDefinition!.m_startBoneMaskNodeIdx = pStartBoneMaskNode.Compile(context);
      if (pDefinition!.m_startBoneMaskNodeIdx === InvalidIndex) {
        return InvalidIndex;
      }

      if (pTransitionNode.m_boneMaskBlendInTimePercentage <= 0.0) {
        context.LogError('Bone mask blend time needs to be greater than zero!');

        return InvalidIndex;
      }
    }

    const pTargetSyncIDNode = pTransitionNode.GetConnectedInputNode<FlowToolsNode>(4);

    if (pTargetSyncIDNode !== null) {
      if (pTransitionNode.m_timeMatchMode >= TimeMatchMode.MatchSyncEventID &&
                pTransitionNode.m_timeMatchMode <= TimeMatchMode.MatchClosestSyncEventIDAndPercentage) {
        pDefinition!.m_targetSyncIDNodeIdx = pTargetSyncIDNode.Compile(context);
        if (pDefinition!.m_targetSyncIDNodeIdx === InvalidIndex) {
          return InvalidIndex;
        }
      } else {
        context.LogWarning(
          'Target Sync Event ID set but we are not in a sync event ID time match mode - The supplied ID will be ignored!'
        );
      }
    }

    //-------------------------------------------------------------------------

    pDefinition!.m_targetStateNodeIdx = targetStateNodeIdx;
    pDefinition!.m_blendWeightEasingOp = pTransitionNode.m_blendWeightEasing;
    pDefinition!.m_rootMotionBlend = pTransitionNode.m_rootMotionBlend;
    pDefinition!.m_duration = Math.max(pTransitionNode.m_duration.ToFloat(), 0.0);
    pDefinition!.m_syncEventOffset = pTransitionNode.m_syncEventOffset;
    pDefinition!.m_boneMaskBlendInTimePercentage = pTransitionNode.m_boneMaskBlendInTimePercentage.GetClamped(false);

    //-------------------------------------------------------------------------

    pDefinition!.m_transitionOptions.ClearAllFlags();
    pDefinition!.m_transitionOptions.SetFlag(
      TransitionNode.TransitionOptions.ClampDuration,
      pTransitionNode.m_clampDurationToSource
    );

    switch (pTransitionNode.m_timeMatchMode) {
      case TimeMatchMode.None:
        break; case TimeMatchMode.Synchronized:
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.Synchronized,
          true
        );

        break; case TimeMatchMode.MatchSourceSyncEventIndex:
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSourceTime,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSyncEventIndex,
          true
        );

        break; case TimeMatchMode.MatchSourceSyncEventPercentage:
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSourceTime,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSyncEventPercentage,
          true
        );

        break; case TimeMatchMode.MatchSourceSyncEventIndexAndPercentage:
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSourceTime,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSyncEventIndex,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSyncEventPercentage,
          true
        );

        break; case TimeMatchMode.MatchSyncEventID:
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSourceTime,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSyncEventID,
          true
        );

        break; case TimeMatchMode.MatchSyncEventIDAndPercentage:
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSourceTime,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSyncEventID,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSyncEventPercentage,
          true
        );

        break; case TimeMatchMode.MatchClosestSyncEventID:
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSourceTime,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSyncEventID,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.PreferClosestSyncEventID,
          true
        );

        break; case TimeMatchMode.MatchClosestSyncEventIDAndPercentage:
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSourceTime,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSyncEventID,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.MatchSyncEventPercentage,
          true
        );
        pDefinition!.m_transitionOptions.SetFlag(
          TransitionNode.TransitionOptions.PreferClosestSyncEventID,
          true
        );

        break;
    }

    //-------------------------------------------------------------------------

    return pDefinition!.m_nodeIdx;
  }

  protected override PostDeserialize (): void {
    super.PostDeserialize();
    this.GetEntryStateOverrideConduit().UpdateConditionsNode();
    this.GetGlobalTransitionConduit().UpdateTransitionNodes();
  }
}