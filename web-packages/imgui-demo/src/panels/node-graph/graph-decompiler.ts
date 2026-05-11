import type { spec } from '@galacean/effects';
import { InvalidIndex } from '@galacean/effects';
import { ImGui } from '../../imgui';
import { FlowGraph } from './tools-graph/graphs/flow-graph';
import type { StateMachineGraph } from './tools-graph/graphs/state-machine-graph';
import { AnimationClipToolsNode } from './tools-graph/nodes/animation-clip-tools-node';
import { ApplyAdditiveToolsNode } from './tools-graph/nodes/apply-additive-tools-node';
import { BlendToolsNode } from './tools-graph/nodes/blend-tools-node';
import { AndToolsNode, OrToolsNode, NotToolsNode } from './tools-graph/nodes/bool-tools-nodes';
import { LayerBlendToolsNode } from './tools-graph/nodes/layer-blend-tools-node';
import { ConstBoolToolsNode, ConstFloatToolsNode } from './tools-graph/nodes/const-value-tools-nodes';
import type { FlowToolsNode } from './tools-graph/nodes/flow-tools-node';
import { GraphType } from './tools-graph/nodes/flow-tools-node';
import { EqualToolsNode, GreaterToolsNode, LessToolsNode } from './tools-graph/nodes/operator-tools-nodes';
import {
  BoolControlParameterToolsNode,
  BoolParameterReferenceToolsNode,
  FloatControlParameterToolsNode,
  FloatParameterReferenceToolsNode,
  type ControlParameterToolsNode,
} from './tools-graph/nodes/parameter-tools-nodes';
import { PoseResultToolsNode } from './tools-graph/nodes/result-tools-node';
import { StateMachineToolsNode } from './tools-graph/nodes/state-machine-tools-node';
import { StateToolsNode } from './tools-graph/nodes/state-tools-node';
import { TransitionConduitToolsNode, TransitionToolsNode } from './tools-graph/nodes/transition-tools-node';
import type * as NodeGraph from './visual-graph';

const ImVec2 = ImGui.ImVec2;

// Layout constants
const H_GAP = 300; // horizontal spacing between node columns
const V_GAP = 50;  // vertical gap between sibling subtrees
const LEAF_H = 60; // estimated height of a leaf node

type LayoutResult = { node: FlowToolsNode, height: number };

export interface DecompileResult {
  graph: FlowGraph,
  /** 工具节点 UUID → 运行时 nodeDatas 索引 */
  nodeIDToIndexMap: Map<string, number>,
}

/**
 * 将编译后的 AnimationGraphAssetData（扁平节点数组 + 索引引用）
 * 反编译为层次化的工具图（FlowGraph + StateMachineGraph）
 */
export class GraphDecompiler {
  private nodeDatas: spec.GraphNodeData[];
  private controlParameterIDs: string[];
  private rootNodeIndex: number;
  private resources: spec.GraphDataSetData['resources'];

  // 索引 → 控制参数工具节点映射
  private controlParameterNodes = new Map<number, ControlParameterToolsNode>();

  // UUID → 运行时索引映射（用于调试可视化）
  private nodeIDToIndexMap = new Map<string, number>();

  decompile (assetData: spec.AnimationGraphAssetData): DecompileResult {
    this.nodeDatas = assetData.nodeDatas;
    this.controlParameterIDs = assetData.controlParameterIDs;
    this.rootNodeIndex = assetData.rootNodeIndex;
    this.resources = assetData.graphDataSet.resources;
    this.nodeIDToIndexMap.clear();

    const rootGraph = new FlowGraph();

    // 1. 创建控制参数节点
    this.buildControlParameters(rootGraph);

    // 2. 创建 PoseResult 节点（纯视觉节点，不需要映射）
    const resultNode = rootGraph.CreateNode(PoseResultToolsNode, new ImVec2(800, 200));

    // 3. 从 rootNodeIndex 开始构建图
    if (this.rootNodeIndex !== InvalidIndex && this.rootNodeIndex < this.nodeDatas.length) {
      const rootResult = this.buildNode(this.rootNodeIndex, rootGraph, new ImVec2(400, 100));

      if (rootResult) {
        rootGraph.TryMakeConnection(
          rootResult.node, rootResult.node.GetOutputPin(0)!,
          resultNode, resultNode.GetInputPin(0)!
        );
      }
    }

    return { graph: rootGraph, nodeIDToIndexMap: this.nodeIDToIndexMap };
  }

