import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-dom-content';
import '@galacean/effects-plugin-ffd';
import { DomContentComponent } from '@galacean/effects-plugin-dom-content';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*5BIKSYzA030AAAAAQkAAAAgAelB4AQ';
const iconUrl = 'https://mdn.alipayobjects.com/huamei_islskw/afts/img/A*dz8cSJCod9AAAAAATcAAAAgAevb0AQ/original';
const cardBgUrl = 'https://mdn.alipayobjects.com/huamei_islskw/afts/img/A*4oq-QrC1c1wAAAAAQTAAAAgAevb0AQ/original';
const container = document.getElementById('J-container');

if (!container) {
  throw new Error('Demo container element #J-container not found.');
}

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
        html: `<style>
  .card {
    width: 300px;
    height: 400px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    padding: 20px;
    color: white;
    font-family: sans-serif;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .card svg {
    margin-bottom: 12px;
  }
  .card h2 {
    margin: 0 0 8px 0;
    font-size: 20px;
  }
  .card .amount {
    margin: 0 0 8px 0;
    font-size: 36px;
    font-weight: bold;
  }
  .card .hint {
    margin: 0;
    font-size: 14px;
    opacity: 0.8;
  }
</style>
<div class="card">
  <svg width="120" height="120" viewBox="0 0 120 120">
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
  <h2>恭喜您获得</h2>
  <p class="amount">¥88.88</p>
  <p class="hint">大奖发放中...</p>
</div>`,
      },
      {
        name: 'place_holder_1',
        width: 300,
        height: 100,
        html: `<style>
  .text-card {
    width: 300px;
    height: 100px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border-radius: 16px;
    padding: 16px 20px;
    color: white;
    font-family: Georgia, 'Times New Roman', serif;
    box-sizing: border-box;
  }
  .text-card p {
    margin: 0 0 6px 0;
  }
  .text-card .title {
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 2px;
  }
  .text-card .italic {
    font-size: 14px;
    font-style: italic;
  }
  .text-card .underline {
    font-size: 13px;
    text-decoration: underline;
  }
  .text-card .strikethrough {
    font-size: 13px;
    text-decoration: line-through;
    opacity: 0.7;
  }
  .text-card .small-caps {
    font-size: 12px;
    font-variant: small-caps;
    letter-spacing: 3px;
  }
</style>
<div class="text-card">
  <p class="title">Serif Bold</p>
  <p class="italic">Italic Style Text</p>
  <p class="underline">Underline Decoration</p>
  <p class="strikethrough">Strikethrough Text</p>
  <p class="small-caps">Small Caps Style</p>
</div>`,
      },
      {
        name: 'place_holder_2',
        width: 100,
        height: 100,
        // 直接使用外部 URL，inlineImageSources 会自动转为 base64
        html: `<style>
  .image-card {
    width: 100px;
    height: 100px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #1a1a2e;
    border-radius: 16px;
    overflow: hidden;
  }
  .image-card img {
    width: 100px;
    height: 100px;
    object-fit: cover;
  }
</style>
<div class="image-card">
  <img src="${iconUrl}" />
</div>`,
      },
      // @font-face 内联字体 + CSS url(#id) 引用宿主文档 SVG 定义
      {
        name: 'place_holder_3',
        width: 300,
        height: 330,
        html: `<style>
  @font-face {
    font-family: 'Pacifico';
    font-style: normal;
    font-weight: 400;
    src: url('https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.woff2') format('woff2');
  }
  .font-card {
    width: 300px;
    height: 330px;
    background: linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
    border-radius: 16px;
    padding: 28px 24px 20px;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .font-card .glow-title {
    font-family: 'Pacifico', cursive;
    font-size: 42px;
    color: #fff;
    margin: 0 0 6px 0;
    filter: url(#ph3-glow);
  }
  .font-card .subtitle {
    font-size: 15px;
    color: rgba(255,255,255,0.7);
    margin: 0 0 24px 0;
    letter-spacing: 2px;
  }
  .font-card .benefit-box {
    background: rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 16px 20px;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
    clip-path: url(#ph3-clip);
  }
  .font-card .amount {
    font-family: 'Pacifico', cursive;
    font-size: 48px;
    color: #FFD700;
    margin: 0 0 4px 0;
    filter: url(#ph3-text-shadow);
    line-height: 1.2;
  }
  .font-card .amount .unit {
    font-size: 20px;
    color: #FFECB3;
  }
  .font-card .desc {
    font-size: 13px;
    color: rgba(255,255,255,0.6);
    margin: 0;
  }
  .font-card .divider {
    width: 200px;
    height: 2px;
    background: url(#ph3-grad);
    margin: 20px 0 16px;
  }
  .font-card .footer {
    font-size: 12px;
    color: rgba(255,255,255,0.45);
    margin: 0;
  }
</style>
<div class="font-card">
  <p class="glow-title">Lucky</p>
  <p class="subtitle">NEW YEAR REWARDS</p>
  <div class="benefit-box">
    <p class="amount">$88<span class="unit">.88</span></p>
    <p class="desc">Min. spend $88.89  Valid 30 days</p>
  </div>
  <div class="divider"></div>
  <p class="footer">View in [Wallet]</p>
</div>`,
      },
      // 电影券红包 - 复刻参考图文字排版
      {
        name: 'place_holder_4',
        width: 300,
        height: 330,
        html: `<style>
  .coupon-card {
    position: relative;
    width: 300px;
    height: 330px;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', sans-serif;
    box-sizing: border-box;
    overflow: hidden;
  }
  .coupon-card .bg-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 300px;
    height: 330px;
    object-fit: cover;
    z-index: 0;
  }
  .coupon-card .content {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 20px 20px 20px;
    display: flex;
    flex-direction: column;
  }
  .coupon-card .title {
    font-size: 22px;
    font-weight: 600;
    color: #ffffff;
    margin: 0 0 4px 0;
    text-align: left;
    position: relative;
    left: 3px;
  }
  .coupon-card .subtitle {
    font-size: 36px;
    font-weight: 800;
    color: #FFF29B;
    margin: 0 0 20px 0;
    text-align: left;
    line-height: 1.2;
  }
  .coupon-card .coupon-box {
    border-radius: 12px;
    padding: 14px 16px 12px;
    text-align: center;
  }
  .coupon-card .coupon-name {
    font-size: 15px;
    color: #A41616;
    margin: 0 0 8px 0;
    font-weight: 500;
    position: relative;
    top: -15px;
  }
  .coupon-card .coupon-amount {
    font-size: 50px;
    font-weight: 800;
    color: #e8294a;
    margin: 0;
    line-height: 1.2;
    position: relative;
    top: -8px;
  }
  .coupon-card .coupon-amount .unit {
    font-size: 22px;
    font-weight: 700;
  }
  .coupon-card .coupon-detail {
    font-size: 13px;
    color: #e8294a;
    margin: 6px 0 0 0;
    position: relative;
    top: -10px;
  }
  .coupon-card .divider {
    width: 100%;
    height: 1px;
    background: #eee;
    margin: 12px 0;
  }
  .coupon-card .footer-text {
    font-size: 12px;
    color: #FF1A47;
    margin: 0;
    text-align: center;
    position: relative;
    top: -10px;
  }
  .coupon-card .link-text {
    font-size: 12px;
    color: #FFB9B9;
    margin: 16px 0 0 0;
    text-align: center;
    font-weight: 500;
    position: relative;
    top: -16px;
  }
</style>
<div class="coupon-card">
  <img class="bg-image" src="${cardBgUrl}" />
  <div class="content">
    <p class="title">恭喜！</p>
    <p class="subtitle">兑换成功</p>
    <div class="coupon-box">
      <p class="coupon-name">电影券红包</p>
      <p class="coupon-amount">15.00<span class="unit">元</span></p>
      <p class="coupon-detail">满15.01元使用  30天有效</p>
      <div class="divider"></div>
      <p class="footer-text">【支付宝-卡包】可查看</p>
    </div>
    <p class="link-text">查看鲸探马年限定福礼 ></p>
  </div>
</div>`,
      },
      // 卡片5：会员积分通知 - 双标题+图标左对齐
      {
        name: 'place_holder_5',
        width: 300,
        height: 330,
        html: `<style>
  .member-card {
    position: relative;
    width: 300px;
    height: 330px;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', sans-serif;
    box-sizing: border-box;
    overflow: hidden;
  }
  .member-card .bg-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 300px;
    height: 330px;
    object-fit: cover;
    z-index: 0;
  }
  .member-card .content {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 20px 20px 20px;
    display: flex;
    flex-direction: column;
  }
  .member-card .header-row {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
  }
  .member-card .badge {
    width: 36px;
    height: 36px;
    background: #FFF29B;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    margin-right: 10px;
  }
  .member-card .title {
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    text-align: left;
  }
  .member-card .subtitle {
    font-size: 32px;
    font-weight: 800;
    color: #FFF29B;
    margin: 0 0 16px 0;
    text-align: left;
    line-height: 1.2;
  }
  .member-card .coupon-box {
    border-radius: 12px;
    padding: 14px 16px 12px;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
  }
  .member-card .coupon-name {
    font-size: 15px;
    color: #333;
    margin: 0 0 8px 0;
    font-weight: 500;
    position: relative;
    top: -12px;
  }
  .member-card .coupon-amount {
    font-size: 44px;
    font-weight: 800;
    color: #ffc400;
    margin: 0;
    line-height: 1.2;
  }
  .member-card .coupon-amount .unit {
    font-size: 20px;
    font-weight: 700;
  }
  .member-card .coupon-detail {
    font-size: 12px;
    color: #996a00;
    margin: 6px 0 0 0;
  }
  .member-card .divider {
    width: 100%;
    height: 1px;
    background: #eee;
    margin: 12px 0;
  }
  .member-card .footer-text {
    font-size: 12px;
    color: #FF1A47;
    margin: 0;
    text-align: center;
  }
  .member-card .link-text {
    font-size: 12px;
    color: #FFB9B9;
    margin: 14px 0 0 0;
    text-align: center;
    font-weight: 500;
  }
</style>
<div class="member-card">
  <img class="bg-image" src="${cardBgUrl}" />
  <div class="content">
    <div class="header-row">
      <div class="badge">🎁</div>
      <p class="title">签到成功</p>
    </div>
    <p class="subtitle">积分到账</p>
    <div class="coupon-box">
      <p class="coupon-name">会员积分</p>
      <p class="coupon-amount">+288<span class="unit">积分</span></p>
      <p class="coupon-detail">连续签到7天  可翻倍奖励</p>
      <div class="divider"></div>
      <p class="footer-text">【会员中心】可查看</p>
    </div>
    <p class="link-text">去积分商城兑换好礼 ></p>
  </div>
</div>`,
      },
      // 卡片6：外卖红包 - 三行标题层次居中
      {
        name: 'place_holder_6',
        width: 300,
        height: 330,
        html: `<style>
  .food-card {
    position: relative;
    width: 300px;
    height: 330px;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', sans-serif;
    box-sizing: border-box;
    overflow: hidden;
  }
  .food-card .bg-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 300px;
    height: 330px;
    object-fit: cover;
    z-index: 0;
  }
  .food-card .content {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 22px 20px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .food-card .title-row {
    text-align: center;
  }
  .food-card .title {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin: 0 0 4px 0;
    text-align: center;
  }
  .food-card .subtitle {
    font-size: 28px;
    font-weight: 800;
    color: #FFF29B;
    margin: 0 0 4px 0;
    text-align: center;
    line-height: 1.2;
  }
  .food-card .third-title {
    font-size: 14px;
    font-weight: 500;
    color: #A41616;
    margin: 0 0 18px 0;
    text-align: center;
    opacity: 0.9;
    position: relative;
    top: 26px;
  }
  .food-card .coupon-box {
    border-radius: 12px;
    padding: 14px 16px 12px;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
  }
  .food-card .coupon-name {
    font-size: 15px;
    color: #333;
    margin: 0 0 8px 0;
    font-weight: 500;
  }
  .food-card .coupon-amount {
    font-size: 48px;
    font-weight: 800;
    color: #ff9a56;
    margin: 0;
    line-height: 1.2;
  }
  .food-card .coupon-amount .unit {
    font-size: 22px;
    font-weight: 700;
  }
  .food-card .coupon-detail {
    font-size: 12px;
    color: #cc7a00;
    margin: 6px 0 0 0;
  }
  .food-card .divider {
    width: 100%;
    height: 1px;
    background: #eee;
    margin: 12px 0;
  }
  .food-card .footer-text {
    font-size: 12px;
    color: #FF1A47;
    margin: 0;
    text-align: center;
  }
  .food-card .link-text {
    font-size: 12px;
    color: #FFB9B9;
    margin: 14px 0 0 0;
    text-align: center;
    font-weight: 500;
  }
</style>
<div class="food-card">
  <img class="bg-image" src="${cardBgUrl}" />
  <div class="content">
    <div class="title-row">
      <p class="title">恭喜您！</p>
      <p class="subtitle">红包到账</p>
      <p class="third-title">外卖天天红包</p>
    </div>
    <div class="coupon-box">
      <p class="coupon-amount">8.88<span class="unit">元</span></p>
      <p class="coupon-detail">满20元使用  今日有效</p>
      <div class="divider"></div>
      <p class="footer-text">【外卖订单】可使用</p>
    </div>
    <p class="link-text">立即点外卖享优惠 ></p>
  </div>
</div>`,
      },
      // 卡片7：打车券 - 标题左+链接右不对称布局
      {
        name: 'place_holder_7',
        width: 300,
        height: 330,
        html: `<style>
  .ride-card {
    position: relative;
    width: 300px;
    height: 330px;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', sans-serif;
    box-sizing: border-box;
    overflow: hidden;
  }
  .ride-card .bg-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 300px;
    height: 330px;
    object-fit: cover;
    z-index: 0;
  }
  .ride-card .content {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 20px 20px 20px;
    display: flex;
    flex-direction: column;
  }
  .ride-card .top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4px;
  }
  .ride-card .title {
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    text-align: left;
  }
  .ride-card .link-text {
    font-size: 12px;
    color: #FFF29B;
    margin: 0;
    font-weight: 500;
  }
  .ride-card .subtitle {
    font-size: 32px;
    font-weight: 800;
    color: #FFF29B;
    margin: 0 0 16px 0;
    text-align: left;
    line-height: 1.2;
  }
  .ride-card .coupon-box {
    border-radius: 12px;
    padding: 14px 16px 12px;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
  }
  .ride-card .coupon-name {
    font-size: 15px;
    color: #333;
    margin: 0 0 8px 0;
    font-weight: 500;
  }
  .ride-card .coupon-amount {
    font-size: 48px;
    font-weight: 800;
    color: #11998e;
    margin: 0;
    line-height: 1.2;
  }
  .ride-card .coupon-amount .unit {
    font-size: 22px;
    font-weight: 700;
  }
  .ride-card .coupon-detail {
    font-size: 12px;
    color: #0d6e5f;
    margin: 6px 0 0 0;
  }
  .ride-card .divider {
    width: 100%;
    height: 1px;
    background: #eee;
    margin: 12px 0;
  }
  .ride-card .footer-text {
    font-size: 12px;
    color: #FF1A47;
    margin: 0;
    text-align: center;
  }
</style>
<div class="ride-card">
  <img class="bg-image" src="${cardBgUrl}" />
  <div class="content">
    <div class="top-row">
      <p class="title">恭喜您！</p>
      <p class="link-text">立即叫车 ></p>
    </div>
    <p class="subtitle">出行券到账</p>
    <div class="coupon-box">
      <p class="coupon-name">打车立减券</p>
      <p class="coupon-amount">15.00<span class="unit">元</span></p>
      <p class="coupon-detail">首单立减15元  7天有效</p>
      <div class="divider"></div>
      <p class="footer-text">【出行中心】可查看</p>
    </div>
  </div>
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

    // 渲染 HTML 为图片并替换纹理
    const dpr = window.devicePixelRatio || 1;

    // 构建 item 名称到 item 的查找表，避免对每个 cfg 重复 O(n) 的 find
    const itemMap = new Map(composition.items.map(i => [i.name, i]));

    for (const cfg of cardConfigs) {
      const item = itemMap.get(cfg.name);

      if (!item) {
        console.warn(`"${cfg.name}" 未找到`);

        continue;
      }

      // 使用 DomContentComponent 自动检测并替换 Sprite 纹理
      const domComponent = item.addComponent(DomContentComponent);

      domComponent.setContent(cfg.html, cfg.width, cfg.height, dpr);
    }
  } catch (e) {
    console.error('biz', e);
  }
})();
