import { InvalidIndex } from '@galacean/effects';
import type { spec } from '@galacean/effects';
import { Color } from 'maoan-imgui-js';
import { Colors } from '../colors';
import { FlowToolsNode, GraphType, GraphValueType } from './flow-tools-node';
import type { GraphCompilationContext } from '../../compilation';

export class ApplyAdditiveToolsNode extends FlowToolsNode {
  constructor () {
    super();
    this.CreateOutputPin('Pose', GraphValueType.Pose);
    this.CreateInputPin('Base', GraphValueType.Pose);
    this.CreateInputPin('Additive', GraphValueType.Pose);
    this.CreateInputPin('Weight', GraphValueType.Float);
  }

  override GetTypeName (): string {
    return 'Apply Additive';
  }

  override GetCategory (): string {
    return 'Animation';
  }

  override GetTitleBarColor (): Color {
    return new Color(Colors.CornflowerBlue);
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true]]);
  }

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.ApplyAdditiveNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pBase = this.GetConnectedInputNode<FlowToolsNode>(0);
      const pAdditive = this.GetConnectedInputNode<FlowToolsNode>(1);
      const pWeight = this.GetConnectedInputNode<FlowToolsNode>(2);

      pDefinition.baseNodeIndex = pBase ? pBase.Compile(context) : InvalidIndex;
      pDefinition.additiveNodeIndex = pAdditive ? pAdditive.Compile(context) : InvalidIndex;
      pDefinition.inputParameterValueNodeIndex = pWeight ? pWeight.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}
