import type { GraphContext, InstantiationContext } from './graph-context';
import type { PoseResult } from './pose-result';

export const InvalidIndex = -1;

export class GraphNode {
  /**
   * @internal
   */
  asset: GraphNodeAsset;

  private initializationCount = 0;
  private lastUpdateID = -1;

  constructor () {
  }

  getAsset<T extends GraphNodeAsset> (): T {
    return this.asset as T;
  }

  isValid () {
    return true;
  }

  isInitialized (): boolean {
    return this.initializationCount > 0;
  }

  initialize (context: GraphContext) {
    if (this.isInitialized()) {
      this.initializationCount++;
    } else {
      this.initializeInternal(context);
    }
  }

  /**
   * Shutdown this node
   */
  shutdown (context: GraphContext): void {
    if (!this.isInitialized()) {
      throw new Error('Node not initialized!');
    }

    if (--this.initializationCount === 0) {
      this.shutdownInternal(context);
    }
  }

  isNodeActive (updateID: number) {
    return this.lastUpdateID == updateID;
  }

  isUpdated (context: GraphContext) {
    return this.isNodeActive(context.updateID);
  }

  /**
   * Mark this node as active for the current update
   */
  markNodeActive (context: GraphContext): void {
    this.lastUpdateID = context.updateID;
  }

  /**
   * Internal initialization logic
   */
  protected initializeInternal (context: GraphContext) {
    this.initializationCount++;
  }

  /**
   * Internal shutdown logic
   */
  protected shutdownInternal (context: GraphContext): void {
    if (this.isInitialized()) {
      throw new Error('Node still initialized!');
    }
    this.lastUpdateID = -1;
  }
}

export interface GraphNodeAssetData {
  type: string,
  index: number,
}

export class GraphNodeAsset {
  index: number;

  instantiate (context: InstantiationContext) {
    // OVERRIDE
  }

  load (data: GraphNodeAssetData) {
    this.index = data.index;
  }

  protected createNode<T extends GraphNode> (nodeType: new () => T, context: InstantiationContext) {
    const node = new nodeType();

    context.nodes[this.index] = node;

    return node;
  }
}

export interface PoseNodeDebugInfo {
  duration: number,
  currentTime: number,    // Clamped percentage over the duration
  previousTime: number,   // Clamped percentage over the duration
}

export abstract class PoseNode extends GraphNode {
  protected duration: number = 0;
  protected previousTime: number = 0;
  protected currentTime: number = 0;

  getCurrentTime (): number {
    return this.currentTime;
  }

  getPreviousTime (): number {
    return this.previousTime;
  }

  getDuration (): number {
    return this.duration;
  }

  getDebugInfo (): PoseNodeDebugInfo {
    const info: PoseNodeDebugInfo = {
      duration: this.duration,
      currentTime:  this.currentTime,
      previousTime: this.previousTime,
    };

    return info;
  }

  abstract evaluate (context: GraphContext, result: PoseResult): PoseResult;

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);

    // Reset node state
    this.previousTime = 0;
    this.currentTime = this.previousTime;

    // Set the duration to 0 even though this is an invalid value as it is expected that nodes will set this correctly at initialization time
    this.duration = 0;
  }
}

export abstract class ValueNode extends GraphNode {

  setValue <T>(value: T) {
    // OVERRIDE
  }

  abstract getValue<T>(context: GraphContext): T;
}

export abstract class FloatValueNode extends ValueNode {

}

export abstract class BoolValueNode extends ValueNode {

}