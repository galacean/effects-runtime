import { Player } from '@galacean/effects';
import type { FancyTextStyle } from '../../../packages/effects-core/src/plugins/text/text-style';
import { FancyTextEffect } from '../../../packages/effects-core/src/plugins/text/text-style';
import { EffectFactory } from '../../../packages/effects-core/src/plugins/text/effects';
import { TextComponent } from '../../../packages/effects-core/src/plugins/text/text-item';

// 使用text.ts中的JSON数据
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*H0HxT4AyjxMAAAAAQFAAAAgAelB4AQ';
const container = document.getElementById('J-container');

// 花字特效配置 - 支持多特效组合
const fancyTextConfigs: Record<string, FancyTextStyle> = {
  'none': {
    effects: [],
  },
  // 单描边填充花字
  'single-stroke': {
    effects: [
      {
        type: 'single-stroke',
        params: {
          width: 4,
          color: [1, 0.25, 0.54, 1], // #FF3F89
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [1, 0.74, 0.84, 1], // #FFBCD7
        },
      },
    ],
  },
  // 多描边花字（使用效果栈方式）
  'multi-stroke': {
    effects: [
      // 效果栈演示：多描边 + 填充
      // 顺序很关键：每一层都是"同色描边 + 同色填充"
      {
        type: 'single-stroke',
        params: {
          width: 15,
          color: [0.75, 0.28, 0.77, 1], // #C048C5 - 最外层紫色
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [0.75, 0.28, 0.77, 1], // #C048C5 - 最外层紫色
        },
      },

      {
        type: 'single-stroke',
        params: {
          width: 12,
          color: [0.44, 0.34, 0.81, 1], // #7057CF - 深紫色
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [0.44, 0.34, 0.81, 1], // #7057CF - 深紫色
        },
      },

      {
        type: 'single-stroke',
        params: {
          width: 9,
          color: [0.52, 0.89, 0.19, 1], // #86E431 - 绿色
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [0.52, 0.89, 0.19, 1], // #86E431 - 绿色
        },
      },

      {
        type: 'single-stroke',
        params: {
          width: 6,
          color: [1, 0.52, 0.36, 1], // #FF865B - 橙色
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [1, 0.52, 0.36, 1], // #FF865B - 橙色
        },
      },

      {
        type: 'single-stroke',
        params: {
          width: 3,
          color: [0.99, 0.19, 0.51, 1], // #FC3081 - 粉色
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [1, 1, 1, 1], // 白色填充
        },
      },
    ],
  },
  // 渐变花字
  'gradient': {
    effects: [
      {
        type: 'gradient',
        params: {
          colors: [
            { offset: 0, color: [1, 0.23, 0.23, 1] },     // #FF3A3A - 红色
            { offset: 1, color: [0.66, 0, 0, 1] },        // #A80101 - 深红色
          ],
          strokeWidth: 0.09,
          strokeColor: '#F8E8A2',
        },
      },
    ],
  },
  // 投影花字
  'shadow': {
    effects: [
      {
        type: 'shadow',
        params: {
          color: [0.93, 0.29, 0.29, 1], // #EE4949
          offsetX: 6,
          offsetY: 2,
          strokeWidth: 0.12,
          strokeColor: '#F7A4A4',
          topStrokeWidth: 0.04,
          topStrokeColor: '#FFFFFF',
        },
      },
    ],
  },
  // 纹理花字
  'texture': {
    effects: [
      {
        type: 'texture',
        params: {
          imageUrl: '/assets/text-effects/images/E9FE8222-61DA-46FB-A616-DCF1CC243558.png',
          strokeWidth: 0.04,
          strokeColor: '#9C4607',
        },
      },
    ],
  },
};

let currentEffect = 'multi-stroke';
let textItem: any = null;

(async () => {
  try {
    const player = new Player({
      container,
    });

    const composition = await player.loadScene(json);

    // 获取文本元素
    textItem = composition.getItemByName('text_3');

    if (textItem) {
      // 修改文本内容
      textItem.text = '花字特效';

      // 应用默认花字特效
      applyFancyTextEffect(currentEffect);

      // 创建控制界面
      createControls();
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('加载失败:', e);
  }
})();

// 应用花字特效
function applyFancyTextEffect (effectName: string) {
  if (!textItem) {return;}

  const config = fancyTextConfigs[effectName];

  if (!config) {return;}

  // eslint-disable-next-line no-console
  console.log(`应用花字特效: ${effectName}`, config);

  // 获取TextComponent
  const textComponent = textItem.getComponent(TextComponent);

  if (!textComponent) {
    // eslint-disable-next-line no-console
    console.warn('未找到TextComponent');

    return;
  }

  // 使用特效工厂创建特效实例
  const effects = EffectFactory.createEffects(config.effects);

  // 应用特效到TextComponent
  textComponent.setEffects(effects);

  // eslint-disable-next-line no-console
  console.log(`已应用 ${effects.length} 个特效到文本组件`);
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
    max-width: 250px;
  `;

  // 标题
  const title = document.createElement('h3');

  title.textContent = '花字特效控制';
  title.style.cssText = 'margin: 0 0 15px 0; font-size: 16px;';
  controlPanel.appendChild(title);

  // 字体大小

  // 特效按钮
  const effectGroup = createControlGroup('特效选择');
  const effects = [
    { key: 'none', name: '无特效' },
    { key: 'single-stroke', name: '单描边' },
    { key: 'multi-stroke', name: '多描边' },
    { key: 'gradient', name: '渐变' },
    { key: 'shadow', name: '投影' },
    { key: 'texture', name: '纹理' },
  ];

  effects.forEach(effect => {
    const button = document.createElement('button');

    button.textContent = effect.name;
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
      currentEffect = effect.key;
      applyFancyTextEffect(currentEffect);
      // 更新按钮样式
      effectGroup.querySelectorAll('button').forEach(btn => {
        (btn as HTMLElement).style.background = '#333';
      });
      button.style.background = '#007bff';
    });
    effectGroup.appendChild(button);
  });

  // 默认选中多描边
  const multiStrokeButton = effectGroup.querySelector('button:nth-child(3)') as HTMLButtonElement;

  if (multiStrokeButton) {
    multiStrokeButton.style.background = '#007bff';
  }

  controlPanel.appendChild(effectGroup);

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
  configDisplay.textContent = JSON.stringify(fancyTextConfigs[currentEffect], null, 2);
  configGroup.appendChild(configDisplay);
  controlPanel.appendChild(configGroup);

  // 监听配置变化
  const updateConfigDisplay = () => {
    configDisplay.textContent = JSON.stringify(fancyTextConfigs[currentEffect], null, 2);
  };

  effectGroup.addEventListener('click', updateConfigDisplay);

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

// eslint-disable-next-line no-console
console.log('花字特效系统初始化成功');
// eslint-disable-next-line no-console
console.log('可用特效配置:', Object.keys(fancyTextConfigs));
