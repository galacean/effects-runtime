import type * as spec from '@galacean/effects-specification';
import { GraphContext, InstantiationContext } from './graph-context';
import { GraphDataSet } from './graph-data-set';
import { PoseResult } from './pose-result';
import type { AnimationRecordData } from './reference-pose';
import { Skeleton } from './reference-pose';
import type { GraphNode, GraphNodeAsset, GraphNodeAssetData, PoseNode, PoseNodeDebugInfo, ValueNode } from './graph-node';
import { InvalidIndex } from './graph-node';
import type { VFXItem } from '../../vfx-item';
import { EffectsObject } from '../../effects-object';
import { effectsClass } from '../../decorators';
import type { AnimationClip } from '../cal/calculate-vfx-item';
import type { NodeAssetType } from './node-asset-type';
import { getNodeAssetClass } from './node-asset-type';
import type { ControlParameterBoolNode, ControlParameterFloatNode } from './nodes/control-parameter-nodes';

export class GraphInstance {
  nodes: GraphNode[] = [];
  skeleton: Skeleton;

  private rootNode: PoseNode;
  private graphAsset: AnimationGraphAsset;
  private context = new GraphContext();
  private result: PoseResult;

  constructor (graphAsset: AnimationGraphAsset, rootBone: VFXItem) {
    this.graphAsset = graphAsset;

    // Initialize skeleton
    const recordProperties: AnimationRecordData = {
      position: [],
      scale: [],
      rotation: [],
      euler: [],
      floats: [],
      colors:[],
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
      for (const floatCurve of animationClip.floatCurves) {
        recordProperties.floats.push(floatCurve);
      }
      for (const colorCurve of animationClip.colorCurves) {
        recordProperties.colors.push(colorCurve);
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
    this.rootNode = this.nodes[graphAsset.rootNodeIndex] as PoseNode;
  }

  evaluateGraph (deltaTime: number) {
    this.context.update(deltaTime);

    if (!this.rootNode.isInitialized()) {
      this.resetGraphState();
    }

    if (this.rootNode) {
      this.result = this.rootNode.evaluate(this.context, this.result);
    }

    return this.result;
  }

  isInitialized () {
    return this.rootNode && this.rootNode.isInitialized();
  }

  // General Node Info
  //-------------------------------------------------------------------------

  isNodeActive (nodeIdx: number): boolean {
    return this.isControlParameter(nodeIdx) || this.nodes[nodeIdx].isNodeActive(this.context.updateID);
  }

  // Graph State
  //-------------------------------------------------------------------------

  resetGraphState () {
    if (this.rootNode.isInitialized()) {
      this.rootNode.shutdown(this.context);
    }

    this.context.updateID++; // Bump the update ID to ensure that any initialization code that relies on it is dirtied.
    this.rootNode.initialize(this.context);
  }

  // Control Parameters
  //-------------------------------------------------------------------------

  getNumControlParameters (): number {
    return this.graphAsset.controlParameterIDs.length;
  }

  getControlParameterIndex (parameterID: string): number {
    const parameterLookupMap = this.graphAsset.parameterLookupMap;
    const res = parameterLookupMap.get(parameterID);

    if (res !== undefined) {
      return res;
    }

    console.warn('Parameter ' + parameterID + ' does not exit.');

    return InvalidIndex;
  }

  getControlParameterID (paramterNodeIndex: number): string {
    return this.graphAsset.controlParameterIDs[paramterNodeIndex];
  }

  setBool (name: string, value: boolean) {
    const index = this.getControlParameterIndex(name);

    if (index !== InvalidIndex) {
      (this.nodes[index] as ControlParameterBoolNode).setValue(value);
    }
  }

  setFloat (name: string, value: number) {
    const index = this.getControlParameterIndex(name);

    if (index !== InvalidIndex) {
      (this.nodes[index] as ControlParameterFloatNode).setValue(value);
    }
  }

  // Debug Information
  //-------------------------------------------------------------------------

  getPoseNodeDebugInfo (nodeIdx: number): PoseNodeDebugInfo {
    const node = this.nodes[nodeIdx] as PoseNode;

    return node.getDebugInfo();
  }

  getRuntimeNodeDebugValue<T>(nodeIdx: number): T {
    const pValueNode = this.nodes[nodeIdx] as ValueNode;

    return pValueNode.getValue<T>(this.context);
  }

  getNodeDebugInstance (nodeIdx: number): GraphNode {
    return this.nodes[nodeIdx];
  }

  private isControlParameter (nodeIdx: number) {
    return nodeIdx < this.getNumControlParameters();
  }
}

export interface GraphDataSetData {
  resources: spec.DataPath[],
}

export interface AnimationGraphAssetData extends spec.EffectsObjectData {
  nodeAssetDatas: GraphNodeAssetData[],
  graphDataSet: GraphDataSetData,
  rootNodeIndex: number,
  controlParameterIDs: string[],
}

@effectsClass('AnimationGraphAsset')
export class AnimationGraphAsset extends EffectsObject {
  nodeAssets: GraphNodeAsset[] = [];
  graphDataSet = new GraphDataSet();
  controlParameterIDs: string[] = [];
  parameterLookupMap = new Map<string, number>();
  rootNodeIndex = InvalidIndex;

  static createNodeAsset (type: NodeAssetType) {
    const classConstructor = getNodeAssetClass(type);

    if (classConstructor) {
      return new classConstructor();
    } else {
      throw new Error('Unknown node type:' + type);
    }
  }

  override fromData (data: AnimationGraphAssetData) {
    const graphAssetData = data;
    const nodeAssetDatas = graphAssetData.nodeAssetDatas;

    this.rootNodeIndex = graphAssetData.rootNodeIndex;
    this.controlParameterIDs = graphAssetData.controlParameterIDs;

    // Create parameter lookup map
    //-------------------------------------------------------------------------

    const numControlParameters = graphAssetData.controlParameterIDs.length;

    for (let i = 0; i < numControlParameters; i++) {
      this.parameterLookupMap.set(graphAssetData.controlParameterIDs[i], i);
    }

    // Deserialize node asset
    //-------------------------------------------------------------------------

    this.nodeAssets = [];

    for (let i = 0;i < nodeAssetDatas.length;i++) {
      this.nodeAssets[i] = AnimationGraphAsset.createNodeAsset(nodeAssetDatas[i].type as NodeAssetType);
      this.nodeAssets[i].load(nodeAssetDatas[i]);
    }

    // Deserialize graph data set
    //-------------------------------------------------------------------------

    this.graphDataSet = new GraphDataSet();
    this.graphDataSet.resources = [];
    for (const animationClipData of graphAssetData.graphDataSet.resources) {
      const animationClip = this.engine.findObject<AnimationClip>(animationClipData);

      this.graphDataSet.resources.push(animationClip);
    }
  }
}