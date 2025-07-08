import { clamp, lerp } from '@galacean/effects-math/es/core/utils';
import type { StateNode } from '../..';
import * as spec from '@galacean/effects-specification';
import { GraphNodeData, InvalidIndex, PoseNode, TransitionState, nodeDataClass } from '../..';
import { Blender } from '../blender';
import type { InstantiationContext } from '../graph-context';
import { BranchState, type GraphContext } from '../graph-context';
import { PoseResult } from '../pose-result';
import { assertExist } from '../../../utils/asserts';

export enum SourceType {
  State,
  Transition,
  CachedPose
}

@nodeDataClass(spec.NodeDataType.TransitionNodeData)
export class TransitionNodeData extends GraphNodeData {
  duration = 0;
  hasExitTime = false;
  exitTime = 0.75;
  targetStateNodeIndex = InvalidIndex;

  override instantiate (context: InstantiationContext): void {
    const node = this.createNode(TransitionNode, context);

    node.targetNode = context.getNode(this.targetStateNodeIndex);
    node.hasExitTime = this.hasExitTime;
    node.exitTime = this.exitTime;
  }

  override load (data: spec.TransitionNodeData): void {
    super.load(data);

    this.duration = data.duration;
    this.hasExitTime = data.hasExitTime;
    this.exitTime = data.exitTime;
    this.targetStateNodeIndex = data.targetStateNodeIndex;
  }
}

export class TransitionNode extends PoseNode {
  targetNode: StateNode;
  hasExitTime = false;
  exitTime = 0.75;

  private transitionLength = 0;
  private transitionProgress = 0;
  private blendWeight = 0;

  private sourceNode: PoseNode | null = null;
  private sourceNodeResult: PoseResult;
  private sourceType = SourceType.State;
  private targetNodeResult: PoseResult;
  private blendedDuration = 0;

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    assertExist(this.sourceNode);

    this.markNodeActive(context);

    // Handle source transition completion
    if (this.isSourceATransition() && this.getSourceTransitionNode().isComplete(context)) {
      this.endSourceTransition(context);
    }

    this.transitionProgress = this.transitionProgress + context.deltaTime / this.transitionLength;
    this.transitionProgress = clamp(this.transitionProgress, 0.0, 1.0);

    // 计算混合权重
    this.calculateBlendWeight();

    // 更新源状态
    let sourceNodeResult = this.sourceNodeResult;

    // 设置分支状态
    const previousBranchState = context.branchState;

    context.branchState = BranchState.Inactive;
    sourceNodeResult = this.sourceNode.evaluate(context, sourceNodeResult);

    // 恢复分支状态
    context.branchState = previousBranchState;

    // 更新目标状态节点
    const targetNodeResult = this.targetNode.evaluate(
      context,
      this.targetNodeResult
    );

    const finalResult = result;

    this.registerPoseTasksAndUpdateRootMotion(
      sourceNodeResult,
      targetNodeResult,
      finalResult
    );

    // 更新内部时间
    this.blendedDuration = lerp(
      this.sourceNode.getDuration(),
      this.targetNode.getDuration(),
      this.blendWeight
    );
    if (this.blendedDuration > 0.0) {
      const deltaPercentage = context.deltaTime / this.blendedDuration;

      this.previousTime = this.currentTime;
      this.currentTime = (this.currentTime + deltaPercentage) % 1;
    } else {
      this.previousTime = this.currentTime = 1.0;
    }

    // 设置转换的暴露持续时间为目标，以确保任何"状态完成"节点正确触发
    this.duration = this.targetNode.getDuration();

