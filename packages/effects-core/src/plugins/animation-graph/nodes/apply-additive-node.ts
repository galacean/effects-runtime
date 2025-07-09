import * as spec from '@galacean/effects-specification';
import { Blender } from '../blender';
import type { GraphContext, InstantiationContext } from '../graph-context';
import { PoseResult } from '../pose-result';
import { nodeDataClass } from '../node-asset-type';
import type { FloatValueNode } from '../graph-node';
import { GraphNodeData, PoseNode } from '../graph-node';
import type { Pose } from '../pose';

@nodeDataClass(spec.NodeDataType.ApplyAdditiveNodeData)
export class ApplyAdditiveNodeData extends GraphNodeData {
  baseNodeIndex: number;
  additiveNodeIndex: number;
  inputParameterValueNodeIndex: number;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(ApplyAdditiveNode, context);

    node.baseNode = context.getNode<PoseNode>(this.baseNodeIndex);
    node.additiveNode = context.getNode<PoseNode>(this.additiveNodeIndex);
    node.inputParameterValueNode = context.getNode<FloatValueNode>(this.inputParameterValueNodeIndex);
  }

  override load (data: spec.ApplyAdditiveNodeData): void {
    super.load(data);
    this.baseNodeIndex = data.baseNodeIndex;
    this.additiveNodeIndex = data.additiveNodeIndex;
    this.inputParameterValueNodeIndex = data.inputParameterValueNodeIndex;
  }
}

export class ApplyAdditiveNode extends PoseNode {
  baseNode: PoseNode | null = null;
  additiveNode: PoseNode | null = null;

  inputParameterValueNode: FloatValueNode | null = null;

  baseNodeResult: PoseResult;
  additiveNodeResult: PoseResult;

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.baseNodeResult = new PoseResult(context.skeleton);
    this.additiveNodeResult = new PoseResult(context.skeleton);

    this.baseNode?.initialize(context);
    this.additiveNode?.initialize(context);
    this.inputParameterValueNode?.initialize(context);
  }

  protected override shutdownInternal (context: GraphContext): void {
    this.baseNode?.shutdown(context);
    this.additiveNode?.shutdown(context);
    this.inputParameterValueNode?.shutdown(context);
    super.shutdownInternal(context);
  }

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    if (!this.inputParameterValueNode) {
      return result;
    }

    this.markNodeActive(context);

    const blendWeight = this.inputParameterValueNode.getValue<number>(context);

    if (this.baseNode && !this.additiveNode) {
      this.baseNode.evaluate(context, this.baseNodeResult);
      this.applyAdditive(this.baseNodeResult.pose, this.additiveNodeResult.pose, blendWeight, result.pose);
    } else if (this.baseNode && this.additiveNode) {
      this.baseNode.evaluate(context, this.baseNodeResult);
      this.additiveNode.evaluate(context, this.additiveNodeResult);
      this.applyAdditive(this.baseNodeResult.pose, this.additiveNodeResult.pose, blendWeight, result.pose);
    }

    return result;
  }

  private applyAdditive (sourcePose: Pose, targetPose: Pose, blendWeight: number, resultPose: Pose) {
    Blender.additiveBlend(sourcePose, targetPose, blendWeight, resultPose);
  }
}
