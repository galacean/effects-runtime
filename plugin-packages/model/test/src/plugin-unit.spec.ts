/* eslint-disable padding-line-between-statements */
import type { GLGeometry, Scene } from '@galacean/effects';
import { Player, Texture, spec, math, Engine, Material, SerializationHelper, VFXItem } from '@galacean/effects';
import type { ModelCameraComponent, ModelLightComponent, ModelSkyboxComponent } from '@galacean/effects-plugin-model';
import {
  PEntity, PObject, PLightType, PMaterialType, PObjectType, PTransform, PCamera, PLight,
  PSkybox, PCameraManager, PLightManager, PMaterialPBR, PMaterialUnlit, RayBoxTesting,
  RayTriangleTesting, JSONConverter, AnimationComponent, ModelMeshComponent,
} from '@galacean/effects-plugin-model';
import type { GLMaterial } from '@galacean/effects-webgl';
import { LoaderImplEx } from '../../src/helper';
import { generateComposition } from './utilities';

const { Matrix4, Quaternion, Vector3, Vector4, RAD2DEG } = math;
const { expect } = chai;

class CustomPObject extends PObject { }
class CustomPEntity extends PEntity { }

describe('渲染插件单测', function () {
  this.timeout(60 * 1000);

  const player = new Player({
    canvas: document.createElement('canvas'),
  });

  it('3D 变换测试', () => {
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
      trans1.setRotation(Quaternion.fromAxisAngle(new Vector3(3, 7, 5), Math.PI * 0.15));
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
      trans0.setRotation(Quaternion.fromAxisAngle(new Vector3(-8.45, 13.0, 43.2), -Math.PI * 7.43));
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

  it('Object 和 Entity 测试', () => {
    const object = new CustomPObject();
    expect(object.isValid()).to.eql(false);
    object.type = PObjectType.light;
    expect(object.isValid()).to.eql(true);
    object.type = PObjectType.none;
    expect(object.isValid()).to.eql(false);
    //
    const entity = new CustomPEntity();
    expect(entity.visible).to.eql(false);
    entity.visible = true;
    expect(entity.visible).to.eql(false);
    entity.type = PObjectType.camera;
    expect(entity.visible).to.eql(true);
    expect(entity.deleted).to.eql(false);
    entity.onVisibleChanged(false);
    expect(entity.visible).to.eql(false);
    expect(entity.deleted).to.eql(false);
  });

  it('Light 测试', () => {
    const light1 = new PLight('light1', {
      id: '1',
      dataType: spec.DataType.LightComponent,
      lightType: spec.LightType.point,
      item: { id: '1' },
      color: {
        r: 253 / 255,
        g: 127 / 255,
        b: 169 / 255,
        a: 1,
      },
      intensity: 123,
      range: 67.9,
    }, {
      transform: {
        position: [123, 456, 789],
        rotation: [9.8, 7.654, 3.21],
        scale: [3.4, 5.7, 6.9],
      },
    } as unknown as ModelLightComponent);

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
    const light2 = new PLight('light2', {
      id: '2',
      item: { id: '1' },
      dataType: spec.DataType.LightComponent,
      lightType: spec.LightType.spot,
      color: {
        r: 0 / 255,
        g: 1.0,
        b: 163 / 255,
        a: 135 / 255,
      },
      intensity: 997,
      range: 1007.3,
      innerConeAngle: 35.8,
      outerConeAngle: 49.6,
    }, {
      transform: {
        position: [222, 333, 444],
        rotation: [0, 0, 0],
        scale: [5.6, 8.9, 10.2],
      },
    } as any as ModelLightComponent);
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
    const light3 = new PLight('light3', {
      id: '3',
      item: { id: '1' },
      dataType: spec.DataType.LightComponent,
      lightType: spec.LightType.directional,
      color: {
        r: 128 / 255,
        g: 0,
        b: 177 / 255,
        a: 33 / 255,
      },
      intensity: 868,
    }, {
      transform: {
        rotation: [12.3, 45.6, 78.9],
      },
    } as any as ModelLightComponent);
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

  it('Camera 测试', () => {
    const params1 = {
      id: '1',
      item: { id: '1' },
      dataType: spec.DataType.CameraComponent,
      type: spec.CameraType.perspective,
      aspect: 2,
      near: 0.01,
      far: 996,
      fov: 35,
      clipMode: 0,
    };
    const owner1 = {
      transform: {
        position: [3.21, 6.54, 9.87],
        rotation: [-27, 69, 35],
      },
    } as any as ModelCameraComponent;
    const camera1 = new PCamera('camera1', 800, 600, params1, owner1);
    expect(camera1.name).to.eql('camera1');
    expect(camera1.type).to.eql(PObjectType.camera);
    expect(camera1.width).to.eql(800);
    expect(camera1.height).to.eql(600);
    expect(camera1.farPlane).to.eql(996);
    expect(camera1.nearPlane).to.eql(0.01);
    expect(camera1.fov).to.eql(35);
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
      item: { id: '1' },
      dataType: spec.DataType.CameraComponent,
      type: spec.CameraType.perspective,
      near: 0.03,
      far: 1007,
      fov: 48,
      clipMode: 1,
    };
    const owner2 = {
      transform: {
        position: [13.5, 33.6, 56.2],
        rotation: [0, 45, 30],
      },
    } as any as ModelCameraComponent;
    const camera2 = new PCamera('camera2', 1080, 960, params2, owner2);
    expect(camera2.name).to.eql('camera2');
    expect(camera2.type).to.eql(PObjectType.camera);
    expect(camera2.width).to.eql(1080);
    expect(camera2.height).to.eql(960);
    expect(camera2.farPlane).to.eql(1007);
    expect(camera2.nearPlane).to.eql(0.03);
    expect(camera2.fov).to.eql(48);
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
    const cam1 = cameraManager.insert('camera1', params1);
    const cam2 = cameraManager.insert('camera2', params2);
    expect(cameraManager.getDefaultCamera()).not.eql(cam1);
    expect(cameraManager.getDefaultCamera()).not.eql(cam2);
    expect(cameraManager.getDefaultCamera()).to.eql(cameraManager.getActiveCamera());
    expect(cameraManager.getCameraList()).to.eql([cam1, cam2]);
    const viewportMatrix = Matrix4.IDENTITY.clone();
    cameraManager.updateDefaultCamera(
      45, viewportMatrix, 1, 0.001, 606,
      new Vector3(30.5, 100, 77),
      Quaternion.fromAxisAngle(new Vector3(10, -15, 33), 0.3),
      0,
    );
    const acam = cameraManager.getActiveCamera();
    expect(acam.width).to.eql(1024);
    expect(acam.height).to.eql(768);
    expect(acam.farPlane).to.eql(606);
    expect(acam.nearPlane).to.eql(0.001);
    expect(acam.fov).to.eql(45);
    expect(acam.clipMode).to.eql(0);
    expect(acam.aspect).to.eql(1);
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
        2.414213562373095, 0, 0, 0,
        0, 2.4142136573791504, 0, 0,
        0, 0, -1.0000033378601074, -1,
        0, 0, -0.0020000033546239138, 0,
      ][i]).closeTo(v, 1e-6);
    });
  });

  it('Material 测试', () => {
    const canvas = document.createElement('canvas');
    const engine = new Engine(canvas);
    const mat1 = new PMaterialPBR();
    const baseColorTexture1 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const metallicRoughnessTexture1 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const normalTexture1 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const occlusionTexture1 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const emissiveTexture1 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const materialData1 = {
      id: '1',
      name: 'mat1',
      dataType: spec.DataType.Material,
      shader: { id: spec.BuiltinObjectGUID.PBRShader },
      stringTags: {
        RenderFace: spec.RenderFace.Front,
        RenderType: spec.RenderType.Opaque,
      },
      floats: {
        _MetallicFactor: 0.78,
        _RoughnessFactor: 0.35,
        _NormalScale: 0.63,
        _OcclusionStrength: 0.84,
        _EmissiveIntensity: 2.5,
        _AlphaCutoff: 0.35,
        _MetallicRoughnessRotation: 0.986,
        _NormalRotation: -1.11,
        _OcclusionRotation: -5.69,
      },
      colors: {
        _BaseColorFactor: {
          r: 233 / 255,
          g: 128 / 255,
          b: 65 / 255,
          a: 76 / 255,
        },
        _EmissiveFactor: {
          r: 198 / 255,
          g: 120 / 255,
          b: 67 / 255,
          a: 99 / 255,
        },
      },
      vector4s: {
        _BaseColorSampler_ST: {
          x: 1,
          y: 1,
          z: 0.23,
          w: 0.56,
        },
        _MetallicRoughnessSampler_ST: {
          x: 1,
          y: 1,
          z: 0.79,
          w: -3.25,
        },
        _NormalSampler_ST: {
          x: 0.5,
          y: 0.7,
          z: -9.87,
          w: 1.56,
        },
        _OcclusionSampler_ST: {
          x: 2.0,
          y: -3.3,
          z: 0,
          w: 0,
        },
        _EmissiveSampler_ST: {
          x: 0,
          y: 20.3,
          z: 0,
          w: 0,
        },
      },
      textures: {
        _BaseColorSampler: {
          texture: baseColorTexture1,
        },
        _MetallicRoughnessSampler: {
          texture: metallicRoughnessTexture1,
        },
        _NormalSampler: {
          texture: normalTexture1,
        },
        _OcclusionSampler: {
          texture: occlusionTexture1,
        },
        _EmissiveSampler: {
          texture: emissiveTexture1,
        },
      },
    };
    expect(mat1.ZWrite).to.eql(true);
    expect(mat1.renderType).to.eql(spec.RenderType.Opaque);
    expect(mat1.isTransparent()).to.eql(false);
    expect(mat1.alphaCutoff).to.eql(0.5);
    expect(mat1.isFrontSide()).to.eql(true);
    expect(mat1.hasBaseColorTexture()).to.eql(false);
    expect(mat1.baseColorTextureTrans).to.eql(undefined);
    expect(mat1.hasMetallicRoughnessTexture()).to.eql(false);
    expect(mat1.metallicRoughnessTextureTrans).to.eql(undefined);
    expect(mat1.hasNormalTexture()).to.eql(false);
    expect(mat1.normalTextureTrans).to.eql(undefined);
    expect(mat1.hasOcclusionTexture()).to.eql(false);
    expect(mat1.occlusionTextureTrans).to.eql(undefined);
    expect(mat1.hasEmissiveTexture()).to.eql(false);
    expect(mat1.emissiveTextureTrans).to.eql(undefined);
    const glMat1 = Material.create(engine);
    glMat1.fromData(materialData1);
    mat1.create(glMat1);
    expect(mat1.type).to.eql(PObjectType.material);
    expect(mat1.materialType).to.eql(PMaterialType.pbr);
    expect(mat1.renderType).to.eql(spec.RenderType.Opaque);
    expect(mat1.baseColorTexture).to.eql(baseColorTexture1);
    expect(mat1.baseColorTextureTrans).not.to.eql(undefined);
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
    expect(mat1.metallicRoughnessTextureTrans).not.to.eql(undefined);
    mat1.metallicRoughnessTextureTrans.toArray().forEach((v, i) => {
      expect([
        0.552029550075531, -0.8338245153427124, 0.7900000214576721,
        0.8338245153427124, 0.552029550075531, -3.25,
        0, 0, 1,
      ][i]).closeTo(v, 1e-5);
    });
    expect(mat1.normalTexture).to.eql(normalTexture1);
    expect(mat1.normalTextureScale).to.eql(0.63);
    expect(mat1.normalTextureTrans).not.to.eql(undefined);
    mat1.normalTextureTrans.toArray().forEach((v, i) => {
      expect([
        0.22233076393604279, 0.6269890666007996, -9.869999885559082,
        -0.4478493332862854, 0.3112630546092987, 1.559999942779541,
        0, 0, 1,
      ][i]).closeTo(v, 1e-5);
    });
    expect(mat1.occlusionTexture).to.eql(occlusionTexture1);
    expect(mat1.occlusionTextureStrength).to.eql(0.84);
    expect(mat1.occlusionTextureTrans).not.to.eql(undefined);
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
    expect(mat1.emissiveTextureTrans).not.to.eql(undefined);
    mat1.emissiveTextureTrans.toArray().forEach((v, i) => {
      expect([
        0, 0, 0,
        0, 20.299999237060547, 0,
        0, 0, 1,
      ][i]).closeTo(v, 1e-5);
    });
    expect(mat1.ZWrite).to.eql(true);
    expect(mat1.alphaCutoff).to.eql(0.35);

    expect(mat1.isFrontSide()).to.eql(true);
    expect(mat1.isOpaque()).to.eql(true);

    expect(mat1.hasBaseColorTexture()).to.eql(true);
    expect(mat1.hasMetallicRoughnessTexture()).to.eql(true);
    expect(mat1.hasNormalTexture()).to.eql(true);
    expect(mat1.hasOcclusionTexture()).to.eql(true);
    expect(mat1.hasEmissiveTexture()).to.eql(true);
    //==============================================
    const mat2 = new PMaterialUnlit();
    const baseColorTexture2 = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const materialData2 = {
      id: '2',
      name: 'mat2',
      dataType: spec.DataType.Material,
      shader: { id: 'unlit000000000000000000000000000' },
      stringTags: {
        RenderFace: spec.RenderFace.Both,
        RenderType: spec.RenderType.Opaque,
      },
      floats: {
        ZWrite: 0,
        AlphaClip: 1,
        _AlphaCutoff: 0.76,
      },
      colors: {
        _BaseColorFactor: {
          r: 53 / 255,
          g: 246 / 255,
          b: 89 / 255,
          a: 135 / 255,
        },
      },
      textures: {
        _BaseColorSampler: {
          texture: baseColorTexture2,
        },
      },
    };
    expect(mat2.ZWrite).to.eql(true);
    expect(mat2.renderType).to.eql(spec.RenderType.Opaque);
    expect(mat2.alphaClip).to.eql(false);
    expect(mat2.alphaCutoff).to.eql(0.5);
    expect(mat2.isBothSide()).to.eql(false);
    expect(mat2.hasBaseColorTexture()).to.eql(false);
    const glMat2 = Material.create(engine);
    glMat2.fromData(materialData2);
    mat2.create(glMat2);
    expect(mat2.type).to.eql(PObjectType.material);
    expect(mat2.materialType).to.eql(PMaterialType.unlit);
    expect(mat2.baseColorTexture).to.eql(baseColorTexture2);
    mat2.baseColorFactor.toArray().forEach((v, i) => {
      expect([53, 246, 89, 135][i] / 255).closeTo(v, 1e-5);
    });
    expect(mat2.ZWrite).to.eql(false);
    expect(mat2.renderType).to.eql(spec.RenderType.Opaque);
    expect(mat2.alphaClip).to.eql(true);
    expect(mat2.alphaCutoff).to.eql(0.76);
    expect(mat2.isBothSide()).to.eql(true);
    expect(mat2.hasBaseColorTexture()).to.eql(true);

    engine.dispose();
  });

  it('Skybox 测试', () => {
    const canvas = document.createElement('canvas');
    const engine = new Engine(canvas);
    const specularTexture = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const brdfLUTTexture = Texture.create(engine, { data: { data: new Uint8Array(), width: 2, height: 2 } });
    const options = {
      id: '003',
      item: { id: '1' },
      name: 'skybox1',
      dataType: spec.DataType.SkyboxComponent,
      renderable: true,
      intensity: 3.45,
      reflectionsIntensity: 1.23,
      irradianceCoeffs: [1, 2, 3, 4, 5, 6],
      specularImage: specularTexture,
      specularImageSize: 128,
      specularMipCount: 6,
    };
    const skybox = new PSkybox('skybox1', options, { item: { renderOrder: 123 } } as unknown as ModelSkyboxComponent);
    skybox.setup(brdfLUTTexture);
    expect(skybox.type).to.eql(PObjectType.skybox);
    expect(skybox.priority).to.eql(123);
    expect(skybox.name).to.eql('skybox1');
    expect(skybox.intensity).to.eql(3.45);
    expect(skybox.reflectionsIntensity).to.eql(1.23);
    expect(skybox.irradianceCoeffs).to.eql([[1, 2, 3], [4, 5, 6]]);
    expect(skybox.specularImage).to.eql(specularTexture);
    expect(skybox.specularImageSize).to.eql(128);
    expect(skybox.specularMipCount).to.eql(6);

    engine.dispose();
  });

  it('Mesh 测试', async () => {
    const canvas = document.createElement('canvas');
    const engine = new Engine(canvas);
    const loader = new LoaderImplEx();
    const loadResult = await loader.loadScene({
      gltf: {
        resource: 'https://mdn.alipayobjects.com/afts/file/A*VwE_RJelo74AAAAAAAAAAAAADrd2AQ/CesiumMan.glb',
        compatibleMode: 'tiny3d',
      },
      effects: {
        duration: 5,
        endBehavior: 2,
      },
    });
    const sceneAABB = loadResult.sceneAABB;

    [0.1809539943933487, 0.569136917591095, 1.5065499544143677].forEach((v, i) => {
      expect(sceneAABB.max[i]).closeTo(v, 1e-5);
    });
    [-0.13100001215934753, -0.5691370964050293, 0].forEach((v, i) => {
      expect(sceneAABB.min[i]).closeTo(v, 1e-5);
    });
    //
    const jsonScene = loadResult.jsonScene;
    const itemList = jsonScene.items;
    expect(itemList.length).to.eql(23);
    engine.addPackageDatas({ jsonScene } as Scene);

    const animComp = new AnimationComponent(engine);

    SerializationHelper.deserialize(jsonScene.components[1], animComp);
    expect(animComp.clips.length).to.eql(1);
    const animClip = animComp.clips[0];
    expect(animClip.duration).to.eql(2);
    const positionCurves = animClip.positionCurves;
    expect(positionCurves.length).to.eql(19);
    const positionCurve0 = positionCurves[0];
    expect(positionCurve0.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1');
    const positionKeyFrames0 = positionCurve0.keyFrames;
    const position0_0 = positionKeyFrames0.getValue(0);
    const position0_1 = positionKeyFrames0.getValue(0.3);
    const position0_2 = positionKeyFrames0.getValue(0.7);
    const position0_3 = positionKeyFrames0.getValue(0.9);
    const position0_4 = positionKeyFrames0.getValue(1.3);
    const position0_5 = positionKeyFrames0.getValue(1.5);
    const position0_6 = positionKeyFrames0.getValue(1.7);
    const position0_7 = positionKeyFrames0.getValue(2.0);
    [1.971350016560791e-8, -0.02000010944902897, 0.6439971327781677].forEach((v, i) => {
      expect(position0_0.getElement(i)).closeTo(v, 1e-5);
    });
    [1.7152400388908973e-8, -0.020370520651340485, 0.6932101249694824].forEach((v, i) => {
      expect(position0_1.getElement(i)).closeTo(v, 1e-5);
    });
    [1.3019600508812346e-8, -0.025214210152626038, 0.652949869632721].forEach((v, i) => {
      expect(position0_2.getElement(i)).closeTo(v, 1e-5);
    });
    [2.762979889325834e-8, -0.025000110268592834, 0.6420990824699402].forEach((v, i) => {
      expect(position0_3.getElement(i)).closeTo(v, 1e-5);
    });
    [8.085935612465292e-9, -0.030000123813372696, 0.6976126806942994].forEach((v, i) => {
      expect(position0_4.getElement(i)).closeTo(v, 1e-5);
    });
    [2.1110500014742684e-8, -0.030000120401382446, 0.7099999785423279].forEach((v, i) => {
      expect(position0_5.getElement(i)).closeTo(v, 1e-5);
    });
    [2.436473201028034e-8, -0.030000099383949756, 0.6683129367469864].forEach((v, i) => {
      expect(position0_6.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0633099734036477e-8, -0.02000010944902897, 0.6399999856948853].forEach((v, i) => {
      expect(position0_7.getElement(i)).closeTo(v, 1e-5);
    });
    const positionCurve8 = positionCurves[8];
    expect(positionCurve8.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_arm_joint_R');
    const positionKeyFrames8 = positionCurve8.keyFrames;
    const position8_0 = positionKeyFrames8.getValue(0);
    const position8_1 = positionKeyFrames8.getValue(0.3);
    const position8_2 = positionKeyFrames8.getValue(0.7);
    const position8_3 = positionKeyFrames8.getValue(0.9);
    const position8_4 = positionKeyFrames8.getValue(1.3);
    const position8_5 = positionKeyFrames8.getValue(1.5);
    const position8_6 = positionKeyFrames8.getValue(1.7);
    const position8_7 = positionKeyFrames8.getValue(2.0);
    [-0.000039040998672135174, -0.08799996972084045, -0.00005953760046395473].forEach((v, i) => {
      expect(position8_0.getElement(i)).closeTo(v, 1e-5);
    });
    [-0.00003922427276847884, -0.08799999766051769, -0.0008771866378083359].forEach((v, i) => {
      expect(position8_1.getElement(i)).closeTo(v, 1e-5);
    });
    [-0.00003911929889000021, -0.08799997717142105, -0.00005948260150034912].forEach((v, i) => {
      expect(position8_2.getElement(i)).closeTo(v, 1e-5);
    });
    [-0.00003904350891126285, -0.08809837698936462, -0.0002653924639162142].forEach((v, i) => {
      expect(position8_3.getElement(i)).closeTo(v, 1e-5);
    });
    [-0.00003911929889000021, -0.08799993991851807, -0.000059597201470751315].forEach((v, i) => {
      expect(position8_4.getElement(i)).closeTo(v, 1e-5);
    });
    [-0.00003927569923689589, -0.08799988031387329, -0.00005930659972364083].forEach((v, i) => {
      expect(position8_5.getElement(i)).closeTo(v, 1e-5);
    });
    [-0.000039069403994673735, -0.08799993246793747, 0.0005114078885526396].forEach((v, i) => {
      expect(position8_6.getElement(i)).closeTo(v, 1e-5);
    });
    [-0.00003915140403698558, -0.08800002932548523, 0.0005113929873914458].forEach((v, i) => {
      expect(position8_7.getElement(i)).closeTo(v, 1e-5);
    });
    const rotationCurves = animClip.rotationCurves;
    expect(rotationCurves.length).to.eql(19);
    const rotationCurve2 = rotationCurves[2];
    expect(rotationCurve2.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3');
    const rotationKeyFrames2 = rotationCurve2.keyFrames;
    const rotation2_0 = rotationKeyFrames2.getValue(0);
    const rotation2_1 = rotationKeyFrames2.getValue(0.3);
    const rotation2_2 = rotationKeyFrames2.getValue(0.7);
    const rotation2_3 = rotationKeyFrames2.getValue(0.9);
    const rotation2_4 = rotationKeyFrames2.getValue(1.3);
    const rotation2_5 = rotationKeyFrames2.getValue(1.5);
    const rotation2_6 = rotationKeyFrames2.getValue(1.7);
    const rotation2_7 = rotationKeyFrames2.getValue(2.0);
    [-0.004063833504915237, 0.6227141618728638, -0.004470687359571457, -0.7824262380599976].forEach((v, i) => {
      expect(rotation2_0.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.03801713024091751, 0.6282665026935523, -0.00339269166207297, -0.777061420254362].forEach((v, i) => {
      expect(rotation2_1.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.1314817816728645, 0.630556479277004, -0.011340485281774454, -0.7648415533903035].forEach((v, i) => {
      expect(rotation2_2.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.1168547252009107, 0.6266589765632465, -0.04702295730606794, -0.7690464378584257].forEach((v, i) => {
      expect(rotation2_3.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.03328938812202511, 0.623312701160144, -0.03191636684582656, -0.7806117210782524].forEach((v, i) => {
      expect(rotation2_4.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.06163197010755539, 0.6243447661399841, -0.039358772337436676, -0.7777185440063477].forEach((v, i) => {
      expect(rotation2_5.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.02172671915471322, 0.6351626229281891, -0.030278636055995175, -0.7714790252490131].forEach((v, i) => {
      expect(rotation2_6.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.005114343483000994, 0.6225405335426331, -0.004524007439613342, -0.7825579643249512].forEach((v, i) => {
      expect(rotation2_7.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    const rotationCurve13 = rotationCurves[13];
    expect(rotationCurve13.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1/leg_joint_L_1/leg_joint_L_2/leg_joint_L_3');
    const rotationKeyFrames13 = rotationCurve13.keyFrames;
    const rotation13_0 = rotationKeyFrames13.getValue(0);
    const rotation13_1 = rotationKeyFrames13.getValue(0.3);
    const rotation13_2 = rotationKeyFrames13.getValue(0.7);
    const rotation13_3 = rotationKeyFrames13.getValue(0.9);
    const rotation13_4 = rotationKeyFrames13.getValue(1.3);
    const rotation13_5 = rotationKeyFrames13.getValue(1.5);
    const rotation13_6 = rotationKeyFrames13.getValue(1.7);
    const rotation13_7 = rotationKeyFrames13.getValue(2.0);
    [0.008959016762673855, -0.9851901531219482, 0.0153896389529109, -0.17053912580013275].forEach((v, i) => {
      expect(rotation13_0.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.04403283196138942, -0.908319029810519, 0.031412340516569354, -0.4147665429074031].forEach((v, i) => {
      expect(rotation13_1.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.024059126421857722, -0.8614343652900524, 0.016455635742597362, -0.5070318503158316].forEach((v, i) => {
      expect(rotation13_2.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.01890529013440476, -0.8578361331730234, 0.009168970083039001, -0.5134937143417954].forEach((v, i) => {
      expect(rotation13_3.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.03274404459830858, -0.882739316184192, 0.01733195126108042, -0.4684005181686966].forEach((v, i) => {
      expect(rotation13_4.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.030687648802995682, -0.939177930355072, 0.012641440145671368, -0.3418239653110504].forEach((v, i) => {
      expect(rotation13_5.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.019070487086092564, -0.971200043417106, 0.007921307506013366, -0.23736954058940632].forEach((v, i) => {
      expect(rotation13_6.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.01264618057757616, -0.9879721403121948, 0.01400639396160841, -0.15347692370414734].forEach((v, i) => {
      expect(rotation13_7.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    const scaleCurves = animClip.scaleCurves;
    expect(scaleCurves.length).to.eql(19);
    const scaleCurve5 = scaleCurves[5];
    expect(scaleCurve5.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_arm_joint_L__4_');
    const scaleKeyFrames5 = scaleCurve5.keyFrames;
    const scale5_0 = scaleKeyFrames5.getValue(0);
    const scale5_1 = scaleKeyFrames5.getValue(0.3);
    const scale5_2 = scaleKeyFrames5.getValue(0.7);
    const scale5_3 = scaleKeyFrames5.getValue(0.9);
    const scale5_4 = scaleKeyFrames5.getValue(1.3);
    const scale5_5 = scaleKeyFrames5.getValue(1.5);
    const scale5_6 = scaleKeyFrames5.getValue(1.7);
    const scale5_7 = scaleKeyFrames5.getValue(2.0);
    [1.0000004768371582, 1.0000001192092896, 0.9999999403953552].forEach((v, i) => {
      expect(scale5_0.getElement(i)).closeTo(v, 1e-5);
    });
    [1.000000239815579, 1, 1.0005707144737244].forEach((v, i) => {
      expect(scale5_1.getElement(i)).closeTo(v, 1e-5);
    });
    [1.000000239815579, 1, 1.0005710124969482].forEach((v, i) => {
      expect(scale5_2.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000001206062894, 0.9999998807907104, 1.0005708932876587].forEach((v, i) => {
      expect(scale5_3.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000003590248685, 0.9999999403953552, 1.0005708932876587].forEach((v, i) => {
      expect(scale5_4.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000001192092896, 0.9999998211860657, 1].forEach((v, i) => {
      expect(scale5_5.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000002414453775, 0.9999998901039362, 0.9991822242736816].forEach((v, i) => {
      expect(scale5_6.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000002414453775, 0.9999998901039362, 0.9991822242736816].forEach((v, i) => {
      expect(scale5_7.getElement(i)).closeTo(v, 1e-5);
    });
    const scaleCurve17 = scaleCurves[17];
    expect(scaleCurve17.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1/leg_joint_R_1/leg_joint_R_2/leg_joint_R_3');
    const scaleKeyFrames17 = scaleCurve17.keyFrames;
    const scale17_0 = scaleKeyFrames17.getValue(0);
    const scale17_1 = scaleKeyFrames17.getValue(0.3);
    const scale17_2 = scaleKeyFrames17.getValue(0.7);
    const scale17_3 = scaleKeyFrames17.getValue(0.9);
    const scale17_4 = scaleKeyFrames17.getValue(1.3);
    const scale17_5 = scaleKeyFrames17.getValue(1.5);
    const scale17_6 = scaleKeyFrames17.getValue(1.7);
    const scale17_7 = scaleKeyFrames17.getValue(2.0);
    [0.9999997615814209, 0.999999463558197, 1].forEach((v, i) => {
      expect(scale17_0.getElement(i)).closeTo(v, 1e-5);
    });
    [0.9999999259598553, 1.0007401052862406, 0.9993287920951843].forEach((v, i) => {
      expect(scale17_1.getElement(i)).closeTo(v, 1e-5);
    });
    [0.9999995841644864, 0.9999991655349731, 1.0005706548690796].forEach((v, i) => {
      expect(scale17_2.getElement(i)).closeTo(v, 1e-5);
    });
    [0.9999996423721313, 0.999999463558197, 1.000000238418579].forEach((v, i) => {
      expect(scale17_3.getElement(i)).closeTo(v, 1e-5);
    });
    [0.9999996423721313, 0.9999995231628418, 0.9999997019767761].forEach((v, i) => {
      expect(scale17_4.getElement(i)).closeTo(v, 1e-5);
    });
    [0.9999996423721313, 0.9999994039535522, 0.9999997019767761].forEach((v, i) => {
      expect(scale17_5.getElement(i)).closeTo(v, 1e-5);
    });
    [0.99999981687866, 0.99990118294954, 0.99979400634765].forEach((v, i) => {
      expect(scale17_6.getElement(i)).closeTo(v, 1e-5);
    });
    [0.99999940535055, 0.99999916553497, 1.00057071447372].forEach((v, i) => {
      expect(scale17_7.getElement(i)).closeTo(v, 1e-5);
    });
    expect(itemList[22].type).to.eql('mesh');
    const itemMesh = new VFXItem(engine);
    SerializationHelper.deserialize(itemList[22], itemMesh);
    const meshComp = itemMesh.getComponent(ModelMeshComponent);
    const meshData = meshComp.data as spec.ModelMeshComponentData;
    expect(meshData.name).to.eql('Cesium_Man');
    const geometry = meshData.geometry as unknown as GLGeometry;
    expect(geometry.subMeshes.length).to.eql(1);
    expect(geometry.subMeshes[0].indexCount).to.eql(14016);
    expect(geometry.subMeshes[0].offset).to.eql(0);
    expect(geometry.subMeshes[0].vertexCount).to.eql(3273);
    const skin = geometry.skin;
    expect(skin.boneNames).to.eql([
      'Armature/Skeleton_torso_joint_1',
      'Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2',
      'Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3',
      'Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_neck_joint_1',
      'Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_neck_joint_1/Skeleton_neck_joint_2',
      'Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_arm_joint_L__4_',
      'Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_arm_joint_R',
      'Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_arm_joint_L__4_/Skeleton_arm_joint_L__3_',
      'Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_arm_joint_R/Skeleton_arm_joint_R__2_',
      'Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_arm_joint_L__4_/Skeleton_arm_joint_L__3_/Skeleton_arm_joint_L__2_',
      'Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_arm_joint_R/Skeleton_arm_joint_R__2_/Skeleton_arm_joint_R__3_',
      'Armature/Skeleton_torso_joint_1/leg_joint_L_1',
      'Armature/Skeleton_torso_joint_1/leg_joint_R_1',
      'Armature/Skeleton_torso_joint_1/leg_joint_L_1/leg_joint_L_2',
      'Armature/Skeleton_torso_joint_1/leg_joint_R_1/leg_joint_R_2',
      'Armature/Skeleton_torso_joint_1/leg_joint_L_1/leg_joint_L_2/leg_joint_L_3',
      'Armature/Skeleton_torso_joint_1/leg_joint_R_1/leg_joint_R_2/leg_joint_R_3',
      'Armature/Skeleton_torso_joint_1/leg_joint_L_1/leg_joint_L_2/leg_joint_L_3/leg_joint_L_5',
      'Armature/Skeleton_torso_joint_1/leg_joint_R_1/leg_joint_R_2/leg_joint_R_3/leg_joint_R_5',
    ]);
    expect(skin.inverseBindMatrices?.length).eql(304);
    [
      0.9971418380737305, -4.3711398944878965e-8, 0.07555299252271652, 0, 4.358646421565027e-8, 1, 3.3025269186026662e-9, 0, -0.07555299252271652,
      0, 0.9971418380737305, 0, 0.05130045861005783, -0.0049998159520328045, -0.6770592331886292, 1, 0.06041746959090233, -4.3711398944878965e-8,
      0.9981732964515686, 0, 2.64093213964145e-9, 1, 4.3631551704947924e-8, 0, -0.9981732964515686, 0, 0.06041746959090233, 0, 0.8218303918838501,
      -0.004986404906958342, -0.0607638880610466, 1, 0.986260712146759, -4.3711398944878965e-8, 0.16519659757614136, 0, 4.3110834013759813e-8, 1,
      7.22097448502268e-9, 0, -0.16519659757614136, 0, 0.986260712146759, 0, 0.18158070743083954, -0.004987061023712158, -1.058603048324585, 1,
      -0.0384785495698452, -4.3711398944878965e-8, 0.9992595911026001, 0, -1.6819512449472995e-9, 1, 4.367903372326509e-8, 0, -0.9992595911026001,
      0, -0.0384785495698452, 0,
    ].forEach((v, i) => {
      expect(skin.inverseBindMatrices?.[i]).closeTo(v, 1e-5);
    });
    expect(geometry.getAttributeNames()).to.eql([
      'aJoints', 'aNormal', 'aPos', 'aUV', 'aWeights',
    ]);
    expect(geometry.drawStart).to.eql(0);
    expect(geometry.drawCount).to.eql(14016);
    expect(geometry.getIndexData()).not.to.eql(undefined);
    expect(geometry.getAttributeData('aPos')?.length).to.eql(9819);
    expect(geometry.getAttributeData('aNormal')?.length).to.eql(9819);
    expect(geometry.getAttributeData('aUV')?.length).to.eql(6546);
    expect(geometry.getAttributeData('aJoints')?.length).to.eql(13092);
    expect(geometry.getAttributeData('aWeights')?.length).to.eql(13092);
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
    const meshMaterial = meshComp.materials[0] as GLMaterial;
    expect(meshMaterial.getColor('_BaseColorFactor')).to.eql({ r: 1, g: 1, b: 1, a: 1 });
    expect(meshMaterial.getColor('_EmissiveFactor')).to.eql({ r: 0, g: 0, b: 0, a: 1 });
    expect(meshMaterial.getFloat('AlphaClip')).to.eql(0);
    expect(meshMaterial.getFloat('ZTest')).to.eql(1);
    expect(meshMaterial.getFloat('ZWrite')).to.eql(1);
    expect(meshMaterial.getFloat('_AlphaCutoff')).to.eql(0);
    expect(meshMaterial.getFloat('_EmissiveIntensity')).to.eql(1);
    expect(meshMaterial.getFloat('_MetallicFactor')).to.eql(0);
    expect(meshMaterial.getFloat('_NormalScale')).to.eql(1);
    expect(meshMaterial.getFloat('_OcclusionStrength')).to.eql(0);
    expect(meshMaterial.getFloat('_RoughnessFactor')).to.eql(1);
    expect(meshMaterial.getFloat('_SpecularAA')).to.eql(0);

    const scene = await loader.loadScene({
      gltf: {
        resource: 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/WaterBottle.glb',
        compatibleMode: 'tiny3d',
      },
      effects: {
        duration: 5,
        endBehavior: 2,
      },
    }).then(async loadResult => {
      const sceneAABB = loadResult.sceneAABB;
      expect(sceneAABB.max).to.eql([0.054450009018182755, 0.13022033870220184, 0.05445002391934395]);
      expect(sceneAABB.min).to.eql([-0.054450009018182755, -0.13022033870220184, -0.05445002391934395]);
      //
      const jsonScene = loadResult.jsonScene;
      const itemList = jsonScene.items;
      expect(itemList.length).to.eql(2);
      engine.addPackageDatas({ jsonScene } as Scene);
      //
      expect(itemList[1].type).to.eql('mesh');
      const itemMesh = new VFXItem(engine);
      SerializationHelper.deserialize(itemList[1], itemMesh);
      const meshComp = itemMesh.getComponent(ModelMeshComponent);
      const meshData = meshComp.data as spec.ModelMeshComponentData;
      expect(meshData.name).to.eql('WaterBottle');
      const geometry2 = meshData.geometry as unknown as GLGeometry;
      expect(geometry2.subMeshes.length).to.eql(1);
      expect(geometry2.subMeshes[0].indexCount).to.eql(13530);
      expect(geometry2.subMeshes[0].offset).to.eql(0);
      expect(geometry2.subMeshes[0].vertexCount).to.eql(2549);
      expect(geometry2.skin.boneNames).to.eql(undefined);
      expect(geometry2.skin.inverseBindMatrices).to.eql(undefined);
      expect(geometry2.skin.rootBoneName).to.eql(undefined);
      expect(geometry2.getAttributeNames()).to.eql([
        'aUV', 'aNormal', 'aTangent', 'aPos',
      ]);
      expect(geometry2.drawStart).to.eql(0);
      expect(geometry2.drawCount).to.eql(13530);
      expect(geometry2.getIndexData()).not.to.eql(undefined);
      expect(geometry2.getAttributeData('aPos')?.length).to.eql(7647);
      expect(geometry2.getAttributeData('aNormal')?.length).to.eql(7647);
      expect(geometry2.getAttributeData('aUV')?.length).to.eql(5098);
      expect(geometry2.getAttributeData('aTangent')?.length).to.eql(10196);
      expect(geometry2.attributes).not.to.eql(undefined);
      if (geometry2.attributes !== undefined) {
        expect(geometry2.attributes['aNormal']).to.eql({
          dataSource: 'aNormal',
          normalize: false,
          offset: undefined,
          size: 3,
          stride: undefined,
          type: 5126,
        });
        expect(geometry2.attributes['aPos']).to.eql({
          dataSource: 'aPos',
          normalize: false,
          offset: undefined,
          size: 3,
          stride: undefined,
          type: 5126,
        });
        expect(geometry2.attributes['aTangent']).to.eql({
          dataSource: 'aTangent',
          normalize: false,
          offset: undefined,
          size: 4,
          stride: undefined,
          type: 5126,
        });
        expect(geometry2.attributes['aUV']).to.eql({
          dataSource: 'aUV',
          normalize: false,
          offset: undefined,
          size: 2,
          stride: undefined,
          type: 5126,
        });
      }
      const meshMaterial2 = meshComp.materials[0] as GLMaterial;
      expect(meshMaterial2.getColor('_BaseColorFactor')).to.eql({ r: 1, g: 1, b: 1, a: 1 });
      expect(meshMaterial2.getColor('_EmissiveFactor')).to.eql({ r: 1, g: 1, b: 1, a: 1 });
      expect(meshMaterial2.getFloat('AlphaClip')).to.eql(0);
      expect(meshMaterial2.getFloat('ZTest')).to.eql(1);
      expect(meshMaterial2.getFloat('ZWrite')).to.eql(1);
      expect(meshMaterial2.getFloat('_AlphaCutoff')).to.eql(0);
      expect(meshMaterial2.getFloat('_EmissiveIntensity')).to.eql(1);
      expect(meshMaterial2.getFloat('_MetallicFactor')).to.eql(1);
      expect(meshMaterial2.getFloat('_NormalScale')).to.eql(1);
      expect(meshMaterial2.getFloat('_OcclusionStrength')).to.eql(0);
      expect(meshMaterial2.getFloat('_RoughnessFactor')).to.eql(1);
      expect(meshMaterial2.getFloat('_SpecularAA')).to.eql(0);
      expect(meshMaterial2.stringTags.RenderFace).to.eql('Front');
      expect(meshMaterial2.stringTags.RenderType).to.eql('Opaque');
    });

    engine.dispose();
  });

  it('端上测试', async () => {
    const converter = new JSONConverter(player.renderer);
    const scn = await converter.processScene('https://gw.alipayobjects.com/os/gltf-asset/89748482160728/CesiumMan.json');
    const comp = await generateComposition(player, scn, {}, { pauseOnFirstFrame: true });
    //
    const items = comp.items;
    expect(items.length).to.eql(25);
    const treeItem = items[0];
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

    const animComp = treeItem.getComponent(AnimationComponent);
    expect(animComp.animation).to.eql(0);
    expect(animComp.clips.length).to.eql(1);
    const animClip = animComp.clips[0];
    expect(animClip.duration).to.eql(2);
    const positionCurves = animClip.positionCurves;
    expect(positionCurves.length).to.eql(19);
    const positionCurve0 = positionCurves[0];
    expect(positionCurve0.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1');
    const positionKeyFrames0 = positionCurve0.keyFrames;
    const position0_0 = positionKeyFrames0.getValue(0);
    const position0_1 = positionKeyFrames0.getValue(0.1);
    const position0_2 = positionKeyFrames0.getValue(0.4);
    const position0_3 = positionKeyFrames0.getValue(0.6);
    const position0_4 = positionKeyFrames0.getValue(0.77);
    const position0_5 = positionKeyFrames0.getValue(0.95);
    const position0_6 = positionKeyFrames0.getValue(1.1);
    const position0_7 = positionKeyFrames0.getValue(1.3);
    const position0_8 = positionKeyFrames0.getValue(1.6);
    const position0_9 = positionKeyFrames0.getValue(2.0);
    [1.971350016560791e-8, -0.02000010944902897, 0.6439971327781677].forEach((v, i) => {
      expect(position0_0.getElement(i)).closeTo(v, 1e-5);
    });
    [1.8826821358863894e-8, -0.02000010944902897, 0.6596914120149772].forEach((v, i) => {
      expect(position0_1.getElement(i)).closeTo(v, 1e-5);
    });
    [2.593139020685366e-8, -0.02115998654375748, 0.6877646344022668].forEach((v, i) => {
      expect(position0_2.getElement(i)).closeTo(v, 1e-5);
    });
    [3.2645111067026397e-8, -0.02404765391459396, 0.6637162098175395].forEach((v, i) => {
      expect(position0_3.getElement(i)).closeTo(v, 1e-5);
    });
    [3.8805598734370506e-8, -0.025000110268592834, 0.6472381949424744].forEach((v, i) => {
      expect(position0_4.getElement(i)).closeTo(v, 1e-5);
    });
    [2.9026798742393112e-8, -0.025000110268592834, 0.6426699757575989].forEach((v, i) => {
      expect(position0_5.getElement(i)).closeTo(v, 1e-5);
    });
    [1.3378702112436248e-8, -0.026999627441598617, 0.6623133848129577].forEach((v, i) => {
      expect(position0_6.getElement(i)).closeTo(v, 1e-5);
    });
    [8.085935612465292e-9, -0.030000123813372696, 0.6976126806942994].forEach((v, i) => {
      expect(position0_7.getElement(i)).closeTo(v, 1e-5);
    });
    [1.604971754771877e-8, -0.03000011554584352, 0.693102899676677].forEach((v, i) => {
      expect(position0_8.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0633099734036477e-8, -0.02000010944902897, 0.6399999856948853].forEach((v, i) => {
      expect(position0_9.getElement(i)).closeTo(v, 1e-5);
    });
    const positionCurve11 = positionCurves[11];
    expect(positionCurve11.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1/leg_joint_L_1');
    const positionKeyFrames11 = positionCurve11.keyFrames;
    const position11_0 = positionKeyFrames11.getValue(0);
    const position11_1 = positionKeyFrames11.getValue(0.1);
    const position11_2 = positionKeyFrames11.getValue(0.4);
    const position11_3 = positionKeyFrames11.getValue(0.6);
    const position11_4 = positionKeyFrames11.getValue(0.77);
    const position11_5 = positionKeyFrames11.getValue(0.95);
    const position11_6 = positionKeyFrames11.getValue(1.1);
    const position11_7 = positionKeyFrames11.getValue(1.3);
    const position11_8 = positionKeyFrames11.getValue(1.6);
    const position11_9 = positionKeyFrames11.getValue(2.0);
    [0.02852007932960987, 0.06762178242206573, -0.06295990943908691].forEach((v, i) => {
      expect(position11_0.getElement(i)).closeTo(v, 1e-5);
    });
    [0.028520189225673676, 0.06762184202671051, -0.06295999884605408].forEach((v, i) => {
      expect(position11_1.getElement(i)).closeTo(v, 1e-5);
    });
    [0.028520170599222183, 0.06762176752090454, -0.06296006590127945].forEach((v, i) => {
      expect(position11_2.getElement(i)).closeTo(v, 1e-5);
    });
    [0.02852002903819084, 0.06762178987264633, -0.06295991688966751].forEach((v, i) => {
      expect(position11_3.getElement(i)).closeTo(v, 1e-5);
    });
    [0.02852008235640824, 0.06762179173529148, -0.06377783417701721].forEach((v, i) => {
      expect(position11_4.getElement(i)).closeTo(v, 1e-5);
    });
    [0.02852010913193226, 0.06762179732322693, -0.06295999884605408].forEach((v, i) => {
      expect(position11_5.getElement(i)).closeTo(v, 1e-5);
    });
    [0.028520112158730626, 0.06762179173529148, -0.0637778639793396].forEach((v, i) => {
      expect(position11_6.getElement(i)).closeTo(v, 1e-5);
    });
    [0.02852008072660972, 0.06762175261974335, -0.06238916516304016].forEach((v, i) => {
      expect(position11_7.getElement(i)).closeTo(v, 1e-5);
    });
    [0.028520138934254646, 0.06762178242206573, -0.06296002864837646].forEach((v, i) => {
      expect(position11_8.getElement(i)).closeTo(v, 1e-5);
    });
    [0.028520093532279134, 0.06762176938354969, -0.06377790123224258].forEach((v, i) => {
      expect(position11_9.getElement(i)).closeTo(v, 1e-5);
    });
    const rotationCurves = animClip.rotationCurves;
    expect(rotationCurves.length).to.eql(19);
    const rotationCurve3 = rotationCurves[3];
    expect(rotationCurve3.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_neck_joint_1');
    const rotationKeyFrames3 = rotationCurve3.keyFrames;
    const rotation3_0 = rotationKeyFrames3.getValue(0);
    const rotation3_1 = rotationKeyFrames3.getValue(0.3);
    const rotation3_2 = rotationKeyFrames3.getValue(0.7);
    const rotation3_3 = rotationKeyFrames3.getValue(0.9);
    const rotation3_4 = rotationKeyFrames3.getValue(1.3);
    const rotation3_5 = rotationKeyFrames3.getValue(1.5);
    const rotation3_6 = rotationKeyFrames3.getValue(1.7);
    const rotation3_7 = rotationKeyFrames3.getValue(2.0);
    [-0.02380962483584881, -0.6327536106109619, -0.028988203033804893, -0.7734439969062805].forEach((v, i) => {
      expect(rotation3_0.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.006549380120295049, -0.6395235234776406, 0.007056078803819767, -0.7687112183433105].forEach((v, i) => {
      expect(rotation3_1.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.015102213395037322, -0.6499881607663583, 0.019011963429710795, -0.7595563835478958].forEach((v, i) => {
      expect(rotation3_2.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.00259504977769829, -0.6544915562426721, -0.0020505953397712256, -0.7560620115228097].forEach((v, i) => {
      expect(rotation3_3.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.03544669596873952, -0.6592561486512343, 0.040588971307278066, -0.7499848779727148].forEach((v, i) => {
      expect(rotation3_4.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.010775327682495117, -0.6567466259002686, 0.011504087597131729, -0.7539464831352234].forEach((v, i) => {
      expect(rotation3_5.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.01020961096711386, -0.644946626886109, -0.012678860196007781, -0.7640541847813767].forEach((v, i) => {
      expect(rotation3_6.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.02474863827228546, -0.6325404644012451, -0.03008362464606762, -0.7735469341278076].forEach((v, i) => {
      expect(rotation3_7.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    const rotationCurve15 = rotationCurves[15];
    expect(rotationCurve15.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1/leg_joint_R_1');
    const rotationKeyFrames15 = rotationCurve15.keyFrames;
    const rotation15_0 = rotationKeyFrames15.getValue(0);
    const rotation15_1 = rotationKeyFrames15.getValue(0.3);
    const rotation15_2 = rotationKeyFrames15.getValue(0.7);
    const rotation15_3 = rotationKeyFrames15.getValue(0.9);
    const rotation15_4 = rotationKeyFrames15.getValue(1.3);
    const rotation15_5 = rotationKeyFrames15.getValue(1.5);
    const rotation15_6 = rotationKeyFrames15.getValue(1.7);
    const rotation15_7 = rotationKeyFrames15.getValue(2.0);
    [0.007149823941290379, -0.5394002199172974, -0.004548392724245787, -0.8420069813728333].forEach((v, i) => {
      expect(rotation15_0.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.0076125909650648855, -0.8618624597206415, 0.008997612385426805, -0.5070051393418271].forEach((v, i) => {
      expect(rotation15_1.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.0038299378721414544, -0.9322358756058557, 0.016326187432012695, -0.3614624184747043].forEach((v, i) => {
      expect(rotation15_2.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [-0.009565437239987883, -0.9456528352599822, 0.020589973768677626, -0.3243845595901951].forEach((v, i) => {
      expect(rotation15_3.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.02290591993519608, -0.5257729676485207, 0.001480401975115246, -0.8503152365842087].forEach((v, i) => {
      expect(rotation15_4.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.04037770628929138, -0.2803998589515686, 0.002606708789244294, -0.9590301513671875].forEach((v, i) => {
      expect(rotation15_5.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.030033650750716928, -0.5098839563621551, -0.0016212830614767957, -0.8597173247271871].forEach((v, i) => {
      expect(rotation15_6.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    [0.006564768496900797, -0.5171111822128296, -0.0036021345295011997, -0.8558855652809143].forEach((v, i) => {
      expect(rotation15_7.toVector4(new Vector4()).getElement(i)).closeTo(v, 1e-5);
    });
    const scaleCurves = animClip.scaleCurves;
    expect(scaleCurves.length).to.eql(19);
    const scaleCurve5 = scaleCurves[5];
    expect(scaleCurve5.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1/Skeleton_torso_joint_2/torso_joint_3/Skeleton_arm_joint_L__4_');
    const scaleKeyFrames5 = scaleCurve5.keyFrames;
    const scale5_0 = scaleKeyFrames5.getValue(0);
    const scale5_1 = scaleKeyFrames5.getValue(0.3);
    const scale5_2 = scaleKeyFrames5.getValue(0.7);
    const scale5_3 = scaleKeyFrames5.getValue(0.9);
    const scale5_4 = scaleKeyFrames5.getValue(1.3);
    const scale5_5 = scaleKeyFrames5.getValue(1.5);
    const scale5_6 = scaleKeyFrames5.getValue(1.7);
    const scale5_7 = scaleKeyFrames5.getValue(2.0);
    [1.0000004768371582, 1.0000001192092896, 0.9999999403953552].forEach((v, i) => {
      expect(scale5_0.getElement(i)).closeTo(v, 1e-5);
    });
    [1.000000239815579, 1, 1.0005707144737244].forEach((v, i) => {
      expect(scale5_1.getElement(i)).closeTo(v, 1e-5);
    });
    [1.000000239815579, 1, 1.0005710124969482].forEach((v, i) => {
      expect(scale5_2.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000001206062894, 0.9999998807907104, 1.0005708932876587].forEach((v, i) => {
      expect(scale5_3.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000003590248685, 0.9999999403953552, 1.0005708932876587].forEach((v, i) => {
      expect(scale5_4.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000001192092896, 0.9999998211860657, 1].forEach((v, i) => {
      expect(scale5_5.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000002414453775, 0.9999998901039362, 0.9991822242736816].forEach((v, i) => {
      expect(scale5_6.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000002414453775, 0.9999998901039362, 0.9991822242736816].forEach((v, i) => {
      expect(scale5_7.getElement(i)).closeTo(v, 1e-5);
    });
    const scaleCurve14 = scaleCurves[14];
    expect(scaleCurve14.path).to.eql('Z_UP/Armature/Skeleton_torso_joint_1/leg_joint_L_1/leg_joint_L_2/leg_joint_L_3/leg_joint_L_5');
    const scaleKeyFrames14 = scaleCurve14.keyFrames;
    const scale14_0 = scaleKeyFrames14.getValue(0);
    const scale14_1 = scaleKeyFrames14.getValue(0.3);
    const scale14_2 = scaleKeyFrames14.getValue(0.7);
    const scale14_3 = scaleKeyFrames14.getValue(0.9);
    const scale14_4 = scaleKeyFrames14.getValue(1.3);
    const scale14_5 = scaleKeyFrames14.getValue(1.5);
    const scale14_6 = scaleKeyFrames14.getValue(1.7);
    const scale14_7 = scaleKeyFrames14.getValue(2.0);
    [1.0000003576278687, 0.9999997019767761, 0.9999998211860657].forEach((v, i) => {
      expect(scale14_0.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000003576278687, 1.0000001192092896, 0.9999999403953552].forEach((v, i) => {
      expect(scale14_1.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000002414453775, 0.9999998901039362, 0.9991821050643921].forEach((v, i) => {
      expect(scale14_2.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000004768371582, 1, 1.0000001192092896].forEach((v, i) => {
      expect(scale14_3.getElement(i)).closeTo(v, 1e-5);
    });
    [1.000000238418579, 1.0000001192092896, 0.9999997615814209].forEach((v, i) => {
      expect(scale14_4.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000008344650269, 1, 0.9999996423721313].forEach((v, i) => {
      expect(scale14_5.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000007152557373, 0.9999999403953552, 0.9999996423721313].forEach((v, i) => {
      expect(scale14_6.getElement(i)).closeTo(v, 1e-5);
    });
    [1.0000003590248685, 0.9999998807907104, 1.0005704760551453].forEach((v, i) => {
      expect(scale14_7.getElement(i)).closeTo(v, 1e-5);
    });
    //
    const modelItem = items[1];
    const worldMatrix = modelItem.transform.getWorldMatrix();
    [
      3.422854177870249e-8, -3.4228538225988814e-8, 0.9999998807907104, 0,
      0.9999999403953552, 1.1715931027525724e-15, -3.4228538225988814e-8, 0,
      0, 0.9999999403953552, 3.422854177870249e-8, 0,
      0, 0, 0, 1,
    ].forEach((val, idx) => {
      expect(val).closeTo(worldMatrix.elements[idx], 1e-5);
    });
    const modelComp = modelItem.getComponent(ModelMeshComponent);
    expect(modelComp.priority).to.eql(1);
    const meshObj = modelComp.content;
    const skin = meshObj.skin!;
    expect(skin.inverseBindMatrices.length).to.eql(19);
    [
      0.9971418380737305, -4.3711398944878965e-8, 0.07555299252271652, 0, 4.358646421565027e-8, 1, 3.3025269186026662e-9, 0, -0.07555299252271652,
      0, 0.9971418380737305, 0, 0.05130045861005783, -0.0049998159520328045, -0.6770592331886292, 1,
    ].forEach((v, i) => {
      expect(skin.inverseBindMatrices[0].elements[i]).closeTo(v, 1e-5);
    });
    [
      0.06041746959090233, -4.3711398944878965e-8, 0.9981732964515686, 0, 2.64093213964145e-9, 1, 4.3631551704947924e-8, 0, -0.9981732964515686,
      0, 0.06041746959090233, 0, 0.8218303918838501, -0.004986404906958342, -0.0607638880610466, 1,
    ].forEach((v, i) => {
      expect(skin.inverseBindMatrices[1].elements[i]).closeTo(v, 1e-5);
    });
    [
      -0.9999089241027832, -4.3711398944878965e-8, 0.013504560105502605, 0, -4.370741635284503e-8, 1, 5.903031952136928e-10, 0, -0.013504560105502605,
      0, -0.9999089241027832, 0, 0.010247940197587013, -0.09600067138671875, 1.0739599466323853, 1,
    ].forEach((v, i) => {
      expect(skin.inverseBindMatrices[5].elements[i]).closeTo(v, 1e-5);
    });
    [
      -0.9848927855491638, -4.3711398944878965e-8, -0.17316530644893646, 0, -4.30510418425456e-8, 1, -7.569298077214626e-9, 0, 0.17316530644893646,
      0, -0.9848927855491638, 0, -0.08602433651685715, -0.45450031757354736, 0.8732962012290955, 1,
    ].forEach((v, i) => {
      expect(skin.inverseBindMatrices[9].elements[i]).closeTo(v, 1e-5);
    });
    [
      -0.2782297134399414, -4.3711398944878965e-8, 0.9605147242546082, 0, -1.216181022556384e-8, 1, 4.198544090172618e-8, 0, -0.9605147242546082,
      0, -0.2782297134399414, 0, 0.3569404184818268, -0.08209478110074997, 0.032392680644989014, 1,
    ].forEach((v, i) => {
      expect(skin.inverseBindMatrices[13].elements[i]).closeTo(v, 1e-5);
    });
    [
      -0.9981577396392822, -4.3711398944878965e-8, -0.060672931373119354, 0, -4.3630869583921594e-8, 1, -2.6520987628231296e-9, 0,
      0.060672931373119354, 0, -0.9981577396392822, 0, 0.025538679212331772, -0.08458267897367477, 0.022827859967947006, 1,
    ].forEach((v, i) => {
      expect(skin.inverseBindMatrices[17].elements[i]).closeTo(v, 1e-5);
    });
    //
    expect(meshObj.subMeshes.length).to.eql(1);
    const geometry = meshObj.subMeshes[0].getEffectsGeometry() as GLGeometry;
    expect(geometry.getAttributeNames().length).to.eql(5);
    geometry.getAttributeNames().forEach((val, idx) => {
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
      expect(positionBuffer?.[i]).closeTo(v, 1e-5);
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
      expect(normalBuffer?.[i]).closeTo(v, 1e-5);
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
      expect(uvBuffer?.[i]).closeTo(v, 1e-5);
    });
    [
      0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 7, 9, 0, 0, 7, 9, 0, 0, 9, 0, 0, 0, 9, 0, 0, 0, 7, 9, 0, 0, 7, 9, 0, 0, 9,
      0, 0, 0, 9, 0, 0, 0, 8, 10, 0, 0, 8, 10, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 8, 10, 0, 0, 8, 10, 0, 0, 10, 0, 0, 0, 10, 0, 0,
      0, 10, 0, 0, 0, 10, 0, 0, 0, 13, 15, 17, 0, 13, 15, 17, 0, 13, 15, 17, 0,
    ].forEach((v, i) => {
      expect(jointBuffer?.[i]).closeTo(v, 1e-5);
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
      expect(weightBuffer?.[i]).closeTo(v, 1e-5);
    });
    const meshMaterial = modelComp.materials[0] as GLMaterial;
    expect(meshMaterial.getColor('_BaseColorFactor')).to.eql({ r: 1, g: 1, b: 1, a: 1 });
    expect(meshMaterial.getColor('_EmissiveFactor')).to.eql({ r: 0, g: 0, b: 0, a: 1 });
    expect(meshMaterial.getFloat('AlphaClip')).to.eql(0);
    expect(meshMaterial.getFloat('ZTest')).to.eql(1);
    expect(meshMaterial.getFloat('ZWrite')).to.eql(1);
    expect(meshMaterial.getFloat('_AlphaCutoff')).to.eql(0.5);
    expect(meshMaterial.getFloat('_EmissiveIntensity')).to.eql(1);
    expect(meshMaterial.getFloat('_MetallicFactor')).to.eql(0);
    expect(meshMaterial.getFloat('_RoughnessFactor')).to.eql(1);
    expect(meshMaterial.getFloat('_SpecularAA')).to.eql(0);
    comp.dispose();
  });

  it('Box 求交测试', () => {
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

  it('Triangle 求交测试', () => {
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

