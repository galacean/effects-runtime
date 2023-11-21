// @ts-nocheck
import { Transform } from '@galacean/effects';
import { sanitizeNumbers } from '../utils';

const { expect } = chai;

describe('transform methods', () => {
  it('transform will work after been set valid', () => {
    const r = new Transform({
      position: [-1, 2, 3],
      scale: [4, 5, 6],
      rotation: [10, 20, 30],
    });
    const scale = [];
    const pos = [];
    const quat = [];
    const rotation = [0, 0, 0];

    r.assignWorldTRS(pos, quat, scale);
    expect(scale).to.deep.equals([1, 1, 1]);
    expect(sanitizeNumbers(quat)).to.deep.equals([0, 0, 0, 1]);
    expect(pos).to.deep.equals([0, 0, 0]);

    r.setValid(true);
    r.assignWorldTRS(pos, quat, scale);
    expect(pos).to.deep.equals([-1, 2, 3]);
    expect(scale[0]).to.be.closeTo(4, 0.00001);
    expect(scale[1]).to.be.closeTo(5, 0.00001);
    expect(scale[2]).to.be.closeTo(6, 0.00001);

    Transform.getRotation(rotation, quat);
    expect(rotation[0]).to.be.closeTo(10, 0.00001);
    expect(rotation[1]).to.be.closeTo(20, 0.00001);
    expect(rotation[2]).to.be.closeTo(30, 0.00001);
  });
  it('transform get rotation', () => {
    const r = new Transform({
      valid: true,
    });

    r.setRotation(0, 30, 0);
    vecEquals(r.rotation, [0, 30, 0]);
    vecEquals(r.quat, [-0, -0.25881904510252074, -0, 0.9659258262890683]);
    r.setQuaternion(0, 0, 0, 1);
    vecEquals(r.rotation, [0, -0, 0]);
  });

  it('decompose negative scale', () => {
    const r = new Transform({
      valid: true,
    });
    const scale = [];
    const pos = [];
    const quat = [];

    r.setScale(-1, 1, 1);
    r.assignWorldTRS(pos, quat, scale);
    expect(scale).to.deep.equals([-1, 1, 1]);
    expect(sanitizeNumbers(quat)).to.deep.equals([0, 0, 0, 1]);
    expect(pos).to.deep.equals([0, 0, 0]);
  });

  it('getWorldMatrix cache', () => {
    const parent = new Transform({ valid: true, position: [1, 0, 0] });
    const t = new Transform({ valid: true, position: [0, 0, 1] });

    t.parentTransform = parent;
    const pt = parent.getWorldMatrix = chai.spy(parent.getWorldMatrix);
    const pos = [];

    t.assignWorldTRS(pos);
    expect(pt).to.has.been.called.once;
    expect(sanitizeNumbers(pos)).to.deep.equals([1, 0, 1]);
    t.assignWorldTRS(pos);
    expect(pt).to.has.been.called.twice;
    parent.setPosition(0, 1, 0);
    t.assignWorldTRS(pos);
    expect(sanitizeNumbers(pos)).to.deep.equals([0, 1, 1]);
    expect(pt).to.has.been.called.exactly(3);
  });

  it('get grandparent transform', () => {
    const t0 = new Transform({ valid: true, position: [1, 0, 0] });
    const t1 = new Transform({ valid: true, position: [0, 1, 0] });

    t1.parentTransform = t0;
    const t2 = new Transform({ valid: true, position: [0, 0, 1] });

    t2.parentTransform = t1;
    const pos = [];

    t2.assignWorldTRS(pos);
    expect(sanitizeNumbers(pos)).to.deep.equals([1, 1, 1]);
    t0.setPosition(2, 0, 0);
    t2.assignWorldTRS(pos);
    expect(sanitizeNumbers(pos)).to.deep.equals([2, 1, 1]);
  });

  it('assignWorldTRS invalid local cache', () => {
    const t2 = new Transform({ valid: true, position: [1, 0, 0] });
    const pos = [];

    t2.assignWorldTRS(pos);
    expect(pos).to.deep.equals([1, 0, 0]);
    t2.setPosition(2, 0, 0);
    t2.assignWorldTRS(pos);
    expect(pos).to.deep.equals([2, 0, 0]);
  });

  it('invalid other children', () => {
    const p = new Transform({ valid: true, position: [1, 0, 0] });
    const t1 = new Transform({ valid: true, position: [0, 1, 0] }, p);
    const t2 = new Transform({ valid: true, position: [0, 0, 1] }, p);

    p.setPosition(2, 0, 0);

    expect(t1.getWorldPosition()).to.deep.equals([2, 1, 0]);
    expect(t2.getWorldPosition()).to.deep.equals([2, 0, 1]);
  });

});

function vecEquals (v0, v1, msg) {
  expect(new Float32Array(v0)).to.deep.equal(new Float32Array(v1), msg);
}
