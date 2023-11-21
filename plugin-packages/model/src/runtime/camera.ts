import { spec } from '@galacean/effects';
import type { ModelVFXItem } from '../plugin/model-vfx-item';
import type { ModelItemCamera } from '../index';
import type { Quaternion, Box3 } from '../math';
import { Vector2, Vector3, Matrix4 } from '../math';
import { PObjectType } from './common';
import { PEntity } from './object';

const deg2rad = Math.PI / 180;

export class PCamera extends PEntity {
  width = 512;
  height = 512;
  nearPlane = 0.001;
  farPlane = 1000;
  fovy = 45;
  aspect = 1.0;
  clipMode = spec.CameraClipMode.landscape;
  projectionMatrix = new Matrix4();
  viewMatrix = new Matrix4();

  constructor (camera: ModelItemCamera, width: number, height: number, ownerItem?: ModelVFXItem) {
    super();
    this.name = camera.name;
    this.type = PObjectType.camera;
    this.visible = false;
    this.ownerItem = ownerItem;
    //
    this.width = width;
    this.height = height;
    const options = camera.content.options;

    this.nearPlane = options.near;
    this.farPlane = options.far;
    this.fovy = options.fov;
    this.aspect = options.aspect ?? (this.width / this.height);
    this.clipMode = options.clipMode;
    this.update();
  }

  update () {
    if (this.ownerItem !== undefined) {
      this.transform.fromEffectsTransform(this.ownerItem.transform);
    }

    this.projectionMatrix.perspective(this.fovy * deg2rad, this.aspect, this.nearPlane, this.farPlane, this.isReversed());
    this.viewMatrix = this.matrix.inverse();
  }

  getNewProjectionMatrix (fov: number): Matrix4 {
    return new Matrix4().perspective(Math.min(fov * 1.25, 140) * deg2rad, this.aspect, this.nearPlane, this.farPlane, this.isReversed());
  }

  computeViewAABB (box: Box3): Box3 {
    const tanTheta = Math.tan(this.fovy * deg2rad * 0.5);
    const aspect = this.aspect;
    let yFarCoord = 0;
    let yNearCoord = 0;
    let xFarCoord = 0;
    let xNearCoord = 0;

    if (this.isReversed()) {
      xFarCoord = this.farPlane * tanTheta;
      xNearCoord = this.nearPlane * tanTheta;
      yFarCoord = xFarCoord / aspect;
      yNearCoord = xNearCoord / aspect;
    } else {
      yFarCoord = this.farPlane * tanTheta;
      yNearCoord = this.nearPlane * tanTheta;
      xFarCoord = aspect * yFarCoord;
      xNearCoord = aspect * yNearCoord;
    }

    box.makeEmpty();
    const matrix = this.matrix;

    box.expandByPoint(matrix.multiplyByPoint3(new Vector3(xFarCoord, yFarCoord, -this.farPlane)));
    box.expandByPoint(matrix.multiplyByPoint3(new Vector3(xFarCoord, -yFarCoord, -this.farPlane)));
    box.expandByPoint(matrix.multiplyByPoint3(new Vector3(-xFarCoord, yFarCoord, -this.farPlane)));
    box.expandByPoint(matrix.multiplyByPoint3(new Vector3(-xFarCoord, -yFarCoord, -this.farPlane)));
    //
    box.expandByPoint(matrix.multiplyByPoint3(new Vector3(xNearCoord, yNearCoord, -this.nearPlane)));
    box.expandByPoint(matrix.multiplyByPoint3(new Vector3(xNearCoord, -yNearCoord, -this.nearPlane)));
    box.expandByPoint(matrix.multiplyByPoint3(new Vector3(-xNearCoord, yNearCoord, -this.nearPlane)));
    box.expandByPoint(matrix.multiplyByPoint3(new Vector3(-xNearCoord, -yNearCoord, -this.nearPlane)));

    return box;
  }

  getSize (): Vector2 {
    return new Vector2(this.width, this.height);
  }

  isReversed (): boolean {
    return this.clipMode === spec.CameraClipMode.portrait;
  }

  getEye (): Vector3 {
    return this.translation;
  }

  setEye (val: Vector3) {
    this.translation = val;
  }
}

export class PCameraManager {
  private winWidth = 512;
  private winHeight = 512;
  private cameraList: PCamera[] = [];
  private defaultCamera;

  constructor () {
    this.defaultCamera = new PCamera(
      {
        id: 'camera',
        name: 'camera',
        type: 'camera',
        duration: 10,
        pluginName: 'model',
        content: {
          options: {
            fov: 60,
            far: 1000,
            near: 0.001,
            position: [0, 0, -1.5],
            clipMode: spec.CameraClipMode.portrait,
          },
        },
        endBehavior: spec.END_BEHAVIOR_FORWARD,
      },
      512, 512
    );
  }

  initial (width: number, height: number) {
    this.winWidth = width;
    this.winHeight = height;

    const camera = this.defaultCamera;

    camera.width = width;
    camera.height = height;
    camera.aspect = width / height;
    camera.update();
  }

  insert (inCamera: ModelItemCamera, ownerItem?: ModelVFXItem): PCamera {
    const camera = new PCamera(inCamera, this.winWidth, this.winHeight, ownerItem);

    this.cameraList.push(camera);

    return camera;
  }

  insertCamera (camera: PCamera) {
    this.cameraList.push(camera);
  }

  remove (camera: PCamera | number) {
    if (camera instanceof PCamera) {
      const findResult = this.cameraList.findIndex(item => {
        return item === camera;
      });

      if (findResult !== -1) {
        this.cameraList.splice(findResult, 1);
      }
    } else {
      if (camera >= 0 && camera < this.cameraList.length) {
        this.cameraList.splice(camera, 1);
      }
    }
  }

  dispose () {
    this.cameraList = [];
  }

  updateDefaultCamera (
    fovy: number,
    nearPlane: number,
    farPlane: number,
    position: spec.vec3,
    rotation: Quaternion,
    clipMode: number,
  ) {
    this.defaultCamera.fovy = fovy;
    this.defaultCamera.nearPlane = nearPlane;
    this.defaultCamera.farPlane = farPlane;
    this.defaultCamera.position = position;
    this.defaultCamera.rotation = rotation;
    this.defaultCamera.clipMode = clipMode;
    this.defaultCamera.update();
  }

  getCameraList (): PCamera[] {
    return this.cameraList;
  }

  getDefaultCamera (): PCamera {
    return this.defaultCamera;
  }

  getCameraCount (): number {
    return this.cameraList.length;
  }

  getActiveCamera (): PCamera {
    return this.defaultCamera;
  }

  getAspect (): number {
    return this.winWidth / this.winHeight;
  }
}

