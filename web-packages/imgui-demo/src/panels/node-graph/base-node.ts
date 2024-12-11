import { ImGui } from '../../imgui';
import { add, multiplyScalar, subtract } from './bezier-math';
import type { ImNodeFlow } from './node-flow';
import type { PinUID } from './pin';
import { InPin, OutPin, PinStyle, type Pin } from './pin';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

type ImColor = ImGui.ImColor;
const ImColor = ImGui.ImColor;

export type NodeUID = number; // Equivalent to uintptr_t

/**
 * Defines the visual appearance of a node
 */
export class NodeStyle {
  bg: number = ImGui.IM_COL32(55, 64, 75, 255); // Body's background color
  header_bg: number; // Header's background color
  header_title_color: ImColor; // Header title color
  border_color: number = ImGui.IM_COL32(30, 38, 41, 140); // Border color
  border_selected_color: number = ImGui.IM_COL32(170, 190, 205, 230); // Border color when selected

  padding: ImGui.ImVec4; // Body's content padding (Left, Top, Right, Bottom)
  radius: number; // Edges rounding
  border_thickness: number = -1.35; // Border thickness
  border_selected_thickness: number = 2.0; // Border thickness when selected

  constructor (
    header_bg: number,
    header_title_color: ImColor,
    radius: number
  ) {
    this.header_bg = header_bg;
    this.header_title_color = header_title_color;
    this.radius = radius;
    this.padding = new ImGui.ImVec4(13.7, 6.0, 13.7, 2.0);
  }

  // Static methods for default styles
  static cyan (): NodeStyle {
    return new NodeStyle(
      ImGui.IM_COL32(71, 142, 173, 255),
      new ImColor(233, 241, 244, 255),
      6.5
    );
  }

  static green (): NodeStyle {
    return new NodeStyle(
      ImGui.IM_COL32(90, 191, 93, 255),
      new ImColor(233, 241, 244, 255),
      3.5
    );
  }

  static red (): NodeStyle {
    return new NodeStyle(
      ImGui.IM_COL32(191, 90, 90, 255),
      new ImColor(233, 241, 244, 255),
      11.0
    );
  }

  static brown (): NodeStyle {
    return new NodeStyle(
      ImGui.IM_COL32(191, 134, 90, 255),
      new ImColor(233, 241, 244, 255),
      6.5
    );
  }
}

/**
 * Parent class for custom nodes
 * Main class from which custom nodes can be created. All interactions with the main grid are handled internally.
 */
export abstract class BaseNode {
  private static uidCounter: number = 1; // Static counter for unique IDs

  private m_uid: NodeUID = 0;
  private m_title: string;
  private m_pos: ImGui.ImVec2;
  private m_posTarget: ImGui.ImVec2;
  private m_size: ImGui.ImVec2;
  private m_inf: ImNodeFlow;
  private m_style: NodeStyle | null = null;
  private m_selected: boolean = false;
  private m_selectedNext: boolean = false;
  private m_dragged: boolean = false;
  private m_destroyed: boolean = false;

  private m_ins: Pin[] = [];
  private m_dynamicIns: [number, Pin][] = [];
  private m_outs: Pin[] = [];
  private m_dynamicOuts: [number, Pin][] = [];

  constructor (inf: ImNodeFlow) {
    this.m_title = 'BaseNode';
    this.m_pos = new ImGui.ImVec2(0.0, 0.0);
    this.m_posTarget = new ImGui.ImVec2(0.0, 0.0);
    this.m_size = new ImGui.ImVec2(100.0, 100.0);
    this.m_inf = inf;
  }