  /** 注册工具节点 UUID 与运行时索引的映射 */
  private registerMapping (toolsNode: NodeGraph.BaseNode, runtimeIndex: number): void {
    this.nodeIDToIndexMap.set(toolsNode.GetID(), runtimeIndex);
  }

  private buildControlParameters (rootGraph: FlowGraph): void {
    const numParams = this.controlParameterIDs.length;

    for (let i = 0; i < numParams; i++) {
      const nodeData = this.nodeDatas[i];
      const paramName = this.controlParameterIDs[i];
      const yPos = 50 + i * 100;

      if (!nodeData) {
        continue;
      }

      let paramNode: ControlParameterToolsNode | undefined;

      switch (nodeData.type) {
        case 'ControlParameterBoolNodeData': {
          const boolParam = rootGraph.CreateNode(BoolControlParameterToolsNode);

          boolParam.Rename(paramName);
          paramNode = boolParam;

          break;
        }
        case 'ControlParameterFloatNodeData': {
          const floatParam = rootGraph.CreateNode(FloatControlParameterToolsNode);

          floatParam.Rename(paramName);
          paramNode = floatParam;

          break;
        }
        case 'ControlParameterTriggerNodeData': {
          const triggerParam = rootGraph.CreateNode(BoolControlParameterToolsNode);

          triggerParam.Rename(paramName);
          paramNode = triggerParam;

          break;
        }
      }

      if (paramNode) {
        paramNode.SetPosition(new ImVec2(-400, yPos));
        this.controlParameterNodes.set(i, paramNode);
        this.registerMapping(paramNode, i);
      }
    }
  }

  /**
   * 根据编译数据索引在目标图中创建对应的工具节点
   * basePos: 子树根节点（输出端）的位置，输入端在其左侧
   */
  private buildNode (nodeIndex: number, targetGraph: FlowGraph, basePos = new ImVec2(0, 0)): LayoutResult | null {
    if (nodeIndex === InvalidIndex || nodeIndex >= this.nodeDatas.length) {
      return null;
    }

    const nodeData = this.nodeDatas[nodeIndex];

    if (!nodeData) {
      return null;
    }

    // 如果是控制参数引用，创建参数引用节点
    if (this.controlParameterNodes.has(nodeIndex)) {
      return this.buildParameterReference(nodeIndex, targetGraph, basePos);
    }

    switch (nodeData.type) {
      case 'StateMachineNodeData':
        return this.buildStateMachine(nodeIndex, nodeData as spec.StateMachineNodeData, targetGraph, basePos);
      case 'AnimationClipNodeData': {
        const node = this.buildAnimationClip(nodeIndex, nodeData as spec.AnimationClipNodeData, targetGraph);

        node.SetPosition(basePos);

        return { node, height: LEAF_H };
      }
      case 'BlendNodeData':
        return this.buildBlendNode(nodeIndex, nodeData as spec.BlendNodeData, targetGraph, basePos);
      case 'LayerBlendNodeData':
        return this.buildLayerBlendNode(nodeIndex, nodeData as spec.LayerBlendNodeData, targetGraph, basePos);
      case 'ConstBoolNodeData': {
        const node = this.buildConstBool(nodeIndex, nodeData as spec.ConstBoolNodeData, targetGraph);

        node.SetPosition(basePos);

        return { node, height: LEAF_H };
      }
      case 'ConstFloatNodeData': {
        const node = this.buildConstFloat(nodeIndex, nodeData as spec.ConstFloatNodeData, targetGraph);

        node.SetPosition(basePos);

        return { node, height: LEAF_H };
      }
      case 'AndNodeData':
        return this.buildAndNode(nodeIndex, nodeData as spec.AndNodeData, targetGraph, basePos);
      case 'OrNodeData':
        return this.buildOrNode(nodeIndex, nodeData as spec.OrNodeData, targetGraph, basePos);
      case 'NotNodeData':
        return this.buildNotNode(nodeIndex, nodeData as spec.NotNodeData, targetGraph, basePos);
      case 'EqualNodeData':
        return this.buildEqualNode(nodeIndex, nodeData as spec.EqualNodeData, targetGraph, basePos);
      case 'GreaterNodeData':
        return this.buildComparisonNode(nodeIndex, nodeData as spec.GreaterNodeData, targetGraph, basePos, 'greater');
      case 'LessNodeData':
        return this.buildComparisonNode(nodeIndex, nodeData as spec.LessNodeData, targetGraph, basePos, 'less');
      case 'ApplyAdditiveNodeData':
        return this.buildApplyAdditiveNode(nodeIndex, nodeData as spec.ApplyAdditiveNodeData, targetGraph, basePos);
      case 'StateNodeData': {
        // StateNodeData 不应该作为独立节点被引用
        console.warn(`[GraphDecompiler] Encountered StateNodeData at index ${nodeIndex}. StateNode is a wrapper and should not be directly referenced.`, nodeData);

        // StateNode 是包装器，透传到其 childNodeIndex 构建实际的 Pose 节点
        const stateData = nodeData as spec.StateNodeData;

        if (stateData.childNodeIndex !== undefined && stateData.childNodeIndex !== InvalidIndex) {
          return this.buildNode(stateData.childNodeIndex, targetGraph, basePos);
        }

        return null;
      }
      case 'TransitionNodeData':
        // TransitionNode 不应该作为独立节点被引用，跳过
        return null;
      case 'ControlParameterBoolNodeData':
      case 'ControlParameterFloatNodeData':
      case 'ControlParameterTriggerNodeData':
        return this.buildParameterReference(nodeIndex, targetGraph, basePos);
      default:
        console.warn(`[GraphDecompiler] Unhandled node type: "${nodeData.type}" at index ${nodeIndex}`, nodeData);

        return null;
    }
  }

