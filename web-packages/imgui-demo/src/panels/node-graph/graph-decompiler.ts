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
      const rootToolsNode = this.buildNode(this.rootNodeIndex, rootGraph);

      if (rootToolsNode) {
        rootGraph.TryMakeConnection(
          rootToolsNode, rootToolsNode.GetOutputPin(0)!,
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
   */
  private buildNode (nodeIndex: number, targetGraph: FlowGraph): FlowToolsNode | null {
    if (nodeIndex === InvalidIndex || nodeIndex >= this.nodeDatas.length) {
      return null;
    }

    const nodeData = this.nodeDatas[nodeIndex];

    if (!nodeData) {
      return null;
    }

    // 如果是控制参数引用，创建参数引用节点
    if (this.controlParameterNodes.has(nodeIndex)) {
      return this.buildParameterReference(nodeIndex, targetGraph);
    }

    switch (nodeData.type) {
      case 'StateMachineNodeData':
        return this.buildStateMachine(nodeIndex, nodeData as spec.StateMachineNodeData, targetGraph);
      case 'AnimationClipNodeData':
        return this.buildAnimationClip(nodeIndex, nodeData as spec.AnimationClipNodeData, targetGraph);
      case 'BlendNodeData':
        return this.buildBlendNode(nodeIndex, nodeData as spec.BlendNodeData, targetGraph);
      case 'LayerBlendNodeData':
        return this.buildLayerBlendNode(nodeIndex, nodeData as spec.LayerBlendNodeData, targetGraph);
      case 'ConstBoolNodeData':
        return this.buildConstBool(nodeIndex, nodeData as spec.ConstBoolNodeData, targetGraph);
      case 'ConstFloatNodeData':
        return this.buildConstFloat(nodeIndex, nodeData as spec.ConstFloatNodeData, targetGraph);
      case 'AndNodeData':
        return this.buildAndNode(nodeIndex, nodeData as spec.AndNodeData, targetGraph);
      case 'OrNodeData':
        return this.buildOrNode(nodeIndex, nodeData as spec.OrNodeData, targetGraph);
      case 'NotNodeData':
        return this.buildNotNode(nodeIndex, nodeData as spec.NotNodeData, targetGraph);
      case 'EqualNodeData':
        return this.buildEqualNode(nodeIndex, nodeData as spec.EqualNodeData, targetGraph);
      case 'GreaterNodeData':
        return this.buildComparisonNode(nodeIndex, nodeData as spec.GreaterNodeData, targetGraph, 'greater');
      case 'LessNodeData':
        return this.buildComparisonNode(nodeIndex, nodeData as spec.LessNodeData, targetGraph, 'less');
      case 'ApplyAdditiveNodeData':
        return this.buildApplyAdditiveNode(nodeIndex, nodeData as spec.ApplyAdditiveNodeData, targetGraph);
      case 'StateNodeData': {
        // StateNodeData 不应该作为独立节点被引用
        console.warn(`[GraphDecompiler] Encountered StateNodeData at index ${nodeIndex}. StateNode is a wrapper and should not be directly referenced.`, nodeData);

        // StateNode 是包装器，透传到其 childNodeIndex 构建实际的 Pose 节点
        const stateData = nodeData as spec.StateNodeData;

        if (stateData.childNodeIndex !== undefined && stateData.childNodeIndex !== InvalidIndex) {
          return this.buildNode(stateData.childNodeIndex, targetGraph);
        }

        return null;
      }
      case 'TransitionNodeData':
        // TransitionNode 不应该作为独立节点被引用，跳过
        return null;
      case 'ControlParameterBoolNodeData':
      case 'ControlParameterFloatNodeData':
      case 'ControlParameterTriggerNodeData':
        return this.buildParameterReference(nodeIndex, targetGraph);
      default:
        console.warn(`[GraphDecompiler] Unhandled node type: "${nodeData.type}" at index ${nodeIndex}`, nodeData);

        return null;
    }
  }

  private buildParameterReference (nodeIndex: number, targetGraph: FlowGraph): FlowToolsNode | null {
    const paramNode = this.controlParameterNodes.get(nodeIndex);

    if (!paramNode) {
      return null;
    }

    if (paramNode instanceof BoolControlParameterToolsNode) {
      const refNode = targetGraph.CreateNode(BoolParameterReferenceToolsNode, paramNode);

      // 参数引用节点映射到控制参数的运行时索引（位置由调用方控制）
      this.registerMapping(refNode, nodeIndex);

      return refNode;
    } else if (paramNode instanceof FloatControlParameterToolsNode) {
      const refNode = targetGraph.CreateNode(FloatParameterReferenceToolsNode, paramNode);

      this.registerMapping(refNode, nodeIndex);

      return refNode;
    }

    return null;
  }

  private buildStateMachine (nodeIndex: number, data: spec.StateMachineNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const smNode = targetGraph.CreateNode(StateMachineToolsNode, new ImVec2(400, 200));

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

        for (let tIdx = 0; tIdx < transitions.length; tIdx++) {
          const transData = transitions[tIdx];
          const transNodeData = this.nodeDatas[transData.transitionNodeIndex] as spec.TransitionNodeData | undefined;
          const transYPos = 50 + tIdx * 200;
          const transNode = conduitGraph.CreateNode(TransitionToolsNode, new ImVec2(300, transYPos));

          // 注册 TransitionToolsNode → transitionNodeIndex 映射
          this.registerMapping(transNode, transData.transitionNodeIndex);

          if (transNodeData) {
            transNode.m_duration = transNodeData.duration ?? 0.2;
            transNode.hasExitTime = transNodeData.hasExitTime ?? false;
            transNode.exitTime = transNodeData.exitTime ?? 0.75;
          }

          // 构建条件节点并连接
          if (transData.conditionNodeIndex !== undefined && transData.conditionNodeIndex !== InvalidIndex) {
            const conditionNode = this.buildNode(transData.conditionNodeIndex, conduitGraph);

            if (conditionNode) {
              conditionNode.SetPosition(new ImVec2(0, transYPos));
              const connected = conduitGraph.TryMakeConnection(
                conditionNode, conditionNode.GetOutputPin(0)!,
                transNode, transNode.GetInputPin(0)!
              );

              if (!connected) {
                console.warn(`[GraphDecompiler] Transition condition connection FAILED: output type="${conditionNode.GetOutputPin(0)?.m_type}", input type="${transNode.GetInputPin(0)?.m_type}"`);
              }
            } else {
              console.warn(`[GraphDecompiler] Transition condition buildNode returned null for index ${transData.conditionNodeIndex}, type="${this.nodeDatas[transData.conditionNodeIndex]?.type}"`);
            }
          }
        }
      }
    }

    return smNode;
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

    const blendTreeNode = this.buildNode(childNodeIndex, childGraph);

    if (blendTreeNode) {
      blendTreeNode.SetPosition(new ImVec2(100, 200));

      childGraph.TryMakeConnection(
        blendTreeNode, blendTreeNode.GetOutputPin(0)!,
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

  private buildBlendNode (nodeIndex: number, blendData: spec.BlendNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const blendNode = targetGraph.CreateNode(BlendToolsNode, new ImVec2(300, 250));

    this.registerMapping(blendNode, nodeIndex);

    // Source0
    if (blendData.sourceNodeIndex0 !== undefined && blendData.sourceNodeIndex0 !== InvalidIndex) {
      const source0 = this.buildNode(blendData.sourceNodeIndex0, targetGraph);

      if (source0) {
        source0.SetPosition(new ImVec2(-100, 50));
        targetGraph.TryMakeConnection(
          source0, source0.GetOutputPin(0)!,
          blendNode, blendNode.GetInputPin(0)!
        );
      }
    }

    // Source1
    if (blendData.sourceNodeIndex1 !== undefined && blendData.sourceNodeIndex1 !== InvalidIndex) {
      const source1 = this.buildNode(blendData.sourceNodeIndex1, targetGraph);

      if (source1) {
        source1.SetPosition(new ImVec2(-100, 400));
        targetGraph.TryMakeConnection(
          source1, source1.GetOutputPin(0)!,
          blendNode, blendNode.GetInputPin(1)!
        );
      }
    }

    // BlendWeight
    if (blendData.inputParameterValueNodeIndex !== undefined && blendData.inputParameterValueNodeIndex !== InvalidIndex) {
      const weightNode = this.buildNode(blendData.inputParameterValueNodeIndex, targetGraph);

      if (weightNode) {
        weightNode.SetPosition(new ImVec2(-100, 550));
        targetGraph.TryMakeConnection(
          weightNode, weightNode.GetOutputPin(0)!,
          blendNode, blendNode.GetInputPin(2)!
        );
      }
    }

    return blendNode;
  }

  private buildLayerBlendNode (nodeIndex: number, data: spec.LayerBlendNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const numLayers = data.layerDatas?.length ?? 0;
    const layerBlendNode = targetGraph.CreateNode(LayerBlendToolsNode, new ImVec2(300, 250), numLayers);

    this.registerMapping(layerBlendNode, nodeIndex);

    // Base input
    if (data.baseNodeIndex !== undefined && data.baseNodeIndex !== InvalidIndex) {
      const baseNode = this.buildNode(data.baseNodeIndex, targetGraph);

      if (baseNode) {
        baseNode.SetPosition(new ImVec2(-100, 50));
        const connected = targetGraph.TryMakeConnection(
          baseNode, baseNode.GetOutputPin(0)!,
          layerBlendNode, layerBlendNode.GetInputPin(0)!
        );

        if (!connected) {
          console.warn(`[GraphDecompiler] LayerBlend base connection FAILED: output type="${baseNode.GetOutputPin(0)?.m_type}", input type="${layerBlendNode.GetInputPin(0)?.m_type}"`);
        }
      } else {
        console.warn(`[GraphDecompiler] LayerBlend base buildNode returned null for index ${data.baseNodeIndex}, type="${this.nodeDatas[data.baseNodeIndex]?.type}"`);
      }
    }

    // Layer inputs
    if (data.layerDatas) {
      for (let i = 0; i < data.layerDatas.length; i++) {
        const layerData = data.layerDatas[i];

        // Layer pose input
        if (layerData.inputNodeIndex !== undefined && layerData.inputNodeIndex !== InvalidIndex) {
          const inputNode = this.buildNode(layerData.inputNodeIndex, targetGraph);

          if (inputNode) {
            inputNode.SetPosition(new ImVec2(-100, 300 + i * 200));
            const connected = targetGraph.TryMakeConnection(
              inputNode, inputNode.GetOutputPin(0)!,
              layerBlendNode, layerBlendNode.GetInputPin(1 + i * 2)!
            );

            if (!connected) {
              console.warn(`[GraphDecompiler] LayerBlend layer[${i}] input connection FAILED: output type="${inputNode.GetOutputPin(0)?.m_type}", input type="${layerBlendNode.GetInputPin(1 + i * 2)?.m_type}", pinIndex=${1 + i * 2}`);
            }
          } else {
            console.warn(`[GraphDecompiler] LayerBlend layer[${i}] input buildNode returned null for index ${layerData.inputNodeIndex}, type="${this.nodeDatas[layerData.inputNodeIndex]?.type}"`);
          }
        }

        // Layer weight input
        if (layerData.weightValueNodeIndex !== undefined && layerData.weightValueNodeIndex !== InvalidIndex) {
          const weightNode = this.buildNode(layerData.weightValueNodeIndex, targetGraph);

          if (weightNode) {
            weightNode.SetPosition(new ImVec2(-250, 350 + i * 200));
            const connected = targetGraph.TryMakeConnection(
              weightNode, weightNode.GetOutputPin(0)!,
              layerBlendNode, layerBlendNode.GetInputPin(2 + i * 2)!
            );

            if (!connected) {
              console.warn(`[GraphDecompiler] LayerBlend layer[${i}] weight connection FAILED: output type="${weightNode.GetOutputPin(0)?.m_type}", input type="${layerBlendNode.GetInputPin(2 + i * 2)?.m_type}", pinIndex=${2 + i * 2}`);
            }
          } else {
            console.warn(`[GraphDecompiler] LayerBlend layer[${i}] weight buildNode returned null for index ${layerData.weightValueNodeIndex}, type="${this.nodeDatas[layerData.weightValueNodeIndex]?.type}"`);
          }
        }
      }
    }

    return layerBlendNode;
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

  private buildAndNode (nodeIndex: number, data: spec.AndNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const numInputs = data.conditionNodeIndices?.length ?? 0;
    const andNode = targetGraph.CreateNode(AndToolsNode, new ImVec2(200, 200), numInputs);

    this.registerMapping(andNode, nodeIndex);

    if (data.conditionNodeIndices) {
      for (let i = 0; i < data.conditionNodeIndices.length; i++) {
        const condIdx = data.conditionNodeIndices[i];

        if (condIdx !== undefined && condIdx !== InvalidIndex) {
          const inputNode = this.buildNode(condIdx, targetGraph);

          if (inputNode) {
            inputNode.SetPosition(new ImVec2(-100, 50 + i * 150));
            targetGraph.TryMakeConnection(
              inputNode, inputNode.GetOutputPin(0)!,
              andNode, andNode.GetInputPin(i)!
            );
          }
        }
      }
    }

    return andNode;
  }

  private buildOrNode (nodeIndex: number, data: spec.OrNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const numInputs = data.conditionNodeIndices?.length ?? 0;
    const orNode = targetGraph.CreateNode(OrToolsNode, new ImVec2(200, 200), numInputs);

    this.registerMapping(orNode, nodeIndex);

    if (data.conditionNodeIndices) {
      for (let i = 0; i < data.conditionNodeIndices.length; i++) {
        const condIdx = data.conditionNodeIndices[i];

        if (condIdx !== undefined && condIdx !== InvalidIndex) {
          const inputNode = this.buildNode(condIdx, targetGraph);

          if (inputNode) {
            inputNode.SetPosition(new ImVec2(-100, 50 + i * 150));
            targetGraph.TryMakeConnection(
              inputNode, inputNode.GetOutputPin(0)!,
              orNode, orNode.GetInputPin(i)!
            );
          }
        }
      }
    }

    return orNode;
  }

  private buildNotNode (nodeIndex: number, data: spec.NotNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const notNode = targetGraph.CreateNode(NotToolsNode, new ImVec2(200, 200));

    this.registerMapping(notNode, nodeIndex);

    if (data.inputValueNodeIndex !== undefined && data.inputValueNodeIndex !== InvalidIndex) {
      const inputNode = this.buildNode(data.inputValueNodeIndex, targetGraph);

      if (inputNode) {
        inputNode.SetPosition(new ImVec2(-100, 200));
        targetGraph.TryMakeConnection(
          inputNode, inputNode.GetOutputPin(0)!,
          notNode, notNode.GetInputPin(0)!
        );
      }
    }

    return notNode;
  }

  private buildEqualNode (nodeIndex: number, data: spec.EqualNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const equalNode = targetGraph.CreateNode(EqualToolsNode, new ImVec2(200, 200));

    this.registerMapping(equalNode, nodeIndex);

    if (data.inputValueNodeIndex !== undefined && data.inputValueNodeIndex !== InvalidIndex) {
      const inputNode = this.buildNode(data.inputValueNodeIndex, targetGraph);

      if (inputNode) {
        inputNode.SetPosition(new ImVec2(-100, 100));
        targetGraph.TryMakeConnection(
          inputNode, inputNode.GetOutputPin(0)!,
          equalNode, equalNode.GetInputPin(0)!
        );
      }
    }

    if (data.comparandValueNodeIndex !== undefined && data.comparandValueNodeIndex !== InvalidIndex) {
      const comparandNode = this.buildNode(data.comparandValueNodeIndex, targetGraph);

      if (comparandNode) {
        comparandNode.SetPosition(new ImVec2(-100, 300));
        targetGraph.TryMakeConnection(
          comparandNode, comparandNode.GetOutputPin(0)!,
          equalNode, equalNode.GetInputPin(1)!
        );
      }
    }

    return equalNode;
  }

  private buildComparisonNode (
    nodeIndex: number,
    data: spec.FloatComparisonNodeData,
    targetGraph: FlowGraph,
    comparison: 'greater' | 'less'
  ): FlowToolsNode {
    const NodeClass = comparison === 'greater' ? GreaterToolsNode : LessToolsNode;
    const compNode = targetGraph.CreateNode(NodeClass, new ImVec2(200, 200));

    this.registerMapping(compNode, nodeIndex);

    if (data.inputValueNodeIndex !== undefined && data.inputValueNodeIndex !== InvalidIndex) {
      const inputNode = this.buildNode(data.inputValueNodeIndex, targetGraph);

      if (inputNode) {
        inputNode.SetPosition(new ImVec2(-100, 100));
        targetGraph.TryMakeConnection(
          inputNode, inputNode.GetOutputPin(0)!,
          compNode, compNode.GetInputPin(0)!
        );
      }
    }

    if (data.comparandValueNodeIndex !== undefined && data.comparandValueNodeIndex !== InvalidIndex) {
      const comparandNode = this.buildNode(data.comparandValueNodeIndex, targetGraph);

      if (comparandNode) {
        comparandNode.SetPosition(new ImVec2(-100, 300));
        targetGraph.TryMakeConnection(
          comparandNode, comparandNode.GetOutputPin(0)!,
          compNode, compNode.GetInputPin(1)!
        );
      }
    }

    return compNode;
  }

  private buildApplyAdditiveNode (nodeIndex: number, data: spec.ApplyAdditiveNodeData, targetGraph: FlowGraph): FlowToolsNode {
    const additiveNode = targetGraph.CreateNode(ApplyAdditiveToolsNode, new ImVec2(300, 250));

    this.registerMapping(additiveNode, nodeIndex);

    // Base input
    if (data.baseNodeIndex !== undefined && data.baseNodeIndex !== InvalidIndex) {
      const baseNode = this.buildNode(data.baseNodeIndex, targetGraph);

      if (baseNode) {
        baseNode.SetPosition(new ImVec2(-100, 50));
        targetGraph.TryMakeConnection(
          baseNode, baseNode.GetOutputPin(0)!,
          additiveNode, additiveNode.GetInputPin(0)!
        );
      }
    }

    // Additive input
    if (data.additiveNodeIndex !== undefined && data.additiveNodeIndex !== InvalidIndex) {
      const addNode = this.buildNode(data.additiveNodeIndex, targetGraph);

      if (addNode) {
        addNode.SetPosition(new ImVec2(-100, 300));
        targetGraph.TryMakeConnection(
          addNode, addNode.GetOutputPin(0)!,
          additiveNode, additiveNode.GetInputPin(1)!
        );
      }
    }

    // Weight input
    if (data.inputParameterValueNodeIndex !== undefined && data.inputParameterValueNodeIndex !== InvalidIndex) {
      const weightNode = this.buildNode(data.inputParameterValueNodeIndex, targetGraph);

      if (weightNode) {
        weightNode.SetPosition(new ImVec2(-100, 500));
        targetGraph.TryMakeConnection(
          weightNode, weightNode.GetOutputPin(0)!,
          additiveNode, additiveNode.GetInputPin(2)!
        );
      }
    }

    return additiveNode;
  }
}
