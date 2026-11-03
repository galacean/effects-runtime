import { setTooltip } from '../controls/tooltip';
import { EffectsObject, math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventKey, InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import type { Label, LineEdit } from '@galacean/effects-plugin-gui';
import { Container, Control, FocusMode, MouseFilter, TextOverflow, VerticalAlignment, VBoxContainer } from '@galacean/effects-plugin-gui';
import { append, column, expand, label, place, screenPosition } from '../controls/layout';
import { EditorDialog } from '../controls/dialog';
import { EditorSearchField } from '../controls/search-field';
import { EditorTextField } from '../controls/text-field';
import { EditorSelectableRow } from '../controls/selectable-row';
import { EditorMenu } from '../controls/menu';
import { EditorPointerInteraction } from '../controls/pointer-interaction';
import { applyMarqueeSelection, marqueeSelectionMode, type MarqueeSelectionMode } from '../list-view/marquee-selection';
import type { MenuAction } from '../controls/menu';
import { VirtualList } from '../controls/virtual-list';
import { PropertySheet } from '../property-editor/property-sheet';
import { editorBox, editorColors as C, EDITOR_FONT_SIZE, getEditorFont, setEditorFont } from '../theme/control-theme';
import { CommentGraphNode } from './comment-graph-node';
import type { Pin } from './flow-graph-model';
import { FlowGraphModel, FlowGraphNode } from './flow-graph-model';
import { GraphNodeSelection } from './graph-editor-context';
import type { GraphEditorContext } from './graph-editor-context';
import type { GraphModel } from './graph-model';
import { GraphNode, NodeVisualState } from './graph-model';
import { GraphRect } from './graph-rect';
import { GraphViewGeometry } from './graph-view-geometry';
import { GraphStyle } from './graph-style';
import { GraphColors } from './graph-colors';
import { StateGraphNode, StateMachineGraphModel, StateMachineGraphNode, TransitionGraphNode } from './state-machine-graph-model';

export interface GraphNodeType { label: string, category: string, create(graph: GraphModel, position: math.Vector2): GraphNode }
class GraphActionRow extends EditorSelectableRow {
  private entry!: GraphNodeType;
  constructor (engine: Engine, choose: (type: GraphNodeType) => void) { super(engine, 'graph'); this.on('pressed', () => choose(this.entry)); }
  bind (type: GraphNodeType): void { this.entry = type; this.text = type.category + ' / ' + type.label; }
}
export interface GraphNodeContent { control: Control, refresh?(): void }
interface PinEndpoint { node: FlowGraphNode, pin: Pin }
interface GraphDrag {
  kind: 'pan' | 'nodes' | 'marquee' | 'connection' | 'transition' | 'resize',
  origin: math.Vector2, mouse: math.Vector2, offset: math.Vector2,
  positions?: Map<GraphNode, math.Vector2>, selection?: GraphNode[], pin?: PinEndpoint,
  state?: StateGraphNode, comment?: CommentGraphNode, size?: math.Vector2,
  resizeEdges?: { left: boolean, right: boolean, top: boolean, bottom: boolean },
  selectionMode?: MarqueeSelectionMode,
  context?: { node?: GraphNode, pin?: Pin },
  modifying?: boolean,
}
let copiedNodes: GraphNode[] = [];
let copiedConnections: FlowGraphModel['m_connections'] = [];

/** Copies graph data while retaining runtime asset references and class methods. */
function copyGraphData<T> (value: T, seen = new Map<object, unknown>(), ownedNodes?: Set<GraphNode>): T {
  if (value === null || typeof value !== 'object' || value instanceof EffectsObject) { return value; }
  if (value instanceof GraphNode && ownedNodes && !ownedNodes.has(value)) { return value; }
  if (seen.has(value)) { return seen.get(value) as T; }
  const result = value instanceof Map ? new Map() : value instanceof Set ? new Set() : Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));

  seen.set(value, result);
  if (value instanceof Map) { value.forEach((entry, key) => result.set(key, copyGraphData(entry, seen, ownedNodes))); } else if (value instanceof Set) { value.forEach(entry => result.add(copyGraphData(entry, seen, ownedNodes))); } else { for (const key of Object.keys(value)) { if (key !== 'm_pParentGraph' && key !== 'm_pParentNode') { result[key] = copyGraphData(Reflect.get(value, key), seen, ownedNodes); } } }

  return result as T;
}
function copyNodeSelection (nodes: GraphNode[]): GraphNode[] {
  const owned = new Set<GraphNode>();
  const visit = (node: GraphNode): void => {
    if (owned.has(node)) { return; }
    owned.add(node);
    for (const graph of [node.GetChildGraph(), node.GetSecondaryGraph()]) { graph?.m_nodes.forEach(visit); }
  };

  nodes.forEach(visit);

  return copyGraphData(nodes, new Map(), owned);
}
function attachGraph (node: GraphNode, graph: GraphModel): void {
  node.m_pParentGraph = graph;
  for (const child of [node.GetChildGraph(), node.GetSecondaryGraph()]) {
    if (child) { child.m_pParentNode = node; child.m_nodes.forEach(item => attachGraph(item, child)); }
  }
}