  /**
       * Main loop of the node
       * Updates position, hovering and selected status, and renders the node. Must be called each frame.
       */
  update (): void {
    const draw_list = ImGui.GetWindowDrawList();

    const windowPos = ImGui.GetWindowPos();

    ImGui.PushID(this.getUID());
    const mouseClickState: boolean = this.m_inf?.getSingleUseClick() ?? false;
    let offset: ImGui.ImVec2 = this.m_inf?.grid2screen(new ImVec2()) ?? new ImVec2();
    const paddingTL: ImGui.ImVec2 = this.m_style ? new ImGui.ImVec2(this.m_style.padding.x, this.m_style.padding.y) : new ImGui.ImVec2(3.0, 1.0);
    const paddingBR: ImGui.ImVec2 = this.m_style ? new ImGui.ImVec2(this.m_style.padding.z, this.m_style.padding.w) : new ImGui.ImVec2(3.0, 1.0);

    // TODO opt this *********************
    const windowSpacePos = add(offset, this.m_pos);
    const windowCenter = multiplyScalar(ImGui.GetWindowSize(), 0.5);
    const centerSpacePos = subtract(windowSpacePos, windowCenter);
    let scaledPos = multiplyScalar(centerSpacePos, this.m_inf.getGrid().scale());

    scaledPos = add(scaledPos, windowCenter);
    offset = subtract(scaledPos, this.m_pos);
    // *********************

    // Foreground
    draw_list.ChannelsSetCurrent(1);
    ImGui.SetCursorPos(new ImGui.ImVec2(offset.x + this.m_pos.x, offset.y + this.m_pos.y));

    ImGui.BeginGroup();

    // Header
    ImGui.BeginGroup();
    ImGui.TextColored(this.m_style?.header_title_color ?? new ImGui.ImColor(1, 1, 1, 1), this.m_title);
    ImGui.Spacing();
    ImGui.EndGroup();
    const headerH: number = ImGui.GetItemRectSize().y;
    const titleW: number = ImGui.GetItemRectSize().x;

    // Inputs
    ImGui.BeginGroup();
    for (const p of this.m_ins) {
      p.setPos(new ImGui.ImVec2(ImGui.GetCursorPos().x, ImGui.GetCursorPos().y));
      p.update();
    }
    for (const p of this.m_dynamicIns) {
      if (p[0] === 1) {
        p[1].setPos(new ImGui.ImVec2(ImGui.GetCursorPos().x, ImGui.GetCursorPos().y));
        p[1].update();
        p[0] = 0;
      }
    }
    ImGui.EndGroup();
    ImGui.SameLine();

    // Content
    ImGui.BeginGroup();
    this.draw();
    ImGui.Dummy(new ImGui.ImVec2(0.0, 0.0));
    ImGui.EndGroup();
    ImGui.SameLine();

    // Outputs
    let maxW: number = 0.0;

    for (const p of this.m_outs) {
      const w = p.calcWidth();

      if (w > maxW) {maxW = w;}
    }
    for (const p of this.m_dynamicOuts) {
      const w = p[1].calcWidth();

      if (w > maxW) {maxW = w;}
    }

    ImGui.BeginGroup();
    for (const p of this.m_outs) {
      // FIXME: This looks horrible
      if ((this.m_pos.x + offset.x + titleW) <
                  (ImGui.GetCursorPos().x + maxW)) {
        p.setPos(new ImGui.ImVec2(
          ImGui.GetCursorPos().x + (maxW - p.calcWidth()),
          ImGui.GetCursorPos().y
        ));
      } else {
        p.setPos(new ImGui.ImVec2(
          this.m_pos.x + offset.x + (titleW - p.calcWidth()),
          ImGui.GetCursorPos().y
        ));
      }
      p.update();
    }
    for (const p of this.m_dynamicOuts) {
      // FIXME: This looks horrible
      if ((this.m_pos.x + offset.x + titleW) <
                  (ImGui.GetCursorPos().x + ImGui.GetWindowPos().x + maxW)) {
        p[1].setPos(new ImGui.ImVec2(
          ImGui.GetCursorPos().x + ImGui.GetWindowPos().x + (maxW - p[1].calcWidth()),
          ImGui.GetCursorPos().y + ImGui.GetWindowPos().y
        ));
      } else {
        p[1].setPos(new ImGui.ImVec2(
          this.m_pos.x + offset.x + (titleW - p[1].calcWidth()),
          ImGui.GetCursorPos().y + ImGui.GetWindowPos().y
        ));
      }
      p[1].update();
      p[0] -= 1;
    }

    ImGui.EndGroup();
    ImGui.EndGroup();

    this.m_size = ImGui.GetItemRectSize();
    const headerSize: ImGui.ImVec2 = new ImGui.ImVec2(this.m_size.x + (paddingBR.x ?? 0.0), headerH);

    // Background
    this.m_pos.x += windowPos.x;
    this.m_pos.y += windowPos.y;
    draw_list.ChannelsSetCurrent(0);
    draw_list.AddRectFilled(
      new ImGui.ImVec2(offset.x + this.m_pos.x - paddingTL.x, offset.y + this.m_pos.y - paddingTL.y),
      new ImGui.ImVec2(offset.x + this.m_pos.x + this.m_size.x + paddingBR.x, offset.y + this.m_pos.y + this.m_size.y + paddingBR.y),
      this.m_style?.bg ?? ImGui.IM_COL32(0, 0, 0, 0),
      this.m_style?.radius ?? 0.0
    );
    draw_list.AddRectFilled(
      new ImGui.ImVec2(offset.x + this.m_pos.x - paddingTL.x, offset.y + this.m_pos.y - paddingTL.y),
      new ImGui.ImVec2(offset.x + this.m_pos.x + headerSize.x, offset.y + this.m_pos.y + headerSize.y),
      this.m_style?.header_bg ?? ImGui.IM_COL32(0, 0, 0, 0),
      this.m_style?.radius ?? 0.0,
      ImGui.DrawCornerFlags.Top
    );
    this.m_pos.x -= windowPos.x;
    this.m_pos.y -= windowPos.y;

    let col: number = this.m_style?.border_color ?? ImGui.IM_COL32(0, 0, 0, 0);
    let thickness: number = this.m_style?.border_thickness ?? 1.0;
    const ptl: ImGui.ImVec2 = new ImGui.ImVec2(paddingTL.x, paddingTL.y);
    const pbr: ImGui.ImVec2 = new ImGui.ImVec2(paddingBR.x, paddingBR.y);

    if (this.m_selected) {
      col = this.m_style?.border_selected_color ?? col;
      thickness = this.m_style?.border_selected_thickness ?? thickness;
    }
    if (thickness < 0.0) {
      ptl.x -= thickness / 2;
      ptl.y -= thickness / 2;
      pbr.x -= thickness / 2;
      pbr.y -= thickness / 2;
      thickness *= -1.0;
    }

    this.m_pos.x += windowPos.x;
    this.m_pos.y += windowPos.y;
    draw_list.AddRect(
      new ImGui.ImVec2(offset.x + this.m_pos.x - ptl.x, offset.y + this.m_pos.y - ptl.y),
      new ImGui.ImVec2(offset.x + this.m_pos.x + this.m_size.x + pbr.x, offset.y + this.m_pos.y + this.m_size.y + pbr.y),
      col,
      this.m_style?.radius ?? 0.0,
      0,
      thickness
    );
    this.m_pos.x -= windowPos.x;
    this.m_pos.y -= windowPos.y;

    const leftCtrlKeyCode = 17;

    // Handle selection and dragging logic
    if (
      ImGui.IsWindowHovered() &&
              !ImGui.IsKeyDown(leftCtrlKeyCode) &&
              ImGui.IsMouseClicked(ImGui.ImGuiMouseButton.Left) &&
              !(this.m_inf?.on_selected_node() ?? false)
    ) {
      this.selected(false);
    }

    if (this.isHovered()) {
      this.m_inf?.hoveredNode(this);
      if (mouseClickState) {
        this.selected(true);
        this.m_inf?.consumeSingleUseClick();
      }
    }

    if (
      ImGui.IsWindowFocused() &&
              ImGui.IsKeyPressed(ImGui.ImGuiKey.Delete) &&
              !ImGui.IsAnyItemActive() &&
              this.isSelected()
    ) {
      this.destroy();
    }

    const onHeader: boolean = ImGui.IsMouseHoveringRect(
      new ImGui.ImVec2(offset.x + this.m_pos.x - paddingTL.x + windowPos.x, offset.y + this.m_pos.y - paddingTL.y + windowPos.y),
      new ImGui.ImVec2(offset.x + this.m_pos.x + headerSize.x + windowPos.x, offset.y + this.m_pos.y + headerSize.y + windowPos.y)
    );

    if (onHeader && mouseClickState) {
      this.m_inf?.consumeSingleUseClick();
      this.m_dragged = true;
      this.m_inf?.draggingNode(true);

      // TODO test logic, remove
      this.m_style!.header_bg = ImGui.IM_COL32(255, 38, 41, 140);
    }

    if (this.m_dragged || (this.m_selected && this.m_inf?.isNodeDragged())) {
      const step: number = (this.m_inf?.getStyle().grid_size ?? 50) / (this.m_inf?.getStyle().grid_subdivisions ?? 5);

      this.m_posTarget.x += ImGui.GetIO().MouseDelta.x;
      this.m_posTarget.y += ImGui.GetIO().MouseDelta.y;

      // "Slam" The position
      this.m_pos.x = Math.round(this.m_posTarget.x / step) * step;
      this.m_pos.y = Math.round(this.m_posTarget.y / step) * step;

      if (ImGui.IsMouseReleased(ImGui.ImGuiMouseButton.Left)) {
        // TODO test logic, remove
        this.m_style!.header_bg = ImGui.IM_COL32(71, 142, 173, 255);
        this.m_dragged = false;
        this.m_inf?.draggingNode(false);
        this.m_posTarget.x = this.m_pos.x;
        this.m_posTarget.y = this.m_pos.y;
      }
    }

    ImGui.PopID();

    // Deleting dead pins
    this.m_dynamicIns = this.m_dynamicIns.filter(p => p[0] !== 0);
    this.m_dynamicOuts = this.m_dynamicOuts.filter(p => p[0] !== 0);
  }

