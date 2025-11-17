/* eslint-disable no-console */
import { Player } from '@galacean/effects';
import { TextComponent } from '../../../packages/effects-core/src/plugins/text/text-item';
import { TextFilters } from '../../../packages/effects-core/src/plugins/text/text-filters';
import { TextStyle, type FilterType, type FilterConfig } from '../../../packages/effects-core/src/plugins/text/text-style';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*BPx_SIXgnj8AAAAAQFAAAAgAelB4AQ';
const container = document.getElementById('J-container');

let currentFilters: string[] = ['none'];
let textItem: any = null;
let textComponent: TextComponent | null = null;

// 从 TextStyle 获取滤镜配置
const availableFilters = TextStyle.getAllFilterConfigs();

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
      textItem.text = 'CSS滤镜演示';

      // 设置文本颜色为蓝色以便效果更明显
      if (textItem.setTextColor) {
        textItem.setTextColor([0, 0.5, 1, 1]); // 蓝色
      }

      // 获取TextComponent
      textComponent = textItem.getComponent(TextComponent);

      if (textComponent) {
        // 应用默认滤镜
        applyFilters(currentFilters);

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

// 应用滤镜列表（仅CSS滤镜）
function applyFilters (filters: string[]) {
  if (!textComponent) {return;}

  console.log(`应用滤镜: ${filters.join(', ')}`);

  try {
    if (filters.includes('none') || filters.length === 0) {
      // 无滤镜 - 传入空数组清除所有滤镜
      textComponent.setFilters([]);
    } else {
      const validFilters = filters.filter(f => f !== 'none') as FilterType[];
      const cssFilters = validFilters.flatMap(type => availableFilters[type]?.css || []);

      textComponent.setFilters(cssFilters);
      console.log(`已设置${cssFilters.length}个CSS字符串滤镜`);
    }

    console.log('当前滤镜配置:', textComponent.textStyle.filters);
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

  title.textContent = 'CSS滤镜控制';
  title.style.cssText = 'margin: 0 0 15px 0; font-size: 16px;';
  controlPanel.appendChild(title);

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

      applyFilters(currentFilters);
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
    applyFilters(currentFilters);

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
  configDisplay.textContent = `滤镜: ${currentFilters.join(', ')}`;
  configGroup.appendChild(configDisplay);
  controlPanel.appendChild(configGroup);

  // 监听配置变化
  const updateConfigDisplay = () => {
    configDisplay.textContent = `滤镜: ${currentFilters.join(', ')}`;
  };

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
console.log('CSS滤镜系统初始化成功');
console.log('当前CSS滤镜支持:', TextFilters.isCSSFiltersSupported);
console.log('测试提示:');
console.log('- 亮度: 降低亮度使黑色文本变灰');
console.log('- 对比度: 降低对比度使边缘柔和');
console.log('- 反色: 黑白互换，效果最明显');
console.log('- 深褐色: 经典复古效果');
console.log('- 在白底黑字上，降低参数比增加参数更明显');
