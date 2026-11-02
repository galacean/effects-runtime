import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import { AnimationGraphNode, GraphType, GraphValueType, InvalidIndex } from './flow-editor-node';

export class ResultEditorNode extends AnimationGraphNode {

  private m_valueType: GraphValueType = GraphValueType.Special;

  constructor ();
  constructor (valueType: GraphValueType);
  constructor (valueType?: GraphValueType) {
    super();
    if (valueType !== undefined) {
      this.m_valueType = valueType;
      this.CreateInputPin('Out', this.m_valueType);
    }
  }

  override GetTypeName (): string { return 'Result'; }
  override GetCategory (): string { return 'Results'; }
  override IsUserCreatable (): boolean { return false; }

  GetAllowedParentGraphTypes (): Map<GraphType, boolean> {
    return new Map<GraphType, boolean>([[GraphType.BlendTree, true], [GraphType.ValueTree, true]]);
  }

  override Compile (context: AnimationGraphCompilationContext): number {
    const pConnectedNode = this.GetConnectedInputNode<AnimationGraphNode>(0);

    if (pConnectedNode !== null) {
      return pConnectedNode.Compile(context);
    }

    return InvalidIndex;
  }
}

export class PoseResultEditorNode extends ResultEditorNode {
  constructor () {
    super(GraphValueType.Pose);
  }
}

export class BoolResultEditorNode extends ResultEditorNode {
  constructor () {
    super(GraphValueType.Bool);
  }
}

export class IDResultEditorNode extends ResultEditorNode {
  constructor () {
    super(GraphValueType.ID);
  }
}

export class FloatResultEditorNode extends ResultEditorNode {
  constructor () {
    super(GraphValueType.Float);
  }
}

export class VectorResultEditorNode extends ResultEditorNode {
  constructor () {
    super(GraphValueType.Vector);
  }
}

export class TargetResultEditorNode extends ResultEditorNode {
  constructor () {
    super(GraphValueType.Target);
  }
}

export class BoneMaskResultEditorNode extends ResultEditorNode {
  constructor () {
    super(GraphValueType.BoneMask);
  }
}
