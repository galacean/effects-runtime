import { ImGui } from '../../../../platform/imgui/index';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { DrawContext } from '../../../../ui/graph-editor/graph-draw-context';
import type { GraphEditorContext } from '../../../../ui/graph-editor/graph-editor-context';
import type { GraphModel } from '../../../../ui/graph-editor/graph-model';
import { SearchMode, SearchTypeMatch } from '../../../../ui/graph-editor/graph-model';
import * as NodeGraph from '../../../../ui/graph-editor/index';
import { beginEditorMenu, editorMenuItem, endEditorMenu } from '../../../../ui/widgets/editor-menu';
import type { AnimationGraphContext } from '../animation-graph-context';
import { AnimationFlowGraph } from '../graphs/flow-graph';
import { getStateMachineNodeType } from '../state-machine-node-registry';
import { DrawPoseNodeDebugInfo, GraphType } from './flow-editor-node';
import { PoseResultEditorNode, ResultEditorNode } from './result-editor-node';
import type { StateMachineEditorNode } from './state-machine-editor-node';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

type Color = ImGui.Color;
const Color = ImGui.Color;

const InvalidIndex = -1;

// StateLayerDataToolsNode 类
// export class StateLayerDataToolsNode extends ResultToolsNode {
//   constructor () {
//     super();
//     this.CreateInputPin('Layer Weight', GraphValueType.Float);
//     this.CreateInputPin('Root Motion Weight', GraphValueType.Float);
//     this.CreateInputPin('Layer Mask', GraphValueType.BoneMask);
//   }

//   GetTypeName (): string { return 'State Layer Data'; }
//   GetCategory (): string { return 'State Machine'; }
//   IsUserCreatable (): boolean { return false; }
//   GetAllowedParentGraphTypes (): GraphType { return GraphType.ValueTree; }
//   Compile (context: GraphCompilationContext): number {
//     throw new Error('Unreachable code');

//     return InvalidIndex;
//   }
// }

// TimedStateEvent 接口
interface TimedStateEvent {
  m_ID: string,
  m_timeValue: number,
}

// StateType 枚举
enum StateType {
  OffState,
  BlendTreeState,
  StateMachineState
}

