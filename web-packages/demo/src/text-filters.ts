/* eslint-disable no-console */
import { Player } from '@galacean/effects';
import { TextComponent } from '../../../packages/effects-core/src/plugins/text/text-item';
import { TextFilters } from '../../../packages/effects-core/src/plugins/text/text-filters';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*BPx_SIXgnj8AAAAAQFAAAAgAelB4AQ';
const container = document.getElementById('J-container');

let currentFilters: string[] = ['none'];
let currentMode = 'css'; // 'css' 或 'cpu'
let textItem: any = null;
let textComponent: TextComponent | null = null;

// 重写TextFilters的检测方法以支持强制CPU模式
const originalIsCSSFiltersSupported = TextFilters.isCSSFiltersSupported;

Object.defineProperty(TextFilters, 'isCSSFiltersSupported', {
  get: function () {
    return currentMode === 'css' ? originalIsCSSFiltersSupported : false;
  },
});

// 定义滤镜类型
type FilterType = 'none' | 'blur' | 'brightness' | 'contrast' | 'grayscale' | 'invert' | 'sepia';

// 定义滤镜配置接口
interface FilterConfig {
  name: string,
  css: string[],
  cpu: ((imageData: ImageData) => ImageData)[],
  description: string,
}

// 可用的滤镜配置
const availableFilters: Record<FilterType, FilterConfig> = {
  none: {
    name: '无滤镜',
    css: [],
    cpu: [],
    description: '原始效果',
  },
  blur: {
    name: '模糊',
    css: ['blur(10px)'],
    cpu: [(imageData: ImageData) => TextFilters.blur(imageData, 4)],
    description: '10px高斯模糊',
  },
  brightness: {
    name: '亮度',
    css: ['brightness(0.3)'],
    cpu: [(imageData: ImageData) => TextFilters.brightness(imageData, 0.3)],
    description: '30%亮度',
  },
  contrast: {
    name: '对比度',
    css: ['contrast(0.2)'],
    cpu: [(imageData: ImageData) => TextFilters.contrast(imageData, 0.2)],
    description: '20%对比度',
  },
  grayscale: {
    name: '灰度',
    css: ['grayscale(1)'],
    cpu: [(imageData: ImageData) => TextFilters.grayscale(imageData, 1)],
    description: '完全灰度',
  },
  invert: {
    name: '反色',
    css: ['invert(1)'],
    cpu: [(imageData: ImageData) => TextFilters.invert(imageData, 1)],
    description: '完全反色',
  },
  sepia: {
    name: '深褐色',
    css: ['sepia(1)'],
    cpu: [(imageData: ImageData) => TextFilters.sepia(imageData, 1)],
    description: '深褐色效果',
  },
};

// 创建CPU滤镜函数
const createCPUFilter = (type: FilterType) => {
  const config = availableFilters[type];

  return config.cpu[0] || null;
};

(async () => {
  try {
    const player = new Player({
      container,
    });

    const composition = await player.loadScene(json);

    // 获取文本元素
    textItem = composition.getItemByName('text_2');

    if (textItem) {
      // 修改文本内容 - 使用彩色文本以便效果更明显
      textItem.text = '彩色滤镜演示';

      // 设置文本颜色为蓝色以便效果更明显
      if (textItem.setTextColor) {
        textItem.setTextColor([0, 0.5, 1, 1]); // 蓝色
      }

      // 获取TextComponent
      textComponent = textItem.getComponent(TextComponent);

      if (textComponent) {
        // 应用默认滤镜
        applyFilters(currentFilters, currentMode);

        // 创建控制界面
        createControls();
      } else {
        console.warn('未找到TextComponent');
      }
    }
  } catch (e) {
    console.error('加载失败:', e);
  }
})();

// 应用滤镜列表
function applyFilters (filters: string[], mode: string) {
  if (!textComponent) {return;}

  console.log(`应用滤镜: ${filters.join(', ')}, 模式: ${mode}`);

  try {
    currentMode = mode;

    if (filters.includes('none') || filters.length === 0) {
      // 无滤镜
      textComponent.filters = [];
      textComponent.filterOptions = {};
    } else {
      const validFilters = filters.filter(f => f !== 'none') as FilterType[];

      if (mode === 'cpu') {
        // CPU模式：使用函数滤镜列表
        const cpuFilters = validFilters
          .map(type => createCPUFilter(type))
          .filter(fn => fn !== null) as ((imageData: ImageData) => ImageData)[];

        textComponent.filters = cpuFilters;
        console.log(`已设置${cpuFilters.length}个CPU函数滤镜`);
      } else {
        // CSS模式：使用字符串滤镜列表
        const cssFilters = validFilters.flatMap(type => availableFilters[type]?.css || []);

        textComponent.filters = cssFilters;
        console.log(`已设置${cssFilters.length}个CSS字符串滤镜`);
      }
    }

    textComponent.isDirty = true;

    // 强制立即更新
    setTimeout(() => {
      if (textComponent) {
        textComponent.isDirty = true;
        console.log('强制更新纹理完成');
      }
    }, 50);

    console.log('当前滤镜配置:', textComponent.filters);
  } catch (error) {
    console.error('应用滤镜失败:', error);
  }
}

