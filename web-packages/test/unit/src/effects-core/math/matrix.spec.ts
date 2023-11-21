// @ts-nocheck
import { getMat4TRS, mat4fromRotationTranslationScale } from '@galacean/effects';

const { expect } = chai;

describe('矩阵测试', () => {
  it('测试矩阵分解平移/旋转/缩放(与Unity分解结果对齐)', () => {
    const matrix = [
      -0.66851407289505, 3.232001543045044, -1.8427306413650513, 0,
      -2.5140888690948486, -0.3082773983478546, 0.3713786005973816, 0,
      0.33451002836227417, 2.5825717449188232, 4.408267974853516, 0,
      13.5, 2.34, 5.678, 1,
    ];
    const translation = [0, 0, 0];
    const rotation = [0, 0, 0, 1];
    const scale = [1, 1, 1];

    getMat4TRS(matrix, translation, rotation, scale);

    expect(translation[0]).to.closeTo(13.5, 1e-6);
    expect(translation[1]).to.closeTo(2.34, 1e-6);
    expect(translation[2]).to.closeTo(5.678, 1e-6);

    expect(rotation[0]).to.closeTo(-0.14367972314357758, 1e-6);
    expect(rotation[1]).to.closeTo(0.22104571759700775, 1e-6);
    expect(rotation[2]).to.closeTo(0.7345519661903381, 1e-6);
    expect(rotation[3]).to.closeTo(0.6252426505088806, 1e-6);

    expect(scale[0]).to.closeTo(3.7800002098083496, 1e-6);
    expect(scale[1]).to.closeTo(2.559999942779541, 1e-6);
    expect(scale[2]).to.closeTo(5.119999885559082, 1e-6);
  });

  it('测试平移/旋转/缩放合成矩阵', () => {
    const translation = [13.5, 2.34, 5.678];
    const rotation = [-0.14367972314357758, 0.22104571759700775, 0.7345519661903381, 0.6252426505088806];
    const scale = [3.7800002098083496, 2.559999942779541, 5.119999885559082];
    const out = new Array(16);
    const matrix = [
      -0.66851407289505, 3.232001543045044, -1.8427306413650513, 0,
      -2.5140888690948486, -0.3082773983478546, 0.3713786005973816, 0,
      0.33451002836227417, 2.5825717449188232, 4.408267974853516, 0,
      13.5, 2.34, 5.678, 1,
    ];

    mat4fromRotationTranslationScale(out, rotation, translation, scale);
    matrix.forEach((m, i) => {
      expect(m).to.closeTo(out[i], 1e-6);
    });
  });
});
