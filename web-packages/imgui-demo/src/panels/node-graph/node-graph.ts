import type { AnimationGraphAssetData, GraphNodeAssetData, spec } from '@galacean/effects';
import { AnimationGraphAsset, AnimationGraphComponent, GraphInstance, NodeAssetType, VFXItem } from '@galacean/effects';
import { editorWindow, menuItem } from '../../core/decorators';
import { Selection } from '../../core/selection';
import { ImGui } from '../../imgui';
import { EditorWindow } from '../editor-window';
import type { AnimationGraphNode } from './animation-graph-nodes.ts/animation-graph-node';
import { AnimationClipGraphNode, AnimationRootGraphNode, Blend1DGraphNode, ConstFloatGraphNode } from './animation-graph-nodes.ts/animation-graph-node';
import type { BaseNode, BaseNodeData } from './base-node';
import { ImNodeFlow } from './node-flow';

type ImVec2 = ImGui.ImVec2;
type ImColor = ImGui.ImColor;
const ImVec2 = ImGui.ImVec2;
const ImColor = ImGui.ImColor;

@editorWindow()
export class NodeGraph extends EditorWindow {
  currentAnimationComponent: AnimationGraphComponent;
  currentVFXItem: VFXItem;
  imNodeFlow = new ImNodeFlow();
  graph: GraphInstance;

  compilationContext = new GraphCompilationContext();

  @menuItem('Window/NodeGraph')
  static showWindow () {
    EditorWindow.getWindow(NodeGraph).open();
  }

  constructor () {
    super();
    this.title = 'NodeGraph';
    this.open();
    this.setWindowFlags(ImGui.WindowFlags.NoScrollWithMouse | ImGui.WindowFlags.NoScrollbar);
    this.imNodeFlow.rightClickPopUpContent(()=>{});

    this.fromData(data);
  }

  rebuildGraph (item: VFXItem) {
    const animationGraphAsset = new AnimationGraphAsset(item.engine);
    const animationGraphAssetData = this.compileGraph();

    animationGraphAsset.fromData(animationGraphAssetData);
    this.graph = new GraphInstance(animationGraphAsset, item);

    const runtimeNodes = this.graph.nodes;

    for (const node of this.imNodeFlow.getNodes()) {
      const runtimeNodeIndex = this.compilationContext.uuidToRuntimeIndex.get(node[1].getUID());

      (node[1] as AnimationGraphNode).node = runtimeNodes[runtimeNodeIndex!];
    }
  }

  protected override onGUI (): void {
    if (Selection.activeObject instanceof VFXItem && Selection.activeObject !== this.currentVFXItem) {
      this.currentVFXItem = Selection.activeObject;
    }

    if (!this.currentVFXItem) {
      return;
    }

    if (ImGui.Button('Save') || !this.graph) {
      this.rebuildGraph(this.currentVFXItem);
    }

    this.currentAnimationComponent = this.currentVFXItem.getComponent(AnimationGraphComponent);
    const animationGraphComponent = this.currentAnimationComponent;

    if (!animationGraphComponent) {
      return;
    }
    animationGraphComponent.graph = this.graph;
    this.imNodeFlow.update();
  }

  toData (): ImNodeFlowData {
    const data: ImNodeFlowData = {
      nodes: [],
      links: [],
    };

    for (const baseNode of this.imNodeFlow.getNodes()) {
      const nodeData = {
        id: baseNode[1].getUID(),
        type:baseNode[1].getClassName(),
        position: baseNode[1].getPos(),
      };

      baseNode[1].toData(nodeData);
      data.nodes.push(nodeData);
    }

    for (const link of this.imNodeFlow.getLinks()) {
      data.links.push({
        sourceNode: link.getLeft().getParent()!.getUID(),
        sourcePin: link.getLeft().getUID(),
        targetNode: link.getRight().getParent()!.getUID(),
        targetPin: link.getRight().getUID(),
      });
    }

    return data;
  }

  fromData (data: ImNodeFlowData) {
    this.imNodeFlow.getNodes().clear();
    const nodes = [];

    for (const nodeData of data.nodes) {
      const node = this.imNodeFlow.addNode(this.getNodeClass(nodeData.type), new ImVec2(nodeData.position.x, nodeData.position.y));

      nodes.push(node);
    }

    for (let i = 0 ;i < nodes.length; i++) {
      nodes[i].fromData(data.nodes[i]);
    }

    for (const linkData of data.links) {
      const sourceNode = this.imNodeFlow.getNodes().get(linkData.sourceNode);
      const targetNode = this.imNodeFlow.getNodes().get(linkData.targetNode);

      if (sourceNode && targetNode) {

        sourceNode.outPin(linkData.sourcePin)!.createLink(targetNode.inPin(linkData.targetPin)!);
      }
    }
  }

