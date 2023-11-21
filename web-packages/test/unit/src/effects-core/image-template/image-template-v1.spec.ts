// @ts-nocheck
import { combineImageTemplate } from '@galacean/effects';

const { expect } = chai;

describe('image-template v1', () => {
  it('load image template v1', async () => {
    const img = {
      'template': {
        'content': '<svg xmlns="http://www.w3.org/2000/svg"' +
          ' xmlns:xlink="http://www.w3.org/1999/xlink" width="256px" height="512px" viewBox="0 0 444 654" version="1.1"><title>1.3获得卡</title><g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g id="1.3获得卡"><image id="获得卡-图" x="0" y="96" width="444" height="558" xlink:href="$image_main$"/><image id="获得卡-文" x="36" y="144" width="372" height="165" xlink:href="$image_main2$"/><text id="获得今日品牌身份卡" fill-rule="nonzero" font-family="PingFangSC-Medium, PingFang SC" font-size="45" font-weight="400" fill="#FFFFFF"><tspan x="220" y="48" text-anchor="middle">$name$</tspan></text></g></g></svg>',
        'width': 256,
        'height': 512,
        'backgroundWidth': 256,
        'backgroundHeight': 512,
        'variables': {
          'image_main': 'https://gw.alipayobjects.com/mdn/rms_ab4795/afts/img/A*Ww4OQbMokPYAAAAAAAAAAAAAARQnAQ',
          'image_main2': 'https://gw.alipayobjects.com/mdn/rms_ab4795/afts/img/A*i8sqSZktLxAAAAAAAAAAAAAAARQnAQ',
          'name': '可配置可配置可配置',
        },
      }, 'url': 'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/BQTEQTNCXEEO/145132934-b18bf.png',
    };
    const image = await combineImageTemplate(img.url, img.template, { name: 'xxx' });

    expect(image).to.be.instanceof(HTMLCanvasElement);
    image.remove();
  });
});
