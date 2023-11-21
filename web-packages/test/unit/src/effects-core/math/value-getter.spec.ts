import { createValueGetter, spec } from '@galacean/effects';

const { expect } = chai;

describe('value getter', () => {
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
    const v = createValueGetter([spec.ValueType.CURVE, [[0.281, 90, -5.607, -5.607], [0.781, 10, -7.653, -7.653]]]);

    expect(v.getValue(0)).to.eql(90);
    expect(v.getValue(1)).to.eql(10);
    expect(v.getIntegrateValue(0, 0.25), '3').to.eql(90 * 0.25);
    expect(v.getIntegrateValue(0.8, 1), '4').to.be.closeTo(10 * 0.2, 0.00000001);
  });

  it('line value with hole', () => {
    const v = createValueGetter([spec.ValueType.LINE, [[0.2, 180], [0.5, 0], [0.75, 180]]]);

    expect(v.getValue(0)).to.eql(180);
    expect(v.getValue(1)).to.eql(180);
    expect(v.getIntegrateValue(0, 0.1)).to.eql(180 * 0.1);
    expect(v.getIntegrateValue(0.85, 1)).to.eql(180 * 0.15);
  });
});
