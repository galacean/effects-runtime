import { Player, TextComponent, spec } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*JFWtS5nXoRAAAAAAQDAAAAgAelB4AQ';
const container = document.getElementById('J-container');

/**
 * 文本渲染测试场景
 * 覆盖 PR #1432 及后续修复的各种边界情况
 */
const testCases = [
  // ========== 基础换行测试 ==========
  {
    name: '测试1: 长英文文本自动换行',
    text: 'This is a long English text that should wrap automatically when it exceeds the container width',
    letterSpace: 0,
    description: '检查换行位置是否正确',
  },
  {
    name: '测试2: 带空格的长文本',
    text: 'The quick brown fox jumps over the lazy dog near the river bank',
    letterSpace: 0,
    description: '检查是否在空格处正确换行',
  },
  {
    name: '测试3: letterSpace > 0 的文本',
    text: 'Hello World Test',
    letterSpace: 10,
    description: '检查 letterSpace 对换行的影响',
  },
  {
    name: '测试4: 文本以换行符结尾',
    text: 'Line1\nLine2\nLine3\n',
    letterSpace: 0,
    description: '检查末尾换行符是否产生空行',
  },

  // ========== Unicode 测试 ==========
  {
    name: '测试5: Emoji 和 Unicode 字符',
    text: 'Hello 👋 世界 🌍 Тест 测试 😊 🎉',
    letterSpace: 0,
    description: '检查 Unicode 字符是否正确显示',
  },
  {
    name: '测试6: 日语和韩语',
    text: 'こんにちは世界\n안녕하세요 세계\n日本語テスト',
    letterSpace: 0,
    description: '检查 CJK 字符渲染',
  },
  {
    name: '测试7: 特殊符号',
    text: '★☆♦♥♠♣\n←↑→↓\n©®™€£¥',
    letterSpace: 0,
    description: '检查特殊符号显示',
  },

  // ========== RTL 测试 ==========
  {
    name: '测试8: 阿拉伯语 RTL',
    text: 'معتمد على الويب تأثيرات غنية، جزيئات أجواء، تأثيرات الجيروسكوب، عرض نماذج ثلاثية الأبعاد استعادة 100%',
    letterSpace: 0,
    description: '检查阿拉伯语 RTL 渲染',
  },
  {
    name: '测试9: 希伯来语 RTL',
    text: 'שלום עולם\nזהו טקסט בעברית',
    letterSpace: 0,
    description: '检查希伯来语 RTL 渲染',
  },
  {
    name: '测试10: RTL 和 LTR 混合',
    text: 'Hello مرحبا World\nمرحبا Hello 世界',
    letterSpace: 0,
    description: '检查混合文本渲染（已知局限）',
  },

  // ========== 边界情况测试 ==========
  {
    name: '测试11: 空文本',
    text: '',
    letterSpace: 0,
    description: '检查空文本处理',
  },
  {
    name: '测试12: 单个字符',
    text: 'A',
    letterSpace: 0,
    description: '检查单个字符渲染',
  },
  {
    name: '测试13: 只有换行符',
    text: '\n\n\n',
    letterSpace: 0,
    description: '检查多个连续换行符',
  },
  {
    name: '测试14: 只有空格',
    text: '     ',
    letterSpace: 0,
    description: '检查只有空格的文本',
  },
  {
    name: '测试15: 连续空格',
    text: 'Hello     World\nTest     Case',
    letterSpace: 0,
    description: '检查连续空格处理',
  },
  {
    name: '测试16: 行首空格',
    text: '  Line1\n  Line2\n  Line3',
    letterSpace: 0,
    description: '检查行首空格处理',
  },
  {
    name: '测试17: 行尾空格',
    text: 'Line1  \nLine2  \nLine3  ',
    letterSpace: 0,
    description: '检查行尾空格处理',
  },

  // ========== 换行边界测试 ==========
  {
    name: '测试18: 超长单词',
    text: 'Supercalifragilisticexpialidocious is a very long word',
    letterSpace: 0,
    description: '检查超长单词换行',
  },
  {
    name: '测试19: 中英文混合换行',
    text: 'Hello 世界\nThis is 第二行\nThird line 第三行',
    letterSpace: 0,
    description: '检查中英文混合换行',
  },
  {
    name: '测试20: 数字和符号混合',
    text: 'Test 123.456\nPhone: +86-138-0000-0000\nEmail: test@example.com',
    letterSpace: 0,
    description: '检查数字符号混合',
  },

  // ========== letterSpace 边界测试 ==========
  {
    name: '测试21: 大 letterSpace',
    text: 'ABC',
    letterSpace: 50,
    description: '检查大 letterSpace 值',
  },
  {
    name: '测试22: letterSpace + 换行',
    text: 'Hello World Test\nSecond Line Here',
    letterSpace: 15,
    description: '检查 letterSpace 与换行组合',
  },
  {
    name: '测试23: letterSpace + RTL',
    text: 'مرحبا عالم',
    letterSpace: 5,
    description: '检查 RTL 文本 letterSpace（不支持）',
  },

  // ========== 复杂场景测试 ==========
  {
    name: '测试24: 多行复杂文本',
    text: '第一行中文\nSecond line English\n第三行混合 Mixed\nLine 4 with numbers 12345\n第五行特殊符号 ★☆♦',
    letterSpace: 0,
    description: '检查多行复杂混合文本',
  },
  {
    name: '测试25: 长文本压力测试',
    text: 'This is a very long text that contains multiple lines and various characters including Chinese 中文 and numbers 123 and symbols ★☆. It should wrap correctly and display all characters properly without any issues.',
    letterSpace: 2,
    description: '检查长文本压力测试',
  },

  // ========== keepWordIntact 测试 ==========
  {
    name: '测试26: keepWordIntact=true（保持单词完整）',
    text: 'This is a long English sentence that demonstrates word-based line breaking behavior',
    letterSpace: 0,
    keepWordIntact: true,
    description: '单词不会从中间断开，在空格处换行',
  },
  {
    name: '测试27: keepWordIntact=false（允许字母中间断开）',
    text: 'This is a long English sentence that demonstrates character-based line breaking behavior',
    letterSpace: 0,
    keepWordIntact: false,
    description: '允许在任意字符处断开，和原来的 LTR 行为一致',
  },
  {
    name: '测试28: keepWordIntact=false + 超长单词',
    text: 'Supercalifragilisticexpialidocious is a very long word that breaks differently',
    letterSpace: 0,
    keepWordIntact: false,
    description: '超长单词在 keepWordIntact=false 时逐字符断开',
  },
];

