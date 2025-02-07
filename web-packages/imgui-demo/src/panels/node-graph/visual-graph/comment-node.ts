import { BaseNode } from './base-graph';
import { ImGui } from '../../../imgui/index';
import type { DrawContext } from './drawing-context';
import { ResizeHandle } from './node-graph-view';
import type { UserContext } from './user-context';

export type ImVec2 = ImGui.ImVec2;
export const ImVec2 = ImGui.ImVec2;

type Color = ImGui.Color;
const Color = ImGui.Color;

// TODO test class
export class CommentNode extends BaseNode {
  static readonly s_resizeSelectionRadius: number = 10.0;
  static readonly s_minBoxDimensions: number = (CommentNode.s_resizeSelectionRadius * 2) + 20.0;

  private m_commentBoxSize = new ImVec2(0, 0);
  private m_nodeColor: Color = new Color(0xFF4C4C4C);

  constructor () {
    super();
  }

  GetTypeName (): string {
    return 'Comment';
  }

  protected isRenameable (): boolean {
    return true;
  }

  getCommentBoxColor (): Color {
    return this.m_nodeColor;
  }

  drawContextMenuOptions (ctx: DrawContext, pUserContext: UserContext, mouseCanvasPos: ImVec2): boolean {
    // 这个方法的实现会在后面提供
    return false;
  }

  GetHoveredResizeHandle (ctx: DrawContext): ResizeHandle {
    // 这个方法的实现会在后面提供
    return ResizeHandle.None;
  }

  getCommentBoxSize (): ImVec2 {
    return this.m_commentBoxSize;
  }

  AdjustSizeBasedOnMousePosition (ctx: DrawContext, handle: ResizeHandle): void {
    // 这个方法的实现会在后面提供
  }
}