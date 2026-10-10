import { Player } from '@galacean/effects';

const { expect } = chai;

describe('core/composition/comp-vfx-item', () => {
  let player: Player;

  before(() => {
    const container = document.createElement('div');

    container.style.width = '100px';
    container.style.height = '120px';
    document.body.appendChild(container);
    player = new Player({ container });
  });

  after(() => {
    player.dispose();
    // @ts-expect-error
    player = null;
  });

  it('translate by pixel', async () => {
    const comp = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*3VDzQI83d9sAAAAAAAAAAAAADlB4AQ', {
      autoplay: false,
    });

    player.gotoAndStop(1);

    const sprite = comp.getItemByName('sprite_2');
    const pos = sprite?.transform.position;

    sprite?.translateByPixel(50, 60);
    expect(pos?.toArray()[0]).to.closeTo(0, 0.1);
    expect(pos?.toArray()[1]).to.closeTo(0, 0.1);
  });

  it('setPosition by pixel', async () => {
    // FIXME: 老版本数据，需要更新
    const comp = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*dFfLQp7L0TsAAAAAAAAAAAAADlB4AQ', {
      autoplay: false,
    });

    player.gotoAndStop(1);

    const sprite = comp.getItemByName('sprite_1');
    const pos = sprite?.transform.position;

    const { width, height } = player.canvas.getBoundingClientRect();

    // 正中心
    sprite?.setPositionByPixel(width / 2, height / 2);
    expect(pos?.toArray()[0]).to.closeTo(0, 0.1);
    expect(pos?.toArray()[1]).to.closeTo(0, 0.1);
  });
  // 预合成的当前缩放会在 timeline 采样时被缓存的 base pose 覆盖。
  it('set scale in compVFXItem is overwritten by timeline sampling', async () => {
    const comp = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*bkLLToY54tgAAAAAAAAAAAAADlB4AQ');

    player.gotoAndStop(0);
    const ref = comp.getItemByName('ref')!;
    const baseScale = ref.transform.scale.toArray();

    ref.setScale(0.1, 0.5, 2);
    expect(ref.transform.scale.toArray()).to.deep.equal([0.1, 0.5, 2]);
    player.gotoAndStop(1);
    expect(ref.transform.scale.toArray()).to.deep.equal(baseScale);

    ref.scale(2, 2, 0.1);
    expect(ref.transform.scale.toArray()).to.deep.equal([baseScale[0] * 2, baseScale[1] * 2, baseScale[2] * 0.1]);

    player.gotoAndStop(2);
    expect(ref.transform.scale.toArray()).to.deep.equal(baseScale);
  });
});
