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