  /**
   * 构建子节点并连接到父节点的指定 pin
   * 返回子树高度，失败返回 null
   */
  private buildAndConnect (
    nodeIndex: number | undefined,
    targetGraph: FlowGraph,
    parentNode: FlowToolsNode,
    pinIndex: number,
    inputPos: ImGui.ImVec2,
  ): LayoutResult | null {
    if (nodeIndex === undefined || nodeIndex === InvalidIndex) {
      return null;
    }

    const result = this.buildNode(nodeIndex, targetGraph, inputPos);

    if (!result) {
      return null;
    }

    targetGraph.TryMakeConnection(
      result.node, result.node.GetOutputPin(0)!,
      parentNode, parentNode.GetInputPin(pinIndex)!
    );

    return result;
  }

  private buildParameterReference (nodeIndex: number, targetGraph: FlowGraph, basePos: ImGui.ImVec2): LayoutResult | null {
    const paramNode = this.controlParameterNodes.get(nodeIndex);

    if (!paramNode) {
      return null;
    }

    if (paramNode instanceof BoolControlParameterToolsNode) {
      const refNode = targetGraph.CreateNode(BoolParameterReferenceToolsNode, paramNode);

      this.registerMapping(refNode, nodeIndex);
      refNode.SetPosition(basePos);

      return { node: refNode, height: LEAF_H };
    } else if (paramNode instanceof FloatControlParameterToolsNode) {
      const refNode = targetGraph.CreateNode(FloatParameterReferenceToolsNode, paramNode);

      this.registerMapping(refNode, nodeIndex);
      refNode.SetPosition(basePos);

      return { node: refNode, height: LEAF_H };
    }

    return null;
  }