// 创建控制界面
function createControls () {
  const controlPanel = document.createElement('div');

  controlPanel.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 15px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    z-index: 1000;
    max-width: 320px;
  `;

  // 标题
  const title = document.createElement('h3');

  title.textContent = '增强滤镜控制';
  title.style.cssText = 'margin: 0 0 15px 0; font-size: 16px;';
  controlPanel.appendChild(title);

  // 模式切换
  const modeGroup = createControlGroup('渲染模式');
  const modes = [
    { key: 'css', name: 'CSS滤镜' },
    { key: 'cpu', name: 'CPU滤镜' },
  ];

  modes.forEach(mode => {
    const button = document.createElement('button');

    button.textContent = mode.name;
    button.style.cssText = `
      display: block;
      width: 100%;
      padding: 8px;
      margin: 5px 0;
      background: #333;
      color: white;
      border: 1px solid #555;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    button.addEventListener('click', () => {
      applyFilters(currentFilters, mode.key);
      // 更新按钮样式
      modeGroup.querySelectorAll('button').forEach(btn => {
        (btn as HTMLElement).style.background = '#333';
      });
      button.style.background = '#007bff';
    });
    modeGroup.appendChild(button);
  });

  // 默认选中CSS模式
  const cssButton = modeGroup.querySelector('button') as HTMLButtonElement;

  if (cssButton) {
    cssButton.style.background = '#007bff';
  }

  controlPanel.appendChild(modeGroup);

  // 滤镜选择（复选框）
  const filterGroup = createControlGroup('滤镜选择（可多选）');

  Object.entries(availableFilters).forEach(([key, config]) => {
    if (key === 'none') {return;} // 跳过无滤镜

    const checkbox = document.createElement('input');

    checkbox.type = 'checkbox';
    checkbox.id = `filter-${key}`;
    checkbox.checked = currentFilters.includes(key);
    checkbox.style.cssText = 'margin-right: 5px;';

    const label = document.createElement('label');

    label.htmlFor = `filter-${key}`;
    label.textContent = `${config.name} - ${config.description}`;
    label.style.cssText = 'color: white; font-size: 11px; margin-right: 5px; display: block;';

    const container = document.createElement('div');

    container.style.cssText = 'margin: 3px 0; display: flex; align-items: center;';

    checkbox.addEventListener('change', e => {
      const checked = (e.target as HTMLInputElement).checked;
      const filterKey = key as FilterType;

      if (checked) {
        // 添加滤镜
        currentFilters = [...currentFilters.filter(f => f !== 'none'), filterKey];
      } else {
        // 移除滤镜
        currentFilters = currentFilters.filter(f => f !== filterKey);
        if (currentFilters.length === 0) {
          currentFilters = ['none'];
        }
      }

      applyFilters(currentFilters, currentMode);
    });

    container.appendChild(checkbox);
    container.appendChild(label);
    filterGroup.appendChild(container);
  });

  // 清除所有滤镜按钮
  const clearButton = document.createElement('button');

  clearButton.textContent = '清除所有滤镜';
  clearButton.style.cssText = `
    display: block;
    width: 100%;
    padding: 8px;
    margin: 10px 0;
    background: #d9534f;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  clearButton.addEventListener('click', () => {
    currentFilters = ['none'];
    applyFilters(currentFilters, currentMode);

    // 重置复选框
    filterGroup.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      (cb as HTMLInputElement).checked = false;
    });
  });
  filterGroup.appendChild(clearButton);

  controlPanel.appendChild(filterGroup);

  // 添加配置显示
  const configGroup = createControlGroup('当前配置');
  const configDisplay = document.createElement('pre');

  configDisplay.style.cssText = `
    background: #222;
    padding: 10px;
    border-radius: 4px;
    font-size: 10px;
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  `;
  configDisplay.textContent = `滤镜: ${currentFilters.join(', ')}\n模式: ${currentMode}`;
  configGroup.appendChild(configDisplay);
  controlPanel.appendChild(configGroup);

  // 监听配置变化
  const updateConfigDisplay = () => {
    configDisplay.textContent = `滤镜: ${currentFilters.join(', ')}\n模式: ${currentMode}`;
  };

  modeGroup.addEventListener('click', updateConfigDisplay);
  filterGroup.addEventListener('change', updateConfigDisplay);

  document.body.appendChild(controlPanel);
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

// 添加测试信息
console.log('增强滤镜系统初始化成功');
console.log('当前CSS滤镜支持:', TextFilters.isCSSFiltersSupported);
console.log('测试提示:');
console.log('- 亮度: 降低亮度使黑色文本变灰');
console.log('- 对比度: 降低对比度使边缘柔和');
console.log('- 反色: 黑白互换，效果最明显');
console.log('- 深褐色: 经典复古效果');
console.log('- 在白底黑字上，降低参数比增加参数更明显');
