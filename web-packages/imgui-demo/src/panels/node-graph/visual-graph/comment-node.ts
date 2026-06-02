import { BaseNode } from './base-graph';
import { ImGui } from '../../../imgui/index';
import type { DrawContext } from './drawing-context';
import { ResizeHandle } from './node-graph-view';
import type { UserContext } from './user-context';
import { ImLineClosestPoint } from './imgui-x';
import { subtract, length, lengthSqr, add } from '../bezier-math';

export type ImVec2 = ImGui.ImVec2;
export const ImVec2 = ImGui.ImVec2;

type Color = ImGui.Color;
const Color = ImGui.Color;

// Color palette for context menu (initialized once)
const paletteSize = 32;
let wasPaletteInitialized = false;
const palette: ImGui.interface_ImVec4[] = new Array(paletteSize);

function ensurePaletteInitialized (): void {
  if (wasPaletteInitialized) {
    return;
  }
  palette[0] = new ImGui.ImVec4(0x4C / 255, 0x4C / 255, 0x4C / 255, 1.0);
  for (let n = 1; n < paletteSize; n++) {
    const r: [number] = [0], g: [number] = [0], b: [number] = [0];

    ImGui.ColorConvertHSVtoRGB(n / 31.0, 0.8, 0.8, r, g, b);
    palette[n] = new ImGui.ImVec4(r[0], g[0], b[0], 1.0);
  }
  wasPaletteInitialized = true;
}

export class CommentNode extends BaseNode {
  static readonly s_resizeSelectionRadius: number = 10.0;
  static readonly s_minBoxDimensions: number = (CommentNode.s_resizeSelectionRadius * 2) + 20.0;

  m_commentBoxSize = new ImVec2(0, 0);
  private m_nodeColor: Color = new Color(0xFF4C4C4C);

  constructor () {
    super();
  }

  GetTypeName (): string {
    return 'Comment';
  }

  override IsRenameable (): boolean {
    return true;
  }

  getCommentBoxColor (): Color {
    return this.m_nodeColor;
  }

  drawContextMenuOptions (ctx: DrawContext, pUserContext: UserContext, mouseCanvasPos: ImVec2): boolean {
    ensurePaletteInitialized();

    let result = false;

    if (ImGui.BeginMenu(' Color')) {
      for (let n = 0; n < paletteSize; n++) {
        ImGui.PushID(n);
        if ((n % 8) !== 0) {
          ImGui.SameLine(0.0, ImGui.GetStyle().ItemSpacing.y);
        }

        const paletteButtonFlags = ImGui.ColorEditFlags.NoAlpha | ImGui.ColorEditFlags.NoPicker | ImGui.ColorEditFlags.NoTooltip;

        if (ImGui.ColorButton('##paletteOption', palette[n], paletteButtonFlags, new ImVec2(20, 20))) {
          this.m_nodeColor = new Color(palette[n].x, palette[n].y, palette[n].z, 1.0);
          result = true;
        }

        ImGui.PopID();
      }

      ImGui.EndMenu();
    }

    return result;
  }

  GetHoveredResizeHandle (ctx: DrawContext): ResizeHandle {
    const selectionThreshold = ctx.WindowToCanvas(CommentNode.s_resizeSelectionRadius);
    const cornerSelectionThreshold = selectionThreshold * 2;

    const nodeRect = this.GetRect();

    nodeRect.Expand(new ImVec2(selectionThreshold / 2, selectionThreshold / 2));

    const mousePos = ctx.m_mouseCanvasPos;

    // Corner tests first
    const distanceToCornerBR = length(subtract(mousePos, nodeRect.GetBR()));
    const distanceToCornerBL = length(subtract(mousePos, nodeRect.GetBL()));
    const distanceToCornerTR = length(subtract(mousePos, nodeRect.GetTR()));
    const distanceToCornerTL = length(subtract(mousePos, nodeRect.GetTL()));

    if (distanceToCornerBR < cornerSelectionThreshold) {
      return ResizeHandle.SE;
    } else if (distanceToCornerBL < cornerSelectionThreshold) {
      return ResizeHandle.SW;
    } else if (distanceToCornerTR < cornerSelectionThreshold) {
      return ResizeHandle.NE;
    } else if (distanceToCornerTL < cornerSelectionThreshold) {
      return ResizeHandle.NW;
    }

    // Edge tests
    const points = [
      ImLineClosestPoint(nodeRect.GetTL(), nodeRect.GetTR(), mousePos), // N
      ImLineClosestPoint(nodeRect.GetBL(), nodeRect.GetBR(), mousePos), // S
      ImLineClosestPoint(nodeRect.GetTL(), nodeRect.GetBL(), mousePos), // W
      ImLineClosestPoint(nodeRect.GetTR(), nodeRect.GetBR(), mousePos), // E
    ];

    const distancesSq = [
      lengthSqr(subtract(points[0], mousePos)),
      lengthSqr(subtract(points[1], mousePos)),
      lengthSqr(subtract(points[2], mousePos)),
      lengthSqr(subtract(points[3], mousePos)),
    ];

    const detectionDistanceSq = selectionThreshold * selectionThreshold;

    if (distancesSq[0] < detectionDistanceSq) {
      return ResizeHandle.N;
    } else if (distancesSq[1] < detectionDistanceSq) {
      return ResizeHandle.S;
    } else if (distancesSq[2] < detectionDistanceSq) {
      return ResizeHandle.W;
    } else if (distancesSq[3] < detectionDistanceSq) {
      return ResizeHandle.E;
    }

    return ResizeHandle.None;
  }

