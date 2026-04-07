import { Player } from '@galacean/effects';
import type { FancyConfig, FancyRenderLayer } from '@galacean/effects-core';
import { FancyLayerFactory, flattenFancyConfigToRenderStyle, TextComponent } from '@galacean/effects-core';
import { getDemoFancyJsonConfig } from './fancy-presets';

// 使用text.ts中的JSON数据
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*H0HxT4AyjxMAAAAAQFAAAAgAelB4AQ';
const container = document.getElementById('J-container');

let currentPreset = 'none';
let textItem: any = null;
let initialFancyConfig: any = null;  // 存 TextStyle 初始的 fancyRenderStyle 快照

/**
 * 编辑器状态接口
 */
interface EditorState {
  fills: FillLayerState[],
  strokes: StrokeLayerState[],
  effects: EffectLayerState[],
}

interface FillLayerState {
  id: string,
  type: 'solid' | 'linear' | 'texture',
  visible: boolean,
  opacity: number,
  color?: number[],
  gradientColors?: number[][],
  gradientAngle?: number,
  textureUrl?: string,
}

interface StrokeLayerState {
  id: string,
  visible: boolean,
  opacity: number,
  color: number[],
  width: number,
}

interface EffectLayerState {
  id: string,
  type: 'shadow',
  visible: boolean,
  color: number[],
  blur: number,
  distance: number,
  angle: number,
}

// 编辑器状态
let editorState: EditorState = {
  fills: [],
  strokes: [],
  effects: [],
};

// 设置纹理pattern
async function setupTexturePattern (textComponent: TextComponent) {
  const ctx = document.createElement('canvas').getContext('2d');

  if (!ctx) {return;}

  // 找到当前花字配置中的 texture layer，获取 imageUrl 和 repeat
  const config = textComponent.textStyle.fancyRenderStyle;
  const textureLayer = config.layers.find(
    (l): l is Extract<FancyRenderLayer, { kind: 'texture' }> => l.kind === 'texture'
  );

  if (!textureLayer) {return;}

  const img = new Image();

  img.crossOrigin = 'anonymous';
  img.src = textureLayer.params.pattern.imageUrl; // 使用配置中的 imageUrl

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const repeat = textureLayer.params.pattern.repeat ?? 'repeat';
  const pattern = ctx.createPattern(img, repeat);

  if (!pattern) {return;}

  // 找到当前花字配置中的 texture layer，写入 pattern
  for (const layer of config.layers) {
    if (layer.kind === 'texture') {
      layer.runtimePattern = pattern;
    }
  }

  textComponent.layerDrawers = FancyLayerFactory.createDrawersFromLayers(config.layers);
  textComponent.isDirty = true;
}

