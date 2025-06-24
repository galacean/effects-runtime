import type { GraphContext, InstantiationContext } from '../graph-context';
import type { FloatValueNode } from '../graph-node';
import { GraphNodeData, PoseNode } from '../graph-node';
import type { Pose } from '../pose';
import { PoseResult } from '../pose-result';
import type { Spec } from '../..';
import { NodeDataType, nodeDataClass } from '../..';
import { Blender } from '../blender';

@nodeDataClass(NodeDataType.BlendNodeData)
export class BlendNodeData extends GraphNodeData {
  sourceNodeIndex0: number;
  sourceNodeIndex1: number;
  inputParameterValueNodeIndex: number;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(BlendNode, context);

    node.source0 = context.getNode<PoseNode>(this.sourceNodeIndex0);
    node.source1 = context.getNode<PoseNode>(this.sourceNodeIndex1);
    node.inputParameterValueNode = context.getNode<FloatValueNode>(this.inputParameterValueNodeIndex);
  }

  override load (data: Spec.BlendNodeData): void {
    super.load(data);
    this.sourceNodeIndex0 = data.sourceNodeIndex0;
    this.sourceNodeIndex1 = data.sourceNodeIndex1;
    this.inputParameterValueNodeIndex = data.inputParameterValueNodeIndex;
  }
}

export class BlendNode extends PoseNode {
  source0: PoseNode | null = null;
  source1: PoseNode | null = null;

  inputParameterValueNode: FloatValueNode | null = null;

  source0Result: PoseResult;
  source1Result: PoseResult;

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.source0Result = new PoseResult(context.skeleton);
    this.source1Result = new PoseResult(context.skeleton);

    this.source0?.initialize(context);
    this.source1?.initialize(context);
    this.inputParameterValueNode?.initialize(context);
  }

  protected override shutdownInternal (context: GraphContext): void {
    this.source0?.shutdown(context);
    this.source1?.shutdown(context);
    this.inputParameterValueNode?.shutdown(context);
    super.shutdownInternal(context);
  }

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    if (!this.inputParameterValueNode) {
      return result;
    }

    this.markNodeActive(context);

    const blendWeight = this.inputParameterValueNode.getValue<number>(context);

    if (this.source0 && !this.source1) {
      this.source0.evaluate(context, this.source0Result);
      this.localBlend(this.source0Result.pose, this.source1Result.pose, blendWeight, result.pose);
    } else if (this.source0 && this.source1) {
      this.source0.evaluate(context, this.source0Result);
      this.source1.evaluate(context, this.source1Result);
      this.localBlend(this.source0Result.pose, this.source1Result.pose, blendWeight, result.pose);
    }

    return result;
  }

  private localBlend (sourcePose: Pose, targetPose: Pose, blendWeight: number, resultPose: Pose) {
    Blender.localBlend(sourcePose, targetPose, blendWeight, resultPose);
  }
}