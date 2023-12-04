// @ts-nocheck
import { Transform, math } from '@galacean/effects';
import { sanitizeNumbers } from '../utils';

const { Euler, Quaternion, Vector3 } = math;
const { expect } = chai;

describe('transform methods', () => {
  it('transform will work after been set valid', () => {
    const r = new Transform({
      position: [-1, 2, 3],
      scale: [4, 5, 6],
      rotation: [10, 20, 30],
    });
    const scale = new Vector3();
    const pos = new Vector3();
    const quat = new Quaternion();
    const rotation = new Euler();

    r.assignWorldTRS(pos, quat, scale);
    expect(scale.toArray()).to.deep.equals([1, 1, 1]);
    expect(sanitizeNumbers(quat.toArray())).to.deep.equals([0, 0, 0, 1]);
    expect(pos.toArray()).to.deep.equals([0, 0, 0]);

    r.setValid(true);
    r.assignWorldTRS(pos, quat, scale);
    expect(pos.toArray()).to.deep.equals([-1, 2, 3]);
    expect(scale.x).to.be.closeTo(4, 0.00001);
    expect(scale.y).to.be.closeTo(5, 0.00001);
    expect(scale.z).to.be.closeTo(6, 0.00001);

    Transform.getRotation(quat, rotation);
    expect(rotation.x).to.be.closeTo(10, 0.00001);
    expect(rotation.y).to.be.closeTo(20, 0.00001);
    expect(rotation.z).to.be.closeTo(30, 0.00001);
  });
  it('transform get rotation', () => {
    const r = new Transform({
      valid: true,
    });

    r.setRotation(0, 30, 0);
    vecEquals(r.rotation.toArray(), [0, 30, 0]);
    vecEquals(r.quat.toArray(), [-0, -0.25881904510252074, -0, 0.9659258262890683]);
    r.setQuaternion(0, 0, 0, 1);
    vecEquals(r.rotation.toArray(), [0, -0, 0]);
  });

  it('decompose negative scale', () => {
    const r = new Transform({
      valid: true,
    });
    const scale = new Vector3();
    const pos = new Vector3();
    const quat = new Quaternion();

    r.setScale(-1, 1, 1);
    r.assignWorldTRS(pos, quat, scale);
    expect(scale.toArray()).to.deep.equals([-1, 1, 1]);
    expect(sanitizeNumbers(quat.toArray())).to.deep.equals([0, 0, 0, 1]);
    expect(pos.toArray()).to.deep.equals([0, 0, 0]);
  });

  it('getWorldMatrix cache', () => {
    const parent = new Transform({ valid: true, position: [1, 0, 0] });
    const t = new Transform({ valid: true, position: [0, 0, 1] });

    t.parentTransform = parent;
    const pt = parent.getWorldMatrix = chai.spy(parent.getWorldMatrix);
    const pos = new Vector3();

    t.assignWorldTRS(pos);
    expect(pt).to.has.been.called.once;
    expect(sanitizeNumbers(pos.toArray())).to.deep.equals([1, 0, 1]);
    t.assignWorldTRS(pos);
    expect(pt).to.has.been.called.twice;
    parent.setPosition(0, 1, 0);
    t.assignWorldTRS(pos);
    expect(sanitizeNumbers(pos.toArray())).to.deep.equals([0, 1, 1]);
    expect(pt).to.has.been.called.exactly(3);
  });

  it('get grandparent transform', () => {
    const t0 = new Transform({ valid: true, position: [1, 0, 0] });
    const t1 = new Transform({ valid: true, position: [0, 1, 0] });

    t1.parentTransform = t0;
    const t2 = new Transform({ valid: true, position: [0, 0, 1] });

    t2.parentTransform = t1;
    const pos = new Vector3();

    t2.assignWorldTRS(pos);
    expect(sanitizeNumbers(pos.toArray())).to.deep.equals([1, 1, 1]);
    t0.setPosition(2, 0, 0);
    t2.assignWorldTRS(pos);
    expect(sanitizeNumbers(pos.toArray())).to.deep.equals([2, 1, 1]);
  });

  it('assignWorldTRS invalid local cache', () => {
    const t2 = new Transform({ valid: true, position: [1, 0, 0] });
    const pos = new Vector3();

    t2.assignWorldTRS(pos);
    expect(pos.toArray()).to.deep.equals([1, 0, 0]);
    t2.setPosition(2, 0, 0);
    t2.assignWorldTRS(pos);
    expect(pos.toArray()).to.deep.equals([2, 0, 0]);
  });

  it('invalid other children', () => {
    const p = new Transform({ valid: true, position: [1, 0, 0] });
    const t1 = new Transform({ valid: true, position: [0, 1, 0] }, p);
    const t2 = new Transform({ valid: true, position: [0, 0, 1] }, p);

    p.setPosition(2, 0, 0);

    expect(t1.getWorldPosition().toArray()).to.deep.equals([2, 1, 0]);
    expect(t2.getWorldPosition().toArray()).to.deep.equals([2, 0, 1]);
  });

});

function vecEquals (v0, v1, msg) {
  expect(new Float32Array(v0)).to.deep.equal(new Float32Array(v1), msg);
}
