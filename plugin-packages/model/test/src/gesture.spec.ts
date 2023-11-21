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
    comp.camera.getQuat().forEach((v, i) => {
      expect([0, 0, 0, 1][i]).closeTo(v, 1e-5);
    });
    expect(comp.camera.position).to.eql([0, 0.3, 1.2]);
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: -1,
      yAxis: 1,
    });
    comp.camera.getQuat().forEach((v, i) => {
      expect([0, 0, 0, 1][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.forEach((v, i) => {
      expect([-0.0707106739282608, 0.37071067094802856, 1.2000000476837158][i]).closeTo(v, 1e-5);
    });
    handler.onKeyEvent({
      cameraID: 'extra-camera',
      xAxis: -1,
      zAxis: -1,
      speed: 10,
    });
    comp.camera.getQuat().forEach((v, i) => {
      expect([0, 0, 0, 1][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.forEach((v, i) => {
      expect([-7.141778469085693, 0.37071067094802856, -5.871068000793457][i]).closeTo(v, 1e-5);
    });
    handler.onRotateBegin(100, 100, 512, 512, 'extra-camera');
    handler.onRotating(120, 80);
    handler.onRotating(150, 60);
    handler.onRotating(260, 160);
    handler.onRotateEnd();
    comp.camera.getQuat().forEach((v, i) => {
      expect([-0.1283985823392868, -0.35647067427635193, -0.04952879995107651, 0.9241154789924622][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.forEach((v, i) => {
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
    comp.camera.getQuat().forEach((v, i) => {
      expect([-0.1283985823392868, -0.35647067427635193, -0.04952879995107651, 0.9241154789924622][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.forEach((v, i) => {
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
    comp.camera.getQuat().forEach((v, i) => {
      expect([0, 0, 0, 1][i]).closeTo(v, 1e-5);
    });
    expect(comp.camera.position).to.eql([0, 0.3, 1.2]);
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
    comp.camera.getQuat().forEach((v, i) => {
      expect([-0.41165038943, -0.5583808422088, 0.6160783171653, -0.3730981945991][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.forEach((v, i) => {
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
    comp.camera.getQuat().forEach((v, i) => {
      expect([-0.4116503894329071, -0.5583808422088623, 0.6160783171653748, -0.3730981945991516][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.forEach((v, i) => {
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
    comp.camera.getQuat().forEach((v, i) => {
      expect([0.115898996591568, 0.8160297870635986, -0.5383279919624329, 0.17568668723106384][i]).closeTo(v, 1e-5);
    });
    comp.camera.position.forEach((v, i) => {
      expect([50.17472457885742, 65.73796081542969, 79.31233215332031][i]).closeTo(v, 1e-5);
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