  getCommentBoxSize (): ImVec2 {
    return this.m_commentBoxSize;
  }

  AdjustSizeBasedOnMousePosition (ctx: DrawContext, handle: ResizeHandle): void {
    const unscaledBoxTL = this.GetPosition();
    const unscaledBoxBR = add(unscaledBoxTL, this.getCommentBoxSize());

    switch (handle) {
      case ResizeHandle.N: {
        this.m_canvasPosition.y = ctx.m_mouseCanvasPos.y;
        this.m_commentBoxSize.y = Math.max(CommentNode.s_minBoxDimensions, unscaledBoxBR.y - this.m_canvasPosition.y);
        this.m_canvasPosition.y = unscaledBoxBR.y - this.m_commentBoxSize.y;

        break;
      }
      case ResizeHandle.NE: {
        this.m_canvasPosition.y = ctx.m_mouseCanvasPos.y;
        this.m_commentBoxSize.y = Math.max(CommentNode.s_minBoxDimensions, unscaledBoxBR.y - this.m_canvasPosition.y);
        this.m_canvasPosition.y = unscaledBoxBR.y - this.m_commentBoxSize.y;
        this.m_commentBoxSize.x = Math.max(CommentNode.s_minBoxDimensions, ctx.m_mouseCanvasPos.x - unscaledBoxTL.x);

        break;
      }
      case ResizeHandle.E: {
        this.m_commentBoxSize.x = Math.max(CommentNode.s_minBoxDimensions, ctx.m_mouseCanvasPos.x - unscaledBoxTL.x);

        break;
      }
      case ResizeHandle.SE: {
        this.m_commentBoxSize.x = Math.max(CommentNode.s_minBoxDimensions, ctx.m_mouseCanvasPos.x - unscaledBoxTL.x);
        this.m_commentBoxSize.y = Math.max(CommentNode.s_minBoxDimensions, ctx.m_mouseCanvasPos.y - unscaledBoxTL.y);

        break;
      }
      case ResizeHandle.S: {
        this.m_commentBoxSize.y = Math.max(CommentNode.s_minBoxDimensions, ctx.m_mouseCanvasPos.y - unscaledBoxTL.y);

        break;
      }
      case ResizeHandle.SW: {
        this.m_canvasPosition.x = ctx.m_mouseCanvasPos.x;
        this.m_commentBoxSize.x = Math.max(CommentNode.s_minBoxDimensions, unscaledBoxBR.x - this.m_canvasPosition.x);
        this.m_canvasPosition.x = unscaledBoxBR.x - this.m_commentBoxSize.x;
        this.m_commentBoxSize.y = Math.max(CommentNode.s_minBoxDimensions, ctx.m_mouseCanvasPos.y - unscaledBoxTL.y);

        break;
      }
      case ResizeHandle.W: {
        this.m_canvasPosition.x = ctx.m_mouseCanvasPos.x;
        this.m_commentBoxSize.x = Math.max(CommentNode.s_minBoxDimensions, unscaledBoxBR.x - this.m_canvasPosition.x);
        this.m_canvasPosition.x = unscaledBoxBR.x - this.m_commentBoxSize.x;

        break;
      }
      case ResizeHandle.NW: {
        this.m_canvasPosition.x = ctx.m_mouseCanvasPos.x;
        this.m_commentBoxSize.x = Math.max(CommentNode.s_minBoxDimensions, unscaledBoxBR.x - this.m_canvasPosition.x);
        this.m_canvasPosition.x = unscaledBoxBR.x - this.m_commentBoxSize.x;

        this.m_canvasPosition.y = ctx.m_mouseCanvasPos.y;
        this.m_commentBoxSize.y = Math.max(CommentNode.s_minBoxDimensions, unscaledBoxBR.y - this.m_canvasPosition.y);
        this.m_canvasPosition.y = unscaledBoxBR.y - this.m_commentBoxSize.y;

        break;
      }
      default:
        break;
    }
  }
}
