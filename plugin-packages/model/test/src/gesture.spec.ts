// @ts-nocheck
import type { PlayOptions } from '@galacean/effects';
import { Player } from '@galacean/effects';
import { CameraGestureHandlerImp, CameraGestureType } from '@galacean/effects-plugin-model';
// LoaderImplEx没有导出，这里直接从代码目录引用
import { LoaderImplEx } from '@galacean/effects-plugin-model/helper';
import { generateComposition } from './utilities';

const { expect } = chai;

const player = new Player({
  canvas: document.createElement('canvas'),
});

describe('测试CameraGestureHandler对象接口', function () {
  this.timeout(30000);

  it('测试自由相机功能', async function () {
    const comp = await createComposition({ pauseOnFirstFrame: true });
    const handler = new CameraGestureHandlerImp(comp);

    expect(handler.getCurrentTarget()).to.eql('');
    expect(handler.getCurrentType()).to.eql(CameraGestureType.none);
    //
    expect(comp.camera.aspect).to.eql(2);
    expect(comp.camera.clipMode).to.eql(1);
    expect(comp.camera.far).to.eql(5000);
    expect(comp.camera.near).to.eql(0.1);
    expect(comp.camera.fov).to.eql(90);
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0, 0, 0, 1][i]).closeTo(v, 1e-5);
    });
    expect(comp.camera.position.toArray()).to.eql([0, 0.3, 1.2]);
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: -1,
      yAxis: 1,
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0, 0, 0, 1][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.toArray().forEach((v, i) => {
      expect([-0.0707106739282608, 0.37071067094802856, 1.2000000476837158][i]).closeTo(v, 1e-5);
    });
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: -1,
      zAxis: -1,
      speed: 10,
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0, 0, 0, 1][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.toArray().forEach((v, i) => {
      expect([-7.141778469085693, 0.37071067094802856, -5.871068000793457][i]).closeTo(v, 1e-5);
    });
    handler.onRotateBegin(100, 100, 512, 512, 'extra-camera');
    handler.onRotating(120, 80);
    handler.onRotating(150, 60);
    handler.onRotating(260, 160);
    handler.onRotateEnd();
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.1283985823392868, -0.35647067427635193, -0.04952879995107651, 0.9241154789924622][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.toArray().forEach((v, i) => {
      expect([-7.141778469085693, 0.37071067094802856, -5.871068000793457][i]).closeTo(v, 1e-5);
    });
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      yAxis: 1,
      zAxis: 1,
      speed: 8,
    });
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: 1,
      yAxis: -1,
      speed: 12,
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.1283985823392868, -0.35647067427635193, -0.04952879995107651, 0.9241154789924622][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.toArray().forEach((v, i) => {
      expect([-5.027445316314697, -0.8084001541137695, 4.431324005126953][i]).closeTo(v, 1e-5);
    });
  });

  it('测试目标相机功能', async function () {
    const comp = await createComposition({ pauseOnFirstFrame: true });
    const handler = new CameraGestureHandlerImp(comp);

    expect(handler.getCurrentTarget()).to.eql('');
    expect(handler.getCurrentType()).to.eql(CameraGestureType.none);
    //
    expect(comp.camera.aspect).to.eql(2);
    expect(comp.camera.clipMode).to.eql(1);
    expect(comp.camera.far).to.eql(5000);
    expect(comp.camera.near).to.eql(0.1);
    expect(comp.camera.fov).to.eql(90);
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0, 0, 0, 1][i]).closeTo(v, 1e-5);
    });
    expect(comp.camera.position.toArray()).to.eql([0, 0.3, 1.2]);
    handler.onRotatePointBegin(200, 180, 512, 512, [12, 34, 56], 'extra-camera');
    handler.onRotatingPoint(260, 230);
    handler.onRotatingPoint(360, 430);
    handler.onRotatingPoint(160, 530);
    handler.onRotatePointEnd();
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: -1,
      yAxis: 1,
      speed: 15,
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.41165038943, -0.5583808422088, 0.6160783171653, -0.3730981945991][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.toArray().forEach((v, i) => {
      expect([4.380855560302, 90.79966735839, 83.62515258789][i]).closeTo(v, 1e-5);
    });
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: -1,
      yAxis: 1,
      speed: 13,
    });
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: 1,
      zAxis: 1,
      speed: 7,
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.4116503894329071, -0.5583808422088623, 0.6160783171653748, -0.3730981945991516][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.toArray().forEach((v, i) => {
      expect([14.007980346679688, 84.97274780273438, 84.22966766357422][i]).closeTo(v, 1e-5);
    });
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      yAxis: 1,
      zAxis: 1,
      speed: 18,
    });
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: -1,
      yAxis: 1,
      speed: 12,
    });
    handler.onRotatePointBegin(700, 600, 1000, 1000, [7.8, 9.1, 34], 'extra-camera');
    handler.onRotatingPoint(660, 710);
    handler.onRotatingPoint(460, 830);
    handler.onRotatingPoint(370, 420);
    handler.onRotatingPoint(420, 370);
    handler.onRotatePointEnd();
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.115898996591568, 0.8160297870635986, -0.5383279919624329, 0.17568668723106384][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.toArray().forEach((v, i) => {
      expect([50.17472457885742, 65.73796081542969, 79.31233215332031][i]).closeTo(v, 1e-5);
    });
  });

  it('测试其他功能', async function () {
    const comp = await createComposition({ pauseOnFirstFrame: true });
    const handler = new CameraGestureHandlerImp(comp);

    handler.onFocusPoint('extra-camera', [10, 20, 30]);

    comp.camera.position.toArray().forEach((v, i) => {
      expect([10, 20, 35][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0, 0, 0, 1][i]).closeTo(v, 1e-5);
    });

    handler.onRotateBegin(12, 60, 1200, 1300, 'extra-camera');
    handler.onRotating(15, 62, 1.5);

    comp.camera.position.toArray().forEach((v, i) => {
      expect([10, 20, 35][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.0018124483758583665, -0.002945234067738056, -0.000005338116807251936, 0.9999939799308777][i]).closeTo(v, 1e-5);
    });

    handler.onRotating(40, 200, 2.5);
    handler.onRotating(150, 350);

    comp.camera.position.toArray().forEach((v, i) => {
      expect([10, 20, 35][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.2574109137058258, -0.13042953610420227, -0.03508928790688515, 0.9568158388137817][i]).closeTo(v, 1e-5);
    });

    handler.onRotating(130, 223, 1.0);
    handler.onRotateEnd();

    comp.camera.position.toArray().forEach((v, i) => {
      expect([10, 20, 35][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.09802468866109848, -0.07678026705980301, -0.007585614919662476, 0.9921886920928955][i]).closeTo(v, 1e-5);
    });

    handler.onFocusPoint('extra-camera', [-5.5, 62, 70]);

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-6.254369258880615, 62.97841262817383, 74.84495544433594][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.09802468866109848, -0.07678026705980301, -0.007585614919662476, 0.9921886920928955][i]).closeTo(v, 1e-5);
    });

    handler.onXYMoveBegin(356, 666, 1234, 877, 'extra-camera');
    handler.onXYMoving(300, 777, 1.2);
    handler.onXYMoving(220, 677);

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-4.233689308166504, 63.14022445678711, 75.12689971923828][i]).closeTo(v, 1e-4);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.09802468866109848, -0.07678026705980301, -0.007585614919662476, 0.9921886920928955][i]).closeTo(v, 1e-5);
    });

    handler.onXYMoving(556, 423, 10.0);

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-2055.599609375, -2320.04296875, 236.99668884277344][i]).closeTo(v, 1e-4);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.09802468866109848, -0.07678026705980301, -0.007585614919662476, 0.9921886920928955][i]).closeTo(v, 1e-5);
    });

    handler.onXYMoving(897, 999, 0.1);
    handler.onXYMoveEnd();

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-58.70777130126953, 95.63462829589844, 60.083106994628906][i]).closeTo(v, 1e-4);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.09802468866109848, -0.07678026705980301, -0.007585614919662476, 0.9921886920928955][i]).closeTo(v, 1e-5);
    });

    handler.onFocusPoint('extra-camera', [-30, -90, -40]);

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-30.754369735717773, -89.0215835571289, -35.1550407409668][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.09802468866109848, -0.07678026705980301, -0.007585614919662476, 0.9921886920928955][i]).closeTo(v, 1e-5);
    });

    handler.onZMoveBegin(532, 877, 2354, 999, 'extra-camera');
    handler.onZMoving(423, 754, 1.0);
    handler.onZMoving(377, 855, 5.0);

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-14.158243179321289, -110.54669189453125, -141.744140625][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.09802468866109848, -0.07678026705980301, -0.007585614919662476, 0.9921886920928955][i]).closeTo(v, 1e-5);
    });

    handler.onZMoving(777, 666);
    handler.onZMoving(1542, 200, 3.0);
    handler.onZMoveEnd();

    comp.camera.position.toArray().forEach((v, i) => {
      expect([275.67047119140625, -486.4533996582031, -2003.177490234375][i]).closeTo(v, 5e-4);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([-0.09802468866109848, -0.07678026705980301, -0.007585614919662476, 0.9921886920928955][i]).closeTo(v, 1e-5);
    });

    handler.onRotatePointBegin(765, 254, 1358, 1245, [34, 156, 256], 'extra-camera');
    handler.onRotatingPoint(687, 333);
    handler.onRotatingPoint(555, 333);
    comp.camera.position.toArray().forEach((v, i) => {
      expect([-263.5001525878906, -2097.41015625, -383.27386474609375][i]).closeTo(v, 5e-4);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.22716321051120758, 0.5978137254714966, 0.74696946144104, -0.18180298805236816][i]).closeTo(v, 1e-5);
    });
    handler.onRotatingPoint(999, 1001);
    handler.onRotatePointEnd();

    comp.camera.position.toArray().forEach((v, i) => {
      expect([2215.251708984375, -658.2001953125, -136.75177001953125][i]).closeTo(v, 5e-4);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.607955276966095, -0.16751287877559662, -0.7645838260650635, -0.13319708406925201][i]).closeTo(v, 1e-5);
    });

    handler.onFocusPoint('extra-camera', [28.5, -70.6, -60], 3);

    comp.camera.position.toArray().forEach((v, i) => {
      expect([25.844877243041992, -69.34566497802734, -59.38602066040039][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.607955276966095, -0.16751287877559662, -0.7645838260650635, -0.13319708406925201][i]).closeTo(v, 1e-5);
    });

    handler.onFocusPoint('extra-camera', [-18.5, 130.6, 60]);

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-22.92520523071289, 132.69056701660156, 61.02329635620117][i]).closeTo(v, 1e-4);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.607955276966095, -0.16751287877559662, -0.7645838260650635, -0.13319708406925201][i]).closeTo(v, 1e-5);
    });

    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: 5.6,
      speed: 3.0,
    });

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-23.601099014282227, 132.69056701660156, 58.100425720214844][i]).closeTo(v, 1e-4);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.607955276966095, -0.16751287877559662, -0.7645838260650635, -0.13319708406925201][i]).closeTo(v, 1e-5);
    });

    handler.onKeyEvent({
      cameraID: 'extra-camera',
      yAxis: -66.3,
      speed: 5.5,
    });

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-21.360610961914, 137.68673706054, 57.58232879638][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.607955276966095, -0.16751287877559662, -0.7645838260650635, -0.13319708406925201][i]).closeTo(v, 1e-5);
    });

    handler.onKeyEvent({
      cameraID: 'extra-camera',
      zAxis: -36.36,
      speed: 0.589,
    });

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-20.83932113647461, 137.4404754638672, 57.46178436279297][i]).closeTo(v, 1e-4);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.607955276966095, -0.16751287877559662, -0.7645838260650635, -0.13319708406925201][i]).closeTo(v, 1e-5);
    });

    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: -5.6,
      yAxis: 35.2,
      speed: 8.8,
    });

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-24.068078994750977, 129.54586791992188, 59.62751007080078][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.607955276966095, -0.16751287877559662, -0.7645838260650635, -0.13319708406925201][i]).closeTo(v, 1e-5);
    });

    handler.onKeyEvent({
      cameraID: 'extra-camera',
      yAxis: -66.3,
      zAxis: 89.2,
      speed: 22.5,
    });

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-34.582611083984375, 149.28878784179688, 62.058921813964844][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.607955276966095, -0.16751287877559662, -0.7645838260650635, -0.13319708406925201][i]).closeTo(v, 1e-5);
    });

    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: 5.6,
      yAxis: -9.65,
      zAxis: 36.36,
      speed: 12.0,
    });

    comp.camera.position.toArray().forEach((v, i) => {
      expect([-43.89362716674805, 156.85116577148438, 62.39853286743164][i]).closeTo(v, 1e-5);
    });
    comp.camera.getQuat().toArray().forEach((v, i) => {
      expect([0.607955276966095, -0.16751287877559662, -0.7645838260650635, -0.13319708406925201][i]).closeTo(v, 1e-5);
    });

  });
});

