import type { math } from '@galacean/effects';
import type { spec } from '@galacean/effects';
import { InvalidIndex } from '@galacean/effects';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import { AnimationGraphNode, GraphType, GraphValueType } from './flow-editor-node';

export class LayerBlendEditorNode extends AnimationGraphNode {
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

  override GetTitleBarColor (): math.Color {
    return GraphColors.CornflowerBlue.clone();
  }

  GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true]]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.LayerBlendNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pBase = this.GetConnectedInputNode<AnimationGraphNode>(0);

      pDefinition.baseNodeIndex = pBase ? pBase.Compile(context) : InvalidIndex;
      pDefinition.layerDatas = [];

      for (let i = 0; i < this.numLayers; i++) {
        const pInput = this.GetConnectedInputNode<AnimationGraphNode>(1 + i * 2);
        const pWeight = this.GetConnectedInputNode<AnimationGraphNode>(2 + i * 2);

        pDefinition.layerDatas.push({
          inputNodeIndex: pInput ? pInput.Compile(context) : InvalidIndex,
          weightValueNodeIndex: pWeight ? pWeight.Compile(context) : InvalidIndex,
        });
      }
    }

    return pDefinition.index;
  }
}
