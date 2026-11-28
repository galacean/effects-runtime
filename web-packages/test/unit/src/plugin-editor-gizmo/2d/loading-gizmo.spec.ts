import { restoreTestState, getSpyCalls } from '../helpers/spies';
import { TextCache } from '@galacean/effects';
import type { Texture, VFXItem } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { LoadingGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/loading-gizmo';
import type { LoadingItemOptions } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/loading-manager';
import { LoadingTextTipType } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/loading-manager';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';

const { expect } = chai;

describe('plugin-editor-gizmo/loading-gizmo', () => {
  afterEach(restoreTestState);

  describe('LoadingGizmo', () => {
    it('纹理提示随 loadingBox 等比缩放并居中显示', () => {
      const gizmo = Object.create(LoadingGizmo.prototype) as LoadingGizmo;
      const drawTexture = chai.spy();
      const control = { drawTexture } as unknown as Control;
      const first = { width: 80, height: 40 } as Texture;
      const next = { width: 10, height: 5 } as Texture;
      const itemBox = new Box2(new Vector2(), new Vector2(100, 100));
      const internals = gizmo as unknown as {
        drawLoadingTip(control: Control, loadingBox: Box2, itemBox: Box2, tip: LoadingItemOptions): void,
      };

      internals.drawLoadingTip(control, new Box2(new Vector2(10, 20), new Vector2(60, 70)), itemBox,
        { type: LoadingTextTipType.TEXTURE, texture: first });
      expect(drawTexture).to.have.been.called.with.exactly(10, 32.5, 50, 25, first);
      internals.drawLoadingTip(control, new Box2(new Vector2(10, 20), new Vector2(30, 40)), itemBox,
        { type: LoadingTextTipType.TEXTURE, texture: next });
      expect(getSpyCalls(drawTexture).at(-1)).to.deep.equal([10, 25, 20, 10, next]);
    });

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

    it('文案位置基于元素包围盒，文字始终适配 loading 区域', () => {
      const gizmo = Object.create(LoadingGizmo.prototype) as LoadingGizmo;
      const drawText = chai.spy();
      const control = {
        drawText,
        measureText: (text: string, fontSize: number) => ({
          width: TextCache.graphemeSegmenter(text).length * fontSize,
          lineHeight: fontSize,
          advances: TextCache.graphemeSegmenter(text).map(() => fontSize),
          inkTop: fontSize * 0.1,
          inkHeight: fontSize,
        }),
      } as unknown as Control;
      const loadingBox = new Box2(new Vector2(10, 20), new Vector2(60, 70));
      const itemBox = new Box2(new Vector2(5, 7), new Vector2(100, 80));
      const tip: LoadingItemOptions = {
        type: LoadingTextTipType.TEXT,
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
      expect(cellTop).to.equal(19.6);
      expect(fontSize).to.equal(4);
      expect(left + control.measureText(tip.text, fontSize).width).to.be.at.most(loadingBox.max.x);
      // 超出 loading 区域的偏移收敛到区域顶部。
      expect(cellTop + control.measureText(tip.text, fontSize).inkTop).to.equal(20);
      internals.drawLoadingTip(control, new Box2(new Vector2(10, 20), new Vector2(60, 22)), itemBox, { type: LoadingTextTipType.TEXT, text: 'OK' });
      const [, shortTop, , shortSize] = getSpyCalls(drawText).at(-1) as [number, number, string, number];
      const metrics = control.measureText('OK', shortSize);

      expect(shortTop + metrics.inkTop).to.equal(20);
      expect(shortTop + metrics.inkTop + metrics.inkHeight).to.be.at.most(22);
    });
  });
});
