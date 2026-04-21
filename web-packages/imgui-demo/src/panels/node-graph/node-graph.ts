import type { spec } from '@galacean/effects';
import { AnimationGraphAsset, Animator, GraphInstance, InvalidIndex, SerializationHelper, VFXItem } from '@galacean/effects';

import { editorWindow, menuItem } from '../../core/decorators';
import { Selection } from '../../core/selection';
import { GalaceanEffects } from '../../ge';
import { ImGui } from '../../imgui';
import { EditorWindow } from '../editor-window';
import { splitter } from '../../widgets';
import { GraphView } from './visual-graph/node-graph-view';
import type { StateMachineGraph } from './tools-graph/graphs/state-machine-graph';
import { StateToolsNode } from './tools-graph/nodes/state-tools-node';
import { ToolsGraphUserContext } from './tools-graph/tools-graph-user-context';
import type { BaseGraph } from './visual-graph/base-graph';
import type { BaseNode } from './visual-graph/base-graph';
import { StateMachineToolsNode } from './tools-graph/nodes/state-machine-tools-node';
import { SelectedNode } from './visual-graph/user-context';
import { Colors } from './tools-graph/colors';
import * as NodeGraph from './visual-graph';
import { AnimationClipToolsNode } from './tools-graph/nodes/animation-clip-tools-node';
import { FlowGraph } from './tools-graph/graphs/flow-graph';
import { ResultToolsNode } from './tools-graph/nodes/result-tools-node';
import { GraphCompilationContext } from './compilation';
import { ControlParameterToolsNode } from './tools-graph/nodes/parameter-tools-nodes';
import { AnimationParametersPanel } from './graph-parameters';
import { GraphDecompiler } from './graph-decompiler';
import { TransitionConduitToolsNode, TransitionToolsNode, TimeMatchMode } from './tools-graph/nodes/transition-tools-node';

type ImVec2 = ImGui.ImVec2;
type ImColor = ImGui.ImColor;
const ImVec2 = ImGui.ImVec2;
const ImColor = ImGui.ImColor;

class GraphDefinition {
  m_rootGraph: NodeGraph.FlowGraph;

  GetRootGraph (): NodeGraph.FlowGraph | null {
    return this.m_rootGraph;
  }
}

class ChildGraphToolsNode {

}

interface LoadedGraphData {
  // m_descriptor: GraphResourceDescriptor,
  m_pGraphDefinition: GraphDefinition | null,
  // m_selectedVariationID: StringID,
  m_pParentNode: BaseNode | null,
}

@editorWindow()
export class AnimationGraph extends EditorWindow {
  currentVFXItem: VFXItem;
  graph: GraphInstance;

  compilationContext = new GraphCompilationContext();

  userContext = new ToolsGraphUserContext();
  stateMachineGraph: StateMachineGraph;
  flowGraph = new FlowGraph();

  private primaryGraphView: GraphView;
  private loadedGraphStack: LoadedGraphData[] = [];
  private selectedNodes: SelectedNode[] = [];
  private breadcrumbPopupContext: NodeGraph.BaseNode | null = null;

  private selectedNode: SelectedNode | null;

  // 参数控制面板
  private parametersPanel = new AnimationParametersPanel();
  private showParametersPanel = true;
  private parametersPanelWidth = 250;

  // 属性面板
  private showDetailsPanel = true;
  private detailsPanelWidth = 250;

  @menuItem('Window/AnimationGraph')
  static showWindow () {
    EditorWindow.getWindow(AnimationGraph).open();
  }

  constructor () {
    super();
    this.title = 'AnimationGraph';
    this.open();
    this.setWindowFlags(ImGui.WindowFlags.NoScrollWithMouse | ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.MenuBar);
    this.primaryGraphView = new GraphView(this.userContext);

    const graphDefinition = new GraphDefinition();

    graphDefinition.m_rootGraph = this.flowGraph;

    this.loadedGraphStack.push({
      m_pGraphDefinition: graphDefinition,
      m_pParentNode: null,
    });

    this.primaryGraphView.SetGraphToView(this.flowGraph);
    this.userContext.OnNavigateToGraph(this.NavigateToGraph.bind(this));
  }

