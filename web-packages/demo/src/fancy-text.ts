import { Player } from '@galacean/effects';
import { TextComponent } from '@galacean/effects-core';
import { EffectFactory } from '@galacean/effects-core';
import { getDemoFancyJsonConfig } from './fancy-presets';

// 使用text.ts中的JSON数据
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*H0HxT4AyjxMAAAAAQFAAAAgAelB4AQ';
const container = document.getElementById('J-container');

let currentEffect = 'none';
let textItem: any = null;
let initialFancyConfig: any = null;  // 存 TextStyle 初始的 fancyTextConfig 快照

// 设置纹理pattern
async function setupTexturePattern (textComponent: TextComponent) {
  const ctx = document.createElement('canvas').getContext('2d');

  if (!ctx) {return;}

  const img = new Image();

  img.crossOrigin = 'anonymous';
  img.src = 'https://gw.alipayobjects.com/mdn/rms_2e421e/afts/img/A*fRtNTKrsq3YAAAAAAAAAAAAAARQnAQ'; // 纹理图片

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const pattern = ctx.createPattern(img, 'repeat');

  if (!pattern) {return;}

  // 找到当前花字配置中的 texture effect，写入 pattern
  const config = textComponent.textStyle.fancyTextConfig;

  for (const eff of config.effects) {
    if (eff.type === 'texture') {
      eff.params = eff.params || {};
      eff.params.pattern = pattern;
    }
  }

  textComponent.effects = EffectFactory.createEffects(config.effects);
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
        // 记录一份初始 fancyTextConfig 的深拷贝快照
        initialFancyConfig = JSON.parse(JSON.stringify(textComponent.getCurrentFancyTextConfig()));
      }

      // 应用默认花字特效（none）
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

  const textComponent = textItem.getComponent(TextComponent);

  if (!textComponent) {
    console.warn('未找到TextComponent');

    return;
  }

  const style = textComponent.textStyle;

  if (effectName === 'none') {
    // 恢复到 demo 记录的"初始 fancyTextConfig 快照"
    if (initialFancyConfig) {
      // 深拷贝回去，避免后续修改影响快照本身
      style.fancyTextConfig = JSON.parse(JSON.stringify(initialFancyConfig));
    } else {
      // 万一没记录到快照，就退回 core 的基础栈
      style.fancyTextConfig = style.getBaseEffectsFromNativeStyle();
    }
  } else {
    // 其它预设：使用 JSON 配置
    const json = getDemoFancyJsonConfig(effectName);

    style.applyFancyJson(json);
  }

  // 按当前 fancyTextConfig.effects 重建 effects
  textComponent.effects = EffectFactory.createEffects(style.fancyTextConfig.effects);
  textComponent.isDirty = true;

  if (effectName === 'texture') {
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

  // 更新 effects
  textComponent.effects = EffectFactory.createEffects(textComponent.textStyle.fancyTextConfig.effects);
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
    { key: 'none', name: '无特效(core默认)' },
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

  // 默认选中“无特效(core默认)”
  const noneButton = effectGroup.querySelector('button:nth-child(1)') as HTMLButtonElement;

  if (noneButton) {
    noneButton.style.background = '#007bff';
  }

  controlPanel.appendChild(effectGroup);

  // 曲线文本控制
  const curvedTextGroup = createControlGroup('曲线文本');
  const curvedTextControls = document.createElement('div');

  curvedTextControls.innerHTML = `
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; font-size: 12px;">曲线强度: <span id="powerValue">0</span></label>
        <input type="range" id="curvedPower" min="-100" max="100" value="0" style="width: 100%;">
      </div>
      <div style="margin-bottom: 10px;">
        <button id="disableCurvedText" style="width: 100%; padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px;">禁用曲线文本</button>
      </div>
    `;
  curvedTextGroup.appendChild(curvedTextControls);
  controlPanel.appendChild(curvedTextGroup);

  // 手动控制组
  const manualGroup = createControlGroup('手动控制');

  // 描边控制
  const strokeControls = document.createElement('div');

  strokeControls.innerHTML = `
    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px; font-size: 12px;">描边开关</label>
      <button id="strokeToggle" style="width: 100%; padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px;">启用描边</button>
    </div>
    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px; font-size: 12px;">描边颜色</label>
      <input type="color" id="strokeColor" value="#ff0000" style="width: 100%; height: 25px; border: 1px solid #555; border-radius: 4px;">
    </div>
    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px; font-size: 12px;">描边宽度: <span id="strokeWidthValue">3</span></label>
      <input type="range" id="strokeWidth" min="1" max="10" value="3" style="width: 100%;">
    </div>
  `;
  manualGroup.appendChild(strokeControls);

  // 阴影控制
  const shadowControls = document.createElement('div');

  shadowControls.innerHTML = `
    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px; font-size: 12px;">阴影开关</label>
      <button id="shadowToggle" style="width: 100%; padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px;">启用阴影</button>
    </div>
    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px; font-size: 12px;">阴影颜色</label>
      <input type="color" id="shadowColor" value="#000000" style="width: 100%; height: 25px; border: 1px solid #555; border-radius: 4px;">
    </div>
    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px; font-size: 12px;">阴影透明度: <span id="shadowOpacityValue">1.0</span></label>
      <input type="range" id="shadowOpacity" min="0" max="1" step="0.01" value="1" style="width: 100%;">
    </div>
    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px; font-size: 12px;">阴影模糊: <span id="shadowBlurValue">5</span></label>
      <input type="range" id="shadowBlur" min="0" max="20" value="5" style="width: 100%;">
    </div>
    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px; font-size: 12px;">阴影距离: <span id="shadowDistanceValue">5</span></label>
      <input type="range" id="shadowDistance" min="0" max="50" value="5" style="width: 100%;">
    </div>
    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px; font-size: 12px;">阴影角度(度): <span id="shadowAngleValue">45</span></label>
      <input type="range" id="shadowAngle" min="0" max="360" value="45" style="width: 100%;">
    </div>
  `;
  manualGroup.appendChild(shadowControls);

  // 文本颜色控制
  const textControls = document.createElement('div');

  textControls.innerHTML = `
    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px; font-size: 12px;">文本颜色</label>
      <input type="color" id="textColor" value="#ffffff" style="width: 100%; height: 25px; border: 1px solid #555; border-radius: 4px;">
    </div>
  `;
  manualGroup.appendChild(textControls);

  controlPanel.appendChild(manualGroup);

  // 配置显示
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

  // 初始显示快照配置或core的实际配置
  const textComponent = textItem?.getComponent(TextComponent);
  const initialConfigForDisplay = initialFancyConfig ||
    (textComponent ? textComponent.getCurrentFancyTextConfig() : getDemoFancyJsonConfig(currentEffect));

  configDisplay.textContent = JSON.stringify(initialConfigForDisplay, null, 2);
  configGroup.appendChild(configDisplay);
  controlPanel.appendChild(configGroup);

  // 先将HTML元素添加到DOM中
  document.body.appendChild(controlPanel);

  // 现在可以安全地获取DOM元素并绑定事件
  const powerSlider = document.getElementById('curvedPower') as HTMLInputElement;
  const powerValue = document.getElementById('powerValue');

  // 定义更新曲线文本强度的函数
  const updateCurvedTextPower = () => {
    if (powerSlider && powerValue && textItem) {
      const power = parseInt(powerSlider.value);

      // 更新显示值
      powerValue.textContent = power.toString();

      const textComponent = textItem.getComponent(TextComponent);

      if (textComponent) {
        textComponent.setCurvedTextPower(power);

        // 验证设置是否生效
        const configAfter = textComponent.getCurrentFancyTextConfig();

        // 只更新配置显示，不调用 updateDisplays() 避免覆盖滑块值
        configDisplay.textContent = JSON.stringify(configAfter, null, 2);
      }
    }
  };

  if (powerSlider && powerValue) {
    powerSlider.addEventListener('input', updateCurvedTextPower);

    // 初始化时也更新一次
    const power = parseInt(powerSlider.value);

    powerValue.textContent = power.toString();
  }

  document.getElementById('disableCurvedText')?.addEventListener('click', () => {
    if (textItem) {
      const textComponent = textItem.getComponent(TextComponent);

      textComponent?.setCurvedTextPower(0);

      // 确保更新纹理以触发重绘
      textComponent.isDirty = true;
      textComponent.updateTexture();

      // 重置滑块
      if (powerSlider) {
        powerSlider.value = '0';
        if (powerValue) {
          powerValue.textContent = '0';
        }
      }
      updateDisplays();
    }
  });

  // 添加CSS样式用于禁用状态的视觉表示
  const style = document.createElement('style');

  style.textContent = `
    .disabled-control {
      opacity: 0.5;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // 绑定手动控制事件
  let strokeEnabled = false;
  let shadowEnabled = false;

  document.getElementById('strokeToggle')?.addEventListener('click', e => {
    strokeEnabled = !strokeEnabled;
    const btn = e.target as HTMLButtonElement;

    btn.textContent = strokeEnabled ? '禁用描边' : '启用描边';
    btn.style.background = strokeEnabled ? '#007bff' : '#333';
    toggleStroke(strokeEnabled);
    updateDisplays();
  });

  document.getElementById('shadowToggle')?.addEventListener('click', e => {
    shadowEnabled = !shadowEnabled;
    const btn = e.target as HTMLButtonElement;

    btn.textContent = shadowEnabled ? '禁用阴影' : '启用阴影';
    btn.style.background = shadowEnabled ? '#007bff' : '#333';
    toggleShadow(shadowEnabled);
    updateDisplays();
  });

  document.getElementById('strokeColor')?.addEventListener('input', e => {
    const color = hexToRgba((e.target as HTMLInputElement).value);

    updateStrokeParams({ color });
    updateDisplays();
  });

  document.getElementById('strokeWidth')?.addEventListener('input', e => {
    const width = parseFloat((e.target as HTMLInputElement).value);
    const valueDisplay = document.getElementById('strokeWidthValue');

    if (valueDisplay) {
      valueDisplay.textContent = width.toFixed(1);
    }
    updateStrokeParams({ width });
    updateDisplays();
  });

  document.getElementById('shadowColor')?.addEventListener('input', e => {
    const color = hexToRgba((e.target as HTMLInputElement).value);

    updateShadowParams({ color });
    updateDisplays();
  });

  document.getElementById('shadowBlur')?.addEventListener('input', e => {
    const blur = parseFloat((e.target as HTMLInputElement).value);
    const valueDisplay = document.getElementById('shadowBlurValue');

    if (valueDisplay) {
      valueDisplay.textContent = blur.toFixed(1);
    }
    updateShadowParams({ blur });
    updateDisplays();
  });

  // 阴影透明度
  document.getElementById('shadowOpacity')?.addEventListener('input', e => {
    const opacity = parseFloat((e.target as HTMLInputElement).value);
    const valueDisplay = document.getElementById('shadowOpacityValue');

    if (valueDisplay) {
      valueDisplay.textContent = opacity.toFixed(2);
    }
    updateShadowParams({ opacity });
    updateDisplays();
  });

  // 阴影距离
  document.getElementById('shadowDistance')?.addEventListener('input', e => {
    const distance = parseFloat((e.target as HTMLInputElement).value);
    const valueDisplay = document.getElementById('shadowDistanceValue');

    if (valueDisplay) {
      valueDisplay.textContent = distance.toFixed(1);
    }
    updateShadowParams({ distance });
    updateDisplays();
  });

  // 阴影角度
  document.getElementById('shadowAngle')?.addEventListener('input', e => {
    const angle = parseFloat((e.target as HTMLInputElement).value);
    const valueDisplay = document.getElementById('shadowAngleValue');

    if (valueDisplay) {
      valueDisplay.textContent = angle.toFixed(0);
    }
    updateShadowParams({ angle });
    updateDisplays();
  });

  document.getElementById('textColor')?.addEventListener('input', e => {
    const color = hexToRgba((e.target as HTMLInputElement).value);

    updateTextColor(color);
    updateDisplays();
  });

  // 更新显示函数
  const updateDisplays = () => {
    if (!textItem) {return;}

    const textComponent = textItem.getComponent(TextComponent);

    if (!textComponent) {return;}

    // 更新配置显示
    const config = textComponent.getCurrentFancyTextConfig();

    configDisplay.textContent = JSON.stringify(config, null, 2);

    // 同步参数值到UI控件
    syncParamsToUI(config);

    // 根据editableParams控制UI控件状态
    if (config.editableParams) {
      const editableParams = config.editableParams;

      // 控制描边控件
      const strokeToggle = document.getElementById('strokeToggle');
      const strokeColor = document.getElementById('strokeColor') as HTMLInputElement;
      const strokeWidth = document.getElementById('strokeWidth') as HTMLInputElement;

      if (strokeToggle) {
        if (editableParams.includes('stroke')) {
          strokeToggle.removeAttribute('disabled');
          strokeToggle.classList.remove('disabled-control');
        } else {
          strokeToggle.setAttribute('disabled', 'true');
          strokeToggle.classList.add('disabled-control');
        }
      }

      if (strokeColor) {
        if (editableParams.includes('stroke')) {
          strokeColor.removeAttribute('disabled');
          strokeColor.classList.remove('disabled-control');
        } else {
          strokeColor.setAttribute('disabled', 'true');
          strokeColor.classList.add('disabled-control');
        }
      }

      if (strokeWidth) {
        if (editableParams.includes('stroke')) {
          strokeWidth.removeAttribute('disabled');
          strokeWidth.classList.remove('disabled-control');
        } else {
          strokeWidth.setAttribute('disabled', 'true');
          strokeWidth.classList.add('disabled-control');
        }
      }

      // 控制阴影控件
      const shadowToggle = document.getElementById('shadowToggle');
      const shadowColor = document.getElementById('shadowColor') as HTMLInputElement;
      const shadowBlur = document.getElementById('shadowBlur') as HTMLInputElement;

      if (shadowToggle) {
        if (editableParams.includes('shadow')) {
          shadowToggle.removeAttribute('disabled');
          shadowToggle.classList.remove('disabled-control');
        } else {
          shadowToggle.setAttribute('disabled', 'true');
          shadowToggle.classList.add('disabled-control');
        }
      }

      if (shadowColor) {
        if (editableParams.includes('shadow')) {
          shadowColor.removeAttribute('disabled');
          shadowColor.classList.remove('disabled-control');
        } else {
          shadowColor.setAttribute('disabled', 'true');
          shadowColor.classList.add('disabled-control');
        }
      }

      if (shadowBlur) {
        if (editableParams.includes('shadow')) {
          shadowBlur.removeAttribute('disabled');
          shadowBlur.classList.remove('disabled-control');
        } else {
          shadowBlur.setAttribute('disabled', 'true');
          shadowBlur.classList.add('disabled-control');
        }
      }

      // 控制填充控件
      const textColor = document.getElementById('textColor') as HTMLInputElement;

      if (textColor) {
        if (editableParams.includes('fill')) {
          textColor.removeAttribute('disabled');
          textColor.classList.remove('disabled-control');
        } else {
          textColor.setAttribute('disabled', 'true');
          textColor.classList.add('disabled-control');
        }
      }

      // 控制曲线文本控件
      const curvedPower = document.getElementById('curvedPower') as HTMLInputElement;
      const disableCurvedText = document.getElementById('disableCurvedText') as HTMLButtonElement;

      if (curvedPower) {
        if (editableParams.includes('curve')) {
          curvedPower.removeAttribute('disabled');
          curvedPower.classList.remove('disabled-control');
        } else {
          curvedPower.setAttribute('disabled', 'true');
          curvedPower.classList.add('disabled-control');
        }
      }

      if (disableCurvedText) {
        if (editableParams.includes('curve')) {
          disableCurvedText.removeAttribute('disabled');
          disableCurvedText.classList.remove('disabled-control');
        } else {
          disableCurvedText.setAttribute('disabled', 'true');
          disableCurvedText.classList.add('disabled-control');
        }
      }
    } else {
      // 没有editableParams时启用所有控件
      const strokeToggle = document.getElementById('strokeToggle');
      const strokeColor = document.getElementById('strokeColor') as HTMLInputElement;
      const strokeWidth = document.getElementById('strokeWidth') as HTMLInputElement;
      const shadowToggle = document.getElementById('shadowToggle');
      const shadowColor = document.getElementById('shadowColor') as HTMLInputElement;
      const shadowBlur = document.getElementById('shadowBlur') as HTMLInputElement;
      const textColor = document.getElementById('textColor') as HTMLInputElement;
      const curvedPower = document.getElementById('curvedPower') as HTMLInputElement;
      const disableCurvedText = document.getElementById('disableCurvedText') as HTMLButtonElement;

      [strokeToggle, strokeColor, strokeWidth, shadowToggle, shadowColor, shadowBlur, textColor, curvedPower, disableCurvedText].forEach(control => {
        if (control) {
          (control as HTMLInputElement | HTMLButtonElement).removeAttribute('disabled');
          control.classList.remove('disabled-control');
        }
      });
    }
  };

  // 同步参数值到UI控件
  const syncParamsToUI = (config: any) => {
    if (!config.effects) {return;}

    // 遍历特效配置，提取参数并更新UI
    config.effects.forEach((effect: any) => {
      if (effect.type === 'single-stroke' && effect.params) {
        // 更新描边参数
        if (effect.params.width !== undefined) {
          const strokeWidthInput = document.getElementById('strokeWidth') as HTMLInputElement;
          const strokeWidthValue = document.getElementById('strokeWidthValue');

          if (strokeWidthInput) {
            strokeWidthInput.value = effect.params.width.toString();
          }
          if (strokeWidthValue) {
            strokeWidthValue.textContent = effect.params.width.toFixed(1);
          }
        }

        if (effect.params.color) {
          const strokeColorInput = document.getElementById('strokeColor') as HTMLInputElement;

          if (strokeColorInput) {
            // 将vec4颜色转换为hex颜色
            const [r, g, b] = effect.params.color;
            const hexColor = rgbToHex(r * 255, g * 255, b * 255);

            strokeColorInput.value = hexColor;
          }
        }
      }

      if (effect.type === 'shadow' && effect.params) {
        // 更新阴影参数
        if (effect.params.blur !== undefined) {
          const shadowBlurInput = document.getElementById('shadowBlur') as HTMLInputElement;
          const shadowBlurValue = document.getElementById('shadowBlurValue');

          if (shadowBlurInput) {
            shadowBlurInput.value = effect.params.blur.toString();
          }
          if (shadowBlurValue) {
            shadowBlurValue.textContent = effect.params.blur.toFixed(1);
          }
        }

        if (effect.params.color) {
          const shadowColorInput = document.getElementById('shadowColor') as HTMLInputElement;
          const shadowOpacityInput = document.getElementById('shadowOpacity') as HTMLInputElement;
          const shadowOpacityValue = document.getElementById('shadowOpacityValue');

          if (shadowColorInput) {
            // 将vec4颜色转换为hex颜色
            const [r, g, b, a = 1] = effect.params.color;
            const hexColor = rgbToHex(r * 255, g * 255, b * 255);

            shadowColorInput.value = hexColor;
          }

          if (shadowOpacityInput) {
            shadowOpacityInput.value = (effect.params.color[3] || 1).toString();
          }

          if (shadowOpacityValue) {
            shadowOpacityValue.textContent = (effect.params.color[3] || 1).toFixed(2);
          }
        }

        // 从 offsetX / offsetY 反算 distance / angle，填回控件
        if (effect.params.offsetX !== undefined || effect.params.offsetY !== undefined) {
          const ox = effect.params.offsetX || 0;
          const oy = effect.params.offsetY || 0;
          const distance = Math.sqrt(ox * ox + oy * oy);
          let angle = Math.atan2(oy, ox) * 180 / Math.PI;

          if (angle < 0) {angle += 360;}

          const shadowDistanceInput = document.getElementById('shadowDistance') as HTMLInputElement;
          const shadowDistanceValue = document.getElementById('shadowDistanceValue');
          const shadowAngleInput = document.getElementById('shadowAngle') as HTMLInputElement;
          const shadowAngleValue = document.getElementById('shadowAngleValue');

          if (shadowDistanceInput) {
            shadowDistanceInput.value = distance.toFixed(1);
          }
          if (shadowDistanceValue) {
            shadowDistanceValue.textContent = distance.toFixed(1);
          }
          if (shadowAngleInput) {
            shadowAngleInput.value = angle.toFixed(0);
          }
          if (shadowAngleValue) {
            shadowAngleValue.textContent = angle.toFixed(0);
          }
        }
      }

      if (effect.type === 'solid-fill' && effect.params) {
        // 更新填充参数
        if (effect.params.color) {
          const textColorInput = document.getElementById('textColor') as HTMLInputElement;

          if (textColorInput) {
            // 将vec4颜色转换为hex颜色
            const [r, g, b] = effect.params.color;
            const hexColor = rgbToHex(r * 255, g * 255, b * 255);

            textColorInput.value = hexColor;
          }
        }
      }
    });

    // 同步曲线文本参数 - 暂时注释掉，避免覆盖用户输入
    // 曲线参数完全由滑块控制，不需要从配置反向同步
    // if (config.curvedTextPower !== undefined) {
    //   const curvedPowerInput = document.getElementById('curvedPower') as HTMLInputElement;
    //   const curvedPowerValue = document.getElementById('powerValue');

    //   if (curvedPowerInput && curvedPowerValue) {
    //     const currentValue = parseInt(curvedPowerInput.value);
    //     const configValue = config.curvedTextPower;

    //     // 只有当配置值与当前值不同时才更新
    //     if (currentValue !== configValue) {
    //       curvedPowerInput.value = configValue.toString();
    //       curvedPowerValue.textContent = configValue.toString();
    //     }
    //   }
    // }
  };

  // 监听配置变化
  const updateConfigDisplay = () => {
    updateDisplays();
  };

  effectGroup.addEventListener('click', updateConfigDisplay);

  // 辅助函数：颜色转换
  function hexToRgba (hex: string): number[] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    return [r, g, b, 1];
  }

  // 辅助函数：RGB转HEX
  function rgbToHex (r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);

      return hex.length === 1 ? '0' + hex : hex;
    };

    return '#' + toHex(r) + toHex(g) + toHex(b);
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

// eslint-disable-next-line no-console
console.log('花字特效系统初始化成功');
// eslint-disable-next-line no-console
console.log('可用特效配置:', ['none', 'single-stroke', 'multi-stroke', 'gradient', 'shadow', 'texture']);
