import type { GraphNodeData } from '..';
import type { Constructor } from '../../utils';

const nodeDataClassStore: Record<string, any> = {};

/**
 * Creates a decorator that registers a class under the specified name for use as graph node data.
 *
 * When applied to a class, the decorator stores the class constructor in an internal registry keyed by `className`.
 * If a class with the same name is already registered, a warning is logged and the new class overwrites the previous entry.
 *
 * @param className - The unique name to associate with the class in the registry
 * @returns A class decorator function
 */
export function nodeDataClass (className: string) {
  return (target: Object, context?: unknown) => {
    if (nodeDataClassStore[className]) {
      console.warn(`NodeData Class ${className} is already registered.`);
    }
    nodeDataClassStore[className] = target;
  };
}

/**
 * Retrieves the registered class constructor for the specified graph node data class name.
 *
 * @param className - The name of the class to look up in the registry
 * @returns The class constructor associated with `className`, or `null` if not found
 */
export function getNodeDataClass (className: string): Constructor<GraphNodeData> | null {
  return nodeDataClassStore[className];
}
