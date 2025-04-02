import { getStandardImage, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/fallback/images', () => {
  it('compressed images', () => {
    const images = [
      {
        'compressed': {
          'android': 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/OETSLEJGJROX/-1973629481-44fd2.ktx',
          'iOS': 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/OETSLEJGJROX/-1973629473-d139a.ktx',
        },
        'webp': 'fake_webp',
        oriY: 1,
        'url': 'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/OETSLEJGJROX/760117553-fc8fa.png',
      },
    ];
    const imageTags = [spec.RenderLevel.BPlus];

    images.forEach((image, index) => {
      const ret = getStandardImage(image, index, imageTags) as spec.CompressedImage;

      expect(ret.url, 'url').to.be.an('string');
      expect(ret.compressed.astc).to.eql('https://gw.alipayobjects.com/os/gltf-asset/mars-cli/OETSLEJGJROX/-1973629481-44fd2.ktx');
      expect(ret.compressed.pvrtc).to.eql('https://gw.alipayobjects.com/os/gltf-asset/mars-cli/OETSLEJGJROX/-1973629473-d139a.ktx');
      expect(ret.renderLevel).to.eql(spec.RenderLevel.BPlus);
      expect(ret.webp).to.eql('fake_webp');
    });

  });

  it('template image', () => {
    const images = [
      {
        'template': {
          'content': '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="256px" height="512px" viewBox="0 0 444 654" version="1.1"><title>1.3获得卡</title><g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g id="1.3获得卡"><image id="获得卡-图" x="0" y="96" width="444" height="558" xlink:href="$image_main$"/><image id="获得卡-文" x="36" y="144" width="372" height="165" xlink:href="$image_main2$"/><text id="获得今日品牌身份卡" fill-rule="nonzero" font-family="PingFangSC-Medium, PingFang SC" font-size="45" font-weight="400" fill="#FFFFFF"><tspan x="220" y="48" text-anchor="middle">$name$</tspan></text></g></g></svg>',
          'width': 256,
          'height': 512,
          'backgroundWidth': 256,
          'backgroundHeight': 512,
          'variables': {
            'image_main': 'https://gw.alipayobjects.com/mdn/rms_ab4795/afts/img/A*Ww4OQbMokPYAAAAAAAAAAAAAARQnAQ',
            'name': '可配置可配置可配置',
          },
        },
        'webp': 'fake_webp',
        'url': 'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/NCQSMUABPTXM/-272956899-b18bf.png',
      },
    ];

    images.forEach((image, index) => {
      const ret = getStandardImage(image, index, [spec.RenderLevel.S]) as spec.TemplateImage;
      const regex = /<svg(S*?)[^>]*>/;

      expect(ret.url).to.eql('https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/NCQSMUABPTXM/-272956899-b18bf.png', 'url');
      // @ts-expect-error
      expect(ret.template.content).to.match(regex);
      // @ts-expect-error
      expect(ret.template.variables).to.eql({
        'image_main': 'https://gw.alipayobjects.com/mdn/rms_ab4795/afts/img/A*Ww4OQbMokPYAAAAAAAAAAAAAARQnAQ',
        'name': '可配置可配置可配置',
      });
      expect(ret.webp).to.eql('fake_webp');
    });
  });

});
