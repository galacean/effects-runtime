import { generateGUID } from '@galacean/effects';
import type { UUID } from './state-machine-graph';
import { ImGui } from '../../../imgui/index';
import { BaseGraph, BaseNode } from './base-graph';
import { CommentNode } from './comment-node';
import type { DrawContext } from './drawing-context';
import type { UserContext } from './user-context';

export type ImVec2 = ImGui.ImVec2;
export const ImVec2 = ImGui.ImVec2;

type Color = ImGui.Color;
const Color = ImGui.Color;

export enum PinDirection {
  Input,
  Output,
  None
}

// Pin
//-------------------------------------------------------------------------

export class Pin {
  m_ID: UUID = generateGUID();
  m_name: string = '';
  m_type: string = '';
  m_isDynamic: boolean = false;
  m_allowMultipleOutConnections: boolean = false;
  m_userData: number = 0;
  m_position: ImVec2 = new ImVec2(0, 0);
  m_size: ImVec2 = new ImVec2(-1, -1);

  IsDynamicPin (): boolean {
    return this.m_isDynamic;
  }

  GetWidth (): number {
    return this.m_size.x;
  }

  GetHeight (): number {
    return this.m_size.y;
  }

  ResetCalculatedSizes (): void {
    this.m_position = ImVec2.ZERO;
    this.m_size = new ImVec2(-1, -1);
  }
}

// FlowNode
//-------------------------------------------------------------------------

export class FlowNode extends BaseNode {
  override GetTypeName (): string {
    throw new Error('Method not implemented.');
  }
  static readonly S_PinSelectionExtraRadius: number = 10.0;
  static readonly S_DefaultPinColor: number = 0xFF585858; // IM_COL32(88, 88, 88, 255)

  m_inputPins: Pin[] = [];
  m_outputPins: Pin[] = [];
  m_pHoveredPin: Pin | null = null;

  // Pin methods
  HasPin (pinID: UUID): boolean;
  HasPin (pin: Pin): boolean;
  HasPin (pinOrID: Pin | UUID): boolean {
    return typeof pinOrID === 'object'
      ? this.HasPin(pinOrID.m_ID)
      : this.HasInputPin(pinOrID) || this.HasOutputPin(pinOrID);
  }

  GetPinDirection (pinID: UUID): PinDirection;
  GetPinDirection (pin: Pin): PinDirection;
  GetPinDirection (pinOrID: Pin | UUID): PinDirection {
    const id = typeof pinOrID === 'object' ? pinOrID.m_ID : pinOrID;

    if (this.HasInputPin(id)) {
      return PinDirection.Input;
    }
    if (this.HasOutputPin(id)) {
      return PinDirection.Output;
    }

    return PinDirection.None;
  }

  // Input pin methods
  SupportsUserEditableDynamicInputPins (): boolean {
    return false;
  }

  GetNewDynamicInputPinName (): string {
    return 'Pin';
  }

  GetDynamicInputPinValueType (): string {
    return '';
  }

  GetNumInputPins (): number {
    return this.m_inputPins.length;
  }

  GetInputPins (): readonly Pin[] {
    return this.m_inputPins;
  }

  HasInputPin (pinID: UUID): boolean {
    return this.GetInputPin(pinID) !== null;
  }

  GetInputPin (pinIdx: number): Pin | null;
  GetInputPin (pinID: UUID): Pin | null;
  GetInputPin (pinIdxOrID: number | UUID): Pin | null {
    if (typeof pinIdxOrID === 'number') {
      return this.m_inputPins[pinIdxOrID] || null;
    } else {
      return this.m_inputPins.find(pin => pin.m_ID === pinIdxOrID) || null;
    }
  }

  GetInputPinIndex (pinID: UUID): number {
    return this.m_inputPins.findIndex(pin => pin.m_ID === pinID);
  }

  // Output pin methods
  GetNumOutputPins (): number {
    return this.m_outputPins.length;
  }

