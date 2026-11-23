import { math } from '@galacean/effects';

export class GraphStyle {
  static readonly titleFontScale = 1.1;
  static readonly contentFontScale = .82;
  static readonly titleMarkerWidth = 8;
  static readonly titleSpacing = 6;
  static readonly pinRadius = 6;
  static readonly pinColumnSpacing = 16;
  static readonly nodeBorderThickness = 2;
  static readonly transitionWidth = 3;
  static readonly transitionOffset = 8;
  static readonly arrowHeadWidth = 5;
  static readonly gridBackground = new math.Color(.157, .157, .157, .784);
  static readonly gridLine = new math.Color(.784, .784, .784, .157);
  static readonly selectionFill = new math.Color(.239, .878, .522, .118);
  static readonly selectionOutline = new math.Color(.239, .878, .522, .588);
  static readonly s_defaultTitleColor = new math.Color(0.373, 0.373, 0.373, 1);
  static readonly s_nodeBackgroundColor = new math.Color(0.208, 0.208, 0.208, 1);
  static readonly s_nodeSelectedBorderColor = new math.Color(0.784, 0.784, 0, 1);
  static readonly s_activeIndicatorBorderColor = new math.Color(0.196, 0.804, 0.196, 1);

  static readonly s_connectionColor = new math.Color(0.725, 0.725, 0.725, 1);
  static readonly s_connectionColorValid = new math.Color(0, 1, 0, 1);
  static readonly s_connectionColorInvalid = new math.Color(1, 0, 0, 1);
  static readonly s_connectionColorActive = new math.Color(0.196, 0.804, 0.196, 1);
  static readonly s_connectionColorHovered = new math.Color(1, 1, 1, 1);
  static readonly s_connectionColorSelected = new math.Color(1, 1, 0, 1);

  static readonly s_genericNodeSeparatorColor = new math.Color(0.392, 0.392, 0.392, 1);
  static readonly s_genericNodeInternalRegionDefaultColor = new math.Color(0.157, 0.157, 0.157, 1);

  static readonly s_activeBorderIndicatorThickness = 2;
  static readonly s_activeBorderIndicatorPadding = GraphStyle.s_activeBorderIndicatorThickness + 3;
}
