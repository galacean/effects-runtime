import type { math } from '@galacean/effects';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { GraphViewGeometry } from '../../../../ui/graph-editor/graph-view-geometry';
import type { GraphEditorContext } from '../../../../ui/graph-editor/graph-editor-context';
import type { GraphModel } from '../../../../ui/graph-editor/graph-model';
import { SearchMode, SearchTypeMatch } from '../../../../ui/graph-editor/graph-model';
import * as NodeGraph from '../../../../ui/graph-editor/index';
import type { AnimationGraphContext } from '../animation-graph-context';
import { AnimationFlowGraph } from '../graphs/flow-graph';
import { getStateMachineNodeType } from '../state-machine-node-registry';
import { GraphType } from './flow-editor-node';
import { PoseResultEditorNode, ResultEditorNode } from './result-editor-node';
import type { StateMachineEditorNode } from './state-machine-editor-node';

const InvalidIndex = -1;

interface TimedStateEvent {
  m_ID: string,
  m_timeValue: number,
}

enum StateType {
  OffState,
  BlendTreeState,
  StateMachineState
}

export class StateEditorNode extends NodeGraph.StateGraphNode {
  static readonly S_MINIMUM_STATE_NODE_UNSCALED_WIDTH: number = 30;
  static readonly S_MINIMUM_STATE_NODE_UNSCALED_HEIGHT: number = 30;

  private m_type: StateType = StateType.BlendTreeState;
  private m_events: string[] = [];
  private m_entryEvents: string[] = [];
  private m_executeEvents: string[] = [];
  private m_exitEvents: string[] = [];
  private m_timeRemainingEvents: TimedStateEvent[] = [];
  private m_timeElapsedEvents: TimedStateEvent[] = [];

  constructor ();
  constructor (type: StateType);
  constructor (type?: StateType) {
    super();
    if (type !== undefined) {
      this.m_type = type;
      if (this.m_type === StateType.OffState) {
        this.m_name = 'Off';
      }
    }
    this.SharedConstructor();
  }

  override IsRenameable (): boolean { return true; }
  override RequiresUniqueName (): boolean { return true; }

  IsOffState (): boolean { return this.m_type === StateType.OffState; }
  IsBlendTreeState (): boolean { return this.m_type === StateType.BlendTreeState; }
  IsStateMachineState (): boolean { return this.m_type === StateType.StateMachineState; }

  GetLogicAndEventIDs (outIDs: string[]): void {
    outIDs.push(...this.m_events, ...this.m_entryEvents, ...this.m_executeEvents, ...this.m_exitEvents);
    this.m_timeRemainingEvents.forEach(evt => outIDs.push(evt.m_ID));
    this.m_timeElapsedEvents.forEach(evt => outIDs.push(evt.m_ID));
  }

