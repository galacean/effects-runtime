import { math } from '@galacean/effects';
import { editorColors as I } from '../../ui/theme/control-theme';

const color = (hex: string, alpha = 1) => new math.Color(
  parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255, alpha,
);

export const SEQUENCE_COLORS = {
  background: color('202020'), toolbar: color('242424'), outliner: color('242424'), header: color('2F2F2F'), headerHover: color('434343'),
  row: I.recessed, rowAlt: I.background, channel: I.recessed, group: I.header,
  line: color('181818'), grid: color('343434'), minorGrid: color('2A2A2A'), text: color('C0C0C0'), muted: color('787878'),
  input: I.input, inputBorder: I.outline, hover: I.hover, rowHover: I.panel,
  selectedText: color('FFFFFF'), curveBackground: color('181818'),
  selection: I.primary, selectionTint: color('18A0FB', 0.2), selectedKey: color('FFAF39'),
  highlightTint: color('FFFFFF', 0.15), hoverTint: color('FFFFFF', 0.05),
  selectionHovered: I.primaryHover, selectionPressed: I.primaryPress,
  keyAuto: color('FC7C7C'), keyUser: color('E7B7BC', 0.65), keyBreak: color('9DDABC', 0.91),
  keyLinear: color('00CEB3'), keyConstant: color('00B2D9'),
  playhead: color('FF4040'), playheadLine: color('FFFFFF', 0.5), time: color('E7A52B'),
  rangeStart: color('3D9B48'), rangeEnd: color('B34B3D'), active: color('26BBFF'), object: color('D49B45'),
  axes: [color('E05252'), color('69AF62'), color('5B93CC'), color('B4B4B4')],
  sections: { TransformTrack: color('535663'), SpriteColorTrack: color('59445D'),
    ActivationTrack: color('405C47'), default: color('525765') } as Record<string, math.Color>,
};
export const SEQUENCE_LAYOUT = {
  rowHeight: 24, objectHeight: 28, trackHeight: 27, groupHeight: 23, channelHeight: 22,
  rulerHeight: 38, toolbarHeight: 40, curveToolbarHeight: 40, footerHeight: 30, detailsHeight: 30, curveGutter: 38,
  treePadding: 4, treeIndent: 10, expanderSize: 16, rowIconSize: 16, columnIconSize: 14,
  toolbarIconSize: 20, toolbarButtonSize: 36, toolbarButtonHeight: 28, toolbarMenuWidth: 44, toolbarPadding: 6,
  columnSpacing: 22, columnRightPadding: 14, valueWidth: 64, valueHeight: 20,
  defaultOutlinerWidth: 360, minOutlinerWidth: 150, minTrackAreaWidth: 160, splitterWidth: 8,
};
export { curveTickStep as niceStep } from '../../ui/curve-editor/curve-screen-space';
