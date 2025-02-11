import { generateGUID } from '@galacean/effects';
import { ImGui } from '../../../imgui/index';
import { DrawChannel, type DrawContext } from './drawing-context';
import { ImRect } from './im-rect';
import type { UUID } from './state-machine-graph';
import type { DragAndDropState } from './node-graph-view';
import { Style } from './node-graph-view';
import type { UserContext } from './user-context';
import { add, subtract } from '../bezier-math';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

type Color = ImGui.Color;
const Color = ImGui.Color;

export enum NodeVisualState {
  Active = 0,
  Selected,
  Hovered,
}

export abstract class BaseNode {
  m_ID: UUID;
  protected m_name: string;
  m_canvasPosition: ImVec2;
  m_size: ImVec2;
  m_titleRectSize: ImVec2;
  protected m_childGraph: BaseGraph | null;
  protected m_secondaryGraph: BaseGraph | null;
  m_pParentGraph: BaseGraph | null;
  private m_internalRegionStartY: number;
  private m_internalRegionColor: Color;
  private m_internalRegionMargins: [number, number];
  private m_regionStarted: boolean;
  m_isHovered: boolean;

  constructor () {
    this.m_ID = generateGUID();
    this.m_name = '';
    this.m_canvasPosition = new ImVec2(0, 0);
    this.m_size = new ImVec2(0, 0);
    this.m_titleRectSize = new ImVec2(0, 0);
    this.m_childGraph = null;
    this.m_secondaryGraph = null;
    this.m_pParentGraph = null;
    this.m_internalRegionStartY = -1.0;
    this.m_internalRegionColor = new Color();
    this.m_internalRegionMargins = [0, 0];
    this.m_regionStarted = false;
    this.m_isHovered = false;
  }

  Destroy (): void {
    if (this.m_pParentGraph) {
      this.m_pParentGraph.DestroyNode(this.m_ID);
    }
  }

  BeginModification (): void {
    this.m_pParentGraph?.BeginModification();
  }

  EndModification (): void {
    this.m_pParentGraph?.EndModification();
  }

  GetID (): UUID {
    return this.m_ID;
  }

  abstract GetTypeName (): string;

  GetName (): string {
    return this.m_name.length === 0 ? this.GetTypeName() : this.m_name;
  }

  GetCategory (): string | null {
    return null;
  }

  GetIcon (): string | null {
    return null;
  }

  IsRenameable (): boolean {
    return false;
  }

  RequiresUniqueName (): boolean {
    return false;
  }

  Rename (newName: string): void {
    if (!this.IsRenameable()) {
      throw new Error('Node is not renameable');
    }
    this.BeginModification();
    this.m_name = newName.length === 0 ? this.GetTypeName() : newName;
    if (this.RequiresUniqueName()) {
      this.m_name = this.CreateUniqueNodeName(this.m_name);
    }
    this.EndModification();
  }

  IsActive (pUserContext: UserContext): boolean {
    return false;
  }

  IsVisible (): boolean {
    return true;
  }

  IsHovered (): boolean {
    return this.m_isHovered;
  }

  IsUserCreatable (): boolean {
    return true;
  }

  IsDestroyable (): boolean {
    return this.IsUserCreatable();
  }

  GetStringPathFromRoot (): string {
    const path: BaseNode[] = [];

    this.TraverseHierarchy(path);

    return path.map(node => node.GetName()).join('/');
  }

  GetIDPathFromRoot (): UUID[] {
    const path: BaseNode[] = [];

    this.TraverseHierarchy(path);

    return path.map(node => node.GetID());
  }

  GetNodePathFromRoot (): BaseNode[] {
    const path: BaseNode[] = [];

    this.TraverseHierarchy(path);

    return path;
  }

  RegenerateIDs (IDMapping: Map<UUID, UUID>): UUID {
    const originalID = this.m_ID;

    this.m_ID = generateGUID();
    IDMapping.set(originalID, this.m_ID);

    if (this.m_childGraph) {
      this.m_childGraph.RegenerateIDs(IDMapping);
    }

    if (this.m_secondaryGraph) {
      this.m_secondaryGraph.RegenerateIDs(IDMapping);
    }

    return this.m_ID;
  }

