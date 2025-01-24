import { ImGui } from '../../imgui';
import { AnimationClipGraphNode, Blend1DGraphNode, ConstFloatGraphNode } from './animation-graph-nodes.ts/animation-graph-node';
import { NodeStyle, type BaseNode, type NodeUID } from './base-node';
import { add, multiplyScalar, smart_bezier, subtract } from './bezier-math';
import type { Link } from './link';
import { PinType, type Pin } from './pin';

type ImVec2 = ImGui.ImVec2;
type ImColor = ImGui.ImColor;
const ImVec2 = ImGui.ImVec2;
const ImColor = ImGui.ImColor;

export interface ContainedContextConfig {
  extra_window_wrapper: boolean,
  size: ImVec2,
  color: number, // ImU32 equivalent, assuming it's a packed color value
  zoom_enabled: boolean,
  zoom_min: number,
  zoom_max: number,
  zoom_divisions: number,
  zoom_smoothness: number,
  default_zoom: number,
  reset_zoom_key: number, // ImGuiKey represented as string
  scroll_button: number, // ImGuiMouseButton represented as string
}

/**
 * ContainedContext 类用于管理一个封闭的ImGui上下文，支持缩放和滚动功能
 */
export class ContainedContext {
  private m_config: ContainedContextConfig;
  private m_origin: ImVec2;
  private m_pos: ImVec2;
  private m_size: ImVec2;
  private m_ctx: ImGui.ImGuiContext | null = null;
  private m_original_ctx: ImGui.ImGuiContext | null = null;

  private m_anyWindowHovered: boolean = false;
  private m_anyItemActive: boolean = false;
  private m_hovered: boolean = false;

  private m_scale: number;
  private m_scaleTarget: number;
  private m_scroll: ImVec2;
  private m_scrollTarget: ImVec2;

  private unscaledStyle = new ImGui.Style();

  constructor (config: Partial<ContainedContextConfig> = {}) {
    // 设置默认配置
    this.m_config = {
      extra_window_wrapper: false,
      size: new ImVec2(0, 0),
      color: 0x00FFFFFF, // 白色
      zoom_enabled: true,
      zoom_min: 0.3,
      zoom_max: 2.0,
      zoom_divisions: 10.0,
      zoom_smoothness: 5.0,
      default_zoom: 1.0,
      reset_zoom_key: 82, // 需要映射到实际的ImGuiKey.R
      // scroll_button: ImGui.MouseButton.Middle,
      scroll_button: ImGui.MouseButton.Middle, // 需要映射到实际的ImGuiMouseButton
      ...config,
    };

    // 初始化其他属性
    this.m_origin = new ImVec2();
    this.m_pos = new ImVec2();
    this.m_size = new ImVec2();
    this.m_scale = this.m_config.default_zoom;
    this.m_scaleTarget = this.m_config.default_zoom;
    this.m_scroll = new ImVec2(0, 0);
    this.m_scrollTarget = new ImVec2(0, 0);
  }

  /**
   * 析构函数，用于清理ImGui上下文
   */
  destroy (): void {
    if (this.m_ctx) {
      ImGui.DestroyContext(this.m_ctx);
      this.m_ctx = null;
    }
  }

  /**
   * 开始渲染一个封闭的ImGui窗口
   */
  begin (): void {
    // ImGui.PushID(this.getid); // 使用对象引用作为ID
    ImGui.PushStyleColor(ImGui.Col.ChildBg, this.m_config.color);
    // ImGui.BeginChild('view_port', this.m_config.size.clone(), false, ImGuiWindowFlags.NoMove);
    ImGui.PopStyleColor();

    this.m_pos = ImGui.GetWindowPos();
    this.m_size = ImGui.GetContentRegionAvail();
    this.m_origin = ImGui.GetCursorScreenPos();

    this.m_original_ctx = ImGui.GetCurrentContext();
    const orig_style = ImGui.GetStyle();

    // if (!this.m_ctx) {
    //   this.m_ctx = ImGui.CreateContext();
    // }

    // ImGui.SetCurrentContext(this.m_ctx);
    this.unscaledStyle.Copy(ImGui.GetStyle());

    // new_style.cloneFrom(orig_style); // 复制原始样式

    // 复制输入事件
    // CopyIOEvents(this.m_original_ctx, this.m_ctx, this.m_origin, this.m_scale);

    // 设置显示大小和其他配置
    // ImGui.GetIO().DisplaySize = new ImVec2(this.m_size.x / this.m_scale, this.m_size.y / this.m_scale);
    // ImGui.GetIO().ConfigInputTrickleEventQueue = false;
    // ImGui.NewFrame();

    ImGui.SetWindowFontScale(this.m_scale);
    ImGui.GetStyle().ScaleAllSizes(this.m_scale);

    // if (this.m_config.extra_window_wrapper) {
    //   ImGui.SetNextWindowPos(new ImVec2(0, 0), ImGuiCond.Once);
    //   ImGui.SetNextWindowSize(ImGui.GetMainViewport()?.WorkSize.clone() || new ImVec2(800, 600));
    //   ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImVec2(0, 0));
    //   ImGui.Begin('viewport_container', null, ImGuiWindowFlags.NoDecoration | ImGuiWindowFlags.NoBackground | ImGuiWindowFlags.NoMove
    //                                               | ImGuiWindowFlags.NoScrollbar | ImGuiWindowFlags.NoScrollWithMouse);
    //   ImGui.PopStyleVar();
    // }
  }

