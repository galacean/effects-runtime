import type { Engine, spec } from '@galacean/effects';
import { AnimationGraphAsset, Animator, GraphInstance, InvalidIndex, SerializationHelper, VFXItem, math } from '@galacean/effects';
import type { HBoxContainer, Label } from '@galacean/effects-plugin-gui';
import { Button, Control, LineEdit, TextOverflow } from '@galacean/effects-plugin-gui';
import { editorPanel, menuItem } from '../../framework/registry/editor-registry';
import { EditorSelection } from '../../framework/selection/editor-selection';
import { EditorWindow } from '../../framework/windows/editor-window';
import { append, column, expand, label, margin, row, disposeChildren } from '../../ui/controls/layout';
import { EditorSplitContainer } from '../../ui/controls/split-container';
import { EditorMenuButton } from '../../ui/controls/menu';
import { EditorToolbar } from '../../ui/controls/toolbar';
import { EditorIconControl } from '../../ui/icons/control-icons';
import type { MenuAction } from '../../ui/controls/menu';
import { EditorDialog } from '../../ui/controls/dialog';
import type { GraphNodeSelection } from '../../ui/graph-editor/graph-editor-context';
import { GraphEditorView } from '../../ui/graph-editor/graph-editor-view';
import type { GraphNodeContent, GraphNodeType } from '../../ui/graph-editor/graph-editor-view';
import type { GraphModel, GraphNode } from '../../ui/graph-editor/graph-model';
import * as NodeGraph from '../../ui/graph-editor/index';
import { CommentGraphNode } from '../../ui/graph-editor/comment-graph-node';
import { PropertySheet, propertyBinding } from '../../ui/property-editor/property-sheet';
import { editorColors as C } from '../../ui/theme/control-theme';
import { AnimationGraphCompilationContext } from './compiler/graph-compilation-context';
import { AnimationGraphDecompiler } from './compiler/graph-decompiler';
import { AnimationGraphContext } from './model/animation-graph-context';
import { AnimationFlowGraph } from './model/graphs/flow-graph';
import { AnimationClipEditorNode } from './model/nodes/animation-clip-editor-node';
import { ControlParameterEditorNode, BoolControlParameterEditorNode, FloatControlParameterEditorNode } from './model/nodes/parameter-editor-nodes';
import { ResultEditorNode, PoseResultEditorNode } from './model/nodes/result-editor-node';
import { StateEditorNode } from './model/nodes/state-editor-node';
import { StateMachineEditorNode } from './model/nodes/state-machine-editor-node';
import { TransitionConduitEditorNode, TransitionEditorNode } from './model/nodes/transition-editor-node';
import { ConstBoolEditorNode, ConstFloatEditorNode } from './model/nodes/const-value-editor-nodes';
import { AnimationGraphNode, GraphValueType } from './model/nodes/flow-editor-node';
import { BlendEditorNode } from './model/nodes/blend-editor-node';
import { LayerBlendEditorNode } from './model/nodes/layer-blend-editor-node';
import { ApplyAdditiveEditorNode } from './model/nodes/apply-additive-editor-node';
import { AndEditorNode, OrEditorNode, NotEditorNode } from './model/nodes/bool-editor-nodes';
import { EqualEditorNode, GreaterEditorNode, LessEditorNode } from './model/nodes/operator-editor-nodes';
import { AnimationGraphParametersPanel } from './ui/animation-graph-parameters-panel';

class NodePlayback extends Control {
  progress = 0;
  constructor (engine: Engine) { super(engine); this.setCustomMinimumSize(160, 8); }
  override draw (): void { this.fillRect(0, 0, this.width, 6, C.recessed); this.fillRect(0, 0, this.width * this.progress, 6, C.primary); }
}

@editorPanel()
export class AnimationGraphEditor extends EditorWindow {
  currentVFXItem: VFXItem;
  graph: GraphInstance;
  compilationContext = new AnimationGraphCompilationContext();
  userContext = new AnimationGraphContext();
  flowGraph = new AnimationFlowGraph();
  private primaryGraphView: GraphEditorView;
  private parametersPanel: AnimationGraphParametersPanel;
  private details: PropertySheet;
  private breadcrumbs: HBoxContainer;
  private selectedNodes: GraphNodeSelection[] = [];
  private selectedSignature = '';
  private viewed?: GraphModel;
  private dialog: EditorDialog;
  private zoom: Label;
  private caption: Label;

