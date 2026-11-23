import type { StateMachineEditorNode } from './nodes/state-machine-editor-node';

type StateMachineNodeType = new () => StateMachineEditorNode;
let nodeType: StateMachineNodeType | undefined;

export function registerStateMachineNodeType (type: StateMachineNodeType): void { nodeType = type; }
export function getStateMachineNodeType (): StateMachineNodeType {
  if (!nodeType) { throw new Error('The state machine node type has not been registered.'); }

  return nodeType;
}
