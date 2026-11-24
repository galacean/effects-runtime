import type { spec } from '@galacean/effects';

/** 选区移动与缩放的吸附配置。 */
export type SnapConfig = {
  /** 是否启用选区吸附。 */
  enabled: boolean,
  /** 吸附线宽度 */
  lineWidth: number,
  /** 吸附线颜色，格式为 0xRRGGBBAA。 */
  lineColor: number,
  /** 吸附判断距离 */
  distance: number,
};

/** 动效内部编辑模式配置。 */
export type EffectsEditModeConfig = {
  /** 是否允许子元素移动、缩放和旋转。 */
  allowTransform: boolean,
};

/** 滚轮驱动的视口导航配置。 */
export type ViewportNavigationConfig = {
  /** 是否将无修饰键的滚轮事件解释为缩放而非平移。 */
  scrollWheelZoom: boolean,
  /** 是否反转滚轮缩放方向。 */
  invertZoom: boolean,
  /** 单次滚轮事件允许的最大相对缩放比例。 */
  zoomStep: number,
};

/**
 * 视口展示 Gizmo 配置
 */
export type ViewportOverlayConfig = {
  /** 视口包围盒颜色，格式为 0xRRGGBBAA。 */
  boxColor: number,
  /** 视口包围盒线宽 */
  boxWidth: number,
  /** 是否绘制画框外遮罩。 */
  outerMaskEnabled: boolean,
  /** 蒙版颜色，格式为 0xRRGGBBAA。 */
  markColor: number,
  /** 出血安全区开关 */
  safeAreaEnabled: boolean,
  /** 出血安全区包围盒颜色，格式为 0xRRGGBBAA。 */
  safeAreaBoxColor: number,
};

/** 选区悬停与框选预览配置。 */
export type SelectionPreviewConfig = {
  /** 视频元素预选中是否自动播放 */
  videoPreSelectedPlay: boolean,
  /** 预选中线宽 */
  preSelectedWidth: number,
  /** 预选中颜色，格式为 0xRRGGBBAA。 */
  preSelectedColor: number,
  /** 框选区域填充色，格式为 0xRRGGBBAA。 */
  regionBoxColor: number,
  /** 框选区域线框颜色，格式为 0xRRGGBBAA。 */
  regionWireframeColor: number,
  /** 框选区域线框宽度 */
  regionWireframeWidth: number,
};

/** 元素缩放行为：整体缩放，或把缩放吸收到排版尺寸的双轴/单轴调整。 */
export type ResizeSelectionBehavior = 'scale' | 'resize' | 'resize-x' | 'resize-y';

/** 选区坐标轴、锚点和多选手柄配置。颜色使用 0xRRGGBBAA，尺寸单位为 CSS 像素。 */
export type TransformHandlesConfig = {
  /** 是否显示并允许操作横轴手柄，包括 Alt 旋转。 */
  xAxisEnabled: boolean,
  /** 是否显示并允许操作纵轴手柄，包括 Alt 旋转。 */
  yAxisEnabled: boolean,
  /** 是否显示并允许拖动元素锚点。 */
  anchorEnabled: boolean,
  /** 横轴线颜色。 */
  xAxisLineColor: number,
  /** 纵轴线颜色。 */
  yAxisLineColor: number,
  /** 横轴箭头填充色。 */
  xAxisFillColor: number,
  /** 纵轴箭头填充色。 */
  yAxisFillColor: number,
  /** 坐标轴线宽。 */
  axisLineWidth: number,
  /** 拖动中的坐标轴线宽。 */
  activeAxisLineWidth: number,
  /** 坐标轴总长度，包含箭头。 */
  axisLength: number,
  /** 箭头长度。 */
  axisArrowLength: number,
  /** 箭头底边宽度。 */
  axisArrowWidth: number,
  /** 锚点圆框半径，同时用于锚点命中。 */
  anchorRadius: number,
  /** 锚点填充圆半径。 */
  anchorFillRadius: number,
  /** 锚点圆框颜色。 */
  anchorLineColor: number,
  /** 锚点圆框线宽。 */
  anchorLineWidth: number,
  /** 锚点填充色。 */
  anchorFillColor: number,
  /** 多选缩放角点的边长。 */
  groupCornerSize: number,
  /** 多选缩放角点边框色。 */
  groupCornerLineColor: number,
  /** 多选缩放角点边框宽度。 */
  groupCornerLineWidth: number,
  /** 多选缩放角点填充色。 */
  groupCornerFillColor: number,
  /** 锚点坐标标签字号。 */
  labelFontSize: number,
  /** 锚点坐标标签文字颜色。 */
  labelTextColor: number,
  /** 锚点坐标标签背景色。 */
  labelBackgroundColor: number,
  /** 标签左右内边距。 */
  labelPaddingX: number,
  /** 标签上下内边距。 */
  labelPaddingY: number,
  /** 两行坐标文字间距。 */
  labelLineGap: number,
  /** 标签相对锚点的横向偏移。 */
  labelOffsetX: number,
  /** 标签相对锚点的纵向偏移。 */
  labelOffsetY: number,
};

