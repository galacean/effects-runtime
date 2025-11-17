import { Player } from '@galacean/effects';
import { TextStyle } from '../../../packages/effects-core/src/plugins/text/text-style';
import { TextComponent } from '../../../packages/effects-core/src/plugins/text/text-item';

// 使用text.ts中的JSON数据
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*H0HxT4AyjxMAAAAAQFAAAAgAelB4AQ';
const container = document.getElementById('J-container');

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

  // 从 TextStyle 获取花字特效配置
  const config = TextStyle.getFancyTextConfig(effectName);

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

  // 直接传入配置，setEffects 内部会调用 EffectFactory.createEffects
  textComponent.setEffects(config.effects);

  // eslint-disable-next-line no-console
  console.log(`已应用 ${config.effects.length} 个特效配置到文本组件`);
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
  configDisplay.textContent = JSON.stringify(TextStyle.getFancyTextConfig(currentEffect), null, 2);
  configGroup.appendChild(configDisplay);
  controlPanel.appendChild(configGroup);

  // 监听配置变化
  const updateConfigDisplay = () => {
    configDisplay.textContent = JSON.stringify(TextStyle.getFancyTextConfig(currentEffect), null, 2);
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
console.log('可用特效配置:', ['none', 'single-stroke', 'multi-stroke', 'gradient', 'shadow', 'texture']);