  @menuItem('Window/AnimationGraph')
  static showWindow (): void { EditorWindow.getWindow(AnimationGraphEditor).open(); }
  constructor () { super(); this.title = 'AnimationGraph'; this.initialSize.set(1200, 720); this.open(); }
  protected override createContent (engine: Engine): Control {
    const body = column(engine), toolbar = new EditorToolbar(engine, 28);

    append(body, margin(engine, toolbar, 6, 4));
    const view = append(toolbar, new EditorMenuButton(engine, 'View'));

    view.actions = () => [{ label: 'Parameters Panel', checked: this.parametersPanel.visible, action: () => { this.parametersPanel.visible = !this.parametersPanel.visible; } }, { label: 'Details Panel', checked: this.details.visible, action: () => { this.details.visible = !this.details.visible; } }];
    const compile = append(toolbar, new Button(engine, 'Compile'));

    compile.on('pressed', () => {
      if (!this.currentVFXItem) { return; }
      try { this.rebuildGraph(this.currentVFXItem); this.parametersPanel.setGraphInstance(this.graph); } catch (error) { this.dialog.show(this.primaryGraphView, 'Compile Graph', body => this.dialog.message(body, error instanceof Error ? error.message : String(error)), [{ label: 'Close', action: () => this.dialog.close() }]); }
    });
    this.caption = expand(toolbar.label('Select an object with an Animator'), true, false); this.caption.textOverflow = TextOverflow.Ellipsis;
    const center = column(engine);

    this.breadcrumbs = append(center, row(engine));
    this.primaryGraphView = append(center, expand(new GraphEditorView(engine, this.userContext)));
    this.primaryGraphView.createNodeContent = node => this.nodeContent(engine, node);
    this.primaryGraphView.nodeTypes = graph => this.nodeTypes(graph);
    this.primaryGraphView.extraActions = node => {
      const actions: MenuAction[] = [];

      if (node instanceof StateEditorNode) {
        if (node.CanConvertToStateMachineState()) { actions.push({ label: 'Convert to State Machine State', enabled: !this.primaryGraphView.IsReadOnly(), action: () => node.ConvertToStateMachineState() }); }
        if (node.CanConvertToBlendTreeState()) { actions.push({ label: 'Convert to Blend Tree State', enabled: !this.primaryGraphView.IsReadOnly(), action: () => node.ConvertToBlendTreeState() }); }
      }
      actions.push({ label: 'Copy Runtime Node ID', enabled: this.userContext.GetRuntimeGraphNodeIndex(node.GetID()) !== InvalidIndex, action: () => { void navigator.clipboard.writeText(String(this.userContext.GetRuntimeGraphNodeIndex(node.GetID()))); } });

      return actions;
    };
    const footer = append(center, new EditorToolbar(engine, 24));
    const fit = append(footer, new Button(engine, 'Fit'));

    fit.on('pressed', () => this.primaryGraphView.FitToView());
    const reset = append(footer, new Button(engine, '1:1'));

    reset.on('pressed', () => this.primaryGraphView.ResetView()); this.zoom = footer.label('100%');
    this.parametersPanel = new AnimationGraphParametersPanel(engine);
    this.details = new PropertySheet(engine, { change: (_label, _owner, action) => {
      const graph = this.primaryGraphView.GetViewedGraph();

      graph?.BeginModification(); action(); graph?.EndModification();
    }, finish: () => {} });
    const right = new EditorSplitContainer(engine, center, this.details, false, .7);

    append(body, expand(new EditorSplitContainer(engine, this.parametersPanel, right, false, .2)));
    this.dialog = new EditorDialog(engine);
    this.userContext.OnNavigateToGraph(graph => this.NavigateToGraph(graph));
    this.userContext.OnNavigateToNode(node => this.NavigateToNode(node, true));
    this.userContext.OnSelectionChanged((_previous, selection) => { this.selectedNodes = selection; this.refreshDetails(); });
    this.primaryGraphView.SetGraphToView(this.flowGraph); this.onSelectionChange(); this.refreshDetails(); this.refreshBreadcrumbs();

    return body;
  }
  override onSelectionChange (): void {
    if (!this.primaryGraphView) { return; }
    const item = EditorSelection.getSelectedObjects()[0];

    if (!(item instanceof VFXItem) || item === this.currentVFXItem) { return; }
    const animator = item.getComponent(Animator);

    if (!animator?.graphInstance) { return; }
    this.currentVFXItem = item; this.graph = animator.graphInstance; this.parametersPanel.setGraphInstance(this.graph);
    this.buildGraphFromAnimator(animator); this.caption.text = item.name; this.refreshBreadcrumbs();
  }
  override onUndoRedo (): void {
    if (this.currentVFXItem) {
      const animator = this.currentVFXItem.getComponent(Animator);

      if (animator?.graphInstance) { this.graph = animator.graphInstance; this.parametersPanel.setGraphInstance(this.graph); this.buildGraphFromAnimator(animator); this.refreshBreadcrumbs(); }
    }
  }
  override update (): void {
    this.userContext.m_pGraphInstance = this.currentVFXItem && !this.currentVFXItem.composition ? null : this.graph ?? null;
    this.userContext.m_nodeIDtoIndexMap = this.compilationContext.GetUUIDToRuntimeIndexMap();
    if (this.primaryGraphView.GetViewedGraph() !== this.viewed) { this.refreshBreadcrumbs(); }
    this.zoom.text = Math.round((this.primaryGraphView.GetViewedGraph()?.m_viewScaleFactor ?? 1) * 100) + '%';
  }
  override dispose (): void { this.dialog.dispose(); super.dispose(); }
  NavigateToGraph (graph: GraphModel): void { this.primaryGraphView.SetGraphToView(graph); this.refreshBreadcrumbs(); }
  NavigateToNode (node: GraphNode, focus: boolean): void { this.NavigateToGraph(node.GetParentGraph()!); this.primaryGraphView.SelectNode(node); if (focus) { this.primaryGraphView.CenterView(node); } }
  private refreshBreadcrumbs (): void {
    disposeChildren(this.breadcrumbs); const graphs: GraphModel[] = []; let graph = this.primaryGraphView.GetViewedGraph();

    this.viewed = graph ?? undefined;
    while (graph) { graphs.unshift(graph); graph = graph.GetParentNode()?.GetParentGraph() ?? null; }
    graphs.forEach((graph, index) => {
      if (index) { append(this.breadcrumbs, new EditorIconControl(this.breadcrumbs.engine, 'chevronRight', 12)); } const button = append(this.breadcrumbs, new Button(this.breadcrumbs.engine, index ? graph.GetName() : 'Root'));

      button.themeTypeVariation = 'EditorToolbarButton'; button.on('pressed', () => this.NavigateToGraph(graph));
    });
  }
  private refreshDetails (): void {
    const node = this.selectedNodes.at(-1)?.m_pNode, signature = node?.GetID() ?? '';

    if (signature === this.selectedSignature && this.details.body.children.length) { return; }
    this.selectedSignature = signature; this.details.clear(); const group = this.details.section('selection', node?.GetTypeName() ?? 'Details');

    if (!node) {
      group.readOnly('Selection', () => 'No Selection');

      return;
    }
    if (node.IsRenameable()) { group.text('Name', { read: () => node.GetName(), write: value => node.Rename(value) }); } else { group.readOnly('Name', () => node.GetName()); }
    if (node instanceof StateEditorNode) { group.readOnly('Type', () => node.IsBlendTreeState() ? 'Blend Tree' : node.IsStateMachineState() ? 'State Machine' : 'Off'); }
    if (node instanceof CommentGraphNode) { group.color('Color', { read: () => node.color, write: value => { node.color = value; } }); }
    if (node instanceof ConstBoolEditorNode || node instanceof BoolControlParameterEditorNode) { group.boolean('Value', propertyBinding(node, 'm_value')); }
    if (node instanceof ConstFloatEditorNode || node instanceof FloatControlParameterEditorNode) { group.number('Value', propertyBinding(node, 'm_value')); }
    if (node instanceof AnimationClipEditorNode) { group.text('Animation Clip ID', propertyBinding(node, 'm_defaultResourceID')); }
    const transitions = node instanceof TransitionConduitEditorNode ? node.GetSecondaryGraph()!.FindAllNodesOfType(TransitionEditorNode) : node instanceof TransitionEditorNode ? [node] : [];

    transitions.forEach((transition, index) => {
      const rule = group.group('rule' + index, 'Rule ' + (index + 1));

      rule.number('Duration', propertyBinding(transition, 'm_duration'), { min: 0, max: 10, step: .01, suffix: ' s' });
      rule.boolean('Clamp To Source', propertyBinding(transition, 'm_clampDurationToSource'));
      rule.boolean('Can Be Forced', propertyBinding(transition, 'm_canBeForced'));
      rule.boolean('Has Exit Time', propertyBinding(transition, 'hasExitTime'));
      rule.number('Exit Time', propertyBinding(transition, 'exitTime'), { min: 0, max: 1 }, { enabled: () => transition.hasExitTime });
      rule.choice('Time Match Mode', propertyBinding(transition, 'm_timeMatchMode'), ['None', 'Synchronized', 'Match Sync Index', 'Match Sync %', 'Match Index + %', 'Match Sync ID', 'Match Closest ID', 'Match ID + %', 'Match Closest ID + %']);
      rule.number('Sync Event Offset', propertyBinding(transition, 'm_syncEventOffset'), { min: -10, max: 10 });
      rule.number('Bone Mask Blend In', propertyBinding(transition, 'm_boneMaskBlendInTimePercentage'), { min: 0, max: 1 });
    }); this.details.refresh();
  }
  private nodeTypes (graph: GraphModel): GraphNodeType[] {
    const types: (new () => GraphNode)[] = [AnimationClipEditorNode, StateMachineEditorNode, BlendEditorNode, LayerBlendEditorNode, ApplyAdditiveEditorNode, ConstBoolEditorNode, ConstFloatEditorNode, BoolControlParameterEditorNode, FloatControlParameterEditorNode, AndEditorNode, OrEditorNode, NotEditorNode, EqualEditorNode, GreaterEditorNode, LessEditorNode, TransitionEditorNode, StateEditorNode];

    if (!graph.FindAllNodesOfType(ResultEditorNode).length) { types.push(PoseResultEditorNode); }

    return types.filter(type => graph.CanCreateNode(type)).map(type => {
      const node = new type();

      const label = type === BoolControlParameterEditorNode ? 'Bool Parameter' : type === FloatControlParameterEditorNode ? 'Float Parameter' : node.GetTypeName();

      return { label, category: node.GetCategory() || 'Graph', create: (graph, position) => graph.CreateNode(type, position) };
    });
  }
  private nodeContent (engine: Engine, node: GraphNode): GraphNodeContent {
    const body = column(engine, [], 4); const info = append(body, label(engine, '')); const playback = append(body, new NodePlayback(engine)); const debug = append(body, label(engine, ''));

    playback.visible = false; debug.setThemeColorOverride('fontColor', C.muted); debug.setThemeFontSizeOverride('fontSize', 12);
    const refresh = (): void => {
      const context = this.userContext, index = context.GetRuntimeGraphNodeIndex(node.GetID()), valid = context.HasDebugData() && index !== InvalidIndex && context.IsNodeActive(index);
      const valueType = node instanceof AnimationGraphNode ? node.GetOutputValueType() : GraphValueType.Pose;

      if (node instanceof StateEditorNode) { info.text = node.IsOffState() ? 'Off State' : node.IsBlendTreeState() ? 'Blend Tree' : 'State Machine'; } else if (node instanceof TransitionEditorNode) { info.text = 'Duration: ' + node.m_duration.toFixed(2) + 's' + (node.m_canBeForced ? '  Forced' : ''); } else if (node instanceof AnimationClipEditorNode) { info.text = node.m_defaultResourceID || 'Empty Animation Slot'; } else if (node instanceof ConstBoolEditorNode || node instanceof ConstFloatEditorNode) { info.text = String(Reflect.get(node, 'm_value')); } else { info.text = ''; }
      info.visible = !!info.text;
      playback.visible = valueType === GraphValueType.Pose;
      if (playback.visible) {
        const data = valid ? context.GetPoseNodeDebugInfo(index) : undefined;

        playback.progress = Math.max(0, Math.min(1, data?.currentTime ?? 0)); debug.text = data ? 'Time: ' + (data.currentTime * data.duration).toFixed(2) + ' / ' + data.duration.toFixed(2) + ' s' : 'Time: N/A';
      } else {
        const value = valid ? context.GetNodeValue<unknown>(index) : undefined;

        debug.text = value === undefined ? '' : 'Value: ' + (typeof value === 'number' ? value.toFixed(3) : String(value));
      }
      debug.visible = !!debug.text;
    };

    refresh();

    return { control: body, refresh };
  }
  private buildGraphFromAnimator (animator: Animator): void {
    //@ts-expect-error
    const graphAsset = animator.graphInstance!.graphAsset;
    const assetData = graphAsset.definition as spec.AnimationGraphAssetData;

    if (!assetData || !assetData.nodeDatas) {
      return;
    }

    const decompiler = new AnimationGraphDecompiler();
    const result = decompiler.decompile(assetData);

    this.flowGraph = result.graph;

    // 使用反编译期间构建的 UUID→Index 映射（与运行时索引一致）
    this.compilationContext.reset();
    for (const [uuid, index] of result.nodeIDToIndexMap) {
      this.compilationContext.GetUUIDToRuntimeIndexMap().set(uuid, index);
      this.compilationContext.GetRuntimeIndexToUUIDMap().set(index, uuid);
    }

    // 导航到新图的根
    this.primaryGraphView.SetGraphToView(this.flowGraph);
    this.primaryGraphView.RequestFitToView();
  }

