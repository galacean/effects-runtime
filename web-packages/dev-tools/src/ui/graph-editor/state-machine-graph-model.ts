import { ImGui } from '../../platform/imgui/index';
import { CommentGraphNode } from './comment-graph-node';
import type { DrawContext } from './graph-draw-context';
import type { GraphEditorContext } from './graph-editor-context';
import { GraphModel, GraphNode, NodeVisualState } from './graph-model';
import { GraphStyle } from './graph-style';
import type { ImVec2 } from './im-rect';

type Color = ImGui.Color;
const Color = ImGui.Color;

import type { UUID } from './graph-types';

export class StateMachineGraphNode extends GraphNode {
  override GetTypeName (): string {
    return 'StateMachineNode';
  }
  DrawContextMenuOptions (ctx: DrawContext, pUserContext: GraphEditorContext, mouseCanvasPos: ImVec2): void {}
}

export class StateGraphNode extends StateMachineGraphNode {
}

export class TransitionGraphNode extends StateMachineGraphNode {
  m_transitionProgress: number = 0;
  m_startStateID: UUID;
  m_endStateID: UUID;

  constructor (pStartState: StateGraphNode, pEndState: StateGraphNode) {
    super();
    this.m_startStateID = pStartState.GetID();
    this.m_endStateID = pEndState.GetID();
  }

  HasTransitions (): boolean {
    return false;
  }

  GetStartStateID (): UUID {
    return this.m_startStateID;
  }

  GetEndStateID (): UUID {
    return this.m_endStateID;
  }

  GetConduitColor (ctx: DrawContext, pUserContext: GraphEditorContext, visualState: Map<NodeVisualState, boolean>): Color {
    if (visualState.get(NodeVisualState.Active)) {
      return GraphStyle.s_connectionColorActive;
    } else if (visualState.get(NodeVisualState.Hovered)) {
      return GraphStyle.s_connectionColorHovered;
    } else if (visualState.get(NodeVisualState.Selected)) {
      return GraphStyle.s_connectionColorSelected;
    } else {
      return GraphStyle.s_connectionColor;
    }
  }

  override DrawExtraControls (ctx: DrawContext, pUserContext: GraphEditorContext, startPoint?: ImVec2, endPoint?: ImVec2): void {}
}

export abstract class StateMachineGraphModel extends GraphModel {
  private m_entryStateID: UUID;

  GetDefaultEntryStateID (): UUID {
    return this.m_entryStateID;
  }

  SetDefaultEntryState (newDefaultEntryStateID: UUID): void {
    if (this.FindNode(newDefaultEntryStateID) === null) {
      throw new Error('Invalid entry state ID');
    }
    this.BeginModification();
    this.m_entryStateID = newDefaultEntryStateID;
    this.EndModification();
  }

  DoesTransitionConduitExist (pStartState: StateGraphNode, pEndState: StateGraphNode): boolean {
    if (!pStartState || !pEndState || pStartState === pEndState) {
      throw new Error('Invalid state nodes');
    }

    const conduits: TransitionGraphNode[] = [];

    this.FindAllNodesOfType<TransitionGraphNode>(TransitionGraphNode, conduits);

    return conduits.some(conduit =>
      conduit.GetStartStateID() === pStartState.GetID() &&
            conduit.GetEndStateID() === pEndState.GetID()
    );
  }

  CanCreateTransitionConduit (pStartState: StateGraphNode, pEndState: StateGraphNode): boolean {
    if (!pStartState || !pEndState) {
      throw new Error('Invalid state nodes');
    }

    if (pStartState === pEndState) {
      return false;
    }

    return !this.DoesTransitionConduitExist(pStartState, pEndState);
  }

  abstract CreateTransitionConduit (pStartState: StateGraphNode, pEndState: StateGraphNode): TransitionGraphNode;

  protected override PostDeserialize (): void {
    super.PostDeserialize();

    if (this.FindNode(this.m_entryStateID) === null) {
      this.UpdateEntryState();
    }
  }

  override GetMostSignificantNode (): GraphNode | null {
    return this.FindNode(this.m_entryStateID);
  }

  protected UpdateEntryState (): void {
    this.m_entryStateID = '';

    for (const node of this.m_nodes) {
      if (node instanceof StateGraphNode) {
        this.m_entryStateID = node.GetID();

        break;
      }
    }
  }

  override RegenerateIDs (IDMapping: Map<UUID, UUID>): UUID {
    const originalID = super.RegenerateIDs(IDMapping);

    for (const node of this.m_nodes) {
      if (node instanceof TransitionGraphNode) {
        node.m_startStateID = IDMapping.get(node.m_startStateID) || node.m_startStateID;
        node.m_endStateID = IDMapping.get(node.m_endStateID) || node.m_endStateID;
      }
    }

    this.m_entryStateID = IDMapping.get(this.m_entryStateID) || this.m_entryStateID;

    return originalID;
  }

  // Source Code :
  //   protected override CanCreateNode (pNodeTypeInfo: TypeInfo): boolean {
  //     return pNodeTypeInfo.IsDerivedFrom(CommentNode.GetStaticTypeID()) ||
  //                pNodeTypeInfo.IsDerivedFrom(StateMachineNode.GetStaticTypeID());
  //   }

  override CanCreateNode<T extends GraphNode>(classConstructor: new (...args: any[]) => T): boolean {
    return this.isSubclassOf(classConstructor, CommentGraphNode) || this.isSubclassOf(classConstructor, StateMachineGraphNode);
  }

  protected override PreDestroyNode (pNodeAboutToBeDestroyed: GraphNode): void {
    if (pNodeAboutToBeDestroyed instanceof StateGraphNode) {
      const transitions: TransitionGraphNode[] = [];

      this.FindAllNodesOfType(TransitionGraphNode, transitions);

      for (const pTransition of transitions) {
        if (pTransition.GetStartStateID() === pNodeAboutToBeDestroyed.GetID() ||
                    pTransition.GetEndStateID() === pNodeAboutToBeDestroyed.GetID()) {
          this.DestroyNode(pTransition.GetID());
        }
      }
    }

    super.PreDestroyNode(pNodeAboutToBeDestroyed);
  }

  protected override PostDestroyNode (nodeID: UUID): void {
    if (this.m_entryStateID === nodeID) {
      this.UpdateEntryState();
    }

    super.PostDestroyNode(nodeID);
  }

  DrawContextMenuOptions (ctx: DrawContext, pUserContext: GraphEditorContext, mouseCanvasPos: ImVec2, filterTokens: string[]): boolean {
    return false;
  }

  HasContextMenuFilter (): boolean {
    return true;
  }
}
