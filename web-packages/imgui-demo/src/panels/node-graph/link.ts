import { ImGui } from '../../imgui';
import { smart_bezier, smart_bezier_collider } from './bezier-math';
import type { ImNodeFlow } from './node-flow';
import type { Pin } from './pin';

/**
 * Link between two Pins of two different Nodes
 */
export class Link {
  private m_left: Pin;
  private m_right: Pin;
  private m_inf: ImNodeFlow;
  private m_hovered: boolean = false;
  private m_selected: boolean = false;
  private m_isDestroyed: boolean = false;

  constructor (left: Pin, right: Pin, inf: ImNodeFlow) {
    this.m_left = left;
    this.m_right = right;
    this.m_inf = inf;
  }

  /**
       * Destruction of a link
       * Deletes references of this links from connected pins
       */
  destroy (): void {
    this.m_isDestroyed = true;
    this.m_left.deleteLink();
  }

  isDestroyed () {
    return this.m_isDestroyed;
  }
  /**
       * Main update function
       * Draws the Link and updates Hovering and Selected status.
       */
  update (): void {
    const start: ImGui.ImVec2 = this.m_left.pinPoint();
    const end: ImGui.ImVec2 = this.m_right.pinPoint();
    const windowPos = ImGui.GetWindowPos();

    start.x += windowPos.x;
    start.y += windowPos.y;
    end.x += windowPos.x;
    end.y += windowPos.y;

    let thickness: number = this.m_left.getStyle().extra.link_thickness;
    const mouseClickState: boolean = this.m_inf.getSingleUseClick();

    const leftCtrlKeyCode = 17;

    if (!ImGui.IsKeyDown(leftCtrlKeyCode) && ImGui.IsMouseClicked(ImGui.ImGuiMouseButton.Left)) {
      this.m_selected = false;
    }

    if (smart_bezier_collider(ImGui.GetMousePos(), start, end, 2.5)) {
      this.m_hovered = true;
      thickness = this.m_left.getStyle().extra.link_hovered_thickness;
      if (mouseClickState) {
        this.m_inf.consumeSingleUseClick();
        this.m_selected = true;
      }
    } else {
      this.m_hovered = false;
    }

    if (this.m_selected) {
      smart_bezier(
        start,
        end,
        this.m_left.getStyle().extra.outline_color,
        thickness + this.m_left.getStyle().extra.link_selected_outline_thickness
      );
    }
    smart_bezier(start, end, this.m_left.getStyle().color, thickness);

    const deleteKeyCode = 8;

    if (this.m_selected && ImGui.IsKeyPressed(deleteKeyCode, false)) {
      this.m_right.deleteLink();
    }
  }

  /**
       * Get Left pin of the link
       * @returns Pointer to the Pin
       */
  getLeft (): Pin {
    return this.m_left;
  }

  /**
       * Get Right pin of the link
       * @returns Pointer to the Pin
       */
  getRight (): Pin {
    return this.m_right;
  }

  /**
       * Get hovering status
       * @returns TRUE If the link is hovered in the current frame
       */
  isHovered (): boolean {
    return this.m_hovered;
  }

  /**
       * Get selected status
       * @returns TRUE If the link is selected in the current frame
       */
  isSelected (): boolean {
    return this.m_selected;
  }
}