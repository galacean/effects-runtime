import { ImGui } from '../../../../imgui/index';
import type { GraphCompilationContext } from '../../compilation';
import { FlowToolsNode, GraphValueType, GraphType } from './flow-tools-node';
import type * as NodeGraph from '../../visual-graph';
import type { Spec } from '@galacean/effects';

export class ConstBoolToolsNode extends FlowToolsNode {
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

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<Spec.ConstBoolNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      pDefinition.value = this.m_value;
    }

    return pDefinition.index;
  }

  override DrawExtraControls (ctx: NodeGraph.DrawContext, pUserContext: NodeGraph.UserContext): void {
    this.BeginDrawInternalRegion(ctx);
    ImGui.Text(this.m_value ? 'True' : 'False');
    this.EndDrawInternalRegion(ctx);
  }
}

// export class ConstIDToolsNode extends FlowToolsNode {
//   private m_value: string;

//   constructor () {
//     super();
//     this.CreateOutputPin('Value', GraphValueType.ID, true);
//   }

//   override GetTypeName (): string { return 'ID'; }
//   override GetCategory (): string { return 'Values/ID'; }
//   GetAllowedParentGraphTypes (): TBitFlags<GraphType> {
//     return new TBitFlags<GraphType>(GraphType.BlendTree, GraphType.ValueTree, GraphType.TransitionConduit);
//   }

//   override Compile (context: GraphCompilationContext): number {
//     const pDefinition = null;

//     if (context.GetDefinition<ConstIDNode>(this, pDefinition) === NodeCompilationState.NeedCompilation) {
//       pDefinition.m_value = this.m_value;
//     }

//     return pDefinition.m_nodeIdx;
//   }

//   override DrawExtraControls (ctx: NodeGraph.DrawContext, pUserContext: NodeGraph.UserContext): void {
//     this.BeginDrawInternalRegion(ctx);
//     ImGui.Text(this.m_value.IsValid() ? this.m_value.c_str() : '');
//     this.EndDrawInternalRegion(ctx);
//   }

//   override GetLogicAndEventIDs (outIDs: string[]): void {
//     outIDs.push(this.m_value);
//   }

//   override RenameLogicAndEventIDs (oldID: string, newID: string): void {
//     if (this.m_value === oldID) {
//       const snm = new NodeGraph.ScopedNodeModification(this);

//       this.m_value = newID;
//     }
//   }
// }

export class ConstFloatToolsNode extends FlowToolsNode {
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

  override Compile (context: GraphCompilationContext): number {
    const pDefinition = context.getGraphNodeAssetData<Spec.ConstFloatNodeData>(this);

    if (!context.checkNodeCompilationState(pDefinition)) {
      pDefinition.value = this.m_value;
    }

    return pDefinition.index;
  }

  override DrawExtraControls (ctx: NodeGraph.DrawContext, pUserContext: NodeGraph.UserContext): void {
    this.BeginDrawInternalRegion(ctx);
    ImGui.Text(this.m_value.toFixed(3));
    this.EndDrawInternalRegion(ctx);
  }
}

// export class ConstVectorToolsNode extends FlowToolsNode {
//   private m_value: Float3 = Float3.Zero;

//   constructor () {
//     super();
//     this.CreateOutputPin('Value', GraphValueType.Vector, true);
//   }

//   override GetTypeName (): string { return 'Vector'; }
//   override GetCategory (): string { return 'Values/Vector'; }
//   GetAllowedParentGraphTypes (): TBitFlags<GraphType> {
//     return new TBitFlags<GraphType>(GraphType.BlendTree, GraphType.ValueTree, GraphType.TransitionConduit);
//   }

//   override Compile (context: GraphCompilationContext): number {
//     const pDefinition = null;

//     if (context.GetDefinition<ConstVectorNode>(this, pDefinition) === NodeCompilationState.NeedCompilation) {
//       pDefinition.m_value = this.m_value;
//     }

//     return pDefinition.m_nodeIdx;
//   }

//   override DrawExtraControls (ctx: NodeGraph.DrawContext, pUserContext: NodeGraph.UserContext): void {
//     this.BeginDrawInternalRegion(ctx);
//     this.DrawVectorInfoText(ctx, this.m_value);
//     this.EndDrawInternalRegion(ctx);
//   }
// }

// export class ConstTargetToolsNode extends FlowToolsNode {
//   private m_value: Transform;

//   constructor () {
//     super();
//     this.CreateOutputPin('Value', GraphValueType.Target, true);
//   }

//   override GetTypeName (): string { return 'Target'; }
//   override GetCategory (): string { return 'Values/Target'; }
//   GetAllowedParentGraphTypes (): TBitFlags<GraphType> {
//     return new TBitFlags<GraphType>(GraphType.BlendTree, GraphType.ValueTree, GraphType.TransitionConduit);
//   }

//   override Compile (context: GraphCompilationContext): number {
//     const pDefinition = null;

//     if (context.GetDefinition<ConstTargetNode>(this, pDefinition) === NodeCompilationState.NeedCompilation) {
//       pDefinition.m_value = new Target(this.m_value);
//     }

//     return pDefinition.m_nodeIdx;
//   }

//   override DrawExtraControls (ctx: NodeGraph.DrawContext, pUserContext: NodeGraph.UserContext): void {
//     this.BeginDrawInternalRegion(ctx);
//     this.DrawTargetInfoText(ctx, new Target(this.m_value));
//     this.EndDrawInternalRegion(ctx);
//   }
// }

// export class ConstBoneTargetToolsNode extends FlowToolsNode {
//   private m_boneName: string;

//   constructor () {
//     super();
//     this.CreateOutputPin('Value', GraphValueType.Target, true);
//   }

//   override GetTypeName (): string { return 'Target'; }
//   override GetCategory (): string { return 'Values/BoneTarget'; }
//   GetAllowedParentGraphTypes (): TBitFlags<GraphType> {
//     return new TBitFlags<GraphType>(GraphType.BlendTree, GraphType.ValueTree, GraphType.TransitionConduit);
//   }

//   override Compile (context: GraphCompilationContext): number {
//     const pDefinition = null;

//     if (context.GetDefinition<ConstTargetNode>(this, pDefinition) === NodeCompilationState.NeedCompilation) {
//       pDefinition.m_value = new Target(this.m_boneName);
//     }

//     return pDefinition.m_nodeIdx;
//   }

//   override DrawExtraControls (ctx: NodeGraph.DrawContext, pUserContext: NodeGraph.UserContext): void {
//     this.BeginDrawInternalRegion(ctx);
//     this.DrawTargetInfoText(ctx, new Target(this.m_boneName));
//     this.EndDrawInternalRegion(ctx);
//   }
// }