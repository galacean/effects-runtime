import { DrawValueDisplayText, FlowToolsNode, GraphType, GraphValueType, InvalidIndex } from './flow-tools-node';
import * as NodeGraph from '../../visual-graph';
import type { GraphCompilationContext } from '../../compilation';
import type { ControlParameterBoolNodeAssetData, ControlParameterFloatNodeAssetData } from '@galacean/effects';
import { ImGui } from 'web-packages/imgui-demo/src/imgui';
import type { ToolsGraphUserContext } from '../tools-graph-user-context';
import { ResultToolsNode } from './result-tools-node';

export abstract class ParameterBaseToolsNode extends FlowToolsNode {
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
    const snm = new NodeGraph.ScopedNodeModification(this);

    this.m_group = newGroupName;
  }
}

export class ControlParameterToolsNode extends ParameterBaseToolsNode {
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

  override Compile (context: GraphCompilationContext): number {
    switch (this.GetOutputValueType()) {
      case GraphValueType.Bool: {
        const pDefinition: ControlParameterBoolNodeAssetData = context.getGraphNodeAssetData(this);

        pDefinition.value = this.m_value;

        return pDefinition.index;
      }
      case GraphValueType.Float: {
        const pDefinition: ControlParameterFloatNodeAssetData = context.getGraphNodeAssetData(this);

        pDefinition.value = this.m_value;

        return pDefinition.index;
      }
      //   case GraphValueType.ID: {
      //     const pDefinition: GraphNodes.ControlParameterIDNode.Definition = null;

      //     context.GetDefinition<GraphNodes.ControlParameterIDNode>(this, pDefinition);

      //     return pDefinition.m_nodeIdx;
      //   }
      //   case GraphValueType.Vector: {
      //     const pDefinition: GraphNodes.ControlParameterVectorNode.Definition = null;

      //     context.GetDefinition<GraphNodes.ControlParameterVectorNode>(this, pDefinition);

      //     return pDefinition.m_nodeIdx;
      //   }
      //   case GraphValueType.Target: {
      //     const pDefinition: GraphNodes.ControlParameterTargetNode.Definition = null;

      //     context.GetDefinition<GraphNodes.ControlParameterTargetNode>(this, pDefinition);

      //     return pDefinition.m_nodeIdx;
      //   }
      // eslint-disable-next-line padding-line-between-statements
      default:

        return InvalidIndex;
    }
  }

  static Create (
    pRootGraph: NodeGraph.FlowGraph,
    type: GraphValueType,
    name: string,
    groupName: string
  ): ControlParameterToolsNode {

    let pParameter: ControlParameterToolsNode | null = null;

    switch (type) {
      case GraphValueType.Bool:
        pParameter = pRootGraph.CreateNode<BoolControlParameterToolsNode>(
          BoolControlParameterToolsNode,
          name,
          groupName
        );

        break;
        //   case GraphValueType.ID:
        //     pParameter = pRootGraph.CreateNode<IDControlParameterToolsNode>(
        //       name,
        //       groupName
        //     );        //     break;
      case GraphValueType.Float:
        pParameter = pRootGraph.CreateNode<FloatControlParameterToolsNode>(
          FloatControlParameterToolsNode,
          name,
          groupName
        );

        break;
        //   case GraphValueType.Vector:
        //     pParameter = pRootGraph.CreateNode<VectorControlParameterToolsNode>(
        //       name,
        //       groupName
        //     );

        //     break;
        //   case GraphValueType.Target:
        //     pParameter = pRootGraph.CreateNode<TargetControlParameterToolsNode>(
        //       name,
        //       groupName
        //     );

        //     break;
    //   default:
    //     break;
    }
    if (!pParameter) {
      throw new Error(type + ' parameter node not found.');
    }

    return pParameter;
  }

  ReflectPreviewValues (pOtherParameterNode: ControlParameterToolsNode): void {}
}

export class BoolControlParameterToolsNode extends ControlParameterToolsNode {
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

export class FloatControlParameterToolsNode extends ControlParameterToolsNode {
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

export class ParameterReferenceToolsNode extends FlowToolsNode {
  protected m_pParameter: ParameterBaseToolsNode;
  protected m_parameterUUID: NodeGraph.UUID;
  protected m_parameterValueType: GraphValueType;
  protected m_parameterName: string;
  protected m_parameterGroup: string;

  static Create (
    pGraph: NodeGraph.FlowGraph,
    pParameter: ParameterBaseToolsNode
  ): ParameterReferenceToolsNode {

    let pReferenceNode: ParameterReferenceToolsNode | null = null;

    switch (pParameter.GetOutputValueType()) {
      case GraphValueType.Bool:
        pReferenceNode = pGraph.CreateNode<BoolParameterReferenceToolsNode>(BoolParameterReferenceToolsNode, pParameter);

        break; case GraphValueType.ID:
        // pReferenceNode = pGraph.CreateNode<IDParameterReferenceToolsNode>(pParameter);

        break; case GraphValueType.Float:
        pReferenceNode = pGraph.CreateNode<FloatParameterReferenceToolsNode>(BoolParameterReferenceToolsNode, pParameter);

        break; case GraphValueType.Vector:
        // pReferenceNode = pGraph.CreateNode<VectorParameterReferenceToolsNode>(pParameter);

        break; case GraphValueType.Target:
        // pReferenceNode = pGraph.CreateNode<TargetParameterReferenceToolsNode>(pParameter);

        break; case GraphValueType.BoneMask:
        // pReferenceNode = pGraph.CreateNode<BoneMaskParameterReferenceToolsNode>(pParameter);

        break; default:
        break;
    }

    if (!pReferenceNode) {
      throw new Error(pParameter.GetOutputValueType() + ' parameter node not found.');
    }

    return pReferenceNode;
  }

