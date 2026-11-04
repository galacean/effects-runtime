import type { spec } from '@galacean/effects';
import type * as NodeGraph from '../../../../ui/graph-editor/index';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import { AnimationGraphNode, GraphType, GraphValueType } from './flow-editor-node';

export class ConstBoolEditorNode extends AnimationGraphNode {
  private m_value: boolean = false;

  constructor () {
    super();
    this.CreateOutputPin('Value', GraphValueType.Bool, true);
  }

  override GetTypeName (): string { return 'Bool'; }
  override GetCategory (): string { return 'Values/Bool'; }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true], [GraphType.ValueTree, true], [GraphType.TransitionConduit, true]]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.ConstBoolNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      pDefinition.value = this.m_value;
    }

    return pDefinition.index;
  }
}

export class ConstFloatEditorNode extends AnimationGraphNode {
  private m_value: number = 0.0;

  constructor () {
    super();
    this.CreateOutputPin('Value', GraphValueType.Float, true);
  }

  override GetTypeName (): string { return 'Float'; }
  override GetCategory (): string { return 'Values/Float'; }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true], [GraphType.ValueTree, true], [GraphType.TransitionConduit, true]]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.ConstFloatNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      pDefinition.value = this.m_value;
    }

    return pDefinition.index;
  }
}
