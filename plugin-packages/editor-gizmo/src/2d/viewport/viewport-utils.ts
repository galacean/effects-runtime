import { type Engine } from '@galacean/effects';
import { Matrix4, Vector2, Vector3 } from '../math';

/** 读取 Gizmo 使用的当前视口和相机参数。 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class GizmoViewportUtils {
  /**
   * 获取视口缩放。
   * @param engine Effects 引擎
   * @returns 视口缩放；无相机时返回 1
   */
  static getViewScale (engine: Engine): number {
    const camera = engine.sceneServer.compositions[0]?.camera;

    return camera ? camera.getViewportMatrix().elements[0] : 1;
  }

  /**
   * 获取 NDC 坐标系中的视口平移。
   * @param engine Effects 引擎
   * @returns 视口平移；无相机时返回零向量
   */
  static getViewportTranslation (engine: Engine): Vector2 {
    const camera = engine.sceneServer.compositions[0]?.camera;

    if (!camera) {
      return new Vector2();
    }
    const e = camera.getViewportMatrix().elements;

    return new Vector2(e[12], e[13]);
  }

  /**
   * 获取相机位置和逆视投影矩阵。
   * @param engine Effects 引擎
   * @returns 相机信息；无相机时返回零位姿
   */
  static getCameraInfo (engine: Engine): { position: Vector3, matrix: Matrix4 } {
    const camera = engine.sceneServer.compositions[0]?.camera;

    if (!camera) {
      return { position: new Vector3(), matrix: new Matrix4() };
    }

    return {
      position: new Vector3().copyFrom(camera.position),
      matrix: new Matrix4().copyFrom(camera.getInverseViewProjectionMatrix()),
    };
  }

  /**
   * 获取 DOM 容器尺寸。
   * @param container DOM 容器
   * @returns 容器宽高
   */
  static getContainerSize (container: HTMLElement): Vector2 {
    return new Vector2(container.offsetWidth, container.offsetHeight);
  }
}
