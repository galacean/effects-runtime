import type { spec } from '@galacean/effects';
import { InvalidIndex } from '@galacean/effects';
import { Color } from 'maoan-imgui-js';
import { Colors } from '../colors';
import { FlowToolsNode, GraphType, GraphValueType } from './flow-tools-node';
import type { GraphCompilationContext } from '../../compilation';

export class BlendToolsNode extends FlowToolsNode {

  constructor () {
    super();
    this.CreateOutputPin('Pose', GraphValueType.Pose);
    this.CreateInputPin('Source 0', GraphValueType.Pose);
    this.CreateInputPin('Source 1', GraphValueType.Pose);
    this.CreateInputPin('Blend Weight', GraphValueType.Float);
  }

  override GetTypeName (): string {
    return 'Blend';
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
    const pDefinition = context.getGraphNodeAssetData<spec.BlendNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pSource0 = this.GetConnectedInputNode<FlowToolsNode>(0);
      const pSource1 = this.GetConnectedInputNode<FlowToolsNode>(1);
      const pBlendWeight = this.GetConnectedInputNode<FlowToolsNode>(2);

      pDefinition.sourceNodeIndex0 = pSource0 ? pSource0.Compile(context) : InvalidIndex;
      pDefinition.sourceNodeIndex1 = pSource1 ? pSource1.Compile(context) : InvalidIndex;
      pDefinition.inputParameterValueNodeIndex = pBlendWeight ? pBlendWeight.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}
