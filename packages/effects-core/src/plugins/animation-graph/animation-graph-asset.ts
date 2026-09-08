import type * as spec from '@galacean/effects-specification';
import { Asset } from '../../asset';
import { effectsClass } from '../../decorators';
import { GraphDataSet } from './graph-data-set';
import { getNodeDataClass } from './node-asset-type';
import { InvalidIndex, type GraphNodeData } from './graph-node';
import type { AnimationClip } from '../../animation/animation-clip';

@effectsClass('AnimationGraphAsset')
export class AnimationGraphAsset extends Asset {
  nodeDatas: GraphNodeData[] = [];
  graphDataSet = new GraphDataSet();
  controlParameterIDs: string[] = [];
  parameterLookupMap = new Map<string, number>();
  rootNodeIndex = InvalidIndex;

  static createNodeData (type: spec.NodeDataType) {
    const classConstructor = getNodeDataClass<GraphNodeData>(type);

    if (classConstructor) {
      return new classConstructor();
    } else {
      throw new Error(`Unknown node type: ${type}.`);
    }
  }

  override toData (): void {
    super.toData();
    this.definition = { ...this.definition,
      rootNodeIndex: this.rootNodeIndex,
      controlParameterIDs: this.controlParameterIDs.slice(),
      nodeDatas: this.nodeDatas.map(node => node.toData()),
      graphDataSet: { resources: this.graphDataSet.resources.map(resource => ({ id: resource.getInstanceId() })) },
    };
  }

  override fromData (data: spec.AnimationGraphAssetData) {
    super.fromData(data);
    this.parameterLookupMap.clear();
    const graphAssetData = data;
    const nodeDatas = graphAssetData.nodeDatas;

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
    this.nodeDatas = [];

    for (let i = 0; i < nodeDatas.length; i++) {
      this.nodeDatas[i] = AnimationGraphAsset.createNodeData(nodeDatas[i].type as spec.NodeDataType);
      this.nodeDatas[i].load(nodeDatas[i]);
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

  protected override loadAsset (): void | Promise<void> {
    const pending = this.graphDataSet.resources.filter(asset => !asset.isLoaded);

    if (pending.length === 0) {
      return;
    }

    return Promise.all(pending.map(asset => asset.waitForLoaded())).then(() => undefined);
  }
}