  rebuildGraph (item: VFXItem) {
    const animator = item.getComponent(Animator);

    if (!animator) {
      return;
    }

    const animationGraphAsset = new AnimationGraphAsset(item.engine);
    const animationGraphAssetData = this.compileGraph();

    SerializationHelper.deserialize(animationGraphAssetData, animationGraphAsset);
    animator.graphInstance = new GraphInstance(animationGraphAsset, item);

    this.graph = animator.graphInstance;
  }

  compileGraph (): spec.AnimationGraphAssetData {
    const rootGraph = this.flowGraph;
    const context = this.compilationContext;

    context.reset();

    // Always compile control parameters first
    //-------------------------------------------------------------------------

    const controlParameters = rootGraph.FindAllNodesOfType<ControlParameterEditorNode>(
      ControlParameterEditorNode,
      [],
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Derived
    );

    const controlParameterIDs = [];

    for (const pParameter of controlParameters) {
      if (pParameter.Compile(context) === InvalidIndex) {
        console.error('Control parameter compile error.');
        // return false;
      }

      controlParameterIDs.push(pParameter.GetParameterID());
    }

    // Compile the actual graph
    //-------------------------------------------------------------------------

    const resultNodes = rootGraph.FindAllNodesOfType(ResultEditorNode);

    if (!resultNodes.length) { throw new Error('The graph needs a result node.'); }
    const rootNodeIdx = resultNodes[0].Compile(context);

    if (rootNodeIdx === InvalidIndex) { throw new Error('The graph could not be compiled. Check its connections.'); }

    const resources = [];

    for (const nodeID of context.GetRegisteredDataSlots()) {
      const animationClipNode = rootGraph.FindNode(nodeID, true) as AnimationClipEditorNode;

      if (!(animationClipNode instanceof AnimationClipEditorNode)) {
        throw new Error('registeredDataSlots has non-AnimationClipGraphNode');
      }
      resources.push({ id: animationClipNode.m_defaultResourceID });
    }

    // Fill runtime definition
    //-------------------------------------------------------------------------

    const graphAsset: spec.AnimationGraphAssetData = {
      nodeDatas: context.nodeDatas,
      graphDataSet: {
        resources: resources,
      },
      id: '',
      dataType: 'AnimationGraphAsset' as spec.DataType,
      rootNodeIndex: rootNodeIdx,
      controlParameterIDs: controlParameterIDs,
    };

    return graphAsset;
  }

}
