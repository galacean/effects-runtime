import { clamp, lerp } from '@galacean/effects-math/es/core/utils';
import type { StateNode } from '../..';
import { PoseNode, TransitionState } from '../..';
import { BranchState, type GraphContext } from '../graph-context';
import { PoseResult } from '../pose-result';
import { Blender } from '../blender';
import { assertExist } from 'packages/effects-core/src/utils';

export enum SourceType {
  State,
  Transition,
  CachedPose
}

export class TransitionNode extends PoseNode {
  private transitionLength = 0;
  private transitionProgress = 0;
  private blendWeight = 0;

  private sourceNode: PoseNode | null = null;
  private sourceNodeResult: PoseResult;
  private sourceType = SourceType.State;
  private targetNode: StateNode;
  private targetNodeResult: PoseResult;
  private blendedDuration = 0;

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    assertExist(this.sourceNode);

    this.markNodeActive(context);

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

  isComplete (context: GraphContext): boolean {
    if (this.transitionLength <= 0) {
      return true;
    }

    return (this.transitionProgress + (context.deltaTime / this.transitionLength)) >= 1.0;
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

  getSourceStateNode () {
    return this.sourceNode as StateNode;
  }

  getSourceTransitionNode () {
    return this.sourceNode as TransitionNode;
  }

  notifyNewTransitionStarting (context: GraphContext, targetStateNode: StateNode) {
    // if (this.isSourceAState()) {
    //   if
    // }
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.sourceNodeResult = new PoseResult(context.skeleton);
    this.targetNodeResult = new PoseResult(context.skeleton);

    this.transitionProgress = 0;
    this.blendWeight = 0;
  }

  protected override shutdownInternal (context: GraphContext): void {
    this.targetNode.setTransitioningState(TransitionState.None);
    this.currentTime = 1.0;

    if (this.sourceNode) {
      this.sourceNode.shutdown(context);
      this.sourceNode = null;
    }
    super.shutdownInternal(context);
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