  PostPaste (): void {}

  ResetCalculatedNodeSizes (): void {
    this.m_size = new ImVec2(0, 0);
    this.m_titleRectSize = new ImVec2(0, 0);
  }

  GetNodeMargin (): ImVec2 {
    return new ImVec2(8, 4);
  }

  GetPosition (): ImVec2 {
    return new ImVec2(this.m_canvasPosition.x, this.m_canvasPosition.y);
  }

  GetSize (): ImVec2 {
    return this.m_size;
  }

  GetWidth (): number {
    return this.m_size.x;
  }

  GetHeight (): number {
    return this.m_size.y;
  }

  GetRect (): ImRect {
    const nodeMargin = this.GetNodeMargin();
    const rectMin = subtract(this.m_canvasPosition, nodeMargin);
    const rectMax = add(add(this.m_canvasPosition, nodeMargin), this.m_size);

    return new ImRect(rectMin, rectMax);
  }

  SetPosition (newPosition: ImVec2): void {
    this.BeginModification();
    this.m_canvasPosition = newPosition;
    this.EndModification();
  }

  GetTitleBarColor (): Color {
    return Style.s_defaultTitleColor;
  }

  DrawInternalSeparatorColored (ctx: DrawContext, color: Color, preMarginY: number = -1, postMarginY: number = -1): void {
    const style = ImGui.GetStyle();
    const scaledPreMargin = ctx.CanvasToWindow(preMarginY < 0 ? 0 : preMarginY);
    const scaledPostMargin = ctx.CanvasToWindow(postMarginY < 0 ? style.ItemSpacing.y : postMarginY);

    ImGui.SetCursorPosY(ImGui.GetCursorPosY() + scaledPreMargin);

    const nodeWindowWidth = ctx.CanvasToWindow(this.GetWidth());

    if (nodeWindowWidth !== 0) {
      const cursorScreenPos = ctx.WindowToScreenPosition(ImGui.GetCursorPos());

      ctx.m_pDrawList!.AddLine(cursorScreenPos, add(cursorScreenPos, new ImVec2(nodeWindowWidth, 0)), color.toImU32());
    }

    ImGui.SetCursorPosY(ImGui.GetCursorPosY() + scaledPostMargin + 1);
  }

  DrawInternalSeparator (ctx: DrawContext, unscaledPreMarginY: number = -1, unscaledPostMarginY: number = -1): void {
    this.DrawInternalSeparatorColored(ctx, Style.s_genericNodeSeparatorColor, unscaledPreMarginY, unscaledPostMarginY);
  }

  BeginDrawInternalRegionColored (ctx: DrawContext, color: Color, preMarginY: number = -1, postMarginY: number = -1): void {
    if (this.m_regionStarted) {
      throw new Error('Region already started');
    }

    const style = ImGui.GetStyle();
    const scaledPreMargin = ctx.CanvasToWindow(preMarginY < 0 ? 0 : preMarginY);
    const scaledPostMargin = ctx.CanvasToWindow(postMarginY < 0 ? 0 : postMarginY);

    this.m_internalRegionStartY = ImGui.GetCursorPosY();
    this.m_internalRegionColor = color;
    this.m_internalRegionMargins = [scaledPreMargin, scaledPostMargin];
    this.m_regionStarted = true;

    ImGui.SetCursorPosY(ImGui.GetCursorPosY() + style.FramePadding.y + scaledPreMargin);
    ImGui.Indent();
  }

  BeginDrawInternalRegion (ctx: DrawContext, unscaledPreMarginY: number = -1, unscaledPostMarginY: number = -1): void {
    this.BeginDrawInternalRegionColored(ctx, Style.s_genericNodeInternalRegionDefaultColor, unscaledPreMarginY, unscaledPostMarginY);
  }

