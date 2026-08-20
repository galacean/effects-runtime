import { Transform, math } from '@galacean/effects';
import { sanitizeNumbers } from '../utils';

const { Euler, Quaternion, Vector3 } = math;
const { expect } = chai;

describe('core/transform', () => {
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

    r.setValid(false);
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
    expect(new Float32Array(r.rotation.toArray())).to.deep.equal(new Float32Array([0, 30, 0]));
    expect(new Float32Array(r.quat.toArray())).to.deep.equal(new Float32Array([0, 0.25881904510252074, 0, 0.9659258262890683]));
    r.setQuaternion(0, 0, 0, 1);
    expect(new Float32Array(r.rotation.toArray())).to.deep.equal(new Float32Array([0, -0, 0]));
  });

  it('keeps Euler, quaternion and matrix rotations in the same convention', () => {
    const rotation = new Euler(12, 34, 56);
    const expectedQuat = Quaternion.fromEuler(rotation);
    const transform = new Transform({ valid: true });
    const quaternionRotated = Vector3.X.clone().applyQuaternion(expectedQuat);

    transform.setRotation(rotation.x, rotation.y, rotation.z);

    expect(transform.quat.angleTo(expectedQuat)).to.be.closeTo(0, 1e-7);
    expectVectorClose(Vector3.X.clone().applyMatrix(transform.getMatrix()), quaternionRotated);
    expectEulerClose(transform.getRotation(), rotation);
  });

  it('keeps rotation synchronized after quaternion and matrix updates', () => {
    const rotation = new Euler(-21, 32, 17);
    const quat = Quaternion.fromEuler(rotation);
    const transform = new Transform({ valid: true });

    transform.setQuaternion(quat.x, quat.y, quat.z, quat.w);
    expectEulerClose(transform.rotation, rotation);

    const clone = new Transform({ valid: true });

    clone.cloneFromMatrix(transform.getMatrix());
    expect(clone.quat.angleTo(quat)).to.be.closeTo(0, 1e-7);
    expectEulerClose(clone.rotation, rotation);
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

function expectEulerClose (actual: InstanceType<typeof Euler>, expected: InstanceType<typeof Euler>) {
  expect(actual.x).to.be.closeTo(expected.x, 0.00001);
  expect(actual.y).to.be.closeTo(expected.y, 0.00001);
  expect(actual.z).to.be.closeTo(expected.z, 0.00001);
}

function expectVectorClose (actual: InstanceType<typeof Vector3>, expected: InstanceType<typeof Vector3>) {
  expect(actual.x).to.be.closeTo(expected.x, 0.00001);
  expect(actual.y).to.be.closeTo(expected.y, 0.00001);
  expect(actual.z).to.be.closeTo(expected.z, 0.00001);
}
