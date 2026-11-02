import type { math } from '@galacean/effects';
import type { spec } from '@galacean/effects';
import { InvalidIndex } from '@galacean/effects';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import { AnimationGraphNode, GraphType, GraphValueType } from './flow-editor-node';

export class AndEditorNode extends AnimationGraphNode {
  private numInputs: number;

  constructor (numInputs = 2) {
    super();
    this.numInputs = numInputs;
    this.CreateOutputPin('Result', GraphValueType.Bool, true);
    for (let i = 0; i < numInputs; i++) {
      this.CreateInputPin(`Condition ${i}`, GraphValueType.Bool);
    }
  }

  override GetTypeName (): string {
    return 'And';
  }

  override GetCategory (): string {
    return 'Logic';
  }

  override GetTitleBarColor (): math.Color {
    return GraphColors.MediumSlateBlue.clone();
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.AndNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      pDefinition.conditionNodeIndices = [];
      for (let i = 0; i < this.numInputs; i++) {
        const pInput = this.GetConnectedInputNode<AnimationGraphNode>(i);

        pDefinition.conditionNodeIndices.push(pInput ? pInput.Compile(context) : InvalidIndex);
      }
    }

    return pDefinition.index;
  }
}

export class OrEditorNode extends AnimationGraphNode {
  private numInputs: number;

  constructor (numInputs = 2) {
    super();
    this.numInputs = numInputs;
    this.CreateOutputPin('Result', GraphValueType.Bool, true);
    for (let i = 0; i < numInputs; i++) {
      this.CreateInputPin(`Condition ${i}`, GraphValueType.Bool);
    }
  }

  override GetTypeName (): string {
    return 'Or';
  }

  override GetCategory (): string {
    return 'Logic';
  }

  override GetTitleBarColor (): math.Color {
    return GraphColors.MediumSlateBlue.clone();
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.OrNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      pDefinition.conditionNodeIndices = [];
      for (let i = 0; i < this.numInputs; i++) {
        const pInput = this.GetConnectedInputNode<AnimationGraphNode>(i);

        pDefinition.conditionNodeIndices.push(pInput ? pInput.Compile(context) : InvalidIndex);
      }
    }

    return pDefinition.index;
  }
}

export class NotEditorNode extends AnimationGraphNode {
  constructor () {
    super();
    this.CreateOutputPin('Result', GraphValueType.Bool, true);
    this.CreateInputPin('Input', GraphValueType.Bool);
  }

  override GetTypeName (): string {
    return 'Not';
  }

  override GetCategory (): string {
    return 'Logic';
  }

  override GetTitleBarColor (): math.Color {
    return GraphColors.MediumSlateBlue.clone();
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.NotNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pInput = this.GetConnectedInputNode<AnimationGraphNode>(0);

      pDefinition.inputValueNodeIndex = pInput ? pInput.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}
