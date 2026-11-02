import { math } from '@galacean/effects';
import { registerStateMachineNodeType } from '../state-machine-node-registry';
/* eslint-disable no-console */
import type { spec } from '@galacean/effects';
import { InvalidIndex } from '@galacean/effects';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { UUID } from '../../../../ui/graph-editor/index';
import * as NodeGraph from '../../../../ui/graph-editor/index';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import { AnimationStateGraph, EntryStateOverrideConduitEditorNode, GlobalTransitionConduitEditorNode } from '../graphs/state-machine-graph';
import { AnimationGraphNode, GraphType, GraphValueType } from './flow-editor-node';
import { ResultEditorNode } from './result-editor-node';
import { StateEditorNode } from './state-editor-node';
import { TransitionConduitEditorNode, TransitionEditorNode } from './transition-editor-node';

export class StateMachineEditorNode extends AnimationGraphNode {
  constructor () {
    super();
    this.CreateOutputPin('Pose', GraphValueType.Pose);
    this.m_name = 'SM';

    const pStateMachineGraph = this.CreateChildGraph<AnimationStateGraph>(AnimationStateGraph);

    pStateMachineGraph.CreateNode(EntryStateOverrideConduitEditorNode);
    pStateMachineGraph.CreateNode(GlobalTransitionConduitEditorNode);

    const pDefaultStateNode = pStateMachineGraph.CreateNode(StateEditorNode);

    pDefaultStateNode.SetPosition(new math.Vector2(0, 150));
    pStateMachineGraph.SetDefaultEntryState(pDefaultStateNode.GetID());

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

  override GetTitleBarColor (): math.Color {
    return GraphColors.DarkOrange.clone();
  }

  GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true]]);
  }

  override OnShowNode (): void {
    super.OnShowNode();
    this.GetEntryStateOverrideConduit().UpdateConditionsNode();
    this.GetGlobalTransitionConduit().UpdateTransitionNodes();
  }

  private GetEntryStateOverrideConduit (): EntryStateOverrideConduitEditorNode {
    const pStateMachineGraph = this.GetChildGraph() as AnimationStateGraph;
    const foundNodes = pStateMachineGraph.FindAllNodesOfType<EntryStateOverrideConduitEditorNode>(
      EntryStateOverrideConduitEditorNode,
      [],
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Exact
    );

    console.assert(foundNodes.length === 1);

    return foundNodes[0];
  }

  private GetGlobalTransitionConduit (): GlobalTransitionConduitEditorNode {
    const pStateMachineGraph = this.GetChildGraph() as AnimationStateGraph;
    const foundNodes = pStateMachineGraph.FindAllNodesOfType<GlobalTransitionConduitEditorNode>(
      GlobalTransitionConduitEditorNode,
      [],
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Exact
    );

    console.assert(foundNodes.length === 1);

    return foundNodes[0];
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.StateMachineNodeData>(this);

    if (context.checkNodeCompilationState(pDefinition)) {
      return pDefinition.index;
    }

    pDefinition.stateDatas = [];
    pDefinition.defaultStateIndex = InvalidIndex;

    const pStateMachineGraph = this.GetChildGraph() as AnimationStateGraph;
    const stateNodes = pStateMachineGraph.FindAllNodesOfType<StateEditorNode>(
      StateEditorNode,
      [],
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Derived
    );
    const numStateNodes = stateNodes.length;

    console.assert(numStateNodes >= 1);

    const conduitNodes = pStateMachineGraph.FindAllNodesOfType<TransitionConduitEditorNode>(TransitionConduitEditorNode);
    const numConduitNodes = conduitNodes.length;

    this.GetEntryStateOverrideConduit();

    const IDToStateIdxMap = new Map<UUID, number>();
    const IDToCompiledNodeIdxMap = new Map<UUID, number>();

    for (let i = 0; i < numStateNodes; i++) {
      const pStateNode = stateNodes[i];

      const stateDefinition = {
        stateNodeIndex: InvalidIndex,
        transitionDatas: [],
      };

      pDefinition.stateDatas.push(stateDefinition);

      stateDefinition.stateNodeIndex = this.CompileState(context, pStateNode);
      if (stateDefinition.stateNodeIndex === InvalidIndex) {
        return InvalidIndex;
      }

      IDToStateIdxMap.set(pStateNode.GetID(), i);
      IDToCompiledNodeIdxMap.set(pStateNode.GetID(), stateDefinition.stateNodeIndex);
    }

    for (let i = 0; i < numStateNodes; i++) {
      const pStartStateNode = stateNodes[i];

      const TryCompileTransition = (pTransitionNode: TransitionEditorNode, endStateID: UUID): boolean => {
        const pConditionNode = pTransitionNode.GetConnectedInputNode<AnimationGraphNode>(0);

        if (pConditionNode !== null) {
          const transitionDefinition: spec.TransitionData = {
            targetStateIndex: InvalidIndex,
            conditionNodeIndex: InvalidIndex,
            transitionNodeIndex: InvalidIndex,
          };

          pDefinition.stateDatas[i].transitionDatas.push(transitionDefinition);

          transitionDefinition.targetStateIndex = IDToStateIdxMap.get(endStateID)!;

          transitionDefinition.transitionNodeIndex = this.CompileTransition(
            context,
            pTransitionNode,
            IDToCompiledNodeIdxMap.get(endStateID)!
          );
          if (transitionDefinition.transitionNodeIndex === InvalidIndex) {
            return false;
          }

          const pCompiledTransitionDefinition = context.getGraphNodeAssetData<spec.TransitionNodeData>(pTransitionNode);

          console.assert(context.checkNodeCompilationState(pCompiledTransitionDefinition));

          context.BeginTransitionConditionsCompilation(
            pCompiledTransitionDefinition.duration,
            InvalidIndex
          );
          transitionDefinition.conditionNodeIndex = pConditionNode.Compile(context);
          if (transitionDefinition.conditionNodeIndex === InvalidIndex) {
            return false;
          }
          context.EndTransitionConditionsCompilation();
        }

        return true;
      };

      for (let c = 0; c < numConduitNodes; c++) {
        const pConduit = conduitNodes[c];

        if (pConduit.GetStartStateID() !== pStartStateNode.GetID()) {
          continue;
        }

        const foundSourceStateIter = IDToCompiledNodeIdxMap.get(pConduit.GetStartStateID());

        console.assert(foundSourceStateIter !== undefined);
        context.BeginConduitCompilation(foundSourceStateIter!);

        const transitionNodes = pConduit.GetSecondaryGraph()!.FindAllNodesOfType<TransitionEditorNode>(TransitionEditorNode);

        for (const pTransitionNode of transitionNodes) {
          if (!TryCompileTransition(pTransitionNode, pConduit.GetEndStateID())) {
            return InvalidIndex;
          }
        }

        context.EndConduitCompilation();
      }

    }

    pDefinition.defaultStateIndex = IDToStateIdxMap.get(pStateMachineGraph.GetDefaultEntryStateID())!;

    return pDefinition.index;
  }

  private CompileState (context: AnimationGraphCompilationContext, pStateNode: StateEditorNode): number {
    console.assert(pStateNode !== null);

    const pDefinition = context.getGraphNodeAssetData<spec.StateNodeData>(pStateNode);

    console.assert(!context.checkNodeCompilationState(pDefinition));

    pDefinition.childNodeIndex = InvalidIndex;

    if (pStateNode.IsOffState()) {
      pDefinition.childNodeIndex = InvalidIndex;
    } else {

      const resultNodes = pStateNode.GetChildGraph()!.FindAllNodesOfType<ResultEditorNode>(
        ResultEditorNode,
        [],
        NodeGraph.SearchMode.Localized,
        NodeGraph.SearchTypeMatch.Derived
      );

      console.assert(resultNodes.length === 1);
      const pBlendTreeRoot = resultNodes[0];

      console.assert(pBlendTreeRoot !== null);

      const pBlendTreeNode = pBlendTreeRoot.GetConnectedInputNode<AnimationGraphNode>(0);

      if (pBlendTreeNode !== null) {
        pDefinition.childNodeIndex = pBlendTreeNode.Compile(context);
        if (pDefinition.childNodeIndex === InvalidIndex) {
          return InvalidIndex;
        }
      }

    }

    return pDefinition.index;
  }

  private CompileTransition (
    context: AnimationGraphCompilationContext,
    pTransitionNode: TransitionEditorNode,
    targetStateNodeIdx: number
  ): number {
    console.assert(pTransitionNode !== null);
    const pDefinition = context.getGraphNodeAssetData<spec.TransitionNodeData>(pTransitionNode);

    if (context.checkNodeCompilationState(pDefinition)) {
      return pDefinition.index;
    }

    pDefinition.targetStateNodeIndex = targetStateNodeIdx;
    pDefinition.duration = Math.max(pTransitionNode.m_duration, 0.0);
    pDefinition.hasExitTime = pTransitionNode.hasExitTime;
    pDefinition.exitTime = pTransitionNode.exitTime;

    return pDefinition.index;
  }

  protected override PostDeserialize (): void {
    super.PostDeserialize();
    this.GetEntryStateOverrideConduit().UpdateConditionsNode();
    this.GetGlobalTransitionConduit().UpdateTransitionNodes();
  }
}
registerStateMachineNodeType(StateMachineEditorNode);
