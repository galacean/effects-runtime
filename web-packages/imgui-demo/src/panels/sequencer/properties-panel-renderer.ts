import { ImGui } from '../../imgui';
import { COLORS } from './theme';
import type { SequencerState } from './sequencer-state';
import { getTrackColor, getEndBehaviorDescription } from './timeline-utils';

export class PropertiesPanelRenderer {
  constructor (private readonly state: SequencerState) {}

  /**
   * 绘制轨道属性面板
   */
  drawTrackPropertiesPanel (): void {
    const state = this.state;
    const windowPos = ImGui.GetCursorScreenPos();
    const windowSize = ImGui.GetContentRegionAvail();
    const drawList = ImGui.GetWindowDrawList();
    const panelBg = COLORS.timelineBg;
    const labelColor = new ImGui.Vec4(0.55, 0.55, 0.58, 1.0);
    const valueColor = new ImGui.Vec4(0.88, 0.88, 0.90, 1.0);
    const headerBg = COLORS.trackLabelBgAlt;
    const separatorColor = COLORS.trackRowDivider;

    drawList.AddRectFilled(
      windowPos,
      new ImGui.Vec2(windowPos.x + windowSize.x, windowPos.y + windowSize.y),
      ImGui.GetColorU32(panelBg)
    );

    ImGui.PushStyleColor(ImGui.ImGuiCol.Text, valueColor);
    ImGui.PushStyleColor(ImGui.ImGuiCol.Separator, separatorColor);

    // 优先级：keyframe > clip > track
    if (state.selectedKeyframeInfo) {
      this.drawKeyframeDetails(drawList, headerBg, labelColor);
    } else if (state.selectedClip) {
      this.drawClipDetails(drawList, headerBg, labelColor);
    } else if (state.selectedTrack) {
      this.drawTrackDetails(drawList, headerBg, labelColor);
    } else {
      ImGui.Spacing(); ImGui.Spacing();
      ImGui.Indent(20);
      ImGui.TextColored(new ImGui.Vec4(0.4, 0.4, 0.42, 1.0), 'No Selection');
      ImGui.Unindent(20);
    }

    ImGui.PopStyleColor(2);
  }

  /**
   * 绘制属性面板分组标题栏（带颜色条）
   */
  private drawPanelHeader (drawList: any, headerBg: ImGui.Vec4, accentColor: ImGui.Vec4, title: string): void {
    const pos = ImGui.GetCursorScreenPos();
    const width = ImGui.GetContentRegionAvail().x;
    const headerHeight = 24;

    drawList.AddRectFilled(
      pos,
      new ImGui.Vec2(pos.x + width, pos.y + headerHeight),
      ImGui.GetColorU32(headerBg)
    );
    drawList.AddRectFilled(
      pos,
      new ImGui.Vec2(pos.x + 3, pos.y + headerHeight),
      ImGui.GetColorU32(accentColor)
    );

    const textSize = ImGui.CalcTextSize(title);

    drawList.AddText(
      new ImGui.Vec2(pos.x + 10, pos.y + (headerHeight - textSize.y) / 2),
      ImGui.GetColorU32(new ImGui.Vec4(0.9, 0.9, 0.92, 1.0)),
      title
    );

    ImGui.SetCursorScreenPos(new ImGui.Vec2(pos.x, pos.y + headerHeight + 2));
  }

  /**
   * 绘制 label: value 行
   */
  private drawDetailRow (labelColor: ImGui.Vec4, label: string, value: string): void {
    ImGui.Spacing();
    ImGui.TextColored(labelColor, label);
    ImGui.SameLine(100);
    ImGui.Text(value);
  }

  private drawKeyframeDetails (drawList: any, headerBg: ImGui.Vec4, labelColor: ImGui.Vec4): void {
    const kf = this.state.selectedKeyframeInfo!;
    const absTime = kf.clipStart + kf.data.time * kf.clipDuration;

    this.drawPanelHeader(drawList, headerBg, new ImGui.Vec4(0.9, 0.75, 0.3, 1.0), `Keyframe  ${kf.channel}`);
    ImGui.Spacing();

    this.drawDetailRow(labelColor, 'Time', `${absTime.toFixed(3)}s`);
    this.drawDetailRow(labelColor, 'Normalized', `${kf.data.time.toFixed(4)}`);
    this.drawDetailRow(labelColor, 'Value', `${kf.data.value.toFixed(4)}`);
    ImGui.Separator();
    this.drawDetailRow(labelColor, 'Index', `${kf.index}`);
    this.drawDetailRow(labelColor, 'Clip Range', `${kf.clipStart.toFixed(2)}s ~ ${(kf.clipStart + kf.clipDuration).toFixed(2)}s`);
  }

  private drawClipDetails (drawList: any, headerBg: ImGui.Vec4, labelColor: ImGui.Vec4): void {
    const state = this.state;
    const clip = state.selectedClip;
    const clipColor = state.selectedClipTrack
      ? getTrackColor(state.selectedClipTrack, state)
      : new ImGui.Vec4(0.4, 0.4, 0.4, 1.0);

    this.drawPanelHeader(drawList, headerBg, clipColor, clip.name || 'Clip');
    ImGui.Spacing();

    this.drawDetailRow(labelColor, 'Start', `${clip.start.toFixed(3)}s`);
    this.drawDetailRow(labelColor, 'Duration', `${clip.duration.toFixed(3)}s`);
    this.drawDetailRow(labelColor, 'End', `${(clip.start + clip.duration).toFixed(3)}s`);
    ImGui.Separator();
    this.drawDetailRow(labelColor, 'EndBehavior', getEndBehaviorDescription(clip.endBehavior));
    if (state.selectedClipTrack) {
      this.drawDetailRow(labelColor, 'Track', state.selectedClipTrack.constructor.name);
    }
  }

  private drawTrackDetails (drawList: any, headerBg: ImGui.Vec4, labelColor: ImGui.Vec4): void {
    const state = this.state;
    const track = state.selectedTrack!;
    const trackType = track.constructor.name;
    const trackColor = getTrackColor(track, state);

    this.drawPanelHeader(drawList, headerBg, trackColor, trackType);
    ImGui.Spacing();

    this.drawDetailRow(labelColor, 'ID', track.getInstanceId().toString());
    this.drawDetailRow(labelColor, 'Clips', `${track.getClips().length}`);
    this.drawDetailRow(labelColor, 'Children', `${track.getChildTracks().length}`);
  }
}
