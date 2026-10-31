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
import type { MenuAction } from '../controls/menu';
import { VirtualList } from '../controls/virtual-list';
import { PropertySheet } from '../property-editor/property-sheet';
import { editorBox, editorColors as C, EDITOR_FONT } from '../theme/control-theme';
import { CommentGraphNode } from './comment-graph-node';
import type { Pin } from './flow-graph-model';
import { FlowGraphModel, FlowGraphNode } from './flow-graph-model';
import { GraphNodeSelection } from './graph-editor-context';
import type { GraphEditorContext } from './graph-editor-context';
import type { GraphModel } from './graph-model';
import { GraphNode, NodeVisualState } from './graph-model';
import { GraphRect } from './graph-rect';
import { GraphViewGeometry } from './graph-view-geometry';
import { StateGraphNode, StateMachineGraphModel, TransitionGraphNode } from './state-machine-graph-model';

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
  constructor (engine: Engine, readonly graphView: GraphEditorView, readonly endpoint: PinEndpoint, readonly input: boolean) {
    super(engine); this.setCustomMinimumSize(80, 24); setTooltip(this, endpoint.pin.m_name + ' (' + endpoint.pin.m_type + ')');
  }
  override draw (): void {
    const node = this.endpoint.node, pin = this.endpoint.pin, x = this.input ? 8 : this.width - 8;
    const connected = this.graphView.GetFlowGraph()?.m_connections.some(connection => connection.m_inputPinID === pin.m_ID || connection.m_outputPinID === pin.m_ID);
    const color = node.GetPinColor(pin);

    if (connected) { this.fillCircle(x, this.height / 2, 5, color); } else { this.drawCircle(x, this.height / 2, 5, color, 1.5); }
    const metrics = this.measureText(pin.m_name, 12, EDITOR_FONT);

    this.drawText(this.input ? 19 : this.width - 19 - metrics.width, (this.height - metrics.lineHeight) / 2, pin.m_name, 12, C.foreground, EDITOR_FONT);
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) { this.graphView.startConnection(this.endpoint, event); } else if (event.buttonIndex === MouseButton.Right) { this.graphView.showContext(event.globalPosition, this.endpoint.node, this.endpoint.pin); }
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
  constructor (engine: Engine, readonly graphView: GraphEditorView, readonly node: GraphNode) {
    super(engine); this.focusMode = FocusMode.Click;
    this.caption = append(this, label(engine, node.GetName())); this.caption.mouseFilter = MouseFilter.Ignore; this.caption.textOverflow = TextOverflow.Ellipsis; this.caption.verticalAlignment = VerticalAlignment.Center;
    this.nodeContent = graphView.createNodeContent?.(node);
    if (this.nodeContent) { append(this, this.nodeContent.control); this.nodeContent.control.mouseFilter = MouseFilter.Pass; }
    this.sync();
  }
  sync (): void {
    this.caption.text = this.node.GetName(); this.node.updateDebugState(this.graphView.context); this.nodeContent?.refresh?.();
    const node = this.node;

    if (node instanceof FlowGraphNode) {
      const signature = [...node.m_inputPins, ...node.m_outputPins].map(pin => pin.m_ID).join(',');

      if (signature !== this.pinSignature) {
        this.pinSignature = signature; this.pins.splice(0).forEach(pin => pin.dispose());
        for (const [pins, input] of [[node.m_inputPins, true], [node.m_outputPins, false]] as const) {
          pins.forEach(pin => this.pins.push(append(this, new GraphPinControl(this.engine, this.graphView, { node, pin }, input))));
        }
      }
    }
    this.queueSort();
  }
  override getMinimumSize (): math.Vector2 {
    if (this.node instanceof CommentGraphNode) { return this.node.getCommentBoxSize(); }
    const node = this.node, count = node instanceof FlowGraphNode ? Math.max(node.m_inputPins.length, node.m_outputPins.length) : 0;
    const content = this.nodeContent?.control.getCombinedMinimumSize();

    return new math.Vector2(Math.max(240, Math.min(400, content?.x ?? 0) + 20), 38 + count * 24 + (content?.y ?? 0) + 10);
  }
  protected override sortChildren (): void {
    place(this.caption, 12, 6, this.width - 24, 24);
    const node = this.node;

    if (node instanceof FlowGraphNode) {
      this.pins.forEach(pin => {
        const index = (pin.input ? node.m_inputPins : node.m_outputPins).indexOf(pin.endpoint.pin);

        place(pin, pin.input ? 0 : this.width / 2, 38 + index * 24, this.width / 2, 24); pin.endpoint.pin.m_position.set(node.m_canvasPosition.x + (pin.input ? 8 : this.width - 8), node.m_canvasPosition.y + 50 + index * 24);
      });
    }
    if (this.nodeContent) {
      const count = node instanceof FlowGraphNode ? Math.max(node.m_inputPins.length, node.m_outputPins.length) : 0;

      place(this.nodeContent.control, 10, 38 + count * 24, this.width - 20, Math.max(0, this.height - 48 - count * 24));
    }
  }
  pinAt (position: math.Vector2): PinEndpoint | undefined {
    return this.pins.find(pin => pin.hasPoint(pin.makePositionLocal(position)))?.endpoint;
  }
  override draw (): void {
    const node = this.node, selected = this.graphView.IsNodeSelected(node), active = node.IsActive(this.graphView.context);
    const comment = node instanceof CommentGraphNode;
    const background = comment ? new math.Color(node.color.r, node.color.g, node.color.b, .18) : C.panel;

    this.drawStyleBox(editorBox(background, 0, 5, selected ? C.primary : active ? new math.Color(.2, .8, .2, 1) : C.outline), 0, 0, this.width, this.height);
    const title = comment ? node.color : node.GetTitleBarColor();

    this.fillRect(1, 1, this.width - 2, 31, title); this.fillRect(0, 32, this.width, 1, C.outline);
    if (comment) { this.drawLine(this.width - 12, this.height - 3, this.width - 3, this.height - 12, C.muted); }
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Right) {
      this.graphView.showContext(event.globalPosition, this.node); event.accept();

      return;
    }
    if (event.buttonIndex === MouseButton.Middle) {
      this.graphView.startPan(event); event.accept();

      return;
    }
    if (event.buttonIndex !== MouseButton.Left) { return; }
    if (event.doubleClick) {
      const target = this.node.GetNavigationTarget();

      if (target) { this.graphView.context.NavigateTo(target); } else { this.graphView.context.DoubleClick(this.node); }
    } else if (this.node instanceof CommentGraphNode && (event.position.x < 8 || event.position.x > this.width - 8 || event.position.y < 5 || event.position.y > this.height - 8)) {
      this.graphView.startResize(this.node, event, { left: event.position.x < 8, right: event.position.x > this.width - 8, top: event.position.y < 5, bottom: event.position.y > this.height - 8 });
    } else if (this.node instanceof StateGraphNode && event.shiftPressed) { this.graphView.startTransition(this.node, event); } else { this.graphView.startNodeDrag(this.node, event); }
    event.accept();
  }
  override onMouseMove (event: InputEventMouseMotion): void { this.graphView.pointerMove(event); }
  override onMouseUp (event: InputEventMouseButton): void { this.graphView.pointerUp(event); }
  override onKeyDown (event: InputEventKey): void { this.graphView.onKeyDown(event); }
}

