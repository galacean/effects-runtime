import { spec, TextStyle, Transform, type VFXItem } from '@galacean/effects';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import { RichTextLayout } from '../../../../../../plugin-packages/rich-text/src/rich-text-layout';
import { RichTextStrategyFactory } from '../../../../../../plugin-packages/rich-text/src/strategies/rich-text-factory';
import { applyRichTextResize, createRichTextResizeSnapshot, getRichTextFrameRatio, getRichTextFrameWidth } from '../../../../../../plugin-packages/editor-gizmo/src/2d/rich-text/rich-text-resize';
import { RichTextDocument } from '../../../../../../plugin-packages/editor-gizmo/src/2d/rich-text/rich-text-document';
import { ResizeSelectionGizmo, TransformType } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/resize-selection-gizmo';
import { Matrix4, Vector2, Vector3 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';
import { LoadingManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/loading-manager';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';

const { expect } = chai;

/** 保留真实排版、画布和变换，仅省略纹理上传。 */
function createRichText (text = 'AB<size=32.5>CD</size>EF', legacy = false) {
  const canvas = document.createElement('canvas');
  const component = Object.create(RichTextComponent.prototype) as RichTextComponent;
  const transform = new Transform({ position: [10, 20, 0], scale: [-2, 3, 1], size: new Vector2(1, 1) });
  const item = {
    transform, type: spec.ItemType.richtext, isVisible: true, children: [],
    getInstanceId: () => 'rich-resize',
    getComponent: (type: unknown) => type === RichTextComponent ? component : undefined,
    composition: { camera: { getProjectionMatrix: () => new Matrix4(), getViewMatrix: () => new Matrix4() },
      transform: new Transform() },
  } as unknown as VFXItem;

  Object.assign(component, {
    item, text, isDirty: true, canvas, context: canvas.getContext('2d')!, SCALE_FACTOR: 0.11092565,
    textStyle: new TextStyle({ text, fontSize: 20 }),
    textLayout: new RichTextLayout({ text, fontSize: 20, lineHeight: 32, letterSpace: 2, wrapEnabled: true,
      maxTextWidth: 160, maxTextHeight: 64, autoResize: spec.TextSizeMode.fixed,
      textVerticalAlign: spec.TextVerticalAlign.top }),
    richHorizontalAlignStrategy: RichTextStrategyFactory.createHorizontalAlignStrategy(),
    richVerticalAlignStrategy: RichTextStrategyFactory.createVerticalAlignStrategy(),
    getMaxCanvasSize: () => 8192,
    renderToTexture: (width: number, height: number, _flip: boolean, draw: (context: CanvasRenderingContext2D) => void) => {
      canvas.width = width;
      canvas.height = height;
      draw(component.context!);
    },
  });
  component.textLayout.useLegacyRichText = legacy;
  component.ensureLayout();

  return component;
}

function resizeSession (component: RichTextComponent, mode: 'font' | 'width', fixedPointRatio = new Vector3(-0.5, 0.5, 0)) {
  const item = component.item;
  const snapshot = createRichTextResizeSnapshot(component, mode);
  const initialMatrix = item.transform.getWorldMatrix().clone();
  const parentWorldToLocal = (item.transform.getParentMatrix()?.clone() ?? new Matrix4()).setPosition(new Vector3()).invert();
  const frameRatio = mode === 'width' ? getRichTextFrameRatio(component) : { x: 1, y: 1 };
  const localFixedPointRatio = new Vector3(fixedPointRatio.x * frameRatio.x, fixedPointRatio.y * frameRatio.y, 0);
  const fixedPoint = new Vector3(localFixedPointRatio.x * item.transform.size.x, localFixedPointRatio.y * item.transform.size.y, 0)
    .applyMatrix(initialMatrix);

  return {
    item, initialScale: item.transform.scale.clone(), initialPosition: item.transform.position.clone(), parentWorldToLocal,
    geometry: { fixedPoint }, richText: { ...snapshot, initialMatrix, fixedPointRatio: localFixedPointRatio,
      fixedPointFrameRatio: mode === 'width' ? fixedPointRatio : undefined },
  };
}

function applySession (session: unknown, x: number, y = x): void {
  const gizmo = Object.create(ResizeSelectionGizmo.prototype) as {
    applyAnchoredResize: (session: unknown, resize: unknown) => void,
  };

  gizmo.applyAnchoredResize(session, { totalScalar: new Vector3(x, y, 1), totalTranslation: new Vector3() });
}

function expectFixedPoint (session: ReturnType<typeof resizeSession>, x: number, y = x): void {
  const { item, richText, geometry } = session;
  const frameRatio = richText.mode === 'width' ? getRichTextFrameRatio(richText.component) : { x: 1, y: 1 };
  const fixedPointRatio = richText.fixedPointFrameRatio ?? richText.fixedPointRatio;
  const point = new Vector3(
    fixedPointRatio.x * item.transform.size.x * frameRatio.x * (x < 0 ? -1 : 1),
    fixedPointRatio.y * item.transform.size.y * frameRatio.y * (y < 0 ? -1 : 1), 0,
  ).applyMatrix(item.transform.getWorldMatrix());

  expect(point.distance(geometry.fixedPoint)).to.be.lessThan(1e-8);
}

describe('plugin-editor-gizmo/rich-text-resize', () => {
  it('scales nested absolute sizes without changing the snapshot or other attributes', () => {
    const source = '<color=#ff0000><b>A<size=20>B<size=10.5>C</size></size></b></color>';
    const document = new RichTextDocument(source);
    const scaled = new RichTextDocument(document.scaleFontSizes(1.5));

    expect(scaled.text).to.equal('ABC');
    expect(scaled.getFormat(1, 2, 'size')).to.equal('30');
    expect(scaled.getFormat(2, 3, 'size')).to.equal('15.75');
    expect(scaled.getFormat(0, 3, 'color')).to.equal('#ff0000');
    expect(scaled.getFormat(0, 3, 'b')).to.equal('');
    expect(document.getMinimumFontSize(24)).to.equal(10.5);
    expect(document.markup).to.equal(source);
    expect(document.scaleFontSizes(1)).to.equal(source);
  });

  for (const mode of [spec.TextSizeMode.autoWidth, spec.TextSizeMode.autoHeight, spec.TextSizeMode.fixed]) {
    it(`scales all base properties from the original snapshot (size mode=${mode})`, () => {
      const component = createRichText();

      component.setLayoutProperties({ autoResize: mode });
      const snapshot = createRichTextResizeSnapshot(component, 'font');

      for (const ratio of [1.25, 0.75, 1]) {
        applyRichTextResize(snapshot, ratio);
        expect(component.textStyle.fontSize).to.equal(20 * ratio);
        expect(component.textLayout.lineHeight).to.equal(32 * ratio);
        expect(component.textLayout.letterSpace).to.equal(2 * ratio);
        expect(component.textLayout.autoResize).to.equal(mode);
        expect(component.processedTextOptions.map(option => option.fontSize)).to.deep.equal([20 * ratio, 32.5 * ratio, 20 * ratio]);
        expect(component.item.transform.scale.toArray()).to.deep.equal([-2, 3, 1]);
      }
      expect(component.text).to.equal(snapshot.properties.text);
      if (mode === spec.TextSizeMode.fixed) {
        expect([component.textLayout.maxTextWidth, component.textLayout.maxTextHeight]).to.deep.equal([160, 64]);
      }
    });
  }

  for (const mode of [spec.TextSizeMode.autoWidth, spec.TextSizeMode.autoHeight, spec.TextSizeMode.fixed]) {
    it(`changes width and reflows without changing font sizes (size mode=${mode})`, () => {
      const component = createRichText('ABCDEFGHIJKLMN');

      component.setLayoutProperties({ autoResize: mode, wrapEnabled: false });
      const snapshot = createRichTextResizeSnapshot(component, 'width');

      applyRichTextResize(snapshot, 0.25, 1);
      expect(component.textLayout.maxTextWidth).to.equal(Math.max(1, snapshot.frameWidth / 4));
      expect(component.textLayout.wrapEnabled).to.equal(true);
      expect(component.textStyle.fontSize).to.equal(20);
      expect(component.textLayout.lineHeight).to.equal(32);
      expect(component.textLayout.letterSpace).to.equal(2);
      expect(component.text).to.equal(snapshot.properties.text);
      if (mode === spec.TextSizeMode.fixed) {
        expect(component.textLayout.autoResize).to.equal(spec.TextSizeMode.fixed);
        expect(component.textLayout.maxTextHeight).to.equal(64);
      } else {
        expect(component.textLayout.autoResize).to.equal(spec.TextSizeMode.autoHeight);
        expect(component.textLayout.height).to.be.greaterThan(32);
      }
    });
  }

  it('keeps a rotated corner fixed under a scaled parent, clamping and crossing, without calling setScale', () => {
    const component = createRichText('A<size=10>B</size>');
    const transform = component.item.transform;

    transform.parentTransform = new Transform({ position: [2, -3, 0], rotation: [0, 0, 20], scale: [1.5, 0.75, 1] });
    transform.setRotation(0, 0, 35);
    transform.setAnchor(0.2, -0.1);
    const session = resizeSession(component, 'font');
    const setScale = chai.spy.on(transform, 'setScale');

    try {
      for (const [x, y] of [[1.25, 1.25], [0.001, 0.001], [0, 0], [-0.5, 0.5], [-0.75, -0.75], [1, 1]]) {
        applySession(session, x, y);
        expectFixedPoint(session, x, y);
        expect(transform.scale.toArray()).to.deep.equal([-2, 3, 1]);
        expect(component.textStyle.fontSize).to.be.at.least(2);
      }
      expect(setScale).not.to.have.been.called();
    } finally {
      chai.spy.restore(transform);
    }
  });

  it('keeps the opposite edge midpoint fixed when width changes the number of lines', () => {
    const component = createRichText('ABCDEFGHIJKLMN');

    component.setLayoutProperties({ autoResize: spec.TextSizeMode.autoHeight });
    const session = resizeSession(component, 'width', new Vector3(0.5, 0, 0));

    for (const ratio of [0.25, -0.5, 0, 1]) {
      applySession(session, ratio, 1);
      expectFixedPoint(session, ratio, 1);
      expect(component.item.transform.scale.toArray()).to.deep.equal([-2, 3, 1]);
    }
  });

  it('uses the layout frame, rather than the expanded canvas, for rich width handles', () => {
    const component = createRichText('<size=100>W</size>');

    component.textLayout.overflow = spec.TextOverflow.visible;
    component.setLayoutProperties({ maxTextWidth: 40, maxTextHeight: 32, autoResize: spec.TextSizeMode.fixed });
    component.ensureLayout();
    const frameRatio = getRichTextFrameRatio(component);
    const configs = new ConfigManager();
    const owner = {
      getSelection: () => ({ getSelectedPlayerItems: () => [component.item] }),
      getConfigManager: () => configs, getLoadingManager: () => new LoadingManager(),
      getEngine: () => ({ canvas: { parentElement: { offsetWidth: 800, offsetHeight: 600 } } }),
    } as unknown as GizmoOwner;
    const gizmo = new ResizeSelectionGizmo(owner);

    try {
      gizmo.refreshWireframeBySelectedItems();
      const [rightFrameEdge, leftFrameEdge] = gizmo.wireframe.widthScaleEdges;
      const renderedWidth = gizmo.wireframe.edges[1].getCenter().distance(gizmo.wireframe.edges[3].getCenter());
      const frameWidth = rightFrameEdge.getCenter().distance(leftFrameEdge.getCenter());

      expect(frameRatio.x).to.be.lessThan(1);
      expect(frameWidth).to.be.closeTo(renderedWidth * frameRatio.x, 1e-8);
    } finally {
      gizmo.dispose();
    }
  });

  for (const overflow of [spec.TextOverflow.clip, spec.TextOverflow.visible, spec.TextOverflow.display]) {
    it(`keeps the actual frame anchored for overflow=${overflow}`, () => {
      const component = createRichText('A<size=50>B</size>\n\nC');

      component.textLayout.overflow = overflow;
      component.isDirty = true;
      const session = resizeSession(component, 'font');

      applySession(session, 0.375);
      expectFixedPoint(session, 0.375);
      expect(component.textLayout.overflow).to.equal(overflow);
    });
  }

  for (const mode of [spec.TextSizeMode.fixed, spec.TextSizeMode.autoHeight]) {
    for (const overflow of [spec.TextOverflow.clip, spec.TextOverflow.visible, spec.TextOverflow.display]) {
      it(`restores the layout frame and glyphs after width resizing (mode=${mode}, overflow=${overflow})`, () => {
        const component = createRichText('<size=100>W</size>');

        component.textLayout.overflow = overflow;
        component.setLayoutProperties({ maxTextWidth: 40, maxTextHeight: 32, letterSpace: 0, autoResize: mode });
        const original = component.getEditingLayout();
        const pixels = component.canvas.toDataURL();
        const frameWidth = getRichTextFrameWidth(component);
        const session = resizeSession(component, 'width', new Vector3(0.5, 0, 0));

        if (overflow === spec.TextOverflow.visible) { expect(original.width).to.be.greaterThan(40); }
        for (const ratio of [1, 0.7, 1]) {
          applySession(session, ratio, 1);
          expectFixedPoint(session, ratio, 1);
          expect(component.textLayout.maxTextWidth).to.be.closeTo(40 * ratio, 1e-8);
          expect(component.item.transform.scale.toArray()).to.deep.equal([-2, 3, 1]);
          if (ratio === 1) {
            expect(getRichTextFrameWidth(component)).to.be.closeTo(frameWidth, 1e-8);
            expect(component.getEditingLayout()).to.deep.equal(original);
            expect(component.canvas.toDataURL()).to.equal(pixels);
          }
        }
      });
    }
  }

  for (const mode of ['font', 'width'] as const) {
    it(`keeps legacy content, dimensions and pixels unchanged by ${mode} resizing`, () => {
      const component = createRichText('A<size=32.5>B</size>', true);
      const snapshot = createRichTextResizeSnapshot(component, mode);
      const size = component.item.transform.size.clone();
      const dimensions = [component.textLayout.width, component.textLayout.height];
      const pixels = component.canvas.toDataURL();

      for (const ratio of [1.5, 0.5, 1]) {
        applyRichTextResize(snapshot, ratio);
        expect(component.text).to.equal(snapshot.properties.text);
        expect(component.textStyle.fontSize).to.equal(20);
        expect([component.textLayout.width, component.textLayout.height]).to.deep.equal(dimensions);
        expect(component.item.transform.size.toArray()).to.deep.equal(size.toArray());
        expect(component.item.transform.scale.toArray()).to.deep.equal([-2, 3, 1]);
        expect(component.canvas.toDataURL()).to.equal(pixels);
      }
    });
  }

  it('resizes legacy rich text through transform scale without changing its component data', () => {
    const component = createRichText('A<size=32.5>B</size>', true);
    const originalText = component.text;
    const originalSize = component.item.transform.size.clone();
    const originalDimensions = [component.textLayout.width, component.textLayout.height];
    const originalPixels = component.canvas.toDataURL();
    const session = { ...resizeSession(component, 'font'), richText: undefined };

    applySession(session, 1.5, 0.5);

    expect(component.text).to.equal(originalText);
    expect(component.textStyle.fontSize).to.equal(20);
    expect(component.item.transform.size.toArray()).to.deep.equal(originalSize.toArray());
    expect([component.textLayout.width, component.textLayout.height]).to.deep.equal(originalDimensions);
    expect(component.item.transform.scale.toArray()).to.deep.equal([-3, 1.5, 1]);
    expect(component.canvas.toDataURL()).to.equal(originalPixels);
  });

  for (const legacy of [false, true]) {
    it(`exposes supported rich text handles (legacy=${legacy})`, () => {
      const component = createRichText(undefined, legacy);
      const configs = new ConfigManager();
      const owner = {
        getSelection: () => ({ getSelectedPlayerItems: () => [component.item] }),
        getConfigManager: () => configs, getLoadingManager: () => new LoadingManager(),
        getEngine: () => ({ canvas: { parentElement: { offsetWidth: 800, offsetHeight: 600 } } }),
      } as unknown as GizmoOwner;
      const gizmo = new ResizeSelectionGizmo(owner);

      try {
        gizmo.refreshWireframeBySelectedItems();
        expect(gizmo.wireframe.widthScaleAreas).to.have.lengthOf(legacy ? 0 : 2);
        expect(gizmo.wireframe.scaleCorners).to.have.lengthOf(4);
        expect(gizmo.wireframe.anchor.distance(gizmo.wireframe.box.getCenter())).to.be.lessThan(1e-8);
        expect(gizmo.wireframe.activeType).to.equal(TransformType.NULL);
      } finally {
        gizmo.dispose();
      }
    });
  }
});
