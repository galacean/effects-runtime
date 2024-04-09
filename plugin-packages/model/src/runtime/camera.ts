import type { math } from '@galacean/effects';
import { spec } from '@galacean/effects';
import type { ModelCameraComponentData } from '../index';
import { Vector2, Vector3, Matrix4 } from './math';
import { PObjectType } from './common';
import { PEntity } from './object';
import type { ModelCameraComponent } from '../plugin/model-item';

type Box3 = math.Box3;
type Quaternion = math.Quaternion;

const deg2rad = Math.PI / 180;

/**
 * 相机类，支持基础的相机功能
 */
export class PCamera extends PEntity {
  /**
   * 所属的相机组件
   */
  owner?: ModelCameraComponent;
  /**
   * 画布宽度
   */
  width = 512;
  /**
   * 画布高度
   */
  height = 512;
  /**
   * 近裁剪平面
   */
  nearPlane = 0.001;
  /**
   * 远裁剪平面
   */
  farPlane = 1000;
  /**
   * Y 轴上视角
   */
  fov = 45;
  /**
   * 纵横比
   */
  aspect = 1.0;
  /**
   * 剪裁模式，默认是剪裁左右
   */
  clipMode = spec.CameraClipMode.landscape;
  /**
   * 投影矩阵
   */
  projectionMatrix: Matrix4 = new Matrix4();
  /**
   * 相机矩阵
   */
  viewMatrix: Matrix4 = new Matrix4();

  /**
   * 构造函数，创建相机对象
   * @param camera - 相机数据
   * @param width - 画布宽度
   * @param height - 画布高度
   * @param owner - 所属的相机组件
   */
  constructor (name: string, width: number, height: number, data: ModelCameraComponentData, owner?: ModelCameraComponent) {
    super();
    this.type = PObjectType.camera;
    this.visible = false;
    this.owner = owner;
    //
    this.name = name;
    this.width = width;
    this.height = height;

    this.nearPlane = data.near ?? 0.001;
    this.farPlane = data.far ?? 1000;
    this.fov = data.fov ?? 45;
    this.aspect = data.aspect ?? (this.width / this.height);
    this.clipMode = data.clipMode ?? spec.CameraClipMode.landscape;
    this.update();
  }

  /**
   * 更新相机矩阵和投影矩阵，从所属的元素中获取变换数据
   */
  override update () {
    if (this.owner !== undefined) {
      this.transform.fromEffectsTransform(this.owner.transform);
    }

    const reverse = this.clipMode === spec.CameraClipMode.portrait;

    this.projectionMatrix.perspective(this.fov * deg2rad, this.aspect, this.nearPlane, this.farPlane, reverse);
    this.viewMatrix = this.matrix.invert();
  }

  /**
   * 获取新的透视矩阵，视角大小乘 1.25 倍
   * @param fov - 视角大小
   * @returns 投影矩阵
   */
  getNewProjectionMatrix (fov: number): Matrix4 {
    const reverse = this.clipMode === spec.CameraClipMode.portrait;

    return new Matrix4().perspective(Math.min(fov * 1.25, 140) * deg2rad, this.aspect, this.nearPlane, this.farPlane, reverse);
  }

  /**
   * 计算视角中的包围盒大小
   * @param box - 包围盒
   * @returns 视角中的包围盒
   */
  computeViewAABB (box: Box3): Box3 {
    const tanTheta = Math.tan(this.fov * deg2rad * 0.5);
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

  /**
   * 获取画布大小
   * @returns
   */
  getSize (): Vector2 {
    return new Vector2(this.width, this.height);
  }

  /**
   * 是否剪裁上下
   * @returns
   */
  isReversed (): boolean {
    return this.clipMode === spec.CameraClipMode.portrait;
  }

  /**
   * 获取眼睛位置
   * @returns
   */
  getEye (): Vector3 {
    return this.translation;
  }

  /**
   * 设置眼睛位置
   * @param val - 眼睛位置
   */
  setEye (val: Vector3) {
    this.translation = val;
  }
}

/**
 * 相机管理类，负责管理场景中的 3D 相机对象
 */
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
        clipMode: spec.CameraClipMode.portrait,
        item: { id: '0' },
      },
    );
  }

  /**
   * 初始化画布大小，更新默认相机
   * @param width - 画布宽度
   * @param height - 画布高度
   */
  initial (width: number, height: number) {
    this.winWidth = width;
    this.winHeight = height;

    const camera = this.defaultCamera;

    camera.width = width;
    camera.height = height;
    camera.aspect = width / height;
    camera.update();
  }

  /**
   * 插入相机数据，创建新的相机对象
   * @param name - 相机名称
   * @param data - 相机相关数据
   * @param owner - 相机所属组件
   * @returns 新的相机对象
   */
  insert (name: string, data: ModelCameraComponentData, owner?: ModelCameraComponent): PCamera {
    const camera = new PCamera(name, this.winWidth, this.winHeight, data, owner);

    this.cameraList.push(camera);

    return camera;
  }

  /**
   * 插入相机对象
   * @param camera - 相机对象
   */
  insertCamera (camera: PCamera) {
    this.cameraList.push(camera);
  }

  /**
   * 根据对象或者索引，删除相机对象
   * @param camera - 索引或相机对象
   */
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

  /**
   * 销毁相机管理对象
   */
  dispose () {
    this.cameraList = [];
  }

  /**
   * 更新默认相机状态，并计算新的透视和相机矩阵
   * @param fovy - 视角
   * @param aspect - 纵横比
   * @param nearPlane - 近裁剪平面
   * @param farPlane - 远裁剪平面
   * @param position - 位置
   * @param rotation - 旋转
   * @param clipMode - 剪裁模式
   */
  updateDefaultCamera (
    fovy: number,
    aspect: number,
    nearPlane: number,
    farPlane: number,
    position: Vector3,
    rotation: Quaternion,
    clipMode: number,
  ) {
    this.defaultCamera.fov = fovy;
    this.defaultCamera.aspect = aspect;
    this.defaultCamera.nearPlane = nearPlane;
    this.defaultCamera.farPlane = farPlane;
    this.defaultCamera.position = position;
    this.defaultCamera.rotation = rotation;
    this.defaultCamera.aspect = aspect;
    this.defaultCamera.clipMode = clipMode;
    this.defaultCamera.update();
  }

  /**
   * 获取相机对象列表
   * @returns
   */
  getCameraList (): PCamera[] {
    return this.cameraList;
  }

  /**
   * 获取默认相机对象
   * @returns
   */
  getDefaultCamera (): PCamera {
    return this.defaultCamera;
  }

  /**
   * 获取相机数目
   * @returns
   */
  getCameraCount (): number {
    return this.cameraList.length;
  }

  /**
   * 获取激活的相机对象
   * @returns
   */
  getActiveCamera (): PCamera {
    return this.defaultCamera;
  }

  /**
   * 获取画布纵横比
   * @returns
   */
  getAspect (): number {
    return this.winWidth / this.winHeight;
  }
}