/** 运动路径与控制点绘制配置。颜色使用 0xRRGGBBAA，尺寸单位为 CSS 像素。 */
export type CurveConfig = {
  /** 运动路径颜色。 */
  pathColor: number,
  /** 运动路径线宽。 */
  pathWidth: number,
  /** 运动路径外描边颜色。 */
  pathOutlineColor: number,
  /** 运动路径外描边总宽度。 */
  pathOutlineWidth: number,
  /** 控制点与路径点之间的连线颜色。 */
  controlLineColor: number,
  /** 控制点连线宽度。 */
  controlLineWidth: number,
  /** 控制点连线外描边颜色。 */
  controlLineOutlineColor: number,
  /** 控制点连线外描边总宽度。 */
  controlLineOutlineWidth: number,
  /** 普通路径点的方框边长。 */
  pointSize: number,
  /** 选中路径点的方框边长。 */
  selectedPointSize: number,
  /** 悬停路径点的方框边长。 */
  hoverPointSize: number,
  /** 普通路径点填充色。 */
  pointFillColor: number,
  /** 选中路径点填充色。 */
  selectedPointFillColor: number,
  /** 悬停路径点填充色。 */
  hoverPointFillColor: number,
  /** 路径点边框颜色。 */
  pointLineColor: number,
  /** 路径点边框宽度。 */
  pointLineWidth: number,
  /** 路径点外描边颜色。 */
  pointOutlineColor: number,
  /** 路径点外描边向外扩展的宽度。 */
  pointOutlineWidth: number,
  /** 普通控制点半径。 */
  controlPointRadius: number,
  /** 选中控制点半径。 */
  selectedControlPointRadius: number,
  /** 悬停控制点半径。 */
  hoverControlPointRadius: number,
  /** 普通控制点填充色。 */
  controlPointFillColor: number,
  /** 选中控制点填充色。 */
  selectedControlPointFillColor: number,
  /** 悬停控制点填充色。 */
  hoverControlPointFillColor: number,
  /** 控制点圆框颜色。 */
  controlPointLineColor: number,
  /** 控制点圆框宽度。 */
  controlPointLineWidth: number,
  /** 控制点外描边颜色。 */
  controlPointOutlineColor: number,
  /** 控制点外描边向外扩展的宽度。 */
  controlPointOutlineWidth: number,
};

