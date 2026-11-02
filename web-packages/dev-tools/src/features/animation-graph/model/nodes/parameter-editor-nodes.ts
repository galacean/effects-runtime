import type { spec } from '@galacean/effects';
import * as NodeGraph from '../../../../ui/graph-editor/index';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import type { AnimationGraphContext } from '../animation-graph-context';
import { AnimationGraphNode, GraphType, GraphValueType, InvalidIndex } from './flow-editor-node';
import { ResultEditorNode } from './result-editor-node';

export abstract class ParameterBaseEditorNode extends AnimationGraphNode {
  protected m_group: string;

  constructor ();
  constructor (name: string, groupName: string);
  constructor (name: string = '', groupName: string = '') {
    super();
    if (name) {
      this.m_name = name;
    }
    this.m_group = groupName;
  }

  override IsVisible (): boolean { return false; }
  override IsRenameable (): boolean { return true; }
  override IsUserCreatable (): boolean { return false; }
  override RequiresUniqueName (): boolean { return true; }

  GetParameterName (): string { return this.m_name; }
  GetParameterID (): string { return this.m_name; }
  GetParameterGroup (): string { return this.m_group; }

  SetParameterGroup (newGroupName: string): void {
    new NodeGraph.ScopedNodeModification(this);

    this.m_group = newGroupName;
  }
}

export class ControlParameterEditorNode extends ParameterBaseEditorNode {
  protected m_value: any;

  constructor ();
  constructor (name: string, groupName: string);
  constructor (name: string = '', groupName: string = '') {
    super(name, groupName);
  }

  override GetTypeName (): string { return 'Parameter'; }
  override GetCategory (): string { return 'Control Parameters'; }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true], [GraphType.ValueTree, true], [GraphType.TransitionConduit, true]]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    switch (this.GetOutputValueType()) {
      case GraphValueType.Bool: {
        const pDefinition: spec.ControlParameterBoolNodeData = context.getGraphNodeAssetData(this);

        pDefinition.value = this.m_value;

        return pDefinition.index;
      }
      case GraphValueType.Float: {
        const pDefinition: spec.ControlParameterFloatNodeData = context.getGraphNodeAssetData(this);

        pDefinition.value = this.m_value;

        return pDefinition.index;
      }
      default:

        return InvalidIndex;
    }
  }

  static Create (
    pRootGraph: NodeGraph.FlowGraphModel,
    type: GraphValueType,
    name: string,
    groupName: string
  ): ControlParameterEditorNode {

    let pParameter: ControlParameterEditorNode | null = null;

    switch (type) {
      case GraphValueType.Bool:
        pParameter = pRootGraph.CreateNode<BoolControlParameterEditorNode>(
          BoolControlParameterEditorNode,
          name,
          groupName
        );

        break;
      case GraphValueType.Float:
        pParameter = pRootGraph.CreateNode<FloatControlParameterEditorNode>(
          FloatControlParameterEditorNode,
          name,
          groupName
        );

        break;

    }
    if (!pParameter) {
      throw new Error(type + ' parameter node not found.');
    }

    return pParameter;
  }

  ReflectPreviewValues (pOtherParameterNode: ControlParameterEditorNode): void {}
}

export class BoolControlParameterEditorNode extends ControlParameterEditorNode {
  private m_previewStartValue: boolean = false;

  constructor ();
  constructor (name: string, groupName: string);
  constructor (name: string = '', groupName: string = '') {
    super(name, groupName);
    this.CreateOutputPin('Value', GraphValueType.Bool, true);
    this.m_value = false;
  }

  GetPreviewStartValue (): boolean {
    return this.m_previewStartValue;
  }
}

export class FloatControlParameterEditorNode extends ControlParameterEditorNode {
  private m_previewStartValue: number = 0;
  private m_previewMin: number = 0;
  private m_previewMax: number = 1;

  constructor ();
  constructor (name: string, groupName: string);
  constructor (name: string = '', groupName: string = '') {
    super(name, groupName);
    this.CreateOutputPin('Value', GraphValueType.Float, true);
    this.m_value = 0;
  }

  GetPreviewStartValue (): number {
    return this.m_previewStartValue;
  }
  GetPreviewRangeMin (): number {
    return this.m_previewMin;
  }
  GetPreviewRangeMax (): number {
    return this.m_previewMax;
  }
}

export class ParameterReferenceEditorNode extends AnimationGraphNode {
  protected m_pParameter: ParameterBaseEditorNode;
  protected m_parameterUUID: NodeGraph.UUID;
  protected m_parameterValueType: GraphValueType;
  protected m_parameterName: string;
  protected m_parameterGroup: string;

