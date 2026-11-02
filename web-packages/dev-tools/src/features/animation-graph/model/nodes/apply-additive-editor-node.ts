import type { math } from '@galacean/effects';
import type { spec } from '@galacean/effects';
import { InvalidIndex } from '@galacean/effects';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import { AnimationGraphNode, GraphType, GraphValueType } from './flow-editor-node';

export class ApplyAdditiveEditorNode extends AnimationGraphNode {
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

  override GetTitleBarColor (): math.Color {
    return GraphColors.CornflowerBlue.clone();
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true]]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.ApplyAdditiveNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pBase = this.GetConnectedInputNode<AnimationGraphNode>(0);
      const pAdditive = this.GetConnectedInputNode<AnimationGraphNode>(1);
      const pWeight = this.GetConnectedInputNode<AnimationGraphNode>(2);

      pDefinition.baseNodeIndex = pBase ? pBase.Compile(context) : InvalidIndex;
      pDefinition.additiveNodeIndex = pAdditive ? pAdditive.Compile(context) : InvalidIndex;
      pDefinition.inputParameterValueNodeIndex = pWeight ? pWeight.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}