  /**
       * Content of the node
       * Function to be implemented by derived custom nodes.
       * Must contain the body of the node. If left empty the node will only have input and output pins.
       */
  abstract draw (): void;

  // ------------------------------------------------
  // Input Methods

  /**
       * Add an Input to the node
       */
  addIN<T>(
    name: string,
    defReturn: T,
    filter: (out: Pin, input: Pin) => boolean,
    style: PinStyle | null = null
  ): InPin<T> {
    const uid: PinUID = BigInt(BaseNode.uidCounter++);
    const pin = new InPin<T>(uid, name, defReturn, filter, style ?? PinStyle.cyan(), this, this.m_inf);

    this.m_ins.push(pin);

    return pin;
  }

  /**
       * Add an Input to the node with UID
       */
  addIN_uid<T, U>(
    uid: U,
    name: string,
    defReturn: T,
    filter: (out: Pin, input: Pin) => boolean,
    style: PinStyle | null = null
  ): InPin<T> {
    const pinUid: PinUID = BigInt(uid as any); // Assume U can be converted to bigint
    const pin = new InPin<T>(pinUid, name, defReturn, filter, style ?? PinStyle.cyan(), this, this.m_inf);

    this.m_ins.push(pin);

    return pin;
  }

  /**
       * Remove input pin by UID
       */
  dropIN<U>(uid: U): void {
    const pinUid: PinUID = BigInt(uid as any);

    this.m_ins = this.m_ins.filter(pin => pin.getUid() !== pinUid);
  }

