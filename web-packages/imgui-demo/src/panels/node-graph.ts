import type { Composition } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';

type ImVec2 = ImGui.ImVec2;
type ImColor = ImGui.ImColor;
const ImVec2 = ImGui.ImVec2;
const ImColor = ImGui.ImColor;

@editorWindow()
export class NodeGraph extends EditorWindow {
  currentComposition: Composition;
  imNode = new ImNodeFlow();

  @menuItem('Window/NodeGraph')
  static showWindow () {
    EditorWindow.getWindow(NodeGraph).open();
  }

  constructor () {
    super();
    this.title = 'NodeGraph';
    this.open();

    const node = this.imNode.addNode(TestNode, new ImVec2(500, 100));
    const node2 = this.imNode.addNode(TestNode, new ImVec2(200, 150));
    const node3 = this.imNode.addNode(TestNode, new ImVec2(500, 250));

    node.setTitle('TestNode');

    // node.addOUT('Test');
    const pinIn = node.addIN('Test In', '', ()=>true);
    const pinOut = node2.addOUT('Test Out');

    node3.addIN('Test In', '', ()=>true).createLink(pinOut);

    pinIn.createLink(pinOut);
  }

  protected override onGUI (): void {

    this.imNode.update();
  }
}
// ----------------------------------------------------
// ENUMS

/**
 * Pins type identifier
 */
enum PinType {
  Input,
  Output
}

// ----------------------------------------------------
// TYPE DEFINITIONS

/**
 * Unique identifier types
 */
type PinUID = bigint; // Equivalent to unsigned long long int in C++
type NodeUID = number; // Equivalent to uintptr_t

// ----------------------------------------------------
// HELPER FUNCTIONS

/**
 * Draw a sensible bezier between two points
 * @param p1 Starting point
 * @param p2 Ending point
 * @param color Color of the curve
 * @param thickness Thickness of the curve
 */
function smart_bezier (p1: ImGui.ImVec2, p2: ImGui.ImVec2, color: number, thickness: number): void {
  const drawList: ImGui.ImDrawList = ImGui.GetWindowDrawList();
  const distance = Math.sqrt(Math.pow((p2.x - p1.x), 2) + Math.pow((p2.y - p1.y), 2));
  let delta = distance * 0.45;

  if (p2.x < p1.x) {delta += 0.2 * (p1.x - p2.x);}
  // let vert = (p2.x < p1.x - 20.f) ? 0.062f * distance * (p2.y - p1.y) * 0.005f : 0.f;
  const vert = 0;
  const p22 = new ImGui.ImVec2(p2.x - delta, p2.y - vert);

  if (p2.x < p1.x - 50) {delta *= -1;}
  const p11 = new ImGui.ImVec2(p1.x + delta, p1.y + vert);

  drawList.AddBezierCubic(p1, p11, p22, p2, color, thickness);
}

/**
 * Collider checker for smart_bezier
 * @param p Point to be tested
 * @param p1 Starting point of smart_bezier
 * @param p2 Ending point of smart_bezier
 * @param radius Lateral width of the hit box
 * @returns TRUE if "p" is inside the collider
 */
function smart_bezier_collider (p: ImGui.ImVec2, p1: ImGui.ImVec2, p2: ImGui.ImVec2, radius: number): boolean {
  // 实现费用贝塞尔曲线上的点投影并计算距离的逻辑
  // 这里需要实现ImProjectOnCubicBezier的功能
  // 假设有一个辅助函数projectOnCubicBezier返回一个包含Distance的对象
  const projection = projectOnCubicBezier(p, p1, getControlPoints(p1, p2), p2);

  return projection.Distance < radius;
}

/**
 * 获取贝塞尔曲线的控制点
 * @param p1 起点
 * @param p2 终点
 * @returns 控制点数组
 */
function getControlPoints (p1: ImGui.ImVec2, p2: ImGui.ImVec2): [ImGui.ImVec2, ImGui.ImVec2] {
  const distance = Math.sqrt(Math.pow((p2.x - p1.x), 2) + Math.pow((p2.y - p1.y), 2));
  let delta = distance * 0.45;

  if (p2.x < p1.x) {delta += 0.2 * (p1.x - p2.x);}
  // let vert = (p2.x < p1.x - 20.f) ? 0.062f * distance * (p2.y - p1.y) * 0.005f : 0.f;
  const vert = 0;
  const p22 = new ImGui.ImVec2(p2.x - delta, p2.y - vert);

  if (p2.x < p1.x - 50) {delta *= -1;}
  const p11 = new ImGui.ImVec2(p1.x + delta, p1.y + vert);

  return [p11, p22];
}

