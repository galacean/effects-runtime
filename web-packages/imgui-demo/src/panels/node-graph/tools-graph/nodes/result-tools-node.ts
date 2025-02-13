import type { GraphCompilationContext } from '../../compilation';
import { FlowToolsNode, GraphType, GraphValueType, InvalidIndex } from './flow-tools-node';

export class ResultToolsNode extends FlowToolsNode {

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

  override Compile (context: GraphCompilationContext): number {
    // Get connected node and compile it
    const pConnectedNode = this.GetConnectedInputNode<FlowToolsNode>(0);

    if (pConnectedNode !== null) {
      return pConnectedNode.Compile(context);
    }

    return InvalidIndex;
  }
}

//-------------------------------------------------------------------------

export class PoseResultToolsNode extends ResultToolsNode {
  constructor () {
    super(GraphValueType.Pose);
  }
}

//-------------------------------------------------------------------------

export class BoolResultToolsNode extends ResultToolsNode {
  constructor () {
    super(GraphValueType.Bool);
  }
}

//-------------------------------------------------------------------------

export class IDResultToolsNode extends ResultToolsNode {
  constructor () {
    super(GraphValueType.ID);
  }
}

//-------------------------------------------------------------------------

export class FloatResultToolsNode extends ResultToolsNode {
  constructor () {
    super(GraphValueType.Float);
  }
}

//-------------------------------------------------------------------------

export class VectorResultToolsNode extends ResultToolsNode {
  constructor () {
    super(GraphValueType.Vector);
  }
}

//-------------------------------------------------------------------------

export class TargetResultToolsNode extends ResultToolsNode {
  constructor () {
    super(GraphValueType.Target);
  }
}

//-------------------------------------------------------------------------

export class BoneMaskResultToolsNode extends ResultToolsNode {
  constructor () {
    super(GraphValueType.BoneMask);
  }
}