  /**
       * Remove input pin by name
       */
  dropINByString (uid: string): void {
    this.dropIN<string>(uid);
  }

  /**
       * Show a temporary input pin
       */
  showIN<T>(
    name: string,
    defReturn: T,
    filter: (out: Pin, input: Pin) => boolean,
    style: PinStyle | null = null
  ): T {
    const existingPin = this.m_ins.find(p => p.getName() === name);

    if (existingPin && existingPin instanceof InPin) {
      return existingPin.val();
    } else {
      const newPin = this.addIN<T>(name, defReturn, filter, style);

      // 实现显示输入逻辑，例如渲染Pin
      newPin.update(); // 更新并渲染Pin

      return defReturn;
    }
  }

  /**
       * Show a temporary input pin with UID
       */
  showIN_uid<T, U>(
    uid: U,
    name: string,
    defReturn: T,
    filter: (out: Pin, input: Pin) => boolean,
    style: PinStyle | null = null
  ): T {
    const pinUid: PinUID = BigInt(uid as any);
    const existingPin = this.m_ins.find(p => p.getUid() === pinUid);

    if (existingPin && existingPin instanceof InPin) {
      return existingPin.val();
    } else {
      const newPin = this.addIN_uid<T, U>(uid, name, defReturn, filter, style);

      // 实现显示输入逻辑，例如渲染Pin
      newPin.update(); // 更新并渲染Pin

      return defReturn;
    }
  }