  private buildGraphFromAnimator (animator: Animator): void {
    //@ts-expect-error
    const graphAsset = animator.graphInstance!.graphAsset;
    const assetData = graphAsset.definition as spec.AnimationGraphAssetData;

    if (!assetData || !assetData.nodeDatas) {
      return;
    }

    const decompiler = new GraphDecompiler();
    const result = decompiler.decompile(assetData);

    this.flowGraph = result.graph;

    // 更新 loadedGraphStack
    const graphDefinition = new GraphDefinition();

    graphDefinition.m_rootGraph = this.flowGraph;
    this.loadedGraphStack.length = 0;
    this.loadedGraphStack.push({
      m_pGraphDefinition: graphDefinition,
      m_pParentNode: null,
    });

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

  protected override onGUI (): void {
    // 绘制菜单栏
    if (ImGui.BeginMenuBar()) {
      if (ImGui.BeginMenu('View')) {
        if (ImGui.MenuItem('Parameters Panel', '', this.showParametersPanel)) {
          this.showParametersPanel = !this.showParametersPanel;
        }
        if (ImGui.MenuItem('Details Panel', '', this.showDetailsPanel)) {
          this.showDetailsPanel = !this.showDetailsPanel;
        }

        ImGui.EndMenu();
      }
      ImGui.EndMenuBar();
    }

    const selectedObject = Selection.getSelectedObjects()[0];

    if (selectedObject instanceof VFXItem && selectedObject !== this.currentVFXItem) {
      this.currentVFXItem = selectedObject;

      const animator = this.currentVFXItem.getComponent(Animator);

      if (animator?.graphInstance) {
        this.graph = animator.graphInstance;
        this.parametersPanel.setGraphInstance(animator.graphInstance);
        this.buildGraphFromAnimator(animator);
      }
    }

    if (!this.currentVFXItem || !this.currentVFXItem.getComponent(Animator)) {
      return;
    }

    // if (ImGui.Button('Save') || !this.graph) {
    // this.rebuildGraph(this.currentVFXItem);
    // }

    this.userContext.m_pGraphInstance = this.graph;
    this.userContext.m_nodeIDtoIndexMap = this.compilationContext.GetUUIDToRuntimeIndexMap();

    // 三栏布局：左侧参数面板 | 中间图形视图 | 右侧属性面板
    const contentRegion = ImGui.GetContentRegionAvail();
    const splitterWidth = 4;
    const edgeGap = 24;
    const style = ImGui.GetStyle();
    const panelMinWidth = Math.max(edgeGap, style.WindowMinSize.x + style.WindowPadding.x * 2);

    let parametersWidth = this.showParametersPanel ? this.parametersPanelWidth : 0;
    let detailsWidth = this.showDetailsPanel ? this.detailsPanelWidth : 0;

    const splitterCount = (this.showParametersPanel ? 1 : 0) + (this.showDetailsPanel ? 1 : 0);
    const maxParametersWidth = this.showParametersPanel
      ? Math.max(panelMinWidth, contentRegion.x - detailsWidth - splitterCount * splitterWidth - edgeGap)
      : 0;

    parametersWidth = this.showParametersPanel
      ? Math.max(panelMinWidth, Math.min(maxParametersWidth, parametersWidth))
      : 0;

    const maxDetailsWidth = this.showDetailsPanel
      ? Math.max(panelMinWidth, contentRegion.x - parametersWidth - splitterCount * splitterWidth - edgeGap)
      : 0;

    detailsWidth = this.showDetailsPanel
      ? Math.max(panelMinWidth, Math.min(maxDetailsWidth, detailsWidth))
      : 0;

    const graphViewWidth = Math.max(edgeGap, contentRegion.x - parametersWidth - detailsWidth - splitterCount * splitterWidth);

    // 左侧：参数面板
    if (this.showParametersPanel) {
      if (ImGui.BeginChild('ParametersPanel', new ImVec2(parametersWidth, contentRegion.y), ImGui.ChildFlags.None)) {
        this.parametersPanel.drawPanel(parametersWidth, contentRegion.y);
      }
      ImGui.EndChild();

      ImGui.SameLine();
      this.parametersPanelWidth = splitter('##LeftSplitter', this.parametersPanelWidth, {
        thickness: splitterWidth,
        min: panelMinWidth,
        max: maxParametersWidth,
      });
    }

    // 中间：图形视图
    ImGui.SameLine();
    if (ImGui.BeginChild('CenterPanel', new ImVec2(graphViewWidth, contentRegion.y), ImGui.ChildFlags.None)) {
      if (this.graph) {
        this.DrawGraphView();
      }
    }
    ImGui.EndChild();

    // 右侧：属性面板
    if (this.showDetailsPanel) {
      ImGui.SameLine();
      this.detailsPanelWidth = splitter('##RightSplitter', this.detailsPanelWidth, {
        thickness: splitterWidth,
        min: panelMinWidth,
        max: maxDetailsWidth,
        invert: true,
      });

      ImGui.SameLine();
      if (ImGui.BeginChild('DetailsPanel', new ImVec2(detailsWidth, contentRegion.y), ImGui.ChildFlags.Borders)) {
        this.drawDetailsPanel();
      }
      ImGui.EndChild();
    }

    this.UpdateSelectedNode();
  }

  private UpdateSelectedNode () {
    if (this.selectedNodes.length > 0) {
      const currentSelectedNode = this.selectedNodes[this.selectedNodes.length - 1];

      if (this.selectedNode !== currentSelectedNode) {
        this.selectedNode = currentSelectedNode;
      }
    }
  }

  private drawDetailsPanel () {
    ImGui.Text('Details');
    ImGui.Separator();

    if (this.selectedNodes.length === 0) {
      ImGui.TextDisabled('No Selection');

      return;
    }

    const selected = this.selectedNodes[this.selectedNodes.length - 1].m_pNode;

    if (!selected) {
      ImGui.TextDisabled('No Selection');

      return;
    }

    // Transition 属性
    if (selected instanceof TransitionConduitToolsNode) {
      this.drawTransitionDetails(selected);

      return;
    }

    // State 属性
    if (selected instanceof StateToolsNode) {
      this.drawStateDetails(selected);

      return;
    }

    // 通用节点属性
    this.drawGenericNodeDetails(selected);
  }

  private drawTransitionDetails (conduit: TransitionConduitToolsNode) {
    ImGui.Text('Transition');
    ImGui.Spacing();

    const transitions = conduit.GetSecondaryGraph()!.FindAllNodesOfType<TransitionToolsNode>(TransitionToolsNode);

    if (transitions.length === 0) {
      ImGui.TextDisabled('No transition rules');

      return;
    }

    for (let i = 0; i < transitions.length; i++) {
      const t = transitions[i];

      if (transitions.length > 1) {
        if (!ImGui.CollapsingHeader(`Rule ${i}##rule_${i}`, ImGui.TreeNodeFlags.DefaultOpen)) {
          continue;
        }
      }

      ImGui.PushItemWidth(-1);

      // Duration
      ImGui.Text('Duration');
      let duration = t.m_duration;

      if (ImGui.DragFloat('##duration', (v = duration) => duration = v, 0.01, 0, 10, '%.2f s')) {
        t.m_duration = duration;
      }

      // Clamp Duration To Source
      let clamp = t.m_clampDurationToSource;

      if (ImGui.Checkbox('Clamp To Source', (v = clamp) => clamp = v)) {
        t.m_clampDurationToSource = clamp;
      }

      // Can Be Forced
      let forced = t.m_canBeForced;

      if (ImGui.Checkbox('Can Be Forced', (v = forced) => forced = v)) {
        t.m_canBeForced = forced;
      }

      ImGui.Separator();

      // Has Exit Time
      let hasExit = t.hasExitTime;

      if (ImGui.Checkbox('Has Exit Time', (v = hasExit) => hasExit = v)) {
        t.hasExitTime = hasExit;
      }

      if (t.hasExitTime) {
        ImGui.Text('Exit Time');
        let exitTime = t.exitTime;

        if (ImGui.DragFloat('##exitTime', (v = exitTime) => exitTime = v, 0.01, 0, 1, '%.2f')) {
          t.exitTime = exitTime;
        }
      }

      ImGui.Separator();

      // Time Match Mode
      ImGui.Text('Time Match Mode');
      const modeNames = ['None', 'Synchronized', 'Match Sync Idx', 'Match Sync %%', 'Match Sync Idx + %%', 'Match Sync ID', 'Match Closest ID', 'Match ID + %%', 'Match Closest ID + %%'];
      let currentMode = t.m_timeMatchMode;

      if (ImGui.Combo('##timeMatch', (v = currentMode) => currentMode = v, modeNames, modeNames.length)) {
        t.m_timeMatchMode = currentMode;
      }

      // Sync Event Offset
      ImGui.Text('Sync Event Offset');
      let syncOffset = t.m_syncEventOffset;

      if (ImGui.DragFloat('##syncOffset', (v = syncOffset) => syncOffset = v, 0.01, -10, 10, '%.2f')) {
        t.m_syncEventOffset = syncOffset;
      }

      // Bone Mask Blend In
      ImGui.Text('Bone Mask Blend In %%');
      let boneMask = t.m_boneMaskBlendInTimePercentage;

      if (ImGui.DragFloat('##boneMask', (v = boneMask) => boneMask = v, 0.01, 0, 1, '%.2f')) {
        t.m_boneMaskBlendInTimePercentage = boneMask;
      }

      ImGui.PopItemWidth();
    }
  }

  private drawStateDetails (state: StateToolsNode) {
    const stateType = state.IsBlendTreeState() ? 'Blend Tree' : state.IsStateMachineState() ? 'State Machine' : 'Off';

    ImGui.Text('State');
    ImGui.Spacing();

    ImGui.Text('Name');
    ImGui.PushItemWidth(-1);
    let name = state.GetName();

    if (ImGui.InputText('##stateName', (v = name) => name = v, 256)) {
      state.Rename(name);
    }
    ImGui.PopItemWidth();

    ImGui.Text('Type');
    ImGui.TextDisabled(stateType);
  }

  private drawGenericNodeDetails (node: BaseNode) {
    ImGui.Text(node.GetTypeName());
    ImGui.Spacing();

    ImGui.Text('Name');
    ImGui.PushItemWidth(-1);
    let name = node.GetName();

    if (node.IsRenameable()) {
      if (ImGui.InputText('##nodeName', (v = name) => name = v, 256)) {
        node.Rename(name);
      }
    } else {
      ImGui.TextDisabled(name || node.GetTypeName());
    }
    ImGui.PopItemWidth();
  }

  private GetEditedRootGraph (): NodeGraph.FlowGraph | null {
    return (this.loadedGraphStack[0].m_pGraphDefinition !== null)
      ? this.loadedGraphStack[0].m_pGraphDefinition.GetRootGraph()
      : null;
  }

  DrawGraphView () {
    // Navigation Bar
    //-------------------------------------------------------------------------

    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImVec2(6, 3));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImVec2(4, 2));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImVec2(4, 1));
    if (ImGui.BeginChild('NavBar', new ImVec2(ImGui.GetContentRegionAvail().x, 28), ImGui.ChildFlags.Borders | ImGui.ChildFlags.AlwaysUseWindowPadding)) {
      this.DrawGraphViewNavigationBar();
    }
    ImGui.EndChild();
    ImGui.PopStyleVar(3);

    // Graph View
    //-------------------------------------------------------------------------

    this.primaryGraphView.UpdateAndDraw();

    if (this.primaryGraphView.HasSelectionChangedThisFrame()) {
      this.SetSelectedNodes(this.primaryGraphView.GetSelectedNodes());
    }
  }

  private DrawGraphViewNavigationBar (): void {
    const pRootGraph = this.GetEditedRootGraph()!;

    // Sizes
    //-------------------------------------------------------------------------
    const navBarDimensions = ImGui.GetContentRegionAvail();
    const buttonHeight = navBarDimensions.y;

    // Navigation Bar Item definition
    //-------------------------------------------------------------------------
    interface NavBarItem {
      m_pNode: NodeGraph.BaseNode | null,
      m_stackIdx: number,
      m_isStackBoundary: boolean,
    }

    // Get all entries for breadcrumb
    //-------------------------------------------------------------------------
    const pathFromChildToRoot: NavBarItem[] = [];

    let pathStackIdx = this.loadedGraphStack.length - 1;
    let pGraph = this.primaryGraphView.GetViewedGraph()!;
    let pParentNode: NodeGraph.BaseNode | null = null;

    do {
      // Switch stack if possible
      let isStackBoundary = false;

      pParentNode = pGraph.GetParentNode();
      if (pParentNode === null && pathStackIdx > 0) {
        pParentNode = this.loadedGraphStack[pathStackIdx].m_pParentNode;
        isStackBoundary = true;
        pathStackIdx--;
      }

      // Add item
      if (pParentNode !== null) {
        const item: NavBarItem = {
          m_pNode: pParentNode,
          m_stackIdx: pathStackIdx,
          m_isStackBoundary: isStackBoundary,
        };

        pathFromChildToRoot.push(item);
        pGraph = pParentNode.GetParentGraph()!;
      }

    } while (pParentNode !== null);

    // Draw Home Button
    //-------------------------------------------------------------------------
    ImGui.PushStyleColor(ImGui.Col.Button, new ImColor(0, 0, 0, 0));

    // Root 按钮 — 当前在根图时高亮
    const isAtRoot = pathFromChildToRoot.length === 0;

    if (isAtRoot) {
      ImGui.PushStyleColor(ImGui.Col.Text, new ImColor(0.95, 0.95, 0.95, 1));
    } else {
      ImGui.PushStyleColor(ImGui.Col.Text, new ImColor(0.6, 0.6, 0.6, 1));
    }
    if (ImGui.Button('Root##GoHome', new ImVec2(0, buttonHeight))) {
      this.NavigateToGraph(pRootGraph);
    }
    ImGui.PopStyleColor();

    // Draw breadcrumbs
    //-------------------------------------------------------------------------
    let pGraphToNavigateTo: NodeGraph.BaseGraph | null = null;

    // Draw from root to child
    for (let i = pathFromChildToRoot.length - 1; i >= 0; i--) {
      const isLastItem = (i === 0);
      let drawItem = true;

      const pParentState = pathFromChildToRoot[i].m_pNode!.GetParentGraph()!.GetParentNode() as StateToolsNode;
      const pState = pathFromChildToRoot[i].m_pNode as StateToolsNode;

      // Hide the item if it is a state machine node whose parent is "state machine state"
      if (pParentState instanceof StateToolsNode && !pParentState.IsBlendTreeState()) {
        drawItem = false;
      }

      const isStateMachineState = pState instanceof StateToolsNode && !pState.IsBlendTreeState();

      if (drawItem) {
        // 分隔符 ">"
        ImGui.SameLine(0, 2);
        ImGui.PushStyleColor(ImGui.Col.Text, new ImColor(0.4, 0.4, 0.4, 1));
        ImGui.Text('>');
        ImGui.PopStyleColor();

        // 面包屑项 — 最后一项高亮
        ImGui.SameLine(0, 2);
        if (isLastItem) {
          ImGui.PushStyleColor(ImGui.Col.Text, new ImColor(0.95, 0.95, 0.95, 1));
        } else {
          ImGui.PushStyleColor(ImGui.Col.Text, new ImColor(0.6, 0.6, 0.6, 1));
        }

        const str = `${pathFromChildToRoot[i].m_pNode!.GetName()}##bc_${pathFromChildToRoot[i].m_pNode!.GetID().toString()}`;

        if (ImGui.Button(str, new ImVec2(0, buttonHeight))) {
          if (isStateMachineState) {
            const childStateMachines = pathFromChildToRoot[i].m_pNode!.GetChildGraph()!
              .FindAllNodesOfType<StateMachineToolsNode>(
              StateMachineToolsNode,
              [],
              NodeGraph.SearchMode.Localized,
              NodeGraph.SearchTypeMatch.Exact
            );

            if (childStateMachines.length > 0) {
              pGraphToNavigateTo = childStateMachines[0].GetChildGraph();
            }
          } else {
            const pCG = pathFromChildToRoot[i].m_pNode;

            if (pCG instanceof ChildGraphToolsNode) {
              pGraphToNavigateTo = this.loadedGraphStack[pathFromChildToRoot[i].m_stackIdx + 1]
                .m_pGraphDefinition!.GetRootGraph();
            } else {
              pGraphToNavigateTo = pathFromChildToRoot[i].m_pNode!.GetChildGraph();
            }
          }
        }
        ImGui.PopStyleColor();
      }
    }
    ImGui.PopStyleColor(); // Button transparent

    // Toolbar — 右对齐
    //-------------------------------------------------------------------------
    const viewedGraph = this.primaryGraphView.GetViewedGraph();
    const zoomPercent = viewedGraph ? Math.round(viewedGraph.m_viewScaleFactor * 100) : 100;
    const toolsText = `${zoomPercent}%`;
    const toolsWidth = 120;

    ImGui.SameLine(navBarDimensions.x - toolsWidth, 0);

    ImGui.PushStyleColor(ImGui.Col.Button, new ImColor(0.25, 0.25, 0.25, 0.8));
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, new ImColor(0.35, 0.35, 0.35, 1));
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, new ImColor(0.45, 0.45, 0.45, 1));

    if (ImGui.Button('Fit##FitView', new ImVec2(30, buttonHeight))) {
      this.primaryGraphView.FitToView();
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Fit all nodes in view');
    }

    ImGui.SameLine(0, 4);
    if (ImGui.Button('1:1##ResetZoom', new ImVec2(30, buttonHeight))) {
      this.primaryGraphView.ResetView();
      if (viewedGraph) {
        viewedGraph.m_viewScaleFactor = 1.0;
      }
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Reset zoom to 100%');
    }
    ImGui.PopStyleColor(3);

    ImGui.SameLine(0, 8);
    ImGui.PushStyleColor(ImGui.Col.Text, new ImColor(0.55, 0.55, 0.55, 1));
    ImGui.Text(toolsText);
    ImGui.PopStyleColor();

    // Handle navigation request
    //-------------------------------------------------------------------------
    if (pGraphToNavigateTo !== null) {
      this.NavigateToGraph(pGraphToNavigateTo);
    }

  }

  compileGraph (): spec.AnimationGraphAssetData {
    const rootGraph = this.flowGraph;
    const context = this.compilationContext;

    context.reset();

    // Always compile control parameters first
    //-------------------------------------------------------------------------

    const controlParameters = rootGraph.FindAllNodesOfType<ControlParameterToolsNode>(
      ControlParameterToolsNode,
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

    const resultNodes = rootGraph.FindAllNodesOfType(ResultToolsNode);
    const rootNodeIdx = resultNodes[0].Compile(context);

    const resources = [];

    for (const nodeID of context.GetRegisteredDataSlots()) {
      const animationClipNode = rootGraph.FindNode(nodeID, true) as AnimationClipToolsNode;

      if (!(animationClipNode instanceof AnimationClipToolsNode)) {
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

  NavigateToNode (pNode: BaseNode, focusViewOnNode: boolean): void {
    const pParentGraph = pNode.GetParentGraph()!;

    this.NavigateToGraph(pParentGraph);

    if (this.primaryGraphView.GetViewedGraph()!.FindNode(pNode.GetID())) {
      this.primaryGraphView.SelectNode(pNode);
      this.SetSelectedNodes([new SelectedNode(pNode)]);
      if (focusViewOnNode) {
        this.primaryGraphView.CenterView(pNode);
      }
    }
  }

  NavigateToGraph (pGraph: BaseGraph): void {
    this.ClearSelection();

    if (this.primaryGraphView.GetViewedGraph() !== pGraph) {
      const stackIdx = this.GetStackIndexForGraph(pGraph);

      if (stackIdx !== InvalidIndex) {
        while (stackIdx < (this.loadedGraphStack.length - 1)) {
          this.PopGraphStack();
        }
      }

      this.primaryGraphView.SetGraphToView(pGraph);
    }
  }

  // Selection
  //-------------------------------------------------------------------------

  SetSelectedNodes (selectedNodes: SelectedNode[]) {
    this.selectedNodes = selectedNodes;
  }

  ClearSelection () {
    this.selectedNodes.length = 0;
  }

  private GetStackIndexForGraph (pGraph: BaseGraph): number {
    for (let i = 0; i < this.loadedGraphStack.length; i++) {
      const pFoundGraph = this.loadedGraphStack[i].m_pGraphDefinition!.GetRootGraph()!.FindPrimaryGraph(pGraph.GetID());

      if (pFoundGraph !== null) {

        return i;
      }
    }

    return InvalidIndex;
  }

  PopGraphStack (): void {
    this.loadedGraphStack.pop();
    this.UpdateUserContext();
  }

  private UpdateUserContext (): void {
    const lastStackItem = this.loadedGraphStack[this.loadedGraphStack.length - 1];

    // this.userContext.m_selectedVariationID = lastStackItem.m_selectedVariationID;
    // this.userContext.m_pVariationHierarchy = lastStackItem.m_pGraphDefinition!.GetVariationHierarchy();

    // //-------------------------------------------------------------------------

    // if (this.IsDebugging() && this.m_pDebugGraphInstance !== null) {
    //   this.userContext.m_pGraphInstance = lastStackItem.m_pGraphInstance;
    //   this.userContext.m_nodeIDtoIndexMap = lastStackItem.m_nodeIDtoIndexMap;
    //   this.userContext.m_nodeIndexToIDMap = lastStackItem.m_nodeIndexToIDMap;
    // } else {
    //   this.userContext.m_pGraphInstance = null;
    //   this.userContext.m_nodeIDtoIndexMap.clear();
    //   this.userContext.m_nodeIndexToIDMap.clear();
    // }

    //-------------------------------------------------------------------------

    if (this.loadedGraphStack.length > 1) {
      this.userContext.SetExtraGraphTitleInfoText('External Child Graph');
      this.userContext.SetExtraTitleInfoTextColor(Colors.HotPink);
    } else { // In main graph
      this.userContext.ResetExtraTitleInfo();
    }
  }
}

const data = {
  'nodes': [
    {
      'id': 1,
      'type': 'AnimationRootGraphNode',
      'position': {
        'x': 392,
        'y': 200,
      },
      'source': 1,
    },
    {
      'id': 2,
      'type': 'Blend1DGraphNode',
      'position': {
        'x': 92,
        'y': 200,
      },
      'source0': 3,
      'source1': 4,
      'parameter': 2,
      'poseOut': 5,
    },
    {
      'id': 3,
      'type': 'ConstFloatGraphNode',
      'position': {
        'x': -208,
        'y': 100,
      },
      'valueOut': 6,
    },
    {
      'id': 4,
      'type': 'AnimationClipGraphNode',
      'position': {
        'x': -208,
        'y': 200,
      },
      'poseOut': 7,
      'resourceID': '25ea2eda5e0e41a1a59a45294bcb5b2d',
    },
    {
      'id': 5,
      'type': 'AnimationClipGraphNode',
      'position': {
        'x': -208,
        'y': 300,
      },
      'poseOut': 8,
      'resourceID': '83864e16075b490b8b487e58844d1191',
    },
  ],
  'links': [
    {
      'sourceNode': 2,
      'sourcePin': 5,
      'targetNode': 1,
      'targetPin': 1,
    },
    {
      'sourceNode': 4,
      'sourcePin': 7,
      'targetNode': 2,
      'targetPin': 3,
    },
    {
      'sourceNode': 5,
      'sourcePin': 8,
      'targetNode': 2,
      'targetPin': 4,
    },
    {
      'sourceNode': 3,
      'sourcePin': 6,
      'targetNode': 2,
      'targetPin': 2,
    },
  ],
};