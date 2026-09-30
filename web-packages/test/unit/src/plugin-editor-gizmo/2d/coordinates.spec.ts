import { restoreTestState } from '../helpers/spies';
import type { VFXItem } from '@galacean/effects';
import { Matrix4, Quaternion, Vector2, Vector3 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { Plane } from '@galacean/effects-math/es/extension/index';
import { viewSizeToWorld } from '../../../../../../plugin-packages/editor-gizmo/src/2d/viewport';

const { expect } = chai;

describe('plugin-editor-gizmo/coordinates', () => {
  afterEach(restoreTestState);

  const CAMERA_POSITION = new Vector3(0, 0, 8);

  const CONTAINER_SIZE = new Vector2(800, 600);

  function createProjectionFixture () {
    const projectionMatrix = new Matrix4().perspective(Math.PI / 3, 800 / 600, 0.1, 40, true);
    const viewMatrix = new Matrix4()
      .compose(CAMERA_POSITION, new Quaternion(), new Vector3(1, 1, 1))
      .invert();
    const viewProjectionMatrix = new Matrix4().multiplyMatrices(projectionMatrix, viewMatrix);
    const item = {
      composition: {
        camera: {
          getProjectionMatrix: () => projectionMatrix.clone(),
          getViewMatrix: () => viewMatrix.clone(),
        },
      },
    } as unknown as VFXItem;
    const cameraInfo = {
      position: CAMERA_POSITION,
      matrix: viewProjectionMatrix.clone().invert(),
    };

    return { item, cameraInfo };
  }

  function createPlaneAtZ (z: number): Plane {
    return new Plane().setFromNormalAndCoplanarPoint(
      new Vector3(0, 0, z),
      new Vector3(0, 0, 1),
    );
  }

  describe('viewport coordinates', () => {
    it('viewSizeToWorld 在同一非零平面计算两交点之差，不把平面 z 混入尺寸', () => {
      const { item, cameraInfo } = createProjectionFixture();
      const worldSize = viewSizeToWorld(
        new Vector2(100, 80),
        CONTAINER_SIZE,
        item,
        cameraInfo,
        createPlaneAtZ(1),
      );

      expect(worldSize.x).not.to.equal(0);
      expect(worldSize.y).not.to.equal(0);
      expect(worldSize.z).to.be.closeTo(0, 0.5 * 10 ** -(12));
    });

    it('viewSizeToWorld 反复使用带微小 z 误差的平面时不累积漂移', () => {
      const { item, cameraInfo } = createProjectionFixture();
      let itemZ = 1e-12;

      for (let i = 0; i < 60; i++) {
        const worldSize = viewSizeToWorld(
          new Vector2(158.07, 147.01),
          CONTAINER_SIZE,
          item,
          cameraInfo,
          createPlaneAtZ(itemZ),
        );

        expect(worldSize.z).to.be.closeTo(0, 0.5 * 10 ** -(12));
        itemZ += worldSize.z;
      }

      expect(itemZ).to.be.closeTo(1e-12, 0.5 * 10 ** -(12));
    });

    it('viewSizeToWorld 在交互平面位于相机后方时返回零向量', () => {
      const { item, cameraInfo } = createProjectionFixture();
      const warn = chai.spy.on(console, 'warn', () => {});

      try {
        const worldSize = viewSizeToWorld(
          new Vector2(100, 80),
          CONTAINER_SIZE,
          item,
          cameraInfo,
          createPlaneAtZ(9),
        );

        expect(worldSize.toArray()).to.deep.equal([0, 0, 0]);
        expect(warn).to.have.been.called.once;
      } finally {
        chai.spy.restore();
      }
    });
  });
});