  EndDrawInternalRegion (ctx: DrawContext): void {
    if (!this.m_regionStarted) {
      throw new Error('No region started');
    }

    const style = ImGui.GetStyle();

    ImGui.SameLine();
    ImGui.Dummy(new ImVec2(style.IndentSpacing, 0));
    ImGui.Unindent();

    const scaledRectRounding = ctx.CanvasToWindow(3.0);

    const scaledFramePadding = style.FramePadding;
    const nodeWindowWidth = ctx.CanvasToWindow(this.GetWidth());
    const nodeMargin = ctx.CanvasToWindow(this.GetNodeMargin());

    const rectMin = ctx.WindowToScreenPosition(new ImVec2(ImGui.GetCursorPosX(), this.m_internalRegionStartY + this.m_internalRegionMargins[0]));
    const rectMax = add(rectMin, new ImVec2(nodeWindowWidth, ImGui.GetCursorPosY() - this.m_internalRegionStartY + scaledFramePadding.y - this.m_internalRegionMargins[0]));

    const previousChannel = ctx.currentChannel;

    ctx.SetDrawChannel(DrawChannel.ContentBackground);
    ctx.m_pDrawList!.AddRectFilled(rectMin, rectMax, this.m_internalRegionColor.toImU32(), scaledRectRounding);
    ctx.SetDrawChannel(previousChannel);

    ImGui.Dummy(new ImVec2(nodeWindowWidth, scaledFramePadding.y + this.m_internalRegionMargins[1]));

    this.m_internalRegionStartY = -1.0;
    this.m_internalRegionMargins = [0, 0];
    this.m_regionStarted = false;
  }

  GetRootGraph (): BaseGraph {
    let rootGraph: BaseGraph | null = this.m_pParentGraph;

    while (rootGraph && rootGraph.GetParentNode()) {
      rootGraph = rootGraph.GetParentNode()!.GetParentGraph();
    }

    return rootGraph!;
  }

  HasParentNode (): boolean {
    return this.m_pParentGraph !== null && this.m_pParentGraph.GetParentNode() !== null;
  }

  GetParentNode (): BaseNode | null {
    return this.m_pParentGraph ? this.m_pParentGraph.GetParentNode() : null;
  }

  HasParentGraph (): boolean {
    return this.m_pParentGraph !== null;
  }

  GetParentGraph (): BaseGraph | null {
    return this.m_pParentGraph;
  }

  HasChildGraph (): boolean {
    return this.m_childGraph !== null;
  }

  GetChildGraph (): BaseGraph | null {
    return this.m_childGraph;
  }

  HasSecondaryGraph (): boolean {
    return this.m_secondaryGraph !== null;
  }

  GetSecondaryGraph (): BaseGraph | null {
    return this.m_secondaryGraph;
  }

  protected CreateChildGraph<T extends BaseGraph>(constructor: new (...args: any[]) => T, ...params: any[]): T {
    if (this.HasChildGraph()) {
      throw new Error('Child graph already exists');
    }
    const graph = new constructor(...params);

    graph.m_ID = generateGUID();
    graph.m_pParentNode = this;
    this.m_childGraph = graph;

    return graph;
  }

  protected CreateSecondaryGraph<T extends BaseGraph>(constructor: new (...args: any[]) => T, ...params: any[]): T {
    if (this.HasSecondaryGraph()) {
      throw new Error('Secondary graph already exists');
    }
    const graph = new constructor(...params);

    graph.m_ID = generateGUID();
    graph.m_pParentNode = this;
    this.m_secondaryGraph = graph;

    return graph;
  }

  protected PostDeserialize (): void {
    if (this.m_childGraph) {
      this.m_childGraph.m_pParentNode = this;
    }
    if (this.m_secondaryGraph) {
      this.m_secondaryGraph.m_pParentNode = this;
    }
  }

  protected CreateUniqueNodeName (desiredName: string): string {
    let uniqueName = desiredName;

    if (this.m_pParentGraph) {
      uniqueName = this.m_pParentGraph.GetUniqueNameForRenameableNode(desiredName, this);
    }

    return uniqueName;
  }

  PreDrawUpdate (pUserContext: UserContext): void {}

  DrawExtraControls (ctx: DrawContext, pUserContext: UserContext): void {}

