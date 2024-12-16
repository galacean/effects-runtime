import { ImGui } from '../../imgui';
import type { BaseNode } from './base-node';
import { Link } from './link';
import type { ImNodeFlow } from './node-flow';

/**
 * Pins type identifier
 */
export enum PinType {
  Input,
  Output
}

// ----------------------------------------------------
// TYPE DEFINITIONS

/**
 * Unique identifier types
 */
export type PinUID = bigint; // Equivalent to unsigned long long int in C++

// ----------------------------------------------------
// INTERFACES AND STRUCTS

/**
   * Extra pin's style setting
   */
interface PinStyleExtras {
  padding: ImGui.ImVec2, // Top and bottom spacing
  bg_radius: number, // Border and background corner rounding
  border_thickness: number, // Border thickness
  bg_color: number, // Background color
  bg_hover_color: number, // Background color when hovered
  border_color: number, // Border color

  link_thickness: number, // Link thickness
  link_dragged_thickness: number, // Link thickness when dragged
  link_hovered_thickness: number, // Link thickness when hovered
  link_selected_outline_thickness: number, // Thickness of the outline of a selected link
  outline_color: number, // Color of the outline of a selected link

  socket_padding: number, // Spacing between pin content and socket
}

/**
   * Defines the visual appearance of a pin
   */
export class PinStyle {
  color: number; // Socket and link color
  socket_shape: number; // Socket shape ID
  socket_radius: number; // Socket radius
  socket_hovered_radius: number; // Socket radius when hovered
  socket_connected_radius: number; // Socket radius when connected
  socket_thickness: number; // Socket outline thickness when empty
  extra: PinStyleExtras; // List of less common properties

  constructor (
    color: number,
    socket_shape: number,
    socket_radius: number,
    socket_hovered_radius: number,
    socket_connected_radius: number,
    socket_thickness: number
  ) {
    this.color = color;
    this.socket_shape = socket_shape;
    this.socket_radius = socket_radius;
    this.socket_hovered_radius = socket_hovered_radius;
    this.socket_connected_radius = socket_connected_radius;
    this.socket_thickness = socket_thickness;
    this.extra = {
      padding: new ImGui.ImVec2(3.0, 1.0),
      bg_radius: 8.0,
      border_thickness: 1.0,
      bg_color: ImGui.IM_COL32(23, 16, 16, 0),
      bg_hover_color: ImGui.IM_COL32(100, 100, 255, 70),
      border_color: ImGui.IM_COL32(255, 255, 255, 0),

      link_thickness: 2.6,
      link_dragged_thickness: 2.2,
      link_hovered_thickness: 3.5,
      link_selected_outline_thickness: 4.0,
      outline_color: ImGui.IM_COL32(80, 20, 255, 200),

      socket_padding: 6.6,
    };
  }

  // Static methods for default styles
  static cyan (): PinStyle {
    return new PinStyle(
      ImGui.IM_COL32(87, 155, 185, 255),
      0,
      4.0,
      4.67,
      3.7,
      1.0
    );
  }

  static green (): PinStyle {
    return new PinStyle(
      ImGui.IM_COL32(90, 191, 93, 255),
      4,
      4.0,
      4.67,
      4.2,
      1.3
    );
  }

  static blue (): PinStyle {
    return new PinStyle(
      ImGui.IM_COL32(90, 117, 191, 255),
      0,
      4.0,
      4.67,
      3.7,
      1.0
    );
  }

  static brown (): PinStyle {
    return new PinStyle(
      ImGui.IM_COL32(191, 134, 90, 255),
      0,
      4.0,
      4.67,
      3.7,
      1.0
    );
  }

  static red (): PinStyle {
    return new PinStyle(
      ImGui.IM_COL32(191, 90, 90, 255),
      0,
      4.0,
      4.67,
      3.7,
      1.0
    );
  }

  static white (): PinStyle {
    return new PinStyle(
      ImGui.IM_COL32(255, 255, 255, 255),
      5,
      4.0,
      4.67,
      4.2,
      1.0
    );
  }
}

// ----------------------------------------------------
// CONNECTION FILTER CLASS

/**
 * Collection of Pin's connection filters
 */
class ConnectionFilter {
  static None (): (out: Pin, input: Pin) => boolean {
    return (out: Pin, input: Pin) => true;
  }

  static SameType (): (out: Pin, input: Pin) => boolean {
    return (out: Pin, input: Pin) => out.getDataType() === input.getDataType();
  }