(async () => {
  try {
    const player = new Player({
      container,
    });

    const composition = await player.loadScene(json);

    // 获取文本元素
    textItem = composition.getItemByName('text_3');

    if (textItem) {
      // 修改文本内容（这句可有可无，看你需求）
      textItem.text = 'GRADIENT TEST';

      // 获取 TextComponent
      const textComponent = textItem.getComponent(TextComponent);

      if (textComponent) {
        // 记录一份初始 fancyRenderStyle 的深拷贝快照
        initialFancyConfig = JSON.parse(JSON.stringify(textComponent.getCurrentFancyTextConfig()));
      }

      // 应用默认花字预设（none）
      applyFancyPreset(currentPreset);

      // 创建控制界面
      createControls();
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('加载失败:', e);
  }
})();

// 应用花字预设
function applyFancyPreset (presetName: string) {
  if (!textItem) {return;}

  const textComponent = textItem.getComponent(TextComponent);

  if (!textComponent) {
    console.warn('未找到TextComponent');

    return;
  }

  const style = textComponent.textStyle;

  if (presetName === 'none') {
    // 恢复到 demo 记录的"初始 fancyRenderStyle 快照"
    if (initialFancyConfig) {
      // 深拷贝回去，避免后续修改影响快照本身
      style.fancyRenderStyle = JSON.parse(JSON.stringify(initialFancyConfig));
    } else {
      // 万一没记录到快照，就退回 core 的基础栈
      style.fancyRenderStyle = style.getBaseRenderStyle();
    }
  } else {
    const config: FancyConfig = getDemoFancyJsonConfig(presetName);

    // 2) 平铺（demo 充当编辑器）
    const flat = flattenFancyConfigToRenderStyle(config, style.textColor);

    // 4) 可选校验：如果原来有 decorations.shadow，则平铺后应该出现 shadow 且在对应 base 之前
    //    （这里只做一个轻校验：看到 shadow 且 shadow 不在最后）
    const hasAnyShadow = flat.layers.some(l => l.kind === 'shadow');

    if (hasAnyShadow) {
      const lastIsShadow = flat.layers[flat.layers.length - 1]?.kind === 'shadow';

    }

    // 5) runtime 只吃平铺结果（关键）
    style.fancyRenderStyle = flat;
  }

  // 按当前 fancyRenderStyle.layers 重建 layerDrawers
  textComponent.layerDrawers = FancyLayerFactory.createDrawersFromLayers(style.fancyRenderStyle.layers);
  textComponent.isDirty = true;

  if (presetName === 'texture') {
    setupTexturePattern(textComponent).catch(console.error);
  }

}

// 手动控制描边
function toggleStroke (enabled: boolean) {
  if (!textItem) {return;}

  const textComponent = textItem.getComponent(TextComponent);

  if (!textComponent) {return;}

  textComponent.setStrokeEnabled(enabled);
  // eslint-disable-next-line no-console
  console.log(`描边${enabled ? '启用' : '禁用'}`);
}

// 手动控制阴影
function toggleShadow (enabled: boolean) {
  if (!textItem) {return;}

  const textComponent = textItem.getComponent(TextComponent);

  if (!textComponent) {return;}

  textComponent.setShadowEnabled(enabled);
  // eslint-disable-next-line no-console
  console.log(`阴影${enabled ? '启用' : '禁用'}`);
}

// 更新描边参数
function updateStrokeParams (params: { color?: number[], width?: number }) {
  if (!textItem) {return;}

  const textComponent = textItem.getComponent(TextComponent);

  if (!textComponent) {return;}

  // 使用 TextComponent 的方法来更新，这样会自动调用 setEffects 和标记 isDirty
  if (params.color) {
    textComponent.setOutlineColor(params.color);
  }
  if (params.width) {
    textComponent.setOutlineWidth(params.width);
  }
  // eslint-disable-next-line no-console
  console.log('更新描边参数:', params);
}

// 更新阴影参数
function updateShadowParams (params: {
  color?: number[],
  opacity?: number,
  blur?: number,
  distance?: number,
  angle?: number,
}) {
  if (!textItem) {return;}

  const textComponent = textItem.getComponent(TextComponent);

  if (!textComponent) {return;}

  // 使用 TextStyle 的 updateShadowParams 方法，支持完整参数
  textComponent.textStyle.updateShadowParams(params);

  // 更新 layerDrawers
  textComponent.layerDrawers = FancyLayerFactory.createDrawersFromLayers(textComponent.textStyle.fancyRenderStyle.layers);
  textComponent.isDirty = true;

  // eslint-disable-next-line no-console
  console.log('更新阴影参数:', params);
}

// 更新文本颜色
function updateTextColor (color: number[]) {
  if (!textItem) {return;}

  const textComponent = textItem.getComponent(TextComponent);

  if (!textComponent) {return;}

  textComponent.setTextColor(color);
  // eslint-disable-next-line no-console
  console.log('更新文本颜色:', color);
}

// 创建控制界面（Figma 风格）
function createControls () {
  // 注入 Figma 风格的 CSS 样式
  injectFigmaStyles();

  const controlPanel = document.createElement('div');

  controlPanel.className = 'figma-panel';

  // 标题
  const title = document.createElement('div');

  title.className = 'figma-panel-title';
  title.textContent = '花字样式编辑器';
  controlPanel.appendChild(title);

  // 预设按钮区域（精简为一行横排小按钮）
  const presetSection = document.createElement('div');

  presetSection.className = 'figma-preset-section';

  const presets = [
    { key: 'none', name: '默认' },
    { key: 'single-stroke', name: '单描边' },
    { key: 'multi-stroke', name: '多描边' },
    { key: 'gradient', name: '渐变' },
    { key: 'shadow', name: '投影' },
    { key: 'texture', name: '纹理' },
  ];

  presets.forEach(preset => {
    const button = document.createElement('button');

    button.className = 'figma-preset-btn';
    button.textContent = preset.name;
    button.dataset.preset = preset.key;

    if (preset.key === currentPreset) {
      button.classList.add('active');
    }

    button.addEventListener('click', () => {
      currentPreset = preset.key;
      applyFancyPreset(currentPreset);
      // 从预设配置解析到编辑器状态
      parsePresetToEditorState(currentPreset);
      // 重新渲染面板
      renderAllSections(controlPanel);
      // 更新按钮样式
      presetSection.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });

    presetSection.appendChild(button);
  });

  controlPanel.appendChild(presetSection);

  // 创建 Fill 区域
  const fillSection = createFillSection();

  controlPanel.appendChild(fillSection);

  // 创建 Stroke 区域
  const strokeSection = createStrokeSection();

  controlPanel.appendChild(strokeSection);

  // 创建 Effects 区域
  const effectsSection = createEffectsSection();

  controlPanel.appendChild(effectsSection);

  // 曲线文本控制（保留）
  const curvedTextSection = createCurvedTextSection();

  controlPanel.appendChild(curvedTextSection);

  // 配置显示区域
  const configSection = document.createElement('div');

  configSection.className = 'figma-config-section';

  const configTitle = document.createElement('div');

  configTitle.className = 'figma-section-header';
  configTitle.textContent = '当前配置';
  configSection.appendChild(configTitle);

  const configDisplay = document.createElement('pre');

  configDisplay.className = 'figma-config-display';
  configDisplay.id = 'config-display';

  const textComponent = textItem?.getComponent(TextComponent);
  const initialConfigForDisplay = initialFancyConfig ||
    (textComponent ? textComponent.getCurrentFancyTextConfig() : getDemoFancyJsonConfig(currentPreset));

  configDisplay.textContent = JSON.stringify(initialConfigForDisplay, null, 2);
  configSection.appendChild(configDisplay);
  controlPanel.appendChild(configSection);

  document.body.appendChild(controlPanel);

  // 从当前预设初始化编辑器状态
  parsePresetToEditorState(currentPreset);
}

/**
 * 渲染所有区域（预设切换时重新渲染）
 */
function renderAllSections (panel: HTMLElement) {
  // 移除旧的 Fill、Stroke、Effects 区域
  const oldFill = panel.querySelector('.figma-fill-section');
  const oldStroke = panel.querySelector('.figma-stroke-section');
  const oldEffects = panel.querySelector('.figma-effects-section');

  if (oldFill) {oldFill.remove();}
  if (oldStroke) {oldStroke.remove();}
  if (oldEffects) {oldEffects.remove();}

  // 在预设区域后插入新的区域
  const presetSection = panel.querySelector('.figma-preset-section');

  if (presetSection) {
    presetSection.after(createFillSection());
    const fillSection = panel.querySelector('.figma-fill-section');

    if (fillSection) {
      fillSection.after(createStrokeSection());
      const strokeSection = panel.querySelector('.figma-stroke-section');

      if (strokeSection) {
        strokeSection.after(createEffectsSection());
      }
    }
  }
}

function createControlGroup (label: string): HTMLDivElement {
  const group = document.createElement('div');

  group.style.cssText = 'margin-bottom: 15px;';

  const labelElement = document.createElement('label');

  labelElement.textContent = label;
  labelElement.style.cssText = 'display: block; margin-bottom: 5px; font-size: 14px;';
  group.appendChild(labelElement);

  return group;
}

/**
 * 注入 Figma 风格的 CSS 样式
 */
function injectFigmaStyles () {
  const style = document.createElement('style');

  style.textContent = `
    /* Figma 面板主样式 */
    .figma-panel {
      position: fixed;
      top: 10px;
      right: 10px;
      background: #2c2c2c;
      color: #e0e0e0;
      padding: 12px;
      border-radius: 8px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      z-index: 1000;
      width: 280px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }

    .figma-panel::-webkit-scrollbar {
      width: 6px;
    }

    .figma-panel::-webkit-scrollbar-track {
      background: #2c2c2c;
    }

    .figma-panel::-webkit-scrollbar-thumb {
      background: #555;
      border-radius: 3px;
    }

    .figma-panel-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #fff;
    }

    /* 预设按钮区域 */
    .figma-preset-section {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #3d3d3d;
    }

    .figma-preset-btn {
      flex: 1;
      min-width: 60px;
      padding: 6px 8px;
      background: #3d3d3d;
      color: #999;
      border: 1px solid #4a4a4a;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.15s;
    }

    .figma-preset-btn:hover {
      background: #4a4a4a;
      color: #e0e0e0;
    }

    .figma-preset-btn.active {
      background: #0d99ff;
      color: #fff;
      border-color: #0d99ff;
    }

    /* 区域标题 */
    .figma-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      margin-bottom: 8px;
      font-size: 11px;
      font-weight: 600;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .figma-section-actions {
      display: flex;
      gap: 4px;
    }

    /* 层条目 */
    .figma-layer-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: #3d3d3d;
      border-radius: 4px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .figma-layer-item:hover {
      background: #4a4a4a;
    }

    .figma-layer-item.hidden {
      opacity: 0.5;
    }

    /* 颜色预览块 */
    .figma-color-preview {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      border: 1px solid #4a4a4a;
      flex-shrink: 0;
    }

    .figma-color-preview.gradient {
      background: linear-gradient(135deg, #ff0000, #0000ff);
    }

    .figma-color-preview.texture {
      background: repeating-linear-gradient(
        45deg,
        #666,
        #666 2px,
        #888 2px,
        #888 4px
      );
    }

    /* 层信息 */
    .figma-layer-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .figma-layer-type {
      font-size: 11px;
      color: #999;
    }

    .figma-layer-value {
      font-size: 12px;
      color: #e0e0e0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* 层操作按钮 */
    .figma-layer-actions {
      display: flex;
      gap: 4px;
    }

    .figma-icon-btn {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: #999;
      cursor: pointer;
      border-radius: 3px;
      font-size: 14px;
      transition: all 0.15s;
    }

    .figma-icon-btn:hover {
      background: #555;
      color: #e0e0e0;
    }

    .figma-icon-btn.active {
      color: #0d99ff;
    }

    /* 参数编辑区域 */
    .figma-layer-params {
      padding: 8px;
      background: #353535;
      border-radius: 4px;
      margin-bottom: 6px;
    }

    .figma-param-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .figma-param-row:last-child {
      margin-bottom: 0;
    }

    .figma-param-label {
      min-width: 60px;
      font-size: 11px;
      color: #999;
    }

    .figma-param-input {
      flex: 1;
      padding: 4px 8px;
      background: #2c2c2c;
      border: 1px solid #4a4a4a;
      border-radius: 3px;
      color: #e0e0e0;
      font-size: 11px;
      outline: none;
    }

    .figma-param-input:focus {
      border-color: #0d99ff;
    }

    .figma-param-input[type="range"] {
      -webkit-appearance: none;
      background: #2c2c2c;
      border: none;
      padding: 0;
    }

    .figma-param-input[type="range"]::-webkit-slider-track {
      background: #4a4a4a;
      height: 4px;
      border-radius: 2px;
    }

    .figma-param-input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      background: #0d99ff;
      border-radius: 50%;
      cursor: pointer;
    }

    .figma-param-input[type="color"] {
      padding: 2px;
      height: 24px;
      cursor: pointer;
    }

    .figma-param-value {
      min-width: 40px;
      text-align: right;
      font-size: 11px;
      color: #e0e0e0;
    }

    .figma-param-select {
      flex: 1;
      padding: 4px 8px;
      background: #2c2c2c;
      border: 1px solid #4a4a4a;
      border-radius: 3px;
      color: #e0e0e0;
      font-size: 11px;
      outline: none;
      cursor: pointer;
    }

    .figma-param-select:focus {
      border-color: #0d99ff;
    }

    /* 添加按钮 */
    .figma-add-btn {
      width: 100%;
      padding: 6px;
      background: transparent;
      border: 1px dashed #4a4a4a;
      border-radius: 4px;
      color: #999;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.15s;
    }

    .figma-add-btn:hover {
      border-color: #0d99ff;
      color: #0d99ff;
    }

    /* 曲线文本区域 */
    .figma-curved-section {
      padding-top: 12px;
      border-top: 1px solid #3d3d3d;
      margin-top: 12px;
    }

    /* 配置显示区域 */
    .figma-config-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #3d3d3d;
    }

    .figma-config-display {
      background: #1e1e1e;
      padding: 8px;
      border-radius: 4px;
      font-size: 9px;
      font-family: 'Monaco', 'Menlo', monospace;
      color: #999;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .figma-config-display::-webkit-scrollbar {
      width: 4px;
    }

    .figma-config-display::-webkit-scrollbar-thumb {
      background: #555;
      border-radius: 2px;
    }

    /* Toggle 开关 */
    .figma-toggle {
      position: relative;
      width: 32px;
      height: 18px;
      flex-shrink: 0;
    }

    .figma-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .figma-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #4a4a4a;
      border-radius: 9px;
      transition: background 0.2s;
    }

    .figma-toggle-slider::before {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      left: 2px;
      bottom: 2px;
      background: #999;
      border-radius: 50%;
      transition: transform 0.2s, background 0.2s;
    }

    .figma-toggle input:checked + .figma-toggle-slider {
      background: #0d99ff;
    }

    .figma-toggle input:checked + .figma-toggle-slider::before {
      transform: translateX(14px);
      background: #fff;
    }
  `;
  document.head.appendChild(style);
}

/**
 * 创建 Fill 区域
 */
function createFillSection (): HTMLElement {
  const section = document.createElement('div');

  section.className = 'figma-fill-section';

  // 标题行
  const header = document.createElement('div');

  header.className = 'figma-section-header';

  const title = document.createElement('span');

  title.textContent = '填充';

  const actions = document.createElement('div');

  actions.className = 'figma-section-actions';

  const addBtn = document.createElement('button');

  addBtn.className = 'figma-icon-btn';
  addBtn.textContent = '+';
  addBtn.title = '添加填充层';
  addBtn.addEventListener('click', () => {
    if (editorState.fills.length < 5) {
      addFillLayer();
      renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
    }
  });

  actions.appendChild(addBtn);
  header.appendChild(title);
  header.appendChild(actions);
  section.appendChild(header);

  // 层列表容器
  const layersContainer = document.createElement('div');

  layersContainer.className = 'figma-fill-layers';

  editorState.fills.forEach((fill, index) => {
    const layerItem = createFillLayerItem(fill, index);

    layersContainer.appendChild(layerItem);
  });

  section.appendChild(layersContainer);

  return section;
}

/**
 * 创建单个 Fill 层条目
 */
function createFillLayerItem (fill: FillLayerState, index: number): HTMLElement {
  const item = document.createElement('div');

  item.className = 'figma-layer-item';
  if (!fill.visible) {item.classList.add('hidden');}

  // 颜色预览
  const colorPreview = document.createElement('div');

  colorPreview.className = 'figma-color-preview';

  if (fill.type === 'solid') {
    const [r, g, b] = fill.color || [1, 1, 1];
    const opacity = fill.opacity;

    colorPreview.style.background = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity})`;
  } else if (fill.type === 'linear') {
    colorPreview.classList.add('gradient');
    const colors = fill.gradientColors || [[1, 0, 0, 1], [0, 0, 1, 1]];
    const angle = fill.gradientAngle || 0;

    colorPreview.style.background = `linear-gradient(${angle}deg, ${colors.map(c => `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3] || 1})`).join(', ')})`;
  } else if (fill.type === 'texture') {
    colorPreview.classList.add('texture');
  }

  item.appendChild(colorPreview);

  // 层信息
  const info = document.createElement('div');

  info.className = 'figma-layer-info';

  const typeSpan = document.createElement('span');

  typeSpan.className = 'figma-layer-type';
  typeSpan.textContent = fill.type === 'solid' ? '纯色' : fill.type === 'linear' ? '渐变' : '纹理';

  const valueSpan = document.createElement('span');

  valueSpan.className = 'figma-layer-value';

  if (fill.type === 'solid') {
    const [r, g, b] = fill.color || [1, 1, 1];
    const hex = rgbToHex(r * 255, g * 255, b * 255);

    valueSpan.textContent = `${hex} ${Math.round(fill.opacity * 100)}%`;
  } else if (fill.type === 'linear') {
    valueSpan.textContent = `${fill.gradientAngle || 0}°`;
  } else {
    valueSpan.textContent = '纹理';
  }

  info.appendChild(typeSpan);
  info.appendChild(valueSpan);
  item.appendChild(info);

  // 操作按钮
  const actions = document.createElement('div');

  actions.className = 'figma-layer-actions';

  const visibleBtn = document.createElement('button');

  visibleBtn.className = 'figma-icon-btn';
  visibleBtn.textContent = '👁';
  if (fill.visible) {visibleBtn.classList.add('active');}
  visibleBtn.addEventListener('click', e => {
    e.stopPropagation();
    fill.visible = !fill.visible;
    applyEditorStateToRuntime();
    renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
  });

  const deleteBtn = document.createElement('button');

  deleteBtn.className = 'figma-icon-btn';
  deleteBtn.textContent = '−';
  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    editorState.fills.splice(index, 1);
    applyEditorStateToRuntime();
    renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
  });

  actions.appendChild(visibleBtn);
  actions.appendChild(deleteBtn);
  item.appendChild(actions);

  // 点击展开参数编辑
  item.addEventListener('click', () => {
    const paramsEditor = createFillParamsEditor(fill, index);

    const existingParams = item.parentElement?.querySelector(`.fill-params-${index}`);

    if (existingParams) {
      existingParams.remove();

      return;
    }

    // 移除其他展开的参数编辑器
    item.parentElement?.querySelectorAll('.figma-layer-params').forEach(p => p.remove());

    item.after(paramsEditor);
  });

  return item;
}

/**
 * 创建 Fill 参数编辑器
 */
function createFillParamsEditor (fill: FillLayerState, index: number): HTMLElement {
  const params = document.createElement('div');

  params.className = `figma-layer-params fill-params-${index}`;

  // 类型选择
  const typeRow = document.createElement('div');

  typeRow.className = 'figma-param-row';

  const typeLabel = document.createElement('span');

  typeLabel.className = 'figma-param-label';
  typeLabel.textContent = '类型';

  const typeSelect = document.createElement('select');

  typeSelect.className = 'figma-param-select';

  ['solid', 'linear', 'texture'].forEach(t => {
    const option = document.createElement('option');

    option.value = t;
    option.textContent = t === 'solid' ? '纯色' : t === 'linear' ? '渐变' : '纹理';
    if (t === fill.type) {option.selected = true;}
    typeSelect.appendChild(option);
  });

  typeSelect.addEventListener('change', e => {
    const newType = (e.target as HTMLSelectElement).value as FillLayerState['type'];

    fill.type = newType;
    if (newType === 'solid' && !fill.color) {
      fill.color = [1, 1, 1, 1];
    } else if (newType === 'linear') {
      fill.gradientColors = fill.gradientColors || [[1, 0, 0, 1], [0, 0, 1, 1]];
      fill.gradientAngle = fill.gradientAngle || 0;
    } else if (newType === 'texture') {
      fill.textureUrl = fill.textureUrl || '';
    }
    applyEditorStateToRuntime();
    renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
  });

  typeRow.appendChild(typeLabel);
  typeRow.appendChild(typeSelect);
  params.appendChild(typeRow);

  // 根据类型显示不同参数
  if (fill.type === 'solid') {
    // 颜色
    const colorRow = createColorParamRow('颜色', fill.color || [1, 1, 1, 1], color => {
      fill.color = color;
      applyEditorStateToRuntime();
      // 只更新颜色预览，不重新渲染整个面板
      const layerItem = params.previousElementSibling as HTMLElement;

      updateLayerColorPreview(layerItem, fill);
    });

    params.appendChild(colorRow);

    // 透明度
    const opacityRow = createSliderParamRow('透明度', fill.opacity * 100, 0, 100, 1, value => {
      fill.opacity = value / 100;
      applyEditorStateToRuntime();
      // 只更新颜色预览和显示值，不重新渲染整个面板
      const layerItem = params.previousElementSibling as HTMLElement;

      updateLayerColorPreview(layerItem, fill);
      const valueSpan = layerItem.querySelector('.figma-layer-value');

      if (valueSpan) {
        const [r, g, b] = fill.color || [1, 1, 1];
        const hex = rgbToHex(r * 255, g * 255, b * 255);

        valueSpan.textContent = `${hex} ${Math.round(fill.opacity * 100)}%`;
      }
    });

    params.appendChild(opacityRow);
  } else if (fill.type === 'linear') {
    // 渐变颜色
    const colors = fill.gradientColors || [[1, 0, 0, 1], [0, 0, 1, 1]];

    colors.forEach((color, colorIndex) => {
      const colorRow = createColorParamRow(`颜色 ${colorIndex + 1}`, color, newColor => {
        colors[colorIndex] = newColor;
        fill.gradientColors = colors;
        applyEditorStateToRuntime();
        // 更新渐变预览
        const layerItem = params.previousElementSibling as HTMLElement;

        updateLayerColorPreview(layerItem, fill);
      });

      params.appendChild(colorRow);
    });

    // 角度
    const angleRow = createSliderParamRow('角度', fill.gradientAngle || 0, 0, 360, 1, value => {
      fill.gradientAngle = value;
      applyEditorStateToRuntime();
      // 只更新显示值，不重新渲染整个面板
      const layerItem = params.previousElementSibling as HTMLElement;

      updateLayerColorPreview(layerItem, fill);
      const valueSpan = layerItem.querySelector('.figma-layer-value');

      if (valueSpan) {
        valueSpan.textContent = `${fill.gradientAngle || 0}°`;
      }
    });

    params.appendChild(angleRow);

    // 透明度
    const opacityRow = createSliderParamRow('透明度', fill.opacity * 100, 0, 100, 1, value => {
      fill.opacity = value / 100;
      applyEditorStateToRuntime();
      // 更新渐变预览
      const layerItem = params.previousElementSibling as HTMLElement;

      updateLayerColorPreview(layerItem, fill);
    });

    params.appendChild(opacityRow);
  } else if (fill.type === 'texture') {
    // URL 输入
    const urlRow = document.createElement('div');

    urlRow.className = 'figma-param-row';

    const urlLabel = document.createElement('span');

    urlLabel.className = 'figma-param-label';
    urlLabel.textContent = 'URL';

    const urlInput = document.createElement('input');

    urlInput.className = 'figma-param-input';
    urlInput.type = 'text';
    urlInput.value = fill.textureUrl || '';
    urlInput.addEventListener('change', e => {
      fill.textureUrl = (e.target as HTMLInputElement).value;
      applyEditorStateToRuntime();
    });

    urlRow.appendChild(urlLabel);
    urlRow.appendChild(urlInput);
    params.appendChild(urlRow);
  }

  // 上移/下移按钮
  if (editorState.fills.length > 1) {
    const moveRow = document.createElement('div');

    moveRow.className = 'figma-param-row';
    moveRow.style.justifyContent = 'center';

    const upBtn = document.createElement('button');

    upBtn.className = 'figma-icon-btn';
    upBtn.textContent = '↑';
    upBtn.style.width = 'auto';
    upBtn.style.padding = '4px 12px';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => {
      if (index > 0) {
        const temp = editorState.fills[index - 1];

        editorState.fills[index - 1] = editorState.fills[index];
        editorState.fills[index] = temp;
        applyEditorStateToRuntime();
        renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
      }
    });

    const downBtn = document.createElement('button');

    downBtn.className = 'figma-icon-btn';
    downBtn.textContent = '↓';
    downBtn.style.width = 'auto';
    downBtn.style.padding = '4px 12px';
    downBtn.disabled = index === editorState.fills.length - 1;
    downBtn.addEventListener('click', () => {
      if (index < editorState.fills.length - 1) {
        const temp = editorState.fills[index + 1];

        editorState.fills[index + 1] = editorState.fills[index];
        editorState.fills[index] = temp;
        applyEditorStateToRuntime();
        renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
      }
    });

    moveRow.appendChild(upBtn);
    moveRow.appendChild(downBtn);
    params.appendChild(moveRow);
  }

  return params;
}

/**
 * 创建 Stroke 区域
 */
function createStrokeSection (): HTMLElement {
  const section = document.createElement('div');

  section.className = 'figma-stroke-section';

  // 标题行
  const header = document.createElement('div');

  header.className = 'figma-section-header';

  const title = document.createElement('span');

  title.textContent = '描边';

  const actions = document.createElement('div');

  actions.className = 'figma-section-actions';

  const addBtn = document.createElement('button');

  addBtn.className = 'figma-icon-btn';
  addBtn.textContent = '+';
  addBtn.title = '添加描边层';
  addBtn.addEventListener('click', () => {
    addStrokeLayer();
    renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
  });

  actions.appendChild(addBtn);
  header.appendChild(title);
  header.appendChild(actions);
  section.appendChild(header);

  // 层列表容器
  const layersContainer = document.createElement('div');

  layersContainer.className = 'figma-stroke-layers';

  editorState.strokes.forEach((stroke, index) => {
    const layerItem = createStrokeLayerItem(stroke, index);

    layersContainer.appendChild(layerItem);
  });

  section.appendChild(layersContainer);

  return section;
}

/**
 * 创建单个 Stroke 层条目
 */
function createStrokeLayerItem (stroke: StrokeLayerState, index: number): HTMLElement {
  const item = document.createElement('div');

  item.className = 'figma-layer-item';
  if (!stroke.visible) {item.classList.add('hidden');}

  // 颜色预览
  const colorPreview = document.createElement('div');

  colorPreview.className = 'figma-color-preview';
  const [r, g, b] = stroke.color || [1, 0, 0, 1];
  const opacity = stroke.opacity;

  colorPreview.style.background = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity})`;

  item.appendChild(colorPreview);

  // 层信息
  const info = document.createElement('div');

  info.className = 'figma-layer-info';

  const valueSpan = document.createElement('span');

  valueSpan.className = 'figma-layer-value';
  const hex = rgbToHex(r * 255, g * 255, b * 255);

  valueSpan.textContent = `${hex} ${stroke.width}px`;

  info.appendChild(valueSpan);
  item.appendChild(info);

  // 操作按钮
  const actions = document.createElement('div');

  actions.className = 'figma-layer-actions';

  const visibleBtn = document.createElement('button');

  visibleBtn.className = 'figma-icon-btn';
  visibleBtn.textContent = '👁';
  if (stroke.visible) {visibleBtn.classList.add('active');}
  visibleBtn.addEventListener('click', e => {
    e.stopPropagation();
    stroke.visible = !stroke.visible;
    applyEditorStateToRuntime();
    renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
  });

  const deleteBtn = document.createElement('button');

  deleteBtn.className = 'figma-icon-btn';
  deleteBtn.textContent = '−';
  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    editorState.strokes.splice(index, 1);
    applyEditorStateToRuntime();
    renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
  });

  actions.appendChild(visibleBtn);
  actions.appendChild(deleteBtn);
  item.appendChild(actions);

  // 点击展开参数编辑
  item.addEventListener('click', () => {
    const paramsEditor = createStrokeParamsEditor(stroke, index);

    const existingParams = item.parentElement?.querySelector(`.stroke-params-${index}`);

    if (existingParams) {
      existingParams.remove();

      return;
    }

    // 移除其他展开的参数编辑器
    item.parentElement?.querySelectorAll('.figma-layer-params').forEach(p => p.remove());

    item.after(paramsEditor);
  });

  return item;
}

