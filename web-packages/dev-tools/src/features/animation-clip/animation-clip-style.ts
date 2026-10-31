import { math } from '@galacean/effects';
import { editorColors, color } from '../../ui/theme/control-theme';

export const COLORS = {
  selection: editorColors.primary,
  selectionAlpha: color('0070E0', .3),
  header: editorColors.header,
  headerAlt: editorColors.panel,
  hover: new math.Color(1.0, 1.0, 1.0, 0.1),
  selectedHighlight: new math.Color(1.0, 1.0, 1.0, 0.2),

  timelineBg: editorColors.recessed,
  timelineLine: new math.Color(0.4, 0.4, 0.4, 1.0),
  timelineText: editorColors.foreground,

  trackLabelBg: editorColors.panel,
  trackLabelBgAlt: editorColors.header,
  trackText: editorColors.foreground,
  trackTextSelected: editorColors.foregroundHover,
  trackSeparator: new math.Color(0.08, 0.08, 0.08, 1.0),
  trackRowDivider: new math.Color(0.18, 0.18, 0.18, 1.0),

  cursor: new math.Color(1.00, 0.20, 0.20, 0.9),

  extensionDivider: new math.Color(0.7, 0.7, 0.7, 0.7),
  extensionIcon: new math.Color(0.85, 0.85, 0.85, 0.9),

  channelX: new math.Color(0.9, 0.3, 0.3, 1.0),
  channelY: new math.Color(0.4, 0.8, 0.3, 1.0),
  channelZ: new math.Color(0.3, 0.5, 0.9, 1.0),
  channelDefault: new math.Color(0.8, 0.8, 0.8, 1.0),

  keyBorder: new math.Color(0.05, 0.05, 0.05, 1.0),
  gridLine: new math.Color(0.2, 0.2, 0.2, 0.3),
  keyOverlapBorder: new math.Color(0.9, 0.2, 0.2, 1.0),

  propertyRowBg: editorColors.panel,

  curveGrid: new math.Color(0.2, 0.2, 0.2, 0.4),
  curveGridZero: new math.Color(0.3, 0.3, 0.3, 0.6),
  curveValueLabel: new math.Color(0.5, 0.5, 0.5, 0.8),
  curveTangentLine: new math.Color(0.6, 0.6, 0.6, 0.6),
  curveTangentHandle: new math.Color(1.0, 1.0, 1.0, 0.9),
  curveCanvasBg: new math.Color(0.08, 0.08, 0.09, 1.0),

  trackCategory: {
    TransformTrack: new math.Color(0.95, 0.45, 0.15, 1.0), // Vibrant Orange
    ActivationTrack: new math.Color(0.20, 0.95, 0.40, 1.0), // Vibrant Green
    SpriteColorTrack: new math.Color(0.95, 0.20, 0.85, 1.0), // Vibrant Magenta
    ObjectReferencePropertyTrack: new math.Color(0.30, 0.80, 0.95, 1.0), // Cyan（对象引用 K 帧轨道）
    SubCompositionTrack: new math.Color(0.50, 0.50, 0.50, 1.0), // Gray for subcomposition
    ParticleTrack: new math.Color(1.00, 0.85, 0.10, 1.0), // Vibrant Yellow
    default: new math.Color(0.33, 0.38, 0.42, 1.0), // Dark Slate Gray/Blue (matched to screenshot)
  } as Record<string, math.Color>,
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
