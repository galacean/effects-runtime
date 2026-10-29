import type { spec } from '@galacean/effects';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import { DataSlotEditorNode } from './data-slot-editor-node';
import { GraphType, GraphValueType } from './flow-editor-node';

export class AnimationClipEditorNode extends DataSlotEditorNode {

  private m_sampleRootMotion: boolean = true;

  private m_allowLooping: boolean = false;

  constructor () {
    super();
    this.CreateOutputPin('Pose', GraphValueType.Pose);
    this.CreateInputPin('Play In Reverse', GraphValueType.Bool);
    this.CreateInputPin('Reset Time', GraphValueType.Bool);
  }

  override IsAnimationClipReferenceNode (): boolean {
    return true;
  }

  override GetTypeName (): string {
    return 'Animation Clip';
  }

  override GetCategory (): string {
    return 'Animation';
  }

  GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true]]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.AnimationClipNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {

      //   if (pShouldPlayInReverseNode !== null) {
      //     const compiledNodeIdx = pShouldPlayInReverseNode.Compile(context);

      //     if (compiledNodeIdx !== InvalidIndex) {
      //       pDefinition!.m_playInReverseValueNodeIdx = compiledNodeIdx;
      //     } else {
      //       return InvalidIndex;
      //     }
      //   }

      //-------------------------------------------------------------------------

      //   const pResetTimeNode = this.GetConnectedInputNode<FlowToolsNode>(1);

      //   if (pResetTimeNode !== null) {
      //     const compiledNodeIdx = pResetTimeNode.Compile(context);

      //     if (compiledNodeIdx !== InvalidIndex) {
      //       pDefinition.m_resetTimeValueNodeIdx = compiledNodeIdx;
      //     } else {
      //       return InvalidIndex;
      //     }
      //   }

      //-------------------------------------------------------------------------

      pDefinition.dataSlotIndex = context.RegisterDataSlotNode(this.GetID());
    //   pDefinition.m_sampleRootMotion = this.m_sampleRootMotion;
    //   pDefinition.m_allowLooping = this.m_allowLooping;
    }

    return pDefinition.index;
  }

  protected override GetDefaultSlotName (): string {
    return 'Animation';
  }

//   protected GetSlotResourceTypeID (): ResourceTypeID {
//     return AnimationClip.GetStaticResourceTypeID();
//   }
}