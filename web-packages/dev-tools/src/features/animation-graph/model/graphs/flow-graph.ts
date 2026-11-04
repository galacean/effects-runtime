import { CommentGraphNode } from '../../../../ui/graph-editor/comment-graph-node';
import * as NodeGraph from '../../../../ui/graph-editor/index';
import { AnimationGraphNode, GraphType } from '../nodes/flow-editor-node';

export class AnimationFlowGraph extends NodeGraph.FlowGraphModel {
  static readonly s_graphParameterPayloadID: string = 'AnimGraphParameterPayload';

  private m_type: GraphType;

  constructor (type: GraphType = GraphType.BlendTree) {
    super();
    this.m_type = type;
  }

  GetType (): GraphType {
    return this.m_type;
  }

  override CanCreateNode<T extends NodeGraph.GraphNode>(classConstructor: new (...args: any[]) => T): boolean {
    if (this.isSubclassOf(classConstructor, CommentGraphNode)) {
      return true;
    }

    if (!this.isSubclassOf(classConstructor, AnimationGraphNode)) {
      return false;
    }

    const pFlowNode = new classConstructor() as unknown as AnimationGraphNode;

    return pFlowNode.GetAllowedParentGraphTypes().get(this.m_type) ?? false;
  }

  override SupportsNodeCreationFromConnection (): boolean {
    return true;
  }

  override GetSupportedDragAndDropPayloadIDs (outIDs: string[]): string[] {
    outIDs.push(AnimationFlowGraph.s_graphParameterPayloadID);

    return outIDs;
  }

}
