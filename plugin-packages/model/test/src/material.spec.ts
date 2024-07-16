/* eslint-disable @typescript-eslint/no-loss-of-precision */
/* eslint-disable padding-line-between-statements */
import { spec } from '@galacean/effects';
import { LoaderImplEx } from '../../src/helper';

const { expect } = chai;

describe('验证 gltf 与 glb 几何、材质和相机是否解析正确', function () {
  this.timeout(30000);

  it('Test 2CylinderEngine gltf material', async function () {
    const gltfLoader = new LoaderImplEx();
    const result = await gltfLoader.loadScene({
      gltf: {
        resource: 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/2CylinderEngine.glb',
      },
      effects: {
        duration: 5.0,
        endBehavior: spec.EndBehavior.freeze,
        playAnimation: 0,
      },
    });

    result.sceneAABB.max.forEach((v, i) => { expect([371.6921691894531, 115.25850677490234, 135.25839233398438][i]).closeTo(v, 1e-4); });
    result.sceneAABB.min.forEach((v, i) => { expect([-373.2934875488281, -188.28282165527344, -140][i]).closeTo(v, 4e-5); });
    const items = result.jsonScene.items;

    expect(items.length).to.eql(68);
    const tree = items[0];

    expect(tree.duration).to.eql(5);
    expect(tree.endBehavior).to.eql(2);
    expect(tree.id).to.eql('sceneTree');
    expect(tree.type).to.eql('tree');
    const treeOptions = tree.content.options.tree;

    expect(treeOptions.animation).to.eql(-1);
    expect(treeOptions.animations.length).to.eql(0);
    expect(treeOptions.children.length).to.eql(1);
    expect(treeOptions.children[0]).to.eql(82);
    expect(treeOptions.nodes.length).to.eql(83);
    const treeNodes = treeOptions.nodes;
    const node0 = treeNodes[0];

    expect(node0.children).to.eql([80, 79, 78, 77, 76, 75, 74, 73, 13, 10, 7, 4, 1]);
    expect(node0.id).to.eql('0');
    expect(node0.transform.position).to.eql([0, 0, 0]);
    expect(node0.transform.quat).to.eql([0, 0, 0, 1]);
    expect(node0.transform.scale).to.eql([1, 1, 1]);
    const node1 = treeNodes[1];

    expect(node1.children).to.eql([3, 2]);
    expect(node1.id).to.eql('1');
    expect(node1.transform.position).to.eql([136.860107421875, -64.45372009277344, -36.179630279541016]);
    expect(node1.transform.quat).to.eql([0, 0, 0, 1]);
    expect(node1.transform.scale).to.eql([1, 1, 1]);
    const node2 = treeNodes[2];

    expect(node2.children).to.eql([]);
    expect(node2.id).to.eql('2');
    expect(node2.transform.position).to.eql([-294.67718505859375, 73.97987365722656, 16.17963218688965]);
    expect(node2.transform.quat).to.eql([-0, -0, -1, -4.4896593387466766e-11]);
    expect(node2.transform.scale).to.eql([1, 1, 1]);
    const node3 = treeNodes[3];

    expect(node3.children).to.eql([]);
    expect(node3.id).to.eql('3');
    expect(node3.transform.position).to.eql([-45.315460205078125, -24.617263793945312, -26.320369720458984]);
    [0, 0, 0.014748196117579937, 0.9998912215232849].forEach((v, i) => {
      expect(node3.transform.quat[i]).closeTo(v, 1e-5);
    });
    [1, 1, 1].forEach((v, i) => {
      expect(node3.transform.scale[i]).closeTo(v, 1e-5);
    });
    const node18 = treeNodes[18];

    expect(node18.children).to.eql([]);
    expect(node18.id).to.eql('18');
    expect(node18.transform.position).to.eql([122.53109741210938, 86.64814758300781, -312.3133850097656]);
    [0.23851503431797028, -0.8046342730522156, 0.45807889103889465, 0.29298120737075806].forEach((v, i) => {
      expect(node18.transform.quat[i]).closeTo(v, 1e-5);
    });
    [1, 1, 1].forEach((v, i) => {
      expect(node18.transform.scale[i]).closeTo(v, 1e-5);
    });
    const node33 = treeNodes[33];

    expect(node33.children).to.eql([]);
    expect(node33.id).to.eql('33');
    expect(node33.transform.position).to.eql([-71.11894989013672, 74.98487091064453, -164.83367919921875]);
    [-0.48719531297683716, 0.23058265447616577, 0.12568430602550507, 0.8328720331192017].forEach((v, i) => {
      expect(node33.transform.quat[i]).closeTo(v, 1e-5);
    });
    [1, 1, 1].forEach((v, i) => {
      expect(node33.transform.scale[i]).closeTo(v, 1e-5);
    });
    const node46 = treeNodes[46];

    expect(node46.children).to.eql([]);
    expect(node46.id).to.eql('46');
    expect(node46.transform.position).to.eql([49.69811248779297, 257.12298583984375, 94.59911346435547]);
    [-0.9999993443489075, -0, -0.0011350003769621253, -4.4896589918019814e-11].forEach((v, i) => {
      expect(node46.transform.quat[i]).closeTo(v, 1e-5);
    });
    [1, 1, 1].forEach((v, i) => {
      expect(node46.transform.scale[i]).closeTo(v, 1e-5);
    });
    const node80 = treeNodes[80];

    expect(node80.children).to.eql([]);
    expect(node80.id).to.eql('80');
    expect(node80.transform.position).to.eql([-295, 132.1395263671875, -3.9833459854125977]);
    [-0.7071062922477722, -0.0008329991833306849, 0.7071062922477722, 0.0008333029691129923].forEach((v, i) => {
      expect(node80.transform.quat[i]).closeTo(v, 1e-5);
    });
    [1, 1, 1].forEach((v, i) => {
      expect(node80.transform.scale[i]).closeTo(v, 1e-5);
    });
    //
    {
      const item1 = items[1];
      const interaction1 = item1.content.interaction;

      expect(interaction1.type).to.eql(2);
      expect(interaction1.size).to.eql([106.4831771850586, 93, 93]);
      expect(interaction1.center).to.eql([10.110877990722656, 9.526153564453125, 0]);
      expect(item1.type).to.eql('mesh');
      expect(item1.parentId).to.eql('sceneTree^2');
      expect(item1.id).to.eql('mesh_ni2_mi0');
      expect(item1.name).to.eql('Piston_123-844_0_Parts_1');
      const options1 = item1.content.options;

      expect(options1.skin).to.eql(undefined);
      expect(options1.primitives.length).to.eql(2);
      //
      const geom0 = options1.primitives[0].geometry;

      expect(geom0.getAttributeNames()).to.eql(['aPos', 'aNormal']);
      const posAttrib0 = geom0.attributes['aPos'];

      expect(posAttrib0.size).to.eql(3);
      expect(posAttrib0.type).to.eql(5126);
      expect(posAttrib0.normalize).to.eql(false);
      const posData0 = geom0.getAttributeData('aPos');

      expect(posData0.length).to.eql(6036);
      [
        59.6924934387207, 30.344467163085938, 28.241464614868164, 59.70548629760742, 28.741451263427734, 29.28208351135254,
        60.378562927246094, 26.42641830444336, 26.770864486694336, 59.6924934387207, -12.19770622253418, 27.551000595092773,
        61.72390365600586, -7.481164932250977, 16.180885314941406, 61.72390365600586, -5.008791923522949, 18.433835983276367,
        22.699615478515625, 6.482560157775879, -35.531394958496094, 22.60923957824707, 6.653379917144775, -34.25192642211914,
        21.851367950439453, 3.9104979038238525, -33.54230499267578, 16.153377532958984, 22.55714988708496, -28.971750259399414,
        14.86927318572998, 23.382516860961914, -9.000043869018555, 18.46110725402832, 20.55475425720215, -9.000043869018555,
      ].forEach((v, i) => {
        expect(posData0[i]).closeTo(v, 1e-5);
      });
      const normAttrib0 = geom0.attributes['aNormal'];

      expect(normAttrib0.size).to.eql(3);
      expect(normAttrib0.type).to.eql(5126);
      expect(normAttrib0.normalize).to.eql(false);
      const normData0 = geom0.getAttributeData('aNormal');

      expect(normData0.length).to.eql(6036);
      [
        0.9786030054092407, 0.12469399720430374, 0.16367200016975403, 0.9780449867248535, 0.11514599621295929, 0.1736910045146942,
        0.9820849895477295, 0.10080599784851074, 0.1592089980840683, 0.9779999852180481, -0.12946300208568573, 0.16357100009918213,
        0.9902570247650146, -0.10085400193929672, 0.09602099657058716, 0.9900950193405151, -0.08644399791955948, 0.11063099652528763,
        0.9711679816246033, -0.15326300263404846, 0.18259799480438232, 0.9837009906768799, -0.17981299757957458, 0, 0.9367849826812744,
        -0.34990498423576355, 0, 0.5780450105667114, 0.8160049915313721, 0, 0.49745500087738037, 0.8674899935722351, 0, 0.7211499810218811,
        0.6927779912948608, 0, 0.3657569885253906, -0.04806600138545036, 0.9294679760932922, 0.3661800026893616, 0, 0.9305440187454224,
      ].forEach((v, i) => {
        expect(v).closeTo(normData0[i], 1e-5);
      });
      const mat0 = options1.primitives[0].material;

      expect(mat0.alphaCutOff).to.eql(0.5);
      expect(mat0.baseColorFactor).to.eql([216.75000607967377, 216.75000607967377, 216.75000607967377, 255]);
      expect(mat0.baseColorTexture).to.eql(undefined);
      expect(mat0.depthMask).to.eql(true);
      expect(mat0.blending).to.eql(100);
      expect(mat0.emissiveFactor).to.eql([0, 0, 0, 1]);
      expect(mat0.emissiveIntensity).to.eql(1);
      expect(mat0.emissiveTexture).to.eql(undefined);
      expect(mat0.metallicFactor).to.eql(0);
      expect(mat0.metallicRoughnessTexture).to.eql(undefined);
      expect(mat0.name).to.eql('Material_20');
      expect(mat0.normalTexture).to.eql(undefined);
      expect(mat0.occlusionTexture).to.eql(undefined);
      expect(mat0.roughnessFactor).to.eql(1);
      expect(mat0.side).to.eql(1028);
      expect(mat0.type).to.eql('pbr');
      //
      const geom1 = options1.primitives[1].geometry;
      expect(geom1.getAttributeNames()).to.eql(['aPos', 'aNormal']);
      const posAttrib1 = geom1.attributes['aPos'];
      expect(posAttrib1.size).to.eql(3);
      expect(posAttrib1.type).to.eql(5126);
      expect(posAttrib1.normalize).to.eql(false);
      const posData1 = geom1.getAttributeData('aPos');
      expect(posData1.length).to.eql(3888);
      [
        31.869285583496094, 51.86198806762695, 19.2335205078125, 31.869285583496094, 48.87227249145508, 24.781694412231445, 31.869285583496094,
        54.12814712524414, 13.149419784545898, 31.869285583496094, 11.31457805633545, -46.46559143066406, 31.869285583496094, 17.347570419311523,
        -45.83750534057617, 31.869285583496094, 22.986684799194336, -44.50917053222656, 41.86928176879883, 51.86198806762695, 19.2335205078125,
        41.86928176879883, 48.87227249145508, 24.78168487548828, 41.86928176879883, 54.12814712524414, 13.149419784545898, 41.86928176879883,
        11.31457805633545, -46.46559143066406, 41.86928176879883, 17.347570419311523, -45.83750534057617, 41.86928176879883, 22.986684799194336,
        -44.50917053222656, 31.869285583496094, -34.08098220825195, 16.14516258239746, 31.869285583496094, -35.75016784667969, 10.597429275512695,
        31.869285583496094, -31.60843849182129, 21.683944702148438, 36.869293212890625, 37.11741638183594, -37.429534912109375, 36.869293212890625,
      ].forEach((v, i) => {
        expect(v).closeTo(posData1[i], 1e-5);
      });
      const normAttrib1 = geom1.attributes['aNormal'];
      expect(normAttrib1.size).to.eql(3);
      expect(normAttrib1.type).to.eql(5126);
      expect(normAttrib1.normalize).to.eql(false);
      const normData1 = geom1.getAttributeData('aNormal');
      expect(normData1.length).to.eql(3888);
      [
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0,
        1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      ].forEach((v, i) => {
        expect(v).closeTo(normData1[i], 1e-5);
      });
      const mat1 = options1.primitives[0].material;
      expect(mat1.alphaCutOff).to.eql(0.5);
      expect(mat1.baseColorFactor).to.eql([216.75000607967377, 216.75000607967377, 216.75000607967377, 255]);
      expect(mat1.baseColorTexture).to.eql(undefined);
      expect(mat1.depthMask).to.eql(true);
      expect(mat1.blending).to.eql(100);
      expect(mat1.emissiveFactor).to.eql([0, 0, 0, 1]);
      expect(mat1.emissiveIntensity).to.eql(1);
      expect(mat1.emissiveTexture).to.eql(undefined);
      expect(mat1.metallicFactor).to.eql(0);
      expect(mat1.metallicRoughnessTexture).to.eql(undefined);
      expect(mat1.name).to.eql('Material_20');
      expect(mat1.normalTexture).to.eql(undefined);
      expect(mat1.normalTextureTransform).to.eql(undefined);
      expect(mat1.occlusionTexture).to.eql(undefined);
      expect(mat1.roughnessFactor).to.eql(1);
      expect(mat1.side).to.eql(1028);
      expect(mat1.type).to.eql('pbr');
    }
    {
      const item = items[4];
      const interaction1 = item.content.interaction;
      expect(interaction1.type).to.eql(2);
      expect(interaction1.size).to.eql([21.999984741210938, 21.983718872070312, 85]);
      [-253.4925537109375, 96.58930206298828, 42.5].forEach((v, i) => {
        expect(interaction1.center[i]).closeTo(v, 1e-5);
      });
      expect(item.type).to.eql('mesh');
      expect(item.parentId).to.eql('sceneTree^6');
      expect(item.id).to.eql('mesh_ni6_mi1');
      expect(item.name).to.eql('body_24');
      const options1 = item.content.options;
      expect(options1.skin).to.eql(undefined);
      expect(options1.primitives.length).to.eql(1);
      //
      const geom0 = options1.primitives[0].geometry;
      expect(geom0.mode).to.eql(4);
      expect(geom0.drawCount).to.eql(936);
      expect(geom0.drawStart).to.eql(0);
      const indexData = geom0.getIndexData();
      expect(indexData.length).to.eql(936);
      [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 25,
        26, 27, 28, 29, 30, 29, 29, 30, 30, 29, 31, 29, 32, 31, 31, 32, 31, 32, 33, 31, 31, 33, 34, 33, 33,
        34, 34, 33, 0, 33, 35, 0, 0, 35, 0, 35, 36, 0, 0, 36, 0, 36, 37, 0, 0, 37, 0, 37, 38, 0, 0, 38, 1,
        38, 38, 1, 1, 38, 39, 38, 38, 39, 39, 38, 7, 38, 40, 7, 7, 40, 8, 40,
      ].forEach((v, i) => {
        expect(v).to.eql(indexData[i]);
      });

      expect(geom0.getAttributeNames()).to.eql(['aPos', 'aNormal']);
      const posAttrib0 = geom0.attributes['aPos'];
      expect(posAttrib0.size).to.eql(3);
      expect(posAttrib0.type).to.eql(5126);
      expect(posAttrib0.normalize).to.eql(false);
      const posData0 = geom0.getAttributeData('aPos');
      expect(posData0.length).to.eql(792);
      [
        -247.99253845214844, 87.06302642822266, 0, -245.52316284179688, 89.00714874267578, 0, -246.68165588378906, 87.95148468017578, 0,
        -258.9925537109375, 106.1155776977539, 0, -261.9580078125, 103.61328887939453, 0, -261.0188903808594, 104.6114273071289, 0,
        -243.17689514160156, 92.77001953125, 0, -243.7617950439453, 91.45976257324219, 0, -242.7820281982422, 94.08238220214844, 0,
        -242.7820281982422, 99.09622192382812, 0, -243.7617950439453, 101.71884155273438, 0, -243.17689514160156, 100.40858459472656, 0,
        -263.5074768066406, 101.13916778564453, 0, -262.80023193359375, 102.45164489746094, 0, -264.0435791015625, 99.69994354248047, 0,
        -264.4925537109375, 96.58931732177734, 0, -264.3785705566406, 98.16879272460938, 0, -261.9580078125, 89.56531524658203, 0,
        -262.80023193359375, 90.72698211669922, 0, -261.0188903808594, 88.56717681884766, 0, -249.4174346923828, 106.80662536621094, 85,
        -250.91090393066406, 107.2820816040039, 85, -247.99253845214844, 106.1155776977539, 85, -249.4174346923828, 86.37200164794922, 85,
      ].forEach((v, i) => {
        expect(posData0[i]).closeTo(v, 1e-5);
      });
      const normAttrib0 = geom0.attributes['aNormal'];
      expect(normAttrib0.size).to.eql(3);
      expect(normAttrib0.type).to.eql(5126);
      expect(normAttrib0.normalize).to.eql(false);
      const normData0 = geom0.getAttributeData('aNormal');
      expect(normData0.length).to.eql(792);
      [
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      ].forEach((v, i) => {
        expect(v).closeTo(normData0[i], 1e-5);
      });
      const mat0 = options1.primitives[0].material;
      expect(mat0.alphaCutOff).to.eql(0.5);
      expect(mat0.baseColorFactor).to.eql([216.75000607967377, 143.05499732494354, 0, 255]);
      expect(mat0.baseColorTexture).to.eql(undefined);
      expect(mat0.depthMask).to.eql(true);
      expect(mat0.blending).to.eql(100);
      expect(mat0.emissiveFactor).to.eql([0, 0, 0, 1]);
      expect(mat0.emissiveIntensity).to.eql(1);
      expect(mat0.emissiveTexture).to.eql(undefined);
      expect(mat0.metallicFactor).to.eql(0);
      expect(mat0.metallicRoughnessTexture).to.eql(undefined);
      expect(mat0.name).to.eql('Material_17');
      expect(mat0.normalTexture).to.eql(undefined);
      expect(mat0.occlusionTexture).to.eql(undefined);
      expect(mat0.roughnessFactor).to.eql(1);
      expect(mat0.side).to.eql(1028);
      expect(mat0.type).to.eql('pbr');
    }
    {
      const item = items[26];
      const interaction1 = item.content.interaction;
      expect(interaction1.type).to.eql(2);
      expect(interaction1.size).to.eql([4, 29.99703598022461, 14.998519897460938]);
      [130.30111694335938, -49.399810791015625, 7.499259948730469].forEach((v, i) => {
        expect(interaction1.center[i]).closeTo(v, 1e-5);
      });
      expect(item.type).to.eql('mesh');
      expect(item.parentId).to.eql('sceneTree^36');
      expect(item.id).to.eql('mesh_ni36_mi6');
      expect(item.name).to.eql('Spring_Link__0_Parts_1');
      const options1 = item.content.options;
      expect(options1.skin).to.eql(undefined);
      expect(options1.primitives.length).to.eql(3);
      //
      {
        const geom0 = options1.primitives[0].geometry;
        expect(geom0.mode).to.eql(4);
        expect(geom0.drawCount).to.eql(123);
        expect(geom0.drawStart).to.eql(0);
        const indexData = geom0.getIndexData();
        expect(indexData.length).to.eql(123);
        [
          0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6, 5, 7, 6, 6, 7, 8, 7, 9, 8, 8, 9, 10, 9, 11, 10, 10, 11, 12, 13, 14,
          15, 14, 16, 15, 15, 16, 17, 16, 18, 17, 18, 19, 17, 17, 19, 20, 19, 21, 20, 20, 21, 22, 21, 23, 22, 22, 23, 24,
          23, 25, 24, 24, 25, 26, 25, 27, 26, 26, 27, 28, 27, 29, 28, 28, 29, 30, 29, 31, 30, 30, 31, 32, 31, 33, 32, 32,
          33, 34, 33, 35, 34, 34, 35, 36, 35,
        ].forEach((v, i) => {
          expect(v).to.eql(indexData[i]);
        });

        expect(geom0.getAttributeNames()).to.eql(['aPos', 'aNormal']);
        const posAttrib0 = geom0.attributes['aPos'];
        expect(posAttrib0.size).to.eql(3);
        expect(posAttrib0.type).to.eql(5126);
        expect(posAttrib0.normalize).to.eql(false);
        const posData0 = geom0.getAttributeData('aPos');
        expect(posData0.length).to.eql(129);
        [
          131.05416870117188, -36.00284957885742, 5, 131.15240478515625, -36.39981460571289, 5, 130.7267608642578, -35.66258239746094, 5,
          131.05416870117188, -36.796783447265625, 5, 130.40919494628906, -35.555423736572266, 5, 130.7267608642578, -37.13704299926758, 5,
          130.0986785888672, -35.572959899902344, 5, 130.2683868408203, -37.250465393066406, 5, 129.87547302246094, -35.66258239746094, 5,
          129.87547302246094, -37.13704299926758, 5, 129.58079528808594, -35.946136474609375, 5, 129.5324249267578, -36.765586853027344, 5,
          129.44984436035156, -36.39981460571289, 5, 131.05416870117188, -36.00285339355469, 0, 131.05416870117188, -36.00284957885742, 5,
          130.85952758789062, -35.757286071777344, 0, 130.85952758789062, -35.75727844238281, 5, 130.578369140625, -35.59495162963867, 0,
          130.578369140625, -35.59495162963867, 5, 130.2683868408203, -35.549163818359375, 5, 130.2683868408203, -35.54916763305664, 0,
        ].forEach((v, i) => {
          expect(posData0[i]).closeTo(v, 1e-5);
        });
        const normAttrib0 = geom0.attributes['aNormal'];
        expect(normAttrib0.size).to.eql(3);
        expect(normAttrib0.type).to.eql(5126);
        expect(normAttrib0.normalize).to.eql(false);
        const normData0 = geom0.getAttributeData('aNormal');
        expect(normData0.length).to.eql(129);
        [
          0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
          0, -1, -0.8838279843330383, -0.4678120017051697, 0, -0.8838279843330383, -0.4678120017051697, 0, -0.6577739715576172,
          -0.7532159686088562, 0, -0.6577739715576172, -0.7532159686088562, 0, -0.3231399953365326, -0.9463509917259216, 0,
          -0.3231399953365326, -0.9463509917259216, 0, 0.03848600015044212, -0.9992589950561523, 0, 0.03848600015044212, -0.9992589950561523,
          0, 0.49745500087738037, -0.8674899935722351, 0, 0.49745500087738037, -0.8674899935722351, 0, 0.8454970121383667, -0.5339800119400024,
          0, 0.8454970121383667, -0.5339800119400024, 0, 0.9818310141563416, -0.1897590011358261, 0, 0.9818310141563416, -0.1897590011358261,
          0, 0.9818310141563416, 0.1897590011358261, 0, 0.9818310141563416, 0.1897590011358261, 0, 0.8454970121383667, 0.5339800119400024,
          0, 0.8454970121383667, 0.5339800119400024, 0, 0.49745500087738037, 0.8674899935722351, 0, 0.49745500087738037, 0.8674899935722351,
        ].forEach((v, i) => {
          expect(v).closeTo(normData0[i], 1e-5);
        });
        const mat0 = options1.primitives[0].material;
        expect(mat0.alphaCutOff).to.eql(0.5);
        expect(mat0.baseColorFactor).to.eql([216.75000607967377, 143.05499732494354, 0, 255]);
        expect(mat0.baseColorTexture).to.eql(undefined);
        expect(mat0.depthMask).to.eql(true);
        expect(mat0.blending).to.eql(100);
        expect(mat0.emissiveFactor).to.eql([0, 0, 0, 1]);
        expect(mat0.emissiveIntensity).to.eql(1);
        expect(mat0.emissiveTexture).to.eql(undefined);
        expect(mat0.metallicFactor).to.eql(0);
        expect(mat0.metallicRoughnessTexture).to.eql(undefined);
        expect(mat0.name).to.eql('Material_17');
        expect(mat0.normalTexture).to.eql(undefined);
        expect(mat0.occlusionTexture).to.eql(undefined);
        expect(mat0.roughnessFactor).to.eql(1);
        expect(mat0.side).to.eql(1028);
        expect(mat0.type).to.eql('pbr');
      }
      {
        const geom0 = options1.primitives[1].geometry;
        expect(geom0.mode).to.eql(4);
        expect(geom0.drawCount).to.eql(123);
        expect(geom0.drawStart).to.eql(0);
        const indexData = geom0.getIndexData();
        expect(indexData.length).to.eql(123);
        [
          0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6, 5, 7, 6, 6, 7, 8, 7, 9, 8, 8, 9, 10, 9, 11, 10, 10, 11, 12, 13, 14, 15, 15, 14,
          16, 14, 17, 16, 16, 17, 18, 17, 19, 18, 18, 19, 20, 19, 21, 20, 21, 22, 20, 20, 22, 23, 22, 24, 23, 23, 24, 25, 24, 26, 25,
          25, 26, 27, 26, 28, 27, 27, 28, 29, 28, 30, 29, 29, 30, 31, 30, 32, 31, 31, 32, 33, 32, 34, 33, 33, 34, 35, 34, 36, 35, 35,
        ].forEach((v, i) => {
          expect(v).to.eql(indexData[i]);
        });

        expect(geom0.getAttributeNames()).to.eql(['aPos', 'aNormal']);
        const posAttrib0 = geom0.attributes['aPos'];
        expect(posAttrib0.size).to.eql(3);
        expect(posAttrib0.type).to.eql(5126);
        expect(posAttrib0.normalize).to.eql(false);
        const posData0 = geom0.getAttributeData('aPos');
        expect(posData0.length).to.eql(129);
        [
          130.7181396484375, -63.19089126586914, 5, 130.30111694335938, -63.2940788269043, 5, 131.07557678222656, -62.846946716308594, 5,
          129.8841094970703, -63.19089126586914, 5, 131.19471740722656, -62.365421295166016, 5, 129.5266571044922, -62.846946716308594, 5,
          131.07557678222656, -61.95268630981445, 5, 129.4075164794922, -62.365421295166016, 5, 130.77769470214844, -61.643131256103516, 5,
          129.5266571044922, -61.95268630981445, 5, 130.30111694335938, -61.505550384521484, 5, 129.73785400390625, -61.705238342285156, 5,
          130.06961059570312, -61.53603744506836, 5, 130.7181396484375, -63.19089889526367, 0, 130.97610473632812, -62.98641586303711, 5,
          130.97610473632812, -62.98641586303711, 0, 131.14662170410156, -62.691070556640625, 0, 131.14662170410156, -62.69106674194336, 5,
          131.19471740722656, -62.365421295166016, 0, 131.19471740722656, -62.365421295166016, 5, 131.07557678222656, -61.95268630981445, 0,
        ].forEach((v, i) => {
          expect(posData0[i]).closeTo(v, 1e-5);
        });
        const normAttrib0 = geom0.attributes['aNormal'];
        expect(normAttrib0.size).to.eql(3);
        expect(normAttrib0.type).to.eql(5126);
        expect(normAttrib0.normalize).to.eql(false);
        const normData0 = geom0.getAttributeData('aNormal');
        expect(normData0.length).to.eql(129);
        [
          0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
          -0.4678120017051697, 0.8838279843330383, 0, -0.7532159686088562, 0.6577739715576172, 0, -0.7532159686088562, 0.6577739715576172, 0,
          -0.9463509917259216, 0.3231399953365326, 0, -0.9463509917259216, 0.3231399953365326, 0, -0.9992589950561523, -0.03848600015044212, 0,
          -0.9992589950561523, -0.03848600015044212, 0, -0.8674899935722351, -0.49745500087738037, 0, -0.8674899935722351, -0.49745500087738037,
          0, -0.5339800119400024, -0.8454970121383667, 0, -0.5339800119400024, -0.8454970121383667, 0, -0.1897590011358261, -0.9818310141563416,
          0, -0.1897590011358261, -0.9818310141563416, 0, 0.1897590011358261, -0.9818310141563416, 0, 0.1897590011358261, -0.9818310141563416, 0,
          0.5339800119400024, -0.8454970121383667, 0, 0.5339800119400024, -0.8454970121383667, 0, 0.8674899935722351, -0.49745500087738037, 0,
        ].forEach((v, i) => {
          expect(v).closeTo(normData0[i], 1e-5);
        });
        const mat0 = options1.primitives[0].material;
        expect(mat0.alphaCutOff).to.eql(0.5);
        expect(mat0.baseColorFactor).to.eql([216.75000607967377, 143.05499732494354, 0, 255]);
        expect(mat0.baseColorTexture).to.eql(undefined);
        expect(mat0.depthMask).to.eql(true);
        expect(mat0.blending).to.eql(100);
        expect(mat0.emissiveFactor).to.eql([0, 0, 0, 1]);
        expect(mat0.emissiveIntensity).to.eql(1);
        expect(mat0.emissiveTexture).to.eql(undefined);
        expect(mat0.metallicFactor).to.eql(0);
        expect(mat0.metallicRoughnessTexture).to.eql(undefined);
        expect(mat0.name).to.eql('Material_17');
        expect(mat0.normalTexture).to.eql(undefined);
        expect(mat0.occlusionTexture).to.eql(undefined);
        expect(mat0.roughnessFactor).to.eql(1);
        expect(mat0.side).to.eql(1028);
        expect(mat0.type).to.eql('pbr');
      }
    }
  });

  it('Test CesiumMan gltf material', async function () {
    const gltfLoader = new LoaderImplEx();
    const result = await gltfLoader.loadScene({
      gltf: {
        resource: 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/CesiumMan.glb',
      },
      effects: {
        duration: 5.0,
        endBehavior: spec.EndBehavior.freeze,
        playAnimation: 0,
      },
    });
    result.sceneAABB.max.forEach((v, i) => { expect([0.569136917591095, 1.5065498352050781, 0.18095403909683228][i]).closeTo(v, 1e-5); });
    result.sceneAABB.min.forEach((v, i) => { expect([-0.5691370964050293, -6.193791257658177e-9, -0.13100001215934753][i]).closeTo(v, 1e-5); });
    const items = result.jsonScene.items;
    expect(items.length).to.eql(2);
    const tree = items[0];
    expect(tree.duration).to.eql(5);
    expect(tree.endBehavior).to.eql(2);
    expect(tree.id).to.eql('sceneTree');
    expect(tree.type).to.eql('tree');
    const treeOptions = tree.content.options.tree;
    expect(treeOptions.children.length).to.eql(1);
    expect(treeOptions.children[0]).to.eql(0);
    expect(treeOptions.nodes.length).to.eql(22);
    const treeNodes = treeOptions.nodes;
    {
      const node0 = treeNodes[0];
      expect(node0.children).to.eql([1]);
      expect(node0.id).to.eql('0');
      expect(node0.transform.position).to.eql([0, 0, 0]);
      [-0.7071067690849304, 0, 0, 0.7071067690849304].forEach((v, i) => {
        expect(node0.transform.quat[i]).closeTo(v, 1e-5);
      });
      expect(node0.transform.scale).to.eql([1, 1, 1]);
    }
    {
      const node0 = treeNodes[1];
      expect(node0.children).to.eql([3, 2]);
      expect(node0.id).to.eql('1');
      expect(node0.transform.position).to.eql([0, 0, 0]);
      [0, 0, -0.7071067690849304, 0.7071067690849304].forEach((v, i) => {
        expect(node0.transform.quat[i]).closeTo(v, 1e-5);
      });
      [1, 1, 1].forEach((v, i) => {
        expect(node0.transform.scale[i]).closeTo(v, 1e-5);
      });
    }
    {
      const node0 = treeNodes[7];
      expect(node0.children).to.eql([]);
      expect(node0.id).to.eql('7');
      expect(node0.transform.position).to.eql([-0.06681963056325912, -0.001072264974936843, 0.026351310312747955]);
      [0, -0.3269147574901581, 0, 0.9450538158416748].forEach((v, i) => {
        expect(node0.transform.quat[i]).closeTo(v, 1e-5);
      });
      [1, 1, 1].forEach((v, i) => {
        expect(node0.transform.scale[i]).closeTo(v, 1e-5);
      });
    }
    {
      const node0 = treeNodes[18];
      expect(node0.children).to.eql([19]);
      expect(node0.id).to.eql('18');
      expect(node0.transform.position).to.eql([0.01322161965072155, 0.21549950540065765, 0.10933209955692291]);
      [-0, 0.0711694285273552, -0, 0.9974642395973206].forEach((v, i) => {
        expect(node0.transform.quat[i]).closeTo(v, 1e-5);
      });
      [1, 1, 1].forEach((v, i) => {
        expect(node0.transform.scale[i]).closeTo(v, 1e-5);
      });
    }

    expect(treeOptions.animation).to.eql(0);
    expect(treeOptions.animations.length).to.eql(1);
    const anim0 = treeOptions.animations[0];
    const tracks0 = anim0.tracks;
    expect(tracks0.length).to.eql(57);
    {
      const track0 = tracks0[0];
      expect(track0.node).to.eql(3);
      expect(track0.path).to.eql('translation');
      expect(track0.interpolation).to.eql('LINEAR');
      const input = track0.input;
      expect(input.length).to.eql(48);
      [
        0.04166661947965622, 0.08333330601453781, 0.125, 0.16666659712791443, 0.20833329856395721, 0.25, 0.29166659712791443, 0.3333333134651184,
        0.3750000298023224, 0.41666659712791443, 0.4583333134651184, 0.5, 0.5416666865348816, 0.5833333134651184, 0.625, 0.6666666865348816,
        0.7083333134651184, 0.75, 0.7916666865348816, 0.8333333134651184, 0.8750000596046448, 0.9166666865348816, 0.9583333134651184, 1,
        1.0416669845581055, 1.0833330154418945, 1.125, 1.1666669845581055, 1.2083330154418945, 1.25, 1.2916669845581055, 1.3333330154418945,
        1.3750001192092896, 1.4166669845581055, 1.4583330154418945, 1.5, 1.5416669845581055, 1.5833330154418945, 1.6250001192092896, 1.6666669845581055,
        1.7083330154418945, 1.75, 1.7916669845581055, 1.8333330154418945, 1.8750001192092896, 1.9166669845581055, 1.9583330154418945,
      ].forEach((v, i) => {
        expect(v).closeTo(input[i], 1e-5);
      });
      const output = track0.output;
      expect(output.length).to.eql(144);
      [
        1.971350016560791e-8, -0.02000010944902897, 0.6439971327781677, 1.7385199058139733e-8, -0.02000010944902897, 0.6540120840072632,
        2.0703099679053594e-8, -0.02000010944902897, 0.6670830845832825, 2.993629877323656e-8, -0.020000120624899864, 0.6802471876144409,
        3.00744993353419e-8, -0.020000120624899864, 0.6905401349067688, 2.984170066611114e-8, -0.020000120624899864, 0.6950002312660217,
        2.55343000077346e-8, -0.020098520442843437, 0.6947941184043884, 1.7152400388908973e-8, -0.020370520651340485, 0.6932101249694824,
        2.541789889676238e-8, -0.020781319588422775, 0.6904690861701965, 2.6116399709508187e-8, -0.021296419203281403, 0.6867902278900146,
        1.197189991586356e-8, -0.021880919113755226, 0.6823940873146057, 3.038740103988857e-8, -0.022500120103359222, 0.6775001883506775,
        2.8561100151591745e-8, -0.02311931923031807, 0.6723281145095825, 2.518510022753162e-8, -0.023703809827566147, 0.6670992970466614,
        3.636089829228695e-8, -0.02421892061829567, 0.6620311141014099, 2.7164100302456973e-8, -0.024629710242152214, 0.6573460102081299,
      ].forEach((v, i) => {
        expect(v).closeTo(output[i], 1e-5);
      });
    }
    {
      const track0 = tracks0[1];
      expect(track0.node).to.eql(3);
      expect(track0.path).to.eql('rotation');
      expect(track0.interpolation).to.eql('LINEAR');
      const input = track0.input;
      expect(input.length).to.eql(48);
      [
        0.04166661947965622, 0.08333330601453781, 0.125, 0.16666659712791443, 0.20833329856395721, 0.25, 0.29166659712791443, 0.3333333134651184,
        0.3750000298023224, 0.41666659712791443, 0.4583333134651184, 0.5, 0.5416666865348816, 0.5833333134651184, 0.625, 0.6666666865348816,
        0.7083333134651184, 0.75, 0.7916666865348816, 0.8333333134651184, 0.8750000596046448, 0.9166666865348816, 0.9583333134651184, 1,
        1.0416669845581055, 1.0833330154418945, 1.125, 1.1666669845581055, 1.2083330154418945, 1.25, 1.2916669845581055, 1.3333330154418945,
        1.3750001192092896, 1.4166669845581055, 1.4583330154418945, 1.5, 1.5416669845581055, 1.5833330154418945, 1.6250001192092896, 1.6666669845581055,
        1.7083330154418945, 1.75, 1.7916669845581055, 1.8333330154418945, 1.8750001192092896, 1.9166669845581055, 1.9583330154418945,
      ].forEach((v, i) => {
        expect(v).closeTo(input[i], 1e-5);
      });
      const output = track0.output;
      expect(output.length).to.eql(192);
      [
        -0.0000519421482749749, -0.03665076196193695, -0.000024140945242834277, -0.9993281364440918, -0.0005967012839391828, -0.035811346024274826,
        -0.00006479941657744348, -0.9993584752082825, -0.001428048824891448, -0.03454294800758362, -0.0001324481563642621, -0.9994022250175476,
        -0.0024831017944961786, -0.03295197710394859, -0.00022520973288919777, -0.9994538426399231, -0.003699145745486021, -0.031145386397838593,
        -0.0003416933468542993, -0.9995080232620239, -0.005013598594814539, -0.02922986075282097, -0.000480920571135357, -0.9995600581169128,
        -0.00636393902823329, -0.027312759310007095, -0.0006397647666744888, -0.9996064901351929, -0.007687932811677456, -0.025501323863863945,
        -0.0008135015959851444, -0.999644935131073, -0.008923620916903019, -0.023903192952275276, -0.0009989168029278517, -0.9996740221977234,
        -0.010009185411036015, -0.022626196965575218, -0.001189144211821258, -0.9996932744979858, -0.010882844217121601, -0.021778343245387077,
        -0.0013788016512989998, -0.9997026920318604, -0.011483131907880306, -0.021467648446559906, -0.0015613603172823787, -0.9997023940086365,
      ].forEach((v, i) => {
        expect(v).closeTo(output[i], 1e-5);
      });
    }
    {
      const track0 = tracks0[32];
      expect(track0.node).to.eql(16);
      expect(track0.path).to.eql('scale');
      expect(track0.interpolation).to.eql('LINEAR');
      const input = track0.input;
      expect(input.length).to.eql(48);
      [
        0.04166661947965622, 0.08333330601453781, 0.125, 0.16666659712791443, 0.20833329856395721, 0.25, 0.29166659712791443, 0.3333333134651184,
        0.3750000298023224, 0.41666659712791443, 0.4583333134651184, 0.5, 0.5416666865348816, 0.5833333134651184, 0.625, 0.6666666865348816,
        0.7083333134651184, 0.75, 0.7916666865348816, 0.8333333134651184, 0.8750000596046448, 0.9166666865348816, 0.9583333134651184, 1,
        1.0416669845581055, 1.0833330154418945, 1.125, 1.1666669845581055, 1.2083330154418945, 1.25, 1.2916669845581055, 1.3333330154418945,
        1.3750001192092896, 1.4166669845581055, 1.4583330154418945, 1.5, 1.5416669845581055, 1.5833330154418945, 1.6250001192092896,
        1.6666669845581055, 1.7083330154418945, 1.75, 1.7916669845581055, 1.8333330154418945, 1.8750001192092896, 1.9166669845581055,
      ].forEach((v, i) => {
        expect(v).closeTo(input[i], 1e-5);
      });
      const output = track0.output;
      expect(output.length).to.eql(144);
      [
        0.9999999403953552, 1.000000238418579, 1.0000001192092896, 0.9999999403953552, 1.0000001192092896, 1.000000238418579, 1.0000001192092896,
        1.0000004768371582, 1.0000003576278687, 1.000000238418579, 1, 1.000000238418579, 1.0000001192092896, 1.0000003576278687, 1.0000003576278687,
        1.0000001192092896, 1.0000003576278687, 1.000000238418579, 1, 1.000000238418579, 1.0000001192092896, 1.0000001192092896, 1.0000001192092896,
        1.0000001192092896, 1, 1.000000238418579, 1.0000001192092896, 1, 1.000000238418579, 1.0000001192092896, 1, 1.000000238418579, 1.0000001192092896,
        1, 1.000000238418579, 1.0000001192092896, 1, 0.9999999403953552, 1.0000001192092896, 1.0000001192092896, 0.9999999403953552, 1.0000001192092896,
        1.000000238418579, 1.000000238418579, 1.000000238418579, 1, 1.0000001192092896, 1.0000004768371582, 1, 1.0000001192092896, 1.000000238418579,
        1.0000001192092896, 1.0000001192092896, 1.0000003576278687, 0.9999999403953552, 0.9999997615814209, 0.9999999403953552, 1, 1.0000001192092896,
      ].forEach((v, i) => {
        expect(v).closeTo(output[i], 1e-5);
      });
    }
    {
      const track0 = tracks0[52];
      expect(track0.node).to.eql(6);
      expect(track0.path).to.eql('rotation');
      expect(track0.interpolation).to.eql('LINEAR');
      const input = track0.input;
      expect(input.length).to.eql(48);
      [
        0.04166661947965622, 0.08333330601453781, 0.125, 0.16666659712791443, 0.20833329856395721, 0.25, 0.29166659712791443, 0.3333333134651184,
        0.3750000298023224, 0.41666659712791443, 0.4583333134651184, 0.5, 0.5416666865348816, 0.5833333134651184, 0.625, 0.6666666865348816,
        0.7083333134651184, 0.75, 0.7916666865348816, 0.8333333134651184, 0.8750000596046448, 0.9166666865348816, 0.9583333134651184, 1,
        1.0416669845581055, 1.0833330154418945, 1.125, 1.1666669845581055, 1.2083330154418945, 1.25, 1.2916669845581055, 1.3333330154418945,
        1.3750001192092896, 1.4166669845581055, 1.4583330154418945, 1.5, 1.5416669845581055, 1.5833330154418945, 1.6250001192092896, 1.6666669845581055,
        1.7083330154418945, 1.75, 1.7916669845581055, 1.8333330154418945, 1.8750001192092896, 1.9166669845581055, 1.9583330154418945,
      ].forEach((v, i) => {
        expect(v).closeTo(input[i], 1e-5);
      });
      const output = track0.output;
      expect(output.length).to.eql(192);
      [
        0.0010036986786872149, 0.9158948063850403, 0.003159016603603959, 0.4014045298099518, 0.0006668953574262559, 0.9119538068771362, 0.0029236674308776855,
        0.41028153896331787, 0.0002547547919675708, 0.906766951084137, 0.002642179373651743, 0.4216236472129822, -0.00011592016380745918, 0.9015601873397827,
        0.0024067964404821396, 0.43264663219451904, -0.00033585712662898004, 0.897687554359436, 0.002310338197275996, 0.4406261444091797, -0.00030056509422138333,
        0.8965795040130615, 0.0024437811225652695, 0.4428757429122925, 0.00007881734927650541, 0.8978165984153748, 0.002808519173413515, 0.4403603971004486,
        0.0007354965782724321, 0.9002109169960022, 0.003327568992972374, 0.4354405105113983, 0.0015423970762640238, 0.9040022492408752, 0.003968952223658562,
        0.42750632762908936, 0.0023725188802927732, 0.9093828201293945, 0.004700455814599991, 0.41592660546302795, 0.003096247324720025, 0.9164759516716003,
        0.005493498407304287, 0.400039941072464, 0.003577752038836479, 0.9253066778182983, 0.00632821349427104, 0.3791498839855194, 0.003774698358029127,
        0.9367066621780396, 0.007239702623337507, 0.3500196635723114, 0.0037802529986947775, 0.9499551057815552, 0.008277570828795433, 0.3122534155845642,
      ].forEach((v, i) => {
        expect(v).closeTo(output[i], 1e-5);
      });
    }
    {
      const item = items[1];
      const interaction1 = item.content.interaction;
      expect(interaction1.type).to.eql(2);
      [0.3119540214538574, 1.1382739543914795, 1.5065499544143677].forEach((v, i) => {
        expect(interaction1.size[i]).closeTo(v, 1e-5);
      });
      [0.02497699111700058, -8.940696716308594e-8, 0.7532749772071838].forEach((v, i) => {
        expect(interaction1.center[i]).closeTo(v, 1e-5);
      });
      expect(item.type).to.eql('mesh');
      expect(item.parentId).to.eql('sceneTree^2');
      expect(item.id).to.eql('mesh_ni2_mi0');
      expect(item.name).to.eql('Cesium_Man');
      const options1 = item.content.options;
      const skin1 = options1.skin;
      expect(skin1.inverseBindMatrices.length).to.eql(304);
      [
        0.9971418380737305, -4.3711398944878965e-8, 0.07555299252271652, 0, 4.358646421565027e-8, 1, 3.3025269186026662e-9, 0, -0.07555299252271652, 0,
        0.9971418380737305, 0, 0.05130045861005783, -0.0049998159520328045, -0.6770592331886292, 1, 0.06041746959090233, -4.3711398944878965e-8,
        0.9981732964515686, 0, 2.64093213964145e-9, 1, 4.3631551704947924e-8, 0, -0.9981732964515686, 0, 0.06041746959090233, 0, 0.8218303918838501,
        -0.004986404906958342, -0.0607638880610466, 1, 0.986260712146759, -4.3711398944878965e-8, 0.16519659757614136, 0, 4.3110834013759813e-8, 1,
        7.22097448502268e-9, 0, -0.16519659757614136, 0, 0.986260712146759, 0, 0.18158070743083954, -0.004987061023712158, -1.058603048324585, 1,
        -0.0384785495698452, -4.3711398944878965e-8, 0.9992595911026001, 0, -1.6819512449472995e-9, 1, 4.367903372326509e-8, 0, -0.9992595911026001, 0,
        -0.0384785495698452, 0, 1.1374080181121826, -0.0049894447438418865, 0.03729343041777611, 1, -0.011275229975581169, -4.3711398944878965e-8,
        -0.9999366402626038, 0, -4.9285608927363e-10, 1, -4.37086278282095e-8, 0, 0.9999366402626038, 0, -0.011275229975581169, 0, -1.189831018447876,
        -0.0049894447438418865, 0.02191680110991001, 1, -0.9999089241027832, -4.3711398944878965e-8, 0.013504560105502605, 0, -4.370741635284503e-8, 1,
        5.903031952136928e-10, 0, -0.013504560105502605, 0, -0.9999089241027832, 0, 0.010247940197587013, -0.09600067138671875, 1.0739599466323853,
      ].forEach((v, i) => {
        expect(v).closeTo(skin1.inverseBindMatrices[i], 1e-5);
      });
      expect(skin1.joints.length).to.eql(19);
      expect(skin1.joints).to.eql([3, 12, 13, 20, 21, 17, 14, 18, 15, 19, 16, 8, 4, 9, 5, 10, 6, 11, 7]);
      expect(skin1.name).to.eql('Armature');
      expect(skin1.skeleton).to.eql(3);
      expect(options1.primitives.length).to.eql(1);
      //
      {
        const geom0 = options1.primitives[0].geometry;
        expect(geom0.mode).to.eql(4);
        expect(geom0.drawCount).to.eql(14016);
        expect(geom0.drawStart).to.eql(0);
        const indexData = geom0.getIndexData();
        expect(indexData.length).to.eql(14016);
        [
          0, 1, 2, 3, 2, 1, 4, 5, 6, 7, 6, 5, 8, 9, 10, 11, 10, 9, 12, 13, 14, 15, 14, 13, 16, 17, 18, 19, 18, 17, 20, 21, 15, 14, 15, 21, 22, 23, 24,
          25, 24, 23, 26, 27, 28, 29, 28, 27, 30, 31, 32, 33, 32, 31, 34, 35, 36, 37, 36, 35, 38, 39, 40, 41, 40, 39, 42, 43, 44, 45, 44, 43, 46, 47,
          48, 49, 48, 47, 50, 51, 52, 53, 52, 51, 54, 55, 56, 57, 56, 55, 58, 59, 60, 61, 60, 59, 62, 63, 64, 65,
        ].forEach((v, i) => {
          expect(v).to.eql(indexData[i]);
        });

        expect(geom0.getAttributeNames()).to.eql(['aPos', 'aNormal', 'aUV', 'aJoints', 'aWeights']);
        const posAttrib0 = geom0.attributes['aPos'];
        expect(posAttrib0.size).to.eql(3);
        expect(posAttrib0.type).to.eql(5126);
        expect(posAttrib0.normalize).to.eql(false);
        const posData0 = geom0.getAttributeData('aPos');
        expect(posData0.length).to.eql(9819);
        [
          0.09342920035123825, 0.048714570701122284, 0.9735749959945679, 0.07329291105270386, 0.08925402164459229, 0.9775350093841553, 0.0848226472735405,
          0.04660588130354881, 1.0469099283218384, 0.0763043686747551, 0.0814896821975708, 1.0501099824905396, 0.1562570035457611, 0.5175288915634155,
          0.844681978225708, 0.16423200070858002, 0.5041099190711975, 0.8343349695205688, 0.17022499442100525, 0.545353889465332, 0.8108369708061218,
          0.1809539943933487, 0.5468019247055054, 0.7949069738388062, 0.10521499812602997, 0.5284019112586975, 0.802294135093689, 0.09775196760892868,
          0.5415329337120056, 0.8128079771995544, 0.13724100589752197, 0.5518779158592224, 0.7846001386642456, 0.1427379995584488, 0.5683138966560364,
          0.7825331091880798, 0.1562570035457611, -0.5175291299819946, 0.8446819186210632, 0.1317799985408783, -0.5342841148376465, 0.8410660028457642,
          0.17022499442100525, -0.5453541278839111, 0.810836911201477, 0.1628299057483673, -0.5645990967750549, 0.7979189157485962, 0.10521499812602997,
          -0.5284020900726318, 0.8022940158843994, 0.1302040070295334, -0.5113590955734253, 0.806075930595398, 0.13724100589752197, -0.5518780946731567,
        ].forEach((v, i) => {
          expect(posData0[i]).closeTo(v, 1e-5);
        });
        const normAttrib0 = geom0.attributes['aNormal'];
        expect(normAttrib0.size).to.eql(3);
        expect(normAttrib0.type).to.eql(5126);
        expect(normAttrib0.normalize).to.eql(false);
        const normData0 = geom0.getAttributeData('aNormal');
        expect(normData0.length).to.eql(9819);
        [
          0.9666681289672852, 0.2427504062652588, 0.08139491081237793, 0.5926201343536377, 0.8049721121788025, 0.028657428920269012, 0.9823477268218994,
          0.1454842984676361, 0.11758999526500702, 0.7848681807518005, 0.6137763261795044, 0.08521020412445068, 0.6377003192901611, 0.38060590624809265,
          0.6696845889091492, 0.9406952261924744, -0.2989667057991028, 0.1603481024503708, 0.6337714791297913, 0.45993149280548096, 0.6219298839569092,
          0.9917799830436707, -0.0022278418764472008, -0.12793609499931335, -0.4683813154697418, -0.12970750033855438, -0.8739537000656128, -0.6921759247779846,
          0.620516836643219, -0.3685806095600128, -0.3818897008895874, -0.1392296999692917, -0.9136604070663452, -0.34664180874824524, 0.7513930201530457,
          -0.5614694356918335, 0.6377003192901611, -0.38060590624809265, 0.6696845889091492, 0.1844877004623413, -0.7153974175453186, 0.6739220023155212,
          0.6337714791297913, -0.45993149280548096, 0.6219298839569092, 0.31215381622314453, -0.8252788186073303, 0.47061121463775635, -0.4683813154697418,
        ].forEach((v, i) => {
          expect(v).closeTo(normData0[i], 1e-5);
        });
        const uvAttrib0 = geom0.attributes['aUV'];
        expect(uvAttrib0.size).to.eql(2);
        expect(uvAttrib0.type).to.eql(5126);
        expect(uvAttrib0.normalize).to.eql(false);
        const uvData0 = geom0.getAttributeData('aUV');
        expect(uvData0.length).to.eql(6546);
        [
          0.2736569941043854, 0.8036180138587952, 0.3031649887561798, 0.799481987953186, 0.2714029848575592, 0.7648169994354248, 0.29099100828170776,
          0.7632129788398743, 0.8410069942474365, 0.12983697652816772, 0.839942991733551, 0.14197897911071777, 0.8812209963798523, 0.1381869912147522,
          0.880325973033905, 0.14522004127502441, 0.8591259717941284, 0.0766339898109436, 0.8540779948234558, 0.08584398031234741, 0.8945890069007874,
          0.09953099489212036, 0.8917419910430908, 0.105663001537323, 0.5697129964828491, 0.3033990263938904, 0.5861039757728577, 0.3002550005912781,
          0.5618900060653687, 0.2626950144767761, 0.577551007270813, 0.2682049870491028, 0.5070399641990662, 0.3006790280342102, 0.5272729992866516,
          0.3023719787597656, 0.5198910236358643, 0.260748028755188, 0.5338389873504639, 0.26270800828933716, 0.5737109780311584, 0.2531500458717346,
        ].forEach((v, i) => {
          expect(v).closeTo(uvData0[i], 1e-5);
        });
        const jointAttrib0 = geom0.attributes['aJoints'];
        expect(jointAttrib0.size).to.eql(4);
        expect(jointAttrib0.type).to.eql(5123);
        expect(jointAttrib0.normalize).to.eql(false);
        const jointData0 = geom0.getAttributeData('aJoints');
        expect(jointData0.length).to.eql(13092);
        [
          0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 7, 9, 0, 0, 7, 9, 0, 0, 9, 0, 0, 0, 9, 0, 0, 0, 7, 9, 0, 0, 7, 9, 0, 0,
          9, 0, 0, 0, 9, 0, 0, 0, 8, 10, 0, 0, 8, 10, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 8, 10, 0, 0, 8, 10, 0, 0, 10, 0, 0, 0, 10,
          0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 13, 15, 17, 0, 13, 15, 17, 0, 13, 15, 17, 0,
        ].forEach((v, i) => {
          expect(v).closeTo(jointData0[i], 1e-5);
        });
        const weightAttrib0 = geom0.attributes['aWeights'];
        expect(weightAttrib0.size).to.eql(4);
        expect(weightAttrib0.type).to.eql(5126);
        expect(weightAttrib0.normalize).to.eql(false);
        const weightData0 = geom0.getAttributeData('aWeights');
        expect(weightData0.length).to.eql(13092);
        [
          0.17160889506340027, 0.6451614499092102, 0.13225100934505463, 0.05097858980298042, 0.2263036072254181, 0.5693775415420532, 0.160634845495224,
          0.043683916330337524, 0.08763298392295837, 0.33597317337989807, 0.4061647951602936, 0.17022907733917236, 0.11152446269989014, 0.28163453936576843,
          0.4927929639816284, 0.1140480786561966, 0.07008665800094604, 0.929913341999054, 0, 0, 0.0653330609202385, 0.9346669316291809, 0, 0, 1, 0, 0, 0, 1,
          0, 0, 0, 0.020963601768016815, 0.9790363907814026, 0, 0, 0.04044990986585617, 0.9595500826835632, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.07369416207075119,
          0.9263058304786682, 0, 0, 0.06026321277022362, 0.9397367835044861, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.021401280537247658, 0.9785987138748169, 0, 0,
          0.03885405883193016, 0.9611459374427795, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.20391489565372467, 0.4302911162376404,
          0.36579400300979614, 0, 0.43764400482177734, 0.2858009934425354, 0.27655500173568726, 0, 0.21779599785804749, 0.4381909966468811, 0.3440130054950714,
        ].forEach((v, i) => {
          expect(v).closeTo(weightData0[i], 1e-5);
        });
        const mat0 = options1.primitives[0].material;
        expect(mat0.alphaCutOff).to.eql(0.5);
        expect(mat0.baseColorFactor).to.eql([255, 255, 255, 255]);
        expect(mat0.baseColorTexture).not.eql(undefined);
        expect(mat0.baseColorTextureCoordinate).to.eql(0);
        expect(mat0.depthMask).to.eql(true);
        expect(mat0.blending).to.eql(100);
        expect(mat0.emissiveFactor).to.eql([0, 0, 0, 1]);
        expect(mat0.emissiveIntensity).to.eql(1);
        expect(mat0.emissiveTexture).to.eql(undefined);
        expect(mat0.metallicFactor).to.eql(0);
        expect(mat0.metallicRoughnessTexture).to.eql(undefined);
        expect(mat0.name).to.eql('Cesium_Man-effect');
        expect(mat0.normalTexture).to.eql(undefined);
        expect(mat0.occlusionTexture).to.eql(undefined);
        expect(mat0.roughnessFactor).to.eql(1);
        expect(mat0.side).to.eql(1028);
        expect(mat0.type).to.eql('pbr');
      }
    }
  });

  it('Test DamagedHelmet glb material', async function () {
    const gltfLoader = new LoaderImplEx();
    const result = await gltfLoader.loadScene({
      gltf: {
        resource: 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/DamagedHelmet.glb',
      },
      effects: {
        duration: 5.0,
        endBehavior: spec.EndBehavior.freeze,
        playAnimation: 0,
      },
    });

    result.sceneAABB.max.forEach((v, i) => { expect([0.9424954056739807, 0.9009951949119568, 0.8128453493118286][i]).closeTo(v, 1e-5); });
    result.sceneAABB.min.forEach((v, i) => { expect([-0.9474585652351379, -0.9009741544723511, -1.1871552467346191][i]).closeTo(v, 1e-5); });
    const items = result.jsonScene.items;
    expect(items.length).to.eql(2);
    const tree = items[0];
    expect(tree.duration).to.eql(5);
    expect(tree.endBehavior).to.eql(2);
    expect(tree.id).to.eql('sceneTree');
    expect(tree.type).to.eql('tree');
    const treeOptions = tree.content.options.tree;
    expect(treeOptions.animation).to.eql(-1);
    expect(treeOptions.animations.length).to.eql(0);
    expect(treeOptions.children.length).to.eql(1);
    expect(treeOptions.children[0]).to.eql(0);
    expect(treeOptions.nodes.length).to.eql(1);
    const treeNodes = treeOptions.nodes;
    {
      const node0 = treeNodes[0];
      expect(node0.children).to.eql([]);
      expect(node0.id).to.eql('0');
      expect(node0.transform.position).to.eql([0, 0, 0]);
      [0.7071068286895752, 0, 0, 0.7071067094802856].forEach((v, i) => {
        expect(node0.transform.quat[i]).closeTo(v, 1e-5);
      });
      [1, 1.0000001192092896, 1.0000001192092896].forEach((v, i) => {
        expect(node0.transform.scale[i]).closeTo(v, 1e-5);
      });
    }
    {
      const item = items[1];
      const interaction1 = item.content.interaction;
      expect(interaction1.type).to.eql(2);
      [1.8899539709091187, 2, 1.8019688129425049].forEach((v, i) => {
        expect(interaction1.size[i]).closeTo(v, 1e-5);
      });
      [-0.0024815797805786133, -0.18715494871139526, -0.000010520219802856445].forEach((v, i) => {
        expect(interaction1.center[i]).closeTo(v, 1e-5);
      });
      expect(item.type).to.eql('mesh');
      expect(item.parentId).to.eql('sceneTree^0');
      expect(item.id).to.eql('mesh_ni0_mi0');
      expect(item.name).to.eql('mesh_helmet_LP_13930damagedHelmet');
      const options1 = item.content.options;
      expect(options1.skin).to.eql(undefined);
      expect(options1.primitives.length).to.eql(1);
      //
      {
        const geom0 = options1.primitives[0].geometry;
        expect(geom0.mode).to.eql(4);
        expect(geom0.drawCount).to.eql(46356);
        expect(geom0.drawStart).to.eql(0);
        const indexData = geom0.getIndexData();
        expect(indexData.length).to.eql(46356);
        [
          0, 1, 2, 2, 3, 0, 3, 2, 4, 4, 5, 3, 6, 5, 4, 4, 7, 6, 6, 7, 8, 8, 9, 6, 10, 9, 8, 8, 11, 10, 12, 0, 3, 13, 14,
          15, 15, 16, 13, 17, 15, 14, 14, 18, 17, 15, 17, 19, 19, 20, 15, 16, 15, 20, 20, 21, 16, 22, 17, 18, 19, 17, 22,
          18, 23, 22, 22, 24, 19, 25, 12, 26, 26, 27, 25, 28, 25, 27, 3, 26, 12, 29, 30, 31, 31, 32, 29, 30, 3, 5, 5, 31,
          30, 31, 5, 6, 6, 33, 31, 32,
        ].forEach((v, i) => {
          expect(v).to.eql(indexData[i]);
        });

        expect(geom0.getAttributeNames()).to.eql(['aPos', 'aNormal', 'aUV']);
        const posAttrib0 = geom0.attributes['aPos'];
        expect(posAttrib0.size).to.eql(3);
        expect(posAttrib0.type).to.eql(5126);
        expect(posAttrib0.normalize).to.eql(false);
        const posData0 = geom0.getAttributeData('aPos');
        expect(posData0.length).to.eql(43668);
        [
          -0.6119945645332336, -0.03094087541103363, 0.48309004306793213, -0.5795046091079712, 0.05627411603927612, 0.5217580199241638, -0.5735836029052734,
          0.06353411078453064, 0.4868580102920532, -0.607602596282959, -0.00806187093257904, 0.44481396675109863, -0.5670265555381775, 0.06567209959030151,
          0.4712430238723755, -0.5985676050186157, -0.0024888813495635986, 0.4318169951438904, -0.5851945877075195, -0.0013338923454284668, 0.42213696241378784,
          -0.5542175769805908, 0.06287011504173279, 0.46076399087905884, -0.5360195636749268, 0.05218614637851715, 0.45573097467422485, -0.5673995614051819,
          -0.005817890167236328, 0.41637301445007324, -0.5473926067352295, -0.013118892908096313, 0.41256600618362427, -0.5151275992393494, 0.03756110370159149,
          0.45342200994491577, -0.6319825649261475, -0.06129187345504761, 0.43657299876213074, -0.6119945645332336, -0.03094087541103363, 0.48309004306793213,
          -0.6319825649261475, -0.06129187345504761, 0.43657299876213074, -0.6320706009864807, -0.07891987264156342, 0.434114009141922, -0.6197935938835144,
          -0.057003870606422424, 0.4651700258255005, -0.6435065865516663, -0.09896757453680038, 0.4048750102519989, -0.64644455909729, -0.08500387519598007,
          0.40248000621795654, -0.6360005736351013, -0.111687071621418, 0.40788400173187256, -0.6311585903167725, -0.09822237491607666, 0.42638999223709106,
        ].forEach((v, i) => {
          expect(posData0[i]).closeTo(v, 1e-5);
        });
        const normAttrib0 = geom0.attributes['aNormal'];
        expect(normAttrib0.size).to.eql(3);
        expect(normAttrib0.type).to.eql(5126);
        expect(normAttrib0.normalize).to.eql(false);
        const normData0 = geom0.getAttributeData('aNormal');
        expect(normData0.length).to.eql(43668);
        [
          -0.9183019399642944, 0.38380077481269836, 0.09683523327112198, -0.9186681509017944, 0.3896298110485077, -0.06460768729448318, -0.8807947039604187,
          0.4447767436504364, -0.16220587491989136, -0.8651387095451355, 0.4983367323875427, -0.05630664899945259, -0.669911801815033, 0.5472273826599121,
          -0.5016937851905823, -0.6314279437065125, 0.6502273678779602, -0.42243722081184387, -0.27567368745803833, 0.6762291193008423, -0.6831263303756714,
          -0.20352794229984283, 0.5299538969993591, -0.8232062458992004, 0.11267434060573578, 0.4684591293334961, -0.8762474656105042, -0.006439405493438244,
          0.6433606743812561, -0.765526294708252, 0.08359019458293915, 0.6316720843315125, -0.7706839442253113, 0.23581652343273163, 0.4520401656627655,
          -0.8602557182312012, -0.9127170443534851, 0.38621172308921814, 0.13324381411075592, -0.9242225289344788, -0.0029602954164147377, 0.3817560374736786,
          -0.905270516872406, -0.05859553813934326, 0.4206976592540741, -0.8821375370025635, -0.14719076454639435, 0.44734030961990356, -0.9366741180419922,
          0.024384289979934692, 0.3492843508720398, -0.8547624349594116, -0.23175756633281708, 0.46433910727500916, -0.8977935314178467, -0.11560411751270294,
        ].forEach((v, i) => {
          expect(v).closeTo(normData0[i], 1e-5);
        });
        const uvAttrib0 = geom0.attributes['aUV'];
        expect(uvAttrib0.size).to.eql(2);
        expect(uvAttrib0.type).to.eql(5126);
        expect(uvAttrib0.normalize).to.eql(false);
        const uvData0 = geom0.getAttributeData('aUV');
        expect(uvData0.length).to.eql(29112);
        [
          0.7046859860420227, 1.2456040382385254, 0.6757779717445374, 1.2566219568252563, 0.6726840138435364, 1.2459670305252075, 0.697708010673523,
          1.2331379652023315, 0.6710209846496582, 1.24093496799469, 0.6947129964828491, 1.22878897190094, 0.6917359828948975, 1.224599003791809,
          0.6692789793014526, 1.2360399961471558, 0.6675440073013306, 1.2296160459518433, 0.6884310245513916, 1.2197439670562744, 0.6847599744796753,
          1.2142789363861084, 0.6657149791717529, 1.2219899892807007, 0.7164490222930908, 1.2314040660858154, 0.7046859860420227, 1.2456040382385254,
          0.7164490222930908, 1.2314040660858154, 0.7221109867095947, 1.2313640117645264, 0.7139490246772766, 1.2409440279006958, 0.729640007019043,
          1.2223399877548218, 0.7253419756889343, 1.22092604637146, 0.7338659763336182, 1.224485993385315, 0.7284939885139465, 1.2301199436187744,
          0.7229130268096924, 1.2364610433578491, 0.745809018611908, 1.199193000793457, 0.7424389719963074, 1.197383999824524, 0.7486990094184875,
          1.200708031654358, 0.7253419756889343, 1.22092604637146, 0.7084609866142273, 1.2246500253677368, 0.7172520160675049, 1.2156469821929932,
          0.7424389719963074, 1.197383999824524, 0.7172520160675049, 1.2156469821929932, 0.7084609866142273, 1.2246500253677368, 0.7051569819450378,
        ].forEach((v, i) => {
          expect(v).closeTo(uvData0[i], 1e-5);
        });
        const mat0 = options1.primitives[0].material;
        expect(mat0.alphaCutOff).to.eql(0.5);
        expect(mat0.baseColorFactor).to.eql([255, 255, 255, 255]);
        expect(mat0.baseColorTexture).not.eql(undefined);
        expect(mat0.baseColorTextureCoordinate).to.eql(0);
        expect(mat0.depthMask).to.eql(true);
        expect(mat0.blending).to.eql(100);
        expect(mat0.emissiveFactor).to.eql([255, 255, 255, 1]);
        expect(mat0.emissiveIntensity).to.eql(1);
        expect(mat0.emissiveTexture).not.eql(undefined);
        expect(mat0.emissiveTextureCoordinate).to.eql(0);
        expect(mat0.metallicFactor).to.eql(1);
        expect(mat0.metallicRoughnessTexture).not.eql(undefined);
        expect(mat0.metallicRoughnessTextureCoordinate).to.eql(0);
        expect(mat0.name).to.eql('Material_MR');
        expect(mat0.normalTexture).not.eql(undefined);
        expect(mat0.normalTextureCoordinate).to.eql(0);
        expect(mat0.normalTextureScale).to.eql(1);
        expect(mat0.occlusionTextureStrength).to.eql(1);
        expect(mat0.occlusionTexture).not.eql(undefined);
        expect(mat0.roughnessFactor).to.eql(1);
        expect(mat0.side).to.eql(1028);
        expect(mat0.type).to.eql('pbr');
      }
    }
  });

  it('Test blend material', async function () {
    {
      const gltfLoader = new LoaderImplEx();
      const result = await gltfLoader.loadScene({
        gltf: {
          resource: 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/fish_test.glb',
        },
        effects: {
          duration: 5.0,
          endBehavior: spec.EndBehavior.freeze,
          playAnimation: 0,
        },
      });

      result.sceneAABB.max.forEach((v, i) => { expect([0.23471057415008545, 0.656415581703186, 0.9998422265052795][i]).closeTo(v, 1e-5); });
      result.sceneAABB.min.forEach((v, i) => { expect([-0.23471057415008545, 0.0004017949104309082, -0.9998422265052795][i]).closeTo(v, 1e-5); });
      const items = result.jsonScene.items;
      expect(items.length).to.eql(2);
      {
        const item = items[1];
        const interaction1 = item.content.interaction;
        expect(interaction1.type).to.eql(2);
        expect(interaction1.size).to.eql([1.9996846914291382, 0.6560137867927551, 0.4694211483001709]);
        expect(interaction1.center).to.eql([0, 0, 0]);
        expect(item.type).to.eql('mesh');
        expect(item.parentId).to.eql('sceneTree^36');
        expect(item.id).to.eql('mesh_ni36_mi0');
        expect(item.name).to.eql('bwcy');
        const options1 = item.content.options;
        const skin1 = options1.skin;
        expect(skin1.inverseBindMatrices.length).to.eql(496);
        [
          0.9990679621696472, 0.043166499584913254, 5.858915646501665e-17, 0, -0.043166499584913254, 0.9990679621696472, 5.707512622403506e-20, 0, -5.853208762019539e-17,
          -2.5861107019755866e-18, 1, 0, 0.45603033900260925, -0.037095554172992706, -1.2032553829181178e-18, 1, 0.9990679621696472, 0.043166499584913254, 5.858915646501665e-17,
          0, -0.043166499584913254, 0.9990679621696472, 5.707512622403506e-20, 0, -5.853208762019539e-17, -2.5861107019755866e-18, 1, 0, 0.29127123951911926,
          -0.037095554172992706, -7.677666072976048e-19, 1, 0.9990679621696472, 0.043166499584913254, 5.858915646501665e-17, 0, -0.043166499584913254, 0.9990679621696472,
          5.707512622403506e-20, 0, -5.853208762019539e-17, -2.5861107019755866e-18, 1, 0, 0.1331741213798523, -0.037095554172992706, -3.498866457619675e-19, 1,
          0.9990679621696472, 0.043166499584913254, 5.858915646501665e-17, 0, -0.043166499584913254, 0.9990679621696472, 5.707512622403506e-20, 0, -5.853208762019539e-17,
          -2.5861107019755866e-18, 1, 0, -0.02580631524324417, -0.037095554172992706, 7.032810413843456e-20, 1, 0.9990679621696472, 0.043166499584913254, 5.858915646501665e-17,
          0, -0.043166499584913254, 0.9990679621696472, 5.707512622403506e-20, 0, -5.853208762019539e-17, -2.5861107019755866e-18, 1, 0, -0.17794735729694366, -0.037095554172992706,
          4.724650931701287e-19, 1, 0.9990679621696472, 0.043166499584913254, 5.858915646501665e-17, 0, -0.043166499584913254, 0.9990679621696472, 5.707512622403506e-20,
        ].forEach((v, i) => {
          expect(v).to.eql(skin1.inverseBindMatrices[i]);
        });
        expect(skin1.joints.length).to.eql(31);
        expect(skin1.joints).to.eql([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34]);
        expect(skin1.skeleton).to.eql(4);
        expect(options1.primitives.length).to.eql(1);
        //
        {
          const mat0 = options1.primitives[0].material;
          expect(mat0.alphaCutOff).to.eql(0.5);
          expect(mat0.baseColorFactor).to.eql([255, 255, 255, 255]);
          expect(mat0.baseColorTexture).not.eql(undefined);
          expect(mat0.baseColorTextureCoordinate).to.eql(0);
          expect(mat0.depthMask).to.eql(true);
          expect(mat0.blending).to.eql(102);
          expect(mat0.emissiveFactor).to.eql([0, 0, 0, 1]);
          expect(mat0.emissiveIntensity).to.eql(1);
          expect(mat0.emissiveTexture).to.eql(undefined);
          expect(mat0.metallicFactor).to.eql(0.200000002980232);
          expect(mat0.metallicRoughnessTexture).to.eql(undefined);
          expect(mat0.name).to.eql('surfaceShader1');
          expect(mat0.normalTexture).to.eql(undefined);
          expect(mat0.normalTextureScale).to.eql(1);
          expect(mat0.occlusionTextureStrength).to.eql(1);
          expect(mat0.occlusionTexture).to.eql(undefined);
          expect(mat0.roughnessFactor).to.eql(0.800000011920929);
          expect(mat0.side).to.eql(1028);
          expect(mat0.type).to.eql('pbr');
        }
      }
    }
    {
      const gltfLoader = new LoaderImplEx();
      const result = await gltfLoader.loadScene({
        gltf: {
          resource: 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/plane_blend.glb',
        },
        effects: {
          duration: 5.0,
          endBehavior: spec.EndBehavior.freeze,
          playAnimation: 0,
        },
      });
      const items = result.jsonScene.items;
      expect(items.length).to.eql(7);
      {
        const item = items[1];
        expect(item.type).to.eql('light');
        expect(item.parentId).to.eql('sceneTree^2');
        expect(item.id).to.eql('light_ni2_li0');
        expect(item.name).to.eql('light');
        const options1 = item.content.options;
        expect(options1.color).to.eql([255, 255, 255, 255]);
        expect(options1.intensity).to.eql(0.5299999713897705);
        expect(options1.lightType).to.eql('directional');
      }
      {
        const item = items[2];
        expect(item.type).to.eql('light');
        expect(item.parentId).to.eql('sceneTree^3');
        expect(item.id).to.eql('light_ni3_li1');
        expect(item.name).to.eql('light');
        const options1 = item.content.options;
        expect(options1.color).to.eql([255, 255, 255, 255]);
        expect(options1.intensity).to.eql(0.30000001192092896);
        expect(options1.lightType).to.eql('directional');
      }
      {
        const item = items[3];
        expect(item.type).to.eql('mesh');
        expect(item.parentId).to.eql('sceneTree^5');
        expect(item.id).to.eql('mesh_ni5_mi0');
        expect(item.name).to.eql('shelf');
        const options1 = item.content.options;
        expect(options1.primitives.length).to.eql(1);
        //
        {
          const mat0 = options1.primitives[0].material;
          expect(mat0.alphaCutOff).to.eql(0.5);
          expect(mat0.baseColorFactor).to.eql([194.858505, 161.260504425, 113.05469523, 255]);
          expect(mat0.baseColorTexture).to.eql(undefined);
          expect(mat0.depthMask).to.eql(true);
          expect(mat0.blending).to.eql(100);
          expect(mat0.emissiveFactor).to.eql([0, 0, 0, 1]);
          expect(mat0.emissiveIntensity).to.eql(1);
          expect(mat0.emissiveTexture).to.eql(undefined);
          expect(mat0.metallicFactor).to.eql(0.8600000143051147);
          expect(mat0.metallicRoughnessTexture).to.eql(undefined);
          expect(mat0.name).to.eql('New Material');
          expect(mat0.normalTexture).to.eql(undefined);
          expect(mat0.normalTextureScale).to.eql(1);
          expect(mat0.occlusionTextureStrength).to.eql(1);
          expect(mat0.occlusionTexture).to.eql(undefined);
          expect(mat0.roughnessFactor).to.eql(0.8999999985098839);
          expect(mat0.side).to.eql(1028);
          expect(mat0.type).to.eql('pbr');
        }
      }
      {
        const item = items[4];
        expect(item.type).to.eql('mesh');
        expect(item.parentId).to.eql('sceneTree^6');
        expect(item.id).to.eql('mesh_ni6_mi1');
        expect(item.name).to.eql('glow_01');
        const options1 = item.content.options;
        expect(options1.primitives.length).to.eql(1);
        //
        {
          const mat0 = options1.primitives[0].material;
          expect(mat0.alphaCutOff).to.eql(0.5);
          expect(mat0.baseColorFactor).to.eql([255, 255, 255, 255]);
          expect(mat0.baseColorTexture).not.eql(undefined);
          expect(mat0.baseColorTextureCoordinate).to.eql(0);
          expect(mat0.depthMask).to.eql(true);
          expect(mat0.blending).to.eql(102);
          expect(mat0.name).to.eql('New Material 1');
          expect(mat0.side).to.eql(1032);
          expect(mat0.type).to.eql('unlit');
        }
      }
      {
        const item = items[5];
        expect(item.type).to.eql('mesh');
        expect(item.parentId).to.eql('sceneTree^7');
        expect(item.id).to.eql('mesh_ni7_mi2');
        expect(item.name).to.eql('glow_03');
        const options1 = item.content.options;
        expect(options1.primitives.length).to.eql(1);
        //
        {
          const mat0 = options1.primitives[0].material;
          expect(mat0.alphaCutOff).to.eql(0.5);
          expect(mat0.baseColorFactor).to.eql([255, 255, 255, 255]);
          expect(mat0.baseColorTexture).not.eql(undefined);
          expect(mat0.baseColorTextureCoordinate).to.eql(0);
          expect(mat0.depthMask).to.eql(true);
          expect(mat0.blending).to.eql(102);
          expect(mat0.name).to.eql('New Material2');
          expect(mat0.side).to.eql(1032);
          expect(mat0.type).to.eql('unlit');
        }
      }
    }
  });

  it('Test mask material', async function () {
    {
      const gltfLoader = new LoaderImplEx();
      const result = await gltfLoader.loadScene({
        gltf: {
          resource: 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/torch_mask.glb',
        },
        effects: {
          duration: 5.0,
          endBehavior: spec.EndBehavior.freeze,
          playAnimation: 0,
        },
      });

      result.sceneAABB.max.forEach((v, i) => { expect([0.046618688851594925, 0.375296026468277, 0.047841183841228485][i]).closeTo(v, 1e-5); });
      result.sceneAABB.min.forEach((v, i) => { expect([-0.04690181463956833, -0.3588564991950989, -0.046336669474840164][i]).closeTo(v, 1e-5); });
      const items = result.jsonScene.items;
      expect(items.length).to.eql(7);
      {
        const item = items[1];
        expect(item.type).to.eql('light');
        expect(item.parentId).to.eql('sceneTree^3');
        expect(item.id).to.eql('light_ni3_li0');
        expect(item.name).to.eql('light');
        const options1 = item.content.options;
        expect(options1.color).to.eql([255, 255, 255, 255]);
        expect(options1.intensity).to.eql(0.6000000238418579);
        expect(options1.lightType).to.eql('directional');
      }
      {
        const item = items[2];
        expect(item.type).to.eql('light');
        expect(item.parentId).to.eql('sceneTree^4');
        expect(item.id).to.eql('light_ni4_li1');
        expect(item.name).to.eql('light');
        const options1 = item.content.options;
        expect(options1.color).to.eql([255, 255, 255, 255]);
        expect(options1.intensity).to.eql(2);
        expect(options1.lightType).to.eql('spot');
        expect(options1.innerConeAngle).to.eql(0);
        expect(options1.outerConeAngle).to.eql(0.16929693280306246);
        expect(options1.range).to.eql(2.6500000953674316);
      }
      {
        const item = items[3];
        expect(item.type).to.eql('light');
        expect(item.parentId).to.eql('sceneTree^5');
        expect(item.id).to.eql('light_ni5_li2');
        expect(item.name).to.eql('light');
        const options1 = item.content.options;
        expect(options1.color).to.eql([255, 255, 255, 255]);
        expect(options1.intensity).to.eql(0.5);
        expect(options1.lightType).to.eql('point');
        expect(options1.range).to.eql(10);
      }
      {
        const item = items[4];
        expect(item.type).to.eql('light');
        expect(item.parentId).to.eql('sceneTree^6');
        expect(item.id).to.eql('light_ni6_li3');
        expect(item.name).to.eql('light');
        const options1 = item.content.options;
        expect(options1.color).to.eql([255, 255, 255, 255]);
        expect(options1.intensity).to.eql(0.5);
        expect(options1.lightType).to.eql('point');
        expect(options1.range).to.eql(10);
      }
      {
        const item = items[5];
        expect(item.type).to.eql('light');
        expect(item.parentId).to.eql('sceneTree^7');
        expect(item.id).to.eql('light_ni7_li4');
        expect(item.name).to.eql('light');
        const options1 = item.content.options;
        expect(options1.color).to.eql([255, 255, 255, 255]);
        expect(options1.intensity).to.eql(0.5);
        expect(options1.lightType).to.eql('point');
        expect(options1.range).to.eql(5);
      }
      {
        const item = items[6];
        expect(item.type).to.eql('mesh');
        expect(item.parentId).to.eql('sceneTree^8');
        expect(item.id).to.eql('mesh_ni8_mi0');
        expect(item.name).to.eql('MS_YCYH_Torch');
        const options1 = item.content.options;
        expect(options1.primitives.length).to.eql(2);
        //
        {
          const geom0 = options1.primitives[1].geometry;
          expect(geom0.mode).to.eql(4);
          expect(geom0.drawCount).to.eql(66756);
          expect(geom0.drawStart).to.eql(0);
          const indexData = geom0.getIndexData();
          expect(indexData.length).to.eql(66756);
          [
            782, 781, 780, 785, 784, 783, 787, 786, 783, 788, 787, 783, 789, 786, 787, 789, 790, 786, 791, 790, 789, 792, 791, 789, 791, 792, 793, 791, 793,
            794, 795, 791, 794, 794, 796, 795, 796, 797, 795, 797, 796, 798, 799, 797, 798, 800, 789, 787, 801, 789, 800, 801, 800, 802, 803, 801, 802, 800,
            804, 802, 804, 805, 802, 805, 806, 802, 805, 807, 806, 807, 808, 806, 807, 809, 808, 809, 810, 808, 809, 811, 810, 811, 812, 810, 811, 813, 812,
            813, 814, 812, 803, 802, 815, 816, 803, 815, 802, 817, 815, 818,
          ].forEach((v, i) => {
            expect(v).to.eql(indexData[i]);
          });

          expect(geom0.getAttributeNames()).to.eql(['aPos', 'aNormal', 'aTangent', 'aUV', 'aUV2']);
          const posAttrib0 = geom0.attributes['aPos'];
          expect(posAttrib0.size).to.eql(3);
          expect(posAttrib0.type).to.eql(5126);
          expect(posAttrib0.normalize).to.eql(false);
          const posData0 = geom0.getAttributeData('aPos');
          expect(posData0.length).to.eql(72945);
          [
            -0.003058979520574212, 0.0921643078327179, 0.02988342195749283, 0.003241629572585225, 0.16409727931022644, 0.03475647047162056, 0.0026272486429661512,
            0.0921643078327179, 0.029975280165672302, -0.0029296944849193096, 0.16409727931022644, 0.034754637628793716, -0.00866133626550436, 0.0921643078327179,
            0.029277343302965164, -0.008935040794312954, 0.16409727931022644, 0.03427429124712944, -0.013957414776086807, 0.0921643078327179, 0.028331298381090164,
            -0.014605045318603516, 0.16409727931022644, 0.03347412124276161, -0.018731575459241867, 0.0921643078327179, 0.027103576809167862, -0.0200986098498106,
            0.16409727931022644, 0.032283324748277664, -0.021768148988485336, 0.0921643078327179, 0.025528868660330772, -0.02406131662428379, 0.16409727931022644,
            0.0303802490234375, -0.024280203506350517, 0.0921643078327179, 0.02355194091796875, -0.027496851980686188, 0.16409727931022644, 0.027756957337260246,
            -0.02617528848350048, 0.0921643078327179, 0.0210272204130888, -0.03009176254272461, 0.16409727931022644, 0.02426757849752903, -0.027548331767320633,
            0.0921643078327179, 0.018092650920152664, -0.031862180680036545, 0.16409727931022644, 0.0203704833984375, -0.02871049754321575, 0.0921643078327179,
            0.013479919172823429, -0.033176153898239136, 0.16409727931022644, 0.014971313066780567, -0.02950466051697731, 0.0921643078327179, 0.008319091983139515,
          ].forEach((v, i) => {
            expect(posData0[i]).closeTo(v, 1e-5);
          });
          const normAttrib0 = geom0.attributes['aNormal'];
          expect(normAttrib0.size).to.eql(3);
          expect(normAttrib0.type).to.eql(5126);
          expect(normAttrib0.normalize).to.eql(false);
          const normData0 = geom0.getAttributeData('aNormal');
          expect(normData0.length).to.eql(72945);
          [
            -0.050654299557209015, -0.06762711703777313, 0.9964240193367004, 0.03568694368004799, -0.0668693259358406, 0.9971233010292053, 0.03534643352031708,
            -0.0668700635433197, 0.9971354007720947, -0.05037063732743263, -0.06762269884347916, 0.99643874168396, -0.12512019276618958, -0.06937088072299957,
            0.9897134304046631, -0.12491896003484726, -0.06936390697956085, 0.9897393584251404, -0.19301743805408478, -0.07169977575540543, 0.9785721302032471,
            -0.1927870810031891, -0.07169201970100403, 0.9786181449890137, -0.3389774560928345, -0.07369665801525116, 0.9379035830497742, -0.33806607127189636,
            -0.07369370013475418, 0.9382326602935791, -0.5300662517547607, -0.07365001738071442, 0.84475177526474, -0.529125452041626, -0.07365304231643677,
            0.8453410267829895, -0.7118591666221619, -0.07242434471845627, 0.6985780596733093, -0.710614800453186, -0.07244087755680084, 0.699842095375061,
            -0.8578882217407227, -0.06955403089523315, 0.5091069936752319, -0.8571493029594421, -0.06957245618104935, 0.5103476643562317, -0.9418801665306091,
            -0.06690797209739685, 0.32921865582466125, -0.941483199596405, -0.0669236034154892, 0.33034902811050415, -0.9785513281822205, -0.06493522226810455,
            0.19550122320652008, -0.9784598350524902, -0.06494059413671494, 0.19595716893672943, -0.9911305904388428, -0.06432013213634491, 0.11628905683755875,
          ].forEach((v, i) => {
            expect(v).closeTo(normData0[i], 1e-5);
          });
          const uvAttrib0 = geom0.attributes['aUV'];
          expect(uvAttrib0.size).to.eql(2);
          expect(uvAttrib0.type).to.eql(5126);
          expect(uvAttrib0.normalize).to.eql(false);
          const uvData0 = geom0.getAttributeData('aUV');
          expect(uvData0.length).to.eql(48630);
          [
            0.4850638210773468, 0.7611932158470154, 0.49748745560646057, 0.9797379374504089, 0.49748745560646057, 0.7611932158470154, 0.4850638210773468, 0.9797379374504089,
            0.47356700897216797, 0.7611932158470154, 0.47356700897216797, 0.9797379374504089, 0.4574553072452545, 0.7611932158470154, 0.4574553072452545, 0.9797379374504089,
            0.4456891417503357, 0.7611932158470154, 0.4456891417503357, 0.9797379374504089, 0.4375079572200775, 0.7611932158470154, 0.4375079572200775, 0.9797379374504089,
            0.4294804334640503, 0.7611932158470154, 0.4294804334640503, 0.9797379374504089, 0.4209543764591217, 0.7611932158470154, 0.4209543764591217, 0.9797379374504089,
            0.41228193044662476, 0.7611932158470154, 0.41228193044662476, 0.9797379374504089, 0.4006049633026123, 0.7611932158470154, 0.4006049633026123, 0.9797379374504089,
            0.38793647289276123, 0.7611932158470154, 0.38793647289276123, 0.9797379374504089, 0.37405315041542053, 0.7611932158470154, 0.37405315041542053, 0.9797379374504089,
            0.35960057377815247, 0.7611932158470154, 0.35960057377815247, 0.9797379374504089, 0.34551456570625305, 0.7611932158470154, 0.34551456570625305, 0.9797379374504089,
            0.3322645127773285, 0.7611932158470154, 0.3322645127773285, 0.9797379374504089, 0.3227611482143402, 0.7611932158470154, 0.3227611482143402, 0.9797379374504089,
            0.312700092792511, 0.7611932158470154, 0.312700092792511, 0.9797379374504089, 0.30442485213279724, 0.7611932158470154, 0.30442485213279724, 0.9797379374504089,
            0.2960265874862671, 0.7611932158470154, 0.2960265874862671, 0.9797379374504089, 0.287934273481369, 0.7611932158470154, 0.287934273481369, 0.9797379374504089,
          ].forEach((v, i) => {
            expect(v).closeTo(uvData0[i], 1e-5);
          });
          const uvAttrib1 = geom0.attributes['aUV2'];
          expect(uvAttrib1.size).to.eql(2);
          expect(uvAttrib1.type).to.eql(5126);
          expect(uvAttrib1.normalize).to.eql(false);
          const uvData1 = geom0.getAttributeData('aUV2');
          expect(uvData1.length).to.eql(48630);
          [
            3.213132619857788, 30.68535041809082, -3.274282932281494, 35.702880859375, -2.6416878700256348, 30.7797794342041, 3.080014944076538,
            35.70083236694336, 8.981598854064941, 30.061050415039062, 9.263410568237305, 35.206024169921875, 14.434693336486816, 29.086944580078125,
            15.101526260375977, 34.38227462768555, 19.35039710998535, 27.822879791259766, 20.757965087890625, 33.1564826965332, 22.47701644897461,
            26.2015380859375, 24.838167190551758, 31.196598052978516, 25.06354331970215, 24.1658878326416, 28.375574111938477, 28.495458602905273,
            27.014812469482422, 21.566545486450195, 31.04741859436035, 24.903047561645508, 28.42858123779297, 18.544919967651367, 32.87031555175781,
            20.89019775390625, 29.62517738342285, 13.795339584350586, 34.223262786865234, 15.331216812133789, 30.442916870117188, 8.481478691101074,
            35.1165771484375, 9.503479957580566, 30.88368797302246, 2.790266275405884, 35.64701843261719, 3.3042967319488525, 30.78082275390625,
            -3.06327223777771, 35.645050048828125, -3.0878355503082275, 30.143590927124023, -8.85049819946289, 35.114925384521484, -9.319671630859375,
            29.14349365234375, -14.338595390319824, 34.22209930419922, -15.213250160217285, 27.791454315185547, -19.297508239746094, 32.85597610473633,
            -20.928747177124023, 26.20148468017578, -22.456382751464844, 30.894926071166992, -25.049781799316406, 24.187238693237305, -25.069326400756836,
          ].forEach((v, i) => {
            expect(v).closeTo(uvData1[i], 1e-5);
          });
          const tanAttrib1 = geom0.attributes['aTangent'];
          expect(tanAttrib1.size).to.eql(4);
          expect(tanAttrib1.type).to.eql(5126);
          expect(tanAttrib1.normalize).to.eql(false);
          const tanData1 = geom0.getAttributeData('aTangent');
          expect(tanData1.length).to.eql(97260);
          [
            0.9987078905105591, 0, 0.050819043070077896, 1, 0.9993630051612854, 0.0024077044799923897, -0.03560563549399376, 1, 0.9993746876716614,
            0.0033876122906804085, -0.0351986400783062, 1, 0.9987271428108215, 0, 0.05043969303369522, 1, 0.9920932650566101, 0.0010895209852606058,
            0.12549741566181183, 1, 0.9921373724937439, -0.0010335668921470642, 0.1251491755247116, 1, 0.9810777306556702, 0.0013392753899097443,
            0.19360974431037903, 1, 0.9811588525772095, -0.0012100838357582688, 0.19319896399974823, 1, 0.9404260516166687, 0.001356329070404172,
            0.33999577164649963, 1, 0.9408178925514221, -0.0011042027035728097, 0.33891087770462036, 1, 0.8470157980918884, 0, 0.5315676331520081, 1,
            0.8476706147193909, 0, 0.5305228233337402, 1, 0.7004061937332153, 0, 0.7137444615364075, 1, 0.701693058013916, 0, 0.7124793529510498, 1,
            0.5103609561920166, 0, 0.8599602580070496, 1, 0.5115733742713928, 0, 0.8592395782470703, 1, 0.32998013496398926, 0, 0.9439877867698669, 1,
            0.3310737609863281, 0, 0.9436048865318298, 1, 0.19592426717281342, 0, 0.980618953704834, 1, 0.19636404514312744, 0, 0.9805310368537903, 1,
            0.1165231242775917, 0, 0.9931880235671997, 1, 0.11682150512933731, 0, 0.9931528568267822, 1, 0.03629347309470177, 0, 0.9993411898612976, 1,
          ].forEach((v, i) => {
            expect(v).closeTo(tanData1[i], 1e-5);
          });

          const mat0 = options1.primitives[1].material;
          expect(mat0.alphaCutOff).to.eql(0.1);
          expect(mat0.baseColorFactor).to.eql([255, 255, 255, 255]);
          expect(mat0.baseColorTexture).not.eql(undefined);
          expect(mat0.baseColorTextureCoordinate).to.eql(0);
          expect(mat0.depthMask).to.eql(true);
          expect(mat0.blending).to.eql(101);
          expect(mat0.emissiveFactor).to.eql([0, 0, 0, 1]);
          expect(mat0.emissiveIntensity).to.eql(1);
          expect(mat0.metallicFactor).to.eql(1);
          expect(mat0.name).to.eql('M_torch2_0');
          expect(mat0.normalTexture).not.eql(undefined);
          expect(mat0.normalTextureCoordinate).to.eql(0);
          expect(mat0.normalTextureScale).to.eql(1);
          expect(mat0.roughnessFactor).to.eql(0.5099999904632568);
          expect(mat0.side).to.eql(1028);
          expect(mat0.type).to.eql('pbr');
        }
      }
    }
  });
});

