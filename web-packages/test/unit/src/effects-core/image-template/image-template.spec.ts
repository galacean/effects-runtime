import { Player, combineImageTemplate, loadImage, spec } from '@galacean/effects';

const { expect } = chai;

describe('Image template', async () => {
  const container = document.createElement('div');

  after(() => {
    container?.remove();
  });

  it('设置动态文本不会报错', async () => {
    const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*MZzPRZiQw0MAAAAAAAAAAAAADlB4AQ';
    const player = new Player({
      container,
    });

    await player.loadScene(json, {
      variables: {
        'name': 'GE',
      },
    });

    player?.dispose();
  });

  it('老数据模版设置动态文本不会报错', async () => {
    const json = { 'compositionId':3, 'requires':['path', 'null-item'], 'compositions':[{ 'name':'普通红包', 'id':3, 'duration':1.2, 'endBehavior':1, 'camera':{ 'fov':60, 'far':20, 'near':0.1, 'z':8, 'position':[0, 0, 2.000000000000005], 'rotation':[0, 0, 0] }, 'items':[{ 'name':'背景', 'delay':0, 'id':3, 'sprite':{ 'options':{ 'startLifetime':2, 'startSize':2.0999999999999996, 'sizeAspect':1.0487012987012987, 'startColor':['color', [255, 255, 255]], 'duration':1.2, 'gravityModifier':1 }, 'renderer':{ 'renderMode':1, 'texture':0 }, 'splits':[[0.001953125, 0.001953125, 0.5859375, 0.55859375, 0]] } }, { 'name':'1', 'delay':0.2, 'id':4, 'sprite':{ 'options':{ 'startLifetime':2, 'startSize':0.4, 'sizeAspect':1, 'startColor':['color', [255, 255, 255]], 'duration':1, 'gravityModifier':1 }, 'renderer':{ 'renderMode':1, 'texture':0 }, 'transform':{ 'path':['path', [[[0, 0, 1, 3.08], [1, 1, 0.04, 1]], [[-0.47720300782204106, 0.08367395205646666, 0], [-0.841184699267675, 0.17153160171575887, 0]]]] }, 'splits':[[0.591796875, 0.25390625, 0.25390625, 0.25390625, 0]] } }, { 'name':'2', 'delay':0.2, 'id':5, 'sprite':{ 'options':{ 'startLifetime':2, 'startSize':0.5, 'sizeAspect':0.9621212121212122, 'startColor':['color', [255, 255, 255]], 'duration':1, 'gravityModifier':1 }, 'renderer':{ 'renderMode':1, 'texture':0 }, 'transform':{ 'path':['path', [[[0, 0, 1, 3.56], [1, 1, 0.09, 1]], [[0.37208760555110487, 0.050204371233880885, 0], [0.7904573658334417, 0.10877613767340755, 0]]]] }, 'splits':[[0.591796875, 0.001953125, 0.248046875, 0.2578125, 1]] } }, { 'name':'3', 'delay':0.2, 'id':6, 'sprite':{ 'options':{ 'startLifetime':2, 'startSize':0.5, 'sizeAspect':1.0373831775700935, 'startColor':['color', [255, 255, 255]], 'duration':1, 'gravityModifier':1 }, 'renderer':{ 'renderMode':1, 'texture':0 }, 'transform':{ 'path':['path', [[[0, 0, 1, 3.29], [1, 1, 0.03, 1]], [[-0.4435373800124822, -0.27194033620375013, 0], [-0.744763607415766, -0.28135365581010274, 0]]]] }, 'splits':[[0.001953125, 0.75, 0.234375, 0.2265625, 1]] } }, { 'name':'4', 'delay':0.2, 'id':7, 'sprite':{ 'options':{ 'startLifetime':2, 'startSize':0.5, 'sizeAspect':1, 'startColor':['color', [255, 255, 255]], 'duration':1, 'gravityModifier':1 }, 'renderer':{ 'renderMode':1, 'texture':0 }, 'transform':{ 'path':['path', [[[0, 0, 1, 3.39], [1, 1, 0.13, 1]], [[0.3503192401232553, -0.19035823294869414, 0], [0.7927452616218282, -0.1370160885126961, 0]]]] }, 'splits':[[0.591796875, 0.51171875, 0.234375, 0.234375, 0]] } }, { 'name':'5', 'delay':0.2, 'id':8, 'sprite':{ 'options':{ 'startLifetime':2, 'startSize':0.4, 'sizeAspect':1.0166666666666666, 'startColor':['color', [255, 255, 255]], 'duration':1, 'gravityModifier':1 }, 'renderer':{ 'renderMode':1, 'texture':1 }, 'transform':{ 'path':['path', [[[0, 0, 1, 3.54], [1, 1, 0.05, 1]], [[-0.2364443486727248, 0.40268090225152053, 0], [-0.7384880610115307, 0.7070449028569219, 0]]]] }, 'splits':[[0.783203125, 0.248046875, 0.119140625, 0.1171875, 0]] } }, { 'name':'6', 'delay':0.2, 'id':9, 'sprite':{ 'options':{ 'startLifetime':2, 'startSize':0.4, 'sizeAspect':1.24, 'startColor':['color', [255, 255, 255]], 'duration':1, 'gravityModifier':1 }, 'renderer':{ 'renderMode':1, 'texture':1 }, 'transform':{ 'path':['path', [[[0, 0, 1, 3.06], [1, 1, -0.02, 1]], [[0.23108385844278878, 0.3838542630388153, 0], [0.8492251792599439, 0.7949025525162132, 0]]]] }, 'splits':[[0.783203125, 0.001953125, 0.2421875, 0.1953125, 1]] } }, { 'name':'null_4', 'delay':0, 'id':10, 'cal':{ 'options':{ 'duration':1.2 }, 'addition':{ 'borderColor':['color', '#5fdde5'] }, 'rotationOverLifetime':{ 'angularVelocity':0, 'asRotation':true, 'separateAxes':true, 'y':['curve', [[0, 0, 0, -3.3886], [0.435, -173.4141, 0.0233, 0], [0.5958, -180, 0, 0], [1, -180, -0.05, 0]]] }, 'sizeOverLifetime':{ 'size':['curve', [[0, 0.4, 1, 6.3], [0.27, 0.922, 0.61, 0.54], [1, 1, 0, 1]]] }, 'transform':{ 'position':[0, 0.15, 0] } }, 'refCount':4 }, { 'name':'超级果粉日', 'delay':0, 'id':11, 'parentId':10, 'sprite':{ 'options':{ 'startLifetime':2, 'startSize':1.2, 'sizeAspect':0.8396624472573839, 'startColor':['color', [255, 255, 255]], 'duration':1.2, 'gravityModifier':1 }, 'renderer':{ 'renderMode':1, 'texture':1 }, 'colorOverLifetime':{ 'opacity':['lines', [[0, 1], [0.2208, 1], [0.2208, 0], [1, 0]]] }, 'splits':[[0.001953125, 0.001953125, 0.77734375, 0.92578125, 0]] } }, { 'name':'红包', 'delay':0, 'id':12, 'parentId':10, 'sprite':{ 'options':{ 'startLifetime':2, 'startSize':1.2, 'sizeAspect':0.8396624472573839, 'startColor':['color', [255, 255, 255]], 'duration':1.2, 'gravityModifier':1 }, 'renderer':{ 'renderMode':1, 'texture':2 }, 'transform':{ 'rotation':[0, 180, 0], 'position':0 }, 'colorOverLifetime':{ 'opacity':['lines', [[0, 0], [0.2231, 0], [0.2315, 1], [1, 1]]] }, 'splits':[[0.001953125, 0.001953125, 0.77734375, 0.92578125, 0]] } }, { 'name':'马上用 控制', 'delay':0, 'id':14, 'sprite':{ 'options':{ 'duration':1.2, 'startLifetime':2, 'startSize':0.5, 'sizeAspect':4.673469387755102, 'startColor':['color', [255, 255, 255]], 'gravityModifier':1 }, 'transform':{ 'position':[0, -0.7000000000000003, 0] }, 'sizeOverLifetime':{ 'size':['curve', [[0, 0, 0, 0.001], [0.1946, 0, 0, 0], [0.4981, 1.47, 0, -1.2587], [0.6315, 1.47, -0.0326, -0.8188], [0.7589, 1.47, -0.2131, 0], [1, 1.47, 0.0192, 0]]] }, 'renderer':{ 'renderMode':1, 'texture':2 }, 'splits':[[0.783203125, 0.001953125, 0.89453125, 0.19140625, 1]] } }, { 'name':'金额', 'delay':0, 'id':15, 'parentId':10, 'sprite':{ 'options':{ 'startLifetime':2, 'startSize':0.7, 'sizeAspect':2.622950819672131, 'startColor':['color', [255, 255, 255]], 'duration':2, 'gravityModifier':1 }, 'renderer':{ 'renderMode':1, 'texture':3, 'side':1028 }, 'transform':{ 'position':[0, 0.3, 0], 'rotation':[0, 180, 0] } } }] }], 'gltf':[], 'images':[{ 'compressed':{ 'iOS':'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/WYAYSNUSYIOM/70dc54fcfa723a624b030f676a60d5dc_i-ec525.ktx', 'android':'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/WYAYSNUSYIOM/70dc54fcfa723a624b030f676a60d5dc_a-1c910.ktx' }, 'url':'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/WYAYSNUSYIOM/e70d202490c431a61fd50373e325525a-61057.png' }, { 'compressed':{ 'iOS':'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/WYAYSNUSYIOM/8331b98ed19ab9532f31a6cd42bb993c_i-6a1e4.ktx', 'android':'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/WYAYSNUSYIOM/8331b98ed19ab9532f31a6cd42bb993c_a-056fe.ktx' }, 'url':'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/WYAYSNUSYIOM/09a39b8bdeec22fa8ce0c772590dd3c2-8f384.png' }, { 'compressed':{ 'iOS':'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/WYAYSNUSYIOM/0c4ca2de5f5e53ba2d7cfbf6f3fe826d_i-c5b91.ktx', 'android':'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/WYAYSNUSYIOM/0c4ca2de5f5e53ba2d7cfbf6f3fe826d_a-bfeee.ktx' }, 'url':'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/WYAYSNUSYIOM/bca767172af6efa7d60397793df9c607-ab0a2.png' }, { 'template':{ 'content':'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="248px" height="128px" viewBox="0 0 310 122" version="1.1"> <defs> <filter x="-24.9%" y="-20.4%" width="149.9%" height="140.8%" filterUnits="objectBoundingBox" id="filter-1"> <feOffset dx="0" dy="15" in="SourceAlpha" result="shadowOffsetOuter1"/> <feGaussianBlur stdDeviation="14.5" in="shadowOffsetOuter1" result="shadowBlurOuter1"/> <feColorMatrix values="0 0 0 0 1 0 0 0 0 0.182564787 0 0 0 0 0.524874714 0 0 0 0.347109921 0" type="matrix" in="shadowBlurOuter1" result="shadowMatrixOuter1"/> <feMerge> <feMergeNode in="shadowMatrixOuter1"/> <feMergeNode in="SourceGraphic"/> </feMerge> </filter> <linearGradient x1="50%" y1="24.1282598%" x2="50%" y2="81.6164484%" id="linearGradient-2"> <stop stop-color="#FFFFFF" offset="0%"/> <stop stop-color="#FFE2FB" offset="100%"/> </linearGradient> <text id="text-3" text-anchor="middle" font-family="Futura-MediumItalic, Futura" font-size="84.4016045" font-style="italic" font-weight="400" letter-spacing="-6"> <tspan x="62" y="88">$amount$</tspan> </text> <filter x="-7.5%" y="-5.9%" width="116.8%" height="115.5%" filterUnits="objectBoundingBox" id="filter-4"> <feOffset dx="0" dy="2" in="SourceAlpha" result="shadowOffsetOuter1"/> <feGaussianBlur stdDeviation="2.5" in="shadowOffsetOuter1" result="shadowBlurOuter1"/> <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.201376748 0" type="matrix" in="shadowBlurOuter1"/> </filter> <linearGradient x1="50%" y1="42.6783569%" x2="50%" y2="83.8142318%" id="linearGradient-5"> <stop stop-color="#FFFFFF" offset="0%"/> <stop stop-color="#FFC7FE" offset="100%"/> </linearGradient> <text id="text-6" font-family="PingFangSC-Regular, PingFang SC" font-size="50" font-weight="normal"> <tspan x="139" y="81">元红包</tspan> </text> <filter x="-5.7%" y="-9.4%" width="111.5%" height="210.1%" filterUnits="objectBoundingBox" id="filter-7"> <feOffset dx="0" dy="2" in="SourceAlpha" result="shadowOffsetOuter1"/> <feGaussianBlur stdDeviation="2.5" in="shadowOffsetOuter1" result="shadowBlurOuter1"/> <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.271607299 0" type="matrix" in="shadowBlurOuter1"/> </filter> </defs> <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="编组-37备份-9" transform="translate(-167.000000, -154.000000)" fill-rule="nonzero"> <g id="编组-34" filter="url(#filter-1)" transform="translate(151.000000, 44.000000)"> <g id="位图" transform="translate(0.000000, 0.526592)"> <g id="编组-30" transform="translate(39.000000, 98.473408)"> <g id="0.6"> <use fill="#D8D8D8" fill-opacity="1" filter="url(#filter-4)" xlink:href="#text-3"/> <use fill="url(#linearGradient-2)" xlink:href="#text-3"/> <use fill="#D8D8D8" fill-opacity="1" xlink:href="#text-3"/> </g> <g id="元红包"> <use fill="#D8D8D8" fill-opacity="1" filter="url(#filter-7)" xlink:href="#text-6"/> <use fill="url(#linearGradient-5)" xlink:href="#text-6"/> <use fill="#D8D8D8" fill-opacity="1" xlink:href="#text-6"/> </g> </g> </g> </g> </g> </g> </svg>', 'width':248, 'height':128, 'backgroundWidth':256, 'backgroundHeight':128, 'variables':{ 'amount':'0.66' } }, 'url':'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/WYAYSNUSYIOM/9bf31c7ff062936a96d3c8bd1f8f2ff3_3-2ecd2.png' }], 'version':'0.2.22-beta.19', '_imgs':{ '3':[0, 1, 2, 3] } };
    const player = new Player({
      container,
    });

    await player.loadScene(json, {
      variables: {
        'amount': '99.00',
      },
    });

    player?.dispose();
  });

  it('测试 template background 的 url 无效', async () => {
    // 1. 使用 canvas 绘制图片并得到 imageData
    // 30x30 背景图
    const url1 = 'https://gw.alipayobjects.com/zos/gltf-asset/69720573582093/test.jpg';
    const { canvas: canvas1, imageData: imageData1, width, height } = await getImageDataByUrl(url1);

    // 2. 使用 canvas 绘制动态图片并得到 imageData
    const template = {
      width: 30,
      height: 30,
      variables: {},
      background: {
        type: spec.BackgroundType.image,
        name: 'test',
        url: '',
      },
    };
    const image2 = await combineImageTemplate(url1, template, {}) as HTMLImageElement;
    const { canvas: canvas2, imageData: imageData2 } = await getImageDataByUrl(image2);

    // 3. 对比
    const pixels = width * height;

    for (let i = 0; i < pixels; ++i) {
      const index = i * 4;

      for (let j = 0; j < 3; ++j) {
        const b = imageData1[index + j];
        const a = imageData2[index + j];

        expect(a).to.eql(b);
      }
    }

    canvas1.remove();
    canvas2.remove();
  });

  it('测试 template 换图成功', async () => {
    // 1. 通过 canvas 绘制原始图片，获得 imageData
    const url1 = 'https://mdn.alipayobjects.com/mars/afts/img/A*JKibRacHibcAAAAAAAAAAAAADlB4AQ/original';
    const { canvas: canvas1, imageData: imageData1 } = await getImageDataByUrl(url1);

    // 2. 通过 template 动画换图并使用 canvas 绘制结果，获得 imageData
    const url2 = 'https://mdn.alipayobjects.com/huamei_uj3n0k/afts/img/A*oelLS68rL4kAAAAAAAAAAAAADt_KAQ/original';
    const template = {
      width: 179,
      height: 194,
      variables: {},
      background: {
        type: spec.BackgroundType.image,
        name: 'test',
        url: '',
      },
    };
    const image2 = await combineImageTemplate(
      url2,
      template,
      {
        'test': url1,
      }
    ) as HTMLImageElement;
    const { canvas: canvas2, imageData: imageData2 } = await getImageDataByUrl(image2);

    // 3. 对比
    const pixels = image2.width * image2.height;

    for (let i = 0; i < pixels; ++i) {
      const index = i * 4;

      for (let j = 0; j < 3; ++j) {
        const a = imageData1[index + j];
        const b = imageData2[index + j];

        expect(a).to.eql(b);
      }
    }

    canvas1.remove();
    canvas2.remove();
  });
});

async function getImageDataByUrl (url: string | HTMLImageElement) {
  const image = url instanceof HTMLImageElement ? url : await loadImage(url);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  const { width, height } = image;

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height).data;

  return { canvas, imageData, width, height };
}
