import { combineImageTemplate, loadImage } from '@galacean/effects';

const { expect } = chai;

describe('Image template', async () => {
  // 背景图 url
  const imageURL = 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*kqtER7-CHoUAAAAAAAAAAAAAARQnAQ';
  // 模版数据
  const template = {
    width: 300,
    height: 300,
    variables: {},
    background: {
      name: 'image',
      url: 'https://gw.alipayobjects.com/zos/gltf-asset/66157568550483/image0.jpg',
    },
  };

  after(() => {
  });

  // it('测试图片尺寸与模版尺寸不同时，对模版的 canvas 缩放到图片尺寸', async () => {
  //   const image = 'https://gw.alipayobjects.com/zos/gltf-asset/67989981184436/test_300_300.png';
  //   // 图片是模版尺寸的二倍
  //   const image2x = 'https://gw.alipayobjects.com/zos/gltf-asset/67989981184436/test_600_600.png';
  //   let result = await combineImageTemplate(
  //     image,
  //     template,
  //     {},
  //     {
  //       canvas,
  //       templateScale: 1.0,
  //     }
  //   ) as HTMLImageElement;

  //   expect(result.width).to.eql(300);
  //   expect(result.height).to.eql(300);

  //   result = await combineImageTemplate(
  //     image2x,
  //     template,
  //     {},
  //     {
  //       canvas: canvas,
  //       templateScale: 1.0,
  //     }
  //   ) as HTMLImageElement;

  //   expect(result.width).to.eql(600);
  //   expect(result.height).to.eql(600);
  // });

  it('测试 template background 的 url 无效', async () => {
    // 30x30 背景图
    const url = 'https://gw.alipayobjects.com/zos/gltf-asset/69720573582093/test.jpg';
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const canvas2 = document.createElement('canvas');
    const context2 = canvas2.getContext('2d')!;

    canvas2.width = image.width;
    canvas2.height = image.height;
    context2.drawImage(image, 0, 0, image.width, image.height, 0, 0, image.width, image.height);

    const imageData2 = context2.getImageData(0, 0, image.width, image.height).data;
    const template = {
      width: 30,
      height: 30,
      variables: {},
      background: {
        name: 'test',
        url: '',
      },
    };
    const canvasResult = await combineImageTemplate(
      image,
      template,
      {},
      {
        templateScale: 1.0,
      }
    ) as HTMLImageElement;
    const imageData0 = context.getImageData(0, 0, canvasResult.width, canvasResult.height).data;
    const pixels = canvasResult.width * canvasResult.height;

    for (let i = 0; i < pixels; ++i) {
      const index = i * 4;

      for (let j = 0; j < 3; ++j) {
        const a = imageData0[index + j];
        const b = imageData2[index + j];

        expect(a).to.eql(b);
      }
    }

    canvas.remove();
    canvas2.remove();
  });

  // it('测试template Background的url为空', async () => {
  //   // 30x30背景图
  //   const imageURL = 'https://gw.alipayobjects.com/zos/gltf-asset/69720573582093/test.jpg';
  //   const image0 = await loadImage(imageURL);
  //   const textLayouts: TextLayout[] = [];
  //   const canvas0 = document.createElement('canvas');
  //   const context0 = canvas0.getContext('2d')!;
  //   const canvas2 = document.createElement('canvas');

  //   canvas2.width = image0.width;
  //   canvas2.height = image0.height;
  //   const renderContext2 = canvas2.getContext('2d')!;

  //   renderContext2.drawImage(image0, 0, 0, image0.width, image0.height, 0, 0, image0.width, image0.height);
  //   const imageData2 = renderContext2.getImageData(0, 0, image0.width, image0.height).data;
  //   const textTemplate = {
  //     v: 2,
  //     content: {
  //       fonts: fonts,
  //       texts: [],
  //       colors: colors,
  //     },
  //     width: 30,
  //     height: 30,
  //     background: {
  //       name: 'test',
  //       url: '',
  //     },
  //   };

  //   const canvasResult = await combineImageTemplate(
  //     image0,
  //     textTemplate,
  //     {},
  //     {
  //       textLayouts,
  //       canvas: canvas0,
  //       templateScale: 1.0,
  //     }
  //   ) as HTMLImageElement;
  //   const imageData0 = renderContext0.getImageData(0, 0, canvasResult.width, canvasResult.height).data;
  //   const pixels = canvasResult.width * canvasResult.height;

  //   for (let i = 0; i < pixels; ++i) {
  //     const index = i * 4;

  //     for (let j = 0; j < 3; ++j) {
  //       const a = imageData0[index + j];
  //       const b = imageData2[index + j];

  //       expect(a).to.eql(b);
  //     }
  //   }

  //   canvas0.remove();
  //   canvas2.remove();
  // });
});