/**
 * 模拟ImProjectOnCubicBezier函数
 * @param p 点
 * @param p1 贝塞尔起点
 * @param controlPoints 贝塞尔控制点
 * @param p2 贝塞尔终点
 * @returns 包含Distance的对象
 */
function projectOnCubicBezier (p: ImGui.ImVec2, p1: ImGui.ImVec2, controlPoints: [ImGui.ImVec2, ImGui.ImVec2], p2: ImGui.ImVec2): { Distance: number } {
  // 这里可以使用现有的库或自行实现点到贝塞尔曲线的投影计算
  // 为了简化，假设总是返回一个固定的距离
  return { Distance: Math.sqrt(Math.pow((p.x - p1.x), 2) + Math.pow((p.y - p1.y), 2)) };
}

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
class PinStyle {
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
      link_selected_outline_thickness: 0.5,
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

/**
 * Defines the visual appearance of a node
 */
class NodeStyle {
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
 * Grid's color parameters
 */
interface InfColors {
  background: number, // Background of the grid
  grid: number, // Main lines of the grid
  subGrid: number, // Secondary lines
}

/**
 * All the grid's appearance parameters. Sizes + Colors
 */
class InfStyler implements InfColors {
  grid_size: number = 50.0; // Size of main grid
  grid_subdivisions: number = 5.0; // Sub-grid divisions for Node snapping
  background: number = ImGui.IM_COL32(33, 41, 45, 255); // Background color
  grid: number = ImGui.IM_COL32(255, 255, 255, 20); // Main lines color
  subGrid: number = ImGui.IM_COL32(200, 200, 200, 10); // Secondary lines color
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
abstract class Pin {
  protected m_uid: PinUID;
  protected m_name: string;
  protected m_pos: ImGui.ImVec2 = new ImGui.ImVec2(0.0, 0.0);
  protected m_size: ImGui.ImVec2 = new ImGui.ImVec2(0.0, 20.0);
  protected m_type: PinType;
  protected m_parent: BaseNode | null = null;
  protected m_inf: ImNodeFlow | null = null;
  protected m_style: PinStyle;
  protected m_renderer: ((p: Pin) => void) | null = null;