  private buildStateMachine (nodeIndex: number, data: spec.StateMachineNodeData, targetGraph: FlowGraph, basePos: ImGui.ImVec2): LayoutResult {
    const smNode = targetGraph.CreateNode(StateMachineToolsNode);

    smNode.SetPosition(basePos);
    this.registerMapping(smNode, nodeIndex);

    if (data.machineName) {
      smNode.Rename(data.machineName);
    }

    const smGraph = smNode.GetChildGraph() as StateMachineGraph;

    // 清除默认创建的状态
    const existingStates = smGraph.FindAllNodesOfType(StateToolsNode);

    for (const state of existingStates) {
      smGraph.DestroyNode(state.GetID());
    }

    // 创建所有状态
    const stateToolsNodes: StateToolsNode[] = [];
    const numStates = data.stateDatas.length;

    const radius = Math.max(200, numStates * 80);

    for (let i = 0; i < numStates; i++) {
      const stateData = data.stateDatas[i];
      const stateNodeData = this.nodeDatas[stateData.stateNodeIndex] as spec.StateNodeData | undefined;

      // 圆形布局
      const angle = (2 * Math.PI * i) / numStates - Math.PI / 2;
      const x = 400 + Math.cos(angle) * radius;
      const y = 350 + Math.sin(angle) * radius;

      const stateNode = smGraph.CreateNode(StateToolsNode, new ImVec2(x, y));

      // 注册 StateToolsNode → stateNodeIndex 映射
      this.registerMapping(stateNode, stateData.stateNodeIndex);

      if (stateNodeData?.stateName) {
        stateNode.Rename(stateNodeData.stateName);
      } else {
        stateNode.Rename(`State ${i}`);
      }

      // 构建状态的混合树
      if (stateNodeData && stateNodeData.childNodeIndex !== undefined && stateNodeData.childNodeIndex !== InvalidIndex) {
        this.buildStateBlendTree(stateNode, stateNodeData.childNodeIndex);
      }

      stateToolsNodes.push(stateNode);
    }

    // 设置默认入口状态
    if (data.defaultStateIndex !== undefined && data.defaultStateIndex !== InvalidIndex && stateToolsNodes[data.defaultStateIndex]) {
      smGraph.SetDefaultEntryState(stateToolsNodes[data.defaultStateIndex].GetID());
    } else if (stateToolsNodes.length > 0) {
      smGraph.SetDefaultEntryState(stateToolsNodes[0].GetID());
    }

    // 创建过渡
    for (let sourceIdx = 0; sourceIdx < numStates; sourceIdx++) {
      const stateData = data.stateDatas[sourceIdx];

      if (!stateData.transitionDatas || stateData.transitionDatas.length === 0) {
        continue;
      }

      // 按目标状态分组
      const transitionsByTarget = new Map<number, spec.TransitionData[]>();

      for (const transData of stateData.transitionDatas) {
        const targetIdx = transData.targetStateIndex;

        if (!transitionsByTarget.has(targetIdx)) {
          transitionsByTarget.set(targetIdx, []);
        }
        transitionsByTarget.get(targetIdx)!.push(transData);
      }

      for (const [targetIdx, transitions] of transitionsByTarget) {
        if (targetIdx === InvalidIndex || !stateToolsNodes[targetIdx]) {
          continue;
        }

        const sourceState = stateToolsNodes[sourceIdx];
        const targetState = stateToolsNodes[targetIdx];

        // TransitionConduitToolsNode 是纯视觉节点，无运行时索引
        const conduit = smGraph.CreateNode(TransitionConduitToolsNode, sourceState, targetState);
        const conduitGraph = conduit.GetSecondaryGraph() as FlowGraph;

        let transYCursor = 50;

        for (let tIdx = 0; tIdx < transitions.length; tIdx++) {
          const transData = transitions[tIdx];
          const transNodeData = this.nodeDatas[transData.transitionNodeIndex] as spec.TransitionNodeData | undefined;
          const transNode = conduitGraph.CreateNode(TransitionToolsNode, new ImVec2(300, transYCursor));

          // 注册 TransitionToolsNode → transitionNodeIndex 映射
          this.registerMapping(transNode, transData.transitionNodeIndex);

          if (transNodeData) {
            transNode.m_duration = transNodeData.duration ?? 0.2;
            transNode.hasExitTime = transNodeData.hasExitTime ?? false;
            transNode.exitTime = transNodeData.exitTime ?? 0.75;
          }

          // 构建条件节点并连接
          let condHeight = LEAF_H;

          if (transData.conditionNodeIndex !== undefined && transData.conditionNodeIndex !== InvalidIndex) {
            const condResult = this.buildNode(transData.conditionNodeIndex, conduitGraph, new ImVec2(-50, transYCursor));

            if (condResult) {
              conduitGraph.TryMakeConnection(
                condResult.node, condResult.node.GetOutputPin(0)!,
                transNode, transNode.GetInputPin(0)!
              );
              condHeight = condResult.height;
            }
          }

          transYCursor += Math.max(condHeight, LEAF_H) + V_GAP;
        }
      }
    }

    return { node: smNode, height: LEAF_H };
  }