/** 渐变编辑辅助图形配置。颜色使用 0xRRGGBBAA，尺寸单位为 CSS 像素。 */
export type GradientConfig = {
  /** 渐变起止点连线颜色。 */
  lineColor: number,
  /** 渐变起止点连线宽度。 */
  lineWidth: number,
  /** 径向或角度渐变范围轮廓颜色。 */
  rangeLineColor: number,
  /** 渐变范围轮廓线宽。 */
  rangeLineWidth: number,
  /** 旋转手柄圆框半径。 */
  rotationRadius: number,
  /** 旋转手柄圆框颜色。 */
  rotationLineColor: number,
  /** 旋转手柄圆框线宽。 */
  rotationLineWidth: number,
  /** 起止点填充圆半径。 */
  endpointRadius: number,
  /** 起止点填充色。 */
  endpointFillColor: number,
  /** 起止点圆框颜色。 */
  endpointLineColor: number,
  /** 起止点圆框线宽；0 表示不绘制圆框。 */
  endpointLineWidth: number,
  /** 色标沿渐变切线方向的宽度。 */
  stopWidth: number,
  /** 色标沿渐变法线方向的高度。 */
  stopHeight: number,
  /** 色标中心相对渐变线的法向偏移。 */
  stopOffset: number,
  /** 普通色标边框颜色。 */
  stopLineColor: number,
  /** 普通色标边框宽度。 */
  stopLineWidth: number,
  /** 选中色标和添加预览的边框颜色。 */
  selectedStopLineColor: number,
  /** 选中色标和添加预览的边框宽度。 */
  selectedStopLineWidth: number,
  /** 色标显示填充色；省略时显示实际渐变颜色，不修改渐变数据。 */
  stopFillColor?: number,
  /** 选中色标和添加预览的填充色；省略时沿用普通色标填充规则。 */
  selectedStopFillColor?: number,
  /** 选中色标百分比标签字号。 */
  labelFontSize: number,
  /** 百分比标签文字颜色。 */
  labelTextColor: number,
  /** 百分比标签相对色标中心的横向偏移。 */
  labelOffsetX: number,
  /** 百分比标签相对色标中心的纵向偏移。 */
  labelOffsetY: number,
};

/** FFD 晶格编辑绘制配置。颜色使用 0xRRGGBBAA，尺寸单位为 CSS 像素。 */
export type CrystalLatticeConfig = {
  /** 普通网格线颜色。 */
  lineColor: number,
  /** 普通网格线宽度。 */
  lineWidth: number,
  /** 网格边界线颜色。 */
  boundaryLineColor: number,
  /** 网格边界线宽度。 */
  boundaryLineWidth: number,
  /** 连接两个选中点的网格线颜色。 */
  selectedLineColor: number,
  /** 连接两个选中点的网格线宽度。 */
  selectedLineWidth: number,
  /** 普通晶格点半径。 */
  pointRadius: number,
  /** 选中晶格点半径。 */
  selectedPointRadius: number,
  /** 普通晶格点填充色。 */
  pointFillColor: number,
  /** 选中晶格点填充色。 */
  selectedPointFillColor: number,
  /** 受软选择影响的晶格点填充色。 */
  softPointFillColor: number,
  /** 晶格点外边框颜色。 */
  pointBorderColor: number,
  /** 晶格点外边框向外扩展的宽度。 */
  pointBorderWidth: number,
  /** 晶格点悬停圆环半径。 */
  hoverRingRadius: number,
  /** 悬停圆环颜色。 */
  hoverRingColor: number,
  /** 悬停圆环线宽。 */
  hoverRingWidth: number,
  /** 悬停圆环外描边颜色。 */
  hoverRingOutlineColor: number,
  /** 悬停圆环外描边总宽度。 */
  hoverRingOutlineWidth: number,
  /** 选中点整体变换框颜色。 */
  frameLineColor: number,
  /** 整体变换框线宽。 */
  frameLineWidth: number,
  /** 整体变换框距选中点边界的距离。 */
  framePadding: number,
  /** 整体变换框的最小边长。 */
  frameMinSize: number,
  /** 整体变换框角点边长。 */
  cornerSize: number,
  /** 变换框角点填充色。 */
  cornerFillColor: number,
  /** 变换框角点边框颜色。 */
  cornerLineColor: number,
  /** 变换框角点边框宽度；0 表示不绘制边框。 */
  cornerLineWidth: number,
  /** 中心十字标记边长。 */
  centerSize: number,
  /** 中心十字标记颜色。 */
  centerLineColor: number,
  /** 中心十字标记线宽。 */
  centerLineWidth: number,
  /** 软选择影响范围轮廓颜色。 */
  softRangeLineColor: number,
  /** 软选择影响范围轮廓线宽。 */
  softRangeLineWidth: number,
  /** 框选区域边框颜色。 */
  marqueeLineColor: number,
  /** 框选区域边框宽度。 */
  marqueeLineWidth: number,
  /** 框选区域填充色；默认透明。 */
  marqueeFillColor: number,
  /** 操作数值标签字号。 */
  labelFontSize: number,
  /** 操作数值标签文字颜色。 */
  labelTextColor: number,
  /** 操作数值标签背景色。 */
  labelBackgroundColor: number,
  /** 标签左右内边距。 */
  labelPaddingX: number,
  /** 标签上下内边距。 */
  labelPaddingY: number,
  /** 标签相对指针的横向偏移。 */
  labelOffsetX: number,
  /** 标签相对指针的纵向偏移。 */
  labelOffsetY: number,
  /** 标签与画布边缘的最小距离。 */
  labelViewportMargin: number,
};