  static Numbers (): (out: Pin, input: Pin) => boolean {
    return (out: Pin, input: Pin) =>
      ['number', 'float', 'double', 'int', 'bigint'].includes(out.getDataType()) &&
              ['number', 'float', 'double', 'int', 'bigint'].includes(input.getDataType());
  }
}

// ----------------------------------------------------
// PIN CLASSES

/**
   * Generic base class for pins
   */
export abstract class Pin {
  protected m_uid: PinUID;
  protected m_name: string;
  protected m_pos: ImGui.ImVec2 = new ImGui.ImVec2(0.0, 0.0);
  protected m_size: ImGui.ImVec2 = new ImGui.ImVec2(0.0, 20.0);
  protected m_type: PinType;
  protected m_parent: BaseNode | null = null;
  protected m_inf: ImNodeFlow;
  protected m_style: PinStyle;
  protected m_renderer: ((p: Pin) => void) | null = null;

  constructor (
    uid: PinUID,
    name: string,
    style: PinStyle | null,
    kind: PinType,
    parent: BaseNode | null,
    inf: ImNodeFlow
  ) {
    this.m_uid = uid;
    this.m_name = name;
    this.m_style = style ?? PinStyle.cyan(); // Default style if not provided
    this.m_type = kind;
    this.m_parent = parent;
    this.m_inf = inf;
  }

  /**
       * Main loop of the pin
       * Updates position, hovering and dragging status, and renders the pin. Must be called each frame.
       */
  update (): void {

    // if (m_renderer)
    //     {
    //         ImGui::BeginGroup();
    //         m_renderer(this);
    //         ImGui::EndGroup();
    //         m_size = ImGui::GetItemRectSize();
    //         if (ImGui::IsItemHovered())
    //             (*m_inf)->hovering(this);
    //         return;
    //     }

    ImGui.SetCursorPos(this.m_pos);
    ImGui.Text(this.m_name);
    this.m_size = ImGui.GetItemRectSize();

    this.drawDecoration();
    this.drawSocket();

    if (ImGui.IsItemHovered()) {
      this.m_inf?.hovering(this);
    }
  }

  /**
       * Draw default pin's socket
       */
  drawSocket (): void {
    // 使用ImGui绘制Socket
    const color = this.m_style.color;

    this.drawCircle(this.pinPoint(), this.m_style.socket_radius, color);
  }

  /**
       * Utility method to draw a filled circle using ImGui
       */
  protected drawCircle (pos: ImGui.ImVec2, radius: number, color: number): void {
    const drawList = ImGui.GetWindowDrawList();
    const windowPos = ImGui.GetWindowPos();

    pos.x += windowPos.x;
    pos.y += windowPos.y;
    drawList.AddCircleFilled(pos, radius, color, this.m_style.socket_shape);
    pos.x -= windowPos.x;
    pos.y -= windowPos.y;
  }

  /**
       * Draw default pin's decoration (border, bg, and hover overlay)
       */
  drawDecoration (): void {
    const draw_list = ImGui.GetWindowDrawList();

    const windowPos = ImGui.GetWindowPos();

    this.m_pos.x += windowPos.x;
    this.m_pos.y += windowPos.y;

    if (ImGui.IsItemHovered()) {
      draw_list.AddRectFilled(
        new ImGui.ImVec2(this.m_pos.x - this.m_style.extra.padding.x, this.m_pos.y - this.m_style.extra.padding.y),
        new ImGui.ImVec2(this.m_pos.x + this.m_size.x + this.m_style.extra.padding.x, this.m_pos.y + this.m_size.y + this.m_style.extra.padding.y),
        this.m_style.extra.bg_hover_color,
        this.m_style.extra.bg_radius
      );
    } else {
      draw_list.AddRectFilled(
        new ImGui.ImVec2(this.m_pos.x - this.m_style.extra.padding.x, this.m_pos.y - this.m_style.extra.padding.y),
        new ImGui.ImVec2(this.m_pos.x + this.m_size.x + this.m_style.extra.padding.x, this.m_pos.y + this.m_size.y + this.m_style.extra.padding.y),
        this.m_style.extra.bg_color,
        this.m_style.extra.bg_radius
      );
    }

    draw_list.AddRect(
      new ImGui.ImVec2(this.m_pos.x - this.m_style.extra.padding.x, this.m_pos.y - this.m_style.extra.padding.y),
      new ImGui.ImVec2(this.m_pos.x + this.m_size.x + this.m_style.extra.padding.x, this.m_pos.y + this.m_size.y + this.m_style.extra.padding.y),
      this.m_style.extra.border_color,
      this.m_style.extra.bg_radius,
      0,
      this.m_style.extra.border_thickness
    );

    this.m_pos.x -= windowPos.x;
    this.m_pos.y -= windowPos.y;
  }