// StateToolsNode 类
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

  override GetTitleBarColor (): Color {
    switch (this.m_type) {
      case StateType.OffState: return new Color(GraphColors.DarkRed);
      case StateType.BlendTreeState: return new Color(GraphColors.MediumSlateBlue);
      case StateType.StateMachineState: return new Color(GraphColors.DarkCyan);
      default: return super.GetTitleBarColor();
    }
  }

  override DrawContextMenuOptions (ctx: DrawContext, pUserContext: GraphEditorContext, mouseCanvasPos: ImVec2): void {
    if (this.m_type === StateType.BlendTreeState && this.CanConvertToStateMachineState()) {
      if (editorMenuItem('Convert To State Machine State')) {
        this.ConvertToStateMachineState();
      }
    }

    if (this.m_type === StateType.StateMachineState && this.CanConvertToBlendTreeState()) {
      if (editorMenuItem('Convert to Blend Tree State')) {
        this.ConvertToBlendTreeState();
      }
    }

    if (beginEditorMenu('Node Info')) {
      const IDStr = this.GetID().toString();
      let label = `UUID: ${IDStr}`;

      if (editorMenuItem(label)) {
        ImGui.SetClipboardText(IDStr);
      }

      const pGraphNodeContext = pUserContext as AnimationGraphContext;

      if (pGraphNodeContext.HasDebugData()) {
        const runtimeNodeIdx = pGraphNodeContext.GetRuntimeGraphNodeIndex(this.GetID());

        if (runtimeNodeIdx !== -1) {
          label = `Runtime Index: ${runtimeNodeIdx}`;
          if (editorMenuItem(label)) {
            ImGui.SetClipboardText(runtimeNodeIdx.toString());
          }
        }
      }

      endEditorMenu();
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

  override DrawExtraControls (ctx: DrawContext, pUserContext: GraphEditorContext): void {
    const scaledVerticalGap = 6.0 * ctx.m_viewScaleFactor;

    const DrawStateTypeWindow = (ctx: DrawContext, iconColor: Color, fontColor: Color, width: number, pIcon: string, pLabel: string) => {
      this.BeginDrawInternalRegion(ctx);

      {
        // ImGuiX.ScopedFont(ImGuiX.Font.Small, iconColor);
        // ImGui.Text(pIcon);
      }

      {
        // ImGuiX.ScopedFont(ImGuiX.Font.Small, fontColor);
        // ImGui.SameLine();
        ImGui.TextColored(fontColor, pLabel);
      }

      this.EndDrawInternalRegion(ctx);
    };

    switch (this.m_type) {
      case StateType.OffState:
        DrawStateTypeWindow(ctx, new Color(GraphColors.Red), new Color(GraphColors.White), this.GetWidth(), 'EE_ICON_CLOSE_CIRCLE', ' Off State');

        break;
      case StateType.BlendTreeState:
        DrawStateTypeWindow(ctx, new Color(GraphColors.MediumPurple), new Color(GraphColors.White), this.GetWidth(), 'EE_ICON_FILE_TREE', ' Blend Tree');

        break;
      case StateType.StateMachineState:
        DrawStateTypeWindow(ctx, new Color(GraphColors.Turquoise), new Color(GraphColors.White), this.GetWidth(), 'EE_ICON_STATE_MACHINE', ' State Machine');

        break;
    }

    let string = '';
    const CreateEventString = (stateIDs: string[], specificIDs: string[]) => {
      const finalIDs: string[] = [...stateIDs];

      for (const specificID of specificIDs) {
        if (!finalIDs.some(id => id === specificID)) {
          finalIDs.push(specificID);
        }
      }

      string = finalIDs.filter(id => id !== '').map(id => id.toString()).join(', ');
    };

    const CreateTimedEventString = (events: TimedStateEvent[]) => {
      string = events.filter(evt => evt.m_ID !== '')
        .map(evt => `${evt.m_ID.toString()} (${evt.m_timeValue.toFixed(2)}s)`)
        .join(', ');
    };

    let hasStateEvents = false;

    {
      // ImGuiX.ScopedFont(ImGuiX.Font.Medium);

      if (this.m_entryEvents.length > 0 || this.m_events.length > 0) {
        CreateEventString(this.m_events, this.m_entryEvents);
        // ImGuiX.ScopedFont(ImGuiX.Font.MediumBold, Colors.Green);
        ImGui.Text('Entry:');
        ImGui.SameLine();
        ImGui.Text(string);
        hasStateEvents = true;
      }

      if (this.m_executeEvents.length > 0 || this.m_events.length > 0) {
        CreateEventString(this.m_events, this.m_executeEvents);
        // ImGuiX.ScopedFont(ImGuiX.Font.MediumBold, Colors.Gold);
        ImGui.Text('Execute:');
        ImGui.SameLine();
        ImGui.Text(string);
        hasStateEvents = true;
      }

      if (this.m_exitEvents.length > 0 || this.m_events.length > 0) {
        CreateEventString(this.m_events, this.m_exitEvents);
        // ImGuiX.ScopedFont(ImGuiX.Font.MediumBold, Colors.Tomato);
        ImGui.Text('Exit:');
        ImGui.SameLine();
        ImGui.Text(string);
        hasStateEvents = true;
      }

      if (this.m_timeRemainingEvents.length > 0) {
        CreateTimedEventString(this.m_timeRemainingEvents);
        // ImGuiX.ScopedFont(ImGuiX.Font.MediumBold);
        ImGui.Text(`Time Left: ${string}`);
        hasStateEvents = true;
      }

      if (this.m_timeElapsedEvents.length > 0) {
        CreateTimedEventString(this.m_timeElapsedEvents);
        // ImGuiX.ScopedFont(ImGuiX.Font.MediumBold);
        ImGui.Text(`Time Elapsed: ${string}`);
        hasStateEvents = true;
      }

      if (!hasStateEvents) {
        ImGui.Text('No State Events');
      }
    }

    ImGui.SetCursorPosY(ImGui.GetCursorPosY() + scaledVerticalGap);

    let shouldDrawEmptyDebugInfoBlock = true;
    const pGraphNodeContext = pUserContext as AnimationGraphContext;

    if (pGraphNodeContext.HasDebugData()) {
      const runtimeNodeIdx = pGraphNodeContext.GetRuntimeGraphNodeIndex(this.GetID());

      if (runtimeNodeIdx !== InvalidIndex && pGraphNodeContext.IsNodeActive(runtimeNodeIdx)) {
        const debugInfo = pGraphNodeContext.GetPoseNodeDebugInfo(runtimeNodeIdx);

        DrawPoseNodeDebugInfo(ctx, this.GetWidth(), debugInfo);
        shouldDrawEmptyDebugInfoBlock = false;
      }

      if (pGraphNodeContext.m_showRuntimeIndices && runtimeNodeIdx !== InvalidIndex) {
        // this.DrawRuntimeNodeIndex(ctx, pGraphNodeContext, this, runtimeNodeIdx);
      }
    }

    if (shouldDrawEmptyDebugInfoBlock) {
      DrawPoseNodeDebugInfo(ctx, this.GetWidth(), null);
    }

    ImGui.SetCursorPosY(ImGui.GetCursorPosY() + scaledVerticalGap);
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

  private CanConvertToBlendTreeState (): boolean {
    return this.m_type === StateType.StateMachineState;
  }

  private ConvertToBlendTreeState (): void {
    if (this.m_type !== StateType.StateMachineState) {
      throw new Error('Cannot convert non-state machine state to blend tree state');
    }
    this.m_type = StateType.BlendTreeState;
  }

  private CanConvertToStateMachineState (): boolean {
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

  private ConvertToStateMachineState (): void {
    if (!this.CanConvertToStateMachineState()) {
      throw new Error('Cannot convert to state machine state');
    }
    this.m_type = StateType.StateMachineState;
  }

  private SharedConstructor (): void {
    const pBlendTree = this.CreateChildGraph(AnimationFlowGraph, GraphType.BlendTree);

    pBlendTree.CreateNode<PoseResultEditorNode>(PoseResultEditorNode);

    // const pValueTree = this.CreateSecondaryGraph(NodeGraph.FlowGraph, GraphType.ValueTree);

    // pValueTree.CreateNode<StateLayerDataToolsNode>(StateLayerDataToolsNode);

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