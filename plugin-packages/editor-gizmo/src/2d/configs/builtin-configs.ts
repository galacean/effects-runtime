import { defineConfig } from './config-definition';
import type {
  EffectsEditModeConfig,
  IconConfig,
  ItemCreateConfig,
  MaskConfig,
  ImageCutConfig,
  ImageExpandConfig,
  SelectionPreviewConfig,
  SnapConfig,
  SpriteTextEditConfig,
  ResizeSelectionConfig,
  ViewportNavigationConfig,
  ViewportOverlayConfig,
  RulerConfig,
} from './types';

export { DEFAULT_LOADING_FRAGMENT, loadingConfig } from './loading-config';

export const effectsEditModeConfig = defineConfig<'mode.effects-edit', EffectsEditModeConfig>({
  id: 'mode.effects-edit',
  defaults: { allowTransform: true },
});

export const rulerConfig = defineConfig<'ruler', RulerConfig>({
  id: 'ruler',
  defaults: {
    enabled: true,
    rulerSize: 20,
    rulerValueScale: 1,
    guideSelectionMode: 'ruler',
    guideColor: 0x0d99ffe6,
    selectedGuideColor: 0xf59e0be6,
    guideLineWidth: 1,
    guideHitDistance: 5,
    rulerTextColor: 0x6b7280ff,
    rulerGridColor: 0x6b7280ff,
    rulerBackgroundColor: 0xf3f4f6ff,
    guidePositionVisible: true,
    guidePositionFontSize: 10,
    guidePositionTextColor: 0xffffffff,
    guidePositionBackgroundColor: 0xf59e0bf2,
    shiftSnapEnabled: true,
    shiftSnapDistance: 5,
  },
});

export const viewportNavigationConfig = defineConfig<'viewport.navigation', ViewportNavigationConfig>({
  id: 'viewport.navigation',
  defaults: {
    scrollWheelZoom: false,
    invertZoom: false,
    zoomStep: 0.1,
  },
});

export const viewportOverlayConfig = defineConfig<'viewport.overlay', ViewportOverlayConfig>({
  id: 'viewport.overlay',
  defaults: {
    boxColor: 0xFF0000FF,
    boxWidth: 1,
    outerMaskEnabled: true,
    markColor: 0x0000002B,
    safeAreaEnabled: true,
    safeAreaBoxColor: 0x00FF004D,
  },
});

export const selectionPreviewConfig = defineConfig<'selection.preview', SelectionPreviewConfig>({
  id: 'selection.preview',
  defaults: {
    videoPreSelectedPlay: true,
    preSelectedColor: 0x3b82f6ff,
    preSelectedWidth: 2,
    regionBoxColor: 0x3b82f62b,
    regionWireframeColor: 0x3b82f6c7,
    regionWireframeWidth: 1,
  },
});

export const selectionSnapConfig = defineConfig<'selection.snap', SnapConfig>({
  id: 'selection.snap',
  defaults: {
    enabled: true,
    lineWidth: 0.8,
    lineColor: 0xF24822FF,
    distance: 5,
  },
});

export const resizeSelectionConfig = defineConfig<'resize-selection', ResizeSelectionConfig>({
  id: 'resize-selection',
  defaults: {
    pixelRatio: 1,
    contentRatio: 1,
    wireframeColor: 0x3b82f6ff,
    wireframeWidth: 1.5,
    cornerFillColor: 0xFFFFFFFF,
    cornerLineColor: 0x3b82f6ff,
    cornerLineWidth: 1.5,
    scaleCircleSize: 4,
    rotationCircleSize: 7,
    infoShowEnabled: true,
    sizeTextColor: 0x666666FF,
    nameTextColor: 0x666666FF,
    frameMoveLineColor: 0x3b82f6ff,
    frameMoveLineWidth: 2,
    imageLogoUrl: 'https://mdn.alipayobjects.com/huamei_ixsp8m/afts/img/A*F2wVS7x0MfIAAAAAQBAAAAgAev-aAQ/original',
    groupLogoUrl: 'https://mdn.alipayobjects.com/huamei_ppzin5/afts/img/Yo69Sr7boqYAAAAAH3AAAAgADjdkAQFr/original',
    textLogoUrl: 'https://mdn.alipayobjects.com/huamei_ppzin5/afts/img/Yo69Sr7boqYAAAAAH3AAAAgADjdkAQFr/original',
    videoLogoUrl: 'https://mdn.alipayobjects.com/huamei_ixsp8m/afts/img/A*w1fnS4mq0VgAAAAAQCAAAAgAev-aAQ/original',
    frameLogoUrl: 'https://mdn.alipayobjects.com/huamei_ixsp8m/afts/img/A*DRF_RpndkjUAAAAAQDAAAAgAev-aAQ/original',
    effectsLogoUrl: 'https://mdn.alipayobjects.com/huamei_ixsp8m/afts/img/A*RMewR4ruUnYAAAAAQGAAAAgAev-aAQ/original',
  },
});