  // ------------------------------------------------
  // Output Methods

  /**
       * Add an Output to the node
       */
  addOUT<T>(
    name: string,
    style: PinStyle | null = null
  ): OutPin<T> {
    const uid: PinUID = BigInt(BaseNode.uidCounter++);
    const pin = new OutPin<T>(uid, name, style ?? PinStyle.cyan(), this, this.m_inf);

    this.m_outs.push(pin);

    return pin;
  }

  /**
       * Add an Output to the node with UID
       */
  addOUT_uid<T, U>(
    uid: U,
    name: string,
    style: PinStyle | null = null
  ): OutPin<T> {
    const pinUid: PinUID = BigInt(uid as any);
    const pin = new OutPin<T>(pinUid, name, style ?? PinStyle.cyan(), this, this.m_inf);

    this.m_outs.push(pin);

    return pin;
  }

  /**
       * Remove output pin by UID
       */
  dropOUT<U>(uid: U): void {
    const pinUid: PinUID = BigInt(uid as any);

    this.m_outs = this.m_outs.filter(pin => pin.getUid() !== pinUid);
  }

  /**
       * Remove output pin by name
       */
  dropOUTByString (uid: string): void {
    this.dropOUT<string>(uid);
  }

  /**
       * Show a temporary output pin
       */
  showOUT<T>(
    name: string,
    behaviour: () => T,
    style: PinStyle | null = null
  ): void {
    const existingPin = this.m_outs.find(p => p.getName() === name);

    if (!existingPin || !(existingPin instanceof OutPin)) {
      const newPin = this.addOUT<T>(name, style);

      newPin.behaviour(behaviour);
      // 实现显示输出逻辑，例如渲染Pin
      newPin.update(); // 更新并渲染Pin
    } else {
      existingPin.behaviour(behaviour);
      existingPin.update();
    }
  }

  /**
       * Show a temporary output pin with UID
       */
  showOUT_uid<T, U>(
    uid: U,
    name: string,
    behaviour: () => T,
    style: PinStyle | null = null
  ): void {
    const pinUid: PinUID = BigInt(uid as any);
    const existingPin = this.m_outs.find(p => p.getUid() === pinUid);

    if (!existingPin || !(existingPin instanceof OutPin)) {
      const newPin = this.addOUT_uid<T, U>(uid, name, style);

      newPin.behaviour(behaviour);
      // 实现显示输出逻辑，例如渲染Pin
      newPin.update(); // 更新并渲染Pin
    } else {
      existingPin.behaviour(behaviour);
      existingPin.update();
    }
  }

  // ------------------------------------------------
  // Utility Methods

  /**
       * Get Input value from an InPin
       */
  getInVal<T, U>(uid: U): T {
    const pinUid: PinUID = BigInt(uid as any);
    const pin = this.m_ins.find(p => p.getUid() === pinUid);

    if (pin && pin instanceof InPin) {
      return pin.val();
    }
    throw new Error('Pin UID not found or invalid pin type!');
  }

  /**
       * Get Input value from an InPin by name
       */
  getInValByString<T>(uid: string): T {
    const pinUid: PinUID = BigInt(this.hashString(uid));
    const pin = this.m_ins.find(p => p.getUid() === pinUid);

    if (pin && pin instanceof InPin) {
      return pin.val();
    }
    throw new Error('Pin UID not found or invalid pin type!');
  }

  /**
       * Get generic reference to input pin
       */
  inPin<U>(uid: U): Pin | null {
    const pinUid: PinUID = BigInt(uid as any);

    return this.m_ins.find(p => p.getUid() === pinUid) || null;
  }

  /**
       * Get generic reference to input pin by name
       */
  inPinByString (uid: string): Pin | null {
    const pinUid: PinUID = BigInt(this.hashString(uid));

    return this.m_ins.find(p => p.getUid() === pinUid) || null;
  }

  /**
       * Get generic reference to output pin
       */
  outPin<U>(uid: U): Pin | null {
    const pinUid: PinUID = BigInt(uid as any);

    return this.m_outs.find(p => p.getUid() === pinUid) || null;
  }

  /**
       * Get generic reference to output pin by name
       */
  outPinByString (uid: string): Pin | null {
    const pinUid: PinUID = BigInt(this.hashString(uid));

    return this.m_outs.find(p => p.getUid() === pinUid) || null;
  }

