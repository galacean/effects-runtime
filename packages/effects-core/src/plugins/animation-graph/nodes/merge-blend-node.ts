import * as spec from '@galacean/effects-specification';
import type { GraphContext, InstantiationContext } from '../graph-context';
import { PoseResult } from '../pose-result';
import { nodeDataClass } from '../node-asset-type';
import { GraphNodeData, PoseNode } from '../graph-node';
import type { Quaternion } from '@galacean/effects-math/es/core/quaternion';

@nodeDataClass(spec.NodeDataType.MergeBlendNodeData)
export class MergeBlendNodeData extends GraphNodeData {
  nodeIndexes: number[];

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(MergeBlendNode, context);

    node.poseNodes = this.nodeIndexes.map(index => context.getNode<PoseNode>(index));
  }

  override load (data: spec.MergeBlendNodeData): void {
    super.load(data);
    this.nodeIndexes = data.nodeIndexes.filter(index => index >= 0);
  }
}

export class MergeBlendNode extends PoseNode {
  poseNodes: PoseNode[];

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);

    this.poseNodes.forEach(node => {
      node.initialize(context);
    });
  }

  protected override shutdownInternal (context: GraphContext): void {
    this.poseNodes.forEach(node => {
      node.shutdown(context);
    });
    super.shutdownInternal(context);
  }

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    this.markNodeActive(context);
    if (!this.poseNodes.length) {
      return result;
    }

    const poseResults = this.poseNodes.map(() => new PoseResult(context.skeleton));
    const originValues: number[] = [];

    poseResults.forEach(result => {
      result.pose.parentSpaceTransforms.forEach(transform => {
        (['position', 'scale', 'euler', 'rotation'] as const).forEach(key => {
          originValues.push(transform[key].x);
          this.reset(transform[key], 'x');
        });
      });

      result.pose.colorPropertyValues.forEach(color => {
        originValues.push(color.a);
        this.reset(color, 'a');
      });

      result.pose.floatPropertyValues.forEach((float, index) => {
        originValues.push(float);
        this.reset(result.pose.floatPropertyValues, index);
      });

      return result;
    });

    this.poseNodes.forEach((node, index) => {
      node.evaluate(context, poseResults[index]);
    });

    poseResults.push(result);
    let valueIndex = 0;

    for (let i = 0; i < poseResults.length - 1; i++) {
      const first = poseResults[i];
      const second = poseResults[i + 1];

      first.pose.parentSpaceTransforms.forEach((firstTransform, index) => {
        const secondTransform = second.pose.parentSpaceTransforms[index];

        (['position', 'scale', 'euler', 'rotation'] as const).forEach(key => {
          const firstSet = this.hasSet(firstTransform[key], 'x') ;

          if (firstSet) {
            secondTransform[key].copyFrom(firstTransform[key] as Quaternion);
          } else {
            firstTransform[key].x = originValues[valueIndex++];
          }
        });
      });

      first.pose.colorPropertyValues.forEach((color, index) => {
        const firstSet = this.hasSet(color, 'a');

        if (firstSet) {
          second.pose.colorPropertyValues[index].copyFrom(color);
        } else {
          color.a = originValues[valueIndex++];
        }
      });

      first.pose.floatPropertyValues.forEach((float, index) => {
        const firstSet = this.hasSet(first.pose.floatPropertyValues, index);

        if (firstSet) {
          second.pose.floatPropertyValues[index] = first.pose.floatPropertyValues[index];
        } else {
          first.pose.floatPropertyValues[index] = originValues[valueIndex++];
        }
      });

    }

    return result;
  }

  private hasSet<T extends object, U extends keyof T> (obj: T, key: U) {
    return !Object.is(obj[key], -0);
  }

  private reset<T extends object, U extends keyof T> (obj: T, key: U) {
    obj[key] = -0 as any;
  }

}
