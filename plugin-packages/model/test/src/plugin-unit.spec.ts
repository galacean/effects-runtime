/* eslint-disable padding-line-between-statements */
// @ts-nocheck
import { Player, Texture, spec, Downloader, math } from '@galacean/effects';
const { Matrix4, Quaternion, Vector3, RAD2DEG } = math;

import type { ModelVFXItem } from '@galacean/effects-plugin-model';
import {
  PEntity, PObject, PAnimationManager, PMorph,
  PBlendMode, PLightType, PMaterialType, PObjectType, PShadowType, PTransform,
  PCamera, PLight, PMesh, PSkybox, PCameraManager, PLightManager, PMaterialPBR, PMaterialUnlit,
  VFX_ITEM_TYPE_3D, RayBoxTesting, RayTriangleTesting,
} from '@galacean/effects-plugin-model';
import { LoaderImplEx } from '../../src/helper';
import { generateComposition } from './utilities';

const { expect } = chai;

describe('渲染插件单测', function () {
  this.timeout(60 * 1000);
  const player = new Player({
    canvas: document.createElement('canvas'),
  });

  it('3D变换测试', function () {
    {
      const trans = new PTransform();
      const matrix = trans.getMatrix().toArray();

      expect(matrix).to.eql([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
    }
    {
      const trans0 = new PTransform();

      trans0.setPosition(new Vector3(123, 456, 789));
      expect(trans0.getMatrix().toArray()).to.eql([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        123, 456, 789, 1,
      ]);
      const decomp0 = trans0.getMatrix().getTransform();

      expect(decomp0.translation).to.eql(new Vector3(123, 456, 789));
      expect(decomp0.rotation).to.eql(new Quaternion(0, 0, 0, 1));
      expect(decomp0.scale).to.eql(new Vector3(1, 1, 1));
      //
      const trans1 = new PTransform();

      trans1.setTranslation([987, 654, 321]);
      expect(trans1.getMatrix().toArray()).to.eql([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        987, 654, 321, 1,
      ]);
      const decomp1 = trans1.getMatrix().getTransform();
      expect(decomp1.translation).to.eql(new Vector3(987, 654, 321));
      expect(decomp1.rotation).to.eql(new Quaternion(0, 0, 0, 1));
      expect(decomp1.scale).to.eql(new Vector3(1, 1, 1));
    }
    {
      const trans0 = new PTransform();
      trans0.setRotation(new Vector3(-2.1, 0.3, 4.5).multiply(RAD2DEG));
      trans0.getMatrix().toArray().forEach((v, i) => {
        expect(v).closeTo([
          -0.20138093829154968, -0.9338701963424683, -0.29552021622657776, 0,
          -0.43972906470298767, 0.35578328371047974, -0.8246554732322693, 0,
          0.8752622604370117, -0.036121055483818054, -0.4822978377342224, 0,
          0, 0, 0, 1,
        ][i], 1e-5);
      });
      const trans1 = new PTransform();
      trans1.setRotation(Quaternion.fromAxisAngle(new Vector3(3, 7, 5), Math.PI * 0.15, new Quaternion()));
      trans1.getMatrix().toArray().forEach((v, i) => {
        expect([
          0.9028250575065613, 0.2767362892627716, -0.32912591099739075, 0,
          -0.22158297896385193, 0.9553520679473877, 0.19545689225196838, 0,
          0.368521124124527, -0.10353469103574753, 0.9238358736038208, 0,
          0, 0, 0, 1,
        ][i]).closeTo(v, 1e-5);
      });
      const decomp1 = trans1.getMatrix().getTransform();
      expect(decomp1.translation).to.eql(new Vector3(0, 0, 0));
      decomp1.rotation.toArray().forEach((v, i) => {
        expect([0.07687187194824219, 0.17936770617961884, 0.12811978161334991, 0.972369909286499][i]).closeTo(v, 1e-5);
      });
      decomp1.scale.toArray().forEach((v, i) => {
        expect([0.9999999403953552, 1, 1][i]).closeTo(v, 1e-5);
      });
    }
    {
      const trans0 = new PTransform();
      trans0.setScale(new Vector3(2.1, 0.3, 4.5));
      const expectMatrix = [
        2.1, 0, 0, 0,
        0, 0.3, 0, 0,
        0, 0, 4.5, 0,
        0, 0, 0, 1,
      ];
      trans0.getMatrix().toArray().forEach((v, index) => {
        expect(v).closeTo(expectMatrix[index], 1e-5);
      });
      const decomp = trans0.getMatrix().getTransform();
      expect(decomp.translation).to.eql(new Vector3(0, 0, 0));
      expect(decomp.rotation).to.eql(new Quaternion(0, 0, 0, 1));
      decomp.scale.toArray().forEach((v, i) => {
        expect([2.1, 0.3, 4.5][i]).closeTo(v, 1e-5);
      });
    }
    {
      const trans0 = new PTransform();
      trans0.setPosition(new Vector3(13.5, 2.34, 5.678));
      trans0.setScale(new Vector3(3.78, 2.56, 5.12));
      trans0.setRotation(Quaternion.fromAxisAngle(new Vector3(-8.45, 13.0, 43.2), -Math.PI * 7.43, new Quaternion()));
      const expectMatrix = [
        -0.66851407289505, 3.232001543045044, -1.8427306413650513, 0,
        -2.5140888690948486, -0.3082773983478546, 0.3713786005973816, 0,
        0.33451002836227417, 2.5825717449188232, 4.408267974853516, 0,
        13.5, 2.34, 5.678, 1,
      ];
      trans0.getMatrix().toArray().forEach((v, index) => {
        expect(v).closeTo(expectMatrix[index], 1e-5);
      });
      const decomp0 = trans0.getMatrix().getTransform();
      decomp0.translation.toArray().forEach((v, index) => {
        expect(v).closeTo([13.5, 2.3399999141693115, 5.677999973297119][index], 1e-6);
      });
      decomp0.rotation.toArray().forEach((v, index) => {
        expect(v).closeTo([-0.14367972314357758, 0.22104573249816895, 0.7345519661903381, 0.6252426505088806][index], 1e-6);
      });
      decomp0.scale.toArray().forEach((v, index) => {
        expect(v).closeTo([3.7800002098083496, 2.559999942779541, 5.119999885559082][index], 1e-6);
      });

      const trans1 = new PTransform();
      trans1.setMatrix(Matrix4.fromArray(expectMatrix));
      trans1.getMatrix().toArray().forEach((v, index) => {
        expect(v).closeTo(expectMatrix[index], 1e-5);
      });
      trans1.getTranslation().toArray().forEach((v, i) => {
        expect([13.5, 2.3399999141693115, 5.677999973297119][i]).closeTo(v, 1e-5);
      });
      trans1.getRotation().toArray().forEach((v, index) => {
        expect(v).closeTo([-0.14367972314357758, 0.22104573249816895, 0.7345519661903381, 0.6252426505088806][index], 1e-6);
      });
      trans1.getScale().toArray().forEach((v, index) => {
        expect(v).closeTo([3.7800002098083496, 2.559999942779541, 5.119999885559082][index], 1e-6);
      });
    }
  });
  it('Object和Entity测试', function () {
    const object = new PObject();
    expect(object.isValid()).to.eql(false);
    object.type = PObjectType.light;
    expect(object.isValid()).to.eql(true);
    object.type = PObjectType.none;
    expect(object.isValid()).to.eql(false);
    //
    const entity = new PEntity();
    expect(entity.visible).to.eql(false);
    entity.visible = true;
    expect(entity.visible).to.eql(false);
    entity.type = PObjectType.camera;
    expect(entity.visible).to.eql(true);
    expect(entity.deleted).to.eql(false);
    entity.onEntityRemoved();
    expect(entity.visible).to.eql(false);
    expect(entity.deleted).to.eql(true);
  });
  it('Light测试', function () {
    const light1 = new PLight(
      {
        id: '1',
        name: 'light1',
        duration: 0,
        endBehavior: 0,
        type: 'light',
        content: {
          options: {
            color: [253, 127, 169, 255],
            intensity: 123,
            lightType: 'point',
            range: 67.9,
          },
        },
      },
      {
        transform: {
          position: [123, 456, 789],
          rotation: [9.8, 7.654, 3.21],
          scale: [3.4, 5.7, 6.9],
        },
      } as any as ModelVFXItem
    );
    expect(light1.type).to.eql(PObjectType.light);
    expect(light1.lightType).to.eql(PLightType.point);
    expect(light1.name).to.eql('light1');
    expect(light1.visible).to.eql(false);
    expect(light1.transform.getPosition().toArray()).to.eql([123, 456, 789]);
    light1.transform.getRotation().toArray().forEach((v, index) => {
      expect(v).closeTo([-0.0833304226398468, -0.06886117160320282, -0.02214544080197811, 0.9938932657241821][index], 1e-6);
    });
    light1.transform.getScale().toArray().forEach((v, index) => {
      expect(v).closeTo([3.4, 5.7, 6.9][index], 1e-6);
    });
    light1.color.toArray().forEach((v, index) => {
      expect(v).closeTo([253, 127, 169, 255][index] / 255.0, 1e-6);
    });
    expect(light1.intensity).to.eql(123);
    expect(light1.range).to.eql(67.9);
    //
    const light2 = new PLight(
      {
        id: '2',
        name: 'light2',
        duration: 0,
        endBehavior: 0,
        type: 'light',
        content: {
          options: {
            color: [0, 255, 163, 135],
            intensity: 997,
            lightType: 'spot',
            range: 1007.3,
            innerConeAngle: 35.8,
            outerConeAngle: 49.6,
          },
        },
      },
      {
        transform: {
          position: [222, 333, 444],
          rotation: [0, 0, 0],
          scale: [5.6, 8.9, 10.2],
        },
      } as any as ModelVFXItem
    );
    expect(light2.type).to.eql(PObjectType.light);
    expect(light2.lightType).to.eql(PLightType.spot);
    expect(light2.name).to.eql('light2');
    expect(light2.visible).to.eql(false);
    expect(light2.transform.getPosition().toArray()).to.eql([222, 333, 444]);
    expect(light2.transform.getRotation()).to.eql(new Quaternion(0, 0, 0, 1));
    light2.transform.getScale().toArray().forEach((v, index) => {
      expect(v).closeTo([5.6, 8.9, 10.2][index], 1e-6);
    });
    light2.color.toArray().forEach((v, index) => {
      expect(v).closeTo([0, 255, 163, 135][index] / 255.0, 1e-6);
    });
    expect(light2.intensity).to.eql(997);
    expect(light2.range).to.eql(1007.3);
    expect(light2.innerConeAngle).to.eql(35.8);
    expect(light2.outerConeAngle).to.eql(49.6);
    light2.getWorldDirection().toArray().forEach((v, index) => {
      expect(v).closeTo([0, 0, -1][index], 1e-5);
    });
    //
    //
    const light3 = new PLight(
      {
        id: '3',
        name: 'light3',
        duration: 0,
        endBehavior: 0,
        type: 'light',
        content: {
          options: {
            color: [128, 0, 177, 33],
            intensity: 868,
            lightType: 'directional',
          },
        },
      },
      {
        transform: {
          rotation: [12.3, 45.6, 78.9],
        },
      } as any as ModelVFXItem
    );
    expect(light3.type).to.eql(PObjectType.light);
    expect(light3.lightType).to.eql(PLightType.directional);
    expect(light3.name).to.eql('light3');
    expect(light3.visible).to.eql(false);
    expect(light3.transform.getPosition().toArray()).to.eql([0, 0, 0]);
    light3.transform.getRotation().toArray().forEach((v, index) => {
      expect(v).closeTo([0.16855104267597198, -0.3602624833583832, -0.5503277778625488, 0.7341259121894836][index], 1e-6);
    });
    light3.transform.getScale().toArray().forEach((v, index) => {
      expect(v).closeTo([1, 1, 1][index], 1e-6);
    });
    light3.color.toArray().forEach((v, index) => {
      expect(v).closeTo([128, 0, 177, 33][index] / 255.0, 1e-6);
    });
    expect(light3.intensity).to.eql(868);
    light3.getWorldDirection().toArray().forEach((v, index) => {
      expect(v).closeTo([0.7144727110862732, -0.1490495204925537, -0.6836029887199402][index], 1e-6);
    });
    //
    const manager = new PLightManager();
    expect(manager.lightCount).to.eql(0);
    expect(manager.lightList.length).to.eql(0);
    expect(manager.insertLight(light3)).to.eql(light3);
    expect(manager.insertLight(light2)).to.eql(light2);
    expect(manager.insertLight(light1)).to.eql(light1);
    expect(manager.lightList).to.eql([light3, light2, light1]);
    manager.remove(light2);
    manager.remove(light1);
    expect(manager.lightList).to.eql([light3]);
  });
  it('Camera测试', function () {
    const params1 = {
      id: '1',
      name: 'camera1',
      duration: 5.0,
      endBehavior: 0,
      type: 'camera',
      content: {
        options: {
          aspect: 2,
          near: 0.01,
          far: 996,
          fov: 35,
          clipMode: 0,
        },
      },
    };
    const owner1 = {
      transform: {
        position: [3.21, 6.54, 9.87],
        rotation: [-27, 69, 35],
      },
    } as any as ModelVFXItem;
    const camera1 = new PCamera(params1, 800, 600, owner1);
    expect(camera1.name).to.eql('camera1');
    expect(camera1.type).to.eql(PObjectType.camera);
    expect(camera1.width).to.eql(800);
    expect(camera1.height).to.eql(600);
    expect(camera1.farPlane).to.eql(996);
    expect(camera1.nearPlane).to.eql(0.01);
    expect(camera1.fovy).to.eql(35);
    expect(camera1.clipMode).to.eql(0);
    expect(camera1.aspect).to.eql(2);
    expect(camera1.isReversed()).to.eql(false);
    camera1.position.toArray().forEach((v, i) => {
      expect([3.21, 6.54, 9.87][i]).closeTo(v, 1e-6);
    });
    camera1.scale.toArray().forEach((v, i) => {
      expect([1, 1, 1][i]).closeTo(v, 1e-6);
    });
    camera1.rotation.toArray().forEach((v, i) => {
      expect([0.3490997552871704, -0.46741336584091187, -0.36707738041877747, 0.7245055437088013][i]).closeTo(v, 1e-6);
    });
    camera1.viewMatrix.toArray().forEach((v, i) => {
      expect([
        0.29355788230895996, 0.20555143058300018, -0.9335804581642151, 0,
        -0.8582470417022705, 0.48676711320877075, -0.16269566118717194, 0,
        0.4209939241409302, 0.849003255367279, 0.31930822134017944, -0,
        0.5154047012329102, -12.222938537597656, 0.9092508554458618, 1,
      ][i]).closeTo(v, 1e-6);
    });
    camera1.projectionMatrix.toArray().forEach((v, i) => {
      expect([
        1.5857974290847778, 0, 0, 0,
        0, 3.1715948581695557, 0, 0,
        0, 0, -1.0000200271606445, -1,
        0, 0, -0.02000020071864128, 0,
      ][i]).closeTo(v, 1e-6);
    });
    //=======================================================
    const params2 = {
      id: '2',
      name: 'camera2',
      duration: 5.0,
      endBehavior: 0,
      type: 'camera',
      content: {
        options: {
          near: 0.03,
          far: 1007,
          fov: 48,
          clipMode: 1,
        },
      },
    };
    const owner2 = {
      transform: {
        position: [13.5, 33.6, 56.2],
        rotation: [0, 45, 30],
      },
    } as any as ModelVFXItem;
    const camera2 = new PCamera(params2, 1080, 960, owner2);
    expect(camera2.name).to.eql('camera2');
    expect(camera2.type).to.eql(PObjectType.camera);
    expect(camera2.width).to.eql(1080);
    expect(camera2.height).to.eql(960);
    expect(camera2.farPlane).to.eql(1007);
    expect(camera2.nearPlane).to.eql(0.03);
    expect(camera2.fovy).to.eql(48);
    expect(camera2.clipMode).to.eql(1);
    expect(camera2.aspect).to.eql(1080 / 960);
    expect(camera2.isReversed()).to.eql(true);
    camera2.position.toArray().forEach((v, i) => {
      expect([13.5, 33.6, 56.2][i]).closeTo(v, 1e-5);
    });
    camera2.scale.toArray().forEach((v, i) => {
      expect([1, 1, 1][i]).closeTo(v, 1e-6);
    });
    camera2.rotation.toArray().forEach((v, i) => {
      expect([0.0990457609295845, -0.36964380741119385, -0.23911762237548828, 0.8923990726470947][i]).closeTo(v, 1e-6);
    });
    camera2.viewMatrix.toArray().forEach((v, i) => {
      expect([
        0.6123723983764648, 0.3535534143447876, -0.7071068286895752, 0,
        -0.5000000596046448, 0.866025447845459, 0, 0, 0.6123724579811096,
        0.35355344414711, 0.7071068286895752, 0, -25.882360458374023,
        -53.741127014160156, -30.193462371826172, 1,
      ][i]).closeTo(v, 1e-5);
    });
    camera2.projectionMatrix.toArray().forEach((v, i) => {
      expect([
        2.2460367679595947, 0, 0, 0,
        0, 2.5267913341522217, 0, 0,
        0, 0, -1.0000596046447754, -1,
        0, 0, -0.060001786798238754, 0,
      ][i]).closeTo(v, 1e-6);
    });
    //=======================================
    const cameraManager = new PCameraManager();
    cameraManager.initial(1024, 768);
    cameraManager.remove(0);
    const cam1 = cameraManager.insert(params1);
    const cam2 = cameraManager.insert(params2);
    expect(cameraManager.defaultCamera).not.eql(cam1);
    expect(cameraManager.defaultCamera).not.eql(cam2);
    expect(cameraManager.defaultCamera).to.eql(cameraManager.getActiveCamera());
    expect(cameraManager.cameraList).to.eql([cam1, cam2]);
    cameraManager.updateDefaultCamera(
      45, 0.001, 606, [30.5, 100, 77],
      Quaternion.fromAxisAngle(new Vector3(10, -15, 33), 0.3, new Quaternion()), 0
    );
    const acam = cameraManager.getActiveCamera();
    expect(acam.width).to.eql(1024);
    expect(acam.height).to.eql(768);
    expect(acam.farPlane).to.eql(606);
    expect(acam.nearPlane).to.eql(0.001);
    expect(acam.fovy).to.eql(45);
    expect(acam.clipMode).to.eql(0);
    expect(acam.aspect).to.eql(1024 / 768);
    acam.position.toArray().forEach((v, i) => {
      expect([30.5, 100, 77][i]).closeTo(v, 1e-5);
    });
    expect(acam.scale.toArray()).to.eql([1, 1, 1]);
    acam.rotation.toArray().forEach((v, i) => {
      expect([0.03974081203341484, -0.05961121991276741, 0.1311446875333786, 0.9887710809707642][i]).closeTo(v, 1e-6);
    });
    acam.viewMatrix.toArray().forEach((v, i) => {
      expect([
        0.9584951400756836, -0.2640821635723114, -0.10746011137962341, 0,
        0.254606157541275, 0.962443470954895, -0.09422452002763748, 0,
        0.1283072978258133, 0.06295374035835266, 0.9897343516349792, -0,
        -64.57437896728516, -93.03727722167969, -63.509559631347656, 1,
      ][i]).closeTo(v, 1e-5);
    });
    acam.projectionMatrix.toArray().forEach((v, i) => {
      expect([
        1.8106601238250732, 0, 0, 0,
        0, 2.4142136573791504, 0, 0,
        0, 0, -1.0000033378601074, -1,
        0, 0, -0.0020000033546239138, 0,
      ][i]).closeTo(v, 1e-6);
    });
  });
  it('Material测试', function () {
    const engine = {};
    const mat1 = new PMaterialPBR();
    const baseColorTexture1 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const baseColorTextureTransform1 = { offset: [0.23, 0.56] };
    const metallicRoughnessTexture1 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const metallicRoughnessTextureTransform1 = { offset: [0.79, -3.25], rotation: 0.986 };
    const normalTexture1 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const normalTextureTransform1 = { offset: [-9.87, 1.56], rotation: -1.11, scale: [0.5, 0.7] };
    const occlusionTexture1 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const occlusionTextureTransform1 = { rotation: -5.69, scale: [2.0, -3.3] };
    const emissiveTexture1 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const emissiveTextureTransform1 = { scale: [0, 20.3] };
    const opts1 = {
      name: 'mat1',
      type: spec.MaterialType.pbr,

      baseColorTexture: baseColorTexture1,
      baseColorTextureTransform: baseColorTextureTransform1,
      baseColorFactor: [233, 128, 65, 76],

      metallicRoughnessTexture: metallicRoughnessTexture1,
      metallicRoughnessTextureTransform: metallicRoughnessTextureTransform1,
      metallicFactor: 0.78,
      roughnessFactor: 0.35,

      normalTexture: normalTexture1,
      normalTextureTransform: normalTextureTransform1,
      normalTextureScale: 0.63,

      occlusionTexture: occlusionTexture1,
      occlusionTextureTransform: occlusionTextureTransform1,
      occlusionTextureStrength: 0.84,

      emissiveTexture: emissiveTexture1,
      emissiveTextureTransform: emissiveTextureTransform1,
      emissiveFactor: [198, 120, 67, 99],
      emissiveIntensity: 2.5,

      enableShadow: true,

      blending: spec.MaterialBlending.opaque,
      alphaCutOff: 0.35,
      side: spec.SideMode.FRONT,
    };
    expect(mat1.depthMask).to.eql(true);
    expect(mat1.enableShadow).to.eql(false);
    expect(mat1.blendMode).to.eql(PBlendMode.opaque);
    expect(mat1.isTranslucent()).to.eql(false);
    expect(mat1.alphaCutOff).to.eql(0.5);
    expect(mat1.isFrontFace()).to.eql(true);
    expect(mat1.hasBaseColorTexture()).to.eql(false);
    expect(mat1.hasBaseColorTextureTrans()).to.eql(false);
    expect(mat1.hasMetallicRoughnessTexture()).to.eql(false);
    expect(mat1.hasMetallicRoughnessTextureTrans()).to.eql(false);
    expect(mat1.hasNormalTexture()).to.eql(false);
    expect(mat1.hasNormalTextureTrans()).to.eql(false);
    expect(mat1.hasOcclusionTexture()).to.eql(false);
    expect(mat1.hasOcclusionTextureTrans()).to.eql(false);
    expect(mat1.hasEmissiveTexture()).to.eql(false);
    expect(mat1.hasEmissiveTextureTrans()).to.eql(false);
    mat1.create(opts1);
    expect(mat1.name).to.eql('mat1');
    expect(mat1.type).to.eql(PObjectType.material);
    expect(mat1.materialType).to.eql(PMaterialType.pbr);
    expect(mat1.blendMode).to.eql(PBlendMode.opaque);
    expect(mat1.baseColorTexture).to.eql(baseColorTexture1);
    expect(mat1.hasBaseColorTextureTrans()).to.eql(true);
    mat1.baseColorTextureTrans.toArray().forEach((v, i) => {
      expect([
        1, 0, 0.23000000417232513,
        0, 1, 0.5600000023841858,
        0, 0, 1,
      ][i]).closeTo(v, 1e-5);
    });
    mat1.baseColorFactor.toArray().forEach((v, i) => {
      expect([233, 128, 65, 76][i] / 255).closeTo(v, 1e-5);
    });
    expect(mat1.metallicRoughnessTexture).to.eql(metallicRoughnessTexture1);
    expect(mat1.metallicFactor).to.eql(0.78);
    expect(mat1.roughnessFactor).to.eql(0.35);
    expect(mat1.hasMetallicRoughnessTextureTrans()).to.eql(true);
    mat1.metallicRoughnessTextureTrans.toArray().forEach((v, i) => {
      expect([
        0.552029550075531, -0.8338245153427124, 0.7900000214576721,
        0.8338245153427124, 0.552029550075531, -3.25,
        0, 0, 1,
      ][i]).closeTo(v, 1e-5);
    });
    expect(mat1.normalTexture).to.eql(normalTexture1);
    expect(mat1.normalTextureScale).to.eql(0.63);
    expect(mat1.hasNormalTextureTrans()).to.eql(true);
    mat1.normalTextureTrans.toArray().forEach((v, i) => {
      expect([
        0.22233076393604279, 0.6269890666007996, -9.869999885559082,
        -0.4478493332862854, 0.3112630546092987, 1.559999942779541,
        0, 0, 1,
      ][i]).closeTo(v, 1e-5);
    });
    expect(mat1.occlusionTexture).to.eql(occlusionTexture1);
    expect(mat1.occlusionTextureStrength).to.eql(0.84);
    expect(mat1.hasOcclusionTextureTrans()).to.eql(true);
    mat1.occlusionTextureTrans.toArray().forEach((v, i) => {
      expect([
        1.6583285331726074, 1.8447165489196777, 0,
        1.1180100440979004, -2.7362420558929443, 0,
        0, 0, 1,
      ][i]).closeTo(v, 1e-5);
    });
    expect(mat1.emissiveTexture).to.eql(emissiveTexture1);
    expect(mat1.emissiveIntensity).to.eql(2.5);
    mat1.emissiveFactor.toArray().forEach((v, i) => {
      expect([198, 120, 67, 99][i] / 255).closeTo(v, 1e-5);
    });
    expect(mat1.hasEmissiveTextureTrans()).to.eql(true);
    mat1.emissiveTextureTrans.toArray().forEach((v, i) => {
      expect([
        0, 0, 0,
        0, 20.299999237060547, 0,
        0, 0, 1,
      ][i]).closeTo(v, 1e-5);
    });
    expect(mat1.depthMask).to.eql(true);
    expect(mat1.alphaCutOff).to.eql(0.35);
    expect(mat1.isFrontFace()).to.eql(true);
    expect(mat1.enableShadow).to.eql(true);
    expect(mat1.isOpaque()).to.eql(true);
    expect(mat1.hasBaseColorTexture()).to.eql(true);
    expect(mat1.hasMetallicRoughnessTexture()).to.eql(true);
    expect(mat1.hasNormalTexture()).to.eql(true);
    expect(mat1.hasOcclusionTexture()).to.eql(true);
    expect(mat1.hasEmissiveTexture()).to.eql(true);
    //==============================================
    const mat2 = new PMaterialUnlit();
    const baseColorTexture2 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const opts2 = {
      name: 'mat2',
      type: spec.MaterialType.unlit,

      blending: spec.MaterialBlending.masked,
      alphaCutOff: 0.76,
      side: spec.SideMode.DOUBLE,

      baseColorTexture: baseColorTexture2,
      baseColorFactor: [53, 246, 89, 135],
      depthMask: false,
    };
    expect(mat2.depthMask).to.eql(true);
    expect(mat2.blendMode).to.eql(PBlendMode.opaque);
    expect(mat2.isMasked()).to.eql(false);
    expect(mat2.alphaCutOff).to.eql(0.5);
    expect(mat2.isBothFace()).to.eql(false);
    expect(mat2.hasBaseColorTexture()).to.eql(false);
    mat2.create(opts2);
    expect(mat2.name).to.eql('mat2');
    expect(mat2.type).to.eql(PObjectType.material);
    expect(mat2.materialType).to.eql(PMaterialType.unlit);
    expect(mat2.baseColorTexture).to.eql(baseColorTexture2);
    mat2.baseColorFactor.toArray().forEach((v, i) => {
      expect([53, 246, 89, 135][i] / 255).closeTo(v, 1e-5);
    });
    expect(mat2.depthMask).to.eql(false);
    expect(mat2.blendMode).to.eql(PBlendMode.masked);
    expect(mat2.isMasked()).to.eql(true);
    expect(mat2.alphaCutOff).to.eql(0.76);
    expect(mat2.isBothFace()).to.eql(true);
    expect(mat2.hasBaseColorTexture()).to.eql(true);
  });
  it('Skybox测试', function () {
    const engine = {};
    const specularTexture = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const brdfLUTTexture = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const options = {
      id: '003',
      name: 'skybox1',
      duration: 13.5,
      endBehavior: 0,
      type: 'skybox',
      pluginName: 'model',
      pn: 0,
      content: {
        options: {
          renderable: true,
          intensity: 3.45,
          reflectionsIntensity: 1.23,
          irradianceCoeffs: [1, 2, 3, 4, 5],
          specularImage: specularTexture,
          specularImageSize: 128,
          specularMipCount: 6,
        },
      },
    };
    const skybox = new PSkybox(options, { listIndex: 123 } as any as ModelVFXItem);
    skybox.setup(brdfLUTTexture);
    expect(skybox.type).to.eql(PObjectType.skybox);
    expect(skybox.priority).to.eql(123);
    expect(skybox.name).to.eql('skybox1');
    expect(skybox.intensity).to.eql(3.45);
    expect(skybox.reflectionsIntensity).to.eql(1.23);
    expect(skybox.irradianceCoeffs).to.eql([1, 2, 3, 4, 5]);
    expect(skybox.specularImage).to.eql(specularTexture);
    expect(skybox.specularImageSize).to.eql(128);
    expect(skybox.specularMipCount).to.eql(6);
  });
  it('Mesh测试', async function () {
    const loader = new LoaderImplEx();
    const loadResult = await loader.loadScene({
      gltf: {
        resource: 'https://mdn.alipayobjects.com/afts/file/A*VwE_RJelo74AAAAAAAAAAAAADrd2AQ/CesiumMan.glb',
        compatibleMode: 'tiny3d',
      },
      effects: {
        renderer: player.renderer,
        duration: 5,
        endBehavior: 2,
      },
    });
    const sceneAABB = loadResult.sceneAABB;
    [0.569136917591095, 1.5065498352050781, 0.18095403909683228].forEach((v, i) => {
      expect(sceneAABB.max[i]).closeTo(v, 1e-5);
    });
    [-0.5691370964050293, -6.193791257658177e-9, -0.13100001215934753].forEach((v, i) => {
      expect(sceneAABB.min[i]).closeTo(v, 1e-5);
    });
    //
    const itemList = loadResult.items;
    expect(itemList.length).to.eql(2);
    expect(itemList[0].type).to.eql('tree');
    const itemTree = itemList[0];
    const animManager = new PAnimationManager(itemTree.content.options.tree, itemTree);
    expect(animManager.type).to.eql(PObjectType.animationManager);
    const animations = animManager.animations;
    expect(animations.length).to.eql(1);
    const anim = animations[0];
    expect(anim.time).to.eql(0);
    expect(anim.duration).to.eql(2);
    expect(anim.type).to.eql(PObjectType.animation);
    const tracks = anim.tracks;
    expect(tracks.length).to.eql(57);
    const track0 = tracks[0];
    expect(track0.component).to.eql(3);
    expect(track0.interp).to.eql(0);
    expect(track0.node).to.eql(3);
    expect(track0.path).to.eql(0);
    expect(track0.dataArray.length).to.eql(144);
    [
      1.971350016560791e-8, -0.02000010944902897, 0.6439971327781677, 1.7385199058139733e-8, -0.02000010944902897, 0.6540120840072632, 2.0703099679053594e-8, -0.02000010944902897,
      0.6670830845832825, 2.993629877323656e-8, -0.020000120624899864, 0.6802471876144409, 3.00744993353419e-8, -0.020000120624899864, 0.6905401349067688, 2.984170066611114e-8,
      -0.020000120624899864, 0.6950002312660217, 2.55343000077346e-8, -0.020098520442843437,
    ].forEach((val, idx) => {
      expect(track0.dataArray[idx]).to.eql(val);
    });
    expect(track0.timeArray.length).to.eql(48);
    [
      0.04166661947965622, 0.08333330601453781, 0.125, 0.16666659712791443, 0.20833329856395721, 0.25, 0.29166659712791443, 0.3333333134651184,
      0.3750000298023224, 0.41666659712791443, 0.4583333134651184, 0.5, 0.5416666865348816, 0.5833333134651184, 0.625, 0.6666666865348816,
      0.7083333134651184, 0.75, 0.7916666865348816, 0.8333333134651184, 0.8750000596046448, 0.9166666865348816, 0.9583333134651184, 1,
      1.0416669845581055, 1.0833330154418945, 1.125, 1.1666669845581055, 1.2083330154418945, 1.25, 1.2916669845581055, 1.3333330154418945,
    ].forEach((val, idx) => {
      expect(track0.timeArray[idx]).to.eql(val);
    });
    expect(itemList[1].type).to.eql('mesh');
    const itemMesh = itemList[1];
    const priority = 123;
    const mesh = new PMesh(player.renderer.engine, itemMesh, { listIndex: priority } as any as ModelVFXItem);
    expect(mesh.name).to.eql('Cesium_Man');
    expect(mesh.type).to.eql(PObjectType.mesh);
    expect(mesh.parentIndex).to.eql(2);
    expect(mesh.skin).not.eql(undefined);
    expect(mesh.primitives.length).to.eql(1);
    expect(mesh.hide).to.eql(false);
    expect(mesh.priority).to.eql(priority);
    mesh.boundingBox.max.toArray().forEach((v, i) => {
      expect(v).closeTo([0.1809540092945099, 0.5691368579864502, 1.5065499544143677][i], 1e-5);
    });
    expect(mesh.boundingBox.min.toArray()).to.eql([-0.13100001215934753, -0.5691370964050293, 0]);
    expect(mesh.mriMeshs.length).to.eql(1);
    const skin = mesh.skin;
    expect(skin.name.substring(0, 8)).to.eql('Armature');
    expect(skin.type).to.eql(PObjectType.skin);
    expect(skin.skeleton).to.eql(3);
    expect(skin.jointList).to.eql([
      3, 12, 13, 20, 21, 17, 14, 18, 15, 19, 16, 8, 4, 9, 5, 10, 6, 11, 7,
    ]);
    expect(skin.inverseBindMatrices.length).eql(19);
    expect(skin.inverseBindMatrices[0].toArray()).eql([
      0.9971418380737305, -4.3711398944878965e-8, 0.07555299252271652, 0,
      4.358646421565027e-8, 1, 3.3025269186026662e-9, 0,
      -0.07555299252271652, 0, 0.9971418380737305, 0,
      0.05130045861005783, -0.0049998159520328045, -0.6770592331886292, 1,
    ]);
    expect(skin.inverseBindMatrices[1].toArray()).eql([
      0.06041746959090233, -4.3711398944878965e-8, 0.9981732964515686, 0,
      2.64093213964145e-9, 1, 4.3631551704947924e-8, 0,
      -0.9981732964515686, 0, 0.06041746959090233, 0,
      0.8218303918838501, -0.004986404906958342, -0.0607638880610466, 1,
    ]);
    expect(skin.inverseBindMatrices[2].toArray()).eql([
      0.986260712146759, -4.3711398944878965e-8, 0.16519659757614136, 0,
      4.3110834013759813e-8, 1, 7.22097448502268e-9, 0,
      -0.16519659757614136, 0, 0.986260712146759, 0,
      0.18158070743083954, -0.004987061023712158, -1.058603048324585, 1,
    ]);
    mesh.primitives.forEach(prim => {
      const morph = new PMorph();
      morph.create(prim.getEffectsGeometry());
      expect(morph.hasNormalMorph).to.eql(false);
      expect(morph.hasPositionMorph).to.eql(false);
      expect(morph.hasTangentMorph).to.eql(false);
      expect(morph.morphWeightsLength).to.eql(0);
      expect(morph.name.substring(0, 12)).to.eql('Morph target');
      expect(morph.type).to.eql(8);
      expect(morph.isNone()).to.eql(false);
      expect(morph.isValid()).to.eql(true);
      expect(morph.hasMorph()).to.eql(false);
    });
    const primitive = mesh.primitives[0];
    expect(primitive.effectsPriority).to.eql(priority);
    expect(primitive.shadowType).to.eql(PShadowType.none);
    const geometry = primitive.getEffectsGeometry();
    expect(geometry).to.eql(itemMesh.content.options.primitives[0].geometry);
    expect(geometry.getAttributeNames()).to.eql([
      'aPos', 'aNormal', 'aUV', 'aJoints', 'aWeights',
    ]);
    expect(geometry.drawStart).to.eql(0);
    expect(geometry.drawCount).to.eql(14016);
    expect(geometry.getIndexData()).not.to.eql(undefined);
    expect(geometry.getAttributeData('aPos').length).to.eql(9819);
    expect(geometry.getAttributeData('aNormal').length).to.eql(9819);
    expect(geometry.getAttributeData('aUV').length).to.eql(6546);
    expect(geometry.getAttributeData('aJoints').length).to.eql(13092);
    expect(geometry.getAttributeData('aWeights').length).to.eql(13092);
    expect(geometry.attributes).not.to.eql(undefined);
    if (geometry.attributes !== undefined) {
      expect(geometry.attributes['aJoints']).to.eql({
        dataSource: 'aJoints',
        normalize: false,
        offset: undefined,
        size: 4,
        stride: undefined,
        type: 5123,
      });
      expect(geometry.attributes['aNormal']).to.eql({
        dataSource: 'aNormal',
        normalize: false,
        offset: undefined,
        size: 3,
        stride: undefined,
        type: 5126,
      });
      expect(geometry.attributes['aPos']).to.eql({
        dataSource: 'aPos',
        normalize: false,
        offset: undefined,
        size: 3,
        stride: undefined,
        type: 5126,
      });
      expect(geometry.attributes['aUV']).to.eql({
        dataSource: 'aUV',
        normalize: false,
        offset: undefined,
        size: 2,
        stride: undefined,
        type: 5126,
      });
      expect(geometry.attributes['aWeights']).to.eql({
        dataSource: 'aWeights',
        normalize: false,
        offset: undefined,
        size: 4,
        stride: undefined,
        type: 5126,
      });
    }
    expect(itemMesh.content.options.primitives[0].material.type).to.eql(spec.MaterialType.pbr);
    const meshMaterial = primitive.material;
    expect(meshMaterial.materialType).to.eql(PMaterialType.pbr);
    expect(meshMaterial.name).to.eql('Cesium_Man-effect');
    meshMaterial.baseColorFactor.toArray().forEach((v, i) => {
      expect([1, 1, 1, 1][i]).closeTo(v, 1e-5);
    });
    const inMaterial = itemMesh.content.options.primitives[0].material;
    expect(meshMaterial.baseColorTexture).to.eql(inMaterial.baseColorTexture);
    expect(meshMaterial.emissiveIntensity).to.eql(1);
    meshMaterial.emissiveFactor.toArray().forEach((v, i) => {
      expect([0, 0, 0][i]).closeTo(v, 1e-5);
    });
    expect(meshMaterial.roughnessFactor).to.eql(1);
    expect(meshMaterial.metallicFactor).to.eql(0);
    expect(meshMaterial.enableShadow).to.eql(false);
    //
    mesh.boundingBox.min.toArray().forEach((v, i) => {
      expect([-0.13100001215934753, -0.5691370964050293, 0][i]).closeTo(v, 1e-5);
    });
    mesh.boundingBox.max.toArray().forEach((v, i) => {
      expect([0.1809540092945099, 0.5691368579864502, 1.5065499544143677][i]).closeTo(v, 1e-5);
    });
    await loader.loadScene({
      gltf: {
        resource: 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/WaterBottle.glb',
        compatibleMode: 'tiny3d',
      },
      effects: {
        renderer: player.renderer,
        duration: 5,
        endBehavior: 2,
      },
    }).then(async loadResult => {
      const sceneAABB = loadResult.sceneAABB;
      expect(sceneAABB.max).to.eql([0.054450009018182755, 0.13022033870220184, 0.05445002391934395]);
      expect(sceneAABB.min).to.eql([-0.054450009018182755, -0.13022033870220184, -0.05445002391934395]);
      //
      const itemList = loadResult.items;
      expect(itemList.length).to.eql(2);
      expect(itemList[0].type).to.eql('tree');
      const itemTree = itemList[0];
      const animManager = new PAnimationManager(itemTree.content.options.tree, itemTree);
      expect(animManager.type).to.eql(PObjectType.animationManager);
      const animations = animManager.animations;
      expect(animations.length).to.eql(0);
      //
      expect(itemList[1].type).to.eql('mesh');
      const itemMesh = itemList[1];
      const priority = 123;
      const mesh = new PMesh(player.renderer.engine, itemMesh, { listIndex: priority });
      //
      expect(mesh.name).to.eql('WaterBottle');
      expect(mesh.type).to.eql(PObjectType.mesh);
      expect(mesh.parentIndex).to.eql(0);
      expect(mesh.skin).to.eql(undefined);
      expect(mesh.primitives.length).to.eql(1);
      expect(mesh.hide).to.eql(false);
      expect(mesh.priority).to.eql(priority);
      expect(mesh.boundingBox.max.toArray()).to.eql([0.054450009018182755, 0.13022033870220184, 0.05445002391934395]);
      expect(mesh.boundingBox.min.toArray()).to.eql([-0.054450009018182755, -0.13022033870220184, -0.05445002391934395]);
      expect(mesh.mriMeshs.length).to.eql(1);
      const geometry = mesh.primitives[0].getEffectsGeometry();
      expect(geometry).to.eql(itemMesh.content.options.primitives[0].geometry);
      expect(geometry.getAttributeNames()).to.eql([
        'aPos', 'aNormal', 'aTangent', 'aUV',
      ]);
      expect(geometry.drawStart).to.eql(0);
      expect(geometry.drawCount).to.eql(13530);
      expect(geometry.getIndexData()).not.to.eql(undefined);
      expect(geometry.getAttributeData('aPos').length).to.eql(7647);
      expect(geometry.getAttributeData('aNormal').length).to.eql(7647);
      expect(geometry.getAttributeData('aUV').length).to.eql(5098);
      expect(geometry.getAttributeData('aTangent').length).to.eql(10196);
      expect(geometry.attributes).not.to.eql(undefined);
      if (geometry.attributes !== undefined) {
        expect(geometry.attributes['aNormal']).to.eql({
          dataSource: 'aNormal',
          normalize: false,
          offset: undefined,
          size: 3,
          stride: undefined,
          type: 5126,
        });
        expect(geometry.attributes['aPos']).to.eql({
          dataSource: 'aPos',
          normalize: false,
          offset: undefined,
          size: 3,
          stride: undefined,
          type: 5126,
        });
        expect(geometry.attributes['aTangent']).to.eql({
          dataSource: 'aTangent',
          normalize: false,
          offset: undefined,
          size: 4,
          stride: undefined,
          type: 5126,
        });
        expect(geometry.attributes['aUV']).to.eql({
          dataSource: 'aUV',
          normalize: false,
          offset: undefined,
          size: 2,
          stride: undefined,
          type: 5126,
        });
      }
      expect(itemMesh.content.options.primitives[0].material.type).to.eql(spec.MaterialType.pbr);
      expect(mesh.primitives[0].material.materialType).to.eql(PMaterialType.pbr);
      const inMaterial = itemMesh.content.options.primitives[0].material;
      const meshMaterial = mesh.primitives[0].material;
      expect(meshMaterial.name).to.eql('BottleMat');
      meshMaterial.baseColorFactor.toArray().forEach((v, i) => {
        expect([1, 1, 1, 1][i]).closeTo(v, 1e-5);
      });
      expect(meshMaterial.baseColorTexture).to.eql(inMaterial.baseColorTexture);
      expect(meshMaterial.emissiveIntensity).to.eql(1);
      meshMaterial.emissiveFactor.toArray().forEach((v, i) => {
        expect([1, 1, 1][i]).closeTo(v, 1e-5);
      });
      expect(meshMaterial.roughnessFactor).to.eql(1);
      expect(meshMaterial.metallicFactor).to.eql(1);
      expect(meshMaterial.enableShadow).to.eql(false);
      //
      mesh.boundingBox.min.toArray().forEach((v, i) => {
        expect([-0.054450009018182755, -0.13022033870220184, -0.05445002391934395][i]).closeTo(v, 1e-5);
      });
      mesh.boundingBox.max.toArray().forEach((v, i) => {
        expect([0.054450009018182755, 0.13022033870220184, 0.05445002391934395][i]).closeTo(v, 1e-5);
      });
    });
  });
  it('端上测试', async function () {
    const downloader = new Downloader();
    const scn = await new Promise<JSONValue>((resolve, reject) => {
      downloader.downloadJSON(
        'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/CesiumMan.json',
        resolve,
        (status, responseText) => {
          reject(`Couldn't load JSON ${url}: status ${status}, ${responseText}`);
        });
    });
    const comp = await generateComposition(player, scn, {}, { pauseOnFirstFrame: true });
    //
    const items = comp.items;
    expect(items.length).to.eql(2);
    const treeItem = items[0];
    expect(treeItem.type).to.eql(spec.ItemType.tree);
    expect(treeItem.id).to.eql('tree0');
    expect(treeItem.name).to.eql('tree0');
    const treeWorldMatrix = treeItem.transform.getWorldMatrix();
    treeWorldMatrix.elements.forEach((v, i) => {
      expect([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ][i]).closeTo(v, 1e-5);
    });

    const treeOptions = treeItem.options;
    expect(treeOptions.animation).to.eql(0);
    expect(treeOptions.animations.length).to.eql(1);
    expect(treeOptions.children.length).to.eql(1);
    treeOptions.children.forEach((c, i) => {
      expect([0][i]).closeTo(c, 1e-5);
    });
    expect(treeOptions.nodes.length).to.eql(22);
    const tracks = treeOptions.animations[0].tracks;
    const track0 = tracks[0];
    expect(track0.node).to.eql(3);
    expect(track0.interpolation).to.eql('LINEAR');
    expect(track0.path).to.eql('translation');
    expect(track0.input.length).to.eql(48);
    [
      0.04166661947965622, 0.08333330601453781, 0.125, 0.16666659712791443, 0.20833329856395721, 0.25,
      0.29166659712791443, 0.3333333134651184, 0.3750000298023224, 0.41666659712791443, 0.4583333134651184,
      0.5, 0.5416666865348816, 0.5833333134651184, 0.625, 0.6666666865348816, 0.7083333134651184, 0.75,
      0.7916666865348816, 0.8333333134651184, 0.8750000596046448, 0.9166666865348816, 0.9583333134651184, 1,
      1.0416669845581055, 1.0833330154418945, 1.125, 1.1666669845581055, 1.2083330154418945, 1.25,
      1.2916669845581055, 1.3333330154418945, 1.3750001192092896, 1.4166669845581055, 1.4583330154418945, 1.5,
      1.5416669845581055, 1.5833330154418945, 1.6250001192092896, 1.6666669845581055, 1.7083330154418945, 1.75,
      1.7916669845581055, 1.8333330154418945, 1.8750001192092896, 1.9166669845581055, 1.9583330154418945,
    ].forEach((v, i) => {
      expect(track0.input[i]).closeTo(v, 1e-5);
    });
    expect(track0.output.length).to.eql(144);
    [
      1.971350016560791e-8, -0.02000010944902897, 0.6439971327781677, 1.7385199058139733e-8, -0.02000010944902897,
      0.6540120840072632, 2.0703099679053594e-8, -0.02000010944902897, 0.6670830845832825, 2.993629877323656e-8,
      -0.020000120624899864, 0.6802471876144409, 3.00744993353419e-8, -0.020000120624899864, 0.6905401349067688,
      2.984170066611114e-8, -0.020000120624899864, 0.6950002312660217, 2.55343000077346e-8, -0.020098520442843437,
      0.6947941184043884, 1.7152400388908973e-8, -0.020370520651340485, 0.6932101249694824, 2.541789889676238e-8,
      -0.020781319588422775, 0.6904690861701965, 2.6116399709508187e-8, -0.021296419203281403, 0.6867902278900146,
      1.197189991586356e-8, -0.021880919113755226, 0.6823940873146057, 3.038740103988857e-8, -0.022500120103359222,
      0.6775001883506775, 2.8561100151591745e-8, -0.02311931923031807, 0.6723281145095825, 2.518510022753162e-8,
      -0.023703809827566147, 0.6670992970466614, 3.636089829228695e-8, -0.02421892061829567, 0.6620311141014099,
      2.7164100302456973e-8, -0.024629710242152214, 0.6573460102081299, 1.7501600169111953e-8, -0.02490171045064926,
      0.6532620787620544, 1.6221099130575567e-8, -0.025000110268592834, 0.6500000953674316, 3.8805598734370506e-8,
      -0.025000110268592834, 0.6472381949424744, 2.786259933884594e-8, -0.025000110268592834, 0.644753098487854,
      2.4603000525758034e-8, -0.02500011958181858, 0.6429169774055481, 2.762979889325834e-8, -0.025000110268592834,
      0.6420990824699402, 2.9026798742393112e-8, -0.025000110268592834, 0.6426699757575989, 3.321769881381442e-8,
      -0.025000110268592834, 0.6450002193450928, 3.158789851909205e-8, -0.025370510295033455, 0.6498960852622986,
    ].forEach((v, i) => {
      expect(track0.output[i]).closeTo(v, 1e-5);
    });
    const track7 = tracks[7];
    expect(track7.node).to.eql(13);
    expect(track7.interpolation).to.eql('LINEAR');
    expect(track7.path).to.eql('rotation');
    expect(track7.input.length).to.eql(48);
    [
      0.04166661947965622, 0.08333330601453781, 0.125, 0.16666659712791443, 0.20833329856395721, 0.25, 0.29166659712791443,
      0.3333333134651184, 0.3750000298023224, 0.41666659712791443, 0.4583333134651184, 0.5, 0.5416666865348816,
      0.5833333134651184, 0.625, 0.6666666865348816, 0.7083333134651184, 0.75, 0.7916666865348816, 0.8333333134651184,
      0.8750000596046448, 0.9166666865348816, 0.9583333134651184, 1, 1.0416669845581055, 1.0833330154418945, 1.125,
      1.1666669845581055, 1.2083330154418945, 1.25, 1.2916669845581055, 1.3333330154418945, 1.3750001192092896,
      1.4166669845581055, 1.4583330154418945, 1.5, 1.5416669845581055, 1.5833330154418945, 1.6250001192092896,
      1.6666669845581055, 1.7083330154418945, 1.75, 1.7916669845581055, 1.8333330154418945, 1.8750001192092896,
      1.9166669845581055, 1.9583330154418945,
    ].forEach((v, i) => {
      expect(track7.input[i]).closeTo(v, 1e-5);
    });
    expect(track7.output.length).to.eql(192);
    [
      -0.004063833504915237, 0.6227141618728638, -0.004470687359571457, -0.7824262380599976, -0.0010555407498031855,
      0.623201847076416, -0.0043305219151079655, -0.7820485234260559, 0.0036982104647904634, 0.6239433884620667,
      -0.004133866634219885, -0.7814499139785767, 0.009987026453018188, 0.6248710751533508, -0.003911586944013834,
      -0.7806543111801147, 0.017600642517209053, 0.6259133219718933, -0.0036944616585969925, -0.7796852588653564,
      0.02632775343954563, 0.6269997358322144, -0.0035130134783685207, -0.7785666584968567, 0.035954687744379044,
      0.6280642151832581, -0.0033969907090067863, -0.7773230671882629, 0.04626515507698059, 0.6290482878684998,
      -0.003375347936525941, -0.7759810090065002, 0.057039473205804825, 0.6299037337303162, -0.003476002486422658,
      -0.7745683193206787, 0.06805485486984253, 0.6305938959121704, -0.0037257885560393333, -0.7731146216392517,
      0.07908577471971512, 0.6310954689979553, -0.004150485619902611, -0.7716520428657532, 0.08990399539470673,
      0.6313987970352173, -0.004775034263730049, -0.7702144384384155, 0.10027999430894852, 0.6315075755119324,
      -0.0056238495744764805, -0.7688372731208801, 0.10998272895812988, 0.6314378976821899, -0.006720630917698145,
      -0.7675577998161316, 0.11878100782632828, 0.6312174201011658, -0.008089195936918259, -0.7664139866828918,
      0.1264438033103943, 0.6308819055557251, -0.009753123857080936, -0.7654444575309753, 0.13274070620536804,
      0.6304723620414734, -0.0117372777312994, -0.7646874785423279, 0.13744227588176727, 0.6300323009490967,
      -0.014066480100154877, -0.7641801238059998, 0.13804565370082855, 0.6293426156044006, -0.01933957263827324,
      -0.7645244598388672, 0.1331067830324173, 0.6283433437347412, -0.02874445728957653, -0.7659251093864441,
      0.12399603426456451, 0.6272484064102173, -0.04019630700349808, -0.7678337693214417, 0.11208537220954895,
      0.6262312531471252, -0.05157339945435524, -0.7698127627372742, 0.09873149544000626, 0.62547367811203,
      -0.060693636536598206, -0.7715901732444763, 0.08526771515607834, 0.6252033710479736, -0.0653248131275177,
      -0.7730351090431213, 0.07010213285684586, 0.6254288554191589, -0.06435619294643402, -0.7744566202163696,
    ].forEach((v, i) => {
      expect(track7.output[i]).closeTo(v, 1e-5);
    });
    const track20 = tracks[20];
    expect(track20.node).to.eql(18);
    expect(track20.interpolation).to.eql('LINEAR');
    expect(track20.path).to.eql('scale');
    expect(track20.input.length).to.eql(48);
    [
      0.04166661947965622, 0.08333330601453781, 0.125, 0.16666659712791443, 0.20833329856395721, 0.25,
      0.29166659712791443, 0.3333333134651184, 0.3750000298023224, 0.41666659712791443, 0.4583333134651184,
      0.5, 0.5416666865348816, 0.5833333134651184, 0.625, 0.6666666865348816, 0.7083333134651184, 0.75,
      0.7916666865348816, 0.8333333134651184, 0.8750000596046448, 0.9166666865348816, 0.9583333134651184, 1,
      1.0416669845581055, 1.0833330154418945, 1.125, 1.1666669845581055, 1.2083330154418945, 1.25, 1.2916669845581055,
      1.3333330154418945, 1.3750001192092896, 1.4166669845581055, 1.4583330154418945, 1.5, 1.5416669845581055,
      1.5833330154418945, 1.6250001192092896, 1.6666669845581055, 1.7083330154418945, 1.75, 1.7916669845581055,
      1.8333330154418945, 1.8750001192092896, 1.9166669845581055, 1.9583330154418945,
    ].forEach((v, i) => {
      expect(track20.input[i]).closeTo(v, 1e-5);
    });
    expect(track20.output.length).to.eql(144);
    [
      0.9999997019767761, 0.9999997019767761, 0.9999997615814209, 0.9999992847442627, 0.999999463558197,
      0.9999995231628418, 0.9999995231628418, 0.9999996423721313, 0.9999995231628418, 0.9999995231628418,
      0.9999996423721313, 0.9999997615814209, 0.999999463558197, 0.9999994039535522, 0.9999995827674866,
      0.9999995231628418, 0.9999995231628418, 0.9999995231628418, 0.9999994039535522, 0.9999995827674866,
      0.9999997019767761, 0.9999995231628418, 0.9999993443489075, 0.9999995827674866, 0.9999996423721313,
      0.999999463558197, 0.9999997019767761, 0.9999996423721313, 0.999999463558197, 0.9999994039535522,
      0.9999998211860657, 0.9999994039535522, 0.9999994039535522, 0.9999993443489075, 0.999999463558197,
      0.9999994039535522, 0.9999994039535522, 0.9999995231628418, 0.999999463558197, 0.9999996423721313,
      0.9999994039535522, 0.9999995827674866, 0.9999996423721313, 0.999999463558197, 0.9999995231628418,
      0.999999463558197, 0.9999995827674866, 0.9999994039535522, 0.9999996423721313, 0.999999463558197,
      0.9999997019767761, 0.9999998211860657, 0.9999997019767761, 0.9999995827674866, 0.9999996423721313,
      0.9999996423721313, 0.9999995827674866, 0.999999463558197, 0.9999995231628418, 0.9999995231628418,
      0.999999463558197, 0.9999994039535522, 0.9999996423721313, 0.9999991059303284, 0.9999994039535522,
    ].forEach((v, i) => {
      expect(track20.output[i]).closeTo(v, 1e-5);
    });
    //
    expect(treeOptions.animations.length).to.eql(1);
    expect(treeOptions.children.length).to.eql(1);
    //
    const modelItem = items[1];
    expect(modelItem.type).to.eql(VFX_ITEM_TYPE_3D);
    expect(modelItem.name).to.eql('Cesium_Man');
    expect(modelItem.listIndex).to.eql(1);
    expect(modelItem.parentId).to.eql('tree0^2');
    const worldMatrix = modelItem.transform.getWorldMatrix();
    [
      3.422854177870249e-8, -3.4228538225988814e-8, 0.9999998807907104, 0,
      0.9999999403953552, 1.1715931027525724e-15, -3.4228538225988814e-8, 0,
      0, 0.9999999403953552, 3.422854177870249e-8, 0,
      0, 0, 0, 1,
    ].forEach((val, idx) => {
      expect(val).closeTo(worldMatrix.elements[idx], 1e-5);
    });
    const skin = modelItem.options.content.options.skin;
    expect(skin.inverseBindMatrices.length).to.eql(304);
    [
      0.9971418380737305, -4.3711398944878965e-8, 0.07555299252271652, 0, 4.358646421565027e-8, 1,
      3.3025269186026662e-9, 0, -0.07555299252271652, 0, 0.9971418380737305, 0, 0.05130045861005783,
      -0.0049998159520328045, -0.6770592331886292, 1, 0.06041746959090233, -4.3711398944878965e-8,
      0.9981732964515686, 0, 2.64093213964145e-9, 1, 4.3631551704947924e-8, 0, -0.9981732964515686,
      0, 0.06041746959090233, 0, 0.8218303918838501, -0.004986404906958342, -0.0607638880610466, 1,
      0.986260712146759, -4.3711398944878965e-8, 0.16519659757614136, 0, 4.3110834013759813e-8, 1,
      7.22097448502268e-9, 0, -0.16519659757614136, 0, 0.986260712146759, 0, 0.18158070743083954,
      -0.004987061023712158, -1.058603048324585, 1, -0.0384785495698452, -4.3711398944878965e-8,
      0.9992595911026001, 0, -1.6819512449472995e-9, 1, 4.367903372326509e-8, 0, -0.9992595911026001,
      0, -0.0384785495698452, 0, 1.1374080181121826, -0.0049894447438418865, 0.03729343041777611, 1,
      -0.011275229975581169, -4.3711398944878965e-8, -0.9999366402626038, 0, -4.9285608927363e-10, 1,
      -4.37086278282095e-8, 0, 0.9999366402626038, 0, -0.011275229975581169, 0, -1.189831018447876,
    ].forEach((v, i) => {
      expect(skin.inverseBindMatrices[i]).closeTo(v, 1e-5);
    });
    expect(skin.joints.length).to.eql(19);
    [3, 12, 13, 20, 21, 17, 14, 18, 15, 19, 16, 8, 4, 9, 5, 10, 6, 11, 7].forEach((v, i) => {
      expect(skin.joints[i]).to.eql(v);
    });
    //
    const primitives = modelItem.options.content.options.primitives;
    expect(primitives.length).to.eql(1);
    const geometry = primitives[0].geometry;
    expect(geometry.attributesName.length).to.eql(5);
    geometry.attributesName.forEach((val, idx) => {
      expect(val).to.eql(['aJoints', 'aNormal', 'aPos', 'aUV', 'aWeights'][idx]);
    });
    const position = geometry.attributes.aPos;
    const normal = geometry.attributes.aNormal;
    const uv1 = geometry.attributes.aUV;
    const joint = geometry.attributes.aJoints;
    const weight = geometry.attributes.aWeights;
    expect(position.size).to.eql(3);
    expect(position.type).to.eql(5126);
    expect(position.normalize).to.eql(false);
    expect(normal.size).to.eql(3);
    expect(normal.type).to.eql(5126);
    expect(normal.normalize).to.eql(false);
    expect(uv1.size).to.eql(2);
    expect(uv1.type).to.eql(5126);
    expect(uv1.normalize).to.eql(false);
    expect(joint.size).to.eql(4);
    expect(joint.type).to.eql(5123);
    expect(joint.normalize).to.eql(false);
    expect(weight.size).to.eql(4);
    expect(weight.type).to.eql(5126);
    expect(weight.normalize).to.eql(false);
    const positionBuffer = geometry.bufferProps.aPos.data;
    const normalBuffer = geometry.bufferProps.aNormal.data;
    const uvBuffer = geometry.bufferProps.aUV.data;
    const jointBuffer = geometry.bufferProps.aJoints.data;
    const weightBuffer = geometry.bufferProps.aWeights.data;
    [
      0.09342920035123825, 0.048714570701122284, 0.9735749959945679, 0.07329291105270386, 0.08925402164459229, 0.9775350093841553,
      0.0848226472735405, 0.04660588130354881, 1.0469099283218384, 0.0763043686747551, 0.0814896821975708, 1.0501099824905396,
      0.1562570035457611, 0.5175288915634155, 0.844681978225708, 0.16423200070858002, 0.5041099190711975, 0.8343349695205688,
      0.17022499442100525, 0.545353889465332, 0.8108369708061218, 0.1809539943933487, 0.5468019247055054, 0.7949069738388062,
      0.10521499812602997, 0.5284019112586975, 0.802294135093689, 0.09775196760892868, 0.5415329337120056, 0.8128079771995544,
      0.13724100589752197, 0.5518779158592224, 0.7846001386642456, 0.1427379995584488, 0.5683138966560364, 0.7825331091880798,
      0.1562570035457611, -0.5175291299819946, 0.8446819186210632, 0.1317799985408783, -0.5342841148376465, 0.8410660028457642,
      0.17022499442100525, -0.5453541278839111, 0.810836911201477, 0.1628299057483673, -0.5645990967750549, 0.7979189157485962,
      0.10521499812602997, -0.5284020900726318, 0.8022940158843994, 0.1302040070295334, -0.5113590955734253, 0.806075930595398,
      0.13724100589752197, -0.5518780946731567, 0.7845999002456665, 0.16086100041866302, -0.550517201423645, 0.7795209288597107,
    ].forEach((v, i) => {
      expect(positionBuffer[i]).closeTo(v, 1e-5);
    });
    [
      0.9666681289672852, 0.2427504062652588, 0.08139491081237793, 0.5926201343536377, 0.8049721121788025, 0.028657428920269012,
      0.9823477268218994, 0.1454842984676361, 0.11758999526500702, 0.7848681807518005, 0.6137763261795044, 0.08521020412445068,
      0.6377003192901611, 0.38060590624809265, 0.6696845889091492, 0.9406952261924744, -0.2989667057991028, 0.1603481024503708,
      0.6337714791297913, 0.45993149280548096, 0.6219298839569092, 0.9917799830436707, -0.0022278418764472008, -0.12793609499931335,
      -0.4683813154697418, -0.12970750033855438, -0.8739537000656128, -0.6921759247779846, 0.620516836643219, -0.3685806095600128,
      -0.3818897008895874, -0.1392296999692917, -0.9136604070663452, -0.34664180874824524, 0.7513930201530457, -0.5614694356918335,
      0.6377003192901611, -0.38060590624809265, 0.6696845889091492, 0.1844877004623413, -0.7153974175453186, 0.6739220023155212,
      0.6337714791297913, -0.45993149280548096, 0.6219298839569092, 0.31215381622314453, -0.8252788186073303, 0.47061121463775635,
      -0.4683813154697418, 0.12970750033855438, -0.8739537000656128, -0.04324638098478317, 0.5547868013381958, -0.8308678865432739,
      -0.3818897008895874, 0.1392296999692917, -0.9136604070663452, 0.1048332005739212, 0.3493525981903076, -0.9311084151268005,
    ].forEach((v, i) => {
      expect(normalBuffer[i]).closeTo(v, 1e-5);
    });
    [
      0.2736569941043854, 0.8036180138587952, 0.3031649887561798, 0.799481987953186, 0.2714029848575592, 0.7648169994354248,
      0.29099100828170776, 0.7632129788398743, 0.8410069942474365, 0.12983697652816772, 0.839942991733551, 0.14197897911071777,
      0.8812209963798523, 0.1381869912147522, 0.880325973033905, 0.14522004127502441, 0.8591259717941284, 0.0766339898109436,
      0.8540779948234558, 0.08584398031234741, 0.8945890069007874, 0.09953099489212036, 0.8917419910430908, 0.105663001537323,
      0.5697129964828491, 0.3033990263938904, 0.5861039757728577, 0.3002550005912781, 0.5618900060653687, 0.2626950144767761,
      0.577551007270813, 0.2682049870491028, 0.5070399641990662, 0.3006790280342102, 0.5272729992866516, 0.3023719787597656,
      0.5198910236358643, 0.260748028755188, 0.5338389873504639, 0.26270800828933716, 0.5737109780311584, 0.2531500458717346,
      0.5603089928627014, 0.256181001663208, 0.3572849929332733, 0.46074002981185913, 0.3452480137348175, 0.4619719982147217,
      0.35148298740386963, 0.4901829957962036, 0.342864990234375, 0.4889410138130188, 0.3449459969997406, 0.3859059810638428,
      0.34152400493621826, 0.36677002906799316, 0.33701199293136597, 0.38905197381973267, 0.33330801129341125, 0.3686150312423706,
    ].forEach((v, i) => {
      expect(uvBuffer[i]).closeTo(v, 1e-5);
    });
    [
      0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 7, 9, 0, 0, 7, 9, 0, 0, 9, 0, 0, 0, 9, 0, 0, 0, 7, 9, 0, 0, 7, 9, 0, 0, 9,
      0, 0, 0, 9, 0, 0, 0, 8, 10, 0, 0, 8, 10, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 8, 10, 0, 0, 8, 10, 0, 0, 10, 0, 0, 0, 10, 0, 0,
      0, 10, 0, 0, 0, 10, 0, 0, 0, 13, 15, 17, 0, 13, 15, 17, 0, 13, 15, 17, 0,
    ].forEach((v, i) => {
      expect(jointBuffer[i]).closeTo(v, 1e-5);
    });
    [
      0.17160889506340027, 0.6451614499092102, 0.13225100934505463, 0.05097858980298042, 0.2263036072254181, 0.5693775415420532,
      0.160634845495224, 0.043683916330337524, 0.08763298392295837, 0.33597317337989807, 0.4061647951602936, 0.17022907733917236,
      0.11152446269989014, 0.28163453936576843, 0.4927929639816284, 0.1140480786561966, 0.07008665800094604, 0.929913341999054,
      0, 0, 0.0653330609202385, 0.9346669316291809, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.020963601768016815, 0.9790363907814026, 0, 0,
      0.04044990986585617, 0.9595500826835632, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.07369416207075119, 0.9263058304786682, 0, 0,
      0.06026321277022362, 0.9397367835044861, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.021401280537247658, 0.9785987138748169, 0, 0,
      0.03885405883193016, 0.9611459374427795, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.20391489565372467,
      0.4302911162376404, 0.36579400300979614, 0, 0.43764400482177734, 0.2858009934425354, 0.27655500173568726, 0, 0.21779599785804749,
    ].forEach((v, i) => {
      expect(weightBuffer[i]).closeTo(v, 1e-5);
    });

    const material = primitives[0].material;
    expect(material.name).to.eql('Cesium_Man-effect');
    expect(material.type).to.eql('pbr');
    expect(material.alphaCutOff).to.eql(0.5);
    expect(material.baseColorFactor).to.eql([255, 255, 255, 255]);
    expect(material.baseColorTexture).not.eql(undefined);
    expect(material.side).to.eql(spec.SideMode.FRONT);
    expect(material.blending).to.eql(spec.MaterialBlending.opaque);
    expect(material.emissiveFactor).to.eql([0, 0, 0, 255]);
    expect(material.emissiveIntensity).to.eql(1);
    expect(material.emissiveTexture).to.eql(undefined);
    expect(material.metallicFactor).to.eql(0);
    expect(material.roughnessFactor).to.eql(1);
    expect(material.metallicRoughnessTexture).to.eql(undefined);
    expect(material.normalTexture).to.eql(undefined);
    expect(material.occlusionTexture).to.eql(undefined);
    comp.dispose();
  });
  it('Box求交测试', function () {
    const eps = 0.0001;
    const boxMin = new Vector3(-1, -1, -1);
    const boxMax = new Vector3(1, 1, 1);
    //
    const ray1Origin = new Vector3(-2, 0, 0);
    const ray1Direction = new Vector3(1, 0, 0);
    const t1 = RayBoxTesting(ray1Origin, ray1Direction, boxMin, boxMax);
    expect(t1).to.eql(1);
    //
    const ray2Origin = new Vector3(-2, 0, 0);
    const ray2Direction = new Vector3(-1, 0, 0);
    const t2 = RayBoxTesting(ray2Origin, ray2Direction, boxMin, boxMax);
    expect(t2).to.eql(undefined);
    //
    const ray3Origin = new Vector3(0, 0, 0);
    const ray3Direction = new Vector3(1, 0, 0);
    const t3 = RayBoxTesting(ray3Origin, ray3Direction, boxMin, boxMax);
    expect(t3).to.eql(1);
    //
    const ray4Origin = new Vector3(0, 2, 0);
    const ray4Direction = new Vector3(0, -1, -1);
    const t4 = RayBoxTesting(ray4Origin, ray4Direction, boxMin, boxMax);
    expect(t4).to.eql(1);
    //
    const ray5Origin = new Vector3(1, -2, 1);
    const ray5Direction = new Vector3(0, 1, 0);
    const t5 = RayBoxTesting(ray5Origin, ray5Direction, boxMin, boxMax);
    expect(t5).to.eql(1);
    //
    const ray6Origin = new Vector3(1, -2, 0);
    const ray6Direction = new Vector3(0, -1, 0);
    const t6 = RayBoxTesting(ray6Origin, ray6Direction, boxMin, boxMax);
    expect(t6).to.eql(undefined);
  });
  it('Triangle求交测试', function () {
    const a = new Vector3(1, 1, 0);
    const b = new Vector3(0, 1, 1);
    const c = new Vector3(1, 0, 1);

    const t1 = RayTriangleTesting(new Vector3(0, 0, 0), new Vector3(0, 0, 0).normalize(), a, b, c, false);
    expect(t1).to.eql(undefined);

    const t2 = RayTriangleTesting(new Vector3(0, 0, 0), new Vector3(1, 1, 1).normalize(), a, b, c, true);
    expect(t2).to.eql(undefined);

    const t3 = RayTriangleTesting(new Vector3(0, 0, 0), new Vector3(1, 1, 1).normalize(), a, b, c, false);
    expect(t3).closeTo(1.1547005591040844, 1e-5);

    b.multiply(-1);
    const t4 = RayTriangleTesting(new Vector3(0, 0, 0), new Vector3(1, 1, 1).normalize(), a, b, c, false);
    expect(t4).to.eql(undefined);

    a.multiply(-1);
    const t5 = RayTriangleTesting(new Vector3(0, 0, 0), new Vector3(1, 1, 1).normalize(), a, b, c, false);
    expect(t5).to.eql(undefined);

    b.multiply(-1);
    const t6 = RayTriangleTesting(new Vector3(0, 0, 0), new Vector3(1, 1, 1).normalize(), a, b, c, false);
    expect(t6).to.eql(undefined);

    a.multiply(-1);
    b.multiply(-1);
    const t7 = RayTriangleTesting(new Vector3(0, 0, 0), new Vector3(-1, -1, -1).normalize(), a, b, c, false);
    expect(t7).to.eql(undefined);
  });
});

