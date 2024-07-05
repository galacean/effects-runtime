import type { Composition, TrackAsset } from '@galacean/effects';
import { CompositionComponent } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from '../core/panel';

@editorWindow()
export class Sequencer extends EditorWindow {
  isDragging: boolean = false;
  currentTime: number = 0;
  trackUIOffset: number = 200;
  timeCursorPositionX: number = 0;

  currentComposition: Composition;

  @menuItem('Window/Sequencer')
  static showWindow () {
    EditorWindow.getWindow(Sequencer).open();
  }

  constructor () {
    super();
    this.title = 'Sequencer';
    this.open();
  }

  protected override onGUI (): void {
    if (GalaceanEffects.player.getCompositions().length === 0) {
      return;
    }
    this.currentComposition = GalaceanEffects.player.getCompositions()[0];
    const currentComposition = this.currentComposition;
    const compositionComponent = currentComposition.rootItem.getComponent(CompositionComponent);

    if (!compositionComponent) {
      return;
    }

    if (ImGui.Button('Play')) {
      void currentComposition.resume();
    }
    ImGui.SameLine();
    if (ImGui.Button('Pause')) {
      currentComposition.pause();
    }
    ImGui.SameLine();
    ImGui.Text(currentComposition.time.toFixed(2) + ' s');

    this.currentTime = currentComposition.time;

    this.drawTimeCursor();
    const cursorLinePosition = ImGui.GetCursorScreenPos();

    //@ts-expect-error
    for (const track of compositionComponent.timelineAsset.tracks) {
      const trackAsset = track as TrackAsset;

      //@ts-expect-error
      if (ImGui.CollapsingHeader(trackAsset.binding.name, ImGui.ImGuiTreeNodeFlags.DefaultOpen)) {
        this.drawTrack(trackAsset);
      }
    }
    const drawList = ImGui.GetWindowDrawList();

    drawList.AddLine(new ImGui.Vec2(this.timeCursorPositionX, cursorLinePosition.y - 4), new ImGui.Vec2(this.timeCursorPositionX, cursorLinePosition.y + ImGui.GetCursorPosY()), (new ImGui.Color(1, 1, 1, 1)).toImU32());
  }

  private drawTrack (track: TrackAsset) {
    for (const child of track.getChildTracks()) {
      const trackAsset = child;

      for (const clip of trackAsset.getClips()) {
        ImGui.Text(trackAsset.constructor.name);

        ImGui.SameLine(this.trackUIOffset);
        const sizePerScend = ImGui.GetWindowSize().x / 100;
        const totalTime = 100;

        const grabSize = clip.duration * sizePerScend;

        ImGui.PushStyleVar(ImGui.StyleVar.GrabMinSize, grabSize);
        ImGui.SliderFloat('##' + trackAsset.getInstanceId(), (value = clip.start) => clip.start = value, 0.0, totalTime);
        ImGui.PopStyleVar();
      }
    }
  }

  drawTimeCursor (): void {
    const windowPosition = ImGui.GetCursorScreenPos();

    this.timeCursorPositionX = windowPosition.x + this.trackUIOffset + this.currentTime * 10;

    ImGui.SetCursorScreenPos(new ImGui.ImVec2(this.timeCursorPositionX - 10, windowPosition.y));
    ImGui.PushID('Button');
    ImGui.Button('   ');
    ImGui.PopID();

    if (ImGui.IsItemActive() && ImGui.IsMouseDragging(0, 0.0)) {
      // 获取面板的位置
      const panelPos: ImGui.ImVec2 = ImGui.GetCursorScreenPos();

      // 获取鼠标相对于面板的位置
      const mousePos: ImGui.ImVec2 = ImGui.GetMousePos();
      const mousePosInPanel: ImGui.ImVec2 = new ImGui.ImVec2(mousePos.x - panelPos.x, mousePos.y - panelPos.y);

      this.currentComposition.setTime((mousePosInPanel.x - this.trackUIOffset) / 10);
    }

    if (ImGui.IsItemHovered() && ImGui.IsMouseClicked(0)) {
      this.isDragging = true;
    }

    if (this.isDragging && ImGui.IsMouseReleased(0)) {
      this.isDragging = false;
    }
  }
}