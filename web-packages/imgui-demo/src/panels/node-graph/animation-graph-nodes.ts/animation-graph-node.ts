import type { AnimationClipNode, AnimationClipNodeAssetData, AnimationRootNode, AnimationRootNodeAssetData, Blend1DNode, Blend1DNodeAssetData, ConstFloatNode, ConstFloatNodeAssetData, Pose } from '@galacean/effects-core';
import { PoseNode, type GraphNode } from '@galacean/effects-core';
import { ImGui } from '../../../imgui';
import type { BaseNodeData } from '../base-node';
import { BaseNode } from '../base-node';
import type { ImNodeFlow } from '../node-flow';
import { type GraphCompilationContext } from '../node-graph';
import type { InPin, OutPin } from '../pin';
export class AnimationGraphNode extends BaseNode {
  node: GraphNode;

  constructor (inf: ImNodeFlow) {
    super(inf);
    this.setTitle('AnimationGraphNode');
  }

  override getClassName (): string {
    return 'AnimationGraphNode';
  }

  override draw (): void {
    ImGui.SetNextItemWidth(100 * this.getHandler()!.getGrid().scale());
  }

  compile (context: GraphCompilationContext): number {
    const data = context.getNodeAssetData(this);

    return data.index;
  }

  override toData (data: BaseNodeData): BaseNodeData {
    super.toData(data);
    data.type = this.getClassName();

    return data;
  }
}

export class AnimationRootGraphNode extends AnimationGraphNode {
  source: InPin<Pose | null>;

  constructor (inf: ImNodeFlow, node: AnimationRootNode) {
    super(inf);
    this.setTitle('AnimationRootNode');
    this.source = this.addIN('pose', null, ()=>true);
    this.node = node;
  }

  override draw (): void {
    const sourceNode = this.source.getLink()?.getLeft().getParent();

    if (sourceNode instanceof AnimationGraphNode &&
        sourceNode.node instanceof PoseNode
    ) {
      (this.node as AnimationRootNode).poseNode = sourceNode.node;
    }

    ImGui.SetNextItemWidth(100 * this.getHandler()!.getGrid().scale());
  }

  override getClassName (): string {
    return 'AnimationRootGraphNode';
  }

  override toData (data: AnimationRootGraphNodeData): BaseNodeData {
    super.toData(data);
    data.type = this.getClassName();
    data.source = this.source.getUID();

    return data;
  }

  override fromData (data: AnimationRootGraphNodeData): void {
    super.fromData(data);

    this.source.setUid(data.source);
  }

  override compile (context: GraphCompilationContext) {
    const data = context.getNodeAssetData(this) as AnimationRootNodeAssetData;

    if (context.checkNodeCompilationState(data)) {
      return data.index;
    }

    const poseNode = this.source.getLink()?.getLeft().getParent() as AnimationGraphNode;
    const poseNodeRuntimeIndex = poseNode?.compile(context) ?? -1;

    data.poseNode = poseNodeRuntimeIndex;

    return data.index;
  }
}

interface AnimationRootGraphNodeData extends BaseNodeData {
  source: number,
}

export class AnimationClipGraphNode extends AnimationGraphNode {
  poseOut: OutPin<Pose>;

  constructor (inf: ImNodeFlow, node: AnimationClipNode) {
    super(inf);
    this.setTitle('AnimationClipNode');
    this.poseOut = this.addOUT<Pose>('pose');
    this.node = node;
  }

  override draw (): void {
    ImGui.SetNextItemWidth(100 * this.getHandler()!.getGrid().scale());
  }

  override getClassName (): string {
    return 'AnimationClipGraphNode';
  }

  override toData (data: AnimationClipGraphNodeData): BaseNodeData {
    super.toData(data);
    data.type = this.getClassName();
    data.poseOut = this.poseOut.getUID();

    return data;
  }

  override fromData (data: AnimationClipGraphNodeData): void {
    super.fromData(data);

    this.poseOut.setUid(data.poseOut);
  }

  override compile (context: GraphCompilationContext) {
    const data = context.getNodeAssetData(this) as AnimationClipNodeAssetData;

    if (context.checkNodeCompilationState(data)) {
      return data.index;
    }

    data.dataSlotIndex = context.registerDataSlotNode(this.getUID());

    return data.index;
  }
}

