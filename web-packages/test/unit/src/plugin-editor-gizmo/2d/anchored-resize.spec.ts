import { restoreTestState } from '../helpers/spies';
import { Matrix4, Vector3 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { calculateAnchoredResize } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/resize-selection-gizmo/anchored-resize';

const { expect } = chai;

describe('plugin-editor-gizmo/anchored-resize', () => {
  afterEach(restoreTestState);

  describe('anchored edge resize', () => {
    it('始终固定对边中点，transform anchor 不在几何中心也不漂移', () => {
      const fixedPoint = new Vector3(50, 0, 0);
      const resizeOrigin = new Vector3(0, 30, 0);
      const result = calculateAnchoredResize({
        initialHandle: new Vector3(50, 100, 0),
        fixedPoint,
        resizeOrigin,
        worldToLocalRotation: new Matrix4(),
      }, new Vector3(50, 120, 0), {
        handleKind: 'edge',
        lockAspectRatio: true,
      });

      expect(result.totalScalar).to.deep.equal(new Vector3(1.2, 1.2, 1.2));
      const fixedAfterResize = resizeOrigin.clone().add(
        fixedPoint.clone().subtract(resizeOrigin).multiply(result.totalScalar),
      ).add(result.totalTranslation);

      expect(fixedAfterResize.x).to.be.closeTo(fixedPoint.x, 0.5 * 10 ** -(8));
      expect(fixedAfterResize.y).to.be.closeTo(fixedPoint.y, 0.5 * 10 ** -(8));
    });

    it('世界尺寸小于 1 时可缩到零并越过固定边镜像，不受最小尺寸钳制', () => {
      const geometry = {
        initialHandle: new Vector3(0.2, 0, 0),
        fixedPoint: new Vector3(0, 0, 0),
        resizeOrigin: new Vector3(0.1, 0, 0),
        worldToLocalRotation: new Matrix4(),
      };

      const options = { handleKind: 'edge' as const, lockAspectRatio: false };

      expect(calculateAnchoredResize(geometry, new Vector3(0.1, 0, 0), options).totalScalar.x).to.be.closeTo(0.5, 0.5 * 10 ** -(2));
      expect(calculateAnchoredResize(geometry, new Vector3(0, 0, 0), options).totalScalar.x).to.equal(0);
      expect(calculateAnchoredResize(geometry, new Vector3(-0.05, 0, 0), options).totalScalar.x).to.be.closeTo(-0.25, 0.5 * 10 ** -(2));
      expect(calculateAnchoredResize(geometry, new Vector3(-0.15, 0, 0), options).totalScalar.x).to.be.closeTo(-0.75, 0.5 * 10 ** -(2));
    });

    it('自由边缩放只改主轴，锁比例边缩放同步另一轴', () => {
      const geometry = {
        initialHandle: new Vector3(100, 0, 0),
        fixedPoint: new Vector3(),
        resizeOrigin: new Vector3(50, 0, 0),
        worldToLocalRotation: new Matrix4(),
      };

      expect(calculateAnchoredResize(geometry, new Vector3(150, 0, 0), {
        handleKind: 'edge',
        lockAspectRatio: false,
      }).totalScalar).to.deep.equal(new Vector3(1.5, 1, 1));
      expect(calculateAnchoredResize(geometry, new Vector3(150, 0, 0), {
        handleKind: 'edge',
        lockAspectRatio: true,
      }).totalScalar).to.deep.equal(new Vector3(1.5, 1.5, 1.5));
      const result = calculateAnchoredResize(geometry, new Vector3(-150, 0, 0), {
        handleKind: 'edge',
        lockAspectRatio: true,
      });

      expect(result.totalScalar).to.deep.equal(new Vector3(-1.5, 1.5, 1.5));
      const fixedAfterResize = geometry.resizeOrigin.clone().add(
        geometry.fixedPoint.clone().subtract(geometry.resizeOrigin).multiply(result.totalScalar),
      ).add(result.totalTranslation);

      expect(fixedAfterResize).to.deep.equal(geometry.fixedPoint);
    });

    it('角点自由缩放保留双轴符号，锁定比例时按主轴幅度镜像', () => {
      const geometry = {
        initialHandle: new Vector3(100, 100, 0),
        fixedPoint: new Vector3(),
        resizeOrigin: new Vector3(50, 50, 0),
        worldToLocalRotation: new Matrix4(),
      };

      const free = calculateAnchoredResize(geometry, new Vector3(-50, 25, 0), {
        handleKind: 'corner',
        lockAspectRatio: false,
      });

      expect(free.totalScalar).to.deep.equal(new Vector3(-0.5, 0.25, 1));

      const lockedX = calculateAnchoredResize(geometry, new Vector3(-50, 25, 0), {
        handleKind: 'corner',
        lockAspectRatio: true,
      });

      expect(lockedX.totalScalar).to.deep.equal(new Vector3(-0.5, 0.5, 0.5));

      const lockedBoth = calculateAnchoredResize(geometry, new Vector3(-50, -75, 0), {
        handleKind: 'corner',
        lockAspectRatio: true,
      });

      expect(lockedBoth.totalScalar).to.deep.equal(new Vector3(-0.75, -0.75, 0.75));
      const fixedAfterResize = geometry.resizeOrigin.clone().add(
        geometry.fixedPoint.clone().subtract(geometry.resizeOrigin).multiply(lockedBoth.totalScalar),
      ).add(lockedBoth.totalTranslation);

      expect(fixedAfterResize).to.deep.equal(geometry.fixedPoint);
    });

    it('角点自由缩放可精确经过零点，不施加最小尺寸', () => {
      const result = calculateAnchoredResize({
        initialHandle: new Vector3(100, 80, 0),
        fixedPoint: new Vector3(),
        resizeOrigin: new Vector3(50, 40, 0),
        worldToLocalRotation: new Matrix4(),
      }, new Vector3(), {
        handleKind: 'corner',
        lockAspectRatio: false,
      });

      expect(result.totalScalar).to.deep.equal(new Vector3(0, 0, 1));
    });
  });

  describe('anchored resize axis constraints', () => {
    it('keeps height and vertical translation unchanged for width-only corner resize', () => {
      const result = calculateAnchoredResize({
        initialHandle: new Vector3(100, 80, 0),
        fixedPoint: new Vector3(),
        resizeOrigin: new Vector3(50, 40, 0),
        worldToLocalRotation: new Matrix4(),
      }, new Vector3(150, 20, 0), {
        handleKind: 'corner',
        lockAspectRatio: false,
        lockedAxis: 'y',
      });

      expect(result.totalScalar).to.deep.equal(new Vector3(1.5, 1, 1));
      expect(result.totalTranslation).to.deep.equal(new Vector3(25, 0, 0));
    });
  });
});
