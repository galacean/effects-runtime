import { ImGui } from '../../platform/imgui/index';

type TooltipContent = string | (() => void);
interface TooltipRequest { id: number, content: TooltipContent }
interface TooltipOptions { id?: string, hovered?: boolean }

const SUMMON_DELAY = 0.15;
const FADE_DURATION = 0.1;
const STATIONARY_DELAY = 0.05;

class EditorTooltips {
  private request?: TooltipRequest;
  private active?: number;
  private started = 0;
  private lastMotion = 0;
  private blockedUntil = 0;
  private mouse?: { x: number, y: number };
  private readonly dismiss = () => {
    this.active = undefined; this.request = undefined;
    this.blockedUntil = performance.now() / 1000 + SUMMON_DELAY;
  };

  initialize (): void {
    window.addEventListener('keydown', this.dismiss, true);
    window.addEventListener('blur', this.dismiss);
  }

  shutdown (): void {
    window.removeEventListener('keydown', this.dismiss, true);
    window.removeEventListener('blur', this.dismiss);
    this.dismiss(); this.mouse = undefined;
  }

  beginFrame (): void {
    this.request = undefined;
    const mouse = ImGui.GetMousePos();

    if (!this.mouse || Math.hypot(mouse.x - this.mouse.x, mouse.y - this.mouse.y) > 0.5) {
      this.lastMotion = performance.now() / 1000; this.mouse = { x: mouse.x, y: mouse.y };
    }
  }

  submit (content: TooltipContent, options: TooltipOptions): void {
    const hovered = options.hovered === undefined ? ImGui.IsItemHovered(ImGui.HoveredFlags.AllowWhenDisabled) : options.hovered && ImGui.IsWindowHovered();

    if (!hovered) { return; }
    const min = ImGui.GetItemRectMin(), max = ImGui.GetItemRectMax();
    const id = ImGui.GetID(options.id ?? '##Tooltip:' + min.x + ':' + min.y + ':' + max.x + ':' + max.y);

    this.request = { id, content };
  }

  draw (): void {
    const io = ImGui.GetIO(), now = performance.now() / 1000;
    const interacting = ImGui.IsAnyItemActive() || io.WantTextInput || io.KeyCtrl || io.KeySuper || io.KeyAlt || io.KeyShift ||
      io.MouseWheel !== 0 || io.MouseWheelH !== 0 || !!ImGui.GetDragDropPayload() ||
      [ImGui.MouseButton.Left, ImGui.MouseButton.Middle, ImGui.MouseButton.Right].some(button => ImGui.IsMouseDown(button) || ImGui.IsMouseClicked(button) || ImGui.IsMouseReleased(button));
    const request = this.request;

    if (!request || interacting || now < this.blockedUntil || now - this.lastMotion < STATIONARY_DELAY) {
      this.active = undefined;

      return;
    }
    if (this.active !== request.id) { this.active = request.id; this.started = now; }
    const opacity = Math.min(1, (now - this.started - SUMMON_DELAY) / FADE_DURATION);

    if (opacity <= 0) { return; }
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(8, 6));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(8, 2));
    ImGui.PushStyleVar(ImGui.StyleVar.Alpha, ImGui.GetStyle().Alpha * opacity);
    ImGui.BeginTooltip(); ImGui.PushTextWrapPos(420);
    try {
      if (typeof request.content === 'string') { ImGui.TextUnformatted(request.content); } else { request.content(); }
    } finally { ImGui.PopTextWrapPos(); ImGui.EndTooltip(); ImGui.PopStyleVar(3); }
  }
}

export const editorTooltips = new EditorTooltips();

/** Register a hint for the hovered item, or for a named region in a custom canvas. */
export function editorTooltip (content: TooltipContent, options: TooltipOptions = {}): void { editorTooltips.submit(content, options); }
