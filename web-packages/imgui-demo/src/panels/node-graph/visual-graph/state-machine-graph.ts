import { ImGui } from '../../../imgui/index';
import { BaseGraph, BaseNode, NodeVisualState } from './base-graph';
import { CommentNode } from './comment-node';
import type { DrawContext } from './drawing-context';
import type { ImVec2 } from './im-rect';
import { Style } from './node-graph-view';
import type { UserContext } from './user-context';

type Color = ImGui.Color;
const Color = ImGui.Color;

export type UUID = string;

export class StateMachineNode extends BaseNode {
  override GetTypeName (): string {
    return 'StateMachineNode';
  }
  protected DrawContextMenuOptions (ctx: DrawContext, pUserContext: UserContext, mouseCanvasPos: ImVec2): void {}
}

export class StateNode extends StateMachineNode {
}

export class TransitionConduitNode extends StateMachineNode {
  m_transitionProgress: number = 0;
  m_startStateID: UUID;
  m_endStateID: UUID;

  constructor (pStartState: StateNode, pEndState: StateNode) {
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

  GetConduitColor (ctx: DrawContext, pUserContext: UserContext, visualState: Map<NodeVisualState, boolean>): Color {
    if (visualState.get(NodeVisualState.Active)) {
      return Style.s_connectionColorActive;
    } else if (visualState.get(NodeVisualState.Hovered)) {
      return Style.s_connectionColorHovered;
    } else if (visualState.get(NodeVisualState.Selected)) {
      return Style.s_connectionColorSelected;
    } else {
      return Style.s_connectionColor;
    }
  }

  override DrawExtraControls (ctx: DrawContext, pUserContext: UserContext, startPoint?: ImVec2, endPoint?: ImVec2): void {}
}

export abstract class StateMachineGraph extends BaseGraph {
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

  DoesTransitionConduitExist (pStartState: StateNode, pEndState: StateNode): boolean {
    if (!pStartState || !pEndState || pStartState === pEndState) {
      throw new Error('Invalid state nodes');
    }

    const conduits: TransitionConduitNode[] = [];

    this.FindAllNodesOfType<TransitionConduitNode>(TransitionConduitNode, conduits);

    return conduits.some(conduit =>
      conduit.GetStartStateID() === pStartState.GetID() &&
            conduit.GetEndStateID() === pEndState.GetID()
    );
  }

  CanCreateTransitionConduit (pStartState: StateNode, pEndState: StateNode): boolean {
    if (!pStartState || !pEndState) {
      throw new Error('Invalid state nodes');
    }

    if (pStartState === pEndState) {
      return false;
    }

    return !this.DoesTransitionConduitExist(pStartState, pEndState);
  }

  abstract CreateTransitionConduit (pStartState: StateNode, pEndState: StateNode): TransitionConduitNode;

  protected override PostDeserialize (): void {
    super.PostDeserialize();

    if (this.FindNode(this.m_entryStateID) === null) {
      this.UpdateEntryState();
    }
  }

  override GetMostSignificantNode (): BaseNode | null {
    return this.FindNode(this.m_entryStateID);
  }

  protected UpdateEntryState (): void {
    this.m_entryStateID = '';

    for (const node of this.m_nodes) {
      if (node instanceof StateNode) {
        this.m_entryStateID = node.GetID();

        break;
      }
    }
  }

  override RegenerateIDs (IDMapping: Map<UUID, UUID>): UUID {
    const originalID = super.RegenerateIDs(IDMapping);

    for (const node of this.m_nodes) {
      if (node instanceof TransitionConduitNode) {
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

  override CanCreateNode<T extends BaseNode>(classConstructor: new (...args: any[]) => T): boolean {
    return this.isSubclassOf(classConstructor, CommentNode) || this.isSubclassOf(classConstructor, StateMachineNode);
  }

  protected override PreDestroyNode (pNodeAboutToBeDestroyed: BaseNode): void {
    if (pNodeAboutToBeDestroyed instanceof StateNode) {
      const transitions: TransitionConduitNode[] = [];

      this.FindAllNodesOfType(TransitionConduitNode, transitions);

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

  protected DrawContextMenuOptions (ctx: DrawContext, pUserContext: UserContext, mouseCanvasPos: ImVec2, filterTokens: string[]): boolean {
    return false;
  }

  protected HasContextMenuFilter (): boolean {
    return true;
  }
}