  /**
   * 结束渲染封闭的ImGui窗口
   */
  end (): void {
    this.m_anyWindowHovered = ImGui.IsWindowHovered(ImGui.HoveredFlags.AnyWindow);
    if (this.m_config.extra_window_wrapper && ImGui.IsWindowHovered()) {
      this.m_anyWindowHovered = false;
    }

    this.m_anyItemActive = ImGui.IsAnyItemActive();

    // if (this.m_config.extra_window_wrapper) {
    //   ImGui.End();
    // }

    // ImGui.Render();

    const draw_data = ImGui.GetDrawData();

    // ImGui.SetCurrentContext(this.m_original_ctx);
    // this.m_original_ctx = null;

    // 将绘制数据附加到当前窗口的绘制列表
    // for (let i = 0; i < draw_data.CmdListsCount; i++) {
    //   AppendDrawData(draw_data.CmdLists[i], this.m_origin, this.m_scale);
    // }

    // 检测悬停状态
    this.m_hovered = ImGui.IsWindowHovered(ImGui.HoveredFlags.ChildWindows) && !this.m_anyWindowHovered;

    // 处理缩放
    if (this.m_config.zoom_enabled && this.m_hovered && ImGui.GetIO().MouseWheel !== 0) {
      this.m_scaleTarget += ImGui.GetIO().MouseWheel / this.m_config.zoom_divisions;
      this.m_scaleTarget = Math.max(this.m_config.zoom_min, Math.min(this.m_scaleTarget, this.m_config.zoom_max));

      if (this.m_config.zoom_smoothness === 0) {
        this.m_scroll = add(this.m_scroll, new ImVec2(
          (ImGui.GetIO().MousePos.x - this.m_pos.x) / this.m_scaleTarget - (ImGui.GetIO().MousePos.x - this.m_pos.x) / this.m_scale,
          (ImGui.GetIO().MousePos.y - this.m_pos.y) / this.m_scaleTarget - (ImGui.GetIO().MousePos.y - this.m_pos.y) / this.m_scale
        ));
        this.m_scale = this.m_scaleTarget;
      }
    }

    // 平滑缩放
    if (Math.abs(this.m_scaleTarget - this.m_scale) >= 0.015 / this.m_config.zoom_smoothness) {
      const cs = (this.m_scaleTarget - this.m_scale) / this.m_config.zoom_smoothness;

      //   this.m_scroll = add(this.m_scroll, new ImVec2(
      //     (ImGui.GetIO().MousePos.x - this.m_pos.x) / (this.m_scale + cs) - (ImGui.GetIO().MousePos.x - this.m_pos.x) / this.m_scale,
      //     (ImGui.GetIO().MousePos.y - this.m_pos.y) / (this.m_scale + cs) - (ImGui.GetIO().MousePos.y - this.m_pos.y) / this.m_scale
      //   ));
      this.m_scale += (this.m_scaleTarget - this.m_scale) / this.m_config.zoom_smoothness;

      if (Math.abs(this.m_scaleTarget - this.m_scale) < 0.015 / this.m_config.zoom_smoothness) {
        // this.m_scroll = add(this.m_scroll, new ImVec2(
        //   (ImGui.GetIO().MousePos.x - this.m_pos.x) / this.m_scaleTarget - (ImGui.GetIO().MousePos.x - this.m_pos.x) / this.m_scale,
        //   (ImGui.GetIO().MousePos.y - this.m_pos.y) / this.m_scaleTarget - (ImGui.GetIO().MousePos.y - this.m_pos.y) / this.m_scale
        // ));
        this.m_scale = this.m_scaleTarget;
      }
    }

    // 重置缩放
    if (ImGui.IsKeyPressed(this.m_config.reset_zoom_key, false)) {
      this.m_scaleTarget = this.m_config.default_zoom;
    }

    // console.log(this.m_hovered, !this.m_anyItemActive, ImGui.IsMouseDragging(this.m_config.scroll_button, 0));

    // 处理滚动
    if (this.m_hovered && !this.m_anyItemActive && ImGui.IsMouseDragging(this.m_config.scroll_button, 0)) {
      this.m_scroll = add(this.m_scroll, multiplyScalar(ImGui.GetIO().MouseDelta, 1 / this.m_scale));
      this.m_scrollTarget = new ImVec2(this.m_scroll.x, this.m_scroll.y);
    }

    ImGui.GetStyle().Copy(this.unscaledStyle);
    // ImGui.EndChild();
    // ImGui.PopID();
  }

