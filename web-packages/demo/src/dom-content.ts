import { Player, SpriteComponent } from '@galacean/effects';
import '@galacean/effects-plugin-dom-content';
import { renderDOMToImage } from '@galacean/effects-plugin-dom-content';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*jLzdSZGQa4UAAAAAQGAAAAgAelB4AQ';
const iconUrl = 'https://mdn.alipayobjects.com/huamei_islskw/afts/img/A*dz8cSJCod9AAAAAATcAAAAgAevb0AQ/original';
const container = document.getElementById('J-container');

/**
 * 将图片 URL 转为 base64 data URL（foreignObject 不允许加载外部资源）
 */
async function imageUrlToBase64 (url: string): Promise<string> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  }
  const blob = await res.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => { resolve(reader.result as string); };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface CardConfig {
  name: string,
  width: number,
  height: number,
  html: string,
}

(async () => {
  try {
    const iconBase64 = await imageUrlToBase64(iconUrl);

    const cardConfigs: CardConfig[] = [
      {
        name: 'place_holder',
        width: 300,
        height: 400,
        html: `<div style="width:300px;height:400px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;padding:20px;color:white;font-family:sans-serif;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
  <h2 style="margin:0 0 8px 0;font-size:20px;">恭喜获得</h2>
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
        html: `<div style="width:100px;height:100px;display:flex;justify-content:center;align-items:center;background:#1a1a2e;border-radius:16px;overflow:hidden;">
  <img src="${iconBase64}" style="width:100px;height:100px;object-fit:cover;" />
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

      const image = await renderDOMToImage(cfg.html, cfg.width, cfg.height, dpr);
      const canvas = document.createElement('canvas');

      canvas.width = cfg.width * dpr;
      canvas.height = cfg.height * dpr;
      const ctx = canvas.getContext('2d')!;

      ctx.drawImage(image, 0, 0, cfg.width * dpr, cfg.height * dpr);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => {
          if (b) { resolve(b); } else { reject(new Error('toBlob failed')); }
        }, 'image/png');
      });
      const url = URL.createObjectURL(blob);

      await sprite.setTexture(url);
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.error('biz', e);
  }
})();
