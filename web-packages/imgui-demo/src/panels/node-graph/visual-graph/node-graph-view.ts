import { ImRect, ImVec2 } from './im-rect';
import { DrawChannel, DrawContext } from './drawing-context';
import { add, colorMultiplyScalar, div, fmodf, length, lengthSqr, lerp, multiplyScalar, normalize, subtract } from '../bezier-math';
import type { UUID } from './state-machine-graph';
import { StateMachineGraph, StateMachineNode, StateNode, TransitionConduitNode } from './state-machine-graph';
import { ImGui } from '../../../imgui';
import * as ImGuiX from './imgui-x';
import { BaseNode, NodeVisualState, ScopedGraphModification } from './base-graph';
import { BaseGraph } from './base-graph';
import type { UserContext } from './user-context';
import { SelectedNode } from './user-context';
import { generateGUID } from '@galacean/effects';
import { CommentNode } from './comment-node';
import type { Pin } from './flow-graph';
import { PinDirection } from './flow-graph';
import { FlowGraph, FlowNode } from './flow-graph';
import { Colors } from '../tools-graph/colors';

type Color = ImGui.Color;
const Color = ImGui.Color;

const IM_COL32 = ImGui.IM_COL32;

export class Style {
  static readonly s_defaultTitleColor = new Color(0.373, 0.373, 0.373, 1);
  static readonly s_nodeBackgroundColor = new Color(0.208, 0.208, 0.208, 1);
  static readonly s_nodeSelectedBorderColor = new Color(0.784, 0.784, 0, 1);
  static readonly s_activeIndicatorBorderColor = new Color(0.196, 0.804, 0.196, 1);

  static readonly s_connectionColor = new Color(0.725, 0.725, 0.725, 1);
  static readonly s_connectionColorValid = new Color(0, 1, 0, 1);
  static readonly s_connectionColorInvalid = new Color(1, 0, 0, 1);
  static readonly s_connectionColorActive = new Color(0.196, 0.804, 0.196, 1);
  static readonly s_connectionColorHovered = new Color(1, 1, 1, 1);
  static readonly s_connectionColorSelected = new Color(1, 1, 0, 1);

  static readonly s_genericNodeSeparatorColor = new Color(0.392, 0.392, 0.392, 1);
  static readonly s_genericNodeInternalRegionDefaultColor = new Color(0.157, 0.157, 0.157, 1);

  static readonly s_activeBorderIndicatorThickness = 2;
  static readonly s_activeBorderIndicatorPadding = Style.s_activeBorderIndicatorThickness + 3;
}

const g_graphTitleMargin = new ImVec2(16, 10);
const g_gridSpacing = 30;
const g_nodeSelectionBorderThickness = 2.0;
const g_connectionSelectionExtraRadius = 5.0;
const g_transitionArrowWidth = 3.0;
const g_transitionArrowOffset = 8.0;
const g_titleBarColorItemWidth = 8.0;
const g_spacingBetweenTitleAndNodeContents = 6.0;
const g_pinRadius = 6.0;
const g_spacingBetweenInputOutputPins = 16.0;
const g_autoConnectMaxDistanceThreshold = 200.0;

const g_gridBackgroundColor = new Color(0.157, 0.157, 0.157, 0.784);
const g_gridLineColor = new Color(0.784, 0.784, 0.784, 0.157);
const g_graphTitleColor = new Color(1, 1, 1, 1);
const g_graphTitleReadOnlyColor = new Color(0.769, 0.769, 0.769, 1);
const g_selectionBoxOutlineColor = new Color(0.239, 0.878, 0.522, 0.588);
const g_selectionBoxFillColor = new Color(0.239, 0.878, 0.522, 0.118);
const g_readOnlyCanvasBorderColor = new Color(0.502, 0.502, 0.941, 1);

function GetConnectionPointsBetweenStateMachineNodes (startNodeRect: ImRect, endNodeRect: ImRect): [ImVec2, ImVec2] {
  let startPoint = startNodeRect.GetCenter();
  let endPoint = endNodeRect.GetCenter();
  const midPoint = add(startPoint, multiplyScalar(subtract(endPoint, startPoint), 0.5));

  startPoint = ImGuiX.GetClosestPointOnRectBorder(startNodeRect, midPoint);
  endPoint = ImGuiX.GetClosestPointOnRectBorder(endNodeRect, midPoint);

  return [startPoint, endPoint];
}

function IsHoveredOverCurve (p1: ImVec2, p2: ImVec2, p3: ImVec2, p4: ImVec2, mousePosition: ImVec2, hoverThreshold: number): boolean {
  const min = new ImVec2(Math.min(p1.x, p4.x), Math.min(p1.y, p4.y));
  const max = new ImVec2(Math.max(p1.x, p4.x), Math.max(p1.y, p4.y));

  const rect = new ImRect(min, max);

  rect.Add(p2);
  rect.Add(p3);
  rect.Expand(new ImVec2(hoverThreshold, hoverThreshold));

  if (rect.Contains(mousePosition)) {
    const closestPointToCurve = ImGuiX.ImBezierCubicClosestPointCasteljau(p1, p2, p3, p4, mousePosition, ImGui.GetStyle().CurveTessellationTol);

    if (length(subtract(closestPointToCurve, mousePosition)) < hoverThreshold) {
      return true;
    }
  }

  return false;
}

function GetNodeBackgroundAndBorderColors (titleBarColor: Color, baseColor: Color, visualState: Map<NodeVisualState, boolean>): [Color, Color, Color] {
  let outTitleBarColor: Color, outBackgroundColor: Color, outBorderColor: Color;

  if (visualState.get(NodeVisualState.Selected) && visualState.get(NodeVisualState.Hovered)) {
    outTitleBarColor = colorMultiplyScalar(titleBarColor, 1.6);
    outBackgroundColor = colorMultiplyScalar(baseColor, 1.6);
    const s_nodeSelectedBorderColor = Style.s_nodeSelectedBorderColor.Value;

    outBorderColor = colorMultiplyScalar(new Color(s_nodeSelectedBorderColor.x, s_nodeSelectedBorderColor.y, s_nodeSelectedBorderColor.z, s_nodeSelectedBorderColor.w), 1.5);
  } else if (visualState.get(NodeVisualState.Selected)) {
    outTitleBarColor = colorMultiplyScalar(titleBarColor, 1.45);
    outBackgroundColor = colorMultiplyScalar(baseColor, 1.45);
    outBorderColor = new Color(0, 0, 0, 0);
  } else if (visualState.get(NodeVisualState.Hovered)) {
    outTitleBarColor = colorMultiplyScalar(titleBarColor, 1.15);
    outBackgroundColor = colorMultiplyScalar(baseColor, 1.15);
    outBorderColor = new Color(0, 0, 0, 0);
  } else {
    outTitleBarColor = titleBarColor;
    outBackgroundColor = baseColor;
    outBorderColor = new Color(0, 0, 0, 0);
  }

  return [outTitleBarColor, outBackgroundColor, outBorderColor];
}