/** FFD 基础三角网格绘制配置。颜色使用 0xRRGGBBAA，尺寸单位为 CSS 像素。 */
export type FFDWireframeConfig = {
  /** 三角网格线条颜色。 */
  lineColor: number,
  /** 三角网格线条宽度。 */
  lineWidth: number,
};

/** 选区变换线框、手柄与信息标签配置。 */
export type ResizeSelectionConfig = {
  /** 预览基准像素到当前显示尺寸的比例。 */
  pixelRatio: number,
  /** 已包含在 viewScale 中的内容适配比例。 */
  contentRatio: number,
  /** 按运行时元素 ID 解析整体缩放或排版尺寸调整行为；默认整体缩放。 */
  resolveResizeBehavior?: (itemId: string) => ResizeSelectionBehavior,
  /** 线框颜色，格式为 0xRRGGBBAA。 */
  wireframeColor: number,
  /** 线框线宽 */
  wireframeWidth: number,
  /** 角点填充色，格式为 0xRRGGBBAA。 */
  cornerFillColor: number,
  /** 角点描边色，格式为 0xRRGGBBAA。 */
  cornerLineColor: number,
  /** 角点描边宽度 */
  cornerLineWidth: number,
  /** 缩放交互点半径 */
  scaleCircleSize: number,
  /** 旋转交互方形的半边长 */
  rotationCircleSize: number,
  /** 画板移动元素位置线颜色，格式为 0xRRGGBBAA。 */
  frameMoveLineColor: number,
  /** 画板移动元素位置线宽 */
  frameMoveLineWidth: number,
  /** 信息展示开关 */
  infoShowEnabled: boolean,
  /** 尺寸文案颜色，格式为 0xRRGGBBAA。 */
  sizeTextColor: number,
  /** 名称文案颜色，格式为 0xRRGGBBAA。 */
  nameTextColor: number,
  /** 图片元素 logo 地址 */
  imageLogoUrl: string,
  /** 成组元素 logo 地址 */
  groupLogoUrl: string,
  /** 文本元素 logo 地址 */
  textLogoUrl: string,
  /** 视频元素 logo 地址 */
  videoLogoUrl: string,
  /** 画板元素 logo 地址 */
  frameLogoUrl: string,
  /** 动效元素 logo 地址 */
  effectsLogoUrl: string,
};

/**
 * 图片裁切 Gizmo 配置
 */
