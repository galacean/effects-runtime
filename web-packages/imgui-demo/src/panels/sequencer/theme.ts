import { ImGui } from '../../imgui';

export const COLORS = {
  selection: new ImGui.Vec4(0.25, 0.55, 0.90, 1.0),
  selectionAlpha: new ImGui.Vec4(0.25, 0.55, 0.90, 0.3),
  header: new ImGui.Vec4(0.12, 0.12, 0.13, 1.0),
  headerAlt: new ImGui.Vec4(0.14, 0.14, 0.15, 1.0),
  hover: new ImGui.Vec4(1.0, 1.0, 1.0, 0.1),
  selectedHighlight: new ImGui.Vec4(1.0, 1.0, 1.0, 0.2),

  timelineBg: new ImGui.Vec4(0.1, 0.1, 0.1, 1.0),
  timelineLine: new ImGui.Vec4(0.4, 0.4, 0.4, 1.0),
  timelineText: new ImGui.Vec4(0.75, 0.75, 0.75, 1.0),

  trackLabelBg: new ImGui.Vec4(0.14, 0.14, 0.15, 1.0),
  trackLabelBgAlt: new ImGui.Vec4(0.16, 0.16, 0.17, 1.0),
  trackText: new ImGui.Vec4(0.85, 0.85, 0.85, 1.0),
  trackTextSelected: new ImGui.Vec4(1.0, 1.0, 1.0, 1.0),
  trackSeparator: new ImGui.Vec4(0.08, 0.08, 0.08, 1.0),
  trackRowDivider: new ImGui.Vec4(0.18, 0.18, 0.18, 1.0),

  cursor: new ImGui.Vec4(1.00, 0.20, 0.20, 0.9),

  extensionDivider: new ImGui.Vec4(0.7, 0.7, 0.7, 0.7),
  extensionIcon: new ImGui.Vec4(0.85, 0.85, 0.85, 0.9),

  channelX: new ImGui.Vec4(0.9, 0.3, 0.3, 1.0),
  channelY: new ImGui.Vec4(0.4, 0.8, 0.3, 1.0),
  channelZ: new ImGui.Vec4(0.3, 0.5, 0.9, 1.0),
  channelDefault: new ImGui.Vec4(0.8, 0.8, 0.8, 1.0),

  keyBorder: new ImGui.Vec4(0.05, 0.05, 0.05, 1.0),
  gridLine: new ImGui.Vec4(0.2, 0.2, 0.2, 0.3),
  keyOverlapBorder: new ImGui.Vec4(0.9, 0.2, 0.2, 1.0),

  propertyRowBg: new ImGui.Vec4(0.12, 0.12, 0.13, 1.0),

  curveGrid: new ImGui.Vec4(0.2, 0.2, 0.2, 0.4),
  curveGridZero: new ImGui.Vec4(0.3, 0.3, 0.3, 0.6),
  curveValueLabel: new ImGui.Vec4(0.5, 0.5, 0.5, 0.8),
  curveTangentLine: new ImGui.Vec4(0.6, 0.6, 0.6, 0.6),
  curveTangentHandle: new ImGui.Vec4(1.0, 1.0, 1.0, 0.9),
  curveCanvasBg: new ImGui.Vec4(0.08, 0.08, 0.09, 1.0),

  trackCategory: {
    TransformTrack: new ImGui.Vec4(0.95, 0.45, 0.15, 1.0), // Vibrant Orange
    ActivationTrack: new ImGui.Vec4(0.20, 0.95, 0.40, 1.0), // Vibrant Green
    SpriteColorTrack: new ImGui.Vec4(0.95, 0.20, 0.85, 1.0), // Vibrant Magenta
    SubCompositionTrack: new ImGui.Vec4(0.50, 0.50, 0.50, 1.0), // Gray for subcomposition
    ParticleTrack: new ImGui.Vec4(1.00, 0.85, 0.10, 1.0), // Vibrant Yellow
    default: new ImGui.Vec4(0.33, 0.38, 0.42, 1.0), // Dark Slate Gray/Blue (matched to screenshot)
  } as Record<string, ImGui.Vec4>,
};

export const LAYOUT = {
  keySize: 6,
  keyBorderWidth: 2,
  keyOverlapThresholdPx: 3,
  sectionHeight: 24,
  channelHeight: 24,
  sectionCornerRadius: 0,
  clipCornerRadius: 4,
  trackIndentWidth: 12,
  trackLabelPadding: 8,
  expanderIconSize: 10,
  clipVerticalPadding: 3,
  clipsAreaLeftPadding: 8,
  curveRowHeight: 120,
  curveVerticalPadding: 8,
  curveTangentHandleRadius: 4,
  curveTangentLineWidth: 1,
  curveLineWidth: 1.5,
  curveKeyDotRadius: 4,
  curveGridLineCount: 5,
};
