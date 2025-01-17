import type { GraphNode, GraphNodeAsset, GraphNodeAssetData, VFXItem, AnimationClip } from '@galacean/effects-core';
import { AnimationClipNodeAsset, AnimationRootNodeAsset, blend1DNodeAsset, ConstFloatNodeAsset, effectsClass, EffectsObject, NodeAssetType } from '@galacean/effects-core';
import type * as spec from '@galacean/effects-specification';
import { GraphContext, InstantiationContext } from './graph-context';
import { GraphDataSet } from './graph-data-set';
import type { AnimationRootNode } from './nodes/animation-root-node';
import { PoseResult } from './pose-result';
import type { SkeletonRecordProperties } from './skeleton';
import { Skeleton } from './skeleton';

export class GraphInstance {
  rootNode: AnimationRootNode;
  nodes: GraphNode[] = [];
  skeleton: Skeleton;

  private graphAsset: AnimationGraphAsset;
  private context = new GraphContext();
  private result: PoseResult;

  constructor (graphAsset: AnimationGraphAsset, rootBone: VFXItem) {
    this.graphAsset = graphAsset;

    // initialize skeleton
    const recordProperties: SkeletonRecordProperties = {
      position: [],
      scale: [],
      rotation: [],
      euler: [],
      floats: [],
    };

    for (const animationClip of graphAsset.graphDataSet.resources) {
      if (!animationClip) {
        continue;
      }
      for (const positionCurve of animationClip.positionCurves) {
        recordProperties.position.push(positionCurve.path);
      }
      for (const rotationCurve of animationClip.rotationCurves) {
        recordProperties.rotation.push(rotationCurve.path);
      }
      for (const scaleCurve of animationClip.scaleCurves) {
        recordProperties.scale.push(scaleCurve.path);
      }
      for (const eulerCurve of animationClip.eulerCurves) {
        recordProperties.euler.push(eulerCurve.path);
      }
    }
    this.skeleton = new Skeleton(rootBone, recordProperties);

    // create PoseResult
    this.result = new PoseResult(this.skeleton);
    this.context.skeleton = this.skeleton;

    // instantiate graph nodes
    const instantiationContext = new InstantiationContext();

    instantiationContext.nodes = this.nodes;
    instantiationContext.nodeAsset = graphAsset.nodeAssets;
    instantiationContext.dataSet = graphAsset.graphDataSet;

    for (let i = 0;i < graphAsset.nodeAssets.length;i++) {
      if (!instantiationContext.nodes[i]) {
        graphAsset.nodeAssets[i].instantiate(instantiationContext);
      }
    }
    this.rootNode = this.nodes[0] as AnimationRootNode;

    // initialize graph nodes
    for (const node of this.nodes) {
      node.initialize(this.context);
    }
  }

  evaluateGraph (deltaTime: number) {
    this.context.deltaTime = deltaTime;

    if (this.rootNode) {
      this.result = this.rootNode.evaluate(this.context, this.result);
    }

    return this.result;
  }
}

export interface GraphDataSetData {
  resources: spec.DataPath[],
}

export interface AnimationGraphAssetData extends spec.EffectsObjectData {
  nodeAssetDatas: GraphNodeAssetData[],
  graphDataSet: GraphDataSetData,
}

@effectsClass('AnimationGraphAsset')
export class AnimationGraphAsset extends EffectsObject {
  nodeAssets: GraphNodeAsset[] = [];
  graphDataSet = new GraphDataSet();

  static createNodeAsset (type: NodeAssetType) {
    switch (type) {
      case NodeAssetType.AnimationRootNodeAsset:
        return new AnimationRootNodeAsset();
      case NodeAssetType.Blend1DNodeAsset:
        return new blend1DNodeAsset();
      case NodeAssetType.ConstFloatNodeAsset:
        return new ConstFloatNodeAsset();
      case NodeAssetType.AnimationClipNodeAsset:
        return new AnimationClipNodeAsset();
      default:
        throw new Error('Unknown node type:' + type);
    }
  }

  override fromData (data: AnimationGraphAssetData) {
    const graphAssetData = data as unknown as AnimationGraphAssetData;
    const nodeAssetDatas = graphAssetData.nodeAssetDatas;

    this.nodeAssets = [];

    for (let i = 0;i < nodeAssetDatas.length;i++) {
      this.nodeAssets[i] = AnimationGraphAsset.createNodeAsset(nodeAssetDatas[i].type as NodeAssetType);
      this.nodeAssets[i].load(nodeAssetDatas[i]);
    }

    this.graphDataSet = new GraphDataSet();
    this.graphDataSet.resources = [];
    for (const animationClipData of graphAssetData.graphDataSet.resources) {
      const animationClip = this.engine.assetLoader.loadGUID<AnimationClip>(animationClipData.id);

      this.graphDataSet.resources.push(animationClip);
    }
  }
}