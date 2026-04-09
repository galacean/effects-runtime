import { InvalidIndex } from '@galacean/effects';
import type { spec } from '@galacean/effects';
import { Color } from 'maoan-imgui-js';
import { Colors } from '../colors';
import { FlowToolsNode, GraphType, GraphValueType } from './flow-tools-node';
import type { GraphCompilationContext } from '../../compilation';

export class AndToolsNode extends FlowToolsNode {
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

  override GetTitleBarColor (): Color {
    return new Color(Colors.MediumSlateBlue);
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.AndNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      pDefinition.conditionNodeIndices = [];
      for (let i = 0; i < this.numInputs; i++) {
        const pInput = this.GetConnectedInputNode<FlowToolsNode>(i);

        pDefinition.conditionNodeIndices.push(pInput ? pInput.Compile(context) : InvalidIndex);
      }
    }

    return pDefinition.index;
  }
}

export class OrToolsNode extends FlowToolsNode {
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

  override GetTitleBarColor (): Color {
    return new Color(Colors.MediumSlateBlue);
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.OrNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      pDefinition.conditionNodeIndices = [];
      for (let i = 0; i < this.numInputs; i++) {
        const pInput = this.GetConnectedInputNode<FlowToolsNode>(i);

        pDefinition.conditionNodeIndices.push(pInput ? pInput.Compile(context) : InvalidIndex);
      }
    }

    return pDefinition.index;
  }
}

export class NotToolsNode extends FlowToolsNode {
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

  override GetTitleBarColor (): Color {
    return new Color(Colors.MediumSlateBlue);
  }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([
      [GraphType.BlendTree, true],
      [GraphType.ValueTree, true],
      [GraphType.TransitionConduit, true],
    ]);
  }

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<spec.NotNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      const pInput = this.GetConnectedInputNode<FlowToolsNode>(0);

      pDefinition.inputValueNodeIndex = pInput ? pInput.Compile(context) : InvalidIndex;
    }

    return pDefinition.index;
  }
}
