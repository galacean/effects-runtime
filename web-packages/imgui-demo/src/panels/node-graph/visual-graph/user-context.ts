import { generateGUID } from '@galacean/effects';
import type { BaseGraph } from './base-graph';
import { BaseNode } from './base-graph';
import type { UUID } from './state-machine-graph';

export class SelectedNode {
  m_nodeID: UUID;
  m_pNode: BaseNode | null;

  constructor (pNode?: BaseNode) {
    this.m_nodeID = pNode ? pNode.GetID() : generateGUID();
    this.m_pNode = pNode || null;
  }

  equals (rhs: SelectedNode | BaseNode | null): boolean {
    if (rhs instanceof SelectedNode) {
      return this.m_nodeID === rhs.m_nodeID;
    } else if (rhs instanceof BaseNode) {
      return this.m_nodeID === rhs.GetID();
    }

    return false;
  }
}

export class CustomCommand {
  m_pCommandSourceNode: BaseNode | null = null;
}

type EventHandler<T> = (arg: T) => void;
type EventHandlerTwoArgs<T, U> = (arg1: T, arg2: U) => void;

export class UserContext {
  m_isAltDown: boolean = false;
  m_isCtrlDown: boolean = false;
  m_isShiftDown: boolean = false;

  private m_extraGraphTitleInfo: string = '';
  private m_extraTitleInfoColor: number = 0;

  private m_navigateToNodeEvent: EventHandler<BaseNode>[] = [];
  private m_nodeDoubleClickedEvent: EventHandler<BaseNode>[] = [];
  private m_navigateToGraphEvent: EventHandler<BaseGraph>[] = [];
  private m_graphDoubleClickedEvent: EventHandler<BaseGraph>[] = [];
  //   private m_requestOpenResourceEvent: EventHandler<ResourceID>[] = [];
  private m_customCommandRequestedEvent: EventHandler<CustomCommand>[] = [];
  private m_postPasteEvent: EventHandler<BaseNode[]>[] = [];
  private m_selectionChangedEvent: EventHandlerTwoArgs<SelectedNode[], SelectedNode[]>[] = [];

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

  NavigateTo (target: BaseNode | BaseGraph): void {
    if (target instanceof BaseNode) {
      this.m_navigateToNodeEvent.forEach(handler => handler(target));
    } else {
      this.m_navigateToGraphEvent.forEach(handler => handler(target));
    }
  }

  DoubleClick (target: BaseNode | BaseGraph): void {
    if (target instanceof BaseNode) {
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

  NotifySelectionChanged (oldSelection: SelectedNode[], newSelection: SelectedNode[]): void {
    this.m_selectionChangedEvent.forEach(handler => handler(oldSelection, newSelection));
  }

  NotifyNodesPasted (pastedNodes: BaseNode[]): void {
    this.m_postPasteEvent.forEach(handler => handler(pastedNodes));
  }

  RequestCustomCommand (pCommand: CustomCommand): void {
    this.m_customCommandRequestedEvent.forEach(handler => handler(pCommand));
  }

  OnNavigateToNode (handler: EventHandler<BaseNode>): void {
    this.m_navigateToNodeEvent.push(handler);
  }

  OnNodeDoubleClicked (handler: EventHandler<BaseNode>): void {
    this.m_nodeDoubleClickedEvent.push(handler);
  }

  OnNavigateToGraph (handler: EventHandler<BaseGraph>): void {
    this.m_navigateToGraphEvent.push(handler);
  }

  OnGraphDoubleClicked (handler: EventHandler<BaseGraph>): void {
    this.m_graphDoubleClickedEvent.push(handler);
  }

  //   OnRequestOpenResource (handler: EventHandler<ResourceID>): void {
  //     this.m_requestOpenResourceEvent.push(handler);
  //   }

  OnCustomCommandRequested (handler: EventHandler<CustomCommand>): void {
    this.m_customCommandRequestedEvent.push(handler);
  }

  OnPostPasteNodes (handler: EventHandler<BaseNode[]>): void {
    this.m_postPasteEvent.push(handler);
  }

  OnSelectionChanged (handler: EventHandlerTwoArgs<SelectedNode[], SelectedNode[]>): void {
    this.m_selectionChangedEvent.push(handler);
  }
}