/**
 * 创建 Stroke 参数编辑器
 */
function createStrokeParamsEditor (stroke: StrokeLayerState, index: number): HTMLElement {
  const params = document.createElement('div');

  params.className = `figma-layer-params stroke-params-${index}`;

  // 颜色
  const colorRow = createColorParamRow('颜色', stroke.color, color => {
    stroke.color = color;
    applyEditorStateToRuntime();
    // 只更新颜色预览，不重新渲染整个面板
    const layerItem = params.previousElementSibling as HTMLElement;

    updateStrokeLayerDisplay(layerItem, stroke);
  });

  params.appendChild(colorRow);

  // 透明度
  const opacityRow = createSliderParamRow('透明度', stroke.opacity * 100, 0, 100, 1, value => {
    stroke.opacity = value / 100;
    applyEditorStateToRuntime();
    const layerItem = params.previousElementSibling as HTMLElement;

    updateStrokeLayerDisplay(layerItem, stroke);
  });

  params.appendChild(opacityRow);

  // 宽度
  const widthRow = createSliderParamRow('宽度', stroke.width, 1, 20, 0.5, value => {
    stroke.width = value;
    applyEditorStateToRuntime();
    const layerItem = params.previousElementSibling as HTMLElement;

    updateStrokeLayerDisplay(layerItem, stroke);
  });

  params.appendChild(widthRow);

  // 上移/下移按钮
  if (editorState.strokes.length > 1) {
    const moveRow = document.createElement('div');

    moveRow.className = 'figma-param-row';
    moveRow.style.justifyContent = 'center';

    const upBtn = document.createElement('button');

    upBtn.className = 'figma-icon-btn';
    upBtn.textContent = '↑';
    upBtn.style.width = 'auto';
    upBtn.style.padding = '4px 12px';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => {
      if (index > 0) {
        const temp = editorState.strokes[index - 1];

        editorState.strokes[index - 1] = editorState.strokes[index];
        editorState.strokes[index] = temp;
        applyEditorStateToRuntime();
        renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
      }
    });

    const downBtn = document.createElement('button');

    downBtn.className = 'figma-icon-btn';
    downBtn.textContent = '↓';
    downBtn.style.width = 'auto';
    downBtn.style.padding = '4px 12px';
    downBtn.disabled = index === editorState.strokes.length - 1;
    downBtn.addEventListener('click', () => {
      if (index < editorState.strokes.length - 1) {
        const temp = editorState.strokes[index + 1];

        editorState.strokes[index + 1] = editorState.strokes[index];
        editorState.strokes[index] = temp;
        applyEditorStateToRuntime();
        renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
      }
    });

    moveRow.appendChild(upBtn);
    moveRow.appendChild(downBtn);
    params.appendChild(moveRow);
  }

  return params;
}