  constructor ();
  constructor (pParameter: ParameterBaseToolsNode);
  constructor (pParameter?: ParameterBaseToolsNode) {
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

  GetReferencedParameter (): ParameterBaseToolsNode {
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
    return this.m_pParameter instanceof ControlParameterToolsNode;
  }

  GetReferencedControlParameter (): ControlParameterToolsNode {
    return this.m_pParameter as ControlParameterToolsNode;
  }

  //   IsReferencingVirtualParameter (): boolean {
  //     return IsOfType<VirtualParameterToolsNode>(this.m_pParameter);
  //   }

  //   GetReferencedVirtualParameter (): VirtualParameterToolsNode {
  //     return TryCast<VirtualParameterToolsNode>(this.m_pParameter);
  //   }

  override GetTypeName (): string { return 'Parameter'; }
  override GetCategory (): string { return 'Parameter'; }
  override IsUserCreatable (): boolean { return true; }
  override IsDestroyable (): boolean { return true; }

  override GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true], [GraphType.ValueTree, true], [GraphType.TransitionConduit, true]]);
  }

  override Compile (context: GraphCompilationContext): number {
    return this.m_pParameter.Compile(context);
  }

  protected UpdateCachedParameterData (): void {
    this.m_parameterUUID = this.m_pParameter.GetID();
    this.m_parameterValueType = this.m_pParameter.GetOutputValueType();
    this.m_parameterName = this.m_pParameter.GetParameterName();
    this.m_parameterGroup = this.m_pParameter.GetParameterGroup();
  }

  protected GetDisplayValueNode (): FlowToolsNode | null {
    if (this.IsReferencingControlParameter()) {
      return this.m_pParameter;
    } else {
      const resultNodes = this.m_pParameter.GetChildGraph()!.FindAllNodesOfType<ResultToolsNode>(
        ResultToolsNode,
        [],
        NodeGraph.SearchMode.Localized,
        NodeGraph.SearchTypeMatch.Derived
      );
      const pConnectedNode = resultNodes[0].GetConnectedInputNode<FlowToolsNode>(0);

      if (pConnectedNode != null) {
        const pConnectedParameterReference = pConnectedNode;

        if (pConnectedParameterReference instanceof ParameterReferenceToolsNode) {
          return pConnectedParameterReference.GetDisplayValueNode();
        } else {
          return pConnectedNode;
        }
      }
    }

    return null;
  }

  override DrawExtraControls (ctx: NodeGraph.DrawContext, pUserContext: NodeGraph.UserContext): void {
    const pGraphNodeContext = pUserContext as ToolsGraphUserContext;

    let runtimeNodeIdx = InvalidIndex;
    const isPreviewing = pGraphNodeContext.HasDebugData();

    if (isPreviewing) {
      const pValueNodeSource = this.GetDisplayValueNode();

      if (pValueNodeSource != null) {
        runtimeNodeIdx = pGraphNodeContext.GetRuntimeGraphNodeIndex(pValueNodeSource.GetID());
      }
    }

    this.BeginDrawInternalRegion(ctx);

    if (isPreviewing && (runtimeNodeIdx != InvalidIndex) && pGraphNodeContext.IsNodeActive(runtimeNodeIdx)) {
      const valueType = this.m_pParameter.GetOutputValueType();

      DrawValueDisplayText(ctx, pGraphNodeContext, runtimeNodeIdx, valueType);
    } else {
      ImGui.NewLine();
    }

    this.EndDrawInternalRegion(ctx);
  }

  //   override GetNavigationTarget (): NodeGraph.BaseGraph | null {
  //     const pVP = this.GetReferencedVirtualParameter();

  //     if (pVP) {
  //       return pVP.GetChildGraph();
  //     }

  //     return null;
  //   }

  protected override PreCopy (): void {
    this.UpdateCachedParameterData();
  }
}

export class BoolParameterReferenceToolsNode extends ParameterReferenceToolsNode {
  constructor ();
  constructor (pParameter: ParameterBaseToolsNode);
  constructor (pParameter?: ParameterBaseToolsNode) {
    super(pParameter!);
    this.CreateOutputPin('Value', GraphValueType.Bool, true);
  }
}

export class FloatParameterReferenceToolsNode extends ParameterReferenceToolsNode {
  constructor ();
  constructor (pParameter: ParameterBaseToolsNode);
  constructor (pParameter?: ParameterBaseToolsNode) {
    super(pParameter!);
    this.CreateOutputPin('Value', GraphValueType.Float, true);
  }
}