export type ImageCutConfig = {
  /** 蒙版颜色，格式为 0xRRGGBBAA。 */
  maskColor: number,
  /** 裁切包围盒线宽 */
  cutBoxLineWidth: number,
  /** 裁切包围盒线色，格式为 0xRRGGBBAA。 */
  cutBoxLineColor: number,
  /** 元素包围盒线宽 */
  itemBoxLineWidth: number,
  /** 元素包围盒线色，格式为 0xRRGGBBAA。 */
  itemBoxLineColor: number,
  /** 角点半径 */
  cutBoxCornerRadius: number,
  /** 角点填充色，格式为 0xRRGGBBAA。 */
  cutBoxCornerFillColor: number,
  /** 角点线宽 */
  cutBoxCornerLineWidth: number,
  /** 角点线色，格式为 0xRRGGBBAA。 */
  cutBoxCornerLineColor: number,
  /** 缩放交互判断距离 */
  scaleInteractionDistance: number,
  /** 单向缩放交互判断距离 */
  directionScaleInteractionDistance: number,
  /** 网格线宽度 */
  gridLineWidth: number,
  /** 网格线颜色，格式为 0xRRGGBBAA。 */
  gridLineColor: number,
  /** 网格线数量 */
  gridCount: number,
};

/**
 * 图片扩边 Gizmo 配置
 */
export type ImageExpandConfig = {
  /** 蒙版颜色，格式为 0xRRGGBBAA。 */
  maskColor: number,
  /** 扩边包围盒线宽 */
  expandBoxLineWidth: number,
  /** 扩边包围盒线色，格式为 0xRRGGBBAA。 */
  expandBoxLineColor: number,
  /** 角点半径 */
  expandBoxCornerRadius: number,
  /** 角点线宽 */
  expandBoxCornerLineWidth: number,
  /** 角点线色，格式为 0xRRGGBBAA。 */
  expandBoxCornerLineColor: number,
  /** 角点填充色，格式为 0xRRGGBBAA。 */
  expandBoxCornerFillColor: number,
  /** 缩放交互判断距离 */
  scaleInteractionDistance: number,
  /** 单向缩放交互判断距离 */
  directionScaleInteractionDistance: number,
  /** 网格线宽度 */
  gridLineWidth: number,
  /** 网格线颜色，格式为 0xRRGGBBAA。 */
  gridLineColor: number,
  /** 网格线数量 */
  gridCount: number,
};

/**
 * 蒙版 Gizmo 配置
 */
export type MaskConfig = {
  /** 黑白蒙版图片 URL；空字符串表示不使用基础蒙版图 */
  maskImage: string,
  /** 画笔大小 */
  brushSize: number,
  /** 笔刷颜色，格式为 0xRRGGBBAA。 */
  brushColor: number,
  /** 蒙版颜色，格式为 0xRRGGBBAA。 */
  maskColor: number,
  /** 蒙版背景色，格式为 0xRRGGBBAA。 */
  maskBackgroundColor: number,
  /** 元素包围盒线框宽度 */
  boxLineWidth: number,
  /** 元素包围盒线框颜色，格式为 0xRRGGBBAA。 */
  boxLineColor: number,
};

/**
 * 精准改字 Gizmo 配置
 */
export type SpriteTextEditConfig = {
  /** 文案颜色，格式为 0xRRGGBBAA。 */
  textColor: number,
  /** 预选中文案颜色，格式为 0xRRGGBBAA。 */
  preSelectedTextColor: number,
  /** 包围盒线框宽度 */
  boxLineWidth: number,
  /** 包围盒间隔线长度 */
  dashLineDash: number,
  /** 包围盒间隔线间隔 */
  dashLineGap: number,
  /** 编辑包围盒颜色，格式为 0xRRGGBBAA。 */
  editBoxColor: number,
  /** 编辑包围盒线框颜色，格式为 0xRRGGBBAA。 */
  editBoxLineColor: number,
  /** 编辑包围盒预选颜色，格式为 0xRRGGBBAA。 */
  editBoxPreSelectedColor: number,
  /** 编辑包围盒预选线框颜色，格式为 0xRRGGBBAA。 */
  editBoxLinePreSelectedColor: number,
  /** 已更改编辑包围盒颜色，格式为 0xRRGGBBAA。 */
  hasChangedEditBoxColor: number,
  /** 已更改编辑包围盒线框颜色，格式为 0xRRGGBBAA。 */
  hasChangedEditBoxLineColor: number,
  /** 已更改编辑包围盒预选颜色，格式为 0xRRGGBBAA。 */
  hasChangedEditBoxPreSelectedColor: number,
  /** 已更改编辑包围盒预选线框颜色，格式为 0xRRGGBBAA。 */
  hasChangedEditBoxLinePreSelectedColor: number,
  /** 选中状态标记包围盒颜色，格式为 0xRRGGBBAA。 */
  editBoxSelectedColor: number,
};

