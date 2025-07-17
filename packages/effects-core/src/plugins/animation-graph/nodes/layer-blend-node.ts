import type * as spec from '@galacean/effects-specification';
import type { GraphContext, InstantiationContext } from '../graph-context';
import { PoseResult } from '../pose-result';
import { nodeDataClass } from '../node-asset-type';
import type { FloatValueNode } from '../graph-node';
import { GraphNodeData, InvalidIndex, PoseNode } from '../graph-node';
import { Blender } from '../blender';

interface SpecLayerData {
  inputNodeIndex?: number,
  weightValueNodeIndex?: number,
}

interface SpecLayerBlendNodeData extends spec.GraphNodeData {
  baseNodeIndex?: number,
  layerDatas?: SpecLayerData[],
}

interface Layer {
  inputNode: PoseNode | null,
  weightValueNode: FloatValueNode | null,
  weight: number,
}

@nodeDataClass('LayerBlendNodeData')
export class LayerBlendNodeData extends GraphNodeData {
  baseNodeIndex = InvalidIndex;
  layerDatas: Required<SpecLayerData>[] = [];

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(LayerBlendNode, context);

    node.baseLayerNode = context.getNode<PoseNode>(this.baseNodeIndex);
    for (const layerData of this.layerDatas) {
      node.layers.push({
        inputNode: context.getNode<PoseNode>(layerData.inputNodeIndex),
        weightValueNode: context.getNode<FloatValueNode>(layerData.weightValueNodeIndex),
        weight: 0,
      });
    }
  }

  override load (data: SpecLayerBlendNodeData): void {
    super.load(data);

    this.baseNodeIndex = data.baseNodeIndex ?? InvalidIndex;

    if (data.layerDatas) {
      for (const layerData of data.layerDatas) {
        this.layerDatas.push({
          inputNodeIndex: InvalidIndex,
          weightValueNodeIndex: InvalidIndex,
          ...layerData,
        });
      }
    }
  }
}

export class LayerBlendNode extends PoseNode {
  baseLayerNode: PoseNode | null = null;
  layers: Layer[] = [];

  private layerNodeResult: PoseResult;

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);

    //-------------------------------------------------------------------------

    this.layerNodeResult = new PoseResult(context.skeleton);

    //-------------------------------------------------------------------------

    this.baseLayerNode?.initialize(context);

    for (const layer of this.layers) {
      layer.inputNode?.initialize(context);
      layer.weightValueNode?.initialize(context);
    }
  }

  protected override shutdownInternal (context: GraphContext): void {
    this.baseLayerNode?.shutdown(context);

    for (const layer of this.layers) {
      layer.inputNode?.shutdown(context);
      layer.weightValueNode?.shutdown(context);
    }

    super.shutdownInternal(context);
  }

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    if (!(this.baseLayerNode && this.baseLayerNode.isValid())) {
      return result;
    }

    this.markNodeActive(context);

    this.previousTime = this.baseLayerNode.getCurrentTime();
    result = this.baseLayerNode.evaluate(context, result);
    this.currentTime = this.baseLayerNode.getCurrentTime();
    this.duration = this.baseLayerNode.getDuration();

    this.updateLayers(context, result);

    return result;
  }

  private updateLayers (context: GraphContext, result: PoseResult) {
    for (const layer of this.layers) {
      if (layer.inputNode && layer.weightValueNode) {
        this.layerNodeResult.pose.copyFrom(result.pose);
        layer.inputNode.evaluate(context, this.layerNodeResult);
        const layerWeight = layer.weightValueNode.getValue<number>(context);

        Blender.localBlend(result.pose, this.layerNodeResult.pose, layerWeight, result.pose);
      }
    }

    return result;
  }
}