  GetOutputPins (): readonly Pin[] {
    return this.m_outputPins;
  }

  HasOutputPin (): boolean;
  HasOutputPin (pinID: UUID): boolean;
  HasOutputPin (pinID?: UUID): boolean {
    if (pinID === undefined) {
      return this.m_outputPins.length > 0;
    } else {
      return this.GetOutputPin(pinID) !== null;
    }
  }

  GetOutputPin (): Pin | null;
  GetOutputPin (pinIdx: number): Pin | null;
  GetOutputPin (pinID: UUID): Pin | null;
  GetOutputPin (pinIdxOrID?: number | UUID): Pin | null {
    if (pinIdxOrID === undefined) {
      return this.m_outputPins[0] || null;
    } else if (typeof pinIdxOrID === 'number') {
      return this.m_outputPins[pinIdxOrID] || null;
    } else {
      return this.m_outputPins.find(pin => pin.m_ID === pinIdxOrID) || null;
    }
  }

  GetOutputPinIndex (pinID: UUID): number {
    return this.m_outputPins.findIndex(pin => pin.m_ID === pinID);
  }

  // Connections
  //-------------------------------------------------------------------------

  GetConnectedInputNode<T extends FlowNode>(inputPinIdx: number): T | null {
    const pParentGraph = this.GetParentGraph() as FlowGraph;
    const node = pParentGraph.GetConnectedNodeForInputPin(this.m_inputPins[inputPinIdx].m_ID);

    return node as T;
  }

  IsValidConnection (inputPinID: UUID, fromNode: FlowNode, outputPinID: UUID): boolean {
    const inputPin = this.GetInputPin(inputPinID);
    const outputPin = fromNode.GetOutputPin(outputPinID);

    return inputPin?.m_type === outputPin?.m_type;
  }

  // Visual methods
  GetPinColor (pin: Pin): Color {
    return new Color(FlowNode.S_DefaultPinColor);
  }

  override ResetCalculatedNodeSizes (): void {
    super.ResetCalculatedNodeSizes();
    for (const pin of this.m_inputPins.concat(this.m_outputPins)) {
      pin.ResetCalculatedSizes();
    }
  }

  override RegenerateIDs (idMapping: Map<UUID, UUID>): UUID {
    const originalID = super.RegenerateIDs(idMapping);

    for (const pin of this.m_inputPins.concat(this.m_outputPins)) {
      const originalPinID = pin.m_ID;

      pin.m_ID = generateGUID();
      idMapping.set(originalPinID, pin.m_ID);
    }

    return originalID;
  }

  override EndModification (): void {
    if (this.HasParentGraph()) {
      this.RefreshDynamicPins();
    }
    super.EndModification();
  }

  DrawPinControls (ctx: DrawContext, userContext: UserContext, pin: Pin): boolean {
    return false;
  }

  DrawContextMenuOptions (ctx: DrawContext, userContext: UserContext, mouseCanvasPos: ImVec2, hoveredPin: Pin | null): void {}

  CreateDynamicInputPin (): void;
  CreateDynamicInputPin (pinName: string, pinType: string): void;
  CreateDynamicInputPin (pinName?: string, pinType?: string): void {
    const newPin = new Pin();

    newPin.m_name = pinName || this.GetNewDynamicInputPinName();
    newPin.m_type = pinType || this.GetDynamicInputPinValueType();
    newPin.m_isDynamic = true;
    this.m_inputPins.push(newPin);
    this.OnDynamicPinCreation(newPin.m_ID);
    this.RefreshDynamicPins();
  }

  DestroyDynamicInputPin (pinID: UUID): void {
    const pinIndex = this.GetInputPinIndex(pinID);

    if (pinIndex !== -1) {
      this.PreDynamicPinDestruction(pinID);
      this.m_inputPins.splice(pinIndex, 1);
      this.PostDynamicPinDestruction();
      this.RefreshDynamicPins();
    }
  }

