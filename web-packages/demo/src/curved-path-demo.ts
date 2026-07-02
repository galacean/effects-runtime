import { Player, spec, GraphicsPath } from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';

const container = document.getElementById('J-container')!;
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*tm1aQbfgVYkAAAAAQDAAAAgAelB4AQ';

let richText: RichTextComponent | undefined;
const status = document.getElementById('status')!;
const set = (s: string) => { status.textContent = s; };

// ========== 预设路径（引擎 GraphicsPath 链式 API）==========
// 坐标量级 ~200，与 demo json 的 frameW 匹配，避免 canvas 锚路径全域后元素横跨屏幕。
const presets: Record<string, () => GraphicsPath> = {
  line: () => new GraphicsPath().moveTo(0, 0).lineTo(200, 0),
  arc: () => new GraphicsPath().moveTo(0, 0).bezierCurveTo(60, 40, 140, 40, 200, 0),
  convex: () => new GraphicsPath().moveTo(0, 0).bezierCurveTo(60, -40, 140, -40, 200, 0),
  wave: () => new GraphicsPath()
    .moveTo(0, 0)
    .bezierCurveTo(40, 32, 80, -32, 120, 0)
    .bezierCurveTo(160, 32, 200, -32, 240, 0),
  s: () => new GraphicsPath().moveTo(0, 0).bezierCurveTo(60, 48, 140, -48, 200, 0),
};

// ========== 路径文本模式（Figma 同款：自带默认闭合圆）==========
document.getElementById('path-mode-on')!.onclick = () => {
  if (richText) {
    richText.setCurvedPath(null);   // 清自定义曲线,用默认圆
    richText.setPathMode(true);
    set('路径文本模式开启 → 默认闭合圆,文字沿圆排');
  }
};

document.getElementById('path-mode-off')!.onclick = () => {
  if (richText) {
    richText.setPathMode(false);
    set('路径文本模式关闭 → 回普通富文本');
  }
};

document.querySelectorAll<HTMLButtonElement>('button.preset').forEach(btn => {
  btn.onclick = () => {
    const key = btn.dataset.preset!;
    const path = presets[key]();

    if (richText) {
      richText.setCurvedPath(path);
      // drawPathOverlay(path); // 暂关,看 canvas 内红线
      document.querySelectorAll('button.preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      set(`setCurvedPath("${key}") → 文字沿该路径排,逐字旋转贴切线`);
    }
  };
});

// ========== 手动画路径 ==========
let drawMode = false;
let drawnPoints: Array<{ x: number, y: number }> = [];
const drawBtn = document.getElementById('draw-mode')!;

drawBtn.onclick = () => {
  drawMode = !drawMode;
  drawBtn.textContent = drawMode ? '退出画路径(点击加点)' : '进入画路径模式';
  drawBtn.classList.toggle('active', drawMode);
  if (drawMode) {
    drawnPoints = [];
    set('画路径模式：在画布上点击加点(≥2 个点自动生成贝塞尔路径)');
  }
};

container.addEventListener('click', e => {
  if (!drawMode) { return; }
  const rect = container.getBoundingClientRect();
  const cx = e.clientX - rect.left - rect.width / 2;
  // canvas y 下正(与 overlay/字渲染同方向),原点屏幕中心
  const cy = e.clientY - rect.top - rect.height / 2;

  drawnPoints.push({ x: cx, y: cy });

  if (drawnPoints.length >= 2) {
    const path = new GraphicsPath();
    const pts = drawnPoints;

    // Catmull-Rom 风格平滑：每段贝塞尔控制点由前后点切线方向推出，自然成弧而非折线
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];       // 前一点(首段用自身)
      const p1 = pts[i];                      // 段起点
      const p2 = pts[i + 1];                  // 段终点
      const p3 = pts[i + 2] ?? p2;           // 后一点(末段用终点)
      // 控制点 = 端点 ± (后点-前点)/6（Catmull-Rom 转 cubic bezier 标准系数）
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;

      path.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
    }
    if (richText) {
      richText.setCurvedPath(path);
      // drawPathOverlay(path); // 暂关,看 canvas 内红线
      set(`手动画路径：${pts.length} 个点,文字沿路径排`);
    }
  } else {
    set(`已点 ${drawnPoints.length} 个点,继续点击(≥2 生效)`);
  }
});