class GraphPinControl extends Control {
  private readonly tint = new math.Color();
  constructor (engine: Engine, readonly graphView: GraphEditorView, readonly endpoint: PinEndpoint, readonly input: boolean) {
    super(engine); this.mouseFilter = MouseFilter.Stop; setTooltip(this, endpoint.pin.m_name + ' (' + endpoint.pin.m_type + ')');
  }
  override getMinimumSize (): math.Vector2 {
    const size = EDITOR_FONT_SIZE * GraphStyle.contentFontScale;
    const metrics = this.measureText(this.endpoint.pin.m_name, size, getEditorFont(this.engine, size));

    return new math.Vector2(metrics.width, metrics.lineHeight + 6);
  }
  get centerX (): number { return this.input ? GraphStyle.pinRadius : this.width - GraphStyle.pinRadius; }
  override hasPoint (position: math.Vector2): boolean {
    return Math.hypot(position.x - this.centerX, position.y - this.height / 2) <= GraphStyle.pinRadius + FlowGraphNode.S_PinSelectionExtraRadius;
  }
  override draw (): void {
    const node = this.endpoint.node, pin = this.endpoint.pin, x = this.centerX;
    const color = node.GetPinColor(pin), hovered = this.hasPoint(this.getLocalMousePosition());
    const factor = hovered ? 1.55 : 1;

    this.tint.set(color.r * factor, color.g * factor, color.b * factor, color.a);
    this.fillCircle(x, this.height / 2, GraphStyle.pinRadius, this.tint);
    if (hovered) { node.m_pHoveredPin = pin; }
    const size = EDITOR_FONT_SIZE * GraphStyle.contentFontScale, font = getEditorFont(this.engine, size);
    const metrics = this.measureText(pin.m_name, size, font);

    this.drawText(this.input ? x + 8 : x - 8 - metrics.width, (this.height - metrics.lineHeight) / 2, pin.m_name, size, C.foreground, font);
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) { this.graphView.startConnection(this.endpoint, event); } else if (event.buttonIndex === MouseButton.Right) { this.graphView.startContextPan(event, this.endpoint.node, this.endpoint.pin); }
    event.accept();
  }
  override onMouseMove (event: InputEventMouseMotion): void { this.graphView.pointerMove(event); }
  override onMouseUp (event: InputEventMouseButton): void { this.graphView.pointerUp(event); }
}
class GraphNodeControl extends Container {
  private readonly caption: Label;
  private readonly pins: GraphPinControl[] = [];
  private pinSignature = '';
  private nodeContent?: GraphNodeContent;
  private readonly background = editorBox(C.clear);
  private readonly titleBackground = editorBox(C.clear);
  private readonly marker = editorBox(C.clear);
  private readonly outline = editorBox(C.clear);
  private readonly activeOutline = editorBox(C.clear, 0, 0, GraphStyle.s_activeIndicatorBorderColor);
  private readonly tint = new math.Color();
  constructor (engine: Engine, readonly graphView: GraphEditorView, readonly node: GraphNode) {
    super(engine); this.focusMode = FocusMode.Click;
    this.caption = append(this, label(engine, node.GetName())); this.caption.mouseFilter = MouseFilter.Ignore; this.caption.textOverflow = TextOverflow.Ellipsis; this.caption.verticalAlignment = VerticalAlignment.Center;
    setEditorFont(this.caption, EDITOR_FONT_SIZE * GraphStyle.titleFontScale);
    this.nodeContent = node instanceof CommentGraphNode ? undefined : graphView.createNodeContent?.(node);
    if (this.nodeContent) { append(this, this.nodeContent.control); this.nodeContent.control.mouseFilter = MouseFilter.Pass; }
    this.sync();
  }
  sync (): void {
    this.caption.text = this.node instanceof CommentGraphNode ? '# ' + this.node.GetName() : this.node.GetName(); this.node.updateDebugState(this.graphView.context); this.nodeContent?.refresh?.();
    const node = this.node;
    const point = this.getLocalMousePosition();

    node.m_isHovered = this.hasPoint(point);
    if (node instanceof CommentGraphNode) {
      const size = node.getCommentBoxSize();

      if (size.x !== this.width || size.y !== this.height) { this.updateMinimumSize(); }
    }

    if (node instanceof FlowGraphNode) {
      node.m_pHoveredPin = this.pins.find(pin => pin.hasPoint(pin.makePositionLocal(screenPosition(this, point.x, point.y))))?.endpoint.pin ?? null;
      const signature = [...node.m_inputPins, ...node.m_outputPins].map(pin => pin.m_ID).join(',');

      if (signature !== this.pinSignature) {
        this.pinSignature = signature; this.pins.splice(0).forEach(pin => pin.dispose());
        for (const [pins, input] of [[node.m_inputPins, true], [node.m_outputPins, false]] as const) {
          pins.forEach(pin => this.pins.push(append(this, new GraphPinControl(this.engine, this.graphView, { node, pin }, input))));
        }
        this.updateMinimumSize();
      }
    }
    this.queueSort();
  }
  override getMinimumSize (): math.Vector2 {
    if (this.node instanceof CommentGraphNode) { return this.node.getCommentBoxSize(); }
    const margin = this.node.GetNodeMargin(), titleSize = this.captionSize();
    const content = this.nodeContent?.control.getCombinedMinimumSize();
    const inputs = this.pins.filter(pin => pin.input), outputs = this.pins.filter(pin => !pin.input);
    const inputWidth = Math.max(0, ...inputs.map(pin => pin.getCombinedMinimumSize().x)), outputWidth = Math.max(0, ...outputs.map(pin => pin.getCombinedMinimumSize().x));
    const pinHeight = Math.max(0, ...this.pins.map(pin => pin.getCombinedMinimumSize().y));
    const pinWidth = inputWidth + outputWidth + (inputs.length && outputs.length ? GraphStyle.pinColumnSpacing : 0);

    return new math.Vector2(Math.max(titleSize.x + (this.hasTitleBar ? GraphStyle.titleMarkerWidth : 0), pinWidth, content?.x ?? 0) + margin.x * 2,
      titleSize.y + GraphStyle.titleSpacing + Math.max(inputs.length, outputs.length) * pinHeight + (content?.y ?? 0) + margin.y * 2);
  }
  private get hasTitleBar (): boolean { return !(this.node instanceof StateMachineGraphNode) || this.node instanceof StateGraphNode; }
  private captionSize (): math.Vector2 {
    const text = this.node instanceof CommentGraphNode ? '# ' + this.node.GetName() : this.node.GetName();
    const size = EDITOR_FONT_SIZE * GraphStyle.titleFontScale, metrics = this.measureText(text, size, getEditorFont(this.engine, size));

    return new math.Vector2(metrics.width, metrics.lineHeight);
  }
  protected override sortChildren (): void {
    const node = this.node;
    const margin = node instanceof CommentGraphNode ? new math.Vector2(8, 4) : node.GetNodeMargin();
    const titleSize = this.captionSize(), titleHeight = titleSize.y;
    const markerWidth = node instanceof CommentGraphNode || !this.hasTitleBar ? 0 : GraphStyle.titleMarkerWidth;
    const pinHeight = Math.max(0, ...this.pins.map(pin => pin.getCombinedMinimumSize().y));
    const pinsTop = margin.y + titleHeight + GraphStyle.titleSpacing;

    node.m_titleRectSize.copyFrom(titleSize);
    place(this.caption, margin.x + markerWidth, margin.y, this.width - margin.x * 2 - markerWidth, titleHeight);

    if (node instanceof FlowGraphNode) {
      this.pins.forEach(pin => {
        const index = (pin.input ? node.m_inputPins : node.m_outputPins).indexOf(pin.endpoint.pin);

        const width = this.width / 2 + GraphStyle.pinRadius;

        place(pin, pin.input ? -GraphStyle.pinRadius : this.width / 2, pinsTop + index * pinHeight, width, pinHeight);
        pin.endpoint.pin.m_position.set(node.GetRect().Min.x + (pin.input ? 0 : this.width), node.GetRect().Min.y + pinsTop + index * pinHeight + pinHeight / 2);
      });
    }
    if (this.nodeContent) {
      const count = node instanceof FlowGraphNode ? Math.max(node.m_inputPins.length, node.m_outputPins.length) : 0;

      const top = pinsTop + count * pinHeight;

      place(this.nodeContent.control, margin.x, top, this.width - margin.x * 2, Math.max(0, this.height - margin.y - top));
    }
  }
  pinAt (position: math.Vector2): PinEndpoint | undefined {
    return this.pins.find(pin => pin.hasPoint(pin.makePositionLocal(position)))?.endpoint;
  }
  override draw (): void {
    const node = this.node, selected = this.graphView.IsNodeSelected(node), active = node.IsActive(this.graphView.context);
    const comment = node instanceof CommentGraphNode;
    const hovered = node.m_isHovered && !(node instanceof FlowGraphNode && node.m_pHoveredPin);
    const factor = selected ? hovered ? 1.6 : 1.45 : hovered ? 1.15 : 1;
    const base = comment ? node.color : GraphStyle.s_nodeBackgroundColor, radius = comment ? 0 : node instanceof StateMachineGraphNode ? 2 : 8;
    const border = selected ? GraphStyle.s_nodeSelectedBorderColor : C.clear;

    this.tint.set(base.r * factor, base.g * factor, base.b * factor, comment ? .1 : base.a);
    this.background.setBackgroundColor(this.tint); this.background.setCornerRadii(radius, radius, radius, radius);
    this.drawStyleBox(this.background, 0, 0, this.width, this.height);
    const titleHeight = node.m_titleRectSize.y + node.GetNodeMargin().y * 2;
    const title = comment ? node.color : GraphStyle.s_defaultTitleColor;

    this.tint.set(title.r * factor, title.g * factor, title.b * factor, comment ? .3 : title.a);
    this.titleBackground.setBackgroundColor(this.tint); this.titleBackground.setCornerRadii(radius, radius, 0, 0);
    if (comment || this.hasTitleBar) { this.drawStyleBox(this.titleBackground, 0, 0, this.width, titleHeight); }
    if (!comment && this.hasTitleBar) {
      this.marker.setBackgroundColor(node.GetTitleBarColor()); this.marker.setCornerRadii(radius, 0, 0, 0);
      this.drawStyleBox(this.marker, 0, 0, GraphStyle.titleMarkerWidth, titleHeight);
    }
    const borderFactor = selected && hovered ? 1.5 : 1;

    this.tint.set(border.r * borderFactor, border.g * borderFactor, border.b * borderFactor, border.a);
    this.outline.setBorderColor(this.tint); this.outline.setBorderWidths(GraphStyle.nodeBorderThickness, GraphStyle.nodeBorderThickness, GraphStyle.nodeBorderThickness, GraphStyle.nodeBorderThickness); this.outline.setCornerRadii(radius, radius, radius, radius);
    this.drawStyleBox(this.outline, 0, 0, this.width, this.height);
    if (active) {
      const scale = this.graphView.GetViewedGraph()!.m_viewScaleFactor, padding = GraphStyle.s_activeBorderIndicatorPadding / scale, thickness = GraphStyle.s_activeBorderIndicatorThickness / scale;

      this.activeOutline.setBorderWidths(thickness, thickness, thickness, thickness); this.activeOutline.setCornerRadii(radius, radius, radius, radius);
      this.drawStyleBox(this.activeOutline, -padding, -padding, this.width + padding * 2, this.height + padding * 2);
    }
    if (comment) { this.drawRect(0, 0, this.width, this.height, node.color, GraphStyle.nodeBorderThickness); }
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Right) {
      this.graphView.startContextPan(event, this.node); event.accept();

      return;
    }
    if (event.buttonIndex === MouseButton.Middle) {
      this.graphView.startPan(event); event.accept();

      return;
    }
    if (event.buttonIndex !== MouseButton.Left) { return; }
    if (event.doubleClick) {
      if (this.node instanceof CommentGraphNode) {
        this.graphView.rename(this.node); event.accept();

        return;
      }
      const target = this.node.GetNavigationTarget();

      if (target) { this.graphView.context.NavigateTo(target); } else { this.graphView.context.DoubleClick(this.node); }
    } else if (this.node instanceof CommentGraphNode && (event.position.x < 8 || event.position.x > this.width - 8 || event.position.y < 5 || event.position.y > this.height - 8)) {
      this.graphView.startResize(this.node, event, { left: event.position.x < 8, right: event.position.x > this.width - 8, top: event.position.y < 5, bottom: event.position.y > this.height - 8 });
    } else if (this.node instanceof StateGraphNode && event.altPressed) { this.graphView.startTransition(this.node, event); } else { this.graphView.startNodeDrag(this.node, event); }
    event.accept();
  }
  override onMouseMove (event: InputEventMouseMotion): void { this.graphView.pointerMove(event); }
  override onMouseUp (event: InputEventMouseButton): void { this.graphView.pointerUp(event); }
  override onKeyDown (event: InputEventKey): void { this.graphView.onKeyDown(event); }
}