  protected OnDynamicPinCreation (createdPinID: UUID): void {}
  protected PreDynamicPinDestruction (pinID: UUID): void {}
  protected PostDynamicPinDestruction (): void {}
  RefreshDynamicPins (): void {}

  protected CreateInputPin (pinName: string, pinType: string): void {
    const newPin = new Pin();

    newPin.m_name = pinName;
    newPin.m_type = pinType;
    this.m_inputPins.push(newPin);
  }

  protected CreateOutputPin (pinName: string, pinType: string, allowMultipleOutputConnections: boolean = false): void {
    const newPin = new Pin();

    newPin.m_name = pinName;
    newPin.m_type = pinType;
    newPin.m_allowMultipleOutConnections = allowMultipleOutputConnections;
    this.m_outputPins.push(newPin);
  }

  protected DestroyInputPin (pinIdx: number): void {
    if (pinIdx >= 0 && pinIdx < this.m_inputPins.length) {
      (this.GetParentGraph() as FlowGraph).BreakAnyConnectionsForPin(this.m_inputPins[pinIdx].m_ID);
      this.m_inputPins.splice(pinIdx, 1);
    }
  }

  protected DestroyOutputPin (pinIdx: number): void {
    if (pinIdx >= 0 && pinIdx < this.m_outputPins.length) {
      (this.GetParentGraph() as FlowGraph).BreakAnyConnectionsForPin(this.m_outputPins[pinIdx].m_ID);
      this.m_outputPins.splice(pinIdx, 1);
    }
  }

  protected DestroyPin (pinID: UUID): void {
    let pinIndex = this.GetInputPinIndex(pinID);

    if (pinIndex !== -1) {
      this.DestroyInputPin(pinIndex);

      return;
    }

    pinIndex = this.GetOutputPinIndex(pinID);
    if (pinIndex !== -1) {
      this.DestroyOutputPin(pinIndex);

      return;
    }

    throw new Error('Attempted to destroy non-existent pin');
  }

  ReorderInputPins (newOrder: UUID[]): void {
    this.ReorderPinArray(newOrder, this.m_inputPins);
  }

  ReorderOutputPins (newOrder: UUID[]): void {
    this.ReorderPinArray(newOrder, this.m_outputPins);
  }

  private ReorderPinArray (newOrder: UUID[], pins: Pin[]): void {
    const uniqueOrder = [...new Set(newOrder)];
    const pinsToReorder = pins.filter(pin => uniqueOrder.includes(pin.m_ID));
    const reorderedList = new Array(pinsToReorder.length);

    for (let i = 0; i < pinsToReorder.length; i++) {
      const pin = pinsToReorder[i];
      const newIndex = uniqueOrder.indexOf(pin.m_ID);

      reorderedList[newIndex] = pin;
    }

    for (let i = 0; i < pinsToReorder.length; i++) {
      const oldIndex = pins.indexOf(pinsToReorder[i]);

      pins[oldIndex] = reorderedList[i];
    }
  }
}

// FlowGraph
//-------------------------------------------------------------------------

export class Connection {
  m_ID: UUID = generateGUID();
  m_fromNodeID: UUID = '';
  m_outputPinID: UUID = '';
  m_toNodeID: UUID = '';
  m_inputPinID: UUID = '';

  IsValid (): boolean {
    return this.m_fromNodeID !== '' && this.m_outputPinID !== '' &&
               this.m_toNodeID !== '' && this.m_inputPinID !== '' ;
  }
}

export class FlowGraph extends BaseGraph {
  static readonly S_ConnectionsKey: string = 'Connections';

  m_connections: Connection[] = [];

  override CanCreateNode<T extends BaseNode>(classConstructor: new (...args: any[]) => T): boolean {
    return this.isSubclassOf(classConstructor, CommentNode) || this.isSubclassOf(classConstructor, FlowNode);
  }

  override PreDestroyNode (node: BaseNode): void {
    this.BreakAllConnectionsForNode(node.GetID());
    super.PreDestroyNode(node);
  }