/**
 * 图标 Gizmo 配置
 */
export type IconConfig = {
  /** 自动展示 */
  autoShow: boolean,
  /** 视频播放图标地址 */
  videoPlayUrl: string,
  /** 视频播放图标距右下角偏移值 */
  videoPlayShift: [number, number],
  /** 视频播放图标宽 */
  videoPlayWidth: number,
  /** 视频播放图标高 */
  videoPlayHeight: number,
  /** 图片生成器图标地址 */
  imageGeneratorUrl: string,
  /** 视频生成器图标地址 */
  videoGeneratorUrl: string,
  /** 生成器图标宽 */
  generatorWidth: number,
  /** 生成器图标高 */
  generatorHeight: number,
};

/**
 * 元素创建 Gizmo 配置
 */
export type ItemCreateConfig = {
  /** 边框颜色，格式为 0xRRGGBBAA。 */
  frameBorderColor: number,
  /** 边框宽度 */
  frameBorderWidth: number,
  /** 填充颜色，格式为 0xRRGGBBAA。 */
  frameFillColor: number,
  /** 选中子元素包围盒颜色，格式为 0xRRGGBBAA。 */
  frameChildBoxColor: number,
};

/** 钢笔工具节点、线段和控制柄辅助显示配置。 */
export type PenConfig = {
  /** 节点命中距离。 */
  hitDistance: number,
  /** 锚点直径。 */
  pointSize: number,
  /** 控制柄直径。 */
  controlPointSize: number,
  /** 普通锚点填充色。 */
  pointColor: number,
  /** 选中锚点填充色。 */
  selectedPointColor: number,
  /** 锚点描边色。 */
  pointLineColor: number,
  /** 悬停锚点描边色。 */
  hoverPointLineColor: number,
  /** 普通线段颜色。 */
  lineColor: number,
  /** 选中线段颜色。 */
  selectedLineColor: number,
  /** 悬在线段颜色。 */
  hoverLineColor: number,
  /** 普通控制柄填充色。 */
  handleColor: number,
  /** 选中控制柄填充色。 */
  selectedHandleColor: number,
  /** 控制柄连线颜色。 */
  handleLineColor: number,
  /** 悬停控制柄描边色。 */
  hoverHandleLineColor: number,
  /** 拖动控制柄连线颜色。 */
  activeHandleLineColor: number,
  /** 创建预览线颜色。 */
  previewLineColor: number,
  /** 套索线颜色。 */
  lassoLineColor: number,
  /** 普通线段宽度。 */
  lineWidth: number,
  /** 选中线段宽度。 */
  selectedLineWidth: number,
  /** 锚点描边宽度。 */
  pointLineWidth: number,
  /** 控制柄描边宽度。 */
  controlPointLineWidth: number,
  /** 悬在线段描边宽度。 */
  hoverLineWidth: number,
  /** 控制柄连线宽度。 */
  handleLineWidth: number,
  /** 拖动控制柄连线宽度。 */
  activeHandleLineWidth: number,
  /** 创建预览线宽度。 */
  previewLineWidth: number,
  /** 套索线宽度。 */
  lassoLineWidth: number,
};