export class GraphEditorView extends Container {
  private readonly pointerInteraction = new EditorPointerInteraction(this, () => this.finishDrag(true));
  readonly context: GraphEditorContext;
  createNodeContent?: (node: GraphNode) => GraphNodeContent | undefined;
  nodeTypes?: (graph: GraphModel) => GraphNodeType[];
  extraActions?: (node: GraphNode) => MenuAction[];
  private graph: GraphModel | null = null;
  private selected: GraphNode[] = [];
  private readonly nodeLayer: Control;
  private readonly commentLayer: Control;
  private readonly nodeControls = new Map<GraphNode, GraphNodeControl>();
  private readonly menu: EditorMenu;
  private readonly dialog: EditorDialog;
  private drag?: GraphDrag;
  private readOnly = false;
  private fitRequested = false;
  private transitions: { node: TransitionGraphNode, from: math.Vector2, to: math.Vector2 }[] = [];
  private pointer = new math.Vector2();
  private hoveredConnection?: string;
  private readonly geometry = new GraphViewGeometry();
  private readonly clipboardEvent = (event: ClipboardEvent): void => {
    if (!this.HasFocus() || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) { return; }
    if (event.type === 'paste') { this.PasteNodes(this.canvasPosition(this.pointer)); } else { this.CopySelectedNodes(); event.clipboardData?.setData('text/plain', JSON.stringify({ nodes: copiedNodes.map(node => ({ type: node.GetTypeName(), name: node.GetName() })) })); if (event.type === 'cut') { this.DestroySelectedNodes(); } }
    event.preventDefault();
  };
  constructor (engine: Engine, context: GraphEditorContext) {
    super(engine); this.context = context; this.focusMode = FocusMode.All; this.clipContents = true;
    this.commentLayer = append(this, new Control(engine)); this.commentLayer.mouseFilter = MouseFilter.Pass;
    this.nodeLayer = append(this, new Control(engine)); this.nodeLayer.mouseFilter = MouseFilter.Ignore;
    this.commentLayer.setPivot(0, 0); this.nodeLayer.setPivot(0, 0);
    this.menu = new EditorMenu(engine); this.dialog = new EditorDialog(engine);
    for (const name of ['copy', 'cut', 'paste'] as const) { window.document.addEventListener(name, this.clipboardEvent); }
  }
  GetViewedGraph (): GraphModel | null { return this.graph; }
  GetFlowGraph (): FlowGraphModel | null { return this.graph instanceof FlowGraphModel ? this.graph : null; }
  GetStateMachineGraph (): StateMachineGraphModel | null { return this.graph instanceof StateMachineGraphModel ? this.graph : null; }
  IsViewingFlowGraph (): boolean { return this.graph instanceof FlowGraphModel; }
  IsViewingStateMachineGraph (): boolean { return this.graph instanceof StateMachineGraphModel; }
  IsReadOnly (): boolean { return this.readOnly; }
  SetReadOnly (value: boolean): void { if (value !== this.readOnly) { this.finishDrag(true); this.readOnly = value; } }
  HasFocus (): boolean {
    for (let node = this.root?.guiGetFocusOwner(); node; node = node.parent) { if (node === this) { return true; } }

    return false;
  }
  GetSelectedNodes (): GraphNodeSelection[] { return this.selected.map(node => new GraphNodeSelection(node)); }
  HasSelectedNodes (): boolean { return !!this.selected.length; }
  IsNodeSelected (node: GraphNode): boolean { return this.selected.includes(node); }
  SelectNode (node: GraphNode): void { this.SelectNodes([node]); }
  SelectNodes (nodes: GraphNode[]): void {
    const next = [...new Set(nodes)].filter(node => node.GetParentGraph() === this.graph);

    if (next.length === this.selected.length && next.every((node, index) => node === this.selected[index])) { return; }
    const previous = this.GetSelectedNodes();

    this.selected = next; this.context.NotifySelectionChanged(previous, this.GetSelectedNodes());
  }
  ClearSelection (): void { this.SelectNodes([]); }
  SetGraphToView (graph: GraphModel | null, maintainSelection = false): void {
    this.finishDrag(true); this.graph = graph;
    if (!maintainSelection) { this.ClearSelection(); }
    this.nodeControls.forEach(control => control.dispose()); this.nodeControls.clear(); graph?.OnShowGraph(); this.refreshNodes();
  }
  override update (dt: number): void { this.refreshNodes(); super.update(dt); }
  private refreshNodes (): void {
    const nodes = this.graph?.m_nodes.filter(node => !(node instanceof TransitionGraphNode) && node.IsVisible()) ?? [];

    for (const [node, control] of this.nodeControls) { if (!nodes.includes(node)) { control.dispose(); this.nodeControls.delete(node); } }
    for (const node of nodes) {
      let control = this.nodeControls.get(node);

      if (!control) { control = append(node instanceof CommentGraphNode ? this.commentLayer : this.nodeLayer, new GraphNodeControl(this.engine, this, node)); this.nodeControls.set(node, control); }
      control.sync(); const size = control.getCombinedMinimumSize();

      const margin = node instanceof CommentGraphNode ? new math.Vector2() : node.GetNodeMargin();

      node.SetCalculatedNodeSize(new math.Vector2(size.x - margin.x * 2, size.y - margin.y * 2));
      const rect = node.GetRect();

      place(control, rect.Min.x, rect.Min.y, size.x, size.y);
    }
    this.SelectNodes(this.selected.filter(node => this.graph?.m_nodes.includes(node))); this.queueSort();
  }
  protected override sortChildren (): void {
    const graph = this.graph;

    if (!graph) { return; }
    if (this.fitRequested && this.width > 0 && this.height > 0) { this.fitRequested = false; this.FitToView(); }
    for (const layer of [this.commentLayer, this.nodeLayer]) {
      layer.setPosition(-graph.m_viewOffset.x * graph.m_viewScaleFactor, -graph.m_viewOffset.y * graph.m_viewScaleFactor);
      layer.setSize(Math.max(1, this.width / graph.m_viewScaleFactor), Math.max(1, this.height / graph.m_viewScaleFactor));
      layer.setScale(graph.m_viewScaleFactor, graph.m_viewScaleFactor);
    }
    this.geometry.m_viewOffset.copyFrom(graph.m_viewOffset); this.geometry.SetViewScaleFactor(graph.m_viewScaleFactor);
    this.geometry.m_windowRect = new GraphRect(screenPosition(this), screenPosition(this, this.width, this.height));
    this.geometry.m_canvasVisibleRect = new GraphRect(graph.m_viewOffset.clone(), this.canvasPosition(new math.Vector2(this.width, this.height)));
    this.geometry.m_isReadOnly = this.readOnly;
  }
  canvasPosition (position: math.Vector2): math.Vector2 {
    const g = this.graph;

    return g ? new math.Vector2(position.x / g.m_viewScaleFactor + g.m_viewOffset.x, position.y / g.m_viewScaleFactor + g.m_viewOffset.y) : position.clone();
  }
  private viewPosition (position: math.Vector2): math.Vector2 {
    const g = this.graph!;

    return new math.Vector2((position.x - g.m_viewOffset.x) * g.m_viewScaleFactor, (position.y - g.m_viewOffset.y) * g.m_viewScaleFactor);
  }
  override draw (): void {
    const graphics = this.engine.renderingServer.graphics;

    graphics.pushClipRect(0, 0, this.width, this.height);
    this.drawGraph();
    graphics.popClipRect();
  }
  private drawGraph (): void {
    this.fillRect(0, 0, this.width, this.height, GraphStyle.gridBackground);
    const graph = this.graph;

    if (!graph) { return; }
    const spacing = 30 * graph.m_viewScaleFactor;

    for (let x = -graph.m_viewOffset.x * graph.m_viewScaleFactor % spacing; x < this.width; x += spacing) { this.drawLine(x, 0, x, this.height, GraphStyle.gridLine); }
    for (let y = -graph.m_viewOffset.y * graph.m_viewScaleFactor % spacing; y < this.height; y += spacing) { this.drawLine(0, y, this.width, y, GraphStyle.gridLine); }
    this.pointer.copyFrom(this.getLocalMousePosition()); this.geometry.m_mouseScreenPos.copyFrom(screenPosition(this, this.pointer.x, this.pointer.y));
    this.geometry.m_mouseCanvasPos.copyFrom(this.canvasPosition(this.pointer)); this.hoveredConnection = undefined;
    if (graph instanceof FlowGraphModel) {
      for (const connection of graph.m_connections) {
        const from = graph.FindNode(connection.m_fromNodeID) as FlowGraphNode, to = graph.FindNode(connection.m_toNodeID) as FlowGraphNode;
        const output = from?.m_outputPins.find(pin => pin.m_ID === connection.m_outputPinID), input = to?.m_inputPins.find(pin => pin.m_ID === connection.m_inputPinID);

        if (output && input) {
          const a = this.viewPosition(output.m_position), b = this.viewPosition(input.m_position);
          const hovered = this.HasFocus() && this.hasPoint(this.pointer) && this.curveHovered(a, b, this.pointer);

          if (hovered) { this.hoveredConnection = connection.m_ID; }
          this.bezier(a, b, hovered ? GraphStyle.s_connectionColorHovered : from.GetPinColor(output));
        }
      }
    }
    this.transitions = [];
    for (const node of graph.m_nodes) {
      if (!(node instanceof TransitionGraphNode)) { continue; }
      node.updateDebugState(this.context);
      const a = graph.FindNode(node.GetStartStateID()), b = graph.FindNode(node.GetEndStateID());

      if (!a || !b) { continue; }
      const ac = a.GetRect().GetCenter(), bc = b.GetRect().GetCenter();
      const start = this.borderPoint(a.GetRect(), bc), end = this.borderPoint(b.GetRect(), ac);
      const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy) || 1;
      const offsetX = -dy / length * GraphStyle.transitionOffset, offsetY = dx / length * GraphStyle.transitionOffset;
      const from = this.viewPosition(new math.Vector2(start.x + offsetX, start.y + offsetY)), to = this.viewPosition(new math.Vector2(end.x + offsetX, end.y + offsetY));

      node.m_isHovered = this.hasPoint(this.pointer) && this.distanceToLine(this.pointer, from, to) < 5;
      const selected = this.IsNodeSelected(node);
      const color = node.GetConduitColor(this.geometry, this.context, new Map([[NodeVisualState.Selected, selected], [NodeVisualState.Hovered, node.m_isHovered], [NodeVisualState.Active, node.IsActive(this.context)]]));

      node.m_canvasPosition.set(Math.min(start.x, end.x) + offsetX, Math.min(start.y, end.y) + offsetY);
      node.SetCalculatedNodeSize(new math.Vector2(Math.abs(dx), Math.abs(dy)));
      if (node.m_transitionProgress > 0) {
        const t = Math.max(0, Math.min(1, node.m_transitionProgress));

        this.arrow(from, to, C.muted);
        this.arrow(from, new math.Vector2(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t), color);
      } else { this.arrow(from, to, color, selected ? 1.5 : 1); }
      this.transitions.push({ node, from, to });
    }
    if (this.drag?.kind === 'connection' && this.drag.pin) {
      const source = this.viewPosition(this.drag.pin.pin.m_position), target = this.drag.mouse;

      const hovered = this.pinAt(screenPosition(this, target.x, target.y)), pin = this.drag.pin;
      const input = pin.node.HasInputPin(pin.pin.m_ID), flow = this.GetFlowGraph();
      const valid = !hovered || (input ? flow?.IsValidConnection(hovered.node, hovered.pin, pin.node, pin.pin) : flow?.IsValidConnection(pin.node, pin.pin, hovered.node, hovered.pin));
      const color = valid ? pin.node.GetPinColor(pin.pin) : GraphStyle.s_connectionColorInvalid;

      if (input) { this.bezier(target, source, color); } else { this.bezier(source, target, color); }
    }
    if (this.drag?.kind === 'transition' && this.drag.state) {
      const source = this.viewPosition(this.drag.state.GetRect().GetCenter());

      const point = this.canvasPosition(this.drag.mouse), target = graph.m_nodes.find(node => node instanceof StateGraphNode && node.GetRect().Contains(point)) as StateGraphNode | undefined;
      const valid = target && this.GetStateMachineGraph()?.CanCreateTransitionConduit(this.drag.state, target);

      this.arrow(source, this.drag.mouse, valid ? GraphStyle.s_connectionColorValid : GraphStyle.s_connectionColorInvalid);
    }
  }
  protected override drawChildren (): void {
    super.drawChildren();
    const graphics = this.engine.renderingServer.graphics;

    graphics.pushClipRect(0, 0, this.width, this.height);
    const stateMachine = this.GetStateMachineGraph(), entry = stateMachine?.FindNode(stateMachine.GetDefaultEntryStateID());

    if (entry?.IsVisible()) {
      const point = this.viewPosition(entry.GetRect().Min), scale = stateMachine!.m_viewScaleFactor;

      this.drawText(point.x, point.y - 24 * scale, '*', EDITOR_FONT_SIZE * scale, GraphColors.Gold, getEditorFont(this.engine));
    }
    if (this.drag?.kind === 'marquee' && this.pointerInteraction.moved) {
      const a = this.drag.origin, b = this.drag.mouse;

      this.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y), GraphStyle.selectionFill); this.drawRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y), GraphStyle.selectionOutline);
    }
    graphics.popClipRect();
  }
  private borderPoint (rect: GraphRect, target: math.Vector2): math.Vector2 {
    const center = rect.GetCenter(), dx = target.x - center.x, dy = target.y - center.y;
    const t = Math.min(rect.GetWidth() / 2 / Math.max(.001, Math.abs(dx)), rect.GetHeight() / 2 / Math.max(.001, Math.abs(dy)));

    return new math.Vector2(center.x + dx * t, center.y + dy * t);
  }
  private arrow (from: math.Vector2, to: math.Vector2, color: math.Color, multiplier = 1): void {
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length;
    const scale = this.graph!.m_viewScaleFactor * multiplier, head = GraphStyle.arrowHeadWidth * scale;
    const x = to.x - ux * head, y = to.y - uy * head;

    this.drawLine(from.x, from.y, x, y, color, GraphStyle.transitionWidth * scale);
    this.fillTriangle(to.x, to.y, x + uy * head, y - ux * head, x - uy * head, y + ux * head, color);
  }
  private bezier (a: math.Vector2, b: math.Vector2, color: math.Color): void {
    if (a.x > b.x) { [a, b] = [b, a]; }
    const delta = 50 * this.graph!.m_viewScaleFactor;

    this.drawBezier(a.x, a.y, a.x + delta, a.y, b.x - delta, b.y, b.x, b.y, color, Math.max(1, 3 * this.graph!.m_viewScaleFactor));
  }
  private distanceToLine (point: math.Vector2, from: math.Vector2, to: math.Vector2): number {
    const dx = to.x - from.x, dy = to.y - from.y;
    const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy || 1)));

    return Math.hypot(point.x - from.x - dx * t, point.y - from.y - dy * t);
  }
  private curveHovered (a: math.Vector2, b: math.Vector2, point: math.Vector2): boolean {
    if (a.x > b.x) { [a, b] = [b, a]; }
    const delta = 50 * this.graph!.m_viewScaleFactor;
    const previous = a.clone(), current = new math.Vector2();

    for (let i = 1; i <= 32; i++) {
      const t = i / 32, q = 1 - t;

      current.set(q ** 3 * a.x + 3 * q * q * t * (a.x + delta) + 3 * q * t * t * (b.x - delta) + t ** 3 * b.x, q ** 3 * a.y + 3 * q * q * t * a.y + 3 * q * t * t * b.y + t ** 3 * b.y);
      if (this.distanceToLine(point, previous, current) < 5) { return true; }
      previous.copyFrom(current);
    }

    return false;
  }
  private transitionAt (point: math.Vector2): TransitionGraphNode | undefined {
    return this.transitions.find(({ from, to }) => this.distanceToLine(point, from, to) < 5)?.node;
  }
  private pinAt (position: math.Vector2): PinEndpoint | undefined {
    for (const control of this.nodeControls.values()) {
      const pin = control.pinAt(position);

      if (pin) { return pin; }
    }
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (!this.graph) { return; } this.pointer.copyFrom(event.position); this.grabFocus();
    const transition = this.transitionAt(event.position);

    if (event.buttonIndex === MouseButton.Right) { this.startContextPan(event, transition); } else if (event.buttonIndex === MouseButton.Middle) { this.startPan(event); } else if (event.buttonIndex === MouseButton.Left) {
      if (event.altPressed && !this.readOnly && this.hoveredConnection) { this.GetFlowGraph()?.BreakConnection(this.hoveredConnection); } else if (event.altPressed && !this.readOnly && transition) { this.graph.DestroyNode(transition.GetID()); } else if (transition) {
        if (event.ctrlPressed || event.metaPressed || event.shiftPressed) { this.SelectNodes(this.IsNodeSelected(transition) ? this.selected.filter(node => node !== transition) : [...this.selected, transition]); } else { this.SelectNode(transition); }
        if (event.doubleClick && transition.GetNavigationTarget()) { this.context.NavigateTo(transition.GetNavigationTarget()!); }
      } else if (event.doubleClick) {
        const parent = this.graph.GetNavigationTarget();

        if (parent) { this.context.NavigateTo(parent); } else { this.context.DoubleClick(this.graph); }
      } else {
        const selection = [...this.selected], mode = marqueeSelectionMode(event);

        this.drag = this.newDrag('marquee', event); this.drag.selection = selection; this.drag.selectionMode = mode;
      }
    }
    event.accept();
  }
  private newDrag (kind: GraphDrag['kind'], event: InputEventMouseButton): GraphDrag {
    const point = this.makePositionLocal(event.globalPosition);

    this.grabFocus();
    this.context.m_isAltDown = event.altPressed; this.context.m_isCtrlDown = event.ctrlPressed || event.metaPressed; this.context.m_isShiftDown = event.shiftPressed;
    this.pointerInteraction.begin(event);

    return { kind, origin: point, mouse: point.clone(), offset: this.graph!.m_viewOffset.clone() };
  }
  startPan (event: InputEventMouseButton): void { if (this.graph) { this.finishDrag(true); this.drag = this.newDrag('pan', event); } }
  startContextPan (event: InputEventMouseButton, node?: GraphNode, pin?: Pin): void {
    this.startPan(event);
    if (this.drag) { this.drag.context = { node, pin }; }
  }
  startNodeDrag (node: GraphNode, event: InputEventMouseButton): void {
    if (event.ctrlPressed || event.metaPressed || event.shiftPressed) { this.SelectNodes(this.IsNodeSelected(node) ? this.selected.filter(item => item !== node) : [...this.selected, node]); } else if (!this.IsNodeSelected(node)) { this.SelectNode(node); }
    if (this.readOnly || !this.IsNodeSelected(node)) { return; }
    this.drag = this.newDrag('nodes', event); const nodes = [...this.selected];

    for (const selected of nodes) {
      if (!(selected instanceof CommentGraphNode)) { continue; }
      for (const enclosed of this.graph!.m_nodes) {
        if (!(enclosed instanceof TransitionGraphNode) && !nodes.includes(enclosed) && selected.GetRect().Contains(enclosed.GetRect())) { nodes.push(enclosed); }
      }
    }
    this.drag.positions = new Map(nodes.map(item => [item, item.GetPosition()]));
  }
  startConnection (pin: PinEndpoint, event: InputEventMouseButton): void {
    if (this.readOnly || !this.graph) { return; }
    if (event.altPressed) {
      this.GetFlowGraph()?.BreakAnyConnectionsForPin(pin.pin.m_ID);

      return;
    }
    if (!this.IsNodeSelected(pin.node)) { this.SelectNode(pin.node); }
    this.drag = this.newDrag('connection', event); this.drag.pin = pin;
  }
  startTransition (node: StateGraphNode, event: InputEventMouseButton): void { if (!this.readOnly) { this.drag = this.newDrag('transition', event); this.drag.state = node; } }
  startResize (node: CommentGraphNode, event: InputEventMouseButton, edges: NonNullable<GraphDrag['resizeEdges']>): void {
    if (!this.readOnly) {
      this.drag = this.newDrag('resize', event); this.drag.comment = node; this.drag.size = node.getCommentBoxSize().clone();
      this.drag.positions = new Map([[node, node.GetPosition()]]); this.drag.resizeEdges = edges;
    }
  }
  override onMouseMove (event: InputEventMouseMotion): void { this.pointerMove(event); }
  pointerMove (event: InputEventMouseMotion): void {
    const point = this.makePositionLocal(event.globalPosition);

    this.pointer.copyFrom(point);
    this.context.m_isAltDown = event.altPressed; this.context.m_isCtrlDown = event.ctrlPressed || event.metaPressed; this.context.m_isShiftDown = event.shiftPressed;
    const drag = this.drag, graph = this.graph;

    if (!drag || !graph || !this.pointerInteraction.move(event)) { return; }
    if (!this.pointerInteraction.moved) { return; }
    if ((drag.kind === 'nodes' || drag.kind === 'resize') && !drag.modifying) { graph.BeginModification(); drag.modifying = true; }
    drag.mouse = point; const delta = new math.Vector2((point.x - drag.origin.x) / graph.m_viewScaleFactor, (point.y - drag.origin.y) / graph.m_viewScaleFactor);

    if (drag.kind === 'pan' && this.pointerInteraction.moved) { graph.m_viewOffset.set(drag.offset.x - delta.x, drag.offset.y - delta.y); }
    if (drag.kind === 'nodes') { drag.positions?.forEach((start, node) => node.m_canvasPosition.set(start.x + delta.x, start.y + delta.y)); }
    if (drag.kind === 'resize') {
      const edges = drag.resizeEdges!, size = drag.size!, node = drag.comment!, origin = drag.positions!.get(node)!;
      const width = Math.max(80, size.x + (edges.left ? -delta.x : edges.right ? delta.x : 0));
      const height = Math.max(80, size.y + (edges.top ? -delta.y : edges.bottom ? delta.y : 0));

      node.m_commentBoxSize.set(width, height); node.m_canvasPosition.set(origin.x + (edges.left ? size.x - width : 0), origin.y + (edges.top ? size.y - height : 0));
    }
    if (drag.kind === 'marquee' && this.pointerInteraction.moved) {
      const a = this.canvasPosition(drag.origin), b = this.canvasPosition(point), rect = new GraphRect(new math.Vector2(Math.min(a.x, b.x), Math.min(a.y, b.y)), new math.Vector2(Math.max(a.x, b.x), Math.max(a.y, b.y)));

      this.SelectNodes(applyMarqueeSelection(drag.selection!, graph.m_nodes.filter(node => !(node instanceof TransitionGraphNode) && rect.Overlaps(node.GetRect())), drag.selectionMode!));
    }
    this.queueSort(); event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void { this.pointerUp(event); }
  pointerUp (event: InputEventMouseButton): void {
    const drag = this.drag;

    if (!drag || !this.pointerInteraction.end(event)) { return; }
    const point = this.canvasPosition(this.makePositionLocal(event.globalPosition));

    if (drag.kind === 'pan' && drag.context && !this.pointerInteraction.moved) {
      this.finishDrag(); this.showContext(event.globalPosition, drag.context.node, drag.context.pin); event.accept();

      return;
    }
    if (drag.kind === 'marquee' && !this.pointerInteraction.moved && drag.selectionMode === 'replace') { this.ClearSelection(); }
    if (!event.canceled && this.pointerInteraction.moved && drag.kind === 'connection' && drag.pin) {
      const flow = this.GetFlowGraph(), source = drag.pin;
      let target = this.pinAt(event.globalPosition), distance = GraphStyle.pinRadius + FlowGraphNode.S_PinSelectionExtraRadius;

      for (const node of target ? [] : flow?.m_nodes ?? []) {
        if (!(node instanceof FlowGraphNode)) { continue; } for (const pin of [...node.m_inputPins, ...node.m_outputPins]) {
          const d = Math.hypot(pin.m_position.x - point.x, pin.m_position.y - point.y);

          if (d < distance && node !== source.node && node.HasInputPin(pin.m_ID) !== source.node.HasInputPin(source.pin.m_ID)) { target = { node, pin }; distance = d; }
        }
      }
      if (target) { if (source.node.HasInputPin(source.pin.m_ID)) { flow?.TryMakeConnection(target.node, target.pin, source.node, source.pin); } else { flow?.TryMakeConnection(source.node, source.pin, target.node, target.pin); } } else { this.showCreateDialog(event.globalPosition, source); }
    }
    if (!event.canceled && this.pointerInteraction.moved && drag.kind === 'transition' && drag.state) {
      const target = this.graph?.m_nodes.find(node => node instanceof StateGraphNode && node.GetRect().Contains(point)) as StateGraphNode | undefined;
      const graph = this.GetStateMachineGraph();

      if (target && graph?.CanCreateTransitionConduit(drag.state, target)) { graph.CreateTransitionConduit(drag.state, target); }
    }
    this.finishDrag(event.canceled); event.accept();
  }
  private finishDrag (cancel = false): void {
    const drag = this.drag;

    if (!drag) { return; }
    this.pointerInteraction.end(); this.drag = undefined;
    if (cancel) { drag.positions?.forEach((position, node) => node.m_canvasPosition.copyFrom(position)); if (drag.comment && drag.size) { drag.comment.m_commentBoxSize.copyFrom(drag.size); } }
    if (cancel && drag.selection) { this.SelectNodes(drag.selection); }
    if (drag.modifying) { this.graph?.EndModification(); }
  }
  override onMouseWheel (event: InputEventMouseButton): void {
    const graph = this.graph;

    if (!graph || event.buttonIndex !== MouseButton.WheelUp && event.buttonIndex !== MouseButton.WheelDown) { return; }
    if (this.drag) {
      event.accept();

      return;
    }
    const point = this.makePositionLocal(event.globalPosition), anchor = this.canvasPosition(point);
    const amount = (event.buttonIndex === MouseButton.WheelUp ? .05 : -.05) * event.factor;

    graph.m_viewScaleFactor = Math.max(.2, Math.min(1.4, graph.m_viewScaleFactor + amount)); graph.m_viewOffset.set(anchor.x - point.x / graph.m_viewScaleFactor, anchor.y - point.y / graph.m_viewScaleFactor); this.queueSort(); event.accept();
  }
  override onKeyDown (event: InputEventKey): void {
    const command = event.ctrlPressed || event.metaPressed, key = event.keycode.toLowerCase();

    if (command && key === 'c') { this.CopySelectedNodes(); } else if (command && key === 'x') { this.CopySelectedNodes(); this.DestroySelectedNodes(); } else if (command && key === 'v') { this.PasteNodes(this.canvasPosition(this.pointer)); } else if (key === 'escape') { this.finishDrag(true); this.root?.cancelPointerInput(); } else if (key === 'delete' || key === 'backspace') { this.DestroySelectedNodes(); } else if (key === 'f' || key === 'home') { this.FitToView(); } else if (key === 'f2' && this.selected[0]?.IsRenameable()) { this.rename(this.selected[0]); } else if (command && key === 'a') { this.SelectNodes(this.graph?.m_nodes.filter(node => node.IsVisible()) ?? []); } else if (command && key === 'd') { this.CopySelectedNodes(); this.PasteNodes(this.canvasPosition(this.pointer)); } else if (key === 'c' && !command) { this.CreateCommentAroundSelectedNodes(); } else if (event.altPressed && key === 'arrowup') {
      const parent = this.graph?.GetNavigationTarget();

      if (parent) { this.context.NavigateTo(parent); }
    } else { return; }
    event.accept();
  }
  ResetView (): void { if (this.graph) { this.graph.m_viewScaleFactor = 1; this.graph.m_viewOffset.set(-40, -40); this.queueSort(); } }
  RequestFitToView (): void { this.fitRequested = true; this.queueSort(); }
  FitToView (): void {
    const graph = this.graph, nodes = this.selected.length ? this.selected.filter(node => node.IsVisible() && !(node instanceof TransitionGraphNode)) : graph?.m_nodes.filter(node => node.IsVisible() && !(node instanceof TransitionGraphNode));

    if (!graph || !nodes?.length) {
      this.ResetView();

      return;
    }
    const minX = Math.min(...nodes.map(node => node.GetRect().Min.x)), minY = Math.min(...nodes.map(node => node.GetRect().Min.y)), maxX = Math.max(...nodes.map(node => node.GetRect().Max.x)), maxY = Math.max(...nodes.map(node => node.GetRect().Max.y));

    graph.m_viewScaleFactor = Math.max(.2, Math.min(1, this.width / (maxX - minX + 100), this.height / (maxY - minY + 100)));
    graph.m_viewOffset.set((minX + maxX) / 2 - this.width / graph.m_viewScaleFactor / 2, (minY + maxY) / 2 - this.height / graph.m_viewScaleFactor / 2); this.queueSort();
  }
  CenterView (node: GraphNode): void {
    if (this.graph) {
      const center = node.GetRect().GetCenter();

      this.graph.m_viewOffset.set(center.x - this.width / this.graph.m_viewScaleFactor / 2, center.y - this.height / this.graph.m_viewScaleFactor / 2); this.queueSort();
    }
  }
  RefreshNodeSizes (): void { this.refreshNodes(); }
  DestroySelectedNodes (): void { if (!this.graph || this.readOnly) { return; } this.graph.BeginModification(); for (const node of this.selected) { if (node.IsDestroyable() && this.graph.CanDestroyNode(node)) { node.Destroy(); } } this.graph.EndModification(); this.ClearSelection(); }
  CreateCommentAroundSelectedNodes (): void {
    if (!this.graph || this.readOnly || !this.graph.SupportsComments()) { return; }
    const node = this.graph.CreateNode(CommentGraphNode), selected = this.selected;

    if (selected.length) {
      const x = Math.min(...selected.map(node => node.GetPosition().x)) - 30, y = Math.min(...selected.map(node => node.GetPosition().y)) - 50;

      node.SetPosition(new math.Vector2(x, y)); node.m_commentBoxSize.set(Math.max(...selected.map(node => node.GetRect().Max.x)) - x + 30, Math.max(...selected.map(node => node.GetRect().Max.y)) - y + 30);
    } else { node.SetPosition(this.canvasPosition(this.pointer)); }
    this.SelectNode(node); this.rename(node);
  }
  CopySelectedNodes (): void {
    const nodes = this.selected.filter(node => node.IsUserCreatable() && !(node instanceof TransitionGraphNode));
    const transitions = this.graph?.m_nodes.filter((node): node is TransitionGraphNode => node instanceof TransitionGraphNode && nodes.some(item => item.GetID() === node.GetStartStateID()) && nodes.some(item => item.GetID() === node.GetEndStateID())) ?? [];

    copiedNodes = copyNodeSelection([...nodes, ...transitions]);
    copiedConnections = copyGraphData(this.GetFlowGraph()?.m_connections.filter(connection => nodes.some(node => node.GetID() === connection.m_fromNodeID) && nodes.some(node => node.GetID() === connection.m_toNodeID)) ?? []);
  }
  PasteNodes (position: math.Vector2): void {
    const graph = this.graph;

    if (!graph || this.readOnly || !copiedNodes.length) { return; }
    const nodes = copyNodeSelection(copiedNodes).filter(node => graph.CanCreateNode(node.constructor as new () => GraphNode));

    if (!nodes.length) { return; }
    const map = new Map<string, string>(), x = Math.min(...nodes.map(node => node.GetPosition().x)), y = Math.min(...nodes.map(node => node.GetPosition().y));

    graph.BeginModification();
    for (const node of nodes) { attachGraph(node, graph); node.RegenerateIDs(map); node.m_canvasPosition.set(node.m_canvasPosition.x - x + position.x, node.m_canvasPosition.y - y + position.y); graph.m_nodes.push(node); node.PostPaste(); graph.OnNodeAdded(node); if (node.IsRenameable()) { node.Rename(node.GetName()); } }
    for (const node of nodes) { if (node instanceof TransitionGraphNode) { node.m_startStateID = map.get(node.m_startStateID) ?? node.m_startStateID; node.m_endStateID = map.get(node.m_endStateID) ?? node.m_endStateID; } }
    if (graph instanceof FlowGraphModel) {
      for (const connection of copiedConnections) {
        const from = graph.FindNode(map.get(connection.m_fromNodeID)!) as FlowGraphNode, to = graph.FindNode(map.get(connection.m_toNodeID)!) as FlowGraphNode; const output = from?.m_outputPins.find(pin => pin.m_ID === map.get(connection.m_outputPinID)), input = to?.m_inputPins.find(pin => pin.m_ID === map.get(connection.m_inputPinID));

        if (output && input) { graph.TryMakeConnection(from, output, to, input); }
      }
    }
    graph.PostPasteNodes(nodes); this.context.NotifyNodesPasted(nodes); graph.EndModification(); this.SelectNodes(nodes);
  }
  showContext (position: math.Vector2, node?: GraphNode, pin?: Pin): void {
    if (node && !this.IsNodeSelected(node)) { this.SelectNode(node); }
    const actions: MenuAction[] = [{ label: 'Add Node…', enabled: !this.readOnly, action: () => this.showCreateDialog(position) },
      { label: 'Fit to View', shortcut: 'F', action: () => this.FitToView() }, { label: 'Reset View', action: () => this.ResetView() },
      { label: 'Reset Zoom', enabled: this.graph?.m_viewScaleFactor !== 1, action: () => this.resetZoom(this.makePositionLocal(position)) }];

    if (node) { actions.push({ label: 'Node Actions', heading: true }); }
    if (node instanceof CommentGraphNode) { actions.push({ label: 'Edit Comment', enabled: !this.readOnly, action: () => this.editComment(node) }); }
    if (node?.IsRenameable()) { actions.push({ label: 'Rename', shortcut: 'F2', enabled: !this.readOnly, action: () => this.rename(node) }); }
    if (node instanceof FlowGraphNode) {
      const graph = this.GetFlowGraph()!;

      actions.push({ label: 'Break All Connections', enabled: !this.readOnly, action: () => graph.BreakAllConnectionsForNode(node) });
      if (pin) { actions.push({ label: 'Break Pin Connections', enabled: !this.readOnly, action: () => graph.BreakAnyConnectionsForPin(pin.m_ID) }); }
      if (node.SupportsUserEditableDynamicInputPins()) { actions.push({ label: 'Add Input', enabled: !this.readOnly, action: () => graph.CreateDynamicPin(node.GetID()) }); if (pin?.m_isDynamic) { actions.push({ label: 'Remove Input', enabled: !this.readOnly, action: () => graph.DestroyDynamicPin(node.GetID(), pin.m_ID) }); } }
    }
    if (node instanceof StateGraphNode) { actions.push({ label: 'Make Default Entry State', enabled: !this.readOnly, action: () => this.GetStateMachineGraph()?.SetDefaultEntryState(node.GetID()) }); }
    if (node) { actions.push(...this.extraActions?.(node) ?? [], { label: 'Copy Node ID', action: () => { void navigator.clipboard.writeText(node.GetID()); } }); }
    actions.push({ label: 'Copy', enabled: !!this.selected.length, action: () => this.CopySelectedNodes() }, { label: 'Paste', enabled: !this.readOnly && !!copiedNodes.length, action: () => this.PasteNodes(this.canvasPosition(this.makePositionLocal(position))) }, { label: 'Delete', enabled: !this.readOnly && !!this.selected.length, action: () => this.DestroySelectedNodes() });
    if (this.graph?.SupportsComments()) { actions.push({ label: 'Organization', heading: true }, { label: 'Create Comment', shortcut: 'C', enabled: !this.readOnly, action: () => this.CreateCommentAroundSelectedNodes() }); }
    this.menu.setActions(actions); this.menu.show(this, position);
  }
  private resetZoom (point: math.Vector2): void {
    if (!this.graph) { return; }
    const anchor = this.canvasPosition(point);

    this.graph.m_viewScaleFactor = 1; this.graph.m_viewOffset.set(anchor.x - point.x, anchor.y - point.y); this.queueSort();
  }
  private editComment (node: CommentGraphNode): void {
    const draft = { text: node.GetName(), color: node.color.clone() };

    this.dialog.show(this, 'Edit Comment', body => {
      const sheet = append(body, new PropertySheet(this.engine, { change: (_label, _owner, action) => action(), finish: () => {} }));
      const group = sheet.section('comment', 'Comment');

      group.text('Text', { read: () => draft.text, write: value => draft.text = value });
      group.color('Color', { read: () => draft.color, write: value => draft.color = value });
    }, [{ label: 'Apply', primary: true, action: () => { node.BeginModification(); node.Rename(draft.text); node.color = draft.color; node.EndModification(); this.dialog.close(); } },
      { label: 'Cancel', action: () => this.dialog.close() }]);
  }
  private showCreateDialog (position: math.Vector2, source?: PinEndpoint): void {
    const graph = this.graph;

    if (!graph || this.readOnly) { return; }
    const types = this.nodeTypes?.(graph) ?? [], location = this.canvasPosition(this.makePositionLocal(position)); let search: LineEdit;

    this.dialog.show(this, 'Add Node', body => {
      search = append(body, new EditorSearchField(this.engine)); search.placeholderText = 'Search node types';
      const list = append(body, new VirtualList<GraphNodeType>(this.engine, 24, type => type.category + '/' + type.label, () =>
        new GraphActionRow(this.engine, entry => {
          const node = entry.create(graph, location);

          if (source && node instanceof FlowGraphNode && graph instanceof FlowGraphModel) {
            const input = source.node.HasInputPin(source.pin.m_ID); const pin = (input ? node.m_outputPins : node.m_inputPins).find(pin => pin.m_type === source.pin.m_type);

            if (pin) { if (input) { graph.TryMakeConnection(node, pin, source.node, source.pin); } else { graph.TryMakeConnection(source.node, source.pin, node, pin); } }
          } this.SelectNode(node); this.dialog.close();
        })));

      list.setCustomMinimumSize(380, 280); list.setRows(types); search.on('textChanged', value => list.setRows(types.filter(type => (type.label + ' ' + type.category).toLowerCase().includes(value.toLowerCase()))));
    }, [{ label: 'Cancel', action: () => this.dialog.close() }]); search!.grabFocus();
  }
  rename (node: GraphNode): void {
    if (this.readOnly) { return; } let field: LineEdit;
    const accept = (): void => { if (field.text.trim()) { node.Rename(field.text.trim()); this.dialog.close(); } };

    this.dialog.show(this, 'Rename Node', body => { field = append(body, new EditorTextField(this.engine)); field.text = node.GetName(); field.on('textSubmitted', accept); }, [{ label: 'Rename', primary: true, enabled: () => !!field?.text.trim(), action: accept }, { label: 'Cancel', action: () => this.dialog.close() }]); field!.grabFocus(); field!.selectAll();
  }
  override dispose (): void { this.pointerInteraction.cancel(); this.finishDrag(); for (const name of ['copy', 'cut', 'paste'] as const) { window.document.removeEventListener(name, this.clipboardEvent); } this.menu.dispose(); this.dialog.dispose(); super.dispose(); }
}