  GetNode (nodeID: UUID): FlowNode | null {
    return this.FindNode(nodeID) as FlowNode | null;
  }

  GetNodeForPinID (pinID: UUID): FlowNode | null {
    for (const nodeInstance of this.m_nodes) {
      if (nodeInstance instanceof CommentNode) {
        continue;
      }

      if (nodeInstance instanceof FlowNode && nodeInstance.HasPin(pinID)) {
        return nodeInstance;
      }
    }

    return null;
  }

  CreateDynamicPin (nodeID: UUID): void {
    const node = this.GetNode(nodeID);

    if (node) {
      node.CreateDynamicInputPin();
    }
  }

  DestroyDynamicPin (nodeID: UUID, pinID: UUID): void {
    const node = this.GetNode(nodeID);

    if (node) {
      const pin = node.GetInputPin(pinID);

      if (pin && pin.IsDynamicPin()) {
        this.BreakAnyConnectionsForPin(pin.m_ID);
        node.DestroyDynamicInputPin(pin.m_ID);
      }
    }
  }

  IsValidConnection (fromNode: FlowNode, outputPin: Pin, toNode: FlowNode, inputPin: Pin): boolean;
  IsValidConnection (fromNodeID: UUID, outputPinID: UUID, toNodeID: UUID, inputPinID: UUID): boolean;
  IsValidConnection (fromNodeOrID: FlowNode | UUID, outputPinOrID: Pin | UUID, toNodeOrID: FlowNode | UUID, inputPinOrID: Pin | UUID): boolean {
    let fromNode: FlowNode | null, outputPin: Pin | null, toNode: FlowNode | null, inputPin: Pin | null;

    if (fromNodeOrID instanceof FlowNode && outputPinOrID instanceof Pin && toNodeOrID instanceof FlowNode && inputPinOrID instanceof Pin) {
      fromNode = fromNodeOrID;
      outputPin = outputPinOrID;
      toNode = toNodeOrID;
      inputPin = inputPinOrID;
    } else if (typeof fromNodeOrID === 'string' && typeof outputPinOrID === 'string' && typeof toNodeOrID === 'string' && typeof inputPinOrID === 'string') {
      fromNode = this.GetNode(fromNodeOrID);
      toNode = this.GetNode(toNodeOrID);
      if (!fromNode || !toNode) {return false;}
      outputPin = fromNode.GetOutputPin(outputPinOrID);
      inputPin = toNode.GetInputPin(inputPinOrID);
    } else {
      return false;
    }

    if (!fromNode || !outputPin || !toNode || !inputPin) {return false;}
    if (toNode === fromNode) {return false;}
    if (!toNode.IsValidConnection(inputPin.m_ID, fromNode, outputPin.m_ID)) {return false;}

    const connectedNodes: FlowNode[] = [];

    this.GetConnectedInputNodes(fromNode, connectedNodes);

    return !connectedNodes.includes(toNode);
  }

  TryMakeConnection (fromNode: FlowNode, outputPin: Pin, toNode: FlowNode, inputPin: Pin): boolean {
    if (!this.IsValidConnection(fromNode, outputPin, toNode, inputPin)) {
      return false;
    }

    if (!outputPin.m_allowMultipleOutConnections) {
      this.BreakAnyConnectionsForPin(outputPin.m_ID);
    }

    this.BreakAnyConnectionsForPin(inputPin.m_ID);

    const newConnection = new Connection();

    newConnection.m_fromNodeID = fromNode.GetID();
    newConnection.m_outputPinID = outputPin.m_ID;
    newConnection.m_toNodeID = toNode.GetID();
    newConnection.m_inputPinID = inputPin.m_ID;
    this.m_connections.push(newConnection);

    return true;
  }

  BreakConnection (connectionID: UUID): void {
    const index = this.m_connections.findIndex(conn => conn.m_ID === connectionID);

    if (index !== -1) {
      this.m_connections.splice(index, 1);
    } else {
      throw new Error('Attempted to break non-existent connection');
    }
  }