document.getElementById('clear-draw')!.onclick = () => {
  drawnPoints = [];
  if (richText) {
    richText.setCurvedPath(null);
    // drawPathOverlay(null); // 暂关
    document.querySelectorAll('button.preset').forEach(b => b.classList.remove('active'));
    set('已清除路径 → 直线横排');
  }
};

// ========== 文本 ==========
const textInput = document.getElementById('text-input') as HTMLInputElement;

document.getElementById('apply-text')!.onclick = () => {
  if (richText) {
    richText.setText(textInput.value);
    set('文本已更新');
  }
};

// ========== 多段富文本快捷输入(验证 B1 多段双计) ==========
// 富文本含 <b>/<color> 等标签会切成多 segment,验证多段坐标双计修复。
// 文本常量放 TS(不在 HTML data-* 属性里,<color=> 的 = 会撕裂 HTML 解析)。
const multilineTexts: Record<string, string> = {
  bolditalic: '<b>Galacean</b> <i>effects</i>',
  color: '<color=#ff5555>红</color><color=#55ff55>绿</color><color=#5555ff>蓝</color>彩色多段',
};

document.querySelectorAll<HTMLButtonElement>('button.preset-multiline').forEach(btn => {
  btn.onclick = () => {
    const key = btn.dataset.multiline ?? '';
    const text = multilineTexts[key];

    if (text && richText) {
      textInput.value = text;
      richText.setText(text);
      set(`多段文本已应用:${text}`);
    }
  };
});

// ========== 对齐切换(验证 B2 漂移) ==========
document.querySelectorAll<HTMLButtonElement>('button.align').forEach(btn => {
  btn.onclick = () => {
    const align = btn.dataset.align ?? 'left';

    if (richText) {
      richtTextApplyAlign(align);
      document.querySelectorAll('button.align').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      set(`对齐:${align}(验证字是否贴曲线,而非整体漂移)`);
    }
  };
});

function richtTextApplyAlign (align: string): void {
  if (!richText) { return; }
  const map: Record<string, spec.TextAlignment> = {
    left: spec.TextAlignment.left,
    middle: spec.TextAlignment.middle,
    right: spec.TextAlignment.right,
  };

  richText.setTextAlign(map[align] ?? spec.TextAlignment.left);
}

// ========== 字间距 ==========
const lsInput = document.getElementById('letter-space') as HTMLInputElement;
const lsVal = document.getElementById('ls-val')!;

lsInput.addEventListener('input', () => {
  const v = Number(lsInput.value);

  lsVal.textContent = String(v);
  if (richText) {
    richText.textLayout.letterSpace = v;
    richText.isDirty = true;
  }
});

// ========== 启动 ==========
(async () => {
  try {
    const player = new Player({ container });
    const composition = await player.loadScene(json);
    const item = composition.getItemByName('richText_2');

    richText = item?.getComponent(RichTextComponent);
    if (!richText) {
      set('❌ 未找到 richText_2');

      return;
    }
    richText.setOverflow(spec.TextOverflow.visible);
    richText.setText(textInput.value);
    // 强制 sensible 排版配置，消除 json 配置干扰（verticalAlign=top/fixed 会让 baseline 偏移）
    richText.setTextVerticalAlign(spec.TextVerticalAlign.middle);
    richText.textLayout.autoResize = spec.TextSizeMode.autoHeight;
    set('就绪：开启路径文本看默认圆,或预设路径/手动画,拖字间距');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('curved-path-demo', e);
    set(`❌ ${e}`);
  }
})();
