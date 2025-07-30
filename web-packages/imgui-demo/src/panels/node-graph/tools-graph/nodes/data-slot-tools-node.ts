import { ImGui } from '../../../../imgui/index';
import type { ToolsGraphUserContext } from '../tools-graph-user-context';
import { FlowToolsNode } from './flow-tools-node';
import type * as NodeGraph from '../../visual-graph';

// export class OverrideValue implements IReflectedType {
//   private static readonly s_pTypeInfo = Reflect.getTypeInfo(OverrideValue);

//   @Reflect({ readOnly: true })
//   m_variationID: StringID;

//   @Reflect({ readOnly: true })
//   m_resourceID: ResourceID;
// }

export abstract class DataSlotToolsNode extends FlowToolsNode {
  m_defaultResourceID: string;

  //   protected m_overrides: OverrideValue[] = [];

  constructor () {
    super();
    this.Rename(this.GetDefaultSlotName());
  }

  override IsRenameable (): boolean {
    return true;
  }

  override RequiresUniqueName (): boolean {
    return true;
  }

  override DrawExtraControls (ctx: NodeGraph.DrawContext, pUserContext: NodeGraph.UserContext): void {
    const pGraphNodeContext = pUserContext as ToolsGraphUserContext;

    this.DrawInternalSeparator(ctx);

    //-------------------------------------------------------------------------

    // const resourceID = this.GetResolvedResourceID(
    //   pGraphNodeContext.m_pVariationHierarchy,
    //   pGraphNodeContext.m_selectedVariationID
    // );

    // if (resourceID.IsValid()) {
    //   ImGui.Text(`${EE_ICON_CUBE} ${resourceID.toString().substring(7)}`);
    // } else {
    //   ImGui.Text(`${EE_ICON_CUBE_OUTLINE} Empty Slot!`);
    // }

    ImGui.SetCursorPosY(ImGui.GetCursorPosY() + ImGui.GetStyle().ItemSpacing.y);

    //-------------------------------------------------------------------------

    super.DrawExtraControls(ctx, pUserContext);
  }

  protected GetDefaultSlotName (): string {
    return 'Slot';
  }

  //   protected GetSlotResourceTypeID (): ResourceTypeID {
  //     return new ResourceTypeID();
  //   }

  //   IsDragAndDropTargetForResourceType (typeID: ResourceTypeID): boolean {
  //     return this.GetSlotResourceTypeID().equals(typeID);
  //   }

  //   GetResolvedResourceID (variationHierarchy: VariationHierarchy, variationID: StringID): ResourceID {
  //     EE_ASSERT(variationHierarchy.IsValidVariation(variationID));

  //     if (variationID.equals(Variation.s_defaultVariationID)) {
  //       return this.m_defaultResourceID;
  //     }

  //     //-------------------------------------------------------------------------

  //     let resourceID: ResourceID;

  //     const TryGetResourceID = (varID: StringID): boolean => {
  //       if (varID.equals(Variation.s_defaultVariationID)) {
  //         resourceID = this.m_defaultResourceID;

  //         return true;
  //       }

  //       for (const variation of this.m_overrides) {
  //         if (variation.m_variationID.equals(varID)) {
  //           resourceID = variation.m_resourceID;

  //           return true;
  //         }
  //       }

  //       return false;
  //     };

  //     //-------------------------------------------------------------------------

  //     // Try get the resource ID for this variation
  //     if (TryGetResourceID(variationID)) {
  //       return resourceID!;
  //     }

  //     // Go up the hierarchy and return the first if a override exists
  //     let parentVariationID = variationHierarchy.GetParentVariationID(variationID);

  //     while (parentVariationID.IsValid()) {
  //       if (TryGetResourceID(parentVariationID)) {
  //         break;
  //       }

  //       parentVariationID = variationHierarchy.GetParentVariationID(parentVariationID);
  //     }

  //     return resourceID!;
  //   }

  //   SetVariationResourceID (resourceID: ResourceID, variationID: StringID = Variation.s_defaultVariationID): void {
  //     EE_ASSERT(variationID.IsValid());
  //     EE_ASSERT(!resourceID.IsValid() || resourceID.GetResourceTypeID().equals(this.GetSlotResourceTypeID()));

  //     if (variationID.equals(Variation.s_defaultVariationID)) {
  //       const snm = new NodeGraph.ScopedNodeModification(this);

  //       this.m_defaultResourceID = resourceID;
  //     } else {
  //       EE_ASSERT(this.HasVariationOverride(variationID));

  //       for (const variation of this.m_overrides) {
  //         if (variation.m_variationID.equals(variationID)) {
  //           const snm = new NodeGraph.ScopedNodeModification(this);

  //           variation.m_resourceID = resourceID;

  //           return;
  //         }
  //       }
  //     }
  //   }

  //   GetVariationResourceID (variationID: StringID): ResourceID | null {
  //     EE_ASSERT(variationID.IsValid());

  //     if (variationID.equals(Variation.s_defaultVariationID)) {
  //       return this.m_defaultResourceID;
  //     } else {
  //       for (const variation of this.m_overrides) {
  //         if (variation.m_variationID.equals(variationID)) {
  //           return variation.m_resourceID;
  //         }
  //       }
  //     }

  //     return null;
  //   }

  //   HasVariationOverride (variationID: StringID): boolean {
  //     EE_ASSERT(!variationID.equals(Variation.s_defaultVariationID));

  //     for (const variation of this.m_overrides) {
  //       if (variation.m_variationID.equals(variationID)) {
  //         return true;
  //       }
  //     }

  //     return false;
  //   }

  //   CreateVariationOverride (variationID: StringID): void {
  //     EE_ASSERT(variationID.IsValid() && !variationID.equals(Variation.s_defaultVariationID));
  //     EE_ASSERT(!this.HasVariationOverride(variationID));

  //     const snm = new NodeGraph.ScopedNodeModification(this);

  //     const createdOverride = new OverrideValue();

  //     createdOverride.m_variationID = variationID;
  //     this.m_overrides.push(createdOverride);
  //   }

  //   RenameVariationOverride (oldVariationID: StringID, newVariationID: StringID): void {
  //     EE_ASSERT(oldVariationID.IsValid() && newVariationID.IsValid());
  //     EE_ASSERT(
  //       !oldVariationID.equals(Variation.s_defaultVariationID) &&
  //             !newVariationID.equals(Variation.s_defaultVariationID)
  //     );

  //     const snm = new NodeGraph.ScopedNodeModification(this);

  //     for (const overrideValue of this.m_overrides) {
  //       if (overrideValue.m_variationID.equals(oldVariationID)) {
  //         overrideValue.m_variationID = newVariationID;
  //       }
  //     }
  //   }

  //   RemoveVariationOverride (variationID: StringID): void {

  //     const snm = new NodeGraph.ScopedNodeModification(this);

  //     const index = this.m_overrides.findIndex(v => v.m_variationID.equals(variationID));

  //     if (index !== -1) {
  //       this.m_overrides.splice(index, 1);

  //       return;
  //     }

//   }
}