  OnShowNode (): void {}

  GetNavigationTarget (): BaseGraph | null {
    return this.GetChildGraph();
  }

  protected PreCopy (): void {}

  TraverseHierarchy (nodePath: BaseNode[]): void {
    nodePath.unshift(this);
    if (this.m_pParentGraph && !this.m_pParentGraph.IsRootGraph()) {
      this.m_pParentGraph.GetParentNode()?.TraverseHierarchy(nodePath);
    }
  }
}

export enum SearchMode {
  Localized,
  Recursive
}

export enum SearchTypeMatch {
  Exact,
  Derived
}

export class BaseGraph {
  private static s_onEndRootGraphModification: ((graph: BaseGraph) => void)[] = [];
  private static s_onBeginRootGraphModification: ((graph: BaseGraph) => void)[] = [];

  m_ID: UUID;
  protected m_subType: string;
  m_nodes: BaseNode[];
  m_viewOffset: ImVec2;
  m_viewScaleFactor: number;
  m_pParentNode: BaseNode | null;
  private m_beginModificationCallCount: number;

  constructor (pParentNode?: BaseNode) {
    this.m_ID = generateGUID();
    this.m_subType = '';
    this.m_nodes = [];
    this.m_viewOffset = new ImVec2(0, 0);
    this.m_viewScaleFactor = 1.0;
    this.m_pParentNode = pParentNode || null;
    this.m_beginModificationCallCount = 0;
  }

  static OnBeginRootGraphModification (): ((graph: BaseGraph) => void)[] {
    return BaseGraph.s_onBeginRootGraphModification;
  }

  static OnEndRootGraphModification (): ((graph: BaseGraph) => void)[] {
    return BaseGraph.s_onEndRootGraphModification;
  }

  BeginModification (): void {
    const rootGraph = this.GetRootGraph()!;

    if (rootGraph.m_beginModificationCallCount === 0) {
      BaseGraph.s_onBeginRootGraphModification.forEach(callback => callback(rootGraph));
    }
    rootGraph.m_beginModificationCallCount++;
  }

  EndModification (): void {
    const rootGraph = this.GetRootGraph()!;

    rootGraph.m_beginModificationCallCount--;
    if (rootGraph.m_beginModificationCallCount === 0) {
      BaseGraph.s_onEndRootGraphModification.forEach(callback => callback(rootGraph));
    }
  }

  GetID (): UUID {
    return this.m_ID;
  }

  GetName (): string {
    return this.HasParentNode() ? this.m_pParentNode!.GetName() : 'Root Graph';
  }

  GetCategory (): string {
    return this.m_subType;
  }

  SupportsComments (): boolean {
    return true;
  }

  IsRootGraph (): boolean {
    return !this.HasParentNode();
  }

  GetRootGraph (): BaseGraph | null {
    if (!this.m_pParentNode) {
      return this;
    }
    let rootGraph: BaseGraph | null = this.m_pParentNode.GetParentGraph();

    while (rootGraph && rootGraph.m_pParentNode !== null) {
      rootGraph = rootGraph.m_pParentNode.GetParentGraph();
    }

    return rootGraph;
  }

  GetStringPathFromRoot (): string {
    if (this.IsRootGraph()) {
      return '';
    }

    const path: BaseNode[] = [];

    this.m_pParentNode!.TraverseHierarchy(path);

    return path.reverse().map(node => node.GetName()).join('/');
  }

  GetIDPathFromRoot (): UUID[] {
    if (this.IsRootGraph()) {
      return [];
    }

    const path: BaseNode[] = [];

    this.m_pParentNode!.TraverseHierarchy(path);

    return path.map(node => node.GetID());
  }

  HasParentNode (): boolean {
    return this.m_pParentNode !== null;
  }

  GetParentNode (): BaseNode | null {
    return this.m_pParentNode;
  }

  RegenerateIDs (IDMapping: Map<UUID, UUID>): UUID {
    const originalID = this.m_ID;

    this.m_ID = generateGUID();
    IDMapping.set(originalID, this.m_ID);

    for (const node of this.m_nodes) {
      node.RegenerateIDs(IDMapping);
    }

    return this.m_ID;
  }

