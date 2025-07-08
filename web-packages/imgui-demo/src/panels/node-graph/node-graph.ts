import type { spec } from '@galacean/effects';
import { AnimationGraphAsset, Animator, GraphInstance, InvalidIndex, SerializationHelper, VFXItem } from '@galacean/effects';
import { editorWindow, menuItem } from '../../core/decorators';
import { Selection } from '../../core/selection';
import { GalaceanEffects } from '../../ge';
import { ImGui } from '../../imgui';
import { EditorWindow } from '../editor-window';
import { GraphView } from './visual-graph/node-graph-view';
import type { StateMachineGraph } from './tools-graph/graphs/state-machine-graph';
import { StateToolsNode } from './tools-graph/nodes/state-tools-node';
import { ToolsGraphUserContext } from './tools-graph/tools-graph-user-context';
import { TransitionConduitToolsNode, TransitionToolsNode } from './tools-graph/nodes/transition-tools-node';
import type { BaseGraph } from './visual-graph/base-graph';
import type { BaseNode } from './visual-graph/base-graph';
import { StateMachineToolsNode } from './tools-graph/nodes/state-machine-tools-node';
import { SelectedNode } from './visual-graph/user-context';
import { Colors } from './tools-graph/colors';
import * as NodeGraph from './visual-graph';
import { AnimationClipToolsNode } from './tools-graph/nodes/animation-clip-tools-node';
import { FlowGraph } from './tools-graph/graphs/flow-graph';
import { PoseResultToolsNode, ResultToolsNode } from './tools-graph/nodes/result-tools-node';
import { GraphCompilationContext } from './compilation';
import { ConstBoolToolsNode } from './tools-graph/nodes/const-value-tools-nodes';
import { ControlParameterToolsNode } from './tools-graph/nodes/parameter-tools-nodes';
import { BoolControlParameterToolsNode, BoolParameterReferenceToolsNode, FloatControlParameterToolsNode } from './tools-graph/nodes/parameter-tools-nodes';

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

  private m_primaryGraphViewProportionalHeight = 0.6;
  private primaryGraphView: GraphView;
  private secondaryGraphView: GraphView;
  private loadedGraphStack: LoadedGraphData[] = [];
  private selectedNodes: SelectedNode[] = [];
  private m_pFocusedGraphView: GraphView;
  private breadcrumbPopupContext: NodeGraph.BaseNode | null = null;

  private selectedNode: SelectedNode | null;

  @menuItem('Window/AnimationGraph')
  static showWindow () {
    EditorWindow.getWindow(AnimationGraph).open();
  }

  constructor () {
    super();
    this.title = 'AnimationGraph';
    this.open();
    this.setWindowFlags(ImGui.WindowFlags.NoScrollWithMouse | ImGui.WindowFlags.NoScrollbar);
    this.primaryGraphView = new GraphView(this.userContext);
    this.secondaryGraphView = new GraphView(this.userContext);

    const graphDefinition = new GraphDefinition();

    graphDefinition.m_rootGraph = this.flowGraph;

    this.loadedGraphStack.push({
      m_pGraphDefinition: graphDefinition,
      m_pParentNode: null,
    });

    const rootResultNode = this.flowGraph.CreateNode(PoseResultToolsNode, new ImVec2(500, 200));
    const stateMachineNode = this.flowGraph.CreateNode(StateMachineToolsNode, new ImVec2(300, 200));

    this.stateMachineGraph = stateMachineNode.GetChildGraph() as StateMachineGraph;
    this.flowGraph.TryMakeConnection(stateMachineNode, stateMachineNode.GetOutputPin(0)!, rootResultNode, rootResultNode.GetInputPin(0)!);

    const stateNode1 = this.stateMachineGraph.CreateNode(StateToolsNode, new ImVec2(400, 300));
    const stateNode2 = this.stateMachineGraph.CreateNode(StateToolsNode, new ImVec2(600, 100));
    const stateNode3 = this.stateMachineGraph.CreateNode(StateToolsNode, new ImVec2(800, 300));

    this.stateMachineGraph.SetDefaultEntryState(stateNode1.GetID());
    const buildStateGraph = (stateNode: StateToolsNode, animationID: string) => {
      const animationClipNode1 = stateNode.GetChildGraph()!.CreateNode(AnimationClipToolsNode);
      const state1ResultNode = stateNode.GetChildGraph()!.FindAllNodesOfType(PoseResultToolsNode)[0];

      animationClipNode1.m_defaultResourceID = animationID;

      (stateNode.GetChildGraph()! as FlowGraph).TryMakeConnection(animationClipNode1, animationClipNode1.GetOutputPin(0)!, state1ResultNode, state1ResultNode.GetInputPin(0)!);
    };

    buildStateGraph(stateNode1, '4dbf7d18673747e0afc0328f0149f3ee');
    buildStateGraph(stateNode2, '4dbf7d18673747e0afc0328f0149f3ee');
    buildStateGraph(stateNode3, '4dbf7d18673747e0afc0328f0149f3ee');

    // stateNode1.GetChildGraph()?.CreateNode(StateMachineToolsNode);
    stateNode1.Rename('State1');
    stateNode2.Rename('State2');
    stateNode3.Rename('State3');

    const transition1 = this.stateMachineGraph.CreateNode(TransitionConduitToolsNode, stateNode1, stateNode2);
    const transition2 = this.stateMachineGraph.CreateNode(TransitionConduitToolsNode, stateNode2, stateNode3);
    const transition3 = this.stateMachineGraph.CreateNode(TransitionConduitToolsNode, stateNode3, stateNode1);

    const transitionToolsNode1 = transition1.GetSecondaryGraph()!.CreateNode(TransitionToolsNode);
    const transitionToolsNode2 = transition2.GetSecondaryGraph()!.CreateNode(TransitionToolsNode);
    const transitionToolsNode3 = transition3.GetSecondaryGraph()!.CreateNode(TransitionToolsNode);

    const boolControlParameterToolsNode = this.flowGraph.CreateNode(BoolControlParameterToolsNode);
    const conditionNode1 = transition1.GetSecondaryGraph()!.CreateNode(BoolParameterReferenceToolsNode, boolControlParameterToolsNode);
    const conditionNode2 = transition2.GetSecondaryGraph()!.CreateNode(ConstBoolToolsNode);
    const conditionNode3 = transition3.GetSecondaryGraph()!.CreateNode(ConstBoolToolsNode);

    boolControlParameterToolsNode.Rename('TestParam');
    //@ts-expect-error
    boolControlParameterToolsNode.m_value = false;
    //@ts-expect-error
    conditionNode2.m_value = false;
    //@ts-expect-error
    conditionNode3.m_value = false;

    transitionToolsNode1.m_duration = 2;
    transitionToolsNode2.m_duration = 2;
    transitionToolsNode3.m_duration = 3;

    (transition1.GetSecondaryGraph() as FlowGraph).TryMakeConnection(conditionNode1, conditionNode1.GetOutputPin(0)!, transitionToolsNode1, transitionToolsNode1.GetInputPin(0)!);
    (transition2.GetSecondaryGraph() as FlowGraph).TryMakeConnection(conditionNode2, conditionNode2.GetOutputPin(0)!, transitionToolsNode2, transitionToolsNode2.GetInputPin(0)!);
    (transition3.GetSecondaryGraph() as FlowGraph).TryMakeConnection(conditionNode3, conditionNode3.GetOutputPin(0)!, transitionToolsNode3, transitionToolsNode3.GetInputPin(0)!);

    this.primaryGraphView.SetGraphToView(this.flowGraph);
    this.userContext.OnNavigateToGraph(this.NavigateToGraph.bind(this));
  }

  rebuildGraph (item: VFXItem) {
    const animator = item.getComponent(Animator);

    if (!animator) {
      return;
    }

    const animationGraphAsset = new AnimationGraphAsset(item.engine);
    const animationGraphAssetData = this.compileGraph();

    SerializationHelper.deserialize(animationGraphAssetData, animationGraphAsset);
    animator.graph = new GraphInstance(animationGraphAsset, item);

    this.graph = animator.graph;
  }

  protected override onGUI (): void {
    if (Selection.activeObject instanceof VFXItem && Selection.activeObject !== this.currentVFXItem) {
      this.currentVFXItem = Selection.activeObject;
    }

    if (GalaceanEffects.player.getCompositions()[0]?.rootItem) {
      this.currentVFXItem = GalaceanEffects.player.getCompositions()[0].rootItem;
      if (!this.currentVFXItem.getComponent(Animator)) {
        this.currentVFXItem.addComponent(Animator);
      }
    }

    if (!this.currentVFXItem || !this.currentVFXItem.getComponent(Animator)) {
      return;
    }

    if (ImGui.Button('Save') || !this.graph) {
      // this.rebuildGraph(this.currentVFXItem);
    }

    if (!this.graph) {
      return;
    }

    this.userContext.m_pGraphInstance = this.graph;
    this.userContext.m_nodeIDtoIndexMap = this.compilationContext.GetUUIDToRuntimeIndexMap();

    this.DrawGraphView();
    this.UpdateSelectedNode();
  }

  private UpdateSelectedNode () {
    if (this.selectedNodes.length > 0) {
      const currentSelectedNode = this.selectedNodes[this.selectedNodes.length - 1];

      if (this.selectedNode !== currentSelectedNode) {
        Selection.setActiveObject(currentSelectedNode.m_pNode);
        this.selectedNode = currentSelectedNode;
      }
    }
  }

  private GetEditedRootGraph (): NodeGraph.FlowGraph | null {
    return (this.loadedGraphStack[0].m_pGraphDefinition !== null)
      ? this.loadedGraphStack[0].m_pGraphDefinition.GetRootGraph()
      : null;
  }

  DrawGraphView () {
    // Navigation Bar
    //-------------------------------------------------------------------------

    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImVec2(4, 2));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImVec2(1, 1));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImVec2(4, 1));
    if (ImGui.BeginChild('NavBar', new ImVec2(ImGui.GetContentRegionAvail().x, 24), true, ImGui.WindowFlags.AlwaysUseWindowPadding)) {
      this.DrawGraphViewNavigationBar();
    }
    ImGui.EndChild();
    ImGui.PopStyleVar(3);

    // Primary View
    //-------------------------------------------------------------------------

    const availableRegion = ImGui.GetContentRegionAvail();

    this.primaryGraphView.UpdateAndDraw(availableRegion.y * this.m_primaryGraphViewProportionalHeight);

    if (this.primaryGraphView.HasSelectionChangedThisFrame()) {
      this.SetSelectedNodes(this.primaryGraphView.GetSelectedNodes());
    }

    // Splitter
    //-------------------------------------------------------------------------

    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0.0);
    ImGui.Button('##GraphViewSplitter', new ImVec2(-1, 5));
    ImGui.PopStyleVar();

    if (ImGui.IsItemHovered()) {
      ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeNS);
    }

    if (ImGui.IsItemActive()) {
      this.m_primaryGraphViewProportionalHeight += (ImGui.GetIO().MouseDelta.y / availableRegion.y);
      this.m_primaryGraphViewProportionalHeight = Math.max(0.1, this.m_primaryGraphViewProportionalHeight);
    }

    // SecondaryView
    //-------------------------------------------------------------------------

    this.UpdateSecondaryViewState();
    this.secondaryGraphView.UpdateAndDraw();

    if (this.secondaryGraphView.HasSelectionChangedThisFrame()) {
      this.SetSelectedNodes(this.secondaryGraphView.GetSelectedNodes());

      if (this.selectedNodes.length === 0) {
        this.selectedNodes = this.primaryGraphView.GetSelectedNodes();
      }
    }
  }

  private DrawGraphViewNavigationBar (): void {
    const pRootGraph = this.GetEditedRootGraph()!;

    // const sf = new ImGuiX.ScopedFont(ImGuiX.Font.SmallBold);

    // Sizes
    //-------------------------------------------------------------------------
    const pBreadcrumbPopupName = 'Breadcrumb';
    const navBarDimensions = ImGui.GetContentRegionAvail();
    const homeButtonWidth = 60;
    const stateMachineNavButtonWidth = 64;

    const buttonHeight = navBarDimensions.y;
    const statemachineNavRequiredSpace = this.primaryGraphView.IsViewingStateMachineGraph() ?
      (stateMachineNavButtonWidth * 2) : 0;

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

    if (ImGui.Button('GoHome##GoHome', new ImVec2(homeButtonWidth, buttonHeight))) {
      this.NavigateToGraph(pRootGraph);
    }
    // ImGui.ItemTooltip('Go to root');

    ImGui.SameLine(0, 0);
    if (ImGui.Button('RootBrowser##RootBrowser', new ImVec2(0, buttonHeight))) {
      this.breadcrumbPopupContext = null;
      ImGui.OpenPopup(pBreadcrumbPopupName);
    }

    // Draw breadcrumbs
    //-------------------------------------------------------------------------
    let pGraphToNavigateTo: NodeGraph.BaseGraph | null = null;

    // Draw from root to child
    for (let i = pathFromChildToRoot.length - 1; i >= 0; i--) {
      const isLastItem = (i === 0);
      let drawChevron = true;
      let drawItem = true;

      const pParentState = pathFromChildToRoot[i].m_pNode!.GetParentGraph()!.GetParentNode() as StateToolsNode;
      const pState = pathFromChildToRoot[i].m_pNode as StateToolsNode;

      // Hide the item if it is a state machine node whose parent is "state machine state"
      if (pParentState instanceof StateToolsNode && !pParentState.IsBlendTreeState()) {
        drawItem = false;
      }

      // Hide the chevron for state machine states
      const isStateMachineState = pState instanceof StateToolsNode && !pState.IsBlendTreeState();

      if (isStateMachineState) {
        drawChevron = false;
      }

      // Check if the last graph we are in has child state machines
      if (drawChevron && isLastItem) {
        let pChildGraphToCheck: NodeGraph.BaseGraph | null = null;

        // Check external child graph for state machines
        if (pathFromChildToRoot[i].m_pNode instanceof ChildGraphToolsNode) {
          pChildGraphToCheck = this.loadedGraphStack[pathFromChildToRoot[i].m_stackIdx + 1]
            .m_pGraphDefinition!.GetRootGraph();
          // eslint-disable-next-line brace-style
        }
        // We should search child graph
        else if (!(pathFromChildToRoot[i].m_pNode instanceof StateMachineToolsNode)) {
          pChildGraphToCheck = pathFromChildToRoot[i].m_pNode!.GetChildGraph();
        }

        // If we have a graph to check then check for child state machines
        if (pChildGraphToCheck !== null) {
          const childStateMachines = pChildGraphToCheck.FindAllNodesOfType<StateMachineToolsNode>(
            StateMachineToolsNode,
            [],
            NodeGraph.SearchMode.Localized,
            NodeGraph.SearchTypeMatch.Exact
          );

          if (childStateMachines.length === 0) {
            drawChevron = false;
          }
        } else { // Hide chevron
          drawChevron = false;
        }
      }

      // Draw the item
      if (drawItem) {
        const isExternalChildGraphItem = pathFromChildToRoot[i].m_stackIdx > 0;

        // if (isExternalChildGraphItem) {
        //   const color = new ImVec2(
        //     new Vector(0.65, 0.65, 0.65, 1.0).multiply(
        //       new Vector(ImGuiX.Style.s_colorText.ToFloat4())
        //     )
        //   );

        //   ImGui.PushStyleColor(ImGui.Col.Text, color);
        // }

        ImGui.SameLine(0, 0);
        const str = `${pathFromChildToRoot[i].m_pNode!.GetName()}##${pathFromChildToRoot[i].m_pNode!.GetID().toString()}`;

        if (ImGui.Button(str, new ImVec2(0, buttonHeight))) {
          if (isStateMachineState) {
            const childStateMachines = pathFromChildToRoot[i].m_pNode!.GetChildGraph()!
              .FindAllNodesOfType<StateMachineToolsNode>(
              StateMachineToolsNode,
              [],
              NodeGraph.SearchMode.Localized,
              NodeGraph.SearchTypeMatch.Exact
            );

            pGraphToNavigateTo = childStateMachines[0].GetChildGraph();
          } else {
            // Go to the external child graph's root graph
            const pCG = pathFromChildToRoot[i].m_pNode;

            if (pCG instanceof ChildGraphToolsNode) {
              pGraphToNavigateTo = this.loadedGraphStack[pathFromChildToRoot[i].m_stackIdx + 1]
                .m_pGraphDefinition!.GetRootGraph();
            } else { // Go to the node's child graph
              pGraphToNavigateTo = pathFromChildToRoot[i].m_pNode!.GetChildGraph();
            }
          }
        }

        if (isExternalChildGraphItem) {
          ImGui.PopStyleColor();
        }
      }

      // Draw the chevron
      if (drawChevron) {
        ImGui.SameLine(0, 0);
        const separatorStr = `-->##${pathFromChildToRoot[i].m_pNode!.GetName()}${pathFromChildToRoot[i].m_pNode!.GetID().toString()}`;

        if (ImGui.Button(separatorStr, new ImVec2(0, buttonHeight))) {
          if (pGraphToNavigateTo === null) { // Don't open the popup if we have a nav request
            this.breadcrumbPopupContext = pathFromChildToRoot[i].m_pNode;
            ImGui.OpenPopup(pBreadcrumbPopupName);
          }
        }
      }
    }
    ImGui.PopStyleColor();

    // // Draw chevron navigation menu
    // //-------------------------------------------------------------------------
    // if (ImGui.BeginPopup(pBreadcrumbPopupName)) {
    //   let hasItems = false;

    //   // If we navigating in a state machine node, we need to list all states
    //   const pSM = TryCast<GraphNodes.StateMachineToolsNode>(this.breadcrumbPopupContext);

    //   if (pSM) {
    //     const childStates = pSM.GetChildGraph().FindAllNodesOfType<GraphNodes.StateToolsNode>(
    //       NodeGraph.SearchMode.Localized,
    //       NodeGraph.SearchTypeMatch.Derived
    //     );

    //     for (const pChildState of childStates) {
    //       // Ignore Off States
    //       if (pChildState.IsOffState()) {
    //         continue;
    //       }

    //       // Regular States
    //       if (pChildState.IsBlendTreeState()) {
    //         const label = `${EE_ICON_FILE_TREE} ${pChildState.GetName()}`;

    //         if (ImGui.MenuItem(label)) {
    //           pGraphToNavigateTo = pChildState.GetChildGraph();
    //           ImGui.CloseCurrentPopup();
    //         }
    //       } else {
    //         const label = `${EE_ICON_STATE_MACHINE} ${pChildState.GetName()}`;

    //         if (ImGui.MenuItem(label)) {
    //           const childStateMachines = pChildState.GetChildGraph()
    //             .FindAllNodesOfType<GraphNodes.StateMachineToolsNode>(
    //             NodeGraph.SearchMode.Localized,
    //             NodeGraph.SearchTypeMatch.Exact
    //           );

    //           EE_ASSERT(childStateMachines.length);
    //           pGraphToNavigateTo = childStateMachines[0].GetChildGraph();
    //           ImGui.CloseCurrentPopup();
    //         }
    //       }

    //       hasItems = true;
    //     }
    //   } else { // Just display all state machine nodes in this graph
    //     let pGraphToSearch: NodeGraph.BaseGraph | null = null;

    //     if (this.breadcrumbPopupContext === null) {
    //       pGraphToSearch = pRootGraph;
    //     } else {
    //       const pCG = TryCast<GraphNodes.ChildGraphToolsNode>(this.breadcrumbPopupContext);

    //       if (pCG) {
    //         const nodeStackIdx = this.GetStackIndexForNode(pCG);
    //         const childGraphStackIdx = nodeStackIdx + 1;

    //         EE_ASSERT(childGraphStackIdx < this.loadedGraphStack.length);
    //         pGraphToSearch = this.loadedGraphStack[childGraphStackIdx].m_pGraphDefinition!.GetRootGraph();
    //       } else {
    //         pGraphToSearch = this.breadcrumbPopupContext.GetChildGraph();
    //       }
    //     }

    //     EE_ASSERT(pGraphToSearch !== null);

    //     const childSMs = pGraphToSearch.FindAllNodesOfType<GraphNodes.StateMachineToolsNode>(
    //       NodeGraph.SearchMode.Localized,
    //       NodeGraph.SearchTypeMatch.Derived
    //     );

    //     for (const pChildSM of childSMs) {
    //       if (ImGui.MenuItem(pChildSM.GetName())) {
    //         pGraphToNavigateTo = pChildSM.GetChildGraph();
    //         ImGui.CloseCurrentPopup();
    //       }

    //       hasItems = true;
    //     }
    //   }

    //   //-------------------------------------------------------------------------

    //   if (!hasItems) {
    //     ImGui.CloseCurrentPopup();
    //   }

    //   ImGui.EndPopup();
    // }

    // if (!ImGui.IsPopupOpen(pBreadcrumbPopupName)) {
    //   this.breadcrumbPopupContext = null;
    // }

    // Handle navigation request
    //-------------------------------------------------------------------------
    if (pGraphToNavigateTo !== null) {
      this.NavigateToGraph(pGraphToNavigateTo);
    }

    // // Draw state machine navigation options
    // //-------------------------------------------------------------------------
    // if (this.primaryGraphView.IsViewingStateMachineGraph()) {
    //   ImGui.SameLine(navBarDimensions.x - statemachineNavRequiredSpace, 0);
    //   ImGui.AlignTextToFramePadding();
    //   if (ImGuiX.ButtonColored(`${EE_ICON_DOOR_OPEN} Entry`, Colors.Green, Colors.White,
    //     new ImVec2(stateMachineNavButtonWidth, buttonHeight))) {
    //     const pSM = Cast<StateMachineGraph>(this.primaryGraphView.GetViewedGraph());

    //     this.NavigateTo(pSM.GetEntryStateOverrideConduit(), false);
    //   }
    //   ImGuiX.ItemTooltip('Entry State Overrides');

    //   ImGui.SameLine(0, -1);
    //   if (ImGuiX.ButtonColored(`${EE_ICON_LIGHTNING_BOLT}Global`, Colors.OrangeRed, Colors.White,
    //     new ImVec2(stateMachineNavButtonWidth, buttonHeight))) {
    //     const pSM = Cast<StateMachineGraph>(this.primaryGraphView.GetViewedGraph());

    //     this.NavigateTo(pSM.GetGlobalTransitionConduit(), false);
    //   }
    //   ImGuiX.ItemTooltip('Global Transitions');
    // }
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
    // console.log(graphAsset);

    return graphAsset;
  }

  NavigateToNode (pNode: BaseNode, focusViewOnNode: boolean): void {
    // Navigate to the appropriate graph
    const pParentGraph = pNode.GetParentGraph()!;

    this.NavigateToGraph(pParentGraph);

    // Select node
    if (this.primaryGraphView.GetViewedGraph()!.FindNode(pNode.GetID())) {
      this.primaryGraphView.SelectNode(pNode);
      this.SetSelectedNodes([new SelectedNode(pNode)]);
      if (focusViewOnNode) {
        this.primaryGraphView.CenterView(pNode);
      }
    } else if (this.secondaryGraphView.GetViewedGraph() !== null &&
      this.secondaryGraphView.GetViewedGraph()!.FindNode(pNode.GetID())) {
      this.secondaryGraphView.SelectNode(pNode);
      this.SetSelectedNodes([new SelectedNode(pNode)]);
      if (focusViewOnNode) {
        this.secondaryGraphView.CenterView(pNode);
      }
    }
  }

  NavigateToGraph (pGraph: BaseGraph, focusViewOnNode?: boolean): void {
    this.ClearSelection();

    // If the graph we wish to navigate to is a secondary graph, we need to set the primary view and selection accordingly
    const pParentNode = pGraph.GetParentNode();

    if (pParentNode !== null && pParentNode.GetSecondaryGraph() === pGraph) {
      this.NavigateToGraph(pParentNode.GetParentGraph()!);
      this.primaryGraphView.SelectNode(pParentNode);
      this.UpdateSecondaryViewState();
    } else { // Directly update the primary view
      if (this.primaryGraphView.GetViewedGraph() !== pGraph) {
        const stackIdx = this.GetStackIndexForGraph(pGraph);

        while (stackIdx < (this.loadedGraphStack.length - 1)) {
          this.PopGraphStack();
        }

        this.primaryGraphView.SetGraphToView(pGraph);
        this.UpdateSecondaryViewState();
      }
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

  private UpdateSecondaryViewState (): void {
    let pSecondaryGraphToView: BaseGraph | null = null;

    if (this.primaryGraphView.HasSelectedNodes()) {
      if (this.primaryGraphView.GetSelectedNodes().length === 1) {
        const pSelectedNode = this.primaryGraphView.GetSelectedNodes()[this.primaryGraphView.GetSelectedNodes().length - 1].m_pNode;

        if (pSelectedNode!.HasSecondaryGraph()) {
          const pSecondaryGraph = pSelectedNode!.GetSecondaryGraph() as NodeGraph.FlowGraph;

          if (pSecondaryGraph) {
            pSecondaryGraphToView = pSecondaryGraph;
          }
        } else {
          // const pParameterReference = (pSelectedNode) as ParameterReferenceToolsNode;

          // if (pParameterReference) {
          //   const pVP = pParameterReference.GetReferencedVirtualParameter();

          //   if (pVP) {
          //     pSecondaryGraphToView = pVP.GetChildGraph();
          //   }
          // }
        }
      }
    }

    if (this.secondaryGraphView.GetViewedGraph() !== pSecondaryGraphToView) {
      this.secondaryGraphView.SetGraphToView(pSecondaryGraphToView);
    }
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