import { generateGUID } from '@galacean/effects';
import type { GraphModel } from './graph-model';
import { GraphNode } from './graph-model';
import type { UUID } from './graph-types';

export class GraphNodeSelection {
  m_nodeID: UUID;
  m_pNode: GraphNode | null;

  constructor (pNode?: GraphNode) {
    this.m_nodeID = pNode ? pNode.GetID() : generateGUID();
    this.m_pNode = pNode || null;
  }

  equals (rhs: GraphNodeSelection | GraphNode | null): boolean {
    if (rhs instanceof GraphNodeSelection) {
      return this.m_nodeID === rhs.m_nodeID;
    } else if (rhs instanceof GraphNode) {
      return this.m_nodeID === rhs.GetID();
    }

    return false;
  }
}

export class CustomCommand {
  m_pCommandSourceNode: GraphNode | null = null;
}

type EventHandler<T> = (arg: T) => void;
type EventHandlerTwoArgs<T, U> = (arg1: T, arg2: U) => void;

export class GraphEditorContext {
  m_isAltDown: boolean = false;
  m_isCtrlDown: boolean = false;
  m_isShiftDown: boolean = false;

  private m_extraGraphTitleInfo: string = '';
  private m_extraTitleInfoColor: number = 0;

  private m_navigateToNodeEvent: EventHandler<GraphNode>[] = [];
  private m_nodeDoubleClickedEvent: EventHandler<GraphNode>[] = [];
  private m_navigateToGraphEvent: EventHandler<GraphModel>[] = [];
  private m_graphDoubleClickedEvent: EventHandler<GraphModel>[] = [];
  //   private m_requestOpenResourceEvent: EventHandler<ResourceID>[] = [];
  private m_customCommandRequestedEvent: EventHandler<CustomCommand>[] = [];
  private m_postPasteEvent: EventHandler<GraphNode[]>[] = [];
  private m_selectionChangedEvent: EventHandlerTwoArgs<GraphNodeSelection[], GraphNodeSelection[]>[] = [];

  GetExtraGraphTitleInfoText (): string {
    return this.m_extraGraphTitleInfo;
  }

  SetExtraGraphTitleInfoText (newInfoText: string): void {
    this.m_extraGraphTitleInfo = newInfoText;
  }

  ClearExtraGraphTitleInfoText (): void {
    this.m_extraGraphTitleInfo = '';
  }

  GetExtraTitleInfoTextColor (): number {
    return this.m_extraTitleInfoColor;
  }

  SetExtraTitleInfoTextColor (newColor: number): void {
    this.m_extraTitleInfoColor = newColor;
  }

  //   ResetExtraTitleInfoTextColor (): void {
  //     this.m_extraTitleInfoColor = ImGuiX.Style.s_colorText;
  //   }

  ResetExtraTitleInfo (): void {
    this.ClearExtraGraphTitleInfoText();
    // this.ResetExtraTitleInfoTextColor();
  }

  NavigateTo (target: GraphNode | GraphModel): void {
    if (target instanceof GraphNode) {
      this.m_navigateToNodeEvent.forEach(handler => handler(target));
    } else {
      this.m_navigateToGraphEvent.forEach(handler => handler(target));
    }
  }

  DoubleClick (target: GraphNode | GraphModel): void {
    if (target instanceof GraphNode) {
      this.m_nodeDoubleClickedEvent.forEach(handler => handler(target));
    } else {
      this.m_graphDoubleClickedEvent.forEach(handler => handler(target));
    }
  }

  //   RequestOpenResource (resourceID: ResourceID): void {
  //     if (!resourceID.IsValid()) {
  //       throw new Error('Invalid ResourceID');
  //     }
  //     this.m_requestOpenResourceEvent.forEach(handler => handler(resourceID));
  //   }

  NotifySelectionChanged (oldSelection: GraphNodeSelection[], newSelection: GraphNodeSelection[]): void {
    this.m_selectionChangedEvent.forEach(handler => handler(oldSelection, newSelection));
  }

  NotifyNodesPasted (pastedNodes: GraphNode[]): void {
    this.m_postPasteEvent.forEach(handler => handler(pastedNodes));
  }

  RequestCustomCommand (pCommand: CustomCommand): void {
    this.m_customCommandRequestedEvent.forEach(handler => handler(pCommand));
  }

  OnNavigateToNode (handler: EventHandler<GraphNode>): void {
    this.m_navigateToNodeEvent.push(handler);
  }

  OnNodeDoubleClicked (handler: EventHandler<GraphNode>): void {
    this.m_nodeDoubleClickedEvent.push(handler);
  }

  OnNavigateToGraph (handler: EventHandler<GraphModel>): void {
    this.m_navigateToGraphEvent.push(handler);
  }

  OnGraphDoubleClicked (handler: EventHandler<GraphModel>): void {
    this.m_graphDoubleClickedEvent.push(handler);
  }

  //   OnRequestOpenResource (handler: EventHandler<ResourceID>): void {
  //     this.m_requestOpenResourceEvent.push(handler);
  //   }

  OnCustomCommandRequested (handler: EventHandler<CustomCommand>): void {
    this.m_customCommandRequestedEvent.push(handler);
  }

  OnPostPasteNodes (handler: EventHandler<GraphNode[]>): void {
    this.m_postPasteEvent.push(handler);
  }

  OnSelectionChanged (handler: EventHandlerTwoArgs<GraphNodeSelection[], GraphNodeSelection[]>): void {
    this.m_selectionChangedEvent.push(handler);
  }
}