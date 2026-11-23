import { TransitionConduitEditorNode, TransitionEditorNode } from '../nodes/transition-editor-node';

import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { GraphViewGeometry } from '../../../../ui/graph-editor/graph-view-geometry';
import type { GraphEditorContext } from '../../../../ui/graph-editor/graph-editor-context';
import type { UUID } from '../../../../ui/graph-editor/index';
import * as NodeGraph from '../../../../ui/graph-editor/index';
import { StateEditorNode } from '../nodes/state-editor-node';

export class EntryStateOverrideConduitEditorNode extends NodeGraph.StateMachineGraphNode {
  override GetTypeName (): string {
    return 'Entry Overrides';
  }
  private stateOverrides: Map<UUID, boolean> = new Map();

  UpdateConditionsNode (): void {
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

export class GlobalTransitionConduitEditorNode extends NodeGraph.StateMachineGraphNode {
  override GetTypeName (): string {
    return 'Global Transitions';
  }
  private globalTransitions: Map<UUID, boolean> = new Map();

  UpdateTransitionNodes (): void {
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
    const conduit = this.CreateNode(TransitionConduitEditorNode, startState, endState);

    conduit.GetSecondaryGraph()!.CreateNode(TransitionEditorNode);

    return conduit;
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
    this.GetEntryStateOverrideConduit()?.UpdateConditionsNode();
    this.GetGlobalTransitionConduit()?.UpdateTransitionNodes();
  }

  override RegenerateIDs (idMapping: Map<UUID, UUID>): UUID {
    const originalID = super.RegenerateIDs(idMapping);

    this.GetEntryStateOverrideConduit()?.UpdateStateMapping(idMapping);
    this.GetGlobalTransitionConduit()?.UpdateStateMapping(idMapping);

    return originalID;
  }
}