export class GraphEditorView extends Container {
  readonly context: GraphEditorContext;
  createNodeContent?: (node: GraphNode) => GraphNodeContent;
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
    this.menu = new EditorMenu(engine); this.dialog = new EditorDialog(engine);
    for (const name of ['copy', 'cut', 'paste'] as const) { window.document.addEventListener(name, this.clipboardEvent); }
  }
  GetViewedGraph (): GraphModel | null { return this.graph; }
  GetFlowGraph (): FlowGraphModel | null { return this.graph instanceof FlowGraphModel ? this.graph : null; }
  GetStateMachineGraph (): StateMachineGraphModel | null { return this.graph instanceof StateMachineGraphModel ? this.graph : null; }
  IsViewingFlowGraph (): boolean { return this.graph instanceof FlowGraphModel; }
  IsViewingStateMachineGraph (): boolean { return this.graph instanceof StateMachineGraphModel; }
  IsReadOnly (): boolean { return this.readOnly; }
  SetReadOnly (value: boolean): void { this.readOnly = value; }
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
  override update (dt: number): void { this.refreshNodes(); if (this.fitRequested && this.width > 0 && this.height > 0) { this.fitRequested = false; this.FitToView(); } super.update(dt); }
  private refreshNodes (): void {
    const nodes = this.graph?.m_nodes.filter(node => !(node instanceof TransitionGraphNode) && node.IsVisible()) ?? [];

    for (const [node, control] of this.nodeControls) { if (!nodes.includes(node)) { control.dispose(); this.nodeControls.delete(node); } }
    for (const node of nodes) {
      let control = this.nodeControls.get(node);

      if (!control) { control = append(node instanceof CommentGraphNode ? this.commentLayer : this.nodeLayer, new GraphNodeControl(this.engine, this, node)); this.nodeControls.set(node, control); }
      control.sync(); const size = control.getCombinedMinimumSize();

      node.SetCalculatedNodeSize(size);
      place(control, node.m_canvasPosition.x, node.m_canvasPosition.y, size.x, size.y);
    }
    this.SelectNodes(this.selected.filter(node => this.graph?.m_nodes.includes(node))); this.queueSort();
  }
  protected override sortChildren (): void {
    const graph = this.graph;

    if (!graph) { return; }
    for (const layer of [this.commentLayer, this.nodeLayer]) {
      layer.setPosition(-graph.m_viewOffset.x * graph.m_viewScaleFactor, -graph.m_viewOffset.y * graph.m_viewScaleFactor);
      layer.setSize(Math.max(1, this.width / graph.m_viewScaleFactor), Math.max(1, this.height / graph.m_viewScaleFactor));
      layer.setScale(graph.m_viewScaleFactor, graph.m_viewScaleFactor);
    }
    this.geometry.m_viewOffset.copyFrom(graph.m_viewOffset); this.geometry.SetViewScaleFactor(graph.m_viewScaleFactor);
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
    this.fillRect(0, 0, this.width, this.height, C.recessed);
    const graph = this.graph;

    if (!graph) { return; }
    const spacing = 30 * graph.m_viewScaleFactor;

    for (let x = -graph.m_viewOffset.x * graph.m_viewScaleFactor % spacing; x < this.width; x += spacing) { this.drawLine(x, 0, x, this.height, C.outline); }
    for (let y = -graph.m_viewOffset.y * graph.m_viewScaleFactor % spacing; y < this.height; y += spacing) { this.drawLine(0, y, this.width, y, C.outline); }
    if (graph instanceof FlowGraphModel) {
      for (const connection of graph.m_connections) {
        const from = graph.FindNode(connection.m_fromNodeID) as FlowGraphNode, to = graph.FindNode(connection.m_toNodeID) as FlowGraphNode;
        const output = from?.m_outputPins.find(pin => pin.m_ID === connection.m_outputPinID), input = to?.m_inputPins.find(pin => pin.m_ID === connection.m_inputPinID);

        if (output && input) { this.bezier(this.viewPosition(output.m_position), this.viewPosition(input.m_position), from.GetPinColor(output)); }
      }
    }
    this.transitions = [];
    for (const node of graph.m_nodes) {
      if (!(node instanceof TransitionGraphNode)) { continue; }
      node.updateDebugState(this.context);
      const a = graph.FindNode(node.GetStartStateID()), b = graph.FindNode(node.GetEndStateID());

      if (!a || !b) { continue; }
      const ac = a.GetRect().GetCenter(), bc = b.GetRect().GetCenter();
      const from = this.viewPosition(this.borderPoint(a.GetRect(), bc)), to = this.viewPosition(this.borderPoint(b.GetRect(), ac));
      const color = node.GetConduitColor(this.geometry, this.context, new Map([[NodeVisualState.Selected, this.IsNodeSelected(node)]]));

      this.drawLine(from.x, from.y, to.x, to.y, color, 2); this.arrow(from, to, color);
      if (node.m_transitionProgress > 0) {
        const t = node.m_transitionProgress;

        this.fillCircle(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 5, C.foreground);
      }
      this.transitions.push({ node, from, to });
    }
    if (this.drag?.kind === 'connection' && this.drag.pin) {
      const source = this.viewPosition(this.drag.pin.pin.m_position), target = this.drag.mouse;

      if (this.drag.pin.node.HasInputPin(this.drag.pin.pin.m_ID)) { this.bezier(target, source, C.foreground); } else { this.bezier(source, target, C.foreground); }
    }
    if (this.drag?.kind === 'transition' && this.drag.state) {
      const source = this.viewPosition(this.drag.state.GetRect().GetCenter());

      this.drawLine(source.x, source.y, this.drag.mouse.x, this.drag.mouse.y, C.foreground, 2);
    }
  }
  protected override drawChildren (): void {
    super.drawChildren();
    if (this.drag?.kind === 'marquee') {
      const a = this.drag.origin, b = this.drag.mouse;

      this.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y), new math.Color(0, .44, .88, .15)); this.drawRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y), C.primary);
    }
  }
  private borderPoint (rect: GraphRect, target: math.Vector2): math.Vector2 {
    const center = rect.GetCenter(), dx = target.x - center.x, dy = target.y - center.y;
    const t = Math.min(rect.GetWidth() / 2 / Math.max(.001, Math.abs(dx)), rect.GetHeight() / 2 / Math.max(.001, Math.abs(dy)));

    return new math.Vector2(center.x + dx * t, center.y + dy * t);
  }
  private arrow (from: math.Vector2, to: math.Vector2, color: math.Color): void {
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length;

    this.fillTriangle(to.x, to.y, to.x - ux * 12 + uy * 5, to.y - uy * 12 - ux * 5, to.x - ux * 12 - uy * 5, to.y - uy * 12 + ux * 5, color);
  }
  private bezier (a: math.Vector2, b: math.Vector2, color: math.Color): void {
    const delta = Math.max(50, Math.abs(b.x - a.x) * .5), points: number[] = [];

    for (let i = 0; i <= 32; i++) {
      const t = i / 32, q = 1 - t;

      points.push(q ** 3 * a.x + 3 * q * q * t * (a.x + delta) + 3 * q * t * t * (b.x - delta) + t ** 3 * b.x, q ** 3 * a.y + 3 * q * q * t * a.y + 3 * q * t * t * b.y + t ** 3 * b.y);
    }
    this.drawPolyline(points, color, 2);
  }
  private transitionAt (point: math.Vector2): TransitionGraphNode | undefined {
    return this.transitions.find(({ from, to }) => {
      const dx = to.x - from.x, dy = to.y - from.y; const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy || 1)));

      return Math.hypot(point.x - from.x - dx * t, point.y - from.y - dy * t) < 7;
    })?.node;
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (!this.graph) { return; } this.pointer.copyFrom(event.position); this.grabFocus();
    const transition = this.transitionAt(event.position);

    if (event.buttonIndex === MouseButton.Right) { this.showContext(event.globalPosition, transition); } else if (event.buttonIndex === MouseButton.Middle) { this.startPan(event); } else if (event.buttonIndex === MouseButton.Left) {
      if (transition) { this.SelectNode(transition); if (event.doubleClick && transition.GetNavigationTarget()) { this.context.NavigateTo(transition.GetNavigationTarget()!); } } else { if (!event.ctrlPressed && !event.metaPressed && !event.shiftPressed) { this.ClearSelection(); } this.drag = this.newDrag('marquee', event); this.drag.selection = [...this.selected]; }
    }
    event.accept();
  }
  private newDrag (kind: GraphDrag['kind'], event: InputEventMouseButton): GraphDrag {
    const point = this.makePositionLocal(event.globalPosition);

    this.grabFocus();

    return { kind, origin: point, mouse: point.clone(), offset: this.graph!.m_viewOffset.clone() };
  }
  startPan (event: InputEventMouseButton): void { if (this.graph) { this.drag = this.newDrag('pan', event); } }
  startNodeDrag (node: GraphNode, event: InputEventMouseButton): void {
    if (event.ctrlPressed || event.metaPressed) { this.SelectNodes(this.IsNodeSelected(node) ? this.selected.filter(item => item !== node) : [...this.selected, node]); } else if (!this.IsNodeSelected(node)) { this.SelectNodes(event.shiftPressed ? [...this.selected, node] : [node]); }
    if (this.readOnly || !this.IsNodeSelected(node)) { return; }
    this.drag = this.newDrag('nodes', event); let nodes = this.selected;

    if (node instanceof CommentGraphNode && !event.altPressed) { nodes = [...new Set([...nodes, ...this.graph!.m_nodes.filter(item => !(item instanceof TransitionGraphNode) && node.GetRect().Contains(item.GetPosition()))])]; }
    this.drag.positions = new Map(nodes.map(item => [item, item.GetPosition()])); this.graph!.BeginModification();
  }
  startConnection (pin: PinEndpoint, event: InputEventMouseButton): void {
    if (this.readOnly || !this.graph) { return; }
    if (event.altPressed) {
      this.GetFlowGraph()?.BreakAnyConnectionsForPin(pin.pin.m_ID);

      return;
    }
    this.drag = this.newDrag('connection', event); this.drag.pin = pin;
  }
  startTransition (node: StateGraphNode, event: InputEventMouseButton): void { if (!this.readOnly) { this.drag = this.newDrag('transition', event); this.drag.state = node; } }
  startResize (node: CommentGraphNode, event: InputEventMouseButton, edges: NonNullable<GraphDrag['resizeEdges']>): void {
    if (!this.readOnly) {
      this.drag = this.newDrag('resize', event); this.drag.comment = node; this.drag.size = node.getCommentBoxSize().clone();
      this.drag.positions = new Map([[node, node.GetPosition()]]); this.drag.resizeEdges = edges; this.graph!.BeginModification();
    }
  }
  override onMouseMove (event: InputEventMouseMotion): void { this.pointerMove(event); }
  pointerMove (event: InputEventMouseMotion): void {
    const point = this.makePositionLocal(event.globalPosition);

    this.pointer.copyFrom(point);
    const drag = this.drag, graph = this.graph;

    if (!drag || !graph) { return; }
    drag.mouse = point; const delta = new math.Vector2((point.x - drag.origin.x) / graph.m_viewScaleFactor, (point.y - drag.origin.y) / graph.m_viewScaleFactor);

    if (drag.kind === 'pan') { graph.m_viewOffset.set(drag.offset.x - delta.x, drag.offset.y - delta.y); }
    if (drag.kind === 'nodes') { drag.positions?.forEach((start, node) => node.m_canvasPosition.set(start.x + delta.x, start.y + delta.y)); }
    if (drag.kind === 'resize') {
      const edges = drag.resizeEdges!, size = drag.size!, node = drag.comment!, origin = drag.positions!.get(node)!;
      const width = Math.max(80, size.x + (edges.left ? -delta.x : edges.right ? delta.x : 0));
      const height = Math.max(80, size.y + (edges.top ? -delta.y : edges.bottom ? delta.y : 0));

      node.m_commentBoxSize.set(width, height); node.m_canvasPosition.set(origin.x + (edges.left ? size.x - width : 0), origin.y + (edges.top ? size.y - height : 0));
    }
    if (drag.kind === 'marquee') {
      const a = this.canvasPosition(drag.origin), b = this.canvasPosition(point), rect = new GraphRect(new math.Vector2(Math.min(a.x, b.x), Math.min(a.y, b.y)), new math.Vector2(Math.max(a.x, b.x), Math.max(a.y, b.y)));

      this.SelectNodes([...drag.selection!, ...graph.m_nodes.filter(node => !(node instanceof TransitionGraphNode) && rect.Overlaps(node.GetRect()))]);
    }
    this.queueSort(); event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void { this.pointerUp(event); }
  pointerUp (event: InputEventMouseButton): void {
    const drag = this.drag;

    if (!drag) { return; }
    const point = this.canvasPosition(this.makePositionLocal(event.globalPosition));

    if (!event.canceled && drag.kind === 'connection' && drag.pin) {
      const flow = this.GetFlowGraph(), source = drag.pin;
      let target: PinEndpoint | undefined, distance = 18 / this.graph!.m_viewScaleFactor;

      for (const control of this.nodeControls.values()) {
        const pin = control.pinAt(event.globalPosition);

        if (pin && pin.node !== source.node && pin.node.HasInputPin(pin.pin.m_ID) !== source.node.HasInputPin(source.pin.m_ID)) {
          target = pin;

          break;
        }
      }
      for (const node of flow?.m_nodes ?? []) {
        if (!(node instanceof FlowGraphNode)) { continue; } for (const pin of [...node.m_inputPins, ...node.m_outputPins]) {
          const d = Math.hypot(pin.m_position.x - point.x, pin.m_position.y - point.y);

          if (d < distance && node !== source.node && node.HasInputPin(pin.m_ID) !== source.node.HasInputPin(source.pin.m_ID)) { target = { node, pin }; distance = d; }
        }
      }
      if (target) { if (source.node.HasInputPin(source.pin.m_ID)) { flow?.TryMakeConnection(target.node, target.pin, source.node, source.pin); } else { flow?.TryMakeConnection(source.node, source.pin, target.node, target.pin); } } else { this.showCreateDialog(event.globalPosition, source); }
    }
    if (!event.canceled && drag.kind === 'transition' && drag.state) {
      const target = this.graph?.m_nodes.find(node => node instanceof StateGraphNode && node.GetRect().Contains(point)) as StateGraphNode | undefined;
      const graph = this.GetStateMachineGraph();

      if (target && graph?.CanCreateTransitionConduit(drag.state, target)) { graph.CreateTransitionConduit(drag.state, target); }
    }
    this.finishDrag(event.canceled); event.accept();
  }
  private finishDrag (cancel = false): void {
    const drag = this.drag;

    if (!drag) { return; }
    if (cancel) { drag.positions?.forEach((position, node) => node.m_canvasPosition.copyFrom(position)); if (drag.comment && drag.size) { drag.comment.m_commentBoxSize.copyFrom(drag.size); } }
    if (drag.kind === 'nodes' || drag.kind === 'resize') { this.graph?.EndModification(); }
    this.drag = undefined;
  }
  override onMouseWheel (event: InputEventMouseButton): void {
    const graph = this.graph;

    if (!graph) { return; }
    const anchor = this.canvasPosition(event.position), factor = event.buttonIndex === MouseButton.WheelUp ? 1.1 : 1 / 1.1;

    graph.m_viewScaleFactor = Math.max(.2, Math.min(2, graph.m_viewScaleFactor * factor)); graph.m_viewOffset.set(anchor.x - event.position.x / graph.m_viewScaleFactor, anchor.y - event.position.y / graph.m_viewScaleFactor); this.queueSort(); event.accept();
  }
  override onKeyDown (event: InputEventKey): void {
    const command = event.ctrlPressed || event.metaPressed, key = event.keycode.toLowerCase();

    if (command && key === 'c') { this.CopySelectedNodes(); } else if (command && key === 'x') { this.CopySelectedNodes(); this.DestroySelectedNodes(); } else if (command && key === 'v') { this.PasteNodes(this.canvasPosition(this.pointer)); } else if (key === 'escape') { this.finishDrag(true); } else if (key === 'delete' || key === 'backspace') { this.DestroySelectedNodes(); } else if (key === 'f' || key === 'home') { this.FitToView(); } else if (key === 'f2' && this.selected[0]?.IsRenameable()) { this.rename(this.selected[0]); } else if (command && key === 'a') { this.SelectNodes(this.graph?.m_nodes ?? []); } else if (command && key === 'd') { this.CopySelectedNodes(); this.PasteNodes(this.canvasPosition(this.pointer)); } else if (key === 'c' && !command) { this.CreateCommentAroundSelectedNodes(); } else if (event.altPressed && key === 'arrowup') {
      const parent = this.graph?.GetNavigationTarget();

      if (parent) { this.context.NavigateTo(parent); }
    } else { return; }
    event.accept();
  }
  ResetView (): void { if (this.graph) { this.graph.m_viewScaleFactor = 1; this.graph.m_viewOffset.set(-40, -40); this.queueSort(); } }
  RequestFitToView (): void { this.fitRequested = true; }
  FitToView (): void {
    const graph = this.graph, nodes = this.selected.length ? this.selected : graph?.m_nodes.filter(node => !(node instanceof TransitionGraphNode));

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
  private rename (node: GraphNode): void {
    if (this.readOnly) { return; } let field: LineEdit;
    const accept = (): void => { if (field.text.trim()) { node.Rename(field.text.trim()); this.dialog.close(); } };

    this.dialog.show(this, 'Rename Node', body => { field = append(body, new EditorTextField(this.engine)); field.text = node.GetName(); field.on('textSubmitted', accept); }, [{ label: 'Rename', primary: true, enabled: () => !!field?.text.trim(), action: accept }, { label: 'Cancel', action: () => this.dialog.close() }]); field!.grabFocus(); field!.selectAll();
  }
  override dispose (): void { this.finishDrag(); for (const name of ['copy', 'cut', 'paste'] as const) { window.document.removeEventListener(name, this.clipboardEvent); } this.menu.dispose(); this.dialog.dispose(); super.dispose(); }
}