  compileGraph (): AnimationGraphAssetData {
    const nodes = [];

    const nodeLookupMap = this.imNodeFlow.getNodes();

    for (const node of nodeLookupMap) {
      nodes.push(node[1]);
    }

    const context = this.compilationContext;

    context.reset();

    for (let i = 0;i < nodes.length;i++) {
      (nodes[i] as AnimationGraphNode).compile(context);
    }

    const resources = [];

    for (const nodeID of context.registeredDataSlots) {
      const animationClipNode = nodeLookupMap.get(nodeID);

      if (!(animationClipNode instanceof AnimationClipGraphNode)) {
        throw new Error('registeredDataSlots has non-AnimationClipGraphNode');
      }
      resources.push({ id:animationClipNode.resourceID });
    }

    const graphAsset: AnimationGraphAssetData = {
      nodeAssetDatas: context.nodeAssetDatas,
      graphDataSet: {
        resources,
      },
      id: '',
      dataType: 'AnimationGraphAsset' as spec.DataType,
    };

    return graphAsset;
  }

  getNodeClass (type: string): any {
    switch (type) {
      case 'AnimationRootGraphNode':
        return AnimationRootGraphNode;
      case 'Blend1DGraphNode':
        return Blend1DGraphNode;
      case 'ConstFloatGraphNode':
        return ConstFloatGraphNode;
      case 'AnimationClipGraphNode':
        return AnimationClipGraphNode;
    }
  }
}

export enum NodeCompilationState {
  NeedCompilation,
  AlreadyCompiled,
}

export class GraphCompilationContext {
  uuidToRuntimeIndex = new Map<number, number>();
  nodeAssetDatas: GraphNodeAssetData[] = [];
  registeredDataSlots: number[] = [];

  private compilationStates: NodeCompilationState[] = [];

  getNodeAssetData (node: BaseNode): GraphNodeAssetData {
    const cachedIndex = this.uuidToRuntimeIndex.get(node.getUID());

    if (cachedIndex !== undefined) {
      this.compilationStates[cachedIndex] = NodeCompilationState.AlreadyCompiled;

      return this.nodeAssetDatas[cachedIndex];
    }

    const type = this.getNodeAssetType(node) ?? '';
    const nodeAssetData: GraphNodeAssetData = {
      type,
      index: this.nodeAssetDatas.length,
    };

    this.nodeAssetDatas.push(nodeAssetData);
    this.compilationStates.push(NodeCompilationState.NeedCompilation);
    this.uuidToRuntimeIndex.set(node.getUID(), nodeAssetData.index);

    return nodeAssetData;
  }

  registerDataSlotNode (uid: number): number {
    this.registeredDataSlots.push(uid);

    return this.registeredDataSlots.length - 1;
  }

  checkNodeCompilationState (data: GraphNodeAssetData): boolean {
    return this.compilationStates[data.index] === NodeCompilationState.AlreadyCompiled;
  }

  reset () {
    this.uuidToRuntimeIndex.clear();
    this.nodeAssetDatas = [];
    this.compilationStates = [];
    this.registeredDataSlots = [];
  }

  private getNodeAssetType (node: BaseNode) {
    if (node instanceof AnimationClipGraphNode) {
      return NodeAssetType.AnimationClipNodeAsset;
    } else if (node instanceof AnimationRootGraphNode) {
      return NodeAssetType.AnimationRootNodeAsset;
    } else if (node instanceof Blend1DGraphNode) {
      return NodeAssetType.Blend1DNodeAsset;
    } else if (node instanceof ConstFloatGraphNode) {
      return NodeAssetType.ConstFloatNodeAsset;
    }
  }
}

interface linkData {
  sourceNode: number,
  sourcePin: number,
  targetNode: number,
  targetPin: number,
}

interface ImNodeFlowData {
  nodes: BaseNodeData[],
  links: linkData[],
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
      'resourceID':'25ea2eda5e0e41a1a59a45294bcb5b2d',
    },
    {
      'id': 5,
      'type': 'AnimationClipGraphNode',
      'position': {
        'x': -208,
        'y': 300,
      },
      'poseOut': 8,
      'resourceID':'83864e16075b490b8b487e58844d1191',
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