import type { spec } from '@galacean/effects';
import { InvalidIndex } from '@galacean/effects';
import { Color } from 'maoan-imgui-js';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import { AnimationGraphNode, GraphType, GraphValueType } from './flow-editor-node';

export class EqualEditorNode extends AnimationGraphNode {
  constructor () {
    super();
    this.CreateOutputPin('Result', GraphValueType.Bool, true);
    this.CreateInputPin('Input', GraphValueType.Float);
    this.CreateInputPin('Comparand', GraphValueType.Float);
  }

  override GetTypeName (): string {
    return 'Equal';
  }

  override GetCategory (): string {
    return 'Operators';
  }

  override GetTitleBarColor (): Color {
    return new Color(GraphColors.DarkGoldenRod);
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.EqualNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pInput = this.GetConnectedInputNode<AnimationGraphNode>(0);
      const pComparand = this.GetConnectedInputNode<AnimationGraphNode>(1);

      pDefinition.inputValueNodeIndex = pInput ? pInput.Compile(context) : InvalidIndex;
      pDefinition.comparandValueNodeIndex = pComparand ? pComparand.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}

export class GreaterEditorNode extends AnimationGraphNode {
  constructor () {
    super();
    this.CreateOutputPin('Result', GraphValueType.Bool, true);
    this.CreateInputPin('Input', GraphValueType.Float);
    this.CreateInputPin('Comparand', GraphValueType.Float);
  }

  override GetTypeName (): string {
    return 'Greater';
  }

  override GetCategory (): string {
    return 'Operators';
  }

  override GetTitleBarColor (): Color {
    return new Color(GraphColors.DarkGoldenRod);
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.GreaterNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pInput = this.GetConnectedInputNode<AnimationGraphNode>(0);
      const pComparand = this.GetConnectedInputNode<AnimationGraphNode>(1);

      pDefinition.inputValueNodeIndex = pInput ? pInput.Compile(context) : InvalidIndex;
      pDefinition.comparandValueNodeIndex = pComparand ? pComparand.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}

export class LessEditorNode extends AnimationGraphNode {
  constructor () {
    super();
    this.CreateOutputPin('Result', GraphValueType.Bool, true);
    this.CreateInputPin('Input', GraphValueType.Float);
    this.CreateInputPin('Comparand', GraphValueType.Float);
  }

  override GetTypeName (): string {
    return 'Less';
  }

  override GetCategory (): string {
    return 'Operators';
  }

  override GetTitleBarColor (): Color {
    return new Color(GraphColors.DarkGoldenRod);
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.LessNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pInput = this.GetConnectedInputNode<AnimationGraphNode>(0);
      const pComparand = this.GetConnectedInputNode<AnimationGraphNode>(1);

      pDefinition.inputValueNodeIndex = pInput ? pInput.Compile(context) : InvalidIndex;
      pDefinition.comparandValueNodeIndex = pComparand ? pComparand.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}
