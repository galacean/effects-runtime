import type { math } from '@galacean/effects';
import type { TransitionNode } from '@galacean/effects';
import { InvalidIndex } from '@galacean/effects';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import * as NodeGraph from '../../../../ui/graph-editor/index';
import { AnimationFlowGraph } from '../graphs/flow-graph';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import type { AnimationGraphContext } from '../animation-graph-context';
import { GraphType, GraphValueType } from './flow-editor-node';
import { ResultEditorNode } from './result-editor-node';

export enum TimeMatchMode {
  None,
  Synchronized,
  MatchSourceSyncEventIndex,
  MatchSourceSyncEventPercentage,
  MatchSourceSyncEventIndexAndPercentage,
  MatchSyncEventID,
  MatchClosestSyncEventID,
  MatchSyncEventIDAndPercentage,
  MatchClosestSyncEventIDAndPercentage,
}
export class TransitionEditorNode extends ResultEditorNode {
  m_duration = 0.2;
  m_clampDurationToSource: boolean = false;
  m_canBeForced: boolean = false;
  m_timeMatchMode: TimeMatchMode = TimeMatchMode.None;
  m_syncEventOffset: number = 0.0;
  m_boneMaskBlendInTimePercentage = 0.33;

  hasExitTime = false;
  exitTime = 0.75;

  constructor () {
    super();
    this.CreateInputPin('Condition', GraphValueType.Bool);
    this.CreateInputPin('Duration Override', GraphValueType.Float);
    this.CreateInputPin('Sync Event Override', GraphValueType.Float);
    this.CreateInputPin('Start Bone Mask', GraphValueType.BoneMask);
    this.CreateInputPin('Target Sync ID', GraphValueType.ID);
  }

  override IsRenameable (): boolean { return true; }
  override RequiresUniqueName (): boolean { return true; }
  override GetTypeName (): string { return 'Transition'; }
  override GetCategory (): string { return 'Transitions'; }
  override IsUserCreatable (): boolean { return true; }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.TransitionConduit, true]]);
  }

  override GetTitleBarColor (): math.Color {
    return this.m_canBeForced ? GraphColors.Salmon.clone() : super.GetTitleBarColor();
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    return InvalidIndex;
  }
}

export class TransitionConduitEditorNode extends NodeGraph.TransitionGraphNode {
  private isAnyChildActive: boolean = false;

  constructor (pStartState: NodeGraph.StateGraphNode, pEndState: NodeGraph.StateGraphNode) {
    super(pStartState, pEndState);
    this.CreateSecondaryGraph(AnimationFlowGraph, GraphType.TransitionConduit);
  }

  override GetNavigationTarget (): NodeGraph.GraphModel | null {
    return this.GetSecondaryGraph();
  }

  override HasTransitions (): boolean {
    return !(this.GetSecondaryGraph()!.FindAllNodesOfType<TransitionEditorNode>(TransitionEditorNode).length === 0);
  }

  override GetTypeName (): string {
    return 'Transition';
  }

  override GetConduitColor (
    ctx: NodeGraph.GraphViewGeometry,
    pUserContext: NodeGraph.GraphEditorContext,
    visualState: Map<NodeGraph.NodeVisualState, boolean>
  ): math.Color {
    if (visualState.size === 0 && !this.HasTransitions()) {
      return NodeGraph.GraphStyle.s_connectionColorInvalid;
    }

    const pGraphNodeContext = pUserContext as AnimationGraphContext;

    if (pGraphNodeContext.HasDebugData() && this.isAnyChildActive) {
      return NodeGraph.GraphStyle.s_connectionColorValid;
    }

    return super.GetConduitColor(ctx, pUserContext, visualState);
  }

  override updateDebugState (pUserContext: NodeGraph.GraphEditorContext): void {
    this.isAnyChildActive = false;
    this.m_transitionProgress = 0.0;

    const pGraphNodeContext = pUserContext as AnimationGraphContext;
    const isPreviewing = pGraphNodeContext.HasDebugData();

    if (isPreviewing) {
      const childTransitions = this.GetSecondaryGraph()!.FindAllNodesOfType<TransitionEditorNode>(TransitionEditorNode);

      for (const pTransition of childTransitions) {
        const runtimeNodeIdx = pGraphNodeContext.GetRuntimeGraphNodeIndex(pTransition.GetID());

        if (runtimeNodeIdx != InvalidIndex && pGraphNodeContext.IsNodeActive(runtimeNodeIdx)) {
          let progress = 0.0;
          const pTransitionNode = pGraphNodeContext.GetNodeDebugInstance(runtimeNodeIdx) as TransitionNode;

          if (pTransitionNode.isInitialized()) {
            progress = pTransitionNode.getProgressPercentage();
          }

          this.m_transitionProgress = Math.max(progress, 0.001);
          this.isAnyChildActive = true;

          break;
        }
      }
    }
  }
}
