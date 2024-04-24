import { Player, combineImageTemplate, loadImage, spec } from '@galacean/effects';

const { expect } = chai;

describe('Image template', async () => {
  let container: HTMLDivElement | null;
  let player: Player;

  before(() => {
    container = document.createElement('div');
    container.style.width = '300px';
    container.style.height = '200px';
  });

  after(() => {
    player.pause();
    player?.dispose();
    container?.remove();
    container = null;
  });

  it('设置动态文本不会报错', async () => {
    const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*40vJRJf5nAAAAAAAAAAAAAAADlB4AQ';

    player = new Player({
      container,
    });

    await player.loadScene(json);
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

  it('运行时不加载 template 外的 url 和 webp', async () => {
    const json = JSON.parse('{"compositionId":37,"requires":[],"compositions":[{"name":"超级红包","id":37,"duration":4,"endBehavior":2,"camera":{"fov":60,"far":20,"near":0.1,"aspect":null,"clipMode":0,"position":[0,0,8],"rotation":[0,0,0]},"items":[],"startTime":0,"meta":{"previewSize":[750,856]}}],"gltf":[],"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*NNUKRaaQ0M8AAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*Dm4nSrj1HwMAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"},{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*ympoT6SNxk0AAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*qB7eR7z0ORQAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"},{"template":{"v":2,"content":{"fonts":[],"texts":[],"colors":[]},"variables":{"text":"这是         文案","img":"https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*L6tQQbF6oMMAAAAAAAAAAAAADsF2AQ/original"},"width":346,"height":150,"background":{"name":"img","url":"https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*L6tQQbF6oMMAAAAAAAAAAAAADsF2AQ/original"}},"url":"https://x.com","webp":"https://x.com","renderLevel":"B+"}],"spines":[],"version":"0.1.47","shapes":[],"plugins":[],"type":"mars","bins":[],"textures":[{"source":0,"flipY":true},{"source":1,"flipY":true},{"source":2,"flipY":true}]}');
    const spy = chai.spy();

    await player.loadScene(json).catch(e => {
      spy();
    });
    expect(spy).to.not.have.been.called();
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
