import { restoreTestState, getSpyCalls } from '../helpers/spies';
import type { VFXItem } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { LoadingGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/loading-gizmo';
import type { LoadingItemOptions } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/loading-manager';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import * as drawing from '../../../../../../plugin-packages/editor-gizmo/src/2d/drawing';

const { expect } = chai;

describe('plugin-editor-gizmo/loading-gizmo', () => {
  afterEach(restoreTestState);

  describe('LoadingGizmo', () => {
    it('释放 loading 覆盖层时同步移除 Selection 忽略 ID', () => {
      const gizmo = Object.create(LoadingGizmo.prototype) as LoadingGizmo;
      const deleteIgnoreIds = chai.spy();
      const dispose = chai.spy();
      const loadingItem = {
        getInstanceId: () => 'loading-overlay',
        dispose,
      } as unknown as VFXItem;

      Object.assign(gizmo, {
        _owner: {
          getSelection: () => ({ deleteIgnoreIds }),
        },
      });
      const internals = gizmo as unknown as {
        disposeLoadingVFXItem(item: VFXItem): void,
      };

      internals.disposeLoadingVFXItem(loadingItem);

      expect(deleteIgnoreIds).to.have.been.called.with.exactly(['loading-overlay']);
      expect(dispose).to.have.been.called.once;
    });

    it('文案位置基于元素包围盒左上角，且字号缩小后不超过 loading 区域右边界', () => {
      chai.spy.on(CanvasRenderingContext2D.prototype, 'measureText', function (this: CanvasRenderingContext2D, text: string) {
        const fontSize = Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 14);

        return {
          width: Array.from(text).length * fontSize,
          actualBoundingBoxAscent: fontSize * 0.8,
          actualBoundingBoxDescent: fontSize * 0.2,
        };
      });
      const gizmo = Object.create(LoadingGizmo.prototype) as LoadingGizmo;
      const drawText = chai.spy();
      const control = { drawText } as unknown as Control;
      const loadingBox = new Box2(new Vector2(10, 20), new Vector2(60, 70));
      const itemBox = new Box2(new Vector2(5, 7), new Vector2(100, 80));
      const tip: LoadingItemOptions = {
        text: '1234567890',
        position: new Vector2(15, 3),
      };
      const internals = gizmo as unknown as {
        drawLoadingTip (
          control: Control,
          loadingBox: Box2,
          itemBox: Box2,
          tip: LoadingItemOptions,
        ): void,
      };

      internals.drawLoadingTip(control, loadingBox, itemBox, tip);

      expect(drawText).to.have.been.called.once;
      const [left, cellTop, , fontSize] = getSpyCalls(drawText)[0] as [number, number, string, number];

      expect(left).to.equal(20);
      expect(cellTop).to.equal(6);
      expect(fontSize).to.equal(4);
      expect(left + drawing.measureTextMetrics(tip.text!, fontSize).width).to.be.at.most(loadingBox.max.x);
      // 文字实际 ink top 对齐 itemBox 左上角 + position，即 view y = 7 + 3。
      expect(cellTop + (4 + fontSize * 0.8 - fontSize * 0.8)).to.equal(10);
    });
  });
});