function clamp (value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

enum DragMode {
  None,
  View,
  Selection,
  Node,
  Connection,
  ResizeComment,
}

export enum ResizeHandle
  {
  None,
  N,
  NW,
  W,
  SW,
  S,
  SE,
  E,
  NE
}

// Drag state
//-------------------------------------------------------------------------

class DragState {
  m_mode: DragMode = DragMode.None;
  m_startValue: ImVec2 = new ImVec2(0, 0);
  m_lastFrameDragDelta: ImVec2 = new ImVec2(0, 0);
  m_pNode: BaseNode | null = null;
  m_pPin: Pin | null = null;
  m_draggedNodes: BaseNode[] = [];
  m_resizeHandle: ResizeHandle = ResizeHandle.None;
  m_dragReadyToStart: boolean = false;

  GetAsFlowNode (): FlowNode | null {
    return this.m_pNode instanceof FlowNode ? this.m_pNode : null;
  }

  GetAsStateMachineNode (): StateMachineNode | null {
    return this.m_pNode instanceof StateMachineNode ? this.m_pNode : null;
  }

  Reset (): void {
    Object.assign(this, new DragState());
  }
}

// Context menu state
//-------------------------------------------------------------------------

class ContextMenuState {
  m_mouseCanvasPos: ImVec2 = new ImVec2();
  m_pNode: BaseNode | null = null;
  m_pPin: Pin | null = null;
  m_requestOpenMenu: boolean = false;
  m_menuOpened: boolean = false;
  m_isAutoConnectMenu: boolean = false;
  m_isDragReady: boolean = false;
  m_filterWidget: ImGuiX.FilterWidget = new ImGuiX.FilterWidget();

  IsNodeContextMenu (): boolean {
    return this.m_pNode !== null;
  }

  GetAsFlowNode (): FlowNode | null {
    return this.m_pNode instanceof FlowNode ? this.m_pNode : null;
  }

  GetAsStateMachineNode (): StateMachineNode | null {
    return this.m_pNode instanceof StateMachineNode ? this.m_pNode : null;
  }

  Reset (): void {
    this.m_mouseCanvasPos = new ImVec2();
    this.m_pNode = null;
    this.m_menuOpened = false;
    this.m_pPin = null;
    this.m_requestOpenMenu = false;
    this.m_isAutoConnectMenu = false;
    this.m_filterWidget.clear();
  }
}

// Drag and Drop State
//-------------------------------------------------------------------------
class NodeGraphDragAndDropState {
  public m_mouseCanvasPos: ImVec2;  // The mouse canvas position at which the drag and drop occurred
  public m_mouseScreenPos: ImVec2;  // The mouse screen position at which the drag and drop occurred
  public payloadID: string;
  public payloadData: any;

  constructor () {
    this.m_mouseCanvasPos = new ImVec2(0, 0);
    this.m_mouseScreenPos = new ImVec2(0, 0);
    this.payloadID = '';
    this.payloadData = new Uint8Array();
  }

  public TryAcceptDragAndDrop (payloadID: string): boolean {
    const payload = ImGui.AcceptDragDropPayload(payloadID);

    if (payload) {
      this.payloadID = payloadID;
      // this.payloadData = new Uint8Array(payload.dataSize);
      // this.payloadData.set(new Uint8Array(payload.data.buffer, payload.data.byteOffset, payload.dataSize));
      this.payloadData = payload.Data;

      return true;
    }

    return false;
  }
}

export class DragAndDropState extends NodeGraphDragAndDropState {
  m_isActiveDragAndDrop: boolean = false;

  Reset (): void {
    this.m_mouseCanvasPos = this.m_mouseCanvasPos = new ImVec2(0, 0);
    this.payloadID = '';
    this.payloadData = '';
    this.m_isActiveDragAndDrop = false;
  }
}

export class GraphView {
  private static readonly s_graphCopiedDataNodeName = 'AnimGraphCopiedData';
  private static readonly s_copiedNodesNodeName = 'Nodes';
  private static readonly s_copiedConnectionsNodeName = 'Connections';
  private static readonly s_dialogID_Rename = 'Rename ';
  private static readonly s_dialogID_Comment = 'Comment';

  m_ID: UUID;
  private m_pUserContext: UserContext;
  private m_graphEndModificationBindingID: number;
  private m_pGraph: BaseGraph | null = null;
  private m_pHoveredNode: BaseNode | null = null;
  private m_defaultViewOffset: ImVec2 = new ImVec2();
  private m_pViewOffset: ImVec2 = this.m_defaultViewOffset;
  private m_canvasSize: ImVec2 = new ImVec2(0, 0);
  private m_selectedNodes: SelectedNode[] = [];
  private m_hasFocus: boolean = false;
  private m_isViewHovered: boolean = false;
  private m_selectionChanged: boolean = false;
  private m_isReadOnly: boolean = false;
  private m_requestFocus: boolean = false;
  private m_dragState: DragState = new DragState();
  private m_contextMenuState: ContextMenuState = new ContextMenuState();
  private m_dragAndDropState: DragAndDropState = new DragAndDropState();
  private m_pHoveredPin: Pin | null = null;
  private m_hoveredConnectionID: UUID = generateGUID();
  private m_textBuffer: string = '';
  private m_pNodeBeingOperatedOn: BaseNode | null = null;

  constructor (pUserContext: UserContext) {
    this.m_ID = generateGUID();
    this.m_pUserContext = pUserContext;
    this.m_graphEndModificationBindingID = BaseGraph.OnEndRootGraphModification().push(this.OnGraphModified.bind(this));
  }

  HasFocus (): boolean {
    return this.m_hasFocus;
  }

  GetViewedGraph (): BaseGraph | null {
    return this.m_pGraph;
  }

  IsViewingFlowGraph (): boolean {
    return this.m_pGraph !== null && this.m_pGraph instanceof FlowGraph;
  }

  IsViewingStateMachineGraph (): boolean {
    return this.m_pGraph !== null && this.m_pGraph instanceof StateMachineGraph;
  }

  GetFlowGraph (): FlowGraph | null {
    return this.m_pGraph instanceof FlowGraph ? this.m_pGraph : null;
  }

  GetStateMachineGraph (): StateMachineGraph | null {
    return this.m_pGraph instanceof StateMachineGraph ? this.m_pGraph : null;
  }

  IsReadOnly (): boolean {
    return this.m_isReadOnly;
  }

  SetReadOnly (isReadOnly: boolean): void {
    this.m_isReadOnly = isReadOnly;
  }

  HasSelectionChangedThisFrame (): boolean {
    return this.m_selectionChanged;
  }

  HasSelectedNodes (): boolean {
    return this.m_selectedNodes.length > 0;
  }

  IsNodeSelected (pNode: BaseNode): boolean {
    return this.m_selectedNodes.some(selectedNode => selectedNode.m_pNode === pNode);
  }

  GetSelectedNodes (): SelectedNode[] {
    return this.m_selectedNodes;
  }

  protected GetDragMode (): DragMode {
    return this.m_dragState.m_mode;
  }

  protected IsNotDragging (): boolean {
    return this.GetDragMode() === DragMode.None;
  }

  protected IsDraggingView (): boolean {
    return this.GetDragMode() === DragMode.View;
  }

  protected IsDraggingSelection (): boolean {
    return this.GetDragMode() === DragMode.Selection;
  }

  protected IsDraggingNode (): boolean {
    return this.GetDragMode() === DragMode.Node;
  }

  protected IsDraggingConnection (): boolean {
    return this.GetDragMode() === DragMode.Connection;
  }

  protected IsResizingCommentBox (): boolean {
    return this.GetDragMode() === DragMode.ResizeComment;
  }

  private GetViewScaleFactor (): number {
    return (this.m_pGraph === null) ? 1.0 : this.m_pGraph.m_viewScaleFactor;
  }

  private IsContextMenuOpen (): boolean {
    return this.m_contextMenuState.m_menuOpened;
  }

  destructor (): void {
    BaseGraph.OnEndRootGraphModification().length = 0;
  }

  private OnGraphModified (pModifiedGraph: BaseGraph): void {
    if (pModifiedGraph === this.m_pGraph) {
      this.m_pGraph.OnShowGraph();
    }
  }

  SetGraphToView (pGraph: BaseGraph | null, tryMaintainSelection: boolean = false): void {
    if (this.m_pGraph === pGraph) {
      return;
    }

    const oldSelection = [...this.m_selectedNodes];

    this.ResetInternalState();

    this.m_pGraph = pGraph;
    if (this.m_pGraph !== null) {
      this.m_pViewOffset = this.m_pGraph.m_viewOffset;

      const drawingContext = new DrawContext();

      drawingContext.SetViewScaleFactor(this.m_pGraph.m_viewScaleFactor);

      const canvasAreaWithNodes = new ImRect();

      for (const nodeInstance of this.m_pGraph.m_nodes) {
        canvasAreaWithNodes.Add(nodeInstance.GetRect());
      }

      const visibleCanvasRect = new ImRect(this.m_pViewOffset, add(this.m_pViewOffset, this.m_canvasSize));

      if (!visibleCanvasRect.Overlaps(canvasAreaWithNodes)) {
        this.m_pViewOffset = canvasAreaWithNodes.Min;
      }

      this.m_pGraph.OnShowGraph();
    } else {
      this.m_defaultViewOffset = ImVec2.ZERO;
      this.m_pViewOffset = this.m_defaultViewOffset;
    }

    this.RefreshNodeSizes();

    if (tryMaintainSelection) {
      const newSelection: SelectedNode[] = [];

      for (const oldSelectedNode of oldSelection) {
        const pFoundNode = this.GetViewedGraph()!.FindNode(oldSelectedNode.m_nodeID);

        if (pFoundNode !== null) {
          newSelection.push(new SelectedNode(pFoundNode));
        }
      }

      this.UpdateSelection(newSelection);
    }
  }

  private ResetInternalState (): void {
    // this.m_pViewOffset = null;
    this.m_hasFocus = false;
    this.m_selectionChanged = false;
    this.m_pHoveredNode = null;
    this.m_pHoveredPin = null;
    this.m_contextMenuState.Reset();
    this.m_dragState.Reset();
    this.m_dragAndDropState.Reset();
    this.ClearSelection();
  }

  BeginDrawCanvas (childHeightOverride: number): boolean {
    this.m_selectionChanged = false;
    this.m_isViewHovered = false;
    this.m_canvasSize = new ImVec2(0, 0);

    ImGui.PushID(this.m_ID);
    ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, g_gridBackgroundColor);
    ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ItemSpacing, new ImVec2(4, 4));

    if (this.m_requestFocus) {
      ImGui.SetNextWindowFocus();
      this.m_requestFocus = false;
    }

    const childVisible = ImGui.BeginChild('GraphCanvas', new ImVec2(0, childHeightOverride), true, ImGui.ImGuiWindowFlags.NoScrollbar | ImGui.ImGuiWindowFlags.NoMove | ImGui.ImGuiWindowFlags.NoScrollWithMouse);

    if (childVisible) {
    //   const pWindow = ImGui.GetCurrentWindow();
      const pDrawList = ImGui.GetWindowDrawList();

      //   this.m_hasFocus = ImGui.IsWindowFocused(ImGui.ImGuiFocusedFlags.ChildWindows | ImGui.ImGuiFocusedFlags.NoPopupHierarchy);
      this.m_hasFocus = ImGui.IsWindowFocused(ImGui.ImGuiFocusedFlags.ChildWindows);
      this.m_isViewHovered = ImGui.IsWindowHovered();
      this.m_canvasSize = multiplyScalar(ImGui.GetContentRegionAvail(), 1.0 / this.GetViewScaleFactor());

      //   const windowRect = pWindow.Rect();
      const windowPos = ImGui.GetWindowPos();
      const windowSize = ImGui.GetWindowSize();
      const windowRect = new ImRect(windowPos, add(windowPos, windowSize));
      const windowTL = windowRect.GetTL();
      const canvasWidth = windowRect.GetWidth();
      const canvasHeight = windowRect.GetHeight();

      const gridLineColor = this.IsReadOnly() ? colorMultiplyScalar(g_readOnlyCanvasBorderColor, 0.4) : g_gridLineColor;

      for (let x = fmodf(0, g_gridSpacing); x < canvasWidth; x += g_gridSpacing) {
        pDrawList.AddLine(add(windowTL, new ImVec2(x, 0.0)), add(windowTL, new ImVec2(x, canvasHeight)), gridLineColor.toImU32());
      }

      for (let y = fmodf(0, g_gridSpacing); y < canvasHeight; y += g_gridSpacing) {
        pDrawList.AddLine(add(windowTL, new ImVec2(0.0, y)), add(windowTL, new ImVec2(canvasWidth, y)), gridLineColor.toImU32());
      }
    }

    return childVisible;
  }

  EndDrawCanvas (ctx: DrawContext): void {
    if (ctx.m_pDrawList !== null) {
      if (this.IsReadOnly()) {
        const rectThickness = 8.0;
        const rectMargin = 2.0;
        const offset = new ImVec2((rectThickness / 2) + rectMargin, (rectThickness / 2) + rectMargin);

        ctx.m_pDrawList.AddRect(add(ctx.m_windowRect.Min, offset), subtract(ctx.m_windowRect.Max, offset), g_readOnlyCanvasBorderColor.toImU32(), 8.0, 0, rectThickness);
      }

      let textPosition = add(ctx.m_windowRect.Min, g_graphTitleMargin);

      {
        const pViewedGraph = this.GetViewedGraph();

        const textDisabledColor = ImGui.GetStyleColorVec4(ImGui.ImGuiCol.TextDisabled);
        const s_colorTextDisabled = new Color(textDisabledColor.x, textDisabledColor.y, textDisabledColor.z, textDisabledColor.w);

        if (pViewedGraph !== null) {
        //   const pTitleFont = ImGuiX.GetFont(ImGuiX.Font.LargeBold);
          const pTitleFont = ImGui.GetFont();
          const title = `${pViewedGraph.GetName()}${this.IsReadOnly() ? ' (Read-Only)' : ''}`;

          ctx.m_pDrawList.AddText(pTitleFont, pTitleFont.FontSize, textPosition, this.IsReadOnly() ? s_colorTextDisabled.toImU32() : g_graphTitleColor.toImU32(), title);
          textPosition = add(textPosition, new ImVec2(0, pTitleFont.FontSize));

          //   const pMediumFont = ImGuiX.GetFont(ImGuiX.Font.Medium);
          const pMediumFont = ImGui.GetFont();

          if (this.m_pUserContext.GetExtraGraphTitleInfoText() !== '') {
            ctx.m_pDrawList.AddText(pMediumFont, pMediumFont.FontSize, textPosition, this.m_pUserContext.GetExtraTitleInfoTextColor(), this.m_pUserContext.GetExtraGraphTitleInfoText());
          }
        } else {
          ctx.m_pDrawList.AddText(textPosition, s_colorTextDisabled.toImU32(), this.m_isReadOnly ? 'Nothing to Show (Read-Only)' : 'Nothing to Show');
        }
      }
    }
    ImGui.EndChild();
    ImGui.PopStyleColor();
    ImGui.PopStyleVar();
    ImGui.PopID();
  }

  private ChangeViewScale (ctx: DrawContext, newViewScale: number): void {
    if (this.m_pGraph === null) {return;}

    const deltaScale = newViewScale - this.m_pGraph.m_viewScaleFactor;

    if (Math.abs(deltaScale) < Number.EPSILON) {
      this.m_pGraph.m_viewOffset = add(this.m_pGraph.m_viewOffset,
        multiplyScalar(subtract(ctx.m_mouseCanvasPos, this.m_pGraph.m_viewOffset), deltaScale * 1 / newViewScale)
      );
      this.m_pGraph.m_viewScaleFactor = newViewScale;

      for (const nodeInstance of this.m_pGraph.m_nodes) {
        nodeInstance.ResetCalculatedNodeSizes();
      }
    }
  }

  private DrawStateMachineNode (ctx: DrawContext, pNode: StateMachineNode): void {
    if (!pNode.IsVisible()) {
      return;
    }

    ImGui.PushID(pNode.m_ID);
    ctx.SplitDrawChannels();

    ctx.SetDrawChannel(DrawChannel.Foreground);

    const newNodeWindowSize = new ImVec2(0, 0);
    const windowPosition = ctx.CanvasToWindowPosition(pNode.GetPosition());
    const scaledNodeMargin = ctx.CanvasToWindow(pNode.GetNodeMargin());
    const scaledColorItemSpacing = new ImVec2(
      (g_titleBarColorItemWidth * ctx.m_viewScaleFactor) - scaledNodeMargin.x,
      0
    );

    ImGui.SetCursorPos(windowPosition);
    ImGui.BeginGroup();
    {
    //   ImGuiX.ScopedFont(ImGuiX.Font.Medium, Colors.White);
      ImGui.BeginGroup();
      ImGui.Dummy(scaledColorItemSpacing);
      ImGui.SameLine();
      if (pNode.GetIcon() !== null) {
        ImGui.Text(pNode.GetIcon()!);
        ImGui.SameLine();
      }
      ImGui.Text(pNode.GetName());
      ImGui.EndGroup();

      newNodeWindowSize.Copy(ImGui.GetItemRectSize());
      pNode.m_titleRectSize = ctx.WindowToCanvas(newNodeWindowSize);

      const scaledSpacing = ctx.CanvasToWindow(g_spacingBetweenTitleAndNodeContents);

      ImGui.SetCursorPosY(ImGui.GetCursorPos().y + scaledSpacing);
      newNodeWindowSize.y += scaledSpacing;

      {
        // ImGuiX.ScopedFont(ImGuiX.Font.Tiny);
        const cursorStartPos = ImGui.GetCursorPos();

        ImGui.BeginGroup();
        pNode.DrawExtraControls(ctx, this.m_pUserContext);
        const cursorEndPos = ImGui.GetCursorPos();

        ImGui.SetCursorPos(cursorStartPos);
        ImGui.Dummy(subtract(cursorEndPos, cursorStartPos));
        ImGui.EndGroup();
      }

      const extraControlsRectSize = ImGui.GetItemRectSize();

      newNodeWindowSize.x = Math.max(newNodeWindowSize.x, extraControlsRectSize.x);
      newNodeWindowSize.y += extraControlsRectSize.y;
    }
    ImGui.EndGroup();

    pNode.m_size = ctx.WindowToCanvas(newNodeWindowSize);

    const visualState = new Map<NodeVisualState, boolean>();

    visualState.set(NodeVisualState.Active, pNode.IsActive(this.m_pUserContext));
    visualState.set(NodeVisualState.Selected, this.IsNodeSelected(pNode));
    visualState.set(NodeVisualState.Hovered, pNode.m_isHovered);

    const [nodeTitleBarColor, nodeBackgroundColor, nodeBorderColor] = GetNodeBackgroundAndBorderColors(
      Style.s_defaultTitleColor,
      Style.s_nodeBackgroundColor,
      visualState
    );

    const backgroundRectMin = ctx.WindowToScreenPosition(subtract(windowPosition, scaledNodeMargin));
    const backgroundRectMax = ctx.WindowToScreenPosition(add(add(windowPosition, newNodeWindowSize), scaledNodeMargin));
    const rectTitleBarMax = ctx.WindowToScreenPosition(add(add(windowPosition, new ImVec2(newNodeWindowSize.x, ctx.CanvasToWindow(pNode.m_titleRectSize.y))), scaledNodeMargin));
    const rectTitleBarColorItemMax = new ImVec2(backgroundRectMin.x + (ctx.m_viewScaleFactor * g_titleBarColorItemWidth), rectTitleBarMax.y);
    const scaledCornerRounding = 2 * ctx.m_viewScaleFactor;
    const scaledBorderThickness = g_nodeSelectionBorderThickness * ctx.m_viewScaleFactor;

    ctx.SetDrawChannel(DrawChannel.Background);

    if (pNode instanceof StateNode) {
      if (visualState.get(NodeVisualState.Active)) {
        const activeBorderPadding = new ImVec2(Style.s_activeBorderIndicatorPadding, Style.s_activeBorderIndicatorPadding);

        ctx.m_pDrawList!.AddRect(
          subtract(backgroundRectMin, activeBorderPadding),
          add(backgroundRectMax, activeBorderPadding),
          Style.s_activeIndicatorBorderColor.toImU32(),
          scaledCornerRounding,
          ImGui.ImDrawCornerFlags.All,
          Style.s_activeBorderIndicatorThickness
        );
      }

      ctx.m_pDrawList!.AddRectFilled(backgroundRectMin, backgroundRectMax, nodeBackgroundColor.toImU32(), scaledCornerRounding, ImGui.ImDrawCornerFlags.All);
      ctx.m_pDrawList!.AddRectFilled(backgroundRectMin, rectTitleBarMax, Style.s_defaultTitleColor.toImU32(), scaledCornerRounding, ImGui.ImDrawCornerFlags.Top);
      ctx.m_pDrawList!.AddRectFilled(backgroundRectMin, rectTitleBarColorItemMax, pNode.GetTitleBarColor().toImU32(), scaledCornerRounding, ImGui.ImDrawCornerFlags.TopLeft);
      ctx.m_pDrawList!.AddRect(backgroundRectMin, backgroundRectMax, nodeBorderColor.toImU32(), scaledCornerRounding, ImGui.ImDrawCornerFlags.All, scaledBorderThickness);
    } else {
      ctx.m_pDrawList!.AddRectFilled(backgroundRectMin, backgroundRectMax, nodeBackgroundColor.toImU32(), scaledCornerRounding);
      ctx.m_pDrawList!.AddRect(backgroundRectMin, backgroundRectMax, nodeBorderColor.toImU32(), scaledCornerRounding, ImGui.ImDrawCornerFlags.All, scaledBorderThickness);
    }

    ctx.MergeDrawChannels();
    ImGui.PopID();

    const nodeRect = pNode.GetRect();

    pNode.m_isHovered = this.m_isViewHovered && nodeRect.Contains(ctx.m_mouseCanvasPos);
  }

  private DrawStateMachineTransitionConduit (ctx: DrawContext, pTransitionConduit: TransitionConduitNode): void {
    if (pTransitionConduit.m_startStateID === '' || pTransitionConduit.m_endStateID === '') {
      return;
    }

    const pStartState = this.m_pGraph!.FindNode(pTransitionConduit.m_startStateID) as StateNode;
    const pEndState = this.m_pGraph!.FindNode(pTransitionConduit.m_endStateID) as StateNode;

    const startNodeRect = pStartState.GetRect();
    const scaledEndNodeRect = pEndState.GetRect();

    let [startPoint, endPoint] = GetConnectionPointsBetweenStateMachineNodes(startNodeRect, scaledEndNodeRect);

    const arrowDir = normalize(subtract(endPoint, startPoint));
    const orthogonalDir = new ImGui.ImVec2(-arrowDir.y, arrowDir.x);
    const offset = multiplyScalar(orthogonalDir, g_transitionArrowOffset);

    startPoint = add(startPoint, offset);
    endPoint = add(endPoint, offset);

    const scaledSelectionExtraRadius = ctx.WindowToCanvas(g_connectionSelectionExtraRadius);
    const closestPointOnTransitionToMouse = ImGuiX.ImLineClosestPoint(startPoint, endPoint, ctx.m_mouseCanvasPos);

    if (this.m_isViewHovered && lengthSqr(subtract(closestPointOnTransitionToMouse, ctx.m_mouseCanvasPos)) < Math.pow(scaledSelectionExtraRadius, 2)) {
      pTransitionConduit.m_isHovered = true;
    } else {
      pTransitionConduit.m_isHovered = false;
    }

    const visualState = new Map<NodeVisualState, boolean>();

    visualState.set(NodeVisualState.Active, pTransitionConduit.IsActive(this.m_pUserContext));
    visualState.set(NodeVisualState.Selected, this.IsNodeSelected(pTransitionConduit));
    visualState.set(NodeVisualState.Hovered, pTransitionConduit.m_isHovered);

    pTransitionConduit.DrawExtraControls(ctx, this.m_pUserContext, startPoint, endPoint);

    const scaledArrowHeadWidth = ctx.CanvasToWindow(5.0);
    const scaledArrowWidth = ctx.CanvasToWindow(g_transitionArrowWidth);
    // Source code:
    // const transitionProgress = pTransitionConduit.m_transitionProgress.GetNormalizedTime();
    const transitionProgress = pTransitionConduit.m_transitionProgress;
    const hasTransitionProgress = transitionProgress > 0.0;
    const transitionColor = pTransitionConduit.GetConduitColor(ctx, this.m_pUserContext, visualState);

    if (hasTransitionProgress) {
      ImGuiX.DrawArrow(ctx.m_pDrawList!, ctx.CanvasToScreenPosition(startPoint), ctx.CanvasToScreenPosition(endPoint), new Color(Colors.DimGray), scaledArrowWidth, scaledArrowHeadWidth);
      const progressEndPoint = lerp(startPoint, endPoint, transitionProgress);

      ImGuiX.DrawArrow(ctx.m_pDrawList!, ctx.CanvasToScreenPosition(startPoint), ctx.CanvasToScreenPosition(progressEndPoint), transitionColor, scaledArrowWidth, scaledArrowHeadWidth);
    } else {
      if (visualState.get(NodeVisualState.Selected)) {
        ImGuiX.DrawArrow(ctx.m_pDrawList!, ctx.CanvasToScreenPosition(startPoint), ctx.CanvasToScreenPosition(endPoint), transitionColor, scaledArrowWidth * 1.5, scaledArrowHeadWidth * 1.5);
      } else {
        ImGuiX.DrawArrow(ctx.m_pDrawList!, ctx.CanvasToScreenPosition(startPoint), ctx.CanvasToScreenPosition(endPoint), transitionColor, scaledArrowWidth, scaledArrowHeadWidth);
      }
    }

    const min = new ImVec2(Math.min(startPoint.x, endPoint.x), Math.min(startPoint.y, endPoint.y));
    const max = new ImVec2(Math.max(startPoint.x, endPoint.x), Math.max(startPoint.y, endPoint.y));

    pTransitionConduit.m_canvasPosition = min;
    pTransitionConduit.m_size = subtract(max, min);
  }

  private DrawFlowNode (ctx: DrawContext, pNode: FlowNode): void {
    // if (!pNode.IsVisible()) {
    //   return;
    // }

    // ImGui.PushID(pNode);
    // ctx.SplitDrawChannels();

    // ctx.SetDrawChannel(DrawChannel.Foreground);

    // const newNodeWindowSize = new ImVec2(0, 0);
    // const windowPosition = ctx.CanvasToWindowPosition(pNode.GetPosition());
    // const scaledNodeMargin = ctx.CanvasToWindow(pNode.GetNodeMargin());
    // const scaledColorItemSpacing = new ImVec2((g_titleBarColorItemWidth * ctx.m_viewScaleFactor) - scaledNodeMargin.x, 0);

    // ImGui.SetCursorPos(windowPosition);
    // ImGui.BeginGroup();
    // {
    //   {
    //     ImGuiX.ScopedFont(ImGuiX.Font.MediumBold, Colors.White);
    //     ImGui.BeginGroup();
    //     ImGui.Dummy(scaledColorItemSpacing);
    //     ImGui.SameLine();
    //     if (pNode.GetIcon() !== null) {
    //       ImGui.Text(pNode.GetIcon());
    //       ImGui.SameLine();
    //     }
    //     ImGui.Text(pNode.GetName());
    //     ImGui.EndGroup();

    //     newNodeWindowSize.Set(ImGui.GetItemRectSize());
    //     pNode.m_titleRectSize = ctx.WindowToCanvas(newNodeWindowSize);

    //     const scaledSpacing = ctx.CanvasToWindow(g_spacingBetweenTitleAndNodeContents);

    //     ImGui.SetCursorPosY(ImGui.GetCursorPos().y + scaledSpacing);
    //     newNodeWindowSize.y += scaledSpacing;
    //   }

    //   let hasPinControlsOnLastRow = false;

    //   {
    //     ImGuiX.ScopedFont(ImGuiX.Font.Tiny);
    //     ImGui.PushStyleVar(ImGuiStyleVar.ItemSpacing, new ImVec2(0, 2 * ctx.m_viewScaleFactor));

    //     pNode.m_pHoveredPin = null;

    //     const pinRectSize = new ImVec2(0, 0);
    //     const numPinRows = Math.max(pNode.GetNumInputPins(), pNode.GetNumOutputPins());

    //     for (let i = 0; i < numPinRows; i++) {
    //       const pinWindowSize = new ImVec2(0, 0);
    //       const hasInputPin = i < pNode.m_inputPins.length;
    //       const hasOutputPin = i < pNode.m_outputPins.length;
    //       let estimatedSpacingBetweenPins = 0;

    //       const DrawPin = (pin: Pin, isInputPin: boolean) => {
    //         ImGui.BeginGroup();
    //         ImGui.AlignTextToFramePadding();

    //         if (isInputPin) {
    //           ImGui.Text(pin.m_name);
    //         }

    //         if (pNode.DrawPinControls(ctx, this.m_pUserContext, pin)) {
    //           hasPinControlsOnLastRow = (i === (numPinRows - 1));
    //         }

    //         if (!isInputPin) {
    //           ImGui.Text(pin.m_name);
    //         }
    //         ImGui.EndGroup();

    //         const pinRect = new ImRect(ImGui.GetItemRectMin(), ImGui.GetItemRectMax());

    //         pin.m_size = ImGui.GetItemRectSize();

    //         const pinOffsetY = ImGui.GetFrameHeightWithSpacing() / 2;

    //         if (isInputPin) {
    //           pin.m_position = new ImVec2(pinRect.Min.x - scaledNodeMargin.x, pinRect.Min.y + pinOffsetY);
    //         } else {
    //           pin.m_position = new ImVec2(pinRect.Max.x + scaledNodeMargin.x, pinRect.Min.y + pinOffsetY);
    //         }

    //         let pinColor = pNode.GetPinColor(pin);
    //         const isPinHovered = new Vector(pin.m_position).GetDistance2(ImGui.GetMousePos()) < ctx.CanvasToWindow(g_pinRadius + FlowNode.s_pinSelectionExtraRadius);

    //         if (isPinHovered) {
    //           pNode.m_pHoveredPin = pin;
    //           pinColor = pinColor.ScaleColor(1.55);
    //         }

    //         const scaledPinRadius = ctx.CanvasToWindow(g_pinRadius);

    //         ctx.m_pDrawList.AddCircleFilled(pin.m_position, scaledPinRadius, pinColor);
    //       };

    //       const pinRowCursorStartY = ImGui.GetCursorPosY();

    //       if (hasInputPin) {
    //         DrawPin(pNode.m_inputPins[i], true);
    //       }

    //       if (hasOutputPin) {
    //         if (!hasInputPin) {
    //           ImGui.NewLine();
    //         }

    //         const inputPinWidth = hasInputPin ? pNode.m_inputPins[i].GetWidth() : 0;
    //         const scaledSpacingBetweenPins = ctx.CanvasToWindow(g_spacingBetweenInputOutputPins);

    //         estimatedSpacingBetweenPins = ctx.CanvasToWindow(pNode.GetWidth()) - inputPinWidth - pNode.m_outputPins[i].GetWidth();
    //         estimatedSpacingBetweenPins = Math.max(estimatedSpacingBetweenPins, scaledSpacingBetweenPins);
    //         ImGui.SameLine(0, estimatedSpacingBetweenPins);
    //       }

    //       if (hasOutputPin) {
    //         ImGui.SetCursorPosY(pinRowCursorStartY);
    //         DrawPin(pNode.m_outputPins[i], false);
    //       }

    //       const pinRowRectSize = new ImVec2(0, 0);

    //       if (hasInputPin) {
    //         pinRowRectSize.x += pNode.m_inputPins[i].m_size.x;
    //         pinRowRectSize.y = pNode.m_inputPins[i].m_size.y;
    //       }

    //       if (hasOutputPin) {
    //         pinRowRectSize.x += pNode.m_outputPins[i].m_size.x;
    //         pinRowRectSize.y = Math.max(pinRowRectSize.y, pNode.m_outputPins[i].m_size.y);
    //       }

    //       pinRowRectSize.x += estimatedSpacingBetweenPins;
    //       pinRectSize.x = Math.max(pinRectSize.x, pinRowRectSize.x);
    //       pinRectSize.y += pinRowRectSize.y + ImGui.GetStyle().ItemSpacing.y;
    //     }

    //     newNodeWindowSize.x = Math.max(newNodeWindowSize.x, pinRectSize.x);
    //     newNodeWindowSize.y += pinRectSize.y;

    //     ImGui.PopStyleVar();
    //   }

    //   {
    //     ImGuiX.ScopedFont(ImGuiX.Font.Tiny);

    //     const offsetY = (hasPinControlsOnLastRow ? ImGui.GetStyle().ItemSpacing.y : 0);

    //     const cursorStartPos = ImGui.GetCursorPos();

    //     ImGui.BeginGroup();
    //     ImGui.SetCursorPos(cursorStartPos.add(new ImVec2(0, offsetY)));

    //     pNode.DrawExtraControls(ctx, this.m_pUserContext);

    //     const cursorEndPos = ImGui.GetCursorPos();

    //     ImGui.SetCursorPos(cursorStartPos);
    //     ImGui.Dummy(cursorEndPos.sub(cursorStartPos));
    //     ImGui.EndGroup();
    //   }

    //   const extraControlsRectSize = ImGui.GetItemRectSize();

    //   newNodeWindowSize.x = Math.max(newNodeWindowSize.x, extraControlsRectSize.x);
    //   newNodeWindowSize.y += extraControlsRectSize.y;
    // }
    // ImGui.EndGroup();

    // pNode.m_size = ctx.WindowToCanvas(newNodeWindowSize);

    // const visualState = new TBitFlags<NodeVisualState>();

    // visualState.SetFlag(NodeVisualState.Active, pNode.IsActive(this.m_pUserContext));
    // visualState.SetFlag(NodeVisualState.Selected, this.IsNodeSelected(pNode));
    // visualState.SetFlag(NodeVisualState.Hovered, pNode.m_isHovered && pNode.m_pHoveredPin === null);

    // const [nodeTitleBarColor, nodeBackgroundColor, nodeBorderColor] = GetNodeBackgroundAndBorderColors(
    //   Style.s_defaultTitleColor,
    //   Style.s_nodeBackgroundColor,
    //   visualState
    // );

    // const backgroundRectMin = ctx.WindowToScreenPosition(windowPosition.sub(scaledNodeMargin));
    // const backgroundRectMax = ctx.WindowToScreenPosition(windowPosition.add(newNodeWindowSize).add(scaledNodeMargin));
    // const rectTitleBarMax = ctx.WindowToScreenPosition(windowPosition.add(new ImVec2(newNodeWindowSize.x, ctx.CanvasToWindow(pNode.m_titleRectSize.y))).add(scaledNodeMargin));
    // const rectTitleBarColorItemMax = new ImVec2(backgroundRectMin.x + (ctx.m_viewScaleFactor * g_titleBarColorItemWidth), rectTitleBarMax.y);
    // const scaledCornerRounding = 8 * ctx.m_viewScaleFactor;
    // const scaledBorderThickness = g_nodeSelectionBorderThickness * ctx.m_viewScaleFactor;

    // ctx.SetDrawChannel(DrawChannel.Background);

    // if (visualState.IsFlagSet(NodeVisualState.Active)) {
    //   const activeBorderPadding = new ImVec2(Style.s_activeBorderIndicatorPadding, Style.s_activeBorderIndicatorPadding);

    //   ctx.m_pDrawList.AddRect(
    //     backgroundRectMin.sub(activeBorderPadding),
    //     backgroundRectMax.add(activeBorderPadding),
    //     Style.s_activeIndicatorBorderColor,
    //     scaledCornerRounding,
    //     ImDrawFlags.RoundCornersAll,
    //     Style.s_activeBorderIndicatorThickness
    //   );
    // }

    // ctx.m_pDrawList.AddRectFilled(backgroundRectMin, backgroundRectMax, nodeBackgroundColor, scaledCornerRounding, ImDrawFlags.RoundCornersAll);
    // ctx.m_pDrawList.AddRectFilled(backgroundRectMin, rectTitleBarMax, nodeTitleBarColor, scaledCornerRounding, ImDrawFlags.RoundCornersTop);
    // ctx.m_pDrawList.AddRectFilled(backgroundRectMin, rectTitleBarColorItemMax, pNode.GetTitleBarColor(), scaledCornerRounding, ImDrawFlags.RoundCornersTopLeft);
    // ctx.m_pDrawList.AddRect(backgroundRectMin, backgroundRectMax, nodeBorderColor, scaledCornerRounding, ImDrawFlags.RoundCornersAll, scaledBorderThickness);

    // ctx.MergeDrawChannels();
    // ImGui.PopID();

    // const nodeRect = pNode.GetRect();

    // pNode.m_isHovered = this.m_isViewHovered && nodeRect.Contains(ctx.m_mouseCanvasPos) || pNode.m_pHoveredPin !== null;
  }

  private DrawCommentNode (ctx: DrawContext, pNode: CommentNode): void {
    // if (!pNode.IsVisible()) {
    //   return;
    // }

    // ImGui.PushID(pNode);
    // ctx.SplitDrawChannels();

    // const windowPosition = ctx.CanvasToWindowPosition(pNode.GetPosition());
    // const textOffset = ctx.CanvasToWindow(ImGui.GetStyle().WindowPadding);
    // const textCursorStartPos = windowPosition.add(textOffset);

    // ctx.SetDrawChannel(DrawChannel.Foreground);
    // ImGui.SetCursorPos(textCursorStartPos);
    // ImGui.BeginGroup();
    // {
    //   ImGuiX.ScopedFont(ImGuiX.Font.MediumBold);

    //   const nodeWindowWidth = ctx.CanvasToWindow(pNode.m_commentBoxSize.x);

    //   ImGui.PushTextWrapPos(ImGui.GetCursorPosX() + nodeWindowWidth);
    //   ImGui.Text(`${EE_ICON_COMMENT}  ${pNode.GetName()}`);
    //   ImGuiX.TextTooltip(pNode.GetName());
    //   ImGui.PopTextWrapPos();

    //   pNode.m_titleRectSize = ctx.WindowToCanvas(ImGui.GetItemRectSize());
    //   pNode.m_size = pNode.GetCommentBoxSize();
    // }
    // ImGui.EndGroup();

    // const visualState = new TBitFlags<NodeVisualState>();

    // visualState.SetFlag(NodeVisualState.Active, pNode.IsActive(this.m_pUserContext));
    // visualState.SetFlag(NodeVisualState.Selected, this.IsNodeSelected(pNode));
    // visualState.SetFlag(NodeVisualState.Hovered, pNode.m_isHovered);

    // const windowNodeMargin = ctx.CanvasToWindow(pNode.GetNodeMargin());
    // const rectMin = ctx.WindowToScreenPosition(windowPosition.sub(windowNodeMargin));
    // const rectMax = ctx.WindowToScreenPosition(windowPosition.add(ctx.CanvasToWindow(pNode.GetCommentBoxSize())).add(windowNodeMargin));
    // const titleRectMax = new ImVec2(rectMax.x, ctx.WindowToScreenPosition(textCursorStartPos).y + ctx.CanvasToWindow(pNode.m_titleRectSize.y) + windowNodeMargin.y);

    // const scaledBorderThickness = ctx.CanvasToWindow(g_nodeSelectionBorderThickness);

    // const [nodeTitleBarColor, nodeBackgroundColor, nodeBorderColor] = GetNodeBackgroundAndBorderColors(
    //   pNode.GetCommentBoxColor(),
    //   pNode.GetCommentBoxColor(),
    //   visualState
    // );

    // ctx.SetDrawChannel(DrawChannel.Background);
    // ctx.m_pDrawList.AddRectFilled(rectMin, rectMax, nodeBackgroundColor.GetAlphaVersion(0.1), 0, ImDrawFlags.RoundCornersNone);
    // ctx.m_pDrawList.AddRectFilled(rectMin, titleRectMax, nodeBackgroundColor.GetAlphaVersion(0.3), 0, ImDrawFlags.RoundCornersNone);
    // ctx.m_pDrawList.AddRect(rectMin, rectMax, nodeBackgroundColor, 0, ImDrawFlags.RoundCornersNone, scaledBorderThickness);
    // ctx.m_pDrawList.AddRect(
    //   rectMin.sub(new ImVec2(scaledBorderThickness, scaledBorderThickness)),
    //   rectMax.add(new ImVec2(scaledBorderThickness, scaledBorderThickness)),
    //   nodeBorderColor,
    //   0,
    //   ImDrawFlags.RoundCornersNone,
    //   scaledBorderThickness
    // );

    // ctx.MergeDrawChannels();
    // ImGui.PopID();

    // pNode.m_isHovered = false;

    // if (this.m_isViewHovered) {
    //   const dilationRadius = ctx.WindowToCanvas(CommentNode.s_resizeSelectionRadius / 2);

    //   // Broad hit-test
    //   const commentNodeRect = pNode.GetRect();

    //   commentNodeRect.Expand(dilationRadius);
    //   if (commentNodeRect.Contains(ctx.m_mouseCanvasPos)) {
    //     // Test title region
    //     const commentNodeTitleRect = new ImRect(pNode.GetRect().Min, ctx.ScreenToCanvasPosition(titleRectMax));

    //     commentNodeTitleRect.Expand(dilationRadius);
    //     if (commentNodeTitleRect.Contains(ctx.m_mouseCanvasPos)) {
    //       pNode.m_isHovered = true;
    //     }
    //     // Test Edges
    //     else if (pNode.GetHoveredResizeHandle(ctx) !== ResizeHandle.None) {
    //       pNode.m_isHovered = true;
    //     }
    //   }
    // }
  }

  UpdateAndDraw (childHeightOverride: number = 0): void {
    if (this.m_pUserContext === null) {
      throw new Error('User context is null');
    }

    // Update context
    this.m_pUserContext.m_isAltDown = ImGui.GetIO().KeyAlt;
    this.m_pUserContext.m_isCtrlDown = ImGui.GetIO().KeyCtrl;
    this.m_pUserContext.m_isShiftDown = ImGui.GetIO().KeyShift;

    // Node visual update
    if (this.m_pGraph !== null) {
      for (const nodeInstance of this.m_pGraph.m_nodes) {
        nodeInstance.PreDrawUpdate(this.m_pUserContext);
      }
    }

    // Draw Graph
    const drawingContext = new DrawContext();

    drawingContext.m_isReadOnly = this.m_isReadOnly;

    if (this.BeginDrawCanvas(childHeightOverride)) {
      const mousePos = ImGui.GetMousePos();

      drawingContext.SetViewScaleFactor(this.m_pGraph !== null ? this.m_pGraph.m_viewScaleFactor : 1.0);
      drawingContext.m_pDrawList = ImGui.GetWindowDrawList();
      drawingContext.m_viewOffset = this.m_pViewOffset;
      drawingContext.m_windowRect = new ImRect(ImGui.GetWindowPos(), add(ImGui.GetWindowPos(), ImGui.GetWindowSize()));
      drawingContext.m_canvasVisibleRect = new ImRect(drawingContext.m_viewOffset, add(drawingContext.m_viewOffset, drawingContext.m_windowRect.GetSize()));
      drawingContext.m_mouseScreenPos = ImGui.GetMousePos();
      drawingContext.m_mouseCanvasPos = drawingContext.ScreenToCanvasPosition(drawingContext.m_mouseScreenPos);

      // Apply imgui scale
      const unscaledStyle = ImGui.GetStyle();

      ImGui.SetWindowFontScale(drawingContext.m_viewScaleFactor);
      ImGui.GetStyle().ScaleAllSizes(drawingContext.m_viewScaleFactor);

      // Draw nodes
      if (this.m_pGraph !== null) {
        this.m_pHoveredNode = null;
        this.m_pHoveredPin = null;

        // Comment nodes
        for (const nodeInstance of this.m_pGraph.m_nodes) {
          const pCommentNode = nodeInstance as CommentNode;

          if (pCommentNode instanceof CommentNode) {
            this.DrawCommentNode(drawingContext, pCommentNode);

            if (pCommentNode.m_isHovered) {
              this.m_pHoveredNode = pCommentNode;
            }
          }
        }

        // State Machine Graph
        if (this.IsViewingStateMachineGraph()) {
          for (const nodeInstance of this.m_pGraph.m_nodes) {
            // Ignore comment nodes
            if (nodeInstance instanceof CommentNode) {
              continue;
            }

            if (nodeInstance instanceof TransitionConduitNode) {
              this.DrawStateMachineTransitionConduit(drawingContext, nodeInstance);
            } else {
              const pStateMachineNode = nodeInstance as StateMachineNode;

              this.DrawStateMachineNode(drawingContext, pStateMachineNode);
            }

            if (nodeInstance.m_isHovered) {
              this.m_pHoveredNode = nodeInstance;
            }
          }
        } else { // Flow Graph
          const pFlowGraph = this.GetFlowGraph()!;

          // Draw Nodes
          for (const nodeInstance of this.m_pGraph.m_nodes) {
            // Ignore comment nodes
            if (nodeInstance instanceof CommentNode) {
              continue;
            }

            const pFlowNode = nodeInstance as FlowNode;

            this.DrawFlowNode(drawingContext, pFlowNode);

            if (pFlowNode.m_isHovered) {
              this.m_pHoveredNode = pFlowNode;
              this.m_pHoveredPin = pFlowNode.m_pHoveredPin;
            }
          }

          // Draw connections
          this.m_hoveredConnectionID = '';
          for (const connection of pFlowGraph.m_connections) {
            const pFromNode = pFlowGraph.GetNode(connection.m_fromNodeID) as FlowNode;
            const pStartPin = pFromNode.GetOutputPin(connection.m_outputPinID)!;
            const pToNode = pFlowGraph.GetNode(connection.m_toNodeID) as FlowNode;
            const pEndPin = pToNode.GetInputPin(connection.m_inputPinID)!;

            const invertOrder = pStartPin.m_position.x > pEndPin.m_position.x;
            const p1 = invertOrder ? pEndPin.m_position : pStartPin.m_position;
            const p4 = invertOrder ? pStartPin.m_position : pEndPin.m_position;
            const p2 = add(p1, new ImVec2(50, 0));
            const p3 = add(p4, new ImVec2(-50, 0));

            let connectionColor = pFromNode.GetPinColor(pStartPin);

            if (this.m_hasFocus && IsHoveredOverCurve(p1, p2, p3, p4, drawingContext.m_mouseScreenPos, g_connectionSelectionExtraRadius)) {
              this.m_hoveredConnectionID = connection.m_ID;
              connectionColor = new Color(Style.s_connectionColorHovered.toImU32());
            }

            drawingContext.m_pDrawList.AddBezierCubic(p1, p2, p3, p4, connectionColor.toImU32(), Math.max(1.0, 3.0 * drawingContext.m_viewScaleFactor));
          }
        }

        // Extra
        this.m_pGraph.DrawExtraInformation(drawingContext, this.m_pUserContext);
      }

      // Restore original scale value
      ImGui.GetStyle().Copy(unscaledStyle);
    }

    this.EndDrawCanvas(drawingContext);

    this.HandleInput(drawingContext);
    // this.HandleContextMenu(drawingContext);
    // this.DrawDialogs();

    // Handle drag and drop
    const ResetDragAndDropState = () => {
      if (this.m_dragAndDropState.m_isActiveDragAndDrop) {
        this.m_dragAndDropState.Reset();
      }
    };

    if (this.m_pGraph !== null) {
      if (this.m_isReadOnly) {
        ResetDragAndDropState();
      } else { // Drag and drop allowed
        if (this.m_dragAndDropState.m_isActiveDragAndDrop) {
          if (this.m_pGraph.HandleDragAndDrop(this.m_pUserContext, this.m_dragAndDropState)) {
            ResetDragAndDropState();
          }
        } else { // Check for drag and drop
          if (ImGui.BeginDragDropTarget()) {
            const supportedPayloadIDs: string[] = [];

            this.m_pGraph.GetSupportedDragAndDropPayloadIDs(supportedPayloadIDs);

            for (const pPayloadID of supportedPayloadIDs) {
              if (this.m_dragAndDropState.TryAcceptDragAndDrop(pPayloadID)) {
                this.m_dragAndDropState.m_mouseCanvasPos = drawingContext.m_mouseCanvasPos;
                this.m_dragAndDropState.m_mouseScreenPos = drawingContext.m_mouseScreenPos;
                this.m_dragAndDropState.m_isActiveDragAndDrop = true;

                break;
              }
            }

            ImGui.EndDragDropTarget();
          }
        }
      }
    } else {
      ResetDragAndDropState();
    }
  }

  ResetView (): void {
    if (this.m_pGraph === null || this.m_pGraph.m_nodes.length === 0) {
      return;
    }

    const pMostSignificantNode = this.m_pGraph.GetMostSignificantNode();

    if (pMostSignificantNode !== null) {
      this.CenterView(pMostSignificantNode);
    } else {
      const numNodes = this.m_pGraph.m_nodes.length;
      const totalRect = new ImRect(this.m_pGraph.m_nodes[0].GetPosition(), add(this.m_pGraph.m_nodes[0].GetPosition(), this.m_pGraph.m_nodes[0].GetSize()));

      for (let i = 1; i < numNodes; i++) {
        const nodeInstance = this.m_pGraph.m_nodes[i];

        if (nodeInstance.IsVisible()) {
          const nodeRect = new ImRect(nodeInstance.GetPosition(), add(nodeInstance.GetPosition(), nodeInstance.GetSize()));

          totalRect.Add(nodeRect);
        }
      }

      this.m_pViewOffset = subtract(totalRect.GetCenter(), div(this.m_canvasSize, 2));
    }
  }

  CenterView (pNode: BaseNode): void {
    if (this.m_pGraph === null) {
      throw new Error('Graph is null');
    }
    if (this.m_pGraph.FindNode(pNode.GetID()) === null) {
      throw new Error('Node not found in graph');
    }

    const nodeHalfSize = div(pNode.GetSize(), 2);
    const nodeCenter = add(pNode.GetPosition(), nodeHalfSize);

    this.m_pViewOffset = subtract(nodeCenter, div(this.m_canvasSize, 2));
  }

  RefreshNodeSizes (): void {
    if (this.m_pGraph !== null) {
      for (const nodeInstance of this.m_pGraph.m_nodes) {
        nodeInstance.m_size = new ImVec2(0, 0);
      }
    }
  }

  //   SelectNode (pNode: BaseNode): void {
  //     if (this.GetViewedGraph().FindNode(pNode.GetID()) === null) {
  //       throw new Error('Node not found in graph');
  //     }
  //     this.ClearSelection();
  //     this.AddToSelection(pNode);
  //   }

  //   SelectNodes (pNodes: BaseNode[]): void {
  //     this.ClearSelection();
  //     for (const pNode of pNodes) {
  //       if (this.GetViewedGraph().FindNode(pNode.GetID()) === null) {
  //         throw new Error('Node not found in graph');
  //       }
  //       this.AddToSelection(pNode);
  //     }
  //   }

  ClearSelection (): void {
    const oldSelection = [...this.m_selectedNodes];

    this.m_selectedNodes = [];
    this.m_selectionChanged = true;
    this.m_pUserContext.NotifySelectionChanged(oldSelection, this.m_selectedNodes);
  }

  private UpdateSelection (pNewSelectedNode: BaseNode): void;

  private UpdateSelection (newSelection: SelectedNode[]): void;

  private UpdateSelection (arg: BaseNode | SelectedNode[]): void {
    const oldSelection = [...this.m_selectedNodes];

    if (arg instanceof BaseNode) {
      // 处理单个 BaseNode 的情况
      if (arg === null) {
        throw new Error('New selected node is null');
      }
      this.m_selectedNodes = [new SelectedNode(arg)];
    } else {
      // 处理 SelectedNode[] 的情况
      for (const selectedNode of arg) {
        if (selectedNode.m_pNode === null) {
          throw new Error('Selected node is null');
        }
      }
      this.m_selectedNodes = arg;
    }

    this.m_selectionChanged = true;
    this.m_pUserContext.NotifySelectionChanged(oldSelection, this.m_selectedNodes);
  }

  private AddToSelection (pNodeToAdd: BaseNode): void {
    if (pNodeToAdd === null) {
      throw new Error('Node to add is null');
    }
    if (this.IsNodeSelected(pNodeToAdd)) {
      throw new Error('Node is already selected');
    }

    const oldSelection = [...this.m_selectedNodes];

    this.m_selectedNodes.push(new SelectedNode(pNodeToAdd));
    this.m_selectionChanged = true;
    this.m_pUserContext.NotifySelectionChanged(oldSelection, this.m_selectedNodes);
  }

  private RemoveFromSelection (pNodeToRemove: BaseNode): void {
    if (pNodeToRemove === null) {
      throw new Error('Node to remove is null');
    }
    if (!this.IsNodeSelected(pNodeToRemove)) {
      throw new Error('Node is not selected');
    }

    const oldSelection = [...this.m_selectedNodes];

    this.m_selectedNodes = this.m_selectedNodes.filter(node => node.m_pNode !== pNodeToRemove);
    this.m_selectionChanged = true;
    this.m_pUserContext.NotifySelectionChanged(oldSelection, this.m_selectedNodes);
  }

  // DestroySelectedNodes (): void {
  //   const pGraph = this.GetViewedGraph();

  //   if (this.m_isReadOnly) {
  //     throw new Error('Graph is read-only');
  //   }

  //   const sgm = new ScopedGraphModification(pGraph);

  //   // Exclude any state machine transitions, as we will end up double deleting them since they are removed if the state is removed
  //   if (this.IsViewingStateMachineGraph()) {
  //     this.m_selectedNodes = this.m_selectedNodes.filter(node => !(node.m_pNode instanceof TransitionConduitNode));
  //   }

  //   // Delete selected nodes
  //   for (const selectedNode of this.m_selectedNodes) {
  //     if (pGraph.CanDestroyNode(selectedNode.m_pNode) && selectedNode.m_pNode.IsDestroyable()) {
  //       pGraph.DestroyNode(selectedNode.m_nodeID);
  //     }
  //   }

  //   this.ClearSelection();
  // }

  // CreateCommentAroundSelectedNodes (): void {
  //   if (this.m_selectedNodes.length === 0) {
  //     return;
  //   }

  //   // Calculate comment size
  //   const numNodes = this.m_selectedNodes.length;
  //   const selectedNodesRect = new ImRect(
  //     this.m_selectedNodes[0].m_pNode.GetPosition(),
  //     this.m_selectedNodes[0].m_pNode.GetPosition().add(this.m_selectedNodes[0].m_pNode.GetSize())
  //   );

  //   for (let i = 1; i < numNodes; i++) {
  //     const pNode = this.m_selectedNodes[i].m_pNode;

  //     if (pNode.IsVisible()) {
  //       const nodeRect = new ImRect(pNode.GetPosition(), pNode.GetPosition().add(pNode.GetSize()));

  //       selectedNodesRect.Add(nodeRect);
  //     }
  //   }

  //   const commentPadding = new ImVec2(60, 60);
  //   const canvasPos = selectedNodesRect.Min.sub(commentPadding);
  //   const canvasBoxSize = selectedNodesRect.GetSize().add(commentPadding.mul(2));

  //   // Create comment
  //   const sgm = new ScopedGraphModification(this.m_pGraph);
  //   const pCommentNode = this.m_pGraph.CreateNode<CommentNode>();

  //   pCommentNode.m_name = 'Comment';
  //   pCommentNode.m_canvasPosition = canvasPos;
  //   pCommentNode.m_commentBoxSize = canvasBoxSize;
  // }

  // CopySelectedNodes (typeRegistry: TypeRegistry): void {
  //   if (this.m_selectedNodes.length === 0) {
  //     return;
  //   }

  //   // Prepare list of nodes to copy
  //   const nodesToCopy: BaseNode[] = [];

  //   for (const selectedNode of this.m_selectedNodes) {
  //     // Do not copy any selected conduits, as conduits are automatically copied!!!
  //     if (selectedNode.m_pNode instanceof TransitionConduitNode) {
  //       continue;
  //     }

  //     if (selectedNode.m_pNode.IsUserCreatable()) {
  //       nodesToCopy.push(selectedNode.m_pNode);
  //     }
  //   }

  //   // Ensure that all transitions between copied states are also copied
  //   if (this.IsViewingStateMachineGraph()) {
  //     for (const nodeInstance of this.m_pGraph.m_nodes) {
  //       if (nodeInstance instanceof TransitionConduitNode) {
  //         // If the conduit is already copied, then do nothing
  //         if (nodesToCopy.includes(nodeInstance)) {
  //           continue;
  //         }

  //         // If there exists a conduit between two copied states, then serialize it
  //         const wasStartStateCopied = nodesToCopy.some(node => node.GetID().equals(nodeInstance.GetStartStateID()));
  //         const wasEndStateCopied = nodesToCopy.some(node => node.GetID().equals(nodeInstance.GetEndStateID()));

  //         if (wasStartStateCopied && wasEndStateCopied) {
  //           nodesToCopy.push(nodeInstance);
  //         }
  //       }
  //     }
  //   }

  //   // Serialize nodes and connections
  //   const copiedData = new xml_document();
  //   const dataNode = copiedData.append_child(GraphView.s_graphCopiedDataNodeName);

  //   // Serialize nodes
  //   {
  //     const copiedNodesNode = dataNode.append_child(GraphView.s_copiedNodesNodeName);

  //     for (const pNode of nodesToCopy) {
  //       pNode.PreCopy();
  //       Serialization.WriteType(typeRegistry, pNode, copiedNodesNode);
  //     }
  //   }

  //   // Serialize node connections
  //   if (this.IsViewingFlowGraph()) {
  //     const pFlowGraph = this.GetFlowGraph();
  //     const copiedConnectionsNode = dataNode.append_child(GraphView.s_copiedConnectionsNodeName);

  //     for (const connection of pFlowGraph.m_connections) {
  //       const wasFromNodeCopied = nodesToCopy.some(node => node.GetID().equals(connection.m_fromNodeID));
  //       const wasToNodeCopied = nodesToCopy.some(node => node.GetID().equals(connection.m_toNodeID));

  //       if (wasFromNodeCopied && wasToNodeCopied) {
  //         Serialization.WriteType(typeRegistry, connection, copiedConnectionsNode);
  //       }
  //     }
  //   }

  //   const xmlStr = Serialization.WriteXmlToString(copiedData);

  //   ImGui.SetClipboardText(xmlStr);
  // }

  // PasteNodes (typeRegistry: TypeRegistry, canvasPastePosition: ImVec2): void {
  //   if (this.m_pGraph === null) {
  //     throw new Error('Graph is null');
  //   }

  //   if (this.m_isReadOnly) {
  //     return;
  //   }

  //   // Get pasted data
  //   const pClipboardText = ImGui.GetClipboardText();

  //   if (pClipboardText === null) {
  //     return;
  //   }

  //   const document = new xml_document();

  //   if (!Serialization.ReadXmlFromString(pClipboardText, document)) {
  //     return;
  //   }

  //   const copiedDataNode = document.child(GraphView.s_graphCopiedDataNodeName);

  //   if (copiedDataNode.empty()) {
  //     return;
  //   }

  //   // Deserialize pasted nodes and regenerated IDs
  //   const copiedNodesNode = copiedDataNode.child(GraphView.s_copiedNodesNodeName);
  //   const graphNodeNodes: xml_node[] = [];

  //   Serialization.GetAllChildNodes(copiedNodesNode, Serialization.g_typeNodeName, graphNodeNodes);

  //   if (graphNodeNodes.length === 0) {
  //     return;
  //   }

  //   const IDMapping = new Map<UUID, UUID>();
  //   const pastedNodes: BaseNode[] = [];

  //   for (const graphNodeNode of copiedNodesNode.children()) {
  //     const pPastedNode = Serialization.TryCreateAndReadType(typeRegistry, graphNodeNode) as BaseNode;

  //     if (this.m_pGraph.CanCreateNode(pPastedNode.GetTypeInfo())) {
  //       // Set parent graph ptr
  //       pPastedNode.m_pParentGraph = this.m_pGraph;

  //       // Set child graph parent ptrs
  //       if (pPastedNode.HasChildGraph()) {
  //         pPastedNode.GetChildGraph().m_pParentNode = pPastedNode;
  //       }

  //       // Set secondary graph parent ptrs
  //       if (pPastedNode.HasSecondaryGraph()) {
  //         pPastedNode.GetSecondaryGraph().m_pParentNode = pPastedNode;
  //       }

  //       pPastedNode.RegenerateIDs(IDMapping);
  //       pPastedNode.PostPaste();
  //       pastedNodes.push(pPastedNode);
  //     } else {
  //       pPastedNode.m_pParentGraph = null;
  //       pPastedNode.m_ID.Clear();
  //       // In TypeScript, we don't need to explicitly delete objects
  //     }
  //   }

  //   if (pastedNodes.length === 0) {
  //     return;
  //   }

  //   // Add nodes to the graph
  //   if (this.m_isReadOnly) {
  //     throw new Error('Graph is read-only');
  //   }
  //   this.m_pGraph.BeginModification();

  //   for (const pPastedNode of pastedNodes) {
  //     if (pPastedNode.m_pParentGraph !== this.m_pGraph) {
  //       throw new Error('Pasted node\'s parent graph is incorrect');
  //     }
  //     if (pPastedNode.IsRenameable()) {
  //       pPastedNode.Rename(pPastedNode.GetName()); // Ensures a unique name if needed
  //     }
  //     this.m_pGraph.m_nodes.push(pPastedNode);
  //     this.m_pGraph.OnNodeAdded(pPastedNode);
  //   }

  //   // Serialize and fix connections
  //   if (this.IsViewingFlowGraph()) {
  //     const pFlowGraph = this.GetFlowGraph();
  //     const copiedConnectionsNode = copiedDataNode.child(GraphView.s_copiedConnectionsNodeName);
  //     const connectionNodes: xml_node[] = [];

  //     Serialization.GetAllChildNodes(copiedConnectionsNode, Serialization.g_typeNodeName, connectionNodes);

  //     for (const connectionNode of connectionNodes) {
  //       const pPastedConnection = Serialization.TryCreateAndReadType(typeRegistry, connectionNode) as FlowGraph.Connection;

  //       pPastedConnection.m_fromNodeID = IDMapping.get(pPastedConnection.m_fromNodeID) ?? pPastedConnection.m_fromNodeID;
  //       pPastedConnection.m_outputPinID = IDMapping.get(pPastedConnection.m_outputPinID) ?? pPastedConnection.m_outputPinID;
  //       pPastedConnection.m_toNodeID = IDMapping.get(pPastedConnection.m_toNodeID) ?? pPastedConnection.m_toNodeID;
  //       pPastedConnection.m_inputPinID = IDMapping.get(pPastedConnection.m_inputPinID) ?? pPastedConnection.m_inputPinID;

  //       if (pFlowGraph.IsValidConnection(pPastedConnection.m_fromNodeID, pPastedConnection.m_outputPinID, pPastedConnection.m_toNodeID, pPastedConnection.m_inputPinID)) {
  //         pFlowGraph.m_connections.push(pPastedConnection);
  //       }

  //       // In TypeScript, we don't need to explicitly delete objects
  //     }
  //   } else { // State Machine
  //     for (const pPastedNode of pastedNodes) {
  //       if (pPastedNode instanceof TransitionConduitNode) {
  //         pPastedNode.m_startStateID = IDMapping.get(pPastedNode.m_startStateID) ?? pPastedNode.m_startStateID;
  //         pPastedNode.m_endStateID = IDMapping.get(pPastedNode.m_endStateID) ?? pPastedNode.m_endStateID;
  //       }
  //     }
  //   }

  //   // Updated pasted node positions
  //   let leftMostNodePosition = new ImVec2(Number.MAX_VALUE, Number.MAX_VALUE);

  //   for (const pPastedNode of pastedNodes) {
  //     if (pPastedNode.GetPosition().x < leftMostNodePosition.x) {
  //       leftMostNodePosition = pPastedNode.GetPosition();
  //     }
  //   }

  //   for (const pPastedNode of pastedNodes) {
  //     pPastedNode.SetPosition(pPastedNode.GetPosition().sub(leftMostNodePosition).add(new ImVec2(canvasPastePosition.x, canvasPastePosition.y)));
  //   }

  //   // Notify graph that nodes were pasted
  //   this.m_pGraph.PostPasteNodes(pastedNodes);
  //   this.m_pUserContext.NotifyNodesPasted(pastedNodes);
  //   this.m_pGraph.EndModification();
  // }

  private BeginRenameNode (pNode: BaseNode): void {
    if (pNode === null || !pNode.IsRenameable()) {
      throw new Error('Node is null or not renameable');
    }
    this.m_textBuffer = pNode.GetName();
    this.m_pNodeBeingOperatedOn = pNode;
  }

  //   private EndRenameNode (shouldUpdateNode: boolean): void {
  //     if (this.m_pNodeBeingOperatedOn === null || !this.m_pNodeBeingOperatedOn.IsRenameable()) {
  //       throw new Error('Node being operated on is null or not renameable');
  //     }

  //     if (shouldUpdateNode) {
  //       if (this.m_isReadOnly) {
  //         throw new Error('Graph is read-only');
  //       }
  //       const snm = new ScopedNodeModification(this.m_pNodeBeingOperatedOn);
  //       const pParentGraph = this.m_pNodeBeingOperatedOn.GetParentGraph();

  //       this.m_pNodeBeingOperatedOn.Rename(this.m_textBuffer);

  //       if (this.m_pNodeBeingOperatedOn instanceof CommentNode) {
  //         // Do nothing special for comment nodes
  //       } else {
  //         const uniqueName = pParentGraph.GetUniqueNameForRenameableNode(this.m_textBuffer, this.m_pNodeBeingOperatedOn);

  //         this.m_pNodeBeingOperatedOn.Rename(uniqueName);
  //       }
  //     }

  //     this.m_pNodeBeingOperatedOn = null;
  //   }

  private StartDraggingView (ctx: DrawContext): void {
    if (this.m_dragState.m_mode !== DragMode.None) {
      throw new Error('Drag state is not None');
    }
    this.m_dragState.m_mode = DragMode.View;
    this.m_dragState.m_startValue = new ImVec2().Copy(this.m_pViewOffset);
  }

  private OnDragView (ctx: DrawContext): void {
    if (this.m_dragState.m_mode !== DragMode.View) {
      throw new Error('Drag state is not View');
    }

    let mouseDragDelta = new ImVec2(0, 0);

    if (ImGui.IsMouseDown(ImGui.MouseButton.Right)) {
      mouseDragDelta = ImGui.GetMouseDragDelta(ImGui.MouseButton.Right);
    } else if (ImGui.IsMouseDown(ImGui.MouseButton.Middle)) {
      mouseDragDelta = ImGui.GetMouseDragDelta(ImGui.MouseButton.Middle);
    } else {
      this.StopDraggingView(ctx);

      return;
    }

    this.m_dragState.m_lastFrameDragDelta = mouseDragDelta;

    this.m_pViewOffset = subtract(this.m_dragState.m_startValue, ctx.WindowToCanvas(mouseDragDelta));
  }

  private StopDraggingView (ctx: DrawContext): void {
    this.m_dragState.Reset();
  }

  private StartDraggingSelection (ctx: DrawContext): void {
    if (this.m_pGraph === null) {
      throw new Error('Graph is null');
    }
    if (this.m_dragState.m_mode !== DragMode.None) {
      throw new Error('Drag state is not None');
    }
    this.m_dragState.m_mode = DragMode.Selection;
    this.m_dragState.m_startValue = ImGui.GetMousePos();
  }

  private OnDragSelection (ctx: DrawContext): void {
    if (this.m_pGraph === null) {
      throw new Error('Graph is null');
    }

    if (!ImGui.IsMouseDown(ImGui.MouseButton.Left)) {
      this.StopDraggingSelection(ctx);

      return;
    }

    ctx.m_pDrawList!.AddRectFilled(this.m_dragState.m_startValue, ImGui.GetMousePos(), g_selectionBoxFillColor.toImU32());
    ctx.m_pDrawList!.AddRect(this.m_dragState.m_startValue, ImGui.GetMousePos(), g_selectionBoxOutlineColor.toImU32());
  }

  private StopDraggingSelection (ctx: DrawContext): void {
    if (this.m_pGraph === null) {
      throw new Error('Graph is null');
    }

    const mousePos = ImGui.GetMousePos();
    const min = new ImVec2(Math.min(this.m_dragState.m_startValue.x, mousePos.x), Math.min(this.m_dragState.m_startValue.y, mousePos.y));
    const max = new ImVec2(Math.max(this.m_dragState.m_startValue.x, mousePos.x), Math.max(this.m_dragState.m_startValue.y, mousePos.y));
    const selectionWindowRect = new ImRect(subtract(min, ctx.m_windowRect.Min), subtract(max, ctx.m_windowRect.Min));

    const newSelection: SelectedNode[] = [];

    for (const nodeInstance of this.GetViewedGraph()!.m_nodes) {
      const nodeWindowRect = ctx.CanvasToWindowRect(nodeInstance.GetRect());

      if (!nodeWindowRect.Contains(selectionWindowRect)) {
        if (selectionWindowRect.Overlaps(nodeWindowRect)) {
          newSelection.push(new SelectedNode(nodeInstance));
        }
      }
    }

    this.UpdateSelection(newSelection);
    this.m_dragState.Reset();
  }

  private StartDraggingNode (ctx: DrawContext): void {
    if (this.m_isReadOnly) {
      throw new Error('Graph is read-only');
    }
    if (this.m_dragState.m_mode !== DragMode.None) {
      throw new Error('Drag state is not None');
    }
    if (this.m_dragState.m_pNode === null) {
      throw new Error('Drag state node is null');
    }

    this.m_dragState.m_mode = DragMode.Node;
    this.m_dragState.m_startValue = this.m_dragState.m_pNode.GetPosition();

    const ProcessCommentNode = (pCommentNode: CommentNode) => {
      const unscaledCommentRect = pCommentNode.GetRect();

      for (const nodeInstance of this.m_pGraph!.m_nodes) {
        if (unscaledCommentRect.Contains(nodeInstance.GetRect())) {
          if (!this.m_dragState.m_draggedNodes.includes(nodeInstance)) {
            this.m_dragState.m_draggedNodes.push(nodeInstance);
          }
        }
      }
    };

    // Create the dragged set of nodes
    for (const selectedNode of this.m_selectedNodes) {
      if (!this.m_dragState.m_draggedNodes.includes(selectedNode.m_pNode!)) {
        this.m_dragState.m_draggedNodes.push(selectedNode.m_pNode!);
      }

      // Add all enclosed nodes to the dragged set
      if (selectedNode.m_pNode instanceof CommentNode) {
        ProcessCommentNode(selectedNode.m_pNode);
      }
    }

    // Add any child comments nodes as well
    for (let i = 0; i < this.m_dragState.m_draggedNodes.length; i++) {
      if (this.m_dragState.m_draggedNodes[i] instanceof CommentNode) {
        ProcessCommentNode(this.m_dragState.m_draggedNodes[i] as CommentNode);
      }
    }

    this.GetViewedGraph()!.BeginModification();
  }

  private OnDragNode (ctx: DrawContext): void {
    if (this.m_isReadOnly) {
      throw new Error('Graph is read-only');
    }
    if (this.m_dragState.m_mode !== DragMode.Node) {
      throw new Error('Drag state is not Node');
    }

    if (!ImGui.IsMouseDown(ImGui.MouseButton.Left)) {
      this.StopDraggingNode(ctx);

      return;
    }

    const mouseDragDelta = ImGui.GetMouseDragDelta(ImGui.MouseButton.Left);

    if (ctx.m_viewScaleFactor === 0) {
      throw new Error('View scale factor is zero');
    }
    const canvasFrameDragDelta = ctx.WindowToCanvas(subtract(mouseDragDelta, this.m_dragState.m_lastFrameDragDelta));

    this.m_dragState.m_lastFrameDragDelta = mouseDragDelta;

    for (const pDraggedNode of this.m_dragState.m_draggedNodes) {
      pDraggedNode.SetPosition(add(pDraggedNode.GetPosition(), canvasFrameDragDelta));
    }
  }

  private StopDraggingNode (ctx: DrawContext): void {
    if (this.m_isReadOnly) {
      throw new Error('Graph is read-only');
    }
    this.m_dragState.Reset();
    this.GetViewedGraph()!.EndModification();
  }

  private TryGetAutoConnectionNodeAndPin (ctx: DrawContext): [FlowNode | null, Pin | null] {
    const pFlowGraph = this.GetFlowGraph()!;
    const pDraggedFlowNode = this.m_dragState.GetAsFlowNode();
    const autoConnectThreshold = ctx.m_viewScaleFactor * g_autoConnectMaxDistanceThreshold;

    let pOutNode: FlowNode | null = null;
    let pOutPin: Pin | null = null;

    // Find nodes within detection distance
    const options: FlowNode[] = [];

    for (const pNode of pFlowGraph.m_nodes) {
      if (this.m_dragState.m_pNode === pNode) {
        continue;
      }

      const closestPointToRect = ImGuiX.GetClosestPointOnRectBorder(pNode.GetRect(), ctx.m_mouseCanvasPos);
      const distanceToNodeRect = length(subtract(new ImVec2().Copy(closestPointToRect), ctx.m_mouseCanvasPos));

      if (distanceToNodeRect < autoConnectThreshold) {
        options.push(pNode as FlowNode);
      }
    }

    // Find closest pin on across all options
    if (options.length > 0) {
      let closestValidPinDistance = Number.MAX_VALUE;

      const EvaluatePinOption = (pNode: FlowNode, pin: Pin) => {
        const distanceToPin = length(subtract(pin.m_position, ctx.m_mouseScreenPos));

        if (distanceToPin < autoConnectThreshold && distanceToPin < closestValidPinDistance) {
          closestValidPinDistance = distanceToPin;
          pOutNode = pNode;
          pOutPin = pin;
        }
      };

      for (const pOptionNode of options) {
        const draggedPinDirection = (this.m_dragState.m_pNode as FlowNode).GetPinDirection(this.m_dragState.m_pPin!);

        if (draggedPinDirection === PinDirection.Output) {
          for (const pin of pOptionNode.GetInputPins()) {
            if (pFlowGraph.IsValidConnection(pDraggedFlowNode!, this.m_dragState.m_pPin!, pOptionNode, pin)) {
              EvaluatePinOption(pOptionNode, pin);
            }
          }
        } else { // Dragging an input pin
          for (const pin of pOptionNode.GetOutputPins()) {
            if (pFlowGraph.IsValidConnection(pOptionNode, pin, pDraggedFlowNode!, this.m_dragState.m_pPin!)) {
              EvaluatePinOption(pOptionNode, pin);
            }
          }
        }
      }
    }

    return [pOutNode, pOutPin];
  }

  private StartDraggingConnection (ctx: DrawContext): void {
    if (this.m_isReadOnly) {
      throw new Error('Graph is read-only');
    }
    if (this.m_dragState.m_mode !== DragMode.None) {
      throw new Error('Drag state is not None');
    }
    if (this.m_dragState.m_pNode === null) {
      throw new Error('Drag state node is null');
    }

    this.m_dragState.m_mode = DragMode.Connection;

    if (this.IsViewingStateMachineGraph()) {
      this.m_dragState.m_startValue = ctx.CanvasToScreenPosition(this.m_dragState.m_pNode.GetPosition());
    } else {
      this.m_dragState.m_startValue = this.m_dragState.m_pPin!.m_position;
    }
  }

  private OnDragConnection (ctx: DrawContext): void {
    if (this.m_isReadOnly) {
      throw new Error('Graph is read-only');
    }
    if (this.m_dragState.m_mode !== DragMode.Connection) {
      throw new Error('Drag state is not Connection');
    }

    const IO = ImGui.GetIO();

    if (!ImGui.IsMouseDown(ImGui.MouseButton.Left)) {
      this.StopDraggingConnection(ctx);

      return;
    }

    if (this.IsViewingStateMachineGraph()) {
      const pStateMachineGraph = this.GetStateMachineGraph();
      const pEndState = this.m_pHoveredNode instanceof StateNode ? this.m_pHoveredNode : null;

      const isValidConnection = pEndState !== null && pStateMachineGraph!.CanCreateTransitionConduit(this.m_dragState.m_pNode as StateNode, pEndState);
      const connectionColor = isValidConnection ? Style.s_connectionColorValid : Style.s_connectionColorInvalid;

      ImGuiX.DrawArrow(ctx.m_pDrawList!, ctx.CanvasToScreenPosition(this.m_dragState.m_pNode!.GetRect().GetCenter()), ctx.m_mouseScreenPos, connectionColor, g_transitionArrowWidth);
    } else {
      const pFlowGraph = this.GetFlowGraph();
      const pDraggedFlowNode = this.m_dragState.GetAsFlowNode();
      let connectionColor = pDraggedFlowNode!.GetPinColor(this.m_dragState.m_pPin!);

      // Auto connection
      if (IO.KeyAlt) {
        const [pAutoConnectNode, pAutoConnectPin] = this.TryGetAutoConnectionNodeAndPin(ctx);

        if (pAutoConnectPin !== null) {
          ctx.m_pDrawList!.AddLine(ctx.m_mouseScreenPos, pAutoConnectPin.m_position, new Color(0.678, 1.000, 0.184, 0.85).toImU32(), 4.0 * ctx.m_viewScaleFactor);
        }
      }

      // Validity check for hovered pin
      if (this.m_pHoveredPin !== null) {
        const pHoveredFlowNode = this.m_pHoveredNode as FlowNode;
        const hoveredPinDirection = pHoveredFlowNode.GetPinDirection(this.m_pHoveredPin);
        const draggedPinDirection = (this.m_dragState.m_pNode as FlowNode).GetPinDirection(this.m_dragState.m_pPin!);

        // Trying to make an invalid connection to a pin with the same direction or the same node
        if (hoveredPinDirection === draggedPinDirection || this.m_pHoveredNode === this.m_dragState.m_pNode) {
          connectionColor = Style.s_connectionColorInvalid;
        } else { // Check connection validity
          if (draggedPinDirection === PinDirection.Output) {
            if (!pFlowGraph!.IsValidConnection(pDraggedFlowNode!, this.m_dragState.m_pPin!, pHoveredFlowNode, this.m_pHoveredPin)) {
              connectionColor = Style.s_connectionColorInvalid;
            }
          } else { // The hovered pin is the output pin
            if (!pFlowGraph!.IsValidConnection(pHoveredFlowNode, this.m_pHoveredPin, pDraggedFlowNode!, this.m_dragState.m_pPin!)) {
              connectionColor = Style.s_connectionColorInvalid;
            }
          }
        }
      }

      const invertOrder = this.m_dragState.m_pPin!.m_position.x > ctx.m_mouseScreenPos.x;
      const p1 = invertOrder ? ctx.m_mouseScreenPos : this.m_dragState.m_pPin!.m_position;
      const p2 = invertOrder ? this.m_dragState.m_pPin!.m_position : ctx.m_mouseScreenPos;

      ctx.m_pDrawList!.AddBezierCubic(p1, add(p1, new ImVec2(50, 0)), add(p2, new ImVec2(-50, 0)), p2, connectionColor.toImU32(), 3.0 * ctx.m_viewScaleFactor);
    }
  }

  private StopDraggingConnection (ctx: DrawContext): void {
    if (this.m_isReadOnly) {
      throw new Error('Graph is read-only');
    }

    if (this.IsViewingStateMachineGraph()) {
      const pStateMachineGraph = this.GetStateMachineGraph();
      const pStartState = this.m_dragState.m_pNode as StateNode;
      const pEndState = this.m_pHoveredNode instanceof StateNode ? this.m_pHoveredNode : null;

      if (pEndState !== null && pStateMachineGraph!.CanCreateTransitionConduit(pStartState, pEndState)) {
        const sgm = new ScopedGraphModification(pStateMachineGraph!);

        pStateMachineGraph!.CreateTransitionConduit(pStartState, pEndState);

        sgm.End();
      }
    } else {
      const pFlowGraph = this.GetFlowGraph()!;

      if (this.m_pHoveredPin !== null) {
        const pHoveredFlowNode = this.m_pHoveredNode as FlowNode;
        const hoveredPinDirection = pHoveredFlowNode.GetPinDirection(this.m_pHoveredPin);
        const draggedPinDirection = (this.m_dragState.m_pNode as FlowNode).GetPinDirection(this.m_dragState.m_pPin!);

        if (hoveredPinDirection !== draggedPinDirection) {
          if (draggedPinDirection === PinDirection.Output) {
            pFlowGraph.TryMakeConnection(this.m_dragState.GetAsFlowNode()!, this.m_dragState.m_pPin!, pHoveredFlowNode, this.m_pHoveredPin);
          } else { // The hovered pin is the output pin
            pFlowGraph.TryMakeConnection(pHoveredFlowNode, this.m_pHoveredPin, this.m_dragState.GetAsFlowNode()!, this.m_dragState.m_pPin!);
          }
        }
      } else {
        // Auto connection
        let showNodeCreationMenu = true;
        const IO = ImGui.GetIO();

        if (IO.KeyAlt) {
          const [pAutoConnectNode, pAutoConnectPin] = this.TryGetAutoConnectionNodeAndPin(ctx);

          if (pAutoConnectPin !== null) {
            const draggedPinDirection = (this.m_dragState.m_pNode as FlowNode).GetPinDirection(this.m_dragState.m_pPin!);

            if (draggedPinDirection === PinDirection.Output) {
              pFlowGraph.TryMakeConnection(this.m_dragState.GetAsFlowNode()!, this.m_dragState.m_pPin!, pAutoConnectNode!, pAutoConnectPin);
            } else { // The auto-connect pin is the output pin
              pFlowGraph.TryMakeConnection(pAutoConnectNode!, pAutoConnectPin, this.m_dragState.GetAsFlowNode()!, this.m_dragState.m_pPin!);
            }

            showNodeCreationMenu = false;
          }
        }

        // Node Creation
        if (showNodeCreationMenu && pFlowGraph.SupportsNodeCreationFromConnection()) {
          this.m_contextMenuState.m_pNode = this.m_dragState.m_pNode;
          this.m_contextMenuState.m_pPin = this.m_dragState.m_pPin;
          this.m_contextMenuState.m_requestOpenMenu = true;
          this.m_contextMenuState.m_isAutoConnectMenu = true;
        }
      }
    }

    this.m_dragState.Reset();
  }

  private StartResizingCommentBox (ctx: DrawContext): void {
    if (this.m_isReadOnly) {
      throw new Error('Graph is read-only');
    }
    if (this.m_dragState.m_mode !== DragMode.None) {
      throw new Error('Drag state is not None');
    }
    if (this.m_dragState.m_pNode === null) {
      throw new Error('Drag state node is null');
    }
    this.m_dragState.m_mode = DragMode.ResizeComment;

    this.GetViewedGraph()!.BeginModification();
  }

  private OnResizeCommentBox (ctx: DrawContext): void {
    if (!ImGui.IsMouseDown(ImGui.MouseButton.Left)) {
      this.StopResizingCommentBox(ctx);

      return;
    }

    if (this.m_dragState.m_mode !== DragMode.ResizeComment) {
      throw new Error('Drag state is not ResizeComment');
    }
    if (this.m_dragState.m_pNode === null) {
      throw new Error('Drag state node is null');
    }
    if (this.m_dragState.m_resizeHandle === ResizeHandle.None) {
      throw new Error('Resize handle is None');
    }

    const pCommentNode = this.m_dragState.m_pNode as CommentNode;

    pCommentNode.AdjustSizeBasedOnMousePosition(ctx, this.m_dragState.m_resizeHandle);
  }

  private StopResizingCommentBox (ctx: DrawContext): void {
    if (this.m_isReadOnly) {
      throw new Error('Graph is read-only');
    }
    this.m_dragState.Reset();
    this.GetViewedGraph()!.EndModification();
  }

  private HandleInput (ctx: DrawContext): void {
    const IO = ImGui.GetIO();

    if (this.m_pGraph === null) {
      return;
    }

    // Zoom
    if (this.m_isViewHovered && IO.MouseWheel !== 0) {
      const desiredViewScale = clamp(this.m_pGraph.m_viewScaleFactor + IO.MouseWheel * 0.05, 0.2, 1.4);

      this.ChangeViewScale(ctx, desiredViewScale);
    }

    // Allow selection without focus
    if (this.m_isViewHovered) {
      if (ImGui.IsMouseClicked(ImGui.MouseButton.Left)) {
        if (IO.KeyCtrl || IO.KeyShift) {
          if (this.m_pHoveredNode !== null) {
            if (this.IsNodeSelected(this.m_pHoveredNode)) {
              this.RemoveFromSelection(this.m_pHoveredNode);
            } else {
              this.AddToSelection(this.m_pHoveredNode);
            }
          }
        } else if (IO.KeyAlt) {
          if (!this.m_isReadOnly) {
            if (this.IsViewingFlowGraph()) {
              const pFlowGraph = this.GetFlowGraph()!;

              if (this.m_hoveredConnectionID !== '') {
                pFlowGraph.BreakConnection(this.m_hoveredConnectionID);
              } else if (this.m_pHoveredPin !== null) {
                pFlowGraph.BreakAnyConnectionsForPin(this.m_pHoveredPin.m_ID);
              }
            } else { // State Machine
              if (this.m_pHoveredNode !== null && this.m_pHoveredNode instanceof TransitionConduitNode) {
                this.ClearSelection();
                this.m_pGraph.DestroyNode(this.m_pHoveredNode.GetID());
                this.m_pHoveredNode = null;
              }
            }
          }
        } else { // No modifier
          if (this.m_pHoveredNode !== null) {
            if (!this.IsNodeSelected(this.m_pHoveredNode)) {
              this.UpdateSelection(this.m_pHoveredNode);
            }
          } else if (this.m_isViewHovered) {
            this.ClearSelection();
          }
        }

        this.m_requestFocus = true;
      }
    }

    // Double Clicks
    if (this.m_isViewHovered) {
      if (ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left)) {
        if (this.m_pHoveredNode !== null) {
          if (this.m_pHoveredNode instanceof CommentNode) {
            this.BeginRenameNode(this.m_pHoveredNode);
          } else {
            const pNavChildGraph = this.m_pHoveredNode.GetNavigationTarget();

            if (pNavChildGraph !== null) {
              this.m_pUserContext.NavigateTo(pNavChildGraph);
            } else {
              this.m_pUserContext.DoubleClick(this.m_pHoveredNode);
            }
          }
        } else {
          if (this.m_pGraph !== null) {
            const pNavParentGraph = this.m_pGraph.GetNavigationTarget();

            if (pNavParentGraph !== null) {
              this.m_pUserContext.NavigateTo(pNavParentGraph);
            } else {
              this.m_pUserContext.DoubleClick(this.m_pGraph);
            }
          }
        }

        this.m_requestFocus = true;
      }
    }

    // Dragging
    switch (this.m_dragState.m_mode) {
      case DragMode.None:
        if (this.m_isViewHovered) {
          // Update drag state resize handle
          if (!this.m_dragState.m_dragReadyToStart) {
            const pCommentNode = this.m_pHoveredNode instanceof CommentNode ? this.m_pHoveredNode : null;

            if (pCommentNode !== null) {
              this.m_dragState.m_resizeHandle = pCommentNode.GetHoveredResizeHandle(ctx);
            } else {
              this.m_dragState.m_resizeHandle = ResizeHandle.None;
            }
          }

          // Prepare drag state - this needs to be done in advance since we only start the drag operation once we detect a mouse drag and at that point we might not be hovered over the node anymore
          if (this.m_dragState.m_dragReadyToStart) {
            if (!(ImGui.IsMouseDown(ImGui.MouseButton.Left) || ImGui.IsMouseDown(ImGui.MouseButton.Right) || ImGui.IsMouseDown(ImGui.MouseButton.Middle))) {
              this.m_dragState.m_pNode = null;
              this.m_dragState.m_pPin = null;
              this.m_dragState.m_dragReadyToStart = false;
            }
          } else {
            if (ImGui.IsMouseClicked(ImGui.MouseButton.Left) || ImGui.IsMouseClicked(ImGui.MouseButton.Right) || ImGui.IsMouseClicked(ImGui.MouseButton.Middle)) {
              this.m_dragState.m_pNode = this.m_pHoveredNode;
              this.m_dragState.m_pPin = this.m_pHoveredPin;
              this.m_dragState.m_dragReadyToStart = true;
              this.m_requestFocus = true;
            }
          }

          // Check for drag inputs
          if (this.m_dragState.m_dragReadyToStart) {
            const nodeDragInput = ImGui.IsMouseDragging(ImGui.MouseButton.Left, 3);
            const viewDragInput = ImGui.IsMouseDragging(ImGui.MouseButton.Right, 3) || ImGui.IsMouseDragging(ImGui.MouseButton.Middle, 3);

            if (nodeDragInput) {
              if (!this.IsReadOnly()) {
                const pCommentNode = this.m_dragState.m_pNode instanceof CommentNode ? this.m_dragState.m_pNode : null;

                if (pCommentNode !== null) {
                  if (this.m_dragState.m_resizeHandle === ResizeHandle.None) {
                    this.StartDraggingNode(ctx);
                  } else {
                    this.StartResizingCommentBox(ctx);
                  }
                } else if (this.IsViewingFlowGraph()) {
                  if (this.m_dragState.m_pNode !== null) {
                    if (this.m_dragState.m_pPin !== null) {
                      this.StartDraggingConnection(ctx);
                    } else {
                      this.StartDraggingNode(ctx);
                    }
                  } else {
                    if (this.m_pGraph !== null) {
                      this.StartDraggingSelection(ctx);
                    }
                  }
                } else { // State Machine
                  if (this.m_dragState.m_pNode !== null) {
                    if (IO.KeyAlt && this.m_dragState.m_pNode instanceof StateNode) {
                      this.StartDraggingConnection(ctx);
                    } else if (!(this.m_dragState.m_pNode instanceof TransitionConduitNode)) {
                      this.StartDraggingNode(ctx);
                    }
                  } else {
                    if (this.m_pGraph !== null) {
                      this.StartDraggingSelection(ctx);
                    }
                  }
                }
              }
            } else if (viewDragInput) {
              this.StartDraggingView(ctx);
            } else if (ImGui.IsMouseReleased(ImGui.MouseButton.Right)) {
              this.m_contextMenuState.m_requestOpenMenu = true;
            }

            this.m_requestFocus = true;
          } else if (ImGui.IsMouseReleased(ImGui.MouseButton.Right)) {
            this.m_contextMenuState.m_requestOpenMenu = true;
          }
        }

        break; case DragMode.Node:
        this.OnDragNode(ctx);

        break; case DragMode.Connection:
        this.OnDragConnection(ctx);

        break; case DragMode.Selection:
        this.OnDragSelection(ctx);

        break; case DragMode.View:
        this.OnDragView(ctx);

        break; case DragMode.ResizeComment:
        this.OnResizeCommentBox(ctx);

        break;
    }

    // Mouse Cursor
    if (this.IsDraggingView()) {
      ImGui.SetMouseCursor(ImGui.MouseCursor.Hand);
    } else { // Change cursor to match current resize state
      switch (this.m_dragState.m_resizeHandle) {
        case ResizeHandle.N:
          ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeNS);

          break;
        case ResizeHandle.NW:
          ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeNWSE);

          break;
        case ResizeHandle.W:
          ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW);

          break;
        case ResizeHandle.SW:
          ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeNESW);

          break;
        case ResizeHandle.S:
          ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeNS);

          break;
        case ResizeHandle.SE:
          ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeNWSE);

          break;
        case ResizeHandle.E:
          ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW);

          break;
        case ResizeHandle.NE:
          ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeNESW);

          break;
        default:
          break;
      }
    }

    // Keyboard
    // These operations require the graph view to be focused!
    // if (this.m_hasFocus) {
    //   // General operations
    //   if (IO.KeyCtrl && ImGui.IsKeyPressed(ImGui.Key.C)) {
    //     this.CopySelectedNodes(typeRegistry);
    //   }

    //   // Operations that modify the graph
    //   if (!this.m_isReadOnly) {
    //     if (ImGui.IsKeyPressed(ImGui.Key.F2)) {
    //       if (this.m_selectedNodes.length === 1 && this.m_selectedNodes[0].m_pNode.IsRenameable()) {
    //         this.BeginRenameNode(this.m_selectedNodes[0].m_pNode);
    //       }
    //     } else if (IO.KeyCtrl && ImGui.IsKeyPressed(ImGuiKey.X)) {
    //       this.CopySelectedNodes(typeRegistry);
    //       this.DestroySelectedNodes();
    //     } else if (IO.KeyCtrl && ImGui.IsKeyPressed(ImGuiKey.V)) {
    //       let pasteLocation = new ImVec2(0.0, 0.0);

    //       if (this.m_isViewHovered) {
    //         pasteLocation = ctx.m_mouseCanvasPos;
    //       } else {
    //         pasteLocation = ctx.m_canvasVisibleRect.GetCenter();
    //       }

    //       this.PasteNodes(typeRegistry, pasteLocation);
    //     }

    //     if (this.m_selectedNodes.length > 0) {
    //       if (!ImGui.IsAnyItemActive() && ImGui.IsKeyPressed(ImGui.Key.Delete)) {
    //         this.DestroySelectedNodes();
    //       }

    //       if (IO.KeyShift && ImGui.IsKeyPressed(ImGui.Key.C)) {
    //         this.CreateCommentAroundSelectedNodes();
    //       }
    //     }
    //   }
    // }
  }

  //   private HandleContextMenu (ctx: DrawContext): void {
  //     if (this.m_pGraph === null) {
  //       return;
  //     }

  //     if (this.m_isViewHovered && !this.m_contextMenuState.m_menuOpened && this.m_contextMenuState.m_requestOpenMenu) {
  //       this.m_contextMenuState.m_mouseCanvasPos = ctx.m_mouseCanvasPos;
  //       this.m_contextMenuState.m_menuOpened = true;

  //       // If this isn't an auto-connect request, then use the hovered data
  //       if (!this.m_contextMenuState.m_isAutoConnectMenu) {
  //         this.m_contextMenuState.m_pNode = this.m_pHoveredNode;
  //         this.m_contextMenuState.m_pPin = this.m_pHoveredPin;
  //       }

  //       // If we are opening a context menu for a node, set that node as selected
  //       if (this.m_contextMenuState.m_pNode !== null) {
  //         this.UpdateSelection(this.m_contextMenuState.m_pNode);
  //       }

  //       ImGui.OpenPopupEx(ImGui.GetID('GraphContextMenu'));
  //     }

  //     this.m_contextMenuState.m_requestOpenMenu = false;

  //     if (this.IsContextMenuOpen()) {
  //       ImGui.PushStyleVar(ImGuiStyleVar.WindowPadding, new ImVec2(8, 8));
  //       ImGui.PushStyleVar(ImGuiStyleVar.ItemSpacing, new ImVec2(4, 8));
  //       if (ImGui.BeginPopupContextItem('GraphContextMenu')) {
  //         if (this.m_contextMenuState.m_pNode instanceof CommentNode) {
  //           this.DrawCommentContextMenu(ctx);
  //         } else if (this.IsViewingFlowGraph()) {
  //           this.DrawFlowGraphContextMenu(ctx);
  //         } else if (this.IsViewingStateMachineGraph()) {
  //           this.DrawStateMachineContextMenu(ctx);
  //         }

  //         ImGui.EndPopup();
  //       } else { // Close menu
  //         ImGui.SetWindowFocus();
  //         this.m_contextMenuState.Reset();
  //       }
  //       ImGui.PopStyleVar(2);
  //     }
  //   }

  //   private DrawSharedContextMenuOptions (ctx: DrawContext): void {
  //     // View
  //     if (ImGui.MenuItem(EE_ICON_FIT_TO_PAGE_OUTLINE + ' Reset View')) {
  //       this.ResetView();
  //     }

  //     // Zoom
  //     if (this.m_pGraph !== null) {
  //       if (this.m_pGraph.m_viewScaleFactor !== 1.0) {
  //         if (ImGui.MenuItem(EE_ICON_MAGNIFY + ' Reset Zoom')) {
  //           this.ChangeViewScale(ctx, 1.0);
  //         }
  //       }
  //     }

  //     // Add comment node
  //     if (this.m_pGraph.SupportsComments()) {
  //       if (ImGui.MenuItem(EE_ICON_COMMENT + ' Add Comment')) {
  //         const pCommentNode = this.m_pGraph.CreateNode<CommentNode>();

  //         pCommentNode.m_name = 'Comment';
  //         pCommentNode.m_canvasPosition = this.m_contextMenuState.m_mouseCanvasPos;
  //         pCommentNode.m_commentBoxSize = new ImVec2(100, 100);
  //       }
  //     }
  //   }

  //   private DrawCommentContextMenu (ctx: DrawContext): void {
  //     const pCommentNode = this.m_contextMenuState.m_pNode as CommentNode;

  //     if (ImGui.MenuItem(EE_ICON_COMMENT + ' Edit Comment')) {
  //       this.BeginRenameNode(this.m_selectedNodes[0].m_pNode);
  //     }

  //     if (pCommentNode.DrawContextMenuOptions(ctx, this.m_pUserContext, this.m_contextMenuState.m_mouseCanvasPos)) {
  //       this.m_contextMenuState.Reset();
  //       ImGui.CloseCurrentPopup();
  //     }
  //   }

  //   private DrawFlowGraphContextMenu (ctx: DrawContext): void {
  //     if (!this.IsViewingFlowGraph()) {
  //       throw new Error('Not viewing flow graph');
  //     }

  //     const pFlowGraph = this.GetFlowGraph();

  //     // Node Menu
  //     if (!this.m_contextMenuState.m_isAutoConnectMenu && this.m_contextMenuState.m_pNode !== null) {
  //       if (this.m_contextMenuState.m_pNode instanceof CommentNode) {
  //         throw new Error('Unexpected comment node');
  //       }

  //       const pFlowNode = this.m_contextMenuState.GetAsFlowNode();

  //       // Default node Menu
  //       pFlowNode.DrawContextMenuOptions(ctx, this.m_pUserContext, this.m_contextMenuState.m_mouseCanvasPos, this.m_contextMenuState.m_pPin);

  //       if (!this.m_isReadOnly) {
  //         ImGui.SeparatorText('Connections');

  //         // Dynamic Pins
  //         if (pFlowNode.SupportsUserEditableDynamicInputPins()) {
  //           if (ImGui.MenuItem(EE_ICON_PLUS_CIRCLE_OUTLINE + ' Add Input')) {
  //             pFlowGraph.CreateDynamicPin(pFlowNode.GetID());
  //           }

  //           if (this.m_contextMenuState.m_pPin !== null && this.m_contextMenuState.m_pPin.IsDynamicPin()) {
  //             if (ImGui.MenuItem(EE_ICON_CLOSE_CIRCLE_OUTLINE + ' Remove Input')) {
  //               pFlowGraph.DestroyDynamicPin(pFlowNode.GetID(), this.m_contextMenuState.m_pPin.m_ID);
  //             }
  //           }
  //         }

  //         // Connections
  //         if (ImGui.MenuItem(EE_ICON_PIPE_DISCONNECTED + ' Break All Connections')) {
  //           pFlowGraph.BreakAllConnectionsForNode(pFlowNode);
  //         }
  //       }

  //       if (!this.m_isReadOnly) {
  //         ImGui.SeparatorText('Node');

  //         if (ImGui.BeginMenu(EE_ICON_IDENTIFIER + ' Node ID')) {
  //           // UUID
  //           const IDStr = this.m_contextMenuState.m_pNode.GetID().ToString();
  //           const label = `${IDStr}`;

  //           if (ImGui.MenuItem(label)) {
  //             ImGui.SetClipboardText(IDStr);
  //           }

  //           ImGui.EndMenu();
  //         }

  //         // Renameable Nodes
  //         if (this.m_contextMenuState.m_pNode.IsRenameable()) {
  //           if (ImGui.MenuItem(EE_ICON_RENAME_BOX + ' Rename Node')) {
  //             this.BeginRenameNode(this.m_contextMenuState.m_pNode);
  //           }
  //         }

  //         // Destroyable Nodes
  //         if (this.m_contextMenuState.m_pNode.IsDestroyable() && this.m_pGraph.CanDestroyNode(this.m_contextMenuState.m_pNode)) {
  //           if (ImGui.MenuItem(EE_ICON_DELETE + ' Delete Node')) {
  //             this.ClearSelection();
  //             this.m_contextMenuState.m_pNode.Destroy();
  //             this.m_contextMenuState.Reset();
  //           }
  //         }
  //       }
  //     } else { // Graph Menu
  //       if (pFlowGraph.HasContextMenuFilter()) {
  //         this.m_contextMenuState.m_filterWidget.UpdateAndDraw(-1, ImGuiX.FilterWidget.TakeInitialFocus);
  //       }

  //       this.DrawSharedContextMenuOptions(ctx);

  //       if (pFlowGraph.DrawContextMenuOptions(ctx, this.m_pUserContext, this.m_contextMenuState.m_mouseCanvasPos, this.m_contextMenuState.m_filterWidget.GetFilterTokens(), this.m_contextMenuState.GetAsFlowNode(), this.m_contextMenuState.m_pPin)) {
  //         this.m_contextMenuState.Reset();
  //         ImGui.CloseCurrentPopup();
  //       }
  //     }
  //   }

  //   private DrawStateMachineContextMenu (ctx: DrawContext): void {
  //     if (!this.IsViewingStateMachineGraph()) {
  //       throw new Error('Not viewing state machine graph');
  //     }

  //     const pStateMachineGraph = this.GetStateMachineGraph();

  //     // Node Menu
  //     if (this.m_contextMenuState.m_pNode !== null) {
  //       if (this.m_contextMenuState.m_pNode instanceof CommentNode) {
  //         throw new Error('Unexpected comment node');
  //       }

  //       const pStateMachineNode = this.m_contextMenuState.GetAsStateMachineNode();

  //       if (!this.m_isReadOnly) {
  //         if (ImGui.MenuItem(EE_ICON_STAR + ' Make Default Entry State')) {
  //           const pParentStateMachineGraph = this.m_contextMenuState.m_pNode.GetParentGraph() as StateMachineGraph;

  //           pParentStateMachineGraph.SetDefaultEntryState(this.m_contextMenuState.m_pNode.GetID());
  //         }
  //       }

  //       // Default node menu
  //       pStateMachineNode.DrawContextMenuOptions(ctx, this.m_pUserContext, this.m_contextMenuState.m_mouseCanvasPos);

  //       if (!this.m_isReadOnly) {
  //         // Renameable Nodes
  //         if (this.m_contextMenuState.m_pNode.IsRenameable()) {
  //           if (ImGui.MenuItem(EE_ICON_RENAME_BOX + ' Rename Node')) {
  //             this.BeginRenameNode(this.m_contextMenuState.m_pNode);
  //           }
  //         }

  //         // Destroyable Nodes
  //         let nodeDestroyed = false;

  //         if (this.m_contextMenuState.m_pNode.IsDestroyable() && this.m_pGraph.CanDestroyNode(this.m_contextMenuState.m_pNode)) {
  //           if (ImGui.MenuItem(EE_ICON_DELETE + ' Delete Node')) {
  //             this.ClearSelection();
  //             this.m_contextMenuState.m_pNode.Destroy();
  //             this.m_contextMenuState.Reset();
  //             nodeDestroyed = true;
  //           }
  //         }
  //       }
  //     } else { // Graph Menu
  //       if (pStateMachineGraph.HasContextMenuFilter()) {
  //         this.m_contextMenuState.m_filterWidget.UpdateAndDraw();
  //       }

  //       this.DrawSharedContextMenuOptions(ctx);

  //       if (pStateMachineGraph.DrawContextMenuOptions(ctx, this.m_pUserContext, this.m_contextMenuState.m_mouseCanvasPos, this.m_contextMenuState.m_filterWidget.GetFilterTokens())) {
  //         this.m_contextMenuState.Reset();
  //         ImGui.CloseCurrentPopup();
  //       }
  //     }
  //   }

  //   private static FilterNodeNameChars (data: ImGuiInputTextCallbackData): number {
  //     if (data.EventChar >= 48 && data.EventChar <= 57 || // 0-9
  //             data.EventChar >= 65 && data.EventChar <= 90 || // A-Z
  //             data.EventChar >= 97 && data.EventChar <= 122 || // a-z
  //             data.EventChar === 95) { // _
  //       return 0;
  //     }

  //     return 1;
  //   }

  //   private DrawDialogs (): void {
  //     if (this.m_pNodeBeingOperatedOn === null) {
  //       return;
  //     }

  //     const style = ImGui.GetStyle();
  //     const buttonWidth = 75;
  //     const buttonSectionWidth = (buttonWidth * 2) + style.ItemSpacing.x;

  //     // Edit Comment
  //     const isCommentNode = this.m_pNodeBeingOperatedOn instanceof CommentNode;

  //     if (isCommentNode) {
  //       ImGui.OpenPopup(GraphView.s_dialogID_Comment);
  //       ImGui.PushStyleVar(ImGuiStyleVar.WindowPadding, new ImVec2(6, 6));
  //       ImGui.SetNextWindowSize(new ImVec2(600, -1));
  //       if (ImGui.BeginPopupModal(GraphView.s_dialogID_Comment, null, ImGuiWindowFlags.NoSavedSettings)) {
  //         if (ImGui.IsKeyPressed(ImGuiKey.Escape) || this.m_selectedNodes.length !== 1) {
  //           this.EndRenameNode(false);
  //           ImGui.CloseCurrentPopup();
  //         } else {
  //           const pNode = this.m_selectedNodes[0].m_pNode;

  //           if (!pNode.IsRenameable()) {
  //             throw new Error('Node is not renameable');
  //           }
  //           let updateConfirmed = false;

  //           ImGui.AlignTextToFramePadding();
  //           ImGui.Text('Comment: ');
  //           ImGui.SameLine();

  //           ImGui.SetNextItemWidth(-1);

  //           if (ImGui.IsWindowAppearing()) {
  //             ImGui.SetKeyboardFocusHere();
  //           }

  //           if (ImGui.InputTextMultiline('##NodeName', this.m_textBuffer, 255, new ImVec2(0, ImGui.GetFrameHeightWithSpacing() * 5), ImGuiInputTextFlags.EnterReturnsTrue)) {
  //             if (this.m_textBuffer.length > 0) {
  //               updateConfirmed = true;
  //             }
  //           }

  //           ImGui.NewLine();

  //           const dialogWidth = ImGui.GetContentRegionAvail().x;

  //           ImGui.SameLine(0, dialogWidth - buttonSectionWidth);

  //           if (ImGui.Button('Ok', new ImVec2(buttonWidth, 0)) || updateConfirmed) {
  //             this.EndRenameNode(true);
  //             ImGui.CloseCurrentPopup();
  //           }

  //           ImGui.SameLine(0, 4);

  //           if (ImGui.Button('Cancel', new ImVec2(buttonWidth, 0))) {
  //             this.EndRenameNode(false);
  //             ImGui.CloseCurrentPopup();
  //           }
  //         }

  //         ImGui.EndPopup();
  //       }
  //       ImGui.PopStyleVar();
  //     } else { // Rename
  //       ImGui.OpenPopup(GraphView.s_dialogID_Rename);
  //       ImGui.PushStyleVar(ImGuiStyleVar.WindowPadding, new ImVec2(6, 6));
  //       ImGui.SetNextWindowSize(new ImVec2(400, -1));
  //       if (ImGui.BeginPopupModal(GraphView.s_dialogID_Rename, null, ImGuiWindowFlags.NoSavedSettings)) {
  //         if (ImGui.IsKeyPressed(ImGuiKey.Escape) || this.m_selectedNodes.length !== 1) {
  //           this.EndRenameNode(false);
  //           ImGui.CloseCurrentPopup();
  //         } else {
  //           const pNode = this.m_selectedNodes[0].m_pNode;

  //           if (!pNode.IsRenameable()) {
  //             throw new Error('Node is not renameable');
  //           }
  //           let updateConfirmed = false;

  //           ImGui.AlignTextToFramePadding();
  //           ImGui.Text('Name: ');
  //           ImGui.SameLine();

  //           ImGui.SetNextItemWidth(-1);

  //           if (ImGui.IsWindowAppearing()) {
  //             ImGui.SetKeyboardFocusHere();
  //           }

  //           if (ImGui.InputText('##NodeName', this.m_textBuffer, 255, ImGuiInputTextFlags.EnterReturnsTrue | ImGuiInputTextFlags.CallbackCharFilter, GraphView.FilterNodeNameChars)) {
  //             if (this.m_textBuffer.length > 0) {
  //               updateConfirmed = true;
  //             }
  //           }

  //           ImGui.NewLine();

  //           const dialogWidth = ImGui.GetContentRegionAvail().x;

  //           ImGui.SameLine(0, dialogWidth - buttonSectionWidth);

  //           ImGui.BeginDisabled(this.m_textBuffer.length === 0);
  //           if (ImGui.Button('Ok', new ImVec2(buttonWidth, 0)) || updateConfirmed) {
  //             this.EndRenameNode(true);
  //             ImGui.CloseCurrentPopup();
  //           }
  //           ImGui.EndDisabled();

  //           ImGui.SameLine(0, 4);

  //           if (ImGui.Button('Cancel', new ImVec2(buttonWidth, 0))) {
  //             this.EndRenameNode(false);
  //             ImGui.CloseCurrentPopup();
  //           }
  //         }

//         ImGui.EndPopup();
//       }
//       ImGui.PopStyleVar();
//     }
//   }
}