async function generateCurrentScene () {
  const gltfLoader = new LoaderImplEx();
  const url = 'https://mdn.alipayobjects.com/afts/file/A*VwE_RJelo74AAAAAAAAAAAAADrd2AQ/CesiumMan.glb';
  const loadResult = await gltfLoader.loadScene({
    gltf: {
      resource: url,
      compatibleMode: 'tiny3d',
    },
    effects: {
      renderer: player.renderer,
      duration: 5,
      endBehavior: 2,
    },
  });
  const cameraItem = {
    id: 'extra-camera',
    duration: 8,
    name: 'extra-camera',
    endBehavior: 0,
    pn: 0,
    type: 'camera',
    transform: {
      position: [0, 0.3, 1.2],
      rotation: [0, 0, 0],
    },
    content: {
      options: {
        near: 0.1,
        far: 5000,
        fov: 90,
        clipMode: 0,
      },
    },
  };
  const resultItems = loadResult.items;

  resultItems.push(cameraItem);

  return {
    'compositionId': 1,
    'requires': [],
    'compositions': [{
      'name': 'composition_1',
      'id': 1,
      'duration': 100,
      'endBehavior': 2,
      'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
      'items': resultItems,
      'meta': { 'previewSize': [750, 1334] },
    }],
    'gltf': [],
    'images': [],
    'version': '2.1',
    'shapes': [],
    'plugins': ['model'],
  };
}

async function createComposition (opts: PlayOptions) {
  const scene = await generateCurrentScene();

  return generateComposition(player, scene, {}, opts);
}
