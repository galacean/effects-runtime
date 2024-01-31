import type { math } from '@galacean/effects';
import { spec } from '@galacean/effects';
import type { ModelCameraOptions } from '../index';
import { Vector2, Vector3, Matrix4 } from './math';
import { PObjectType } from './common';
import { PEntity } from './object';
import type { ModelCameraComponent } from '../plugin/model-item';

type Box3 = math.Box3;
type Quaternion = math.Quaternion;

const deg2rad = Math.PI / 180;

export class PCamera extends PEntity {
  owner?: ModelCameraComponent;
  width = 512;
  height = 512;
  nearPlane = 0.001;
  farPlane = 1000;
  fovy = 45;
  aspect = 1.0;
  clipMode = spec.CameraClipMode.landscape;
  projectionMatrix: Matrix4 = new Matrix4();
  viewMatrix: Matrix4 = new Matrix4();

  constructor (name: string, width: number, height: number, options: ModelCameraOptions, owner?: ModelCameraComponent) {
    super();
    this.type = PObjectType.camera;
    this.visible = false;
    this.owner = owner;
    //
    this.name = name;
    this.width = width;
    this.height = height;

    this.nearPlane = options.near;
    this.farPlane = options.far;
    this.fovy = options.fov;
    this.aspect = options.aspect ?? (this.width / this.height);
    this.clipMode = options.clipMode;
    this.update();
  }

  override update () {
    if (this.owner !== undefined) {
      this.transform.fromEffectsTransform(this.owner.transform);
    }

    const reverse = this.clipMode === spec.CameraClipMode.portrait;

    this.projectionMatrix.perspective(this.fovy * deg2rad, this.aspect, this.nearPlane, this.farPlane, reverse);
    this.viewMatrix = this.matrix.invert();
  }

  getNewProjectionMatrix (fov: number): Matrix4 {
    const reverse = this.clipMode === spec.CameraClipMode.portrait;

    return new Matrix4().perspective(Math.min(fov * 1.25, 140) * deg2rad, this.aspect, this.nearPlane, this.farPlane, reverse);
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

    box.expandByPoint(matrix.transformPoint(new Vector3(xFarCoord, yFarCoord, -this.farPlane)));
    box.expandByPoint(matrix.transformPoint(new Vector3(xFarCoord, -yFarCoord, -this.farPlane)));
    box.expandByPoint(matrix.transformPoint(new Vector3(-xFarCoord, yFarCoord, -this.farPlane)));
    box.expandByPoint(matrix.transformPoint(new Vector3(-xFarCoord, -yFarCoord, -this.farPlane)));
    //
    box.expandByPoint(matrix.transformPoint(new Vector3(xNearCoord, yNearCoord, -this.nearPlane)));
    box.expandByPoint(matrix.transformPoint(new Vector3(xNearCoord, -yNearCoord, -this.nearPlane)));
    box.expandByPoint(matrix.transformPoint(new Vector3(-xNearCoord, yNearCoord, -this.nearPlane)));
    box.expandByPoint(matrix.transformPoint(new Vector3(-xNearCoord, -yNearCoord, -this.nearPlane)));

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
      'camera', 512, 512,
      {
        fov: 60,
        far: 1000,
        near: 0.001,
        position: [0, 0, -1.5],
        clipMode: spec.CameraClipMode.portrait,
      },
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

  insert (name: string, options: ModelCameraOptions, owner?: ModelCameraComponent): PCamera {
    const camera = new PCamera(name, this.winWidth, this.winHeight, options, owner);

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
    aspect: number,
    nearPlane: number,
    farPlane: number,
    position: Vector3,
    rotation: Quaternion,
    clipMode: number,
  ) {
    this.defaultCamera.fovy = fovy;
    this.defaultCamera.aspect = aspect;
    this.defaultCamera.nearPlane = nearPlane;
    this.defaultCamera.farPlane = farPlane;
    this.defaultCamera.position = position;
    this.defaultCamera.rotation = rotation;
    this.defaultCamera.aspect = aspect;
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

