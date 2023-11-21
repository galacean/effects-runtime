// @ts-nocheck
import { intersectRayBox } from '@galacean/effects';

const { expect } = chai;

describe('raycast', () => {
  it('intersect ray box', async () => {
    let tmp = [0, 0, 0];
    const origin = [0, 0, 8];
    const direction = [0, 0, -1];
    const center = [0, 0, 0];
    const size = [0.2, 0.2, 0.2];

    tmp = intersectRayBox(tmp, origin, direction, center, size);
    expect(tmp).to.exist;
    expect(tmp.length).to.not.eql(0);
  });

});