  static Create (
    pGraph: NodeGraph.FlowGraphModel,
    pParameter: ParameterBaseEditorNode
  ): ParameterReferenceEditorNode {

    let pReferenceNode: ParameterReferenceEditorNode | null = null;

    switch (pParameter.GetOutputValueType()) {
      case GraphValueType.Bool:
        pReferenceNode = pGraph.CreateNode<BoolParameterReferenceEditorNode>(BoolParameterReferenceEditorNode, pParameter);

        break; case GraphValueType.ID:

        break; case GraphValueType.Float:
        pReferenceNode = pGraph.CreateNode<FloatParameterReferenceEditorNode>(BoolParameterReferenceEditorNode, pParameter);

        break; case GraphValueType.Vector:

        break; case GraphValueType.Target:

        break; case GraphValueType.BoneMask:

        break; default:
        break;
    }

    if (!pReferenceNode) {
      throw new Error(pParameter.GetOutputValueType() + ' parameter node not found.');
    }

    return pReferenceNode;
  }

  constructor ();
  constructor (pParameter: ParameterBaseEditorNode);
  constructor (pParameter?: ParameterBaseEditorNode) {
    super();
    if (pParameter) {
      this.m_pParameter = pParameter;
      this.UpdateCachedParameterData();
    }
  }

  override GetName (): string {
    return (this.m_pParameter != null) ?
      this.m_pParameter.GetName() :
      super.GetName();
  }

  GetReferencedParameter (): ParameterBaseEditorNode {
    return this.m_pParameter;
  }

  GetReferencedParameterID (): NodeGraph.UUID {
    return (this.m_pParameter != null) ?
      this.m_pParameter.GetID() :
      this.m_parameterUUID;
  }

  GetReferencedParameterName (): string {
    return (this.m_pParameter != null) ?
      this.m_pParameter.GetName() :
      this.m_parameterName;
  }

  GetReferencedParameterValueType (): GraphValueType {
    return (this.m_pParameter != null) ?
      this.m_pParameter.GetOutputValueType() :
      this.m_parameterValueType;
  }

  GetReferencedParameterGroup (): string {
    return (this.m_pParameter != null) ?
      this.m_pParameter.GetParameterGroup() :
      this.m_parameterGroup;
  }

  IsReferencingControlParameter (): boolean {
    return this.m_pParameter instanceof ControlParameterEditorNode;
  }

  GetReferencedControlParameter (): ControlParameterEditorNode {
    return this.m_pParameter as ControlParameterEditorNode;
  }

  override GetTypeName (): string { return 'Parameter'; }
  override GetCategory (): string { return 'Parameter'; }
  override IsUserCreatable (): boolean { return true; }
  override IsDestroyable (): boolean { return true; }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true], [GraphType.ValueTree, true], [GraphType.TransitionConduit, true]]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    return this.m_pParameter.Compile(context);
  }

  protected UpdateCachedParameterData (): void {
    this.m_parameterUUID = this.m_pParameter.GetID();
    this.m_parameterValueType = this.m_pParameter.GetOutputValueType();
    this.m_parameterName = this.m_pParameter.GetParameterName();
    this.m_parameterGroup = this.m_pParameter.GetParameterGroup();
  }

  protected GetDisplayValueNode (): AnimationGraphNode | null {
    if (this.IsReferencingControlParameter()) {
      return this.m_pParameter;
    } else {
      const resultNodes = this.m_pParameter.GetChildGraph()!.FindAllNodesOfType<ResultEditorNode>(
        ResultEditorNode,
        [],
        NodeGraph.SearchMode.Localized,
        NodeGraph.SearchTypeMatch.Derived
      );
      const pConnectedNode = resultNodes[0].GetConnectedInputNode<AnimationGraphNode>(0);

      if (pConnectedNode != null) {
        const pConnectedParameterReference = pConnectedNode;

        if (pConnectedParameterReference instanceof ParameterReferenceEditorNode) {
          return pConnectedParameterReference.GetDisplayValueNode();
        } else {
          return pConnectedNode;
        }
      }
    }

    return null;
  }

  override PreCopy (): void {
    this.UpdateCachedParameterData();
  }
}

export class BoolParameterReferenceEditorNode extends ParameterReferenceEditorNode {
  constructor ();
  constructor (pParameter: ParameterBaseEditorNode);
  constructor (pParameter?: ParameterBaseEditorNode) {
    super(pParameter!);
    this.CreateOutputPin('Value', GraphValueType.Bool, true);
  }
}

export class FloatParameterReferenceEditorNode extends ParameterReferenceEditorNode {
  constructor ();
  constructor (pParameter: ParameterBaseEditorNode);
  constructor (pParameter?: ParameterBaseEditorNode) {
    super(pParameter!);
    this.CreateOutputPin('Value', GraphValueType.Float, true);
  }
}