  private buildStateBlendTree (stateNode: StateToolsNode, childNodeIndex: number): void {
    const childGraph = stateNode.GetChildGraph() as FlowGraph;

    if (!childGraph) {
      return;
    }

    const resultNodes = childGraph.FindAllNodesOfType(PoseResultToolsNode);

    if (resultNodes.length === 0) {
      return;
    }

    const resultNode = resultNodes[0];

    resultNode.SetPosition(new ImVec2(600, 200));

    const blendTreeResult = this.buildNode(childNodeIndex, childGraph, new ImVec2(200, 50));

    if (blendTreeResult) {
      childGraph.TryMakeConnection(
        blendTreeResult.node, blendTreeResult.node.GetOutputPin(0)!,
        resultNode, resultNode.GetInputPin(0)!
      );
    }
  }

  private buildAnimationClip (nodeIndex: number, clipData: spec.AnimationClipNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const clipNode = targetGraph.CreateNode(AnimationClipToolsNode);

    this.registerMapping(clipNode, nodeIndex);

    if (clipData.dataSlotIndex !== undefined && clipData.dataSlotIndex >= 0 && clipData.dataSlotIndex < this.resources.length) {
      const resource = this.resources[clipData.dataSlotIndex];

      if (resource && typeof resource === 'object' && 'id' in resource) {
        clipNode.m_defaultResourceID = (resource as { id: string }).id;
      }
    }

    return clipNode;
  }

  private buildBlendNode (nodeIndex: number, blendData: spec.BlendNodeData, targetGraph: FlowGraph, basePos: ImGui.ImVec2): LayoutResult {
    const blendNode = targetGraph.CreateNode(BlendToolsNode);

    this.registerMapping(blendNode, nodeIndex);

    const inputX = basePos.x - H_GAP;
    let cursorY = basePos.y;
    let hasChildren = false;

    // Source0
    const r0 = this.buildAndConnect(blendData.sourceNodeIndex0, targetGraph, blendNode, 0, new ImVec2(inputX, cursorY));

    if (r0) { cursorY += r0.height + V_GAP; hasChildren = true; }

    // Source1
    const r1 = this.buildAndConnect(blendData.sourceNodeIndex1, targetGraph, blendNode, 1, new ImVec2(inputX, cursorY));

    if (r1) { cursorY += r1.height + V_GAP; hasChildren = true; }

    // BlendWeight
    const r2 = this.buildAndConnect(blendData.inputParameterValueNodeIndex, targetGraph, blendNode, 2, new ImVec2(inputX, cursorY));

    if (r2) { cursorY += r2.height + V_GAP; hasChildren = true; }

    const totalHeight = hasChildren ? cursorY - basePos.y - V_GAP : LEAF_H;
    const centerY = basePos.y + totalHeight / 2 - LEAF_H / 2;

    blendNode.SetPosition(new ImVec2(basePos.x, centerY));

    return { node: blendNode, height: totalHeight };
  }

