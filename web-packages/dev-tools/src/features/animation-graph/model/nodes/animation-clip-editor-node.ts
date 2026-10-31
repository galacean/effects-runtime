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

      pDefinition.dataSlotIndex = context.RegisterDataSlotNode(this.GetID());
    }

    return pDefinition.index;
  }

  protected override GetDefaultSlotName (): string {
    return 'Animation';
  }

}
