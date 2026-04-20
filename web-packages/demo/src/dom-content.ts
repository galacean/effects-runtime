import { Player, SpriteComponent } from '@galacean/effects';
import '@galacean/effects-plugin-dom-content';
import { inlineImageSources, replaceSpriteTexture } from '@galacean/effects-plugin-dom-content';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*jLzdSZGQa4UAAAAAQGAAAAgAelB4AQ';
const iconUrl = 'https://mdn.alipayobjects.com/huamei_islskw/afts/img/A*dz8cSJCod9AAAAAATcAAAAgAevb0AQ/original';
const container = document.getElementById('J-container');

interface CardConfig {
  name: string,
  width: number,
  height: number,
  html: string,
}

(async () => {
  try {
    const cardConfigs: CardConfig[] = [
      {
        name: 'place_holder',
        width: 300,
        height: 400,
        html: `<div style="width:300px;height:400px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;padding:20px;color:white;font-family:sans-serif;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
  <svg width="120" height="120" viewBox="0 0 120 120" style="margin-bottom:12px;">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffd700"/>
        <stop offset="100%" stop-color="#ff8c00"/>
      </linearGradient>
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.3)"/>
      </filter>
    </defs>
    <circle cx="60" cy="60" r="55" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="6 4"/>
    <circle cx="60" cy="60" r="40" fill="url(#g1)" filter="url(#shadow)"/>
    <polygon points="60,28 66,50 88,50 70,62 76,84 60,72 44,84 50,62 32,50 54,50" fill="white" opacity="0.9"/>
    <circle cx="60" cy="60" r="55" fill="none" stroke="rgba(255,215,0,0.4)" stroke-width="1.5" stroke-dasharray="3 8" transform="rotate(15 60 60)"/>
    <g transform="translate(60,60)">
      <circle cx="-42" cy="-38" r="3" fill="rgba(255,255,255,0.5)"/>
      <circle cx="44" cy="-30" r="2" fill="rgba(255,255,255,0.4)"/>
      <circle cx="-35" cy="42" r="2.5" fill="rgba(255,255,255,0.3)"/>
      <circle cx="40" cy="38" r="2" fill="rgba(255,255,255,0.35)"/>
    </g>
  </svg>
  <h2 style="margin:0 0 8px 0;font-size:20px;">恭喜您获得</h2>
  <p style="margin:0 0 8px 0;font-size:36px;font-weight:bold;">¥88.88</p>
  <p style="margin:0;font-size:14px;opacity:0.8;">大奖发放中...</p>
</div>`,
      },
      {
        name: 'place_holder_1',
        width: 300,
        height: 100,
        html: `<div style="width:300px;height:100px;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);border-radius:16px;padding:16px 20px;color:white;font-family:Georgia,'Times New Roman',serif;box-sizing:border-box;">
  <p style="margin:0 0 6px 0;font-size:18px;font-weight:bold;letter-spacing:2px;">Serif Bold</p>
  <p style="margin:0 0 6px 0;font-size:14px;font-style:italic;">Italic Style Text</p>
  <p style="margin:0 0 6px 0;font-size:13px;text-decoration:underline;">Underline Decoration</p>
  <p style="margin:0 0 6px 0;font-size:13px;text-decoration:line-through;opacity:0.7;">Strikethrough Text</p>
  <p style="margin:0;font-size:12px;font-variant:small-caps;letter-spacing:3px;">Small Caps Style</p>
</div>`,
      },
      {
        name: 'place_holder_2',
        width: 100,
        height: 100,
        // 直接使用外部 URL，inlineImageSources 会自动转为 base64
        html: `<div style="width:100px;height:100px;display:flex;justify-content:center;align-items:center;background:#1a1a2e;border-radius:16px;overflow:hidden;">
  <img src="${iconUrl}" style="width:100px;height:100px;object-fit:cover;" />
</div>`,
      },
    ];

    const player = new Player({
      container,
      onError: err => {
        console.error('biz', err.message);
      },
    });

    const composition = await player.loadScene(json);

    // 收集 placeholder 上的 SpriteComponent
    const spriteMap = new Map<string, SpriteComponent>();

    for (const item of composition.items) {
      const sprite = item.getComponent(SpriteComponent);

      if (sprite) {
        spriteMap.set(item.name, sprite);
      }
    }

    // 渲染 HTML 为图片并替换纹理
    const dpr = window.devicePixelRatio || 1;

    for (const cfg of cardConfigs) {
      const sprite = spriteMap.get(cfg.name);

      if (!sprite) {
        console.warn(`"${cfg.name}" 未找到 SpriteComponent`);

        continue;
      }

      // inlineImageSources 自动将 <img src="https://..."> 转为 base64 内联
      const html = await inlineImageSources(cfg.html);

      await replaceSpriteTexture(sprite, html, cfg.width, cfg.height, dpr);
    }
  } catch (e) {
    console.error('biz', e);
  }
})();