  GetNodes (): BaseNode[] {
    return [...this.m_nodes];
  }

  GetMostSignificantNode (): BaseNode | null {
    return null;
  }

  DestroyNode (nodeID: UUID): void {
    const index = this.m_nodes.findIndex(node => node.GetID() === nodeID);

    if (index !== -1) {
      this.BeginModification();
      const node = this.m_nodes[index];

      this.PreDestroyNode(node);
      node.m_pParentGraph = null;
      node.m_ID = '';
      this.m_nodes.splice(index, 1);
      this.PostDestroyNode(nodeID);
      this.EndModification();
    }
  }

  //   abstract CanCreateNode (pNodeTypeInfo: TypeInfo): boolean;

  isSubclassOf (derivedCtor: Function, baseCtor: Function): boolean {
    // eslint-disable-next-line no-prototype-builtins
    return derivedCtor === baseCtor || baseCtor.prototype.isPrototypeOf(derivedCtor.prototype);
  }

  CanCreateNode<T extends BaseNode>(classConstructor: new (...args: any[]) => T): boolean {
    return this.isSubclassOf(classConstructor, BaseNode);
  }

  CreateNode<T extends BaseNode>(constructor: new () => T): T;

  CreateNode<T extends BaseNode>(constructor: new (...args: any) => T, ...params: any): T;

  CreateNode<T extends BaseNode>(constructor: new (...args: any) => T, position: ImVec2, ...params: any): T;

  CreateNode<T extends BaseNode>(
    constructor: new (...args: any[]) => T,
    ...rest: any[]
  ): T {
    if (!this.CanCreateNode(constructor)) {
      throw new Error('Cannot create node of this type');
    }

    // 检查第一个rest参数是否是 ImVec2
    if (rest.length > 0 && rest[0] instanceof ImVec2) {
      const position = rest[0];
      const params = rest.slice(1);
      const node = new constructor(...params);

      this.CreateNodeInternal(node, position);

      return node;
    }

    // 直接使用参数创建节点
    const node = new constructor(...rest);

    this.CreateNodeInternal(node, ImVec2.ZERO);

    return node;
  }

  CanDestroyNode (pNode: BaseNode): boolean {
    return true;
  }

  OnShowGraph (): void {
    for (const node of this.m_nodes) {
      node.OnShowNode();
    }
  }

  FindNode (nodeID: UUID, checkRecursively: boolean = false): BaseNode | null {
    for (const node of this.m_nodes) {
      if (node.GetID() === nodeID) {
        return node;
      }

      if (checkRecursively) {
        if (node.HasChildGraph()) {
          const foundNode = node.GetChildGraph()!.FindNode(nodeID, true);

          if (foundNode) {
            return foundNode;
          }
        }

        if (node.HasSecondaryGraph()) {
          const foundNode = node.GetSecondaryGraph()!.FindNode(nodeID, true);

          if (foundNode) {
            return foundNode;
          }
        }
      }
    }

    return null;
  }

  FindPrimaryGraph (graphID: UUID): BaseGraph | null {
    if (this.m_ID === graphID) {
      return this;
    }

    for (const node of this.m_nodes) {
      if (node.HasChildGraph()) {
        const foundGraph = node.GetChildGraph()!.FindPrimaryGraph(graphID);

        if (foundGraph) {
          return foundGraph;
        }
      }
    }

    return null;
  }

  FindAllNodesOfType<T extends BaseNode> (classConstructor: new (...args: any[]) => T, results: BaseNode[] = [], mode: SearchMode = SearchMode.Localized, typeMatch: SearchTypeMatch = SearchTypeMatch.Exact): T[] {
    for (const node of this.m_nodes) {
      if (node instanceof classConstructor) {
        results.push(node);
      }

      if (mode === SearchMode.Recursive) {
        if (node.HasChildGraph()) {
          node.GetChildGraph()!.FindAllNodesOfType(classConstructor, results, mode, typeMatch);
        }

        if (node.HasSecondaryGraph()) {
          node.GetSecondaryGraph()!.FindAllNodesOfType(classConstructor, results, mode, typeMatch);
        }
      }
    }

    return results as T[];
  }

