import * as NodeGraph from '../../visual-graph';
import { ImGui } from '../../../../imgui/index';
import { AnimationClip } from '@galacean/effects';
import { FlowToolsNode, GraphType } from '../nodes/flow-tools-node';
import type { ToolsGraphUserContext } from '../tools-graph-user-context';
import { CommentNode } from '../../visual-graph/comment-node';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

// 辅助函数
function MatchesFilter (filterTokens: string[], string: string): boolean {
  if (filterTokens.length === 0) {
    return true;
  }

  if (string.length === 0) {
    return false;
  }

  string = string.toLowerCase();
  for (const token of filterTokens) {
    if (!string.includes(token)) {
      return false;
    }
  }

  return true;
}

// function IsNodeTypeValidForSelection (
//   pFlowGraph: FlowGraph,
//   item: CategoryItem<TypeSystem.TypeInfo>,
//   filterTokens: string[] = [],
//   pSourceNode: NodeGraph.FlowNode | null = null,
//   pFilterPin: NodeGraph.Pin | null = null
// ): boolean {
//   // Parameter references are already handled
//   if (item.m_data.IsDerivedFrom(GraphNodes.ParameterReferenceToolsNode.GetStaticTypeID())) {
//     return false;
//   }

//   // Is this a valid node for this graph
//   if (!pFlowGraph.CanCreateNode(item.m_data)) {
//     return false;
//   }

//   const pDefaultNode = Cast<GraphNodes.FlowToolsNode>(item.m_data.m_pDefaultInstance);

//   // Filter based on pin
//   if (pFilterPin !== null) {
//     if (pSourceNode!.IsInputPin(pFilterPin)) {
//       if (!pDefaultNode.HasOutputPin()) {
//         return false;
//       }

//       const pOutputPin = pDefaultNode.GetOutputPin(0);

//       if (pOutputPin.m_type !== pFilterPin.m_type) {
//         return false;
//       }

//       if (!pSourceNode!.IsValidConnection(pFilterPin.m_ID, pDefaultNode, pOutputPin.m_ID)) {
//         return false;
//       }
//     } else { // Check all inputs for matching types
//       let foundValidPin = false;

//       for (const inputPin of pDefaultNode.GetInputPins()) {
//         if (inputPin.m_type === pFilterPin.m_type &&
//                         pDefaultNode.IsValidConnection(inputPin.m_ID, pSourceNode, pFilterPin.m_ID)) {
//           foundValidPin = true;

//           break;
//         }
//       }

//       if (!foundValidPin) {
//         return false;
//       }
//     }
//   }

//   // User text filter
//   if (!MatchesFilter(filterTokens, item.m_name)) {
//     return false;
//   }

//   return true;
// }

// function CollectFilteredNodeTypeItems (
//   pFlowGraph: FlowGraph,
//   filterTokens: string[],
//   pSourceNode: NodeGraph.FlowNode | null,
//   pFilterPin: NodeGraph.Pin | null,
//   category: Category<TypeSystem.TypeInfo>,
//   outItems: CategoryTree<TypeSystem.TypeInfo>
// ): void {
//   for (const childCategory of category.m_childCategories) {
//     CollectFilteredNodeTypeItems(pFlowGraph, filterTokens, pSourceNode, pFilterPin, childCategory, outItems);
//   }

//   const hasUserFilter = filterTokens.length > 0 || pFilterPin !== null;

//   for (const item of category.m_items) {
//     if (!IsNodeTypeValidForSelection(pFlowGraph, item, filterTokens, pSourceNode, pFilterPin)) {
//       continue;
//     }

//     if (hasUserFilter) {
//       outItems.GetRootCategory().AddItem(item);
//     } else {
//       const pDefaultNode = Cast<GraphNodes.FlowToolsNode>(item.m_data.m_pDefaultInstance);

//       outItems.AddItem(pDefaultNode.GetCategory(), pDefaultNode.GetTypeName(), item.m_data);
//     }
//   }
// }

// function DrawCategory (category: Category<TypeSystem.TypeInfo>): TypeSystem.TypeInfo | null {
//   let pNodeTypeToCreate: TypeSystem.TypeInfo | null = null;

//   // Header
//   if (category.m_depth === 0) {
//     ImGui.SeparatorText(category.m_name);
//   } else if (category.m_depth > 0) {
//     if (!ImGui.BeginMenu(category.m_name)) {
//       return pNodeTypeToCreate;
//     }
//   }

//   // Contents
//   for (const childCategory of category.m_childCategories) {
//     const pSelectedNodeToCreate = DrawCategory(childCategory);

