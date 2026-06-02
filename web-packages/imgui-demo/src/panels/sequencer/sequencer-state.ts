import type { Composition, TimelineClip, TrackAsset } from '@galacean/effects';
import type { ImGui } from '../../imgui';
import type { SelectedKeyframeInfo } from './types';

export class SequencerState {
  currentTime = 0;
  timeCursorPositionX = 0;

  // 时间轴配置
  timelineStartTime = 0;
  timelineEndTime = 30;
  pixelsPerSecond = 20;
  timelineHeight = 30;
  timelineRightPadding = 20;

  // 布局配置
  trackUIOffset = 200;
  currentLabelWidth = 200;
  trackLabelMinWidth = 150;
  trackLabelMaxWidth = 400;
  trackLabelResizeHandleWidth = 4;
  trackRowSpacing = 0;

  // 缓存和状态
  windowContentWidth = 0;
  timelineAreaWidth = 0;
  isScrubbing = false;
  resumeAfterScrub = false;
  trackRowCounter = 0;

  // 选中状态
  selectedTrack: TrackAsset | null = null;
  selectedClip: TimelineClip | null = null;
  selectedClipTrack: TrackAsset | null = null;
  clipDragMode: 'none' | 'move' | 'resize-left' | 'resize-right' = 'none';
  selectedKeyframeInfo: SelectedKeyframeInfo | null = null;
  selectedKeyframes = new Set<string>();

  // 展开状态
  expandedTracks = new Set<string>();
  expandedPropertyGroups = new Set<string>();
  initializedTrackIds = new Set<string>();

  // 滚动同步
  trackLabelsScrollY = 0;
  leftPanelLastScrollY = 0;
  rightPanelLastScrollY = 0;

  // 缓存
  majorTickXPositions: number[] = [];
  trackColorMap = new Map<string, ImGui.Vec4>();
  lastCompositionId: string | null = null;

  // 属性面板
  propertiesPanelWidth = 280;

  // 曲线模式
  curveMode = false;
  selectedPropertyGroup: string | null = null;
  selectedChannel: string | null = null;
  curveCanvasValueMin = -1;
  curveCanvasValueMax = 1;

  // 当前合成引用
  currentComposition!: Composition;
}
