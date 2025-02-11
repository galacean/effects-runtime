import type { TransitionNode } from '@galacean/effects';
import { InvalidIndex } from '@galacean/effects';
import { Color } from 'maoan-imgui-js';
import type { GraphCompilationContext } from '../../node-graph';
import { FlowGraph } from '../../visual-graph';
import { Colors } from '../colors';
import { ImGui } from '../../../../imgui/index';
import type { ToolsGraphUserContext } from '../tools-graph-user-context';
import { GraphValueType, GraphType } from './flow-tools-node';
import { ResultToolsNode } from './result-tools-node';
import * as NodeGraph from '../../visual-graph';

// 时间匹配模式枚举
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
export class TransitionToolsNode extends ResultToolsNode {
  //   m_blendWeightEasing: Math.Easing.Operation = Math.Easing.Operation.Linear;
  //   m_rootMotionBlend: RootMotionBlendMode = RootMotionBlendMode.Blend;
  m_duration = 0.2;
  m_clampDurationToSource: boolean = false;
  m_canBeForced: boolean = false;
  m_timeMatchMode: TimeMatchMode = TimeMatchMode.None;
  m_syncEventOffset: number = 0.0;
  m_boneMaskBlendInTimePercentage = 0.33;

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

  override DrawInfoText (ctx: NodeGraph.DrawContext): void {
    this.BeginDrawInternalRegion(ctx);

    // switch (this.m_rootMotionBlend) {
    //   case RootMotionBlendMode.Blend:
    //     ImGui.Text('Blend Root Motion');

    //     break;
    //   case RootMotionBlendMode.Additive:
    //     ImGui.Text('Blend Root Motion (Additive)');

    //     break;
    //   case RootMotionBlendMode.IgnoreSource:
    //     ImGui.Text('Ignore Source Root Motion');

    //     break;
    //   case RootMotionBlendMode.IgnoreTarget:
    //     ImGui.Text('Ignore Target Root Motion');

    //     break;
    // }

    ImGui.Text(`Duration: ${this.m_duration}s`);

    if (this.m_clampDurationToSource) {
      ImGui.Text('Clamped To Source');
    }

    switch (this.m_timeMatchMode) {
      case TimeMatchMode.None:
        break;
      case TimeMatchMode.Synchronized:
        ImGui.Text('Synchronized');

        break;
      case TimeMatchMode.MatchSourceSyncEventIndex:
        ImGui.Text('Match Sync Idx');

        break;
      case TimeMatchMode.MatchSourceSyncEventIndexAndPercentage:
        ImGui.Text('Match Sync Idx and %%');

        break;
      case TimeMatchMode.MatchSyncEventID:
        ImGui.Text('Match Sync ID');

        break;
      case TimeMatchMode.MatchSyncEventIDAndPercentage:
        ImGui.Text('Match Sync ID and %%');

        break;
      case TimeMatchMode.MatchClosestSyncEventID:
        ImGui.Text('Match Closest Sync ID');

        break;
      case TimeMatchMode.MatchClosestSyncEventIDAndPercentage:
        ImGui.Text('Match Closest Sync ID and %%');

        break;
      case TimeMatchMode.MatchSourceSyncEventPercentage:
        ImGui.Text('Match Sync %% Only');

        break;
    }

    ImGui.Text(`Sync Offset: ${this.m_syncEventOffset}`);

    if (this.m_canBeForced) {
      ImGui.Text('Forced');
    }

    this.EndDrawInternalRegion(ctx);
  }

  override GetTitleBarColor (): Color {
    return this.m_canBeForced ? new Color(Colors.Salmon) : super.GetTitleBarColor();
  }

  override Compile (context: GraphCompilationContext): number {
    return InvalidIndex;
  }
}

export class TransitionConduitToolsNode extends NodeGraph.TransitionConduitNode {
  private isAnyChildActive: boolean = false;

  constructor (pStartState: NodeGraph.StateNode, pEndState: NodeGraph.StateNode) {
    super(pStartState, pEndState);
    this.CreateSecondaryGraph<FlowGraph>(FlowGraph, GraphType.TransitionConduit);
  }

  override HasTransitions (): boolean {
    return !(this.GetSecondaryGraph()!.FindAllNodesOfType<TransitionToolsNode>(TransitionToolsNode).length === 0);
  }

  override GetTypeName (): string {
    return 'Transition';
  }

  override GetConduitColor (
    ctx: NodeGraph.DrawContext,
    pUserContext: NodeGraph.UserContext,
    visualState: Map<NodeGraph.NodeVisualState, boolean>
  ): Color {
    if (visualState.size === 0 && !this.HasTransitions()) {
      return NodeGraph.Style.s_connectionColorInvalid;
    }

    const pGraphNodeContext = pUserContext as ToolsGraphUserContext;

    if (pGraphNodeContext.HasDebugData() && this.isAnyChildActive) {
      return NodeGraph.Style.s_connectionColorValid;
    }

    return super.GetConduitColor(ctx, pUserContext, visualState);
  }

  override PreDrawUpdate (pUserContext: NodeGraph.UserContext): void {
    this.isAnyChildActive = false;
    this.m_transitionProgress = 0.0;

    const pGraphNodeContext = pUserContext as ToolsGraphUserContext;
    const isPreviewing = pGraphNodeContext.HasDebugData();

    if (isPreviewing) {
      const childTransitions = this.GetSecondaryGraph()!.FindAllNodesOfType<TransitionToolsNode>(TransitionToolsNode);

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