  /**
       * Delete itself
       */
  destroy (): void {
    this.m_destroyed = true;
  }

  /**
       * Get if node must be deleted
       */
  toDestroy (): boolean {
    return this.m_destroyed;
  }

  /**
       * Get hovered status
       * @returns TRUE if the mouse is hovering the node
       */
  isHovered (): boolean {
    const paddingTL: ImGui.ImVec2 = this.m_style ? new ImGui.ImVec2(this.m_style.padding.x, this.m_style.padding.y) : new ImGui.ImVec2(3.0, 1.0);
    const paddingBR: ImGui.ImVec2 = this.m_style ? new ImGui.ImVec2(this.m_style.padding.z, this.m_style.padding.w) : new ImGui.ImVec2(3.0, 1.0);
    const start: ImGui.ImVec2 = this.m_inf?.grid2screen(new ImGui.ImVec2(this.m_pos.x - paddingTL.x, this.m_pos.y - paddingTL.y)) ?? new ImGui.ImVec2(this.m_pos.x - 3.0, this.m_pos.y - 1.0);
    const end: ImGui.ImVec2 = this.m_inf?.grid2screen(new ImGui.ImVec2(this.m_pos.x + this.m_size.x + paddingBR.x, this.m_pos.y + this.m_size.y + paddingBR.y)) ?? new ImGui.ImVec2(this.m_pos.x + this.m_size.x + 3.0, this.m_pos.y + this.m_size.y + 1.0);

    return ImGui.IsMouseHoveringRect(start, end);
  }

  /**
       * Get node's UID
       * @returns Node's unique identifier
       */
  getUID (): NodeUID {
    return this.m_uid;
  }

  /**
       * Get node name
       * @returns Name of the node
       */
  getName (): string {
    return this.m_title;
  }

  /**
       * Get node size
       * @returns Size of the node
       */
  getSize (): ImGui.ImVec2 {
    return this.m_size;
  }

  /**
       * Get node position
       * @returns Position of the node
       */
  getPos (): ImGui.ImVec2 {
    return this.m_pos;
  }

  /**
       * Get grid handler bound to node
       * @returns Pointer to the handler
       */
  getHandler (): ImNodeFlow | null {
    return this.m_inf;
  }

  /**
       * Get node's style
       * @returns Style of the node
       */
  getStyle (): NodeStyle | null {
    return this.m_style;
  }

  /**
       * Get selected status
       * @returns TRUE if the node is selected
       */
  isSelected (): boolean {
    return this.m_selected;
  }

  /**
       * Get dragged status
       * @returns TRUE if the node is being dragged
       */
  isDragged (): boolean {
    return this.m_dragged;
  }

  /**
       * Set node's uid
       * @param uid Node's unique identifier
       */
  setUID (uid: NodeUID): this {
    this.m_uid = uid;

    return this;
  }

  /**
       * Set node's title
       * @param title New title
       */
  setTitle (title: string): this {
    this.m_title = title;

    return this;
  }

  /**
       * Set node's position
       * @param pos Position in grid coordinates
       */
  setPos (pos: ImGui.ImVec2): this {
    this.m_pos.x = pos.x;
    this.m_pos.y = pos.y;

    this.m_posTarget.x = pos.x;
    this.m_posTarget.y = pos.y;

    return this;
  }

  /**
       * Set ImNodeFlow handler
       * @param inf Grid handler for the node
       */
  setHandler (inf: ImNodeFlow): this {
    this.m_inf = inf;

    return this;
  }

  /**
       * Set node's style
       * @param style New style
       */
  setStyle (style: NodeStyle): this {
    this.m_style = style;

    return this;
  }

  /**
       * Set selected status
       * @param state New selected state
       */
  selected (state: boolean): this {
    this.m_selectedNext = state;

    return this;
  }

  /**
       * Update the isSelected status of the node
       */
  updatePublicStatus (): void {
    this.m_selected = this.m_selectedNext;
  }

  /**
       * Hash function for strings (simple implementation)
       * @param str Input string
       * @returns Hash as number
       */
  private hashString (str: string): number {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);

      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }

    return Math.abs(hash);
  }
}