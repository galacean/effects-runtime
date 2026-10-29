import { ImGui } from '../../platform/imgui/index';

const Color = ImGui.Color;

export class GraphStyle {
  static readonly s_defaultTitleColor = new Color(0.373, 0.373, 0.373, 1);
  static readonly s_nodeBackgroundColor = new Color(0.208, 0.208, 0.208, 1);
  static readonly s_nodeSelectedBorderColor = new Color(0.784, 0.784, 0, 1);
  static readonly s_activeIndicatorBorderColor = new Color(0.196, 0.804, 0.196, 1);

  static readonly s_connectionColor = new Color(0.725, 0.725, 0.725, 1);
  static readonly s_connectionColorValid = new Color(0, 1, 0, 1);
  static readonly s_connectionColorInvalid = new Color(1, 0, 0, 1);
  static readonly s_connectionColorActive = new Color(0.196, 0.804, 0.196, 1);
  static readonly s_connectionColorHovered = new Color(1, 1, 1, 1);
  static readonly s_connectionColorSelected = new Color(1, 1, 0, 1);

  static readonly s_genericNodeSeparatorColor = new Color(0.392, 0.392, 0.392, 1);
  static readonly s_genericNodeInternalRegionDefaultColor = new Color(0.157, 0.157, 0.157, 1);

  static readonly s_activeBorderIndicatorThickness = 2;
  static readonly s_activeBorderIndicatorPadding = GraphStyle.s_activeBorderIndicatorThickness + 3;
}