  constructor (
    uid: PinUID,
    name: string,
    style: PinStyle | null,
    kind: PinType,
    parent: BaseNode | null,
    inf: ImNodeFlow | null
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
class InPin<T> extends Pin {
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
    inf: ImNodeFlow | null
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
    if (!this.m_filter(other, this)) {return;}
    if (!this.m_allowSelfConnection && this.m_parent === other.getParent()) {return;}

    const link = new Link(other, this, this.m_inf!);

    this.setLink(link);
    other.setLink(link);
    this.m_inf?.addLink(link);

    // Update connection status
    this.m_link = link;
    if (other instanceof OutPin) {
      this.m_inf!.addLink(link);
    }
  }

  /**
     * Delete the link connected to the pin
     */
  deleteLink (): void {
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
class OutPin<T> extends Pin {
  private m_links: Set<Link> = new Set();
  private m_behaviour: (() => T) | null = null;
  private m_val: T | null = null;

  constructor (
    uid: PinUID,
    name: string,
    style: PinStyle,
    parent: BaseNode | null,
    inf: ImNodeFlow | null
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
    this.m_links.clear();
  }

  /**
     * Create link between pins
     * @param other Pointer to the other pin
     */
  createLink (other: Pin): void {
    if (other.getType() !== PinType.Input) {return;}
    const link = new Link(this, other, this.m_inf!);

    this.setLink(link);
    other.setLink(link);
    this.m_links.add(link);
    this.m_inf?.addLink(link);
  }

  /**
     * Add a connected link to the internal list
     * @param link Link to add
     */
  setLink (link: Link): void {
    this.m_links.add(link);
  }

  override getLink (): Link | null {
    return null;
  }

  /**
     * Delete any expired weak pointers to a (now deleted) link
     */
  deleteLink (): void {
    // 在TypeScript中，links是强引用，不需要处理weak pointers
    // 如果需要，可以手动移除特定的link
  }

  /**
     * Get connected status
     * @returns TRUE if pin is connected to one or more links
     */
  isConnected (): boolean {
    return this.m_links.size > 0;
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

// ----------------------------------------------------
// LINK CLASS

/**
 * Link between two Pins of two different Nodes
 */
class Link {
  private m_left: Pin;
  private m_right: Pin;
  private m_inf: ImNodeFlow;
  private m_hovered: boolean = false;
  private m_selected: boolean = false;

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
    this.m_left.deleteLink();
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

    if (this.m_selected && ImGui.IsKeyPressed(ImGui.ImGuiKey.Delete, false)) {
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

// ----------------------------------------------------
// CONTEXT WRAPPER

/**
 * Interface for Config within ContainedContext
 */
interface Config {
  extra_window_wrapper: boolean,
  color: number,
  size?: ImGui.ImVec2,
}

/**
 * Class to wrap ImGui context and manage grid state
 */
class ContainedContext {
  private configData: Config = {
    extra_window_wrapper: false,
    color: ImGui.IM_COL32(0, 0, 0, 255),
  };

  begin (): void {
    // Implement context beginning logic
    // Placeholder: Begin ImGui window or child
    ImGui.Begin(this.configData.extra_window_wrapper ? 'ExtraWindow' : 'MainWindow');
  }

  end (): void {
    // Implement context ending logic
    // Placeholder: End ImGui window or child
    ImGui.End();
  }

  config (): Config {
    return this.configData;
  }

  origin (): ImGui.ImVec2 {
    return new ImGui.ImVec2(0, 0); // Placeholder: Return origin based on actual implementation
  }

  scroll (): ImGui.ImVec2 {
    return new ImGui.ImVec2(0, 0); // Placeholder: Return scroll offset based on actual implementation
  }

  scale (): number {
    return 1.0; // Placeholder: Return scale based on actual implementation
  }

  getRawContext (): any {
    return null; // Placeholder: Return raw ImGui context if required
  }
}

// ----------------------------------------------------
// BASE NODE CLASS

/**
 * Parent class for custom nodes
 * Main class from which custom nodes can be created. All interactions with the main grid are handled internally.
 */
abstract class BaseNode {
  private static uidCounter: number = 1; // Static counter for unique IDs

  private m_uid: NodeUID = 0;
  private m_title: string;
  private m_pos: ImGui.ImVec2;
  private m_posTarget: ImGui.ImVec2;
  private m_size: ImGui.ImVec2;
  private m_inf: ImNodeFlow | null = null;
  private m_style: NodeStyle | null = null;
  private m_selected: boolean = false;
  private m_selectedNext: boolean = false;
  private m_dragged: boolean = false;
  private m_destroyed: boolean = false;

  private m_ins: Pin[] = [];
  private m_dynamicIns: [number, Pin][] = [];
  private m_outs: Pin[] = [];
  private m_dynamicOuts: [number, Pin][] = [];

  constructor () {
    this.m_title = 'BaseNode';
    this.m_pos = new ImGui.ImVec2(0.0, 0.0);
    this.m_posTarget = new ImGui.ImVec2(0.0, 0.0);
    this.m_size = new ImGui.ImVec2(100.0, 100.0);
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
    const offset: ImGui.ImVec2 = this.m_inf?.grid2screen(new ImVec2()) ?? new ImVec2();
    const paddingTL: ImGui.ImVec2 = this.m_style ? new ImGui.ImVec2(this.m_style.padding.x, this.m_style.padding.y) : new ImGui.ImVec2(3.0, 1.0);
    const paddingBR: ImGui.ImVec2 = this.m_style ? new ImGui.ImVec2(this.m_style.padding.z, this.m_style.padding.w) : new ImGui.ImVec2(3.0, 1.0);

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
      if ((this.m_pos.x + titleW + (this.m_inf?.getGrid().scroll().x ?? 0)) <
                (ImGui.GetCursorPos().x + maxW)) {
        p.setPos(new ImGui.ImVec2(
          ImGui.GetCursorPos().x + (maxW - p.calcWidth()),
          ImGui.GetCursorPos().y
        ));
      } else {
        p.setPos(new ImGui.ImVec2(
          this.m_pos.x + (titleW - p.calcWidth()) + (this.m_inf?.getGrid().scroll().x ?? 0),
          ImGui.GetCursorPos().y
        ));
      }
      p.update();
    }
    for (const p of this.m_dynamicOuts) {
      // FIXME: This looks horrible
      if ((this.m_pos.x + titleW + (this.m_inf?.getGrid().scroll().x ?? 0)) <
                (ImGui.GetCursorPos().x + ImGui.GetWindowPos().x + maxW)) {
        p[1].setPos(new ImGui.ImVec2(
          ImGui.GetCursorPos().x + ImGui.GetWindowPos().x + (maxW - p[1].calcWidth()),
          ImGui.GetCursorPos().y + ImGui.GetWindowPos().y
        ));
      } else {
        p[1].setPos(new ImGui.ImVec2(
          this.m_pos.x + (titleW - p[1].calcWidth()) + (this.m_inf?.getGrid().scroll().x ?? 0),
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
      new ImGui.ImVec2(this.m_pos.x - paddingTL.x, this.m_pos.y - paddingTL.y),
      new ImGui.ImVec2(this.m_pos.x + this.m_size.x + paddingBR.x, this.m_pos.y + this.m_size.y + paddingBR.y),
      this.m_style?.bg ?? ImGui.IM_COL32(0, 0, 0, 0),
      this.m_style?.radius ?? 0.0
    );
    draw_list.AddRectFilled(
      new ImGui.ImVec2(this.m_pos.x - paddingTL.x, this.m_pos.y - paddingTL.y),
      new ImGui.ImVec2(this.m_pos.x + headerSize.x, this.m_pos.y + headerSize.y),
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
      new ImGui.ImVec2(this.m_pos.x - ptl.x, this.m_pos.y - ptl.y),
      new ImGui.ImVec2(this.m_pos.x + this.m_size.x + pbr.x, this.m_pos.y + this.m_size.y + pbr.y),
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
      new ImGui.ImVec2(this.m_pos.x - paddingTL.x, this.m_pos.y - paddingTL.y),
      new ImGui.ImVec2(this.m_pos.x + headerSize.x, this.m_pos.y + headerSize.y)
    );

    if (onHeader && mouseClickState) {
      this.m_inf?.consumeSingleUseClick();
      this.m_dragged = true;
      this.m_inf?.draggingNode(true);
    }

    if (this.m_dragged || (this.m_selected && this.m_inf?.isNodeDragged())) {
      const step: number = (this.m_inf?.getStyle().grid_size ?? 50) / (this.m_inf?.getStyle().grid_subdivisions ?? 5);

      this.m_posTarget.x += ImGui.GetIO().MouseDelta.x;
      this.m_posTarget.y += ImGui.GetIO().MouseDelta.y;

      // "Slam" The position
      this.m_pos.x = Math.round(this.m_posTarget.x / step) * step;
      this.m_pos.y = Math.round(this.m_posTarget.y / step) * step;

      if (ImGui.IsMouseReleased(ImGui.ImGuiMouseButton.Left)) {
        this.m_dragged = false;
        this.m_inf?.draggingNode(false);
        this.m_posTarget = this.m_pos;
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
    this.m_pos = pos;
    this.m_posTarget = pos;

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

// ----------------------------------------------------
// IMNODEFLOW CLASS

/**
 * Main node editor
 * Handles the infinite grid, nodes and links. Also handles all the logic.
 */
class ImNodeFlow {
  private static m_instances: number = 0;

  private m_name: string;
  private m_context: ContainedContext;

  private m_singleUseClick: boolean = false;

  private m_nodes: Map<NodeUID, BaseNode> = new Map();
  private m_pinRecursionBlacklist: string[] = [];
  private m_links: Link[] = [];

  private m_droppedLinkPopUp: ((dragged: Pin) => void) | null = null;
  private m_droppedLinkPupUpComboKey: ImGui.ImGuiKey = 0;
  private m_droppedLinkLeft: Pin | null = null;

  private m_rightClickPopUp: ((node: BaseNode) => void) | null = null;
  private m_hoveredNodeAux: BaseNode | null = null;

  private m_hoveredNode: BaseNode | null = null;
  private m_draggingNode: boolean = false;
  private m_draggingNodeNext: boolean = false;
  private m_hovering: Pin | null = null;
  private m_dragOut: Pin | null = null;

  private m_style: InfStyler = new InfStyler();

  constructor (name: string = `FlowGrid${ImNodeFlow.m_instances}`) {
    this.m_name = name;
    ImNodeFlow.m_instances++;
    this.m_context = new ContainedContext();

    this.m_context.config().extra_window_wrapper = true;
    // this.m_context.config().color = this.m_style.colors.background;
  }

  /**
     * Handler loop
     * Main update function. Refreshes all the logic and draws everything. Must be called every frame.
     */
  update (): void {
    // Reset hovered node and dragging status
    this.m_hovering = null;
    this.m_hoveredNode = null;
    this.m_draggingNode = this.m_draggingNodeNext;
    this.m_singleUseClick = ImGui.IsMouseClicked(ImGui.ImGuiMouseButton.Left);

    // Begin ImGui context
    // this.m_context.begin();
    ImGui.GetIO().IniFilename = '';

    const drawList = ImGui.GetWindowDrawList();

    const windowPos = ImGui.GetWindowPos();

    // 显示网格
    const windowSize = ImGui.GetWindowSize();
    const subGridStep = this.m_style.grid_size / this.m_style.grid_subdivisions;

    // 绘制主网格线
    for (let x = this.mod(this.m_context.scroll().x, this.m_style.grid_size); x < windowSize.x; x += this.m_style.grid_size) {
      drawList.AddLine(new ImGui.ImVec2(x + windowPos.x, windowPos.y), new ImGui.ImVec2(x + windowPos.x, windowPos.y + windowSize.y), this.m_style.grid);
    }

    for (let y = this.mod(this.m_context.scroll().y, this.m_style.grid_size); y < windowSize.y; y += this.m_style.grid_size) {
      drawList.AddLine(new ImGui.ImVec2(windowPos.x, y + windowPos.y), new ImGui.ImVec2(windowPos.x + windowSize.x, y + windowPos.y), this.m_style.grid);
    }

    // 绘制子网格线
    if (this.m_context.scale() > 0.7) {
      for (let x = this.mod(this.m_context.scroll().x, subGridStep); x < windowSize.x; x += subGridStep) {
        drawList.AddLine(new ImGui.ImVec2(x + windowPos.x, windowPos.y), new ImGui.ImVec2(x + windowPos.x, windowPos.y + windowSize.y), this.m_style.subGrid);
      }

      for (let y = this.mod(this.m_context.scroll().y, subGridStep); y < windowSize.y; y += subGridStep) {
        drawList.AddLine(new ImGui.ImVec2(windowPos.x, y + windowPos.y), new ImGui.ImVec2(windowPos.x + windowSize.x, y + windowPos.y), this.m_style.subGrid);
      }
    }

    // Update and draw nodes
    drawList.ChannelsSplit(2);
    for (const [uid, node] of this.m_nodes) {
      node.update();
    }

    // Remove "toDestroy" nodes
    for (const [uid, node] of Array.from(this.m_nodes)) {
      if (node.toDestroy()) {
        this.m_nodes.delete(uid);
      }
    }
    drawList.ChannelsMerge();

    // Update and draw links
    for (const link of this.m_links) {
      link.update();
    }

    // Handle links drop-off
    if (this.m_dragOut && ImGui.IsMouseReleased(ImGui.ImGuiMouseButton.Left)) {
      if (!this.m_hovering) {
        if (this.on_free_space() && this.m_droppedLinkPopUp) {
          if (this.m_droppedLinkPupUpComboKey === 0 || ImGui.IsKeyDown(this.m_droppedLinkPupUpComboKey)) {
            this.m_droppedLinkLeft = this.m_dragOut;
            ImGui.OpenPopup('DroppedLinkPopUp');
          }
        }
      } else {
        this.m_dragOut.createLink(this.m_hovering);
      }
    }

    // Handle links drag-out
    if (!this.m_draggingNode && this.m_hovering && !this.m_dragOut && ImGui.IsMouseClicked(ImGui.ImGuiMouseButton.Left)) {
      this.m_dragOut = this.m_hovering;
    }

    if (this.m_dragOut) {
      if (this.m_dragOut.getType() === PinType.Output) {
        smart_bezier(
          this.m_dragOut.pinPoint(),
          new ImGui.ImVec2(ImGui.GetIO().MousePos.x, ImGui.GetIO().MousePos.y),
          this.m_dragOut.getStyle().color,
          this.m_dragOut.getStyle().extra.link_dragged_thickness
        );
      } else {
        smart_bezier(
          new ImGui.ImVec2(ImGui.GetIO().MousePos.x, ImGui.GetIO().MousePos.y),
          this.m_dragOut.pinPoint(),
          this.m_dragOut.getStyle().color,
          this.m_dragOut.getStyle().extra.link_dragged_thickness
        );
      }

      if (ImGui.IsMouseReleased(ImGui.ImGuiMouseButton.Left)) {
        this.m_dragOut = null;
      }
    }

    // Right-click PopUp
    if (this.m_rightClickPopUp && ImGui.IsMouseClicked(ImGui.ImGuiMouseButton.Right) && ImGui.IsWindowHovered()) {
      this.m_hoveredNodeAux = this.m_hoveredNode;
      ImGui.OpenPopup('RightClickPopUp');
    }

    if (ImGui.BeginPopup('RightClickPopUp')) {
      if (this.m_hoveredNodeAux) {
        this.m_rightClickPopUp!(this.m_hoveredNodeAux);
      }
      ImGui.EndPopup();
    }

    // Dropped Link PopUp
    if (ImGui.BeginPopup('DroppedLinkPopUp')) {
      if (this.m_droppedLinkPopUp && this.m_droppedLinkLeft) {
        this.m_droppedLinkPopUp(this.m_droppedLinkLeft);
      }
      ImGui.EndPopup();
    }

    // Removing dead links
    // this.m_links = this.m_links.filter(link => !link.isDestroyed());

    // Clearing recursion blacklist
    this.m_pinRecursionBlacklist = [];

    // End ImGui context
    // this.m_context.end();
  }

  /**
     * Add a node to the grid
     * @param type Class constructor of the node
     * @param pos Position of the Node in grid coordinates
     * @param args Optional arguments to be forwarded to derived class ctor
     * @returns Instance of the newly added node
     */
  addNode<T extends BaseNode>(type: { new(...args: any[]): T }, pos: ImGui.ImVec2, ...args: any[]): T {
    const node: T = new type(...args);

    node.setPos(pos);
    node.setHandler(this);
    if (!node.getStyle()) {
      node.setStyle(NodeStyle.cyan());
    }

    node.setUID(this.generateUID());
    this.m_nodes.set(node.getUID(), node);

    return node;
  }

  /**
     * Add a node to the grid at specific position
     */
  placeNodeAt<T extends BaseNode>(type: { new(...args: any[]): T }, pos: ImGui.ImVec2, ...args: any[]): T {
    return this.addNode(type, this.screen2grid(pos), ...args);
  }

  /**
     * Add a node to the grid using mouse position
     */
  placeNode<T extends BaseNode>(type: { new(...args: any[]): T }, ...args: any[]): T {
    const mousePos = new ImGui.ImVec2(ImGui.GetIO().MousePos.x, ImGui.GetIO().MousePos.y);
    const nodePos = this.screen2grid(mousePos);

    return this.addNode(type, nodePos, ...args);
  }

  /**
     * Add link to the handler internal list
     * @param link Reference to the link
     */
  addLink (link: Link): void {
    this.m_links.push(link);
  }

  /**
     * Pop-up when link is "dropped"
     * @param content Function containing the contents of the pop-up and subsequent logic
     * @param key Optional key required in order to open the pop-up
     */
  droppedLinkPopUpContent (content: (dragged: Pin) => void, key: ImGui.ImGuiKey = 0): void {
    this.m_droppedLinkPopUp = content;
    this.m_droppedLinkPupUpComboKey = key;
  }

  /**
     * Pop-up when right-clicking
     * @param content Function containing the contents of the pop-up and subsequent logic
     */
  rightClickPopUpContent (content: (node: BaseNode) => void): void {
    this.m_rightClickPopUp = content;
  }

  /**
     * Get mouse clicking status
     * @returns TRUE if mouse is clicked and click hasn't been consumed
     */
  getSingleUseClick (): boolean {
    return this.m_singleUseClick;
  }

  /**
     * Consume the click for the given frame
     */
  consumeSingleUseClick (): void {
    this.m_singleUseClick = false;
  }

  /**
     * Get editor's name
     * @returns Name of the editor
     */
  getName (): string {
    return this.m_name;
  }

  /**
     * Get editor's position
     * @returns Position in screen coordinates
     */
  getPos (): ImGui.ImVec2 {
    return this.m_context.origin();
  }

  /**
     * Get editor's grid scroll
     * @returns Scroll offset from the origin of the grid
     */
  getScroll (): ImGui.ImVec2 {
    return this.m_context.scroll();
  }

  /**
     * Get editor's list of nodes
     * @returns Internal nodes list
     */
  getNodes (): Map<NodeUID, BaseNode> {
    return this.m_nodes;
  }

  /**
     * Get nodes count
     * @returns Number of nodes present in the editor
     */
  getNodesCount (): number {
    return this.m_nodes.size;
  }

  /**
     * Get editor's list of links
     * @returns Internal links list
     */
  getLinks (): Link[] {
    return this.m_links;
  }

  /**
     * Get zooming viewport
     * @returns Internal viewport for zoom support
     */
  getGrid (): ContainedContext {
    return this.m_context;
  }

  /**
     * Get dragging status
     * @returns TRUE if a Node is being dragged around the grid
     */
  isNodeDragged (): boolean {
    return this.m_draggingNode;
  }

  /**
     * Get current style
     * @returns Style variables
     */
  getStyle (): InfStyler {
    return this.m_style;
  }

  /**
     * Set editor's size
     * @param size Editor's size. Set to (0, 0) to auto-fit.
     */
  setSize (size: ImGui.ImVec2): void {
    this.m_context.config().size = size;
  }

  /**
     * Set dragging status
     * @param state New dragging state
     */
  draggingNode (state: boolean): void {
    this.m_draggingNodeNext = state;
  }

  /**
     * Set what pin is being hovered
     * @param hovering Pointer to the hovered pin
     */
  hovering (hovering: Pin | null): void {
    this.m_hovering = hovering;
  }

  /**
     * Set what node is being hovered
     * @param hovering Pointer to the hovered node
     */
  hoveredNode (hovering: BaseNode | null): void {
    this.m_hoveredNode = hovering;
  }

  /**
     * Convert coordinates from screen to grid
     * @param p Point in screen coordinates to be converted
     * @returns Point in grid's coordinates
     */
  screen2grid (p: ImGui.ImVec2): ImGui.ImVec2 {
    const currentContext = ImGui.GetCurrentContext();

    if (currentContext === this.m_context.getRawContext()) {
      return new ImGui.ImVec2(p.x - this.m_context.scroll().x, p.y - this.m_context.scroll().y);
    } else {
      return new ImGui.ImVec2(
        p.x - this.m_context.origin().x - this.m_context.scroll().x * this.m_context.scale(),
        p.y - this.m_context.origin().y - this.m_context.scroll().y * this.m_context.scale()
      );
    }
  }

  /**
     * Convert coordinates from grid to screen
     * @param p Point in grid's coordinates to be converted
     * @returns Point in screen coordinates
     */
  grid2screen (p: ImGui.ImVec2): ImGui.ImVec2 {
    const currentContext = ImGui.GetCurrentContext();

    if (currentContext === this.m_context.getRawContext()) {
      return new ImGui.ImVec2(p.x + this.m_context.scroll().x, p.y + this.m_context.scroll().y);
    } else {
      return new ImGui.ImVec2(
        p.x + this.m_context.origin().x + this.m_context.scroll().x * this.m_context.scale(),
        p.y + this.m_context.origin().y + this.m_context.scroll().y * this.m_context.scale()
      );
    }
  }

  /**
     * Check if mouse is on selected node
     * @returns TRUE if the mouse is hovering a selected node
     */
  on_selected_node (): boolean {
    for (const [uid, node] of this.m_nodes) {
      if (node.isSelected() && node.isHovered()) {
        return true;
      }
    }

    return false;
  }

  /**
     * Check if mouse is on a free point on the grid
     * @returns TRUE if the mouse is not hovering a node or a link
     */
  on_free_space (): boolean {
    for (const [uid, node] of this.m_nodes) {
      if (node.isHovered()) {return false;}
    }
    for (const link of this.m_links) {
      if (link.isHovered()) {return false;}
    }

    return true;
  }

  /**
     * Generate unique UID for nodes
     * @returns Unique NodeUID
     */
  private generateUID (): NodeUID {
    return ImNodeFlow.m_instances++;
  }

  // ---------------------------------------------------
  // Hash Function (Simplistic)
  private hashString (str: string): number {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);

      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }

    return Math.abs(hash);
  }

  private mod (value: number, modulus: number): number {
    return value % modulus;
  }
}

class TestNode extends BaseNode {
  override draw (): void {
    // throw new Error('Method not implemented.');
  }

}