    return finalResult;
  }

  // Transition Info
  //-------------------------------------------------------------------------

  isComplete (context: GraphContext): boolean {
    if (this.transitionLength <= 0) {
      return true;
    }

    return (this.transitionProgress + (context.deltaTime / this.transitionLength)) >= 1.0;
  }

  getProgressPercentage (): number {
    return this.transitionProgress;
  }

  getSourceType (): SourceType {
    return this.sourceType;
  }

  isSourceATransition (): boolean {
    return this.sourceType === SourceType.Transition;
  }

  isSourceAState (): boolean {
    return this.sourceType === SourceType.State;
  }

  // Secondary initialization
  //-------------------------------------------------------------------------

  startTransitionFromState (
    context: GraphContext,
    sourceNodeResult: PoseResult,
    sourceState: StateNode,
    outResult: PoseResult
  ): PoseResult {
    this.sourceNode = sourceState;
    this.sourceType = SourceType.State;

    return this.initializeTargetStateAndUpdateTransition(context, sourceNodeResult, outResult);
  }

  startTransitionFromTransition (
    context: GraphContext,
    sourceNodeResult: PoseResult,
    sourceTransition: TransitionNode,
    outResult: PoseResult) {
    this.sourceNode = sourceTransition;
    this.sourceType = SourceType.Transition;

    return this.initializeTargetStateAndUpdateTransition(context, sourceNodeResult, outResult);
  }

  // Source Node
  //-------------------------------------------------------------------------

  getSourceStateNode () {
    return this.sourceNode as StateNode;
  }

  getSourceTransitionNode () {
    return this.sourceNode as TransitionNode;
  }

  // Forceable transitions
  //-------------------------------------------------------------------------

  notifyNewTransitionStarting (context: GraphContext, targetStateNode: StateNode) {
    if (this.isSourceATransition()) {
      const sourceTransitionNode = this.getSourceTransitionNode();
      const sourceTransitionTargetState = sourceTransitionNode.targetNode;

      if (sourceTransitionTargetState === targetStateNode) {
        this.sourceType = SourceType.CachedPose;

        sourceTransitionTargetState.shutdown(context);
        this.sourceNode = null;
      }
    } else if (this.isSourceAState()) {
      if (this.sourceNode === targetStateNode) {
        this.sourceType = SourceType.CachedPose;
        this.sourceNode.shutdown(context);
        this.sourceNode = null;
      }
    }

    if (this.isSourceATransition()) {
      const sourceTransitionNode = this.getSourceTransitionNode();

      sourceTransitionNode.notifyNewTransitionStarting(context, targetStateNode);
    }
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.sourceNodeResult = new PoseResult(context.skeleton);
    this.targetNodeResult = new PoseResult(context.skeleton);

    this.transitionLength = this.getNodeData<TransitionNodeData>().duration;

    this.transitionProgress = 0;
    this.blendWeight = 0;
  }

  protected override shutdownInternal (context: GraphContext): void {
    this.targetNode.setTransitioningState(TransitionState.None);
    this.currentTime = 1.0;

    if (this.sourceNode) {
      if (this.isSourceATransition()) {
        this.endSourceTransition(context);
      }
      this.sourceNode.shutdown(context);
      this.sourceNode = null;
    }
    super.shutdownInternal(context);
  }

  private endSourceTransition (context: GraphContext) {
    const sourceTransitionNode = this.getSourceTransitionNode();
    const sourceTransitionTargetState = sourceTransitionNode.targetNode;

    this.sourceNode?.shutdown(context);
    this.sourceNode = sourceTransitionTargetState;
    this.sourceType = SourceType.State;

    this.getSourceStateNode().setTransitioningState(TransitionState.TransitioningOut);
  }

  private initializeTargetStateAndUpdateTransition (
    context: GraphContext,
    sourceNodeResult: PoseResult,
    outResult: PoseResult
  ): PoseResult {
    this.markNodeActive(context);

    let targetNodeResult = this.targetNodeResult;

    // 处理源状态的过渡开始
    const startTransitionOutForSource = () => {
      if (this.sourceType === SourceType.State) {
        this.getSourceStateNode().startTransitionOut(context);
      }
    };

    // 非同步转换的处理
    startTransitionOutForSource();
    this.targetNode.initialize(context);
    this.targetNode.startTransitionIn(context);
    targetNodeResult = this.targetNode.evaluate(context, targetNodeResult);

    // 计算混合权重
    this.calculateBlendWeight();

    // 注册姿势任务并更新根运动
    this.registerPoseTasksAndUpdateRootMotion(
      sourceNodeResult,
      targetNodeResult,
      outResult
    );

    // Update internal time
    this.previousTime = 0;
    this.currentTime = 0;
    this.blendedDuration = lerp(this.sourceNode!.getDuration(), this.targetNode.getDuration(), this.blendWeight);

    // Set the exposed-duration of the transition to the target to ensure that any "state completed" nodes trigger correctly
    this.duration = this.targetNode.getDuration();

    return outResult;
  }

  private calculateBlendWeight () {
    if (this.transitionLength == 0) {
      this.blendWeight = 1;
    } else {
      // Linear
      this.blendWeight = this.transitionProgress;
      this.blendWeight = clamp(this.blendWeight, 0, 1);
    }
  }

  private registerPoseTasksAndUpdateRootMotion (
    sourceResult: PoseResult,
    targetResult: PoseResult,
    outResult: PoseResult
  ): void {
    const poseBlendWeight = this.blendWeight;

    Blender.localBlend(sourceResult.pose, targetResult.pose, poseBlendWeight, outResult.pose);
  }
}