/** 造型工具预览与新形状初始化配置。 */
export type ShapeConfig = {
  /** 造型拖动预览颜色。 */
  previewColor: number,
  /** 造型拖动预览线宽。 */
  previewLineWidth: number,
  /** 点击创建时的默认宽度。 */
  defaultWidth: number,
  /** 点击创建时的默认高度。 */
  defaultHeight: number,
  /** 拖动创建的最小宽度。 */
  minWidth: number,
  /** 拖动创建的最小高度。 */
  minHeight: number,
  /** 多边形和星形的最小半径。 */
  minRadius: number,
  /** 新元素填充颜色。 */
  initialFillColor: number,
  /** 新元素描边颜色。 */
  initialStrokeColor: number,
  /** 新元素描边宽度。 */
  initialStrokeWidth: number,
  /** 新元素描边端点样式。 */
  initialStrokeCap: spec.LineCap,
  /** 新元素描边连接样式。 */
  initialStrokeJoin: spec.LineJoin,
  /** 新元素渲染模式。 */
  initialRenderMode: spec.RenderMode,
  /** 矩形圆角。 */
  rectangleRoundness: number,
  /** 多边形顶点数。 */
  polygonPointCount: number,
  /** 多边形半径。 */
  polygonRadius: number,
  /** 多边形圆角。 */
  polygonRoundness: number,
  /** 星形顶点数。 */
  starPointCount: number,
  /** 星形内半径。 */
  starInnerRadius: number,
  /** 星形外半径。 */
  starOuterRadius: number,
  /** 星形内角圆度。 */
  starInnerRoundness: number,
  /** 星形外角圆度。 */
  starOuterRoundness: number,
};

/**
 * Loading Gizmo 配置
 */
export type LoadingConfig = {
  /** Loading 态 fragment 标识 */
  loadingFragment: string,
};

/** 参考线的选中范围。 */
export type RulerGuideSelectionMode = 'line' | 'ruler';

/** 标尺、参考线及参考元素吸附配置。 */
export type RulerConfig = {
  /** 是否启用标尺刻度、参考线交互与参考线吸附。 */
  enabled: boolean,
  /** 标尺带宽度，单位为 CSS 像素。 */
  rulerSize: number,
  /** 标尺显示值相对文档坐标的换算倍数。 */
  rulerValueScale: number,
  /** 参考线命中范围：仅整条参考线，或整条参考线加对应的标尺带。 */
  guideSelectionMode: RulerGuideSelectionMode,
  /** 未选中参考线颜色，格式为 0xRRGGBBAA。 */
  guideColor: number,
  /** 选中参考线颜色，格式为 0xRRGGBBAA。 */
  selectedGuideColor: number,
  /** 参考线宽度，单位为 CSS 像素。 */
  guideLineWidth: number,
  /** 参考线命中距离，单位为 CSS 像素。 */
  guideHitDistance: number,
  /** 标尺文字颜色，格式为 0xRRGGBBAA。 */
  rulerTextColor: number,
  /** 标尺刻度线颜色，格式为 0xRRGGBBAA。 */
  rulerGridColor: number,
  /** 标尺区域底色，格式为 0xRRGGBBAA。 */
  rulerBackgroundColor: number,
  /** 是否显示选中参考线的当前位置。 */
  guidePositionVisible: boolean,
  /** 当前位置文字字号。 */
  guidePositionFontSize: number,
  /** 当前位置文字颜色，格式为 0xRRGGBBAA。 */
  guidePositionTextColor: number,
  /** 当前位置标签底色，格式为 0xRRGGBBAA。 */
  guidePositionBackgroundColor: number,
  /** 是否启用按住 Shift 时的参考元素吸附。 */
  shiftSnapEnabled: boolean,
  /** 参考元素吸附距离，单位为 CSS 像素。 */
  shiftSnapDistance: number,
};
