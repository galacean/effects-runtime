import { Matrix3, Matrix4, Quaternion, Vector3, PTransform } from '@galacean/effects-plugin-model';

const { expect } = chai;

describe('矩阵测试', () => {
  it('测试带镜像加缩放矩阵分解（todo：镜像矩阵如何分解出旋转四元数？）', () => {
    const trans0 = new PTransform();
    const expectMatrix = [
      -2.1, 0, 0, 0,
      0, 0.3, 0, 0,
      0, 0, 4.5, 0,
      0, 0, 0, 1,
    ];

    trans0.setScale(new Vector3(-2.1, 0.3, 4.5));
    trans0.getMatrix().toArray().forEach((v, index) => {
      expect(v).closeTo(expectMatrix[index], 1e-5);
    });
    const decomp = trans0.getMatrix().decompose();
    const scale = Matrix4.getScale(trans0.getMatrix(), new Vector3());
    const rotate = Matrix4.getRotationQuaternion(trans0.getMatrix(), new Quaternion());
    const mat3 = Matrix3.fromQuaternion(rotate, new Matrix3());
    const trans = Matrix4.getTranslation(trans0.getMatrix(), new Vector3());

    // expect(decomp.translation).to.eql(new Vector3(0, 0, 0));
    // 镜像矩阵无法计算出旋转
    // expect(decomp.rotation).to.eql(new Quaternion(0, 0, 0, 1));
    // 缩放是否应该包含负数？
    // expect(decomp.scale).to.eql(new Vector3(-2.1, 0.3, 4.5));

  });

  it('测试矩阵分解与合成（与Unity对齐）', function () {
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

    const decomp0 = trans0.getMatrix().decompose();

    expect(decomp0.translation).to.eql(new Vector3(13.5, 2.3399999141693115, 5.677999973297119));
    expect(decomp0.rotation).to.eql(new Quaternion(-0.14367972314357758, 0.22104571759700775, 0.7345519661903381, 0.6252426505088806));
    expect(decomp0.scale).to.eql(new Vector3(3.7800002098083496, 2.559999942779541, 5.119999885559082));

    const trans1 = new PTransform();

    const res0 = Matrix4.fromArray(expectMatrix);

    //console.log(expectMatrix);
    //console.log(res0.toArray());
    //trans1.matrix = expectMatrix;
    //console.log(trans1.matrix.toArray());

    res0.toArray().forEach((v, index) => {
      expect(v).closeTo(expectMatrix[index], 1e-5);
    });

    // trans1.matrix.toArray().forEach((v, index) => {
    //   expect(v).closeTo(expectMatrix[index], 1e-5);
    // });

  });
});
