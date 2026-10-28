import { ImGui } from '../../imgui';

const color = (hex: string, alpha = 1) => new ImGui.Vec4(
  parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255, alpha,
);

export const SEQUENCE_COLORS = {
  background: color('202020'), toolbar: color('242424'), outliner: color('242424'), header: color('2F2F2F'),
  row: color('242424'), rowAlt: color('272727'), channel: color('222222'), group: color('292929'),
  line: color('181818'), grid: color('343434'), minorGrid: color('2A2A2A'), text: color('C0C0C0'), muted: color('787878'),
  input: color('0F0F0F'), inputBorder: color('383838'), hover: color('575757'), rowHover: color('383838'), popup: color('383838'),
  menuLabel: color('A0A0A0'), menuSeparator: color('FFFFFF', 0.25), menuBorder: color('4C4C4C'), selectedText: color('FFFFFF'), curveBackground: color('181818'),
  selection: color('0070E0'), selectionTint: color('0070E0', 0.12), selectedKey: color('FFAF39'),
  selectionHovered: color('0E86FF'), selectionPressed: color('0050A0'),
  keyAuto: color('FC7C7C'), keyUser: color('E7B7BC', 0.65), keyBreak: color('9DDABC', 0.91),
  keyLinear: color('00CEB3'), keyConstant: color('00B2D9'),
  playhead: color('FF4040'), playheadLine: color('FFFFFF', 0.5), time: color('E7A52B'),
  rangeStart: color('3D9B48'), rangeEnd: color('B34B3D'), active: color('26BBFF'), object: color('D49B45'),
  axes: [color('E05252'), color('69AF62'), color('5B93CC'), color('B4B4B4')],
  sections: { TransformTrack: color('535663'), SpriteColorTrack: color('59445D'),
    ActivationTrack: color('405C47'), default: color('525765') } as Record<string, ImGui.Vec4>,
};
export const SEQUENCE_LAYOUT = {
  rowHeight: 24, objectHeight: 28, trackHeight: 27, groupHeight: 23, channelHeight: 22,
  rulerHeight: 38, toolbarHeight: 40, curveToolbarHeight: 40, footerHeight: 30, detailsHeight: 30, curveGutter: 38,
  treePadding: 4, treeIndent: 10, expanderSize: 16, rowIconSize: 16, columnIconSize: 14,
  toolbarIconSize: 20, toolbarButtonSize: 36, toolbarButtonHeight: 28, toolbarMenuWidth: 44, toolbarPadding: 6,
  columnSpacing: 22, columnRightPadding: 14, valueWidth: 64, valueHeight: 20,
};
export function niceStep (rough: number): number {
  const base = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-8))));
  const fraction = rough / base;

  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * base;
}
