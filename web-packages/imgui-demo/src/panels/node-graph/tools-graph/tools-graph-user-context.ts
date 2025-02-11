import type { GraphNode, PoseNodeDebugInfo } from '@galacean/effects';
import { generateGUID, type GraphInstance } from '@galacean/effects';
import { UserContext } from '../visual-graph/user-context';
import type { UUID } from '../visual-graph/state-machine-graph';

// ToolsGraphUserContext 类
export class ToolsGraphUserContext extends UserContext {
  // 属性定义
//   m_pFileRegistry: FileRegistry | null = null;
  m_selectedVariationID: string = '';
  //   m_pVariationHierarchy: VariationHierarchy | null = null;
  m_pGraphInstance: GraphInstance | null = null;
  m_nodeIDtoIndexMap: Map<UUID, number> = new Map();
  m_nodeIndexToIDMap: Map<number, UUID> = new Map();
  //   m_pParameters: ParameterBaseToolsNode[] | null = null;
  //   m_pCategorizedNodeTypes: Category<TypeInfo> | null = null;
  //   m_pTypeRegistry: TypeRegistry | null = null;
  m_showRuntimeIndices: boolean = false;

  // Node Helpers
  //   GetParameters (): ReadonlyArray<ParameterBaseToolsNode> {
  //     if (this.m_pParameters === null) {
  //       throw new Error('m_pParameters is null');
  //     }

  //     return this.m_pParameters;
  //   }

  //   GetCategorizedNodeTypes (): Category<TypeInfo> {
  //     if (this.m_pCategorizedNodeTypes === null) {
  //       throw new Error('m_pCategorizedNodeTypes is null');
  //     }

  //     return this.m_pCategorizedNodeTypes;
  //   }

  // Debug Data
  HasDebugData (): boolean {
    return this.m_pGraphInstance !== null && this.m_pGraphInstance.isInitialized();
  }

  GetRuntimeGraphNodeIndex (nodeID: UUID): number {
    const foundIndex = this.m_nodeIDtoIndexMap.get(nodeID);

    return foundIndex !== undefined ? foundIndex : -1; // 假设 InvalidIndex 是 -1
  }

  GetGraphNodeUUID (runtimeNodeIdx: number): UUID {
    const foundUUID = this.m_nodeIndexToIDMap.get(runtimeNodeIdx);

    return foundUUID !== undefined ? foundUUID : generateGUID();
  }

  IsNodeActive (nodeIdx: number): boolean {
    if (this.m_pGraphInstance === null) {
      throw new Error('m_pGraphInstance is null');
    }

    return this.m_pGraphInstance.isNodeActive(nodeIdx);
  }

  GetPoseNodeDebugInfo (runtimeNodeIdx: number): PoseNodeDebugInfo {
    if (this.m_pGraphInstance === null) {
      throw new Error('m_pGraphInstance is null');
    }

    return this.m_pGraphInstance.getPoseNodeDebugInfo(runtimeNodeIdx);
  }

  GetNodeDebugInstance (runtimeNodeIdx: number): GraphNode {
    if (this.m_pGraphInstance === null) {
      throw new Error('m_pGraphInstance is null');
    }

    return this.m_pGraphInstance.getNodeDebugInstance(runtimeNodeIdx);
  }

  //   GetNodeValue<T>(runtimeNodeIdx: number): T {
  //     if (this.m_pGraphInstance === null) {
  //       throw new Error('m_pGraphInstance is null');
  //     }

//     return this.m_pGraphInstance.GetRuntimeNodeDebugValue<T>(runtimeNodeIdx);
//   }
}