/**
 * 创建 Effects 区域
 */
function createEffectsSection (): HTMLElement {
  const section = document.createElement('div');

  section.className = 'figma-effects-section';

  // 标题行
  const header = document.createElement('div');

  header.className = 'figma-section-header';

  const title = document.createElement('span');

  title.textContent = '效果';

  const actions = document.createElement('div');

  actions.className = 'figma-section-actions';

  const addBtn = document.createElement('button');

  addBtn.className = 'figma-icon-btn';
  addBtn.textContent = '+';
  addBtn.title = '添加效果';
  addBtn.addEventListener('click', () => {
    addEffectLayer();
    renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
  });

  actions.appendChild(addBtn);
  header.appendChild(title);
  header.appendChild(actions);
  section.appendChild(header);

  // 层列表容器
  const layersContainer = document.createElement('div');

  layersContainer.className = 'figma-effects-layers';

  editorState.effects.forEach((effect, index) => {
    const layerItem = createEffectLayerItem(effect, index);

    layersContainer.appendChild(layerItem);
  });

  section.appendChild(layersContainer);

  return section;
}

/**
 * 创建单个 Effect 层条目
 */
function createEffectLayerItem (effect: EffectLayerState, index: number): HTMLElement {
  const item = document.createElement('div');

  item.className = 'figma-layer-item';
  if (!effect.visible) {item.classList.add('hidden');}

  // Toggle 开关
  const toggle = document.createElement('label');

  toggle.className = 'figma-toggle';

  const toggleInput = document.createElement('input');

  toggleInput.type = 'checkbox';
  toggleInput.checked = effect.visible;
  toggleInput.addEventListener('change', e => {
    e.stopPropagation();
    effect.visible = toggleInput.checked;
    applyEditorStateToRuntime();
    renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
  });

  const toggleSlider = document.createElement('span');

  toggleSlider.className = 'figma-toggle-slider';

  toggle.appendChild(toggleInput);
  toggle.appendChild(toggleSlider);
  toggle.addEventListener('click', e => {
    e.stopPropagation();
  });

  item.appendChild(toggle);

  // 颜色预览（阴影颜色）
  const colorPreview = document.createElement('div');

  colorPreview.className = 'figma-color-preview';
  const [r, g, b] = effect.color || [0, 0, 0, 1];

  colorPreview.style.background = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 1)`;

  item.appendChild(colorPreview);

  // 层信息
  const info = document.createElement('div');

  info.className = 'figma-layer-info';

  const typeSpan = document.createElement('span');

  typeSpan.className = 'figma-layer-type';
  typeSpan.textContent = effect.type === 'shadow' ? '阴影' : effect.type;

  const valueSpan = document.createElement('span');

  valueSpan.className = 'figma-layer-value';
  valueSpan.textContent = `${effect.blur}px`;

  info.appendChild(typeSpan);
  info.appendChild(valueSpan);
  item.appendChild(info);

  // 操作按钮（只保留删除按钮）
  const actions = document.createElement('div');

  actions.className = 'figma-layer-actions';

  const deleteBtn = document.createElement('button');

  deleteBtn.className = 'figma-icon-btn';
  deleteBtn.textContent = '−';
  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    editorState.effects.splice(index, 1);
    applyEditorStateToRuntime();
    renderAllSections(document.querySelector('.figma-panel') as HTMLElement);
  });

  actions.appendChild(deleteBtn);
  item.appendChild(actions);

  // 点击展开参数编辑
  item.addEventListener('click', () => {
    const paramsEditor = createEffectParamsEditor(effect, index);

    const existingParams = item.parentElement?.querySelector(`.effect-params-${index}`);

    if (existingParams) {
      existingParams.remove();

      return;
    }

    // 移除其他展开的参数编辑器
    item.parentElement?.querySelectorAll('.figma-layer-params').forEach(p => p.remove());

    item.after(paramsEditor);
  });

  return item;
}

/**
 * 创建 Effect 参数编辑器
 */
function createEffectParamsEditor (effect: EffectLayerState, index: number): HTMLElement {
  const params = document.createElement('div');

  params.className = `figma-layer-params effect-params-${index}`;

  // 类型选择
  const typeRow = document.createElement('div');

  typeRow.className = 'figma-param-row';

  const typeLabel = document.createElement('span');

  typeLabel.className = 'figma-param-label';
  typeLabel.textContent = 'Type';

  const typeSelect = document.createElement('select');

  typeSelect.className = 'figma-param-select';

  const option = document.createElement('option');

  option.value = 'shadow';
  option.textContent = '阴影';
  option.selected = true;
  typeSelect.appendChild(option);

  typeRow.appendChild(typeLabel);
  typeRow.appendChild(typeSelect);
  params.appendChild(typeRow);

  // 颜色
  const colorRow = createColorParamRow('颜色', effect.color, color => {
    effect.color = color;
    applyEditorStateToRuntime();
    // 只更新颜色预览，不重新渲染整个面板
    const layerItem = params.previousElementSibling as HTMLElement;

    updateEffectLayerDisplay(layerItem, effect);
  });

  params.appendChild(colorRow);

  // 模糊
  const blurRow = createSliderParamRow('模糊', effect.blur, 0, 50, 1, value => {
    effect.blur = value;
    applyEditorStateToRuntime();
    const layerItem = params.previousElementSibling as HTMLElement;

    updateEffectLayerDisplay(layerItem, effect);
  });

  params.appendChild(blurRow);

  // 距离
  const distanceRow = createSliderParamRow('距离', effect.distance, 0, 50, 1, value => {
    effect.distance = value;
    applyEditorStateToRuntime();
    // 距离变化不需要更新显示
  });

  params.appendChild(distanceRow);

  // 角度
  const angleRow = createSliderParamRow('角度', effect.angle, 0, 360, 1, value => {
    effect.angle = value;
    applyEditorStateToRuntime();
    // 角度变化不需要更新显示
  });

  params.appendChild(angleRow);

  return params;
}

/**
 * 创建曲线文本控制区域
 */
function createCurvedTextSection (): HTMLElement {
  const section = document.createElement('div');

  section.className = 'figma-curved-section';

  // 标题
  const header = document.createElement('div');

  header.className = 'figma-section-header';
  header.textContent = '曲线文本';
  section.appendChild(header);

  // 曲线强度滑块
  const powerRow = createSliderParamRow('强度', 0, -100, 100, 1, value => {
    if (textItem) {
      const textComponent = textItem.getComponent(TextComponent);

      if (textComponent) {
        textComponent.setCurvedTextPower(value);
        updateConfigDisplay();
      }
    }
  });

  powerRow.id = 'curved-power-row';
  section.appendChild(powerRow);

  // 禁用按钮
  const disableBtn = document.createElement('button');

  disableBtn.className = 'figma-add-btn';
  disableBtn.textContent = '禁用曲线文本';
  disableBtn.addEventListener('click', () => {
    if (textItem) {
      const textComponent = textItem.getComponent(TextComponent);

      textComponent?.setCurvedTextPower(0);
      textComponent.isDirty = true;
      textComponent.updateTexture();

      // 重置滑块
      const slider = powerRow.querySelector('input[type="range"]') as HTMLInputElement;
      const valueDisplay = powerRow.querySelector('.figma-param-value') as HTMLElement;

      if (slider) {slider.value = '0';}
      if (valueDisplay) {valueDisplay.textContent = '0';}

      updateConfigDisplay();
    }
  });

  section.appendChild(disableBtn);

  return section;
}

/**
 * 创建颜色参数行
 */
function createColorParamRow (
  label: string,
  color: number[],
  onChange: (color: number[]) => void
): HTMLElement {
  const row = document.createElement('div');

  row.className = 'figma-param-row';

  const labelEl = document.createElement('span');

  labelEl.className = 'figma-param-label';
  labelEl.textContent = label;

  const input = document.createElement('input');

  input.className = 'figma-param-input';
  input.type = 'color';

  const [r, g, b] = color;
  const hex = rgbToHex(r * 255, g * 255, b * 255);

  input.value = hex;

  input.addEventListener('input', e => {
    const newHex = (e.target as HTMLInputElement).value;
    const newColor = hexToRgba(newHex);

    // 保持原有的 alpha 值
    newColor[3] = color[3] || 1;
    onChange(newColor);
  });

  row.appendChild(labelEl);
  row.appendChild(input);

  return row;
}

/**
 * 创建滑块参数行
 */
function createSliderParamRow (
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (value: number) => void
): HTMLElement {
  const row = document.createElement('div');

  row.className = 'figma-param-row';

  const labelEl = document.createElement('span');

  labelEl.className = 'figma-param-label';
  labelEl.textContent = label;

  const input = document.createElement('input');

  input.className = 'figma-param-input';
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);

  const valueDisplay = document.createElement('span');

  valueDisplay.className = 'figma-param-value';
  valueDisplay.textContent = String(value);

  input.addEventListener('input', e => {
    const newValue = parseFloat((e.target as HTMLInputElement).value);

    valueDisplay.textContent = String(newValue);
    onChange(newValue);
  });

  row.appendChild(labelEl);
  row.appendChild(input);
  row.appendChild(valueDisplay);

  return row;
}

/**
 * 添加 Fill 层
 */
function addFillLayer () {
  const newFill: FillLayerState = {
    id: generateId(),
    type: 'solid',
    visible: true,
    opacity: 1,
    color: [1, 1, 1, 1],
  };

  editorState.fills.push(newFill);
  applyEditorStateToRuntime();
}

/**
 * 添加 Stroke 层
 */
function addStrokeLayer () {
  const newStroke: StrokeLayerState = {
    id: generateId(),
    visible: true,
    opacity: 1,
    color: [1, 0, 0, 1],
    width: 3,
  };

  editorState.strokes.push(newStroke);
  applyEditorStateToRuntime();
}

/**
 * 添加 Effect 层
 */
function addEffectLayer () {
  const newEffect: EffectLayerState = {
    id: generateId(),
    type: 'shadow',
    visible: true,
    color: [0, 0, 0, 0.8],
    blur: 10,
    distance: 5,
    angle: 45,
  };

  editorState.effects.push(newEffect);
  applyEditorStateToRuntime();
}

/**
 * 生成唯一 ID
 */
function generateId (): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * 从预设配置解析到编辑器状态
 */
function parsePresetToEditorState (presetName: string) {
  const config = getDemoFancyJsonConfig(presetName);

  editorState = {
    fills: [],
    strokes: [],
    effects: [],
  };

  if (!config.layers) {return;}

  // 标记是否已经提取过阴影（只提取一次）
  let shadowExtracted = false;

  config.layers.forEach(layer => {
    if (layer.kind === 'solid-fill') {
      const fill: FillLayerState = {
        id: generateId(),
        type: 'solid',
        visible: true,
        opacity: layer.params.color[3] || 1,
        color: layer.params.color,
      };

      editorState.fills.push(fill);

      // 检查装饰层（阴影）- 只提取一次
      if (!shadowExtracted && layer.decorations) {
        layer.decorations.forEach(dec => {
          if (dec.kind === 'shadow') {
            const effect: EffectLayerState = {
              id: generateId(),
              type: 'shadow',
              visible: true,
              color: dec.params.color,
              blur: dec.params.blur,
              distance: Math.sqrt(dec.params.offsetX ** 2 + dec.params.offsetY ** 2),
              angle: Math.atan2(dec.params.offsetY, dec.params.offsetX) * 180 / Math.PI,
            };

            editorState.effects.push(effect);
            shadowExtracted = true;
          }
        });
      }
    } else if (layer.kind === 'gradient') {
      const fill: FillLayerState = {
        id: generateId(),
        type: 'linear',
        visible: true,
        opacity: 1,
        gradientColors: layer.params.colors,
        gradientAngle: layer.params.angle,
      };

      editorState.fills.push(fill);

      // 检查装饰层（阴影）- 只提取一次
      if (!shadowExtracted && layer.decorations) {
        layer.decorations.forEach(dec => {
          if (dec.kind === 'shadow') {
            const effect: EffectLayerState = {
              id: generateId(),
              type: 'shadow',
              visible: true,
              color: dec.params.color,
              blur: dec.params.blur,
              distance: Math.sqrt(dec.params.offsetX ** 2 + dec.params.offsetY ** 2),
              angle: Math.atan2(dec.params.offsetY, dec.params.offsetX) * 180 / Math.PI,
            };

            editorState.effects.push(effect);
            shadowExtracted = true;
          }
        });
      }
    } else if (layer.kind === 'texture') {
      const fill: FillLayerState = {
        id: generateId(),
        type: 'texture',
        visible: true,
        opacity: 1,
        textureUrl: layer.params.pattern.imageUrl,
      };

      editorState.fills.push(fill);

      // 检查装饰层（阴影）- 只提取一次
      if (!shadowExtracted && layer.decorations) {
        layer.decorations.forEach(dec => {
          if (dec.kind === 'shadow') {
            const effect: EffectLayerState = {
              id: generateId(),
              type: 'shadow',
              visible: true,
              color: dec.params.color,
              blur: dec.params.blur,
              distance: Math.sqrt(dec.params.offsetX ** 2 + dec.params.offsetY ** 2),
              angle: Math.atan2(dec.params.offsetY, dec.params.offsetX) * 180 / Math.PI,
            };

            editorState.effects.push(effect);
            shadowExtracted = true;
          }
        });
      }
    } else if (layer.kind === 'single-stroke') {
      const stroke: StrokeLayerState = {
        id: generateId(),
        visible: true,
        opacity: layer.params.color[3] || 1,
        color: layer.params.color,
        width: layer.params.width,
      };

      editorState.strokes.push(stroke);

      // 检查装饰层（阴影）- 只提取一次
      if (!shadowExtracted && layer.decorations) {
        layer.decorations.forEach(dec => {
          if (dec.kind === 'shadow') {
            const effect: EffectLayerState = {
              id: generateId(),
              type: 'shadow',
              visible: true,
              color: dec.params.color,
              blur: dec.params.blur,
              distance: Math.sqrt(dec.params.offsetX ** 2 + dec.params.offsetY ** 2),
              angle: Math.atan2(dec.params.offsetY, dec.params.offsetX) * 180 / Math.PI,
            };

            editorState.effects.push(effect);
            shadowExtracted = true;
          }
        });
      }
    }
  });
}

/**
 * 将编辑器状态应用到运行时
 */
function applyEditorStateToRuntime () {
  if (!textItem) {return;}

  const textComponent = textItem.getComponent(TextComponent);

  if (!textComponent) {return;}

  // 直接构建 FancyRenderStyle（包含 FancyRenderLayer[]）
  const layers: FancyRenderLayer[] = [];

  const visibleStrokes = editorState.strokes.filter(s => s.visible);
  const visibleFills = editorState.fills.filter(f => f.visible);
  const visibleShadows = editorState.effects.filter(e => e.visible && e.type === 'shadow');

  // 构建阴影层
  const buildShadowLayer = (effect: EffectLayerState) => {
    const angleRad = effect.angle * Math.PI / 180;
    const offsetX = effect.distance * Math.cos(angleRad);
    const offsetY = effect.distance * Math.sin(angleRad);

    return {
      kind: 'shadow' as const,
      params: {
        color: [effect.color[0], effect.color[1], effect.color[2], effect.color[3] || 1] as [number, number, number, number],
        blur: effect.blur,
        offsetX,
        offsetY,
      },
    };
  };

  // 如果有阴影，先渲染所有层带阴影的效果（阴影在最底层）
  if (visibleShadows.length > 0) {
    // 1. 渲染所有 Stroke 层带阴影的效果
    visibleStrokes.forEach(stroke => {
      // 先设置阴影
      visibleShadows.forEach(effect => {
        layers.push(buildShadowLayer(effect));
      });
      // 再绘制 Stroke（带出阴影）
      layers.push({
        kind: 'single-stroke',
        params: {
          color: [...stroke.color.slice(0, 3), stroke.opacity] as [number, number, number, number],
          width: stroke.width,
          unit: 'px',
        },
      });
    });

    // 2. 渲染所有 Fill 层带阴影的效果
    visibleFills.forEach(fill => {
      // 先设置阴影
      visibleShadows.forEach(effect => {
        layers.push(buildShadowLayer(effect));
      });
      // 再绘制 Fill（带出阴影）
      if (fill.type === 'solid') {
        layers.push({
          kind: 'solid-fill',
          params: {
            color: [...(fill.color || [1, 1, 1]).slice(0, 3), fill.opacity] as [number, number, number, number],
          },
        });
      } else if (fill.type === 'linear') {
        const colors = fill.gradientColors || [[1, 0, 0, 1], [0, 0, 1, 1]];

        layers.push({
          kind: 'gradient',
          params: {
            angle: fill.gradientAngle || 0,
            colors: colors.map(c => [c[0], c[1], c[2], c[3] || 1] as [number, number, number, number]),
          },
        });
      } else if (fill.type === 'texture') {
        layers.push({
          kind: 'texture',
          params: {
            pattern: {
              imageUrl: fill.textureUrl || '',
            },
          },
        });
      }
    });
  } else {
    // 没有阴影，按正常顺序渲染
    // 1. 添加 Stroke 层
    visibleStrokes.forEach(stroke => {
      layers.push({
        kind: 'single-stroke',
        params: {
          color: [...stroke.color.slice(0, 3), stroke.opacity] as [number, number, number, number],
          width: stroke.width,
          unit: 'px',
        },
      });
    });

    // 2. 添加 Fill 层
    visibleFills.forEach(fill => {
      if (fill.type === 'solid') {
        layers.push({
          kind: 'solid-fill',
          params: {
            color: [...(fill.color || [1, 1, 1]).slice(0, 3), fill.opacity] as [number, number, number, number],
          },
        });
      } else if (fill.type === 'linear') {
        const colors = fill.gradientColors || [[1, 0, 0, 1], [0, 0, 1, 1]];

        layers.push({
          kind: 'gradient',
          params: {
            angle: fill.gradientAngle || 0,
            colors: colors.map(c => [c[0], c[1], c[2], c[3] || 1] as [number, number, number, number]),
          },
        });
      } else if (fill.type === 'texture') {
        layers.push({
          kind: 'texture',
          params: {
            pattern: {
              imageUrl: fill.textureUrl || '',
            },
          },
        });
      }
    });
  }

  // 应用到运行时
  const style = textComponent.textStyle;

  style.fancyRenderStyle = { layers };

  // 重建 layerDrawers
  textComponent.layerDrawers = FancyLayerFactory.createDrawersFromLayers(layers);
  textComponent.isDirty = true;

  // 如果有纹理，需要设置纹理 pattern
  const hasTexture = editorState.fills.some(f => f.type === 'texture' && f.textureUrl && f.visible);

  if (hasTexture) {
    setupTexturePattern(textComponent).catch(console.error);
  }

  // 更新配置显示
  updateConfigDisplay();
}

/**
 * 更新配置显示
 */
function updateConfigDisplay () {
  const configDisplay = document.getElementById('config-display');

  if (!configDisplay || !textItem) {return;}

  const textComponent = textItem.getComponent(TextComponent);

  if (!textComponent) {return;}

  const config = textComponent.getCurrentFancyTextConfig();

  configDisplay.textContent = JSON.stringify(config, null, 2);
}

/**
 * 更新 Fill 层颜色预览
 */
function updateLayerColorPreview (item: HTMLElement, fill: FillLayerState) {
  if (!item) {return;}

  const colorPreview = item.querySelector('.figma-color-preview') as HTMLElement;

  if (!colorPreview) {return;}

  if (fill.type === 'solid') {
    const [r, g, b] = fill.color || [1, 1, 1];
    const opacity = fill.opacity;

    colorPreview.style.background = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity})`;
  } else if (fill.type === 'linear') {
    const colors = fill.gradientColors || [[1, 0, 0, 1], [0, 0, 1, 1]];
    const angle = fill.gradientAngle || 0;

    colorPreview.style.background = `linear-gradient(${angle}deg, ${colors.map(c => `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3] || 1})`).join(', ')})`;
  }
}

