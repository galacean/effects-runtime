import type { FlowToolsNode } from './flow-tools-node';
import { GraphValueType, GraphType } from './flow-tools-node';
import { DataSlotToolsNode } from './data-slot-tools-node';
import type { GraphCompilationContext } from '../../compilation';
import type { AnimationClipNodeAssetData } from '@galacean/effects';

export class AnimationClipToolsNode extends DataSlotToolsNode {

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

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<AnimationClipNodeAssetData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pShouldPlayInReverseNode = this.GetConnectedInputNode<FlowToolsNode>(0);

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