//     if (pSelectedNodeToCreate !== null) {
//       pNodeTypeToCreate = pSelectedNodeToCreate;
//     }
//   }

//   if (pNodeTypeToCreate === null) {
//     for (const item of category.m_items) {
//       const pDefaultNode = Cast<GraphNodes.FlowToolsNode>(item.m_data.m_pDefaultInstance);

//       ImGui.PushStyleColor(ImGuiCol.Text, pDefaultNode.GetTitleBarColor());
//       ImGui.Bullet();
//       ImGui.PopStyleColor();

//       ImGui.SameLine();

//       const isMenuItemTriggered = ImGui.MenuItem(item.m_name);

//       if (isMenuItemTriggered || (ImGui.IsItemFocused() && ImGui.IsKeyReleased(ImGuiKey.Enter))) {
//         if (pNodeTypeToCreate === null) {
//           pNodeTypeToCreate = item.m_data;
//         }
//       }
//     }
//   }

//   // Footer
//   if (category.m_depth > 0) {
//     ImGui.EndMenu();
//   }

//   return pNodeTypeToCreate;
// }

// function DrawNodeTypeCategoryContextMenu (
//   pFlowGraph: FlowGraph,
//   mouseCanvasPos: NodeGraph.ImVec2,
//   filterTokens: string[],
//   pSourceNode: NodeGraph.FlowNode | null,
//   pFilterPin: NodeGraph.Pin | null,
//   rootCategory: Category<TypeSystem.TypeInfo>
// ): TypeSystem.TypeInfo | null {
//   EE_ASSERT(pFlowGraph !== null);

//   // Collect all relevant items
//   const contextMenuItems = new CategoryTree<TypeSystem.TypeInfo>();

//   CollectFilteredNodeTypeItems(pFlowGraph, filterTokens, pSourceNode, pFilterPin, rootCategory, contextMenuItems);
//   const rootCategoryToDraw = contextMenuItems.GetRootCategory();

//   // Draw
//   if (filterTokens.length > 0 || pFilterPin !== null) {
//     ImGui.SeparatorText('Filtered Nodes');
//   }

//   if (contextMenuItems.GetRootCategory().IsEmpty()) {
//     ImGui.Text('Nothing Found');
//   }

//   return DrawCategory(contextMenuItems.GetRootCategory());
// }

export class FlowGraph extends NodeGraph.FlowGraph {
  static readonly s_graphParameterPayloadID: string = 'AnimGraphParameterPayload';

  private m_type: GraphType;

  constructor (type: GraphType = GraphType.BlendTree) {
    super();
    this.m_type = type;
  }

  GetType (): GraphType {
    return this.m_type;
  }

  override CanCreateNode<T extends NodeGraph.BaseNode>(classConstructor: new (...args: any[]) => T): boolean {
    if (this.isSubclassOf(classConstructor, CommentNode)) {
      return true;
    }

    if (!this.isSubclassOf(classConstructor, FlowToolsNode)) {
      return false;
    }

    const pFlowNode = new classConstructor() as unknown as FlowToolsNode;

    return pFlowNode.GetAllowedParentGraphTypes().get(this.m_type) ?? false;
  }

  override SupportsNodeCreationFromConnection (): boolean {
    return true;
  }

  // override DrawContextMenuOptions (
  //   ctx: NodeGraph.DrawContext,
  //   pUserContext: NodeGraph.UserContext,
  //   mouseCanvasPos: ImVec2,
  //   filterTokens: string[],
  //   pSourceNode: NodeGraph.FlowNode | null,
  //   pOriginPin: NodeGraph.Pin | null
  // ): boolean {
  //   if (ctx.m_isReadOnly) {
  //     return false;
  //   }

  //   const pToolsGraphContext = pUserContext as ToolsGraphUserContext;
  //   const hasAdvancedFilter = filterTokens.length > 0 || pOriginPin !== null;

  //   // let pNodeTypeToCreate: TypeSystem.TypeInfo | null = null;
  //   let pParameterToReference: GraphNodes.ParameterBaseToolsNode | null = null;

  //   // Parameters
  //   const parameters: GraphNodes.ParameterBaseToolsNode[] = pToolsGraphContext.GetParameters();

  //   // Filter parameters based on origin pin
  //   for (let i = 0; i < parameters.length; i++) {
  //     let excludeParameter = false;

  //     // Filter by name
  //     if (!MatchesFilter(filterTokens, parameters[i].GetName())) {
  //       excludeParameter = true;
  //     }