  getRawContext () {
    return this.m_original_ctx;
  }

  /**
   * 获取配置
   */
  config (): ContainedContextConfig {
    return this.m_config;
  }

  /**
   * 获取当前缩放比例
   */
  scale (): number {
    return this.m_scale;
  }

  /**
   * 获取当前滚动偏移
   */
  scroll (): ImVec2 {
    return this.m_scroll;
  }

  /**
   * 获取绘制区域大小
   */
  size (): ImVec2 {
    return this.m_size;
  }

  origin (): ImVec2 {
    return this.m_origin;
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

/**
 * Main node editor
 * Handles the infinite grid, nodes and links. Also handles all the logic.
 */
export class ImNodeFlow {
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
    this.m_context.begin();
    // ImGui.GetIO().IniFilename = '';

    const drawList = ImGui.GetWindowDrawList();

    const windowPos = ImGui.GetWindowPos();

    // 显示网格
    const windowSize = ImGui.GetWindowSize();
    const gradSize = this.m_style.grid_size * this.m_context.scale();
    const subGridStep = gradSize / this.m_style.grid_subdivisions;

    const gridStartX = (this.m_context.scroll().x - windowSize.x / 2) * this.m_context.scale() + windowSize.x / 2;
    const gridStartY = (this.m_context.scroll().y - windowSize.y / 2) * this.m_context.scale() + windowSize.y / 2;

    // 绘制主网格线
    for (let x = this.mod(gridStartX, gradSize); x < windowSize.x; x += gradSize) {
      drawList.AddLine(new ImGui.ImVec2(x + windowPos.x, windowPos.y), new ImGui.ImVec2(x + windowPos.x, windowPos.y + windowSize.y), this.m_style.grid);
    }

    for (let y = this.mod(gridStartY, gradSize); y < windowSize.y; y += gradSize) {
      drawList.AddLine(new ImGui.ImVec2(windowPos.x, y + windowPos.y), new ImGui.ImVec2(windowPos.x + windowSize.x, y + windowPos.y), this.m_style.grid);
    }

    // 绘制子网格线
    if (this.m_context.scale() > 0.7) {
      for (let x = this.mod(gridStartX, subGridStep); x < windowSize.x; x += subGridStep) {
        drawList.AddLine(new ImGui.ImVec2(x + windowPos.x, windowPos.y), new ImGui.ImVec2(x + windowPos.x, windowPos.y + windowSize.y), this.m_style.subGrid);
      }

      for (let y = this.mod(gridStartY, subGridStep); y < windowSize.y; y += subGridStep) {
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
      const dragOutPinPoint = this.m_dragOut.pinPoint();

      dragOutPinPoint.x += windowPos.x;
      dragOutPinPoint.y += windowPos.y;

      if (this.m_dragOut.getType() === PinType.Output) {
        smart_bezier(
          dragOutPinPoint,
          new ImGui.ImVec2(ImGui.GetIO().MousePos.x, ImGui.GetIO().MousePos.y),
          this.m_dragOut.getStyle().color,
          this.m_dragOut.getStyle().extra.link_dragged_thickness
        );
      } else {
        smart_bezier(
          new ImGui.ImVec2(ImGui.GetIO().MousePos.x, ImGui.GetIO().MousePos.y),
          dragOutPinPoint,
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

      const mousePos = ImGui.GetMousePos();

      mousePos.x -= windowPos.x;
      mousePos.y -= windowPos.y;
      const windowCenter = multiplyScalar(ImGui.GetWindowSize(), 0.5);

      let nodePos = subtract(mousePos, windowCenter);

      nodePos = add(nodePos, windowCenter);
      nodePos = this.screen2grid(nodePos);

      if (ImGui.Selectable('AnimationClipNode')) {
        this.addNode(AnimationClipGraphNode, nodePos);
      }
      if (ImGui.Selectable('Blend1DNode')) {
        this.addNode(Blend1DGraphNode, nodePos);
      }
      if (ImGui.Selectable('ConstFloatNode')) {
        this.addNode(ConstFloatGraphNode, nodePos);
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
    this.m_links = this.m_links.filter(link => !link.isDestroyed());

    // Clearing recursion blacklist
    this.m_pinRecursionBlacklist = [];

    // End ImGui context
    this.m_context.end();
  }

  /**
       * Add a node to the grid
       * @param type Class constructor of the node
       * @param pos Position of the Node in grid coordinates
       * @param args Optional arguments to be forwarded to derived class ctor
       * @returns Instance of the newly added node
       */
  addNode<T extends BaseNode>(type: { new(m_inf: ImNodeFlow, ...args: any[]): T }, pos: ImGui.ImVec2, ...args: any[]): T {
    const node: T = new type(this, ...args);

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