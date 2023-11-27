import type { CameraOptionsEx, spec } from '@galacean/effects';

export interface CameraGestureHandler {

  getCurrentTarget (): string,

  getCurrentType (): CameraGestureType,

  /**
   * 通过按键事件对相机进行平移
   * @param event - 键盘事件信息
   * @returns 当前的相机参数
   */
  onKeyEvent (event: CameraKeyEvent): CameraOptionsEx,

  /**
   * 在 XY 方向上平移相机开始函数，在鼠标按下时调用
   * @param x - 鼠标在 x 坐标上的值
   * @param y - 鼠标在 y 坐标上的值
   * @param width - 当前画布的宽度
   * @param height - 当前画布的高度
   * @param cameraID - 要控制的相机 item id
   * @returns 当前的相机参数
   */
  onXYMoveBegin (x: number, y: number, width: number, height: number, cameraID: string): CameraOptionsEx,

  /**
   * 在 XY 方向上平移相机开始函数，在鼠标按下拖拽时调用
   * @param x - 鼠标在 x 坐标上的值
   * @param y - 鼠标在 y 坐标上的值
   * @param speed - 移动速度，默认是 0.015
   * @returns 更新后的相机参数
   */
  onXYMoving (x: number, y: number, speed?: number): CameraOptionsEx,

  /**
   * 结束在 XY 方向上平移相机
   */
  onXYMoveEnd (): void,

  /**
   * 在 Z 方向上平移相机开始函数，类似缩放 3D 模型，在鼠标按下时调用
   * @param x - 鼠标在 x 坐标上的值
   * @param y - 鼠标在 y 坐标上的值
   * @param width - 当前画布的宽度
   * @param height - 当前画布的高度
   * @param cameraID - 要控制的相机 item id
   * @returns 当前的相机参数
   */
  onZMoveBegin (x: number, y: number, width: number, height: number, cameraID: string): CameraOptionsEx,

  /**
   * 在 Z 方向上平移相机开始函数，类似缩放 3D 模型，在鼠标按下拖拽时调用
   * @param x - 鼠标在 x 坐标上的值
   * @param y - 鼠标在 y 坐标上的值
   * @param speed - 移动速度，默认是 0.015
   * @returns 更新后的相机参数
   */
  onZMoving (x: number, y: number, speed?: number): CameraOptionsEx,

  /**
   * 结束在 Z 方向上平移相机
   */
  onZMoveEnd (): void,

  /**
   * 相机的自旋转，就是镜头漫游的效果，在鼠标按下时调用
   * @param x - 鼠标在 x 坐标上的值
   * @param y - 鼠标在 y 坐标上的值
   * @param width - 当前画布的宽度
   * @param height - 当前画布的高度
   * @param cameraID - 要控制的相机 item id
   * @returns 当前的相机参数
   */
  onRotateBegin (x: number, y: number, width: number, height: number, cameraID: string): CameraOptionsEx,

  /**
   * 相机的自旋转，在鼠标按下拖拽时调用
   * @param x - 鼠标在 x坐标上的值
   * @param y - 鼠标在y坐标上的值
   * @param speed - 移动速度，默认是 1
   * @returns 更新后的相机参数
   */
  onRotating (x: number, y: number, speed?: number): CameraOptionsEx,

  /**
   * 相机的自旋转
   */
  onRotateEnd (): void,

  /**
   * 相机绕某个点旋转，就是拖拽模型的效果，在鼠标按下时调用
   * @param x - 鼠标在 x 坐标上的值
   * @param y - 鼠标在 y 坐标上的值
   * @param width - 当前画布的宽度
   * @param height - 当前画布的高度
   * @param cameraID - 要控制的相机 item id
   * @returns 当前的相机参数
   */
  onRotatePointBegin (x: number, y: number, width: number, height: number, point: spec.vec3, cameraID: string): CameraOptionsEx,

  /**
   * 相机绕某个点旋转，在鼠标按下拖拽时调用
   * @param x - 鼠标在 x 坐标上的值
   * @param y - 鼠标在 y 坐标上的值
   * @param speed - 移动速度，默认是 1
   * @returns 更新后的相机参数
   */
  onRotatingPoint (x: number, y: number, speed?: number): CameraOptionsEx,

  /**
   * 相机绕某个点旋转
   */
  onRotatePointEnd (): void,

  /**
   * 相机移动到指定点
   * @param cameraID -相机 ID
   * @param position - 指定位置
   */
  moveTo (cameraID: string, position: spec.vec3): void,

  /**
   * 相机旋转到指定方向
   * @param cameraID - 相机ID
   * @param quat - 指定旋转
   */
  rotateTo (cameraID: string, quat: spec.vec4): void,

  /**
   * 相机对中心点进行聚焦，先从当前位置 LookAt 过去，然后移到距离中心点给定距离（默认是 5）的位置
   * @param cameraID - 相机 ID
   * @param point - 聚焦的中心点
   * @param distance - 聚焦的距离，默认是 5
   */
  onFocusPoint (cameraID: string, point: spec.vec3, distance?: number): void,

}

export enum CameraGestureType {
  none,
  translate = 1,
  rotate_focus = 2,
  rotate_self = 3,
  scale = 4
}

export interface CameraGestureHandlerParams {
  type: CameraGestureType,

  mouseEvent: boolean,

  // mouse position
  clientX: number,
  clientY: number,

  // canvas size
  clientWidth: number,
  clientHeight: number,

  //camera item id
  target: string,

  //rotate_focus point
  focusPoint?: spec.vec3,

  speed?: number, // default = 0.015
}

export interface CameraKeyEvent {
  cameraID: string,
  xAxis?: -1 | 1,
  yAxis?: -1 | 1,
  zAxis?: -1 | 1,
  speed?: number,
}
