import { ImGui } from '../../imgui';
import { type NodeUID, type BaseNode, NodeStyle } from './base-node';
import { smart_bezier } from './bezier-math';
import type { Link } from './link';
import { PinType, type Pin } from './pin';

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
    // this.m_context.begin();
    // ImGui.GetIO().IniFilename = '';

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
    // this.m_context.end();
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