import { BezierCurve, createKeyFrameMeta, createValueGetter, spec, ValueGetter } from '@galacean/effects';

const { expect } = chai;

describe('core/math/value-getter', () => {
  it('line integrate value', () => {
    const v = createValueGetter([spec.ValueType.LINE, [[0, 180], [0.5, 0], [1, 180]]]);

    expect(v.getIntegrateValue(0, 0.5, 2)).to.eql(90);
    expect(v.getIntegrateValue(0, 0.5, 1)).to.eql(180 * 0.5 / 2);
    expect(v.getIntegrateValue(0, 1)).to.eql(90);
    expect(v.getIntegrateValue(0, 1, 2)).to.eql(180);
    expect(v.getIntegrateValue(0, 0.75)).to.eql(45 * 1.25);
    expect(v.getIntegrateValue(0, 0.75, 2)).to.eql(45 * 2.5);
  });

  it('static integrate value', () => {
    const v = createValueGetter([spec.ValueType.CONSTANT, 0.4]);

    expect(v.getIntegrateValue(0, 1, 2)).to.eql(0.4);
    expect(v.getIntegrateValue(0, 0.5, 2)).to.eql(0.2);
    expect(v.getIntegrateValue(0.5, 0.8, 1)).approximately(0.12, 0.01);
  });

  it('curve value with hole', () => {
    const v = createValueGetter([spec.ValueType.BEZIER_CURVE, [
      [
        3,
        [
          0.28,
          90,
          0.4466,
          90,
        ],
        1,
      ],
      [
        2,
        [
          0.6134,
          10,
          0.78,
          10,
        ],
        1,
      ],
    ]]);

    expect(v.getValue(0)).to.eql(90);
    expect(v.getValue(1)).to.eql(10);
    expect(v.getIntegrateValue(0, 1), '4').to.be.closeTo(25, 0.001);
  });

  it('line value with hole', () => {
    const v = createValueGetter([spec.ValueType.LINE, [[0.2, 180], [0.5, 0], [0.75, 180]]]);

    expect(v.getValue(0)).to.eql(180);
    expect(v.getValue(1)).to.eql(180);
    expect(v.getIntegrateValue(0, 0.1)).to.eql(180 * 0.1);
    expect(v.getIntegrateValue(0.85, 1)).to.eql(180 * 0.15);
  });

  it('keeps a single key as a BezierCurve with a constant value', () => {
    const curve = createValueGetter([spec.ValueType.BEZIER_CURVE, [
      [spec.BezierKeyframeType.LINE, [0.2853, 1]],
    ]]);

    expect(curve).to.be.instanceOf(BezierCurve);
    for (const time of [-1, 0, 0.2853, 0.5, 1, 2]) {
      expect(curve.getValue(time)).to.equal(1);
    }
    expect(curve.getMaxTime()).to.equal(0.2853);
  });

  it('encodes a single Bezier key as a constant without adding curve data', () => {
    const curve = createValueGetter([spec.ValueType.BEZIER_CURVE, [
      [spec.BezierKeyframeType.LINE, [0.2853, 1]],
    ]]);
    const otherCurve = createValueGetter([spec.ValueType.BEZIER_CURVE, [
      [spec.BezierKeyframeType.LINE, [0, 2]],
      [spec.BezierKeyframeType.LINE, [1, 4]],
    ]]);
    const meta = createKeyFrameMeta();

    otherCurve.toUniform(meta);
    const previousMeta = { ...meta, curves: [...meta.curves] };
    const previousData = ValueGetter.getAllData(meta);

    expect(Array.from(curve.toUniform(meta))).to.deep.equal([0, 1, 0, 0]);
    expect(meta).to.deep.equal(previousMeta);
    expect(ValueGetter.getAllData(meta)).to.deep.equal(previousData);
  });

  it('integrates a single Bezier key like a constant', () => {
    const curve = createValueGetter([spec.ValueType.BEZIER_CURVE, [
      [spec.BezierKeyframeType.LINE, [0.2853, 4]],
    ]]);
    const constant = createValueGetter(4);

    for (const [t0, t1, timeScale] of [[0, 0.5, 1], [0, 1, 2], [0.25, 0.75, 3], [0.75, 0.25, 2]]) {
      expect(curve.getIntegrateValue(t0, t1, timeScale)).to.equal(constant.getIntegrateValue(t0, t1, timeScale));
      expect(curve.getIntegrateByTime(t0, t1)).to.equal(constant.getIntegrateByTime(t0, t1));
    }
  });

  it('treats an empty BezierCurve as zero', () => {
    const curve = createValueGetter([spec.ValueType.BEZIER_CURVE, []]);
    const meta = createKeyFrameMeta();

    expect(curve).to.be.instanceOf(BezierCurve);
    expect(curve.getValue(0.5)).to.equal(0);
    expect(curve.getIntegrateValue(0.25, 0.75, 2)).to.equal(0);
    expect(curve.getIntegrateByTime(0.25, 0.75)).to.equal(0);
    expect(curve.getMaxTime()).to.equal(0);
    expect(Array.from(curve.toUniform(meta))).to.deep.equal([0, 0, 0, 0]);
    expect(meta).to.deep.equal(createKeyFrameMeta());
  });
});