interface AnimationClipGraphNodeData extends BaseNodeData {
  poseOut: number,
}

export class Blend1DGraphNode extends AnimationGraphNode {

  source0: InPin<Pose | null>;
  source1: InPin<Pose | null>;

  parameter: InPin<number>;

  poseOut: OutPin<Pose>;

  constructor (inf: ImNodeFlow, node: Blend1DNode) {
    super(inf);
    this.setTitle('Blend1DNode');
    this.parameter = this.addIN('weight', 0, ()=>true);
    this.source0 = this.addIN('pose0', null, ()=>true);
    this.source1 = this.addIN('pose1', null, ()=>true);
    this.poseOut = this.addOUT<Pose>('pose');
    this.node = node;
  }

  override draw (): void {
    ImGui.SetNextItemWidth(100 * this.getHandler()!.getGrid().scale());
  }

  override getClassName (): string {
    return 'Blend1DGraphNode';
  }

  override toData (data: Blend1DGraphNodeData): BaseNodeData {
    super.toData(data);
    data.type = this.getClassName();
    data.source0 = this.source0.getUID();
    data.source1 = this.source1.getUID();
    data.parameter = this.parameter.getUID();
    data.poseOut = this.poseOut.getUID();

    return data;
  }

  override fromData (data: Blend1DGraphNodeData): void {
    super.fromData(data);

    this.source0.setUid(data.source0);
    this.source1.setUid(data.source1);
    this.parameter.setUid(data.parameter);
    this.poseOut.setUid(data.poseOut);
  }

  override compile (context: GraphCompilationContext) {
    const data = context.getNodeAssetData(this) as Blend1DNodeAssetData;

    if (context.checkNodeCompilationState(data)) {
      return data.index;
    }

    const source0 = this.source0.getLink()?.getLeft().getParent() as AnimationGraphNode;
    const source1 = this.source1.getLink()?.getLeft().getParent() as AnimationGraphNode;
    const inputParameterValueNode = this.parameter.getLink()?.getLeft().getParent() as AnimationGraphNode;

    const source0RuntimeIndex = source0?.compile(context) ?? -1;
    const source1RuntimeIndex = source1?.compile(context) ?? -1;
    const inputParameterValueNodeRuntimeIndex = inputParameterValueNode?.compile(context) ?? -1;

    data.source0 = source0RuntimeIndex;
    data.source1 = source1RuntimeIndex;
    data.inputParameterValueNode = inputParameterValueNodeRuntimeIndex;

    return data.index;
  }
}

interface Blend1DGraphNodeData extends BaseNodeData {
  source0: number,
  source1: number,
  parameter: number,
  poseOut: number,
}

export class ConstFloatGraphNode extends AnimationGraphNode {

  valueOut: OutPin<number>;

  constructor (inf: ImNodeFlow, node: ConstFloatNode) {
    super(inf);
    this.setTitle('ConstFloatNode');
    this.valueOut = this.addOUT('value');
    this.node = node;
  }

  override draw (): void {
    ImGui.SetNextItemWidth(100 * this.getHandler()!.getGrid().scale());

    if (!this.node) {
      return;
    }

    const node = this.node as ConstFloatNode;

    ImGui.DragFloat('', (_ = node.value)=>{
      node.value = _;

      return node.value;
    }, 0.003, 0, 1);
  }

  override getClassName (): string {
    return 'ConstFloatGraphNode';
  }

  override toData (data: ConstFloatGraphNodeData): BaseNodeData {
    super.toData(data);
    data.type = this.getClassName();
    data.valueOut = this.valueOut.getUID();

    return data;
  }

  override fromData (data: ConstFloatGraphNodeData): void {
    super.fromData(data);

    this.valueOut.setUid(data.valueOut);
  }

  override compile (context: GraphCompilationContext) {
    const data = context.getNodeAssetData(this) as ConstFloatNodeAssetData;

    if (context.checkNodeCompilationState(data)) {
      return data.index;
    }

    data.value = (this.node as ConstFloatNode)?.value ?? 0;

    return data.index;
  }
}

interface ConstFloatGraphNodeData extends BaseNodeData {
  valueOut: number,
}