export const imageCutConfig = defineConfig<'tool.image-cut', ImageCutConfig>({
  id: 'tool.image-cut',
  defaults: {
    maskColor: 0xFFFFFF80,
    cutBoxLineWidth: 2,
    cutBoxLineColor: 0x6A34FFFF,
    itemBoxLineWidth: 1,
    itemBoxLineColor: 0x6A34FFFF,
    cutBoxCornerRadius: 5,
    cutBoxCornerFillColor: 0xFFFFFFFF,
    cutBoxCornerLineWidth: 2,
    cutBoxCornerLineColor: 0x6A34FFFF,
    scaleInteractionDistance: 8,
    directionScaleInteractionDistance: 5,
    gridLineWidth: 1,
    gridLineColor: 0xFFFFFFFF,
    gridCount: 2,
  },
});

export const imageExpandConfig = defineConfig<'tool.image-expand', ImageExpandConfig>({
  id: 'tool.image-expand',
  defaults: {
    maskColor: 0x6A34FF33,
    expandBoxLineWidth: 2,
    expandBoxLineColor: 0x6A34FFFF,
    expandBoxCornerRadius: 5,
    expandBoxCornerLineWidth: 2,
    expandBoxCornerLineColor: 0x6A34FFFF,
    expandBoxCornerFillColor: 0xFFFFFFFF,
    scaleInteractionDistance: 8,
    directionScaleInteractionDistance: 5,
    gridLineWidth: 1,
    gridLineColor: 0xFFFFFFFF,
    gridCount: 2,
  },
});

export const maskConfig = defineConfig<'tool.mask', MaskConfig>({
  id: 'tool.mask',
  defaults: {
    maskImage: '',
    brushSize: 20,
    brushColor: 0x6A34FF80,
    maskColor: 0x00FF00FF,
    maskBackgroundColor: 0xFFFFFFFF,
    boxLineWidth: 1,
    boxLineColor: 0x6A34FFFF,
  },
});

export const spriteTextEditConfig = defineConfig<'tool.sprite-text-edit', SpriteTextEditConfig>({
  id: 'tool.sprite-text-edit',
  defaults: {
    textColor: 0xFFFFFFFF,
    preSelectedTextColor: 0xFFFFFFFF,
    boxLineWidth: 3,
    dashLineDash: 8,
    dashLineGap: 8,
    editBoxColor: 0x3B82F626,
    editBoxLineColor: 0x3B82F6FF,
    editBoxPreSelectedColor: 0x3B82F640,
    editBoxLinePreSelectedColor: 0x3B82F6FF,
    hasChangedEditBoxColor: 0x22C55E33,
    hasChangedEditBoxLineColor: 0x22C55EFF,
    hasChangedEditBoxPreSelectedColor: 0x22C55E4D,
    hasChangedEditBoxLinePreSelectedColor: 0x22C55EFF,
    editBoxSelectedColor: 0xFFFF0099,
  },
});

export const iconConfig = defineConfig<'feedback.icon', IconConfig>({
  id: 'feedback.icon',
  defaults: {
    autoShow: true,
    videoPlayUrl: 'https://mdn.alipayobjects.com/huamei_ixsp8m/afts/img/A*ORMmSYYHIHUAAAAAJbAAAAgAev-aAQ/original',
    videoPlayShift: [20, 20],
    videoPlayWidth: 20,
    videoPlayHeight: 20,
    imageGeneratorUrl: 'https://mdn.alipayobjects.com/huamei_ixsp8m/afts/img/A*bYB-TIEWLBkAAAAAQGAAAAgAev-aAQ/original',
    videoGeneratorUrl: 'https://mdn.alipayobjects.com/huamei_ixsp8m/afts/img/A*6cTFT44CuKEAAAAAQCAAAAgAev-aAQ/original',
    generatorWidth: 200,
    generatorHeight: 200,
  },
});

export const itemCreateConfig = defineConfig<'tool.item-create', ItemCreateConfig>({
  id: 'tool.item-create',
  defaults: {
    frameBorderColor: 0x2178FFCC,
    frameBorderWidth: 1,
    frameFillColor: 0x2178FF26,
    frameChildBoxColor: 0x2178FF59,
  },
});