  private buildLayerBlendNode (nodeIndex: number, data: spec.LayerBlendNodeData, targetGraph: FlowGraph, basePos: ImGui.ImVec2): LayoutResult {
    const numLayers = data.layerDatas?.length ?? 0;
    const layerBlendNode = targetGraph.CreateNode(LayerBlendToolsNode, new ImVec2(0, 0), numLayers);

    this.registerMapping(layerBlendNode, nodeIndex);

    const inputX = basePos.x - H_GAP;
    const weightX = basePos.x - H_GAP - 150;
    let cursorY = basePos.y;
    let hasChildren = false;

    // Base input (pin 0)
    const baseResult = this.buildAndConnect(data.baseNodeIndex, targetGraph, layerBlendNode, 0, new ImVec2(inputX, cursorY));

    if (baseResult) { cursorY += baseResult.height + V_GAP; hasChildren = true; }

    // Layer inputs
    if (data.layerDatas) {
      for (let i = 0; i < data.layerDatas.length; i++) {
        const layerData = data.layerDatas[i];

        // Layer pose input (pin 1 + i*2)
        const poseResult = this.buildAndConnect(layerData.inputNodeIndex, targetGraph, layerBlendNode, 1 + i * 2, new ImVec2(inputX, cursorY));

        if (poseResult) { cursorY += poseResult.height + V_GAP; hasChildren = true; }

        // Layer weight input (pin 2 + i*2) — offset further left
        const weightResult = this.buildAndConnect(layerData.weightValueNodeIndex, targetGraph, layerBlendNode, 2 + i * 2, new ImVec2(weightX, cursorY));

        if (weightResult) { cursorY += weightResult.height + V_GAP; hasChildren = true; }
      }
    }

    const totalHeight = hasChildren ? cursorY - basePos.y - V_GAP : LEAF_H;
    const centerY = basePos.y + totalHeight / 2 - LEAF_H / 2;

    layerBlendNode.SetPosition(new ImVec2(basePos.x, centerY));

    return { node: layerBlendNode, height: totalHeight };
  }

  private buildConstBool (nodeIndex: number, data: spec.ConstBoolNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const node = targetGraph.CreateNode(ConstBoolToolsNode);

    this.registerMapping(node, nodeIndex);
    // @ts-expect-error - 访问私有属性设置值
    node.m_value = data.value ?? false;

    return node;
  }

  private buildConstFloat (nodeIndex: number, constData: spec.ConstFloatNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const node = targetGraph.CreateNode(ConstFloatToolsNode);

    this.registerMapping(node, nodeIndex);
    // @ts-expect-error - 访问私有属性设置值
    node.m_value = constData.value ?? 0;

    return node;
  }

  private buildMultiInputNode (
    nodeIndex: number,
    targetGraph: FlowGraph,
    rootNode: FlowToolsNode,
    conditionIndices: number[] | undefined,
    basePos: ImGui.ImVec2,
  ): LayoutResult {
    this.registerMapping(rootNode, nodeIndex);

    const inputX = basePos.x - H_GAP;
    let cursorY = basePos.y;
    let hasChildren = false;

    if (conditionIndices) {
      for (let i = 0; i < conditionIndices.length; i++) {
        const condIdx = conditionIndices[i];

        if (condIdx !== undefined && condIdx !== InvalidIndex) {
          const result = this.buildAndConnect(condIdx, targetGraph, rootNode, i, new ImVec2(inputX, cursorY));

          if (result) { cursorY += result.height + V_GAP; hasChildren = true; }
        }
      }
    }

    const totalHeight = hasChildren ? cursorY - basePos.y - V_GAP : LEAF_H;
    const centerY = basePos.y + totalHeight / 2 - LEAF_H / 2;

    rootNode.SetPosition(new ImVec2(basePos.x, centerY));

    return { node: rootNode, height: totalHeight };
  }

  private buildAndNode (nodeIndex: number, data: spec.AndNodeData, targetGraph: FlowGraph, basePos: ImGui.ImVec2): LayoutResult {
    const numInputs = data.conditionNodeIndices?.length ?? 0;
    const andNode = targetGraph.CreateNode(AndToolsNode, new ImVec2(0, 0), numInputs);

    return this.buildMultiInputNode(nodeIndex, targetGraph, andNode, data.conditionNodeIndices, basePos);
  }

  private buildOrNode (nodeIndex: number, data: spec.OrNodeData, targetGraph: FlowGraph, basePos: ImGui.ImVec2): LayoutResult {
    const numInputs = data.conditionNodeIndices?.length ?? 0;
    const orNode = targetGraph.CreateNode(OrToolsNode, new ImVec2(0, 0), numInputs);

    return this.buildMultiInputNode(nodeIndex, targetGraph, orNode, data.conditionNodeIndices, basePos);
  }