/**
 * 更新 Stroke 层显示
 */
function updateStrokeLayerDisplay (item: HTMLElement, stroke: StrokeLayerState) {
  if (!item) {return;}

  const colorPreview = item.querySelector('.figma-color-preview') as HTMLElement;
  const valueSpan = item.querySelector('.figma-layer-value');

  if (colorPreview) {
    const [r, g, b] = stroke.color || [1, 0, 0, 1];
    const opacity = stroke.opacity;

    colorPreview.style.background = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity})`;
  }

  if (valueSpan) {
    const [r, g, b] = stroke.color || [1, 0, 0, 1];
    const hex = rgbToHex(r * 255, g * 255, b * 255);

    valueSpan.textContent = `${hex} ${stroke.width}px`;
  }
}

/**
 * 更新 Effect 层显示
 */
function updateEffectLayerDisplay (item: HTMLElement, effect: EffectLayerState) {
  if (!item) {return;}

  const colorPreview = item.querySelector('.figma-color-preview') as HTMLElement;
  const valueSpan = item.querySelector('.figma-layer-value');

  if (colorPreview) {
    const [r, g, b] = effect.color || [0, 0, 0, 1];

    colorPreview.style.background = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 1)`;
  }

  if (valueSpan) {
    valueSpan.textContent = `${effect.blur}px`;
  }
}

/**
 * 辅助函数：颜色转换 hex -> rgba
 */
function hexToRgba (hex: string): number[] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  return [r, g, b, 1];
}

/**
 * 辅助函数：RGB 转 HEX
 */
function rgbToHex (r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);

    return hex.length === 1 ? '0' + hex : hex;
  };

  return '#' + toHex(r) + toHex(g) + toHex(b);
}

// eslint-disable-next-line no-console
console.log('花字样式系统初始化成功');
// eslint-disable-next-line no-console
console.log('可用花字预设配置:', ['none', 'single-stroke', 'multi-stroke', 'gradient', 'shadow', 'texture']);
