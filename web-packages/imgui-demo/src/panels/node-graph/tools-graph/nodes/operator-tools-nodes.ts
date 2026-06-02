import { InvalidIndex } from '@galacean/effects';
import type { spec } from '@galacean/effects';
import { Color } from 'maoan-imgui-js';
import { Colors } from '../colors';
import { FlowToolsNode, GraphType, GraphValueType } from './flow-tools-node';
import type { GraphCompilationContext } from '../../compilation';

export class EqualToolsNode extends FlowToolsNode {
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
    return new Color(Colors.DarkGoldenRod);
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.EqualNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pInput = this.GetConnectedInputNode<FlowToolsNode>(0);
      const pComparand = this.GetConnectedInputNode<FlowToolsNode>(1);

      pDefinition.inputValueNodeIndex = pInput ? pInput.Compile(context) : InvalidIndex;
      pDefinition.comparandValueNodeIndex = pComparand ? pComparand.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}

export class GreaterToolsNode extends FlowToolsNode {
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
    return new Color(Colors.DarkGoldenRod);
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.GreaterNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pInput = this.GetConnectedInputNode<FlowToolsNode>(0);
      const pComparand = this.GetConnectedInputNode<FlowToolsNode>(1);

      pDefinition.inputValueNodeIndex = pInput ? pInput.Compile(context) : InvalidIndex;
      pDefinition.comparandValueNodeIndex = pComparand ? pComparand.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}

export class LessToolsNode extends FlowToolsNode {
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
    return new Color(Colors.DarkGoldenRod);
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.LessNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pInput = this.GetConnectedInputNode<FlowToolsNode>(0);
      const pComparand = this.GetConnectedInputNode<FlowToolsNode>(1);

      pDefinition.inputValueNodeIndex = pInput ? pInput.Compile(context) : InvalidIndex;
      pDefinition.comparandValueNodeIndex = pComparand ? pComparand.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}
