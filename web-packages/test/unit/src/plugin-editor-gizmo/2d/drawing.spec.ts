import { restoreTestState, getSpyCalls } from '../helpers/spies';
import type { Control } from '@galacean/effects-plugin-gui';
import { drawDashedCorners } from '../../../../../../plugin-packages/editor-gizmo/src/2d/drawing';
import { Color, Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';

const { expect } = chai;

describe('plugin-editor-gizmo/drawing', () => {
  afterEach(restoreTestState);

  describe('drawDashedCorners', () => {
    it('draws a continuous four-pixel dash and gap around rotated corners', () => {
      const drawLine = chai.spy();
      const control = { drawLine } as unknown as Control;
      const color = new Color(1, 0, 0, 1);
      const corners = [
        new Vector2(0, 0),
        new Vector2(6, 8),
        new Vector2(12, 8),
        new Vector2(6, 0),
      ];

      drawDashedCorners(control, corners, color, 1, 4, 4);

      expect(drawLine).to.have.been.called();
      for (const call of getSpyCalls(drawLine)) {
        const [x1, y1, x2, y2, calledColor, width] = call;

        expect(Math.hypot(x2 - x1, y2 - y1)).to.be.at.most(4.000001);
        expect(calledColor).to.equal(color);
        expect(width).to.equal(1);
      }

      expect(getSpyCalls(drawLine)[0][0]).to.equal(0);
      expect(getSpyCalls(drawLine)[0][1]).to.equal(0);
      expect(getSpyCalls(drawLine)[0][2]).to.be.closeTo(2.4, 0.5 * 10 ** -(2));
      expect(getSpyCalls(drawLine)[0][3]).to.be.closeTo(3.2, 0.5 * 10 ** -(2));
      // The first 10px edge ends halfway through a dash/gap pattern, so the next
      // edge resumes at the matching phase instead of restarting with 4px.
      expect(getSpyCalls(drawLine)[2].slice(0, 4)).to.deep.equal([6, 8, 8, 8]);
    });

    it('ignores invalid patterns and degenerate boxes', () => {
      const drawLine = chai.spy();
      const control = { drawLine } as unknown as Control;
      const color = new Color();
      const corners = Array.from({ length: 4 }, () => new Vector2(1, 1));

      drawDashedCorners(control, corners, color, 1, 4, 4);
      drawDashedCorners(control, corners.slice(0, 3), color, 1, 4, 4);
      drawDashedCorners(control, corners, color, 1, 0, 4);

      expect(drawLine).not.to.have.been.called();
    });
  });
});
