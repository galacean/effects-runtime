// @ts-nocheck
import { combineImageTemplate2, loadImage } from '@galacean/effects';

const { expect } = chai;

describe('Image template V2', async () => {
  // 背景图url
  const imageURL = 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*kqtER7-CHoUAAAAAAAAAAAAAARQnAQ';
  // 字体数组
  const fonts = [
    {
      family: 'courier',
      size: 40,
      weight: 800,
      style: 1,
    },
  ];
  // 文本
  const texts = [
    {
      x: 0,
      y: 0,
      t: 'Hello World!',
      f: 0,
      a: 0,
      c: 0,
      of: 1,
      n: 'name0',
    },
    {
      x: 300,
      y: 100,
      t: 'Hello Mars!',
      w: 400,
      f: 0,
      a: 0,
      c: 0,
      of: 1,
      n: 'name1',
    },
  ];
  // 颜色数组
  const colors = [[8, [255, 0, 0, 255]]];
  // 模版参数
  const textTemplate = {
    v: 2,
    content: {
      fonts: fonts,
      texts: texts,
      colors: colors,
    },
    width: 300,
    height: 300,
    background: {
      name: 'image',
      // url: 'https://gw.alipayobjects.com/zos/gltf-asset/66157568550483/image0.jpg'
    },
  };
  const baseHeight = 45;
  const baseHeightWin = 42;
  let canvas = document.createElement('canvas');

  after(() => {
    canvas.remove();
    canvas = null;
  });

  it('测试layout返回值', async () => {
    const textLayouts = [];

    await combineImageTemplate2(
      imageURL,
      textTemplate,
      {},
      {
        textLayouts,
        canvas: canvas,
      }
    );

    expect(texts[0].x).to.eql(textLayouts[0].x);
    expect(texts[0].y).to.eql(textLayouts[0].y);

    expect(texts[1].x).to.eql(textLayouts[1].x);
    expect(texts[1].y).to.eql(textLayouts[1].y);

    if (navigator.platform.toLowerCase().search('win') >= 0) {
      expect(42).to.eql(textLayouts[0].height);
      expect(42).to.eql(textLayouts[1].height);
    } else {
      expect(45).to.eql(textLayouts[0].height);
      expect(45).to.eql(textLayouts[1].height);
    }

    expect(288).to.eql(textLayouts[0].width);
    expect(400).to.eql(textLayouts[1].width);
  });

  it('测试模版设置缩放参数后layout的返回值', async () => {
    // 缩放0.5
    const textLayouts = [];

    await combineImageTemplate2(
      imageURL,
      textTemplate,
      {},
      {
        textLayouts,
        canvas: canvas,
        templateScale: 0.5,
      }
    );

    expect(texts[0].x * 0.5).to.eql(textLayouts[0].x);
    expect(texts[0].y * 0.5).to.eql(textLayouts[0].y);

    expect(texts[1].x * 0.5).to.eql(textLayouts[1].x);
    expect(texts[1].y * 0.5).to.eql(textLayouts[1].y);

    if (navigator.platform.toLowerCase().search('win') >= 0) {
      expect(baseHeightWin * 0.5).to.eql(textLayouts[0].height);
      expect(baseHeightWin * 0.5).to.eql(textLayouts[1].height);
    } else {
      expect(baseHeight * 0.5).to.eql(textLayouts[0].height);
      expect(baseHeight * 0.5).to.eql(textLayouts[1].height);
    }

    expect(144).to.closeTo(textLayouts[0].width, 0.000001);
    expect(200).to.eql(textLayouts[1].width);

    // 缩放0.2
    await combineImageTemplate2(
      imageURL,
      textTemplate,
      {},
      {
        textLayouts,
        canvas: canvas,
        templateScale: 0.2,
      }
    );

    expect(texts[0].x * 0.2).to.eql(textLayouts[0].x);
    expect(texts[0].y * 0.2).to.eql(textLayouts[0].y);

    expect(texts[1].x * 0.2).to.eql(textLayouts[1].x);
    expect(texts[1].y * 0.2).to.eql(textLayouts[1].y);

    if (navigator.platform.toLowerCase().search('win') >= 0) {
      expect(baseHeightWin * 0.2).to.eql(textLayouts[0].height);
      expect(baseHeightWin * 0.2).to.eql(textLayouts[1].height);
    } else {
      expect(baseHeight * 0.2).to.eql(textLayouts[0].height);
      expect(baseHeight * 0.2).to.eql(textLayouts[1].height);
    }

    expect(288 * 0.2).to.closeTo(textLayouts[0].width, 0.000001);
    expect(80).to.eql(textLayouts[1].width);
  });

  it('测试图片尺寸与模版尺寸不同时，对模版的canvas缩放到图片尺寸', async () => {
    // 缩放0.5
    const textLayouts = [];
    let imageURL = 'https://gw.alipayobjects.com/zos/gltf-asset/67989981184436/test_300_300.png';
    const textTemplate = {
      v: 2,
      content: {
        fonts: fonts,
        texts: texts,
        colors: colors,
      },
      width: 300,
      height: 300,
    };
    let canvasResult = await combineImageTemplate2(
      imageURL,
      textTemplate,
      {},
      {
        textLayouts,
        canvas: canvas,
        templateScale: 1.0,
      }
    );

    expect(canvasResult.style.width).to.eql('300px');
    expect(canvasResult.style.height).to.eql('300px');

    expect(canvasResult.width).to.eql(300);
    expect(canvasResult.height).to.eql(300);

    expect(texts[0].x).to.eql(textLayouts[0].x);
    expect(texts[0].y).to.eql(textLayouts[0].y);

    expect(texts[1].x).to.eql(textLayouts[1].x);
    expect(texts[1].y).to.eql(textLayouts[1].y);

    if (navigator.platform.toLowerCase().search('win') >= 0) {
      expect(baseHeightWin).to.eql(textLayouts[0].height);
      expect(baseHeightWin).to.eql(textLayouts[1].height);
    } else {
      expect(baseHeight).to.eql(textLayouts[0].height);
      expect(baseHeight).to.eql(textLayouts[1].height);
    }

    expect(288).to.eql(textLayouts[0].width);
    expect(400).to.eql(textLayouts[1].width);

    // 图片是模版尺寸的二倍
    imageURL = 'https://gw.alipayobjects.com/zos/gltf-asset/67989981184436/test_600_600.png';

    canvasResult = await combineImageTemplate2(
      imageURL,
      textTemplate,
      {},
      {
        textLayouts,
        canvas: canvas,
        templateScale: 1.0,
      }
    );

    expect(canvasResult.style.width).to.eql('600px');
    expect(canvasResult.style.height).to.eql('600px');

    expect(canvasResult.width).to.eql(600);
    expect(canvasResult.height).to.eql(600);

    expect(texts[0].x * 2).to.eql(textLayouts[0].x);
    expect(texts[0].y * 2).to.eql(textLayouts[0].y);

    expect(texts[1].x * 2).to.eql(textLayouts[1].x);
    expect(texts[1].y * 2).to.eql(textLayouts[1].y);

    if (navigator.platform.toLowerCase().search('win') >= 0) {
      expect(baseHeightWin * 2).to.eql(textLayouts[0].height);
      expect(baseHeightWin * 2).to.eql(textLayouts[1].height);
    } else {
      expect(baseHeight * 2).to.eql(textLayouts[0].height);
      expect(baseHeight * 2).to.eql(textLayouts[1].height);
    }

    expect(288 * 2).to.eql(textLayouts[0].width);
    expect(400 * 2).to.eql(textLayouts[1].width);
  });

  it('测试背景填充色是否填充上（去除黑边的fix）', async () => {
    const textLayouts = [];
    // 30x30背景图
    const imageURL = 'https://gw.alipayobjects.com/zos/gltf-asset/69197334131043/%25E4%25B8%258B%25E8%25BD%25BD%252520%289%29.png';
    const textTemplate = {
      v: 2,
      content: {
        fonts: fonts,
        texts: [],
        colors: colors,
      },
      width: 30,
      height: 30,
    };
    const canvasResult = await combineImageTemplate2(
      imageURL,
      textTemplate,
      {},
      {
        textLayouts,
        canvas: canvas,
        templateScale: 1.0,
      }
    );

    // const imageData = renderContext.getImageData(0, 0, canvasResult.width, canvasResult.height).data;

    // const pixels = canvasResult.width * canvasResult.height;

    // for (let i = 0; i < pixels; ++i) {
    //   const index = i * 4;
    //   const a = imageData[index + 3];
    //   expect(a).to.eql(1);
    // }
  });

  it('测试template Background的url无效', async () => {
    // 30x30背景图
    const imageURL = 'https://gw.alipayobjects.com/zos/gltf-asset/69720573582093/test.jpg';
    const image0 = await loadImage(imageURL);
    const textLayouts = [];
    const canvas0 = document.createElement('canvas');
    const renderContext0 = canvas0.getContext('2d');
    const canvas2 = document.createElement('canvas');

    canvas2.width = image0.width;
    canvas2.height = image0.height;
    const renderContext2 = canvas2.getContext('2d');

    renderContext2.drawImage(image0, 0, 0, image0.width, image0.height, 0, 0, image0.width, image0.height);
    const imageData2 = renderContext2.getImageData(0, 0, image0.width, image0.height).data;
    const textTemplate = {
      v: 2,
      content: {
        fonts: fonts,
        texts: [],
        colors: colors,
      },
      width: 30,
      height: 30,
      background: {
        name: 'test',
      },
    };
    const canvasResult = await combineImageTemplate2(
      image0,
      textTemplate,
      {},
      {
        textLayouts,
        canvas: canvas0,
        templateScale: 1.0,
      }
    );
    const imageData0 = renderContext0.getImageData(0, 0, canvasResult.width, canvasResult.height).data;
    const pixels = canvasResult.width * canvasResult.height;

    for (let i = 0; i < pixels; ++i) {
      const index = i * 4;

      for (let j = 0; j < 3; ++j) {
        const a = imageData0[index + j];
        const b = imageData2[index + j];

        expect(a).to.eql(b);
      }
    }

    canvas0.remove();
    canvas2.remove();
  });

  it('测试template Background的url为空', async () => {
    // 30x30背景图
    const imageURL = 'https://gw.alipayobjects.com/zos/gltf-asset/69720573582093/test.jpg';
    const image0 = await loadImage(imageURL);
    const textLayouts = [];
    const canvas0 = document.createElement('canvas');
    const renderContext0 = canvas0.getContext('2d');
    const canvas2 = document.createElement('canvas');

    canvas2.width = image0.width;
    canvas2.height = image0.height;
    const renderContext2 = canvas2.getContext('2d');

    renderContext2.drawImage(image0, 0, 0, image0.width, image0.height, 0, 0, image0.width, image0.height);
    const imageData2 = renderContext2.getImageData(0, 0, image0.width, image0.height).data;
    const textTemplate = {
      v: 2,
      content: {
        fonts: fonts,
        texts: [],
        colors: colors,
      },
      width: 30,
      height: 30,
      background: {
        name: 'test',
        url: '',
      },
    };

    const canvasResult = await combineImageTemplate2(
      image0,
      textTemplate,
      {},
      {
        textLayouts,
        canvas: canvas0,
        templateScale: 1.0,
      }
    );
    const imageData0 = renderContext0.getImageData(0, 0, canvasResult.width, canvasResult.height).data;
    const pixels = canvasResult.width * canvasResult.height;

    for (let i = 0; i < pixels; ++i) {
      const index = i * 4;

      for (let j = 0; j < 3; ++j) {
        const a = imageData0[index + j];
        const b = imageData2[index + j];

        expect(a).to.eql(b);
      }
    }

    canvas0.remove();
    canvas2.remove();
  });
});

