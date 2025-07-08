import type { GraphNodeData } from '..';
import type { Constructor } from '../../utils';

const nodeDataClassStore: Record<string, any> = {};

export function nodeDataClass (className: string) {
  return (target: Object, context?: unknown) => {
    if (nodeDataClassStore[className]) {
      console.warn(`NodeData Class ${className} is already registered.`);
    }
    nodeDataClassStore[className] = target;
  };
}

export function getNodeDataClass (className: string): Constructor<GraphNodeData> | null {
  return nodeDataClassStore[className];
}
