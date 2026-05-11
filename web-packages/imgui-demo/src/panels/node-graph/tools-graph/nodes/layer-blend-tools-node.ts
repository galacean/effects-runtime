import type { spec } from '@galacean/effects';
import { InvalidIndex } from '@galacean/effects';
import { Color } from 'maoan-imgui-js';
import { Colors } from '../colors';
import { FlowToolsNode, GraphType, GraphValueType } from './flow-tools-node';
import type { GraphCompilationContext } from '../../compilation';

export class LayerBlendToolsNode extends FlowToolsNode {
  private numLayers: number;

  constructor (numLayers = 0) {
    super();
    this.numLayers = numLayers;
    this.CreateOutputPin('Pose', GraphValueType.Pose);
    this.CreateInputPin('Base', GraphValueType.Pose);
    for (let i = 0; i < numLayers; i++) {
      this.CreateInputPin(`Layer ${i}`, GraphValueType.Pose);
      this.CreateInputPin(`Weight ${i}`, GraphValueType.Float);
    }
  }

  override GetTypeName (): string {
    return 'Layer Blend';
  }

  override GetCategory (): string {
    return 'Animation';
  }

  override GetTitleBarColor (): Color {
    return new Color(Colors.CornflowerBlue);
  }

  GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true]]);
  }

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.LayerBlendNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pBase = this.GetConnectedInputNode<FlowToolsNode>(0);

      pDefinition.baseNodeIndex = pBase ? pBase.Compile(context) : InvalidIndex;
      pDefinition.layerDatas = [];

      for (let i = 0; i < this.numLayers; i++) {
        const pInput = this.GetConnectedInputNode<FlowToolsNode>(1 + i * 2);
        const pWeight = this.GetConnectedInputNode<FlowToolsNode>(2 + i * 2);

        pDefinition.layerDatas.push({
          inputNodeIndex: pInput ? pInput.Compile(context) : InvalidIndex,
          weightValueNodeIndex: pWeight ? pWeight.Compile(context) : InvalidIndex,
        });
      }
    }

    return pDefinition.index;
  }
}
