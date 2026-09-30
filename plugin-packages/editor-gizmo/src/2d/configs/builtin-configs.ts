import { defineConfig } from './config-definition';
import type {
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
} from './types';

export { DEFAULT_LOADING_FRAGMENT, loadingConfig } from './loading-config';

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
    boxColor: 0xFF0000,
    boxWidth: 1,
    outerMaskEnabled: true,
    markColor: 0x000000,
    markAlpha: 0.17,
    safeAreaEnabled: true,
    safeAreaBoxColor: 0x00FF00,
    safeAreaBoxAlpha: 0.3,
  },
});

export const selectionPreviewConfig = defineConfig<'selection.preview', SelectionPreviewConfig>({
  id: 'selection.preview',
  defaults: {
    videoPreSelectedPlay: true,
    preSelectedColor: 0x3b82f6,
    preSelectedWidth: 2,
    regionBoxColor: 0x3b82f6,
    regionBoxAlpha: 0.17,
    regionWireframeColor: 0x3b82f6,
    regionWireframeAlpha: 0.78,
    regionWireframeWidth: 1,
  },
});

export const selectionSnapConfig = defineConfig<'selection.snap', SnapConfig>({
  id: 'selection.snap',
  defaults: {
    enabled: true,
    lineWidth: 0.8,
    lineColor: 0xF24822,
    distance: 5,
  },
});

export const resizeSelectionConfig = defineConfig<'resize-selection', ResizeSelectionConfig>({
  id: 'resize-selection',
  defaults: {
    pixelRatio: 1,
    contentRatio: 1,
    wireframeColor: 0x3b82f6,
    wireframeAlpha: 1,
    wireframeWidth: 1.5,
    cornerFillColor: 0xFFFFFF,
    cornerLineColor: 0x3b82f6,
    cornerLineWidth: 1.5,
    cornerLineAlpha: 1,
    scaleCircleSize: 4,
    rotationCircleSize: 7,
    infoShowEnabled: true,
    sizeTextColor: 0x666666,
    nameTextColor: 0x666666,
    frameMoveLineColor: 0x3b82f6,
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
    maskColor: 0xFFFFFF,
    maskAlpha: 0.5,
    cutBoxLineWidth: 2,
    cutBoxLineColor: 0x6A34FF,
    cutBoxLineAlpha: 1,
    itemBoxLineWidth: 1,
    itemBoxLineColor: 0x6A34FF,
    itemBoxLineAlpha: 1,
    cutBoxCornerRadius: 5,
    cutBoxCornerFillColor: 0xFFFFFF,
    cutBoxCornerLineWidth: 2,
    cutBoxCornerLineColor: 0x6A34FF,
    cutBoxCornerLineAlpha: 1,
    scaleInteractionDistance: 8,
    directionScaleInteractionDistance: 5,
    gridLineWidth: 1,
    gridLineColor: 0xFFFFFF,
    gridLineAlpha: 1,
    gridCount: 2,
  },
});

export const imageExpandConfig = defineConfig<'tool.image-expand', ImageExpandConfig>({
  id: 'tool.image-expand',
  defaults: {
    maskColor: 0x6A34FF,
    maskAlpha: 0.2,
    expandBoxLineWidth: 2,
    expandBoxLineColor: 0x6A34FF,
    expandBoxLineAlpha: 1,
    expandBoxCornerRadius: 5,
    expandBoxCornerLineWidth: 2,
    expandBoxCornerLineColor: 0x6A34FF,
    expandBoxCornerLineAlpha: 1,
    expandBoxCornerFillColor: 0xFFFFFF,
    scaleInteractionDistance: 8,
    directionScaleInteractionDistance: 5,
    gridLineWidth: 1,
    gridLineColor: 0xFFFFFF,
    gridLineAlpha: 1,
    gridCount: 2,
  },
});

export const maskConfig = defineConfig<'tool.mask', MaskConfig>({
  id: 'tool.mask',
  defaults: {
    maskImage: '',
    brushSize: 20,
    brushColor: 0x6A34FF,
    brushAlpha: 0.5,
    maskColor: 0x00FF00,
    maskBackgroundColor: 0xFFFFFF,
    maskAlpha: 1,
    boxLineWidth: 1,
    boxLineColor: 0x6A34FF,
    boxLineAlpha: 1,
  },
});

export const spriteTextEditConfig = defineConfig<'tool.sprite-text-edit', SpriteTextEditConfig>({
  id: 'tool.sprite-text-edit',
  defaults: {
    textColor: 0xFFFFFF,
    preSelectedTextColor: 0xFFFFFF,
    boxLineWidth: 3,
    dashLineDash: 8,
    dashLineGap: 8,
    editBoxAlpha: 0.15,
    editBoxColor: 0x3B82F6,
    editBoxLineAlpha: 1,
    editBoxLineColor: 0x3B82F6,
    editBoxPreSelectedAlpha: 0.25,
    editBoxPreSelectedColor: 0x3B82F6,
    editBoxLinePreSelectedAlpha: 1,
    editBoxLinePreSelectedColor: 0x3B82F6,
    hasChangedEditBoxAlpha: 0.2,
    hasChangedEditBoxColor: 0x22C55E,
    hasChangedEditBoxLineAlpha: 1,
    hasChangedEditBoxLineColor: 0x22C55E,
    hasChangedEditBoxPreSelectedAlpha: 0.3,
    hasChangedEditBoxPreSelectedColor: 0x22C55E,
    hasChangedEditBoxLinePreSelectedAlpha: 1,
    hasChangedEditBoxLinePreSelectedColor: 0x22C55E,
    editBoxSelectedAlpha: 0.6,
    editBoxSelectedColor: 0xFFFF00,
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
    frameBorderColor: 0x2178FF,
    frameBorderWidth: 1,
    frameBorderAlpha: 0.8,
    frameFillColor: 0x2178FF,
    frameFillAlpha: 0.15,
    frameChildBoxAlpha: 0.35,
    frameChildBoxColor: 0x2178FF,
  },
});