  /**
       * Used by output pins to calculate their values
       */
  abstract resolve (): void;

  /**
       * Custom render function to override Pin appearance
       * @param r Function or lambda expression with new ImGui rendering
       */
  renderer (r: (p: Pin) => void): this {
    this.m_renderer = r;

    return this;
  }

  /**
       * Create link between pins
       * @param other Pointer to the other pin
       */
  abstract createLink (other: Pin): void;

  /**
       * Set the reference to a link
       * @param link Shared pointer to the link
       */
  abstract setLink (link: Link): void;

  /**
       * Delete link reference
       */
  abstract deleteLink (): void;

  /**
       * Get connected status
       * @returns TRUE if the pin is connected
       */
  abstract isConnected (): boolean;

  /**
       * Get pin's link
       * @returns Weak reference to pin's link
       */
  abstract getLink (): Link | null;

  /**
       * Get pin's UID
       * @returns Unique identifier of the pin
       */
  getUid (): PinUID {
    return this.m_uid;
  }

  /**
       * Get pin's name
       * @returns Name of the pin
       */
  getName (): string {
    return this.m_name;
  }

  /**
       * Get pin's position
       * @returns Position of the pin in grid coordinates
       */
  getPos (): ImGui.ImVec2 {
    return this.m_pos;
  }

  /**
       * Get pin's hit-box size
       * @returns Size of the pin's hit-box
       */
  getSize (): ImGui.ImVec2 {
    return this.m_size;
  }

  /**
       * Get pin's parent node
       * @returns Parent node containing the pin
       */
  getParent (): BaseNode | null {
    return this.m_parent;
  }

  /**
       * Get pin's type
       * @returns The pin type. Either Input or Output
       */
  getType (): PinType {
    return this.m_type;
  }

  /**
       * Get pin's data type (aka: <T>)
       * @returns String containing unique information identifying the data type
       */
  abstract getDataType (): string;

  /**
       * Get pin's style
       * @returns Pin's style
       */
  getStyle (): PinStyle {
    return this.m_style;
  }

  /**
       * Get pin's link attachment point (socket)
       * @returns Grid coordinates to the attachment point between the link and the pin's socket
       */
  abstract pinPoint (): ImGui.ImVec2;

  /**
       * Calculate pin's width pre-rendering
       * @returns The width of the pin once it will be rendered
       */
  calcWidth (): number {
    // 使用ImGui来计算文本宽度
    return ImGui.CalcTextSize(this.m_name).x;
  }

  /**
       * Set pin's position
       * @param pos Position in screen coordinates
       */
  setPos (pos: ImGui.ImVec2): void {
    this.m_pos = pos;
  }
}

/**
   * Input specific pin
   * Derived from the generic class Pin. The input pin owns the link pointer.
   */
export class InPin<T> extends Pin {
  override resolve (): void {
    throw new Error('Method not implemented.');
  }
  override setLink (link: Link): void {
    this.m_link = link;
  }
  private m_link: Link | null = null;
  private m_emptyVal: T;
  private m_filter: (out: Pin, input: Pin) => boolean;
  private m_allowSelfConnection: boolean = false;

  constructor (
    uid: PinUID,
    name: string,
    defReturn: T,
    filter: (out: Pin, input: Pin) => boolean,
    style: PinStyle,
    parent: BaseNode | null,
    inf: ImNodeFlow
  ) {
    super(uid, name, style, PinType.Input, parent, inf);
    this.m_emptyVal = defReturn;
    this.m_filter = filter;
  }

  /**
       * Create link between pins
       * @param other Pointer to the other pin
       */
  createLink (other: Pin): void {
    if (other.getType() !== PinType.Output) {return;}
    if (!this.m_allowSelfConnection && this.m_parent === other.getParent()) {return;}
    if (this.m_link && this.m_link.getLeft() === other) {

      return;
    }
    if (!this.m_filter(other, this)) {return;}

    this.m_link = new Link(other, this, this.m_inf);

    other.setLink(this.m_link);
    this.m_inf.addLink(this.m_link);
  }

