import type { TrackAsset } from '@galacean/effects';
import { CompositionComponent } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './panel';

@editorWindow()
export class Sequencer extends EditorWindow {

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
    const currentComposition = GalaceanEffects.player.getCompositions()[0];
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

    this.drawTimeCursor();
    const cursorLinePosition = ImGui.GetCursorScreenPos();

    //@ts-expect-error
    for (const track of compositionComponent.timelineAsset.tracks) {
      const trackAsset = track as TrackAsset;

      //@ts-expect-error
      ImGui.CollapsingHeader(trackAsset.binding.name);
      this.drawTrack(trackAsset);
    }

    if (!this.isDragging) {
      cursorLinePosition.x = cursorLinePosition.x + 200 + currentComposition.time * 10;
      this.timeCursorPosition.x = cursorLinePosition.x - 17;
    } else {
      cursorLinePosition.x = this.timeCursorPosition.x + 17;
      currentComposition.setTime((cursorLinePosition.x - 200) / 10);
    }

    const drawList = ImGui.GetWindowDrawList();

    drawList.AddLine(cursorLinePosition, new ImGui.Vec2(cursorLinePosition.x, cursorLinePosition.y + ImGui.GetCursorPosY()), (new ImGui.Color(1, 1, 1, 1)).toImU32());
  }

  private drawTrack (track: TrackAsset) {
    for (const child of track.getChildTracks()) {
      const trackAsset = child;

      for (const clip of trackAsset.getClips()) {
        ImGui.Text(trackAsset.constructor.name);

        ImGui.SameLine(200);
        const sizePerScend = ImGui.GetWindowSize().x / 100;
        const totalTime = 100;

        const grabSize = clip.duration * sizePerScend;

        ImGui.PushStyleVar(ImGui.StyleVar.GrabMinSize, grabSize);
        ImGui.SliderFloat('##' + trackAsset.getInstanceId(), (value = clip.start) => clip.start = value, 0.0, totalTime);
        ImGui.PopStyleVar();
      }
    }
  }

  timeCursorPosition: ImGui.ImVec2 = new ImGui.ImVec2(200, 0);
  isDragging: boolean = false;

  drawTimeCursor (): void {
    const windowPosition = ImGui.GetCursorScreenPos();

    ImGui.SetCursorScreenPos(new ImGui.ImVec2(windowPosition.x + this.timeCursorPosition.x, windowPosition.y));
    ImGui.PushID('Button');
    ImGui.Button('   ');
    ImGui.PopID();

    if (ImGui.IsItemActive() && ImGui.IsMouseDragging(0, 0.0)) {
      const delta: ImGui.ImVec2 = ImGui.GetIO().MouseDelta;

      this.timeCursorPosition.x += delta.x;
    }

    if (ImGui.IsItemHovered() && ImGui.IsMouseClicked(0)) {
      this.isDragging = true;
    }

    if (this.isDragging && ImGui.IsMouseReleased(0)) {
      this.isDragging = false;
    }
  }
}