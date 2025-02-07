
import * as NodeGraph from '../../visual-graph';
import type { UUID } from '../../visual-graph';
import type { DrawContext } from '../../visual-graph/drawing-context';
import type { UserContext } from '../../visual-graph/user-context';
import { Colors } from '../colors';
import { StateToolsNode } from '../nodes/state-tools-node';
import { ImGui } from '../../../../imgui/index';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

// TODO test class
export class EntryStateOverrideConduitToolsNode extends NodeGraph.BaseNode {
  override GetTypeName (): string {
    throw new Error('Method not implemented.');
  }
  private stateOverrides: Map<UUID, boolean> = new Map();

  UpdateConditionsNode (): void {
    // Implementation for updating condition nodes
  }

  UpdateStateMapping (idMapping: Map<UUID, UUID>): void {
    const newStateOverrides = new Map<UUID, boolean>();

    this.stateOverrides.forEach((value, key) => {
      const newKey = idMapping.get(key) || key;

      newStateOverrides.set(newKey, value);
    });
    this.stateOverrides = newStateOverrides;
  }

  HasEntryOverrideForState (stateId: UUID): boolean {
    return this.stateOverrides.get(stateId) || false;
  }
}

// TODO test class
export class GlobalTransitionConduitToolsNode extends NodeGraph.BaseNode {
  override GetTypeName (): string {
    throw new Error('Method not implemented.');
  }
  private globalTransitions: Map<UUID, boolean> = new Map();

  UpdateTransitionNodes (): void {
    // Implementation for updating transition nodes
  }

  UpdateStateMapping (idMapping: Map<UUID, UUID>): void {
    const newTransitions = new Map<UUID, boolean>();

    this.globalTransitions.forEach((value, key) => {
      const newKey = idMapping.get(key) || key;

      newTransitions.set(newKey, value);
    });
    this.globalTransitions = newTransitions;
  }

  HasGlobalTransitionForState (stateId: UUID): boolean {
    return this.globalTransitions.get(stateId) || false;
  }
}

export class StateMachineGraph extends NodeGraph.StateMachineGraph {

  GetEntryStateOverrideConduit (): EntryStateOverrideConduitToolsNode {
    const foundNodes: EntryStateOverrideConduitToolsNode[] = [];

    this.FindAllNodesOfType(
      EntryStateOverrideConduitToolsNode,
      foundNodes,
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Exact
    );

    return foundNodes[0];
  }

  GetGlobalTransitionConduit (): GlobalTransitionConduitToolsNode {
    const foundNodes: GlobalTransitionConduitToolsNode[] = [];

    this.FindAllNodesOfType<GlobalTransitionConduitToolsNode>(
      GlobalTransitionConduitToolsNode,
      foundNodes,
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Exact
    );

    return foundNodes[0];
  }

  CreateTransitionConduit (
    startState: NodeGraph.StateNode,
    endState: NodeGraph.StateNode
  ): NodeGraph.TransitionConduitNode {
    return this.CreateNode(NodeGraph.TransitionConduitNode, startState, endState);
  }

  override CanDestroyNode (node: NodeGraph.BaseNode): boolean {
    if (node instanceof StateToolsNode) {
      const stateNodes: StateToolsNode[] = [];

      this.FindAllNodesOfType(
        StateToolsNode,
        stateNodes,
        NodeGraph.SearchMode.Localized,
        NodeGraph.SearchTypeMatch.Derived
      );

      return stateNodes.length > 1;
    }

    return true;
  }

  UpdateDependentNodes (): void {
    this.GetEntryStateOverrideConduit().UpdateConditionsNode();
    this.GetGlobalTransitionConduit().UpdateTransitionNodes();
  }

  override RegenerateIDs (idMapping: Map<UUID, UUID>): UUID {
    // Implementation for ID regeneration
    const originalID = super.RegenerateIDs(idMapping);

    this.GetEntryStateOverrideConduit().UpdateStateMapping(idMapping);
    this.GetGlobalTransitionConduit().UpdateStateMapping(idMapping);

    return originalID;
  }

  override DrawExtraInformation (ctx: DrawContext, userContext: UserContext): void {
    const scaledIconOffset = ctx.CanvasToWindow(4.0);

    const stateNodes: StateToolsNode[] = [];

    this.FindAllNodesOfType<StateToolsNode>(
      StateToolsNode,
      stateNodes,
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Derived
    );

    stateNodes.forEach(stateNode => {
      const nodeRect = ctx.CanvasToWindowRect(stateNode.GetRect());
      const iconSize = new ImVec2(20, 20); // Example size, should match your actual icon size
      const iconOffset = new ImVec2(0, iconSize.y + scaledIconOffset);

      // Draw entry override marker
      if (this.GetDefaultEntryStateID() === stateNode.GetID()) {
        ctx.m_pDrawList!.AddText(
          new ImVec2(
            nodeRect.Min.x + ctx.m_windowRect.Min.x - iconOffset.x,
            nodeRect.Min.y + ctx.m_windowRect.Min.y - iconOffset.y
          ),
          Colors.Gold,
          //Icons.STAR
          '\xf3\xb0\x93\x8e'
        );
        iconOffset.x -= iconSize.x + scaledIconOffset;
      }

      // // Draw entry override marker
      // const entryOverrideConduit = this.GetEntryStateOverrideConduit();

      // if (entryOverrideConduit.HasEntryOverrideForState(stateNode.GetID())) {
      //   ctx.m_pDrawList!.AddText(
      //     new ImVec2(
      //       nodeRect.Min.x + ctx.m_windowRect.Min.x - iconOffset.x,
      //       nodeRect.Min.y + ctx.m_windowRect.Min.y - iconOffset.y
      //     ),
      //     Colors.LimeGreen,
      //     //   Icons.ARROW_DOWN_CIRCLE
      //     '\xf3\xb0\xb3\x9b'
      //   );
      //   iconOffset.x -= iconSize.x + scaledIconOffset;
      // }

      // // Draw global transition marker
      // const globalTransitionConduit = this.GetGlobalTransitionConduit();

      // if (globalTransitionConduit.HasGlobalTransitionForState(stateNode.GetID())) {
      //   ctx.m_pDrawList!.AddText(
      //     new ImVec2(
      //       nodeRect.Min.x + ctx.m_windowRect.Min.x - iconOffset.x,
      //       nodeRect.Min.y + ctx.m_windowRect.Min.y - iconOffset.y
      //     ),
      //     Colors.OrangeRed,
      //     //   Icons.LIGHTNING_BOLT_CIRCLE
      //     '\xf3\xb0\xa0\xa0'
      //   );
      // }
    });
  }
}