  /**
       * Delete the link connected to the pin
       */
  deleteLink (): void {
    this.m_link?.destroy();
    this.m_link = null;
  }

  /**
       * Specify if connections from an output on the same node are allowed
       * @param state New state of the flag
       */
  allowSameNodeConnections (state: boolean): void {
    this.m_allowSelfConnection = state;
  }

  /**
       * Get connected status
       * @returns TRUE if pin is connected to a link
       */
  isConnected (): boolean {
    return this.m_link !== null;
  }

  /**
       * Get pin's link
       * @returns Link connected to the pin
       */
  getLink (): Link | null {
    return this.m_link;
  }

  /**
       * Get InPin's connection filter
       * @returns InPin's connection filter configuration
       */
  getFilter (): (out: Pin, input: Pin) => boolean {
    return this.m_filter;
  }

  /**
       * Get pin's data type (aka: <T>)
       * @returns String containing unique information identifying the data type
       */
  getDataType (): string {
    return typeof this.m_emptyVal;
  }

  /**
       * Get pin's link attachment point (socket)
       * @returns Grid coordinates to the attachment point between the link and the pin's socket
       */
  pinPoint (): ImGui.ImVec2 {
    return new ImGui.ImVec2(
      this.m_pos.x - this.m_style.extra.socket_padding,
      this.m_pos.y + this.m_size.y / 2
    );
  }

  /**
       * Get value carried by the connected link
       * @returns Reference to the value of the connected OutPin. Or the default value if not connected
       */
  val (): T {
    if (this.m_link) {
      const outPin = this.m_link.getLeft();

      if (outPin instanceof OutPin) {
        return outPin.val();
      }
    }

    return this.m_emptyVal;
  }
}

/**
   * Output specific pin
   * Derived from the generic class Pin. The output pin handles the logic.
   */
export class OutPin<T> extends Pin {
  private m_links: Link[] = [];
  private m_behaviour: (() => T) | null = null;
  private m_val: T | null = null;

  constructor (
    uid: PinUID,
    name: string,
    style: PinStyle,
    parent: BaseNode | null,
    inf: ImNodeFlow
  ) {
    super(uid, name, style, PinType.Output, parent, inf);
  }

  /**
       * When parent gets deleted, remove the links
       */
  destroy (): void {
    this.m_links.forEach(link => {
      const otherPin = link.getRight();

      otherPin.deleteLink();
    });
    this.m_links.length = 0;
  }

  /**
       * Create link between pins
       * @param other Pointer to the other pin
       */
  createLink (other: Pin): void {
    if (other.getType() !== PinType.Input) {return;}

    other.createLink(this);
  }

  /**
       * Add a connected link to the internal list
       * @param link Link to add
       */
  setLink (link: Link): void {
    this.m_links.push(link);
  }

  override getLink (): Link | null {
    return null;
  }

  /**
       * Delete any expired weak pointers to a (now deleted) link
       */
  deleteLink (): void {
    this.m_links = this.m_links.filter(link => !link.isDestroyed());
  }

  /**
       * Get connected status
       * @returns TRUE if pin is connected to one or more links
       */
  isConnected (): boolean {
    return this.m_links.length > 0;
  }

  /**
       * Get pin's link attachment point (socket)
       * @returns Grid coordinates to the attachment point between the link and the pin's socket
       */
  pinPoint (): ImGui.ImVec2 {
    return new ImGui.ImVec2(
      this.m_pos.x + this.m_size.x + this.m_style.extra.socket_padding,
      this.m_pos.y + this.m_size.y / 2
    );
  }

  /**
       * Get output value
       * @returns Internal value of the pin
       */
  val (): T {
    if (this.m_behaviour) {
      return this.m_behaviour();
    }
    if (this.m_val !== null) {
      return this.m_val;
    }
    throw new Error('No value defined for this OutPin');
  }

  /**
       * Set logic to calculate output value
       * @param func Function or lambda expression used to calculate output value
       */
  behaviour (func: () => T): this {
    this.m_behaviour = func;

    return this;
  }

  /**
       * Get pin's data type (aka: <T>)
       * @returns String containing unique information identifying the data type
       */
  getDataType (): string {
    return typeof (this.m_val as any);
  }

  /**
       * Used by output pins to calculate their values
       */
  resolve (): void {
    if (this.m_behaviour) {
      this.m_val = this.m_behaviour();
    }
  }
}