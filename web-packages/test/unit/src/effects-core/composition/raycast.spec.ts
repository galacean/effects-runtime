// @ts-nocheck
import { math } from '@galacean/effects';
const { Ray, Vector3 } = math;
const { expect } = chai;

describe('raycast', () => {
  it('intersect ray box', async () => {
    let tmp = new Vector3(0, 0, 0);
    const origin = new Vector3(0, 0, 8);
    const direction = new Vector3(0, 0, -1);
    const center = new Vector3(0, 0, 0);
    const size = new Vector3(0.2, 0.2, 0.2);
    const ray = new Ray(origin, direction);
    const boxMin = center.clone().addScaledVector(size, -0.5);
    const boxMax = center.clone().addScaledVector(size, 0.5);

    tmp = ray.intersectBox({ min: boxMin, max: boxMax }, tmp);
    expect(tmp).to.exist;
    expect(tmp.length).to.not.eql(0);
  });

});
