// @ts-nocheck
import { setAlipayDowngradeBizId, Player, disableAllPlayer, mockIdPass, mockIdFail } from '@galacean/effects';

/**
 * 目前没有迁移降级的逻辑，所以下面的降级测试还不能跑。
 * 代码先迁移过来，后面不需要就直接删除了。
 */

const { expect } = chai;

describe('downgrade plugin', () => {
  let player;

  beforeEach(() => {
    setAlipayDowngradeBizId('test');
    player = new Player({ canvas: document.createElement('canvas') });
  });

  afterEach(() => {
    setAlipayDowngradeBizId(mockIdPass);
  });

  it('fake downgrade', async () => {
    setAlipayDowngradeBizId(mockIdFail);
    const catchFunc = chai.spy('error');

    await player.loadScene({
      'compositionId': 1,
      'requires': [],
      'compositions': [{
        'name': 'composition_1',
        'id': 1,
        'duration': 5,
        'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
        'items': [{
          'name': 'item_1',
          'delay': 0,
          'id': 1,
          'type': '1',
          'ro': 0.1,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.2,
              'sizeAspect': 1,
              'startColor': [8, [255, 255, 255]],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
            }, 'renderer': { 'renderMode': 1, 'anchor': [0.5, 0.5] },
          },
        }],
        'meta': { 'previewSize': [750, 1624] },
      }],
      'gltf': [],
      'images': [],
      'version': '0.9.0',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      '_imgs': { '1': [] },
    })
      .catch(catchFunc);

    expect(catchFunc).to.has.been.called.once;
  });

  it('protect webgl lost', () => {
    player.renderer.internal.gl.getExtension('WEBGL_lose_context').loseContext();
    const cvs = document.createElement('canvas');
    const spy = cvs.getContext = chai.spy('getContext');
    const p2 = new Player({ canvas: cvs });

    expect(p2.renderer.gpu.type).to.eql('none');
    expect(spy).not.to.has.been.called.once;
    disableAllPlayer(false);
  });

  it('when webgl lost, new player will destroy', () => {
    document.body.appendChild(player.canvas);
    player.renderer.internal.gl.getExtension('WEBGL_lose_context').loseContext();
    const imageUrl = 'https://mdn.alipayobjects.com/huamei_n0ji1n/afts/img/A*cN99R7HAgrIAAAAAAAAAAAAADuJ6AQ/original';
    const cvs = document.createElement('canvas');
    const spy = cvs.getContext = chai.spy('getContext');

    window.addEventListener('webglcontextlost', () => {
      const p2 = new Player({ canvas: cvs });

      expect(spy).not.to.has.been.called.once;
      expect(p2.canvas).to.not.exist;
      expect(p2.container).to.not.exist;
      expect(p2.renderer).to.not.exist;

      p2.useDowngradeImage(imageUrl, cvs.parentElement);
      expect(cvs.parentElement.style.backgroundImage).to.eql(`url("${imageUrl}")`);
    });

    disableAllPlayer(false);
  });
});