  RenameLogicAndEventIDs (oldID: string, newID: string): void {
    const renameInArray = (arr: string[]) => {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === oldID) {
          arr[i] = newID;
        }
      }
    };

    renameInArray(this.m_events);
    renameInArray(this.m_entryEvents);
    renameInArray(this.m_executeEvents);
    renameInArray(this.m_exitEvents);

    const renameInTimedEvents = (arr: TimedStateEvent[]) => {
      for (const evt of arr) {
        if (evt.m_ID === oldID) {
          evt.m_ID = newID;
        }
      }
    };

    renameInTimedEvents(this.m_timeRemainingEvents);
    renameInTimedEvents(this.m_timeElapsedEvents);
  }

  override GetTypeName (): string { return 'State'; }

  override GetTitleBarColor (): math.Color {
    switch (this.m_type) {
      case StateType.OffState: return GraphColors.DarkRed.clone();
      case StateType.BlendTreeState: return GraphColors.MediumSlateBlue.clone();
      case StateType.StateMachineState: return GraphColors.DarkCyan.clone();
      default: return super.GetTitleBarColor();
    }
  }

  override GetNavigationTarget (): GraphModel | null {
    let pTargetGraph: GraphModel | null = this.GetChildGraph();

    if (this.IsStateMachineState()) {
      const stateMachineNodes: StateMachineEditorNode[] = [];

      this.GetChildGraph()!.FindAllNodesOfType(
        getStateMachineNodeType(),
        stateMachineNodes,
        SearchMode.Localized,
        SearchTypeMatch.Derived
      );

      if (stateMachineNodes.length === 1) {
        pTargetGraph = stateMachineNodes[0].GetChildGraph();
      }
    }

    return pTargetGraph;
  }

  override IsActive (pUserContext: GraphEditorContext): boolean {
    const pGraphNodeContext = pUserContext as AnimationGraphContext;

    if (pGraphNodeContext.HasDebugData()) {
      const runtimeNodeIdx = pGraphNodeContext.GetRuntimeGraphNodeIndex(this.GetID());

      if (runtimeNodeIdx !== InvalidIndex) {
        return pGraphNodeContext.IsNodeActive(runtimeNodeIdx);
      }
    }

    return false;
  }

  override OnShowNode (): void {
    super.OnShowNode();

    if (this.m_type === StateType.StateMachineState) {
      const childSMs = this.GetChildGraph()!.FindAllNodesOfType<StateMachineEditorNode>(getStateMachineNodeType(), [], SearchMode.Localized, SearchTypeMatch.Derived);

      if (childSMs.length !== 1) {
        throw new Error('Expected exactly one state machine node');
      }
      childSMs[0].OnShowNode();
    }
  }

  CanConvertToBlendTreeState (): boolean {
    return this.m_type === StateType.StateMachineState;
  }

  ConvertToBlendTreeState (): void {
    if (this.m_type !== StateType.StateMachineState) {
      throw new Error('Cannot convert non-state machine state to blend tree state');
    }
    this.BeginModification(); this.m_type = StateType.BlendTreeState; this.EndModification();
  }

  CanConvertToStateMachineState (): boolean {
    if (this.m_type !== StateType.BlendTreeState) {
      return false;
    }

    const childNodes = this.GetChildGraph()!.GetNodes();

    if (childNodes.length !== 2) {
      return false;
    }

    const resultNodes = this.GetChildGraph()!.FindAllNodesOfType<ResultEditorNode>(ResultEditorNode, [], SearchMode.Localized, SearchTypeMatch.Derived);

    if (resultNodes.length !== 1) {
      return false;
    }

    const pInputNode = resultNodes[0].GetConnectedInputNode(0);

    if (pInputNode === null || !(pInputNode instanceof getStateMachineNodeType())) {
      return false;
    }

    return true;
  }

  ConvertToStateMachineState (): void {
    if (!this.CanConvertToStateMachineState()) {
      throw new Error('Cannot convert to state machine state');
    }
    this.BeginModification(); this.m_type = StateType.StateMachineState; this.EndModification();
  }

  private SharedConstructor (): void {
    const pBlendTree = this.CreateChildGraph(AnimationFlowGraph, GraphType.BlendTree);

    pBlendTree.CreateNode<PoseResultEditorNode>(PoseResultEditorNode);

    if (this.m_type === StateType.StateMachineState) {
      const pStateMachineNode = pBlendTree.CreateNode<StateMachineEditorNode>(getStateMachineNodeType());

      const resultNodes = this.GetChildGraph()!.FindAllNodesOfType<ResultEditorNode>(ResultEditorNode, [], SearchMode.Localized, SearchTypeMatch.Derived);

      if (resultNodes.length !== 1) {
        throw new Error('Expected exactly one result node');
      }
      const pBlendTreeResultNode = resultNodes[0];

      pBlendTree.TryMakeConnection(pStateMachineNode, pStateMachineNode.GetOutputPin(0)!, pBlendTreeResultNode, pBlendTreeResultNode.GetInputPin(0)!);
    }
  }
}
