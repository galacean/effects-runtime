// @ts-nocheck
import { PLight, PLightType, PObjectType, WebHelper } from '@galacean/effects-plugin-model';
import { loadGLTFScene } from '../../src/helper';
import { generateComposition } from './utilities';

const { expect } = chai;

const player = WebHelper.createPlayer(false);

describe('运行时测试', function () {
  this.timeout('600s');

  it('PLight测试', async function () {
    const url = 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/frog_flower.glb';
    const scene = await loadGLTFScene({ url, player });
    const comp = await generateComposition(
      player,
      scene,
      {
        pluginData: {
          compatibleMode: 'tiny3d',
          autoAdjustScene: true,
        },
      },
      { pauseOnFirstFrame: true }
    );

    const items = comp.items;
    const item1 = items[1];

    expect(item1.content instanceof PLight).to.eql(false);
    {
      const item = items[2];

      expect(item.content instanceof PLight).to.eql(true);
      const light = item.content;

      light.getWorldDirection().toArray().forEach((val, idx) => {
        expect([-0.10543716698884964, -0.1309116929769516, -0.9857713580131531][idx]).closeTo(val, 1e-5);
      });
      light.getWorldPosition().toArray().forEach((val, idx) => {
        expect([0, 0, 0][idx]).closeTo(val, 1e-5);
      });
      light.color.toArray().forEach((val, idx) => {
        expect([1, 1, 1][idx]).closeTo(val, 1e-5);
      });
      expect(light.range).to.eql(0);
      expect(light.type).to.eql(PObjectType.light);
      expect(light.lightType).to.eql(PLightType.directional);
      expect(light.intensity).to.eql(1.5);
      expect(light.innerConeAngle).to.eql(0);
      expect(light.outerConeAngle).to.eql(0);
    }
    {
      const item = items[3];

      expect(item.content instanceof PLight).to.eql(true);
      const light = item.content;

      light.getWorldDirection().toArray().forEach((val, idx) => {
        expect([0.8186928033828735, 0.2049010992050171, 0.5364304780960083][idx]).closeTo(val, 1e-5);
      });
      light.getWorldPosition().toArray().forEach((val, idx) => {
        expect([0, 0, 0][idx]).closeTo(val, 1e-5);
      });
      light.color.toArray().forEach((val, idx) => {
        expect([0.9716981053352356, 0.9693424701690674, 0.9671146273612976][idx]).closeTo(val, 1e-5);
      });
      expect(light.range).to.eql(0);
      expect(light.type).to.eql(PObjectType.light);
      expect(light.lightType).to.eql(PLightType.directional);
      expect(light.intensity).closeTo(0.6000000238418579, 1e-5);
      expect(light.innerConeAngle).to.eql(0);
      expect(light.outerConeAngle).to.eql(0);
    }
    {
      const item = items[4];

      expect(item.content instanceof PLight).to.eql(true);
      const light = item.content;

      light.getWorldDirection().toArray().forEach((val, idx) => {
        expect([-0.7150321006774902, 0.20736832916736603, 0.6676284074783325][idx]).closeTo(val, 1e-5);
      });
      light.getWorldPosition().toArray().forEach((val, idx) => {
        expect([0, 0, 0][idx]).closeTo(val, 1e-5);
      });
      light.color.toArray().forEach((val, idx) => {
        expect([1, 1, 1][idx]).closeTo(val, 1e-5);
      });
      expect(light.range).to.eql(0);
      expect(light.type).to.eql(PObjectType.light);
      expect(light.lightType).to.eql(PLightType.directional);
      expect(light.intensity).to.eql(0.5);
      expect(light.innerConeAngle).to.eql(0);
      expect(light.outerConeAngle).to.eql(0);
    }
    comp.dispose();
  });
});