  BreakAnyConnectionsForPin (pinID: UUID): void {
    this.m_connections = this.m_connections.filter(conn =>
      conn.m_outputPinID !== pinID && conn.m_inputPinID !== pinID
    );
  }

  BreakAllConnectionsForNode (node: FlowNode): void;
  BreakAllConnectionsForNode (nodeID: UUID): void;
  BreakAllConnectionsForNode (nodeOrID: FlowNode | UUID): void {
    const nodeID = nodeOrID instanceof FlowNode ? nodeOrID.GetID() : nodeOrID;

    this.m_connections = this.m_connections.filter(conn =>
      conn.m_fromNodeID !== nodeID && conn.m_toNodeID !== nodeID
    );
  }

  GetConnectedNodeForInputPin (inputPinID: UUID): FlowNode | null {
    const connection = this.m_connections.find(conn => conn.m_inputPinID === inputPinID);

    if (connection) {
      return this.GetNode(connection.m_fromNodeID);
    }

    return null;
  }

  GetConnectionForInputPin (inputPinID: UUID): Connection | null {
    return this.m_connections.find(conn => conn.m_inputPinID === inputPinID) || null;
  }

  GetConnectedInputNodes (node: FlowNode, connectedNodes: FlowNode[] = []): boolean {
    for (const connection of this.m_connections) {
      if (connection.m_toNodeID !== node.GetID()) {
        continue;
      }

      const connectedNode = this.GetNode(connection.m_fromNodeID);

      if (!connectedNode) {
        continue;
      }

      if (connectedNodes.includes(connectedNode)) {
        return false; // Cycle detected
      }

      connectedNodes.push(connectedNode);

      if (!this.GetConnectedInputNodes(connectedNode, connectedNodes)) {
        return false; // Cycle detected in recursive call
      }
    }

    return true;
  }

  SupportsNodeCreationFromConnection (): boolean {
    return false;
  }

  DrawContextMenuOptions (ctx: DrawContext, userContext: UserContext, mouseCanvasPos: ImVec2, filterTokens: string[], sourceNode: FlowNode | null, sourcePin: Pin | null): boolean {
    return false;
  }

  HasContextMenuFilter (): boolean {
    return true;
  }

  protected override PostDeserialize (): void {
    super.PostDeserialize();

    // Refresh all dynamic pins
    for (const node of this.m_nodes) {
      if (node instanceof FlowNode) {
        node.RefreshDynamicPins();
      }
    }

    // Validate all connections
    this.m_connections = this.m_connections.filter(connection => {
      const fromNode = this.GetNode(connection.m_fromNodeID);
      const toNode = this.GetNode(connection.m_toNodeID);

      if (!fromNode || !toNode) {
        console.warn('Invalid connection detected and removed during deserialization');

        return false;
      }

      const outputPin = fromNode.GetOutputPin(connection.m_outputPinID);
      const inputPin = toNode.GetInputPin(connection.m_inputPinID);

      if (!outputPin || !inputPin) {
        console.warn('Invalid connection detected and removed during deserialization');

        return false;
      }

      return true;
    });
  }

  override RegenerateIDs (idMapping: Map<UUID, UUID>): UUID {
    const originalID = super.RegenerateIDs(idMapping);

    for (const connection of this.m_connections) {
      const originalConnectionID = connection.m_ID;

      connection.m_ID = generateGUID();
      idMapping.set(originalConnectionID, connection.m_ID);

      connection.m_fromNodeID = idMapping.get(connection.m_fromNodeID) || connection.m_fromNodeID;
      connection.m_outputPinID = idMapping.get(connection.m_outputPinID) || connection.m_outputPinID;
      connection.m_toNodeID = idMapping.get(connection.m_toNodeID) || connection.m_toNodeID;
      connection.m_inputPinID = idMapping.get(connection.m_inputPinID) || connection.m_inputPinID;
    }

    return originalID;
  }
}