  FindAllNodesOfTypeAdvanced<T extends BaseNode> (classConstructor: new (...args: any[]) => T, matchFunction: (node: BaseNode) => boolean, results: BaseNode[], mode: SearchMode = SearchMode.Localized, typeMatch: SearchTypeMatch = SearchTypeMatch.Exact): void {
    for (const node of this.m_nodes) {
      if ((node instanceof classConstructor) && matchFunction(node)) {
        results.push(node);
      }

      if (mode === SearchMode.Recursive) {
        if (node.HasChildGraph()) {
          node.GetChildGraph()!.FindAllNodesOfTypeAdvanced(classConstructor, matchFunction, results, mode, typeMatch);
        }

        if (node.HasSecondaryGraph()) {
          node.GetSecondaryGraph()!.FindAllNodesOfTypeAdvanced(classConstructor, matchFunction, results, mode, typeMatch);
        }
      }
    }
  }

  IsUniqueNodeName (name: string): boolean {
    return !this.m_nodes.some(node => node.IsRenameable() && node.GetName() === name);
  }

  GetUniqueNameForRenameableNode (desiredName: string, nodeToIgnore: BaseNode | null = null): string {
    let uniqueName = desiredName;
    let counter = 1;

    while (!this.IsUniqueNodeName(uniqueName) || (nodeToIgnore && nodeToIgnore.GetName() === uniqueName)) {
      uniqueName = `${desiredName}${counter}`;
      counter++;
    }

    return uniqueName;
  }

  protected PostDeserialize (): void {
    for (const node of this.m_nodes) {
      node.m_pParentGraph = this;
    }
  }

  GetNavigationTarget (): BaseGraph | null {
    return this.m_pParentNode ? this.m_pParentNode.GetParentGraph() : null;
  }

  protected OnNodeAdded (pAddedNode: BaseNode): void {}

  OnNodeModified (pModifiedNode: BaseNode): void {}

  DrawExtraInformation (ctx: DrawContext, pUserContext: UserContext): void {}

  GetSupportedDragAndDropPayloadIDs (result: string[]): string[] {
    return result;
  }

  HandleDragAndDrop (pUserContext: UserContext, state: DragAndDropState): boolean {
    return true;
  }

  protected PostPasteNodes (pastedNodes: BaseNode[]): void {}

  protected PreDestroyNode (pNodeAboutToBeDestroyed: BaseNode): void {}

  protected PostDestroyNode (nodeID: UUID): void {}

  private CreateNodeInternal (pCreatedNode: BaseNode, position: ImVec2): void {
    pCreatedNode.m_ID = generateGUID();
    pCreatedNode.m_pParentGraph = this;
    pCreatedNode.SetPosition(position);

    this.BeginModification();
    this.m_nodes.push(pCreatedNode);

    if (pCreatedNode.IsRenameable()) {
      pCreatedNode.Rename(pCreatedNode.GetName());
    }

    this.OnNodeAdded(pCreatedNode);
    this.EndModification();
  }
}

export class ScopedNodeModification {
  private m_pNode: BaseNode;

  constructor (pNode: BaseNode) {
    if (pNode === null) {
      throw new Error('Node cannot be null');
    }
    this.m_pNode = pNode;
    this.m_pNode.BeginModification();
  }

  End (): void {
    const pParentGraph = this.m_pNode.GetParentGraph();

    if (pParentGraph !== null) {
      pParentGraph.OnNodeModified(this.m_pNode);
    }
    this.m_pNode.EndModification();
  }
}

export class ScopedGraphModification {
  private m_pGraph: BaseGraph;

  constructor (pGraph: BaseGraph) {
    if (pGraph === null) {
      throw new Error('Graph cannot be null');
    }
    this.m_pGraph = pGraph;
    this.m_pGraph.BeginModification();
  }

  End (): void {
    this.m_pGraph.EndModification();
  }
}