  //     // Filter by pin type
  //     if (pOriginPin !== null && (
  //       pSourceNode!.IsOutputPin(pOriginPin) ||
  //                   GraphNodes.FlowToolsNode.GetValueTypeForPinType(pOriginPin.m_type) !== parameters[i].GetOutputValueType()
  //     )) {
  //       excludeParameter = true;
  //     }

  //     // Remove parameter from the list
  //     if (excludeParameter) {
  //       parameters.splice(i, 1);
  //       i--;
  //     }
  //   }

  //   // Sort parameters by name
  //   parameters.sort((pA, pB) =>
  //     pA.GetName().toLowerCase().localeCompare(pB.GetName().toLowerCase())
  //   );

  //   // Draw parameter options
  //   if (parameters.length > 0) {
  //     ImGui.SeparatorText('Parameters');

  //     let isUsingSubmenu = false;
  //     let shouldDrawSubMenuItems = hasAdvancedFilter;

  //     if (!hasAdvancedFilter) {
  //       isUsingSubmenu = shouldDrawSubMenuItems = ImGui.BeginMenu('Parameters');
  //     }

  //     if (shouldDrawSubMenuItems) {
  //       if (parameters.length === 0) {
  //         if (isUsingSubmenu) {
  //           ImGui.Text('No Parameters');
  //         }
  //       } else {
  //         for (const pParameter of parameters) {
  //           ImGui.PushStyleColor(ImGuiCol.Text, pParameter.GetTitleBarColor());
  //           ImGui.Text(IsOfType<GraphNodes.ControlParameterToolsNode>(pParameter) ?
  //             EE_ICON_ALPHA_C_BOX : EE_ICON_ALPHA_V_CIRCLE);
  //           ImGui.PopStyleColor();

  //           ImGui.SameLine();

  //           const isMenuItemTriggered = ImGui.MenuItem(pParameter.GetName());

  //           if (isMenuItemTriggered || (ImGui.IsItemFocused() && ImGui.IsKeyReleased(ImGuiKey.Enter))) {
  //             pNodeTypeToCreate = GraphNodes.ParameterReferenceToolsNode.s_pTypeInfo;
  //             pParameterToReference = pParameter;
  //           }
  //         }
  //       }
  //     }

  //     if (isUsingSubmenu) {
  //       ImGui.EndMenu();
  //     }
  //   }

  //   // Draw the node categories
  //   if (pNodeTypeToCreate === null) {
  //     pNodeTypeToCreate = DrawNodeTypeCategoryContextMenu(
  //       this,
  //       mouseCanvasPos,
  //       filterTokens,
  //       pSourceNode,
  //       pOriginPin,
  //       pToolsGraphContext.GetCategorizedNodeTypes()
  //     );
  //   }

  //   // Create a selected node
  //   if (pNodeTypeToCreate !== null) {
  //     const sgm = new NodeGraph.ScopedGraphModification(this);

  //     // Create target node
  //     let pCreatedNode: NodeGraph.FlowNode;

  //     if (pParameterToReference) {
  //       pCreatedNode = GraphNodes.ParameterReferenceToolsNode.Create(this, pParameterToReference);
  //     } else {
  //       pCreatedNode = this.CreateNode(pNodeTypeToCreate);
  //     }

  //     // Set node position
  //     pCreatedNode.SetPosition(mouseCanvasPos);

  //     // Try to auto-connect nodes
  //     if (pSourceNode !== null) {
  //       let pTargetPin: NodeGraph.Pin | null = null;

  //       if (pSourceNode.IsInputPin(pOriginPin)) {
  //         for (const outputPin of pCreatedNode.GetOutputPins()) {
  //           if (outputPin.m_type === pOriginPin!.m_type) {
  //             pTargetPin = outputPin;

  //             break;
  //           }
  //         }

  //         if (pTargetPin !== null) {
  //           this.TryMakeConnection(pCreatedNode, pTargetPin, pSourceNode, pOriginPin);
  //         }
  //       } else { // Output pin
  //         for (const inputPin of pCreatedNode.GetInputPins()) {
  //           if (inputPin.m_type === pOriginPin!.m_type) {
  //             pTargetPin = inputPin;

  //             break;
  //           }
  //         }

  //         if (pTargetPin !== null) {
  //           this.TryMakeConnection(pSourceNode, pOriginPin, pCreatedNode, pTargetPin);
  //         }
  //       }
  //     }

  //     return true;
  //   }

  //   return false;
  // }

  override GetSupportedDragAndDropPayloadIDs (outIDs: string[]): string[] {
    // outIDs.push(DragAndDrop.s_filePayloadID);
    outIDs.push(FlowGraph.s_graphParameterPayloadID);

    return outIDs;
  }

  // override HandleDragAndDrop (
  //   pUserContext: NodeGraph.UserContext,
  //   dragAndDropState: NodeGraph.DragAndDropState
  // ): boolean {
  //   const pToolsGraphContext = pUserContext as ToolsGraphUserContext;

  //   // Handle dropped resources
  //   if (dragAndDropState.m_payloadID === DragAndDrop.s_filePayloadID) {
  //     const resourceID = new ResourceID(dragAndDropState.m_payloadData as string);

  //     if (!resourceID.IsValid()) {
  //       return true;
  //     }

  //     if (resourceID.GetResourceTypeID() === AnimationClip.GetStaticResourceTypeID()) {
  //       const popupID = 'ResourceDropMenu';

  //       if (!ImGui.IsPopupOpen(popupID)) {
  //         ImGui.OpenPopup(popupID);
  //       }

  //       let actionComplete = false;

  //       ImGui.SetNextWindowPos(dragAndDropState.m_mouseScreenPos);
  //       if (ImGui.BeginPopup(popupID)) {
  //         if (ImGui.MenuItem('Drop As Clip')) {
  //           const sgm = new NodeGraph.ScopedGraphModification(this);
  //           const pDataSlotNode = this.CreateNode<GraphNodes.AnimationClipToolsNode>();

  //           pDataSlotNode.SetPosition(dragAndDropState.m_mouseCanvasPos);
  //           pDataSlotNode.Rename(resourceID.GetFilenameWithoutExtension());
  //           pDataSlotNode.SetVariationResourceID(resourceID);
  //           actionComplete = true;
  //           ImGui.CloseCurrentPopup();
  //         }

  //         if (ImGui.MenuItem('Drop As Pose')) {
  //           const sgm = new NodeGraph.ScopedGraphModification(this);
  //           const pDataSlotNode = this.CreateNode<GraphNodes.AnimationPoseToolsNode>();

  //           pDataSlotNode.SetPosition(dragAndDropState.m_mouseCanvasPos);
  //           pDataSlotNode.Rename(resourceID.GetFilenameWithoutExtension());
  //           pDataSlotNode.SetVariationResourceID(resourceID);
  //           actionComplete = true;
  //           ImGui.CloseCurrentPopup();
  //         }

  //         ImGui.EndPopup();
  //       }

  //       return actionComplete;
  //     } else // Handle other resource types
  //     {
  //       const resourceTypeID = resourceID.GetResourceTypeID();

  //       // Try to find a matching slot node type
  //       let pFoundNodeTypeInfo: TypeSystem.TypeInfo | null = null;
  //       const dataSlotTypeInfos = pToolsGraphContext.m_pTypeRegistry.GetAllDerivedTypes(
  //         GraphNodes.DataSlotToolsNode.GetStaticTypeID(),
  //         false,
  //         false,
  //         true
  //       );

  //       for (const pTypeInfo of dataSlotTypeInfos) {
  //         const pDefaultSlotNodeInstance = Cast<GraphNodes.DataSlotToolsNode>(pTypeInfo.m_pDefaultInstance);

  //         if (pDefaultSlotNodeInstance.GetSlotResourceTypeID() === resourceTypeID) {
  //           pFoundNodeTypeInfo = pTypeInfo;

  //           break;
  //         }
  //       }

  //       if (pFoundNodeTypeInfo === null) {
  //         return true;
  //       }

  //       const sgm = new NodeGraph.ScopedGraphModification(this);
  //       const pDataSlotNode = Cast<GraphNodes.DataSlotToolsNode>(
  //         this.CreateNode(pFoundNodeTypeInfo, dragAndDropState.m_mouseCanvasPos)
  //       );

  //       pDataSlotNode.Rename(resourceID.GetFilenameWithoutExtension());
  //       pDataSlotNode.SetVariationResourceID(resourceID);
  //     }
  //   }

  //   // Handle dropped parameters
  //   if (dragAndDropState.m_payloadID === FlowGraph.s_graphParameterPayloadID) {
  //     const pPayloadStr = dragAndDropState.m_payloadData as string;

  //     for (const pControlParameter of pToolsGraphContext.GetParameters()) {
  //       if (pControlParameter.GetParameterName().comparei(pPayloadStr) === 0) {
  //         const sgm = new NodeGraph.ScopedGraphModification(this);
  //         const pNode = GraphNodes.ParameterReferenceToolsNode.Create(this, pControlParameter);

  //         pNode.SetPosition(dragAndDropState.m_mouseCanvasPos);

  //         break;
  //       }
  //     }
  //   }

  //   return true;
  // }
}