let currentTestIndex = 0;
let textComponent: TextComponent | undefined;
let player: Player;

// 创建测试控制面板
function createControlPanel () {
  const panel = document.createElement('div');

  panel.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 15px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 14px;
    z-index: 1000;
    max-width: 400px;
    user-select: none;
  `;

  // 拖动功能
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const handleMouseDown = (e: MouseEvent) => {
    // 只有点击标题区域才能拖动
    if ((e.target as HTMLElement).tagName === 'H3' || (e.target as HTMLElement).tagName === 'SPAN') {
      isDragging = true;
      dragOffsetX = e.clientX - panel.offsetLeft;
      dragOffsetY = e.clientY - panel.offsetTop;
      panel.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) { return; }
    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;

    panel.style.left = `${Math.max(0, newX)}px`;
    panel.style.top = `${Math.max(0, newY)}px`;
    panel.style.right = 'auto';
  };

  const handleMouseUp = () => {
    isDragging = false;
    panel.style.cursor = 'default';
  };

  panel.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  const title = document.createElement('h3');

  title.innerHTML = '<span style="cursor: grab;">⋮⋮ 文本渲染测试</span>';
  title.style.margin = '0 0 10px 0';
  title.style.color = '#4fc3f7';
  panel.appendChild(title);

  const infoDiv = document.createElement('div');

  infoDiv.id = 'test-info';
  panel.appendChild(infoDiv);

  const buttonContainer = document.createElement('div');

  buttonContainer.style.marginTop = '10px';

  const prevBtn = document.createElement('button');

  prevBtn.textContent = '◀ 上一个';
  prevBtn.style.marginRight = '10px';
  prevBtn.onclick = () => runTest(currentTestIndex - 1);

  const nextBtn = document.createElement('button');

  nextBtn.textContent = '下一个 ▶';
  nextBtn.onclick = () => runTest(currentTestIndex + 1);

  const autoBtn = document.createElement('button');

  autoBtn.textContent = '自动播放';
  autoBtn.style.marginLeft = '10px';
  autoBtn.onclick = () => autoPlay();

  buttonContainer.appendChild(prevBtn);
  buttonContainer.appendChild(nextBtn);
  buttonContainer.appendChild(autoBtn);
  panel.appendChild(buttonContainer);

  const listDiv = document.createElement('div');

  listDiv.style.marginTop = '15px';
  listDiv.style.fontSize = '12px';

  testCases.forEach((tc, idx) => {
    const item = document.createElement('div');

    item.id = `test-item-${idx}`;
    item.style.cursor = 'pointer';
    item.style.padding = '3px 5px';
    item.style.borderRadius = '3px';
    item.textContent = tc.name;
    item.onclick = () => runTest(idx);
    listDiv.appendChild(item);
  });

  panel.appendChild(listDiv);
  document.body.appendChild(panel);
}

function updateInfo (index: number) {
  const infoDiv = document.getElementById('test-info');
  const tc = testCases[index];

  if (infoDiv && tc) {
    const keepWordIntactValue = tc.keepWordIntact !== false;

    infoDiv.innerHTML = `
      <div style="color: #4fc3f7; font-weight: bold;">${tc.name}</div>
      <div style="margin-top: 5px; color: #aaa;">${tc.description}</div>
      <div style="margin-top: 5px;">
        <span style="color: #888;">letterSpace:</span> ${tc.letterSpace}
        <span style="color: #888; margin-left: 10px;">keepWordIntact:</span> ${keepWordIntactValue}
      </div>
      <div style="margin-top: 5px; word-break: break-all;">
        <span style="color: #888;">文本:</span> "${tc.text.substring(0, 50)}${tc.text.length > 50 ? '...' : ''}"
      </div>
    `;
  }

  // 更新列表高亮
  testCases.forEach((_, idx) => {
    const item = document.getElementById(`test-item-${idx}`);

    if (item) {
      item.style.background = idx === index ? '#4fc3f7' : 'transparent';
    }
  });
}

function runTest (index: number) {
  if (index < 0) { index = testCases.length - 1; }
  if (index >= testCases.length) { index = 0; }

  currentTestIndex = index;
  const tc = testCases[index];

  if (textComponent) {
    textComponent.setText(tc.text);
    // 通过 textLayout 直接设置 letterSpace
    textComponent.textLayout.letterSpace = tc.letterSpace;
    // 设置 keepWordIntact（默认 true）
    textComponent.textLayout.keepWordIntact = tc.keepWordIntact !== false;
    textComponent.isDirty = true;
  }

  updateInfo(index);
}

let autoPlayTimer: number | undefined;

function autoPlay () {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = undefined;

    return;
  }

  autoPlayTimer = window.setInterval(() => {
    runTest(currentTestIndex + 1);
  }, 3000);
}

(async () => {
  try {
    player = new Player({
      container,
    });

    const compostion = await player.loadScene(json);

    const textItem = compostion.getItemByName('text_2');

    textComponent = textItem?.getComponent(TextComponent);

    // 使用 autoHeight 模式，让容器自动适应文本高度
    textComponent?.setAutoResize(spec.TextSizeMode.autoHeight);

    // 创建控制面板
    createControlPanel();

    // 运行第一个测试
    //runTest(0);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('biz', e);
  }
})();