  private buildNotNode (nodeIndex: number, data: spec.NotNodeData, targetGraph: FlowGraph, basePos: ImGui.ImVec2): LayoutResult {
    const notNode = targetGraph.CreateNode(NotToolsNode);

    this.registerMapping(notNode, nodeIndex);

    const inputX = basePos.x - H_GAP;
    let totalHeight = LEAF_H;

    const result = this.buildAndConnect(data.inputValueNodeIndex, targetGraph, notNode, 0, new ImVec2(inputX, basePos.y));

    if (result) { totalHeight = Math.max(LEAF_H, result.height); }

    notNode.SetPosition(new ImVec2(basePos.x, basePos.y + totalHeight / 2 - LEAF_H / 2));

    return { node: notNode, height: totalHeight };
  }

  private buildBinaryNode (
    nodeIndex: number,
    targetGraph: FlowGraph,
    rootNode: FlowToolsNode,
    inputIdx: number | undefined,
    comparandIdx: number | undefined,
    basePos: ImGui.ImVec2,
  ): LayoutResult {
    this.registerMapping(rootNode, nodeIndex);

    const inputX = basePos.x - H_GAP;
    let cursorY = basePos.y;
    let hasChildren = false;

    const r0 = this.buildAndConnect(inputIdx, targetGraph, rootNode, 0, new ImVec2(inputX, cursorY));

    if (r0) { cursorY += r0.height + V_GAP; hasChildren = true; }

    const r1 = this.buildAndConnect(comparandIdx, targetGraph, rootNode, 1, new ImVec2(inputX, cursorY));

    if (r1) { cursorY += r1.height + V_GAP; hasChildren = true; }

    const totalHeight = hasChildren ? cursorY - basePos.y - V_GAP : LEAF_H;
    const centerY = basePos.y + totalHeight / 2 - LEAF_H / 2;

    rootNode.SetPosition(new ImVec2(basePos.x, centerY));

    return { node: rootNode, height: totalHeight };
  }

  private buildEqualNode (nodeIndex: number, data: spec.EqualNodeData, targetGraph: FlowGraph, basePos: ImGui.ImVec2): LayoutResult {
    const equalNode = targetGraph.CreateNode(EqualToolsNode);

    return this.buildBinaryNode(nodeIndex, targetGraph, equalNode, data.inputValueNodeIndex, data.comparandValueNodeIndex, basePos);
  }

  private buildComparisonNode (
    nodeIndex: number,
    data: spec.FloatComparisonNodeData,
    targetGraph: FlowGraph,
    basePos: ImGui.ImVec2,
    comparison: 'greater' | 'less'
  ): LayoutResult {
    const NodeClass = comparison === 'greater' ? GreaterToolsNode : LessToolsNode;
    const compNode = targetGraph.CreateNode(NodeClass);

    return this.buildBinaryNode(nodeIndex, targetGraph, compNode, data.inputValueNodeIndex, data.comparandValueNodeIndex, basePos);
  }

  private buildApplyAdditiveNode (nodeIndex: number, data: spec.ApplyAdditiveNodeData, targetGraph: FlowGraph, basePos: ImGui.ImVec2): LayoutResult {
    const additiveNode = targetGraph.CreateNode(ApplyAdditiveToolsNode);

    this.registerMapping(additiveNode, nodeIndex);

    const inputX = basePos.x - H_GAP;
    let cursorY = basePos.y;
    let hasChildren = false;

    // Base input (pin 0)
    const r0 = this.buildAndConnect(data.baseNodeIndex, targetGraph, additiveNode, 0, new ImVec2(inputX, cursorY));

    if (r0) { cursorY += r0.height + V_GAP; hasChildren = true; }

    // Additive input (pin 1)
    const r1 = this.buildAndConnect(data.additiveNodeIndex, targetGraph, additiveNode, 1, new ImVec2(inputX, cursorY));

    if (r1) { cursorY += r1.height + V_GAP; hasChildren = true; }

    // Weight input (pin 2)
    const r2 = this.buildAndConnect(data.inputParameterValueNodeIndex, targetGraph, additiveNode, 2, new ImVec2(inputX, cursorY));

    if (r2) { cursorY += r2.height + V_GAP; hasChildren = true; }

    const totalHeight = hasChildren ? cursorY - basePos.y - V_GAP : LEAF_H;
    const centerY = basePos.y + totalHeight / 2 - LEAF_H / 2;

    additiveNode.SetPosition(new ImVec2(basePos.x, centerY));

    return { node: additiveNode, height: totalHeight };
  }
}
