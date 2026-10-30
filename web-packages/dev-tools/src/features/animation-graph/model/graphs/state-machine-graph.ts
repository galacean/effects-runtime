
import { ImGui } from '../../../../platform/imgui/index';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { DrawContext } from '../../../../ui/graph-editor/graph-draw-context';
import type { GraphEditorContext } from '../../../../ui/graph-editor/graph-editor-context';
import type { UUID } from '../../../../ui/graph-editor/index';
import * as NodeGraph from '../../../../ui/graph-editor/index';
import { StateEditorNode } from '../nodes/state-editor-node';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

// TODO test class
export class EntryStateOverrideConduitEditorNode extends NodeGraph.StateMachineGraphNode {
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
  // GetEntryConditionNodeForState (arg0: string) {
  //   throw new Error('Method not implemented.');
  // }
  override GetTypeName (): string {
    return 'Entry Overrides';
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
export class GlobalTransitionConduitEditorNode extends NodeGraph.StateMachineGraphNode {
  override GetTypeName (): string {
    return 'Global Transitions';
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

export class AnimationStateGraph extends NodeGraph.StateMachineGraphModel {

  GetEntryStateOverrideConduit (): EntryStateOverrideConduitEditorNode {
    const foundNodes: EntryStateOverrideConduitEditorNode[] = [];

    this.FindAllNodesOfType(
      EntryStateOverrideConduitEditorNode,
      foundNodes,
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Exact
    );

    return foundNodes[0];
  }

  GetGlobalTransitionConduit (): GlobalTransitionConduitEditorNode {
    const foundNodes: GlobalTransitionConduitEditorNode[] = [];

    this.FindAllNodesOfType<GlobalTransitionConduitEditorNode>(
      GlobalTransitionConduitEditorNode,
      foundNodes,
      NodeGraph.SearchMode.Localized,
      NodeGraph.SearchTypeMatch.Exact
    );

    return foundNodes[0];
  }

  CreateTransitionConduit (
    startState: NodeGraph.StateGraphNode,
    endState: NodeGraph.StateGraphNode
  ): NodeGraph.TransitionGraphNode {
    return this.CreateNode(NodeGraph.TransitionGraphNode, startState, endState);
  }

  override CanDestroyNode (node: NodeGraph.GraphNode): boolean {
    if (node instanceof StateEditorNode) {
      const stateNodes: StateEditorNode[] = [];

      this.FindAllNodesOfType(
        StateEditorNode,
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

  override DrawExtraInformation (ctx: DrawContext, userContext: GraphEditorContext): void {
    const scaledIconOffset = ctx.CanvasToWindow(4.0);

    const stateNodes: StateEditorNode[] = [];

    this.FindAllNodesOfType<StateEditorNode>(
      StateEditorNode,
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
          GraphColors.Gold,
          //Icons.STAR
          '*'
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
