import { ShapeComponent, Transform, spec } from '@galacean/effects';
import type { Composition, Player, VFXItem } from '@galacean/effects';
import { shapeConfig } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/builtin-configs';
import type { ShapeConfig } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/types';
import { DemoScene } from '../../../../../demo/src/gizmo-2d/scene';
import type { DemoItem } from '../../../../../demo/src/gizmo-2d/scene';
import { DemoEditor } from '../../../../../demo/src/gizmo-2d/editor';
import type { ShapeDrawingActionEvent } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/geometry';
import { InspectorPanel } from '../../../../../demo/src/gizmo-2d/inspector';
import { restoreTestState } from '../helpers/spies';

const { expect } = chai;

describe('plugin-editor-gizmo/demo-shape-size', () => {
  afterEach(restoreTestState);

  function createHarness (type: spec.ShapePrimitiveType, config: Partial<ShapeConfig> = {}) {
    const shape = { type, width: 2, height: 2, xRadius: 1, yRadius: 1, radius: 1, outerRadius: 1, innerRadius: 0.4 };
    const definition: Record<string, unknown> = { ...shape };
    const component = {
      shape,
      definition,
      fromData: (data: Record<string, unknown>) => {
        Object.assign(shape, data);
        Object.assign(definition, data);
      },
      onApplyAnimationProperties: () => Object.assign(shape, definition),
    };
    const transform = new Transform();
    const item = {
      transform,
      setPosition: (x: number, y: number, z: number) => transform.setPosition(x, y, z),
      getComponent: (requested: unknown) => requested === ShapeComponent ? component : undefined,
    } as unknown as VFXItem;
    const data: DemoItem = { item, name: 'shape', kind: 'Vector' };
    const scene = new DemoScene({} as Player, {} as Composition);

    chai.spy.on(scene, 'getItem', () => data);
    chai.spy.on(scene, 'getShapeConfig', () => ({ ...shapeConfig.defaults, ...config }));
    // 尺寸处理不依赖 DOM；保留真实 Inspector 方法和真实 Transform。
    const panel = Object.assign(Object.create(InspectorPanel.prototype) as InspectorPanel, { scene });
    const setSize = (axis: 'x' | 'y', size: number) => (panel as unknown as {
      setVectorSize: (item: VFXItem, axis: 'x' | 'y', size: number) => boolean,
    }).setVectorSize(item, axis, size);

    return { shape, definition, transform, scene, data, setSize };
  }

  for (const edited of [false, true]) {
    it(`canceling a vector edit restores geometry and preserves the full transform (edited=${edited})`, () => {
      const { scene, data, transform, shape } = createHarness(spec.ShapePrimitiveType.Polygon, { polygonRadius: 0.25 });

      transform.setPosition(10, 20, 3);
      transform.setScale(-2, 3, 1);
      transform.setRotation(0, 0, 37);
      transform.setSize(2, 4);
      transform.setAnchor(0.25, -0.5);
      const beforeShape = { ...shape };
      const beforeMatrix = [...transform.getWorldMatrix().elements];
      const beforeSize = transform.size.toArray();
      const beforeAnchor = transform.anchor.toArray();

      chai.spy.on(scene, 'getItemById', () => data);
      const editor = Object.assign(Object.create(DemoEditor.prototype) as DemoEditor, {
        scene, vectorEditSnapshots: new Map(), settingTool: true,
      }) as unknown as { handleGeometryAction: (phase: string, event: Partial<ShapeDrawingActionEvent>) => void };
      const path = { points: [{ x: 0, y: 0 }, { x: 30, y: 40 }], easingIns: [], easingOuts: [], shapes: [] };
      const edit = { itemId: 'polygon', before: path, path, operations: [] };

      editor.handleGeometryAction('actionstart', { sessionId: 1, phase: 'start', edit });
      if (edited) {
        editor.handleGeometryAction('actionupdate', { sessionId: 1, phase: 'update', edit: { ...edit, operations: [{ kind: 'point', index: 1 }] } });
        expect(shape.type).to.equal(spec.ShapePrimitiveType.Custom);
      }
      editor.handleGeometryAction('actioncommit', { sessionId: 1, phase: 'cancel', canceled: true, edit });
      expect(shape).to.include(beforeShape);
      expect([...transform.getWorldMatrix().elements]).to.deep.equal(beforeMatrix);
      expect(transform.scale.toArray()).to.deep.equal([-2, 3, 1]);
      expect(transform.size.toArray()).to.deep.equal(beforeSize);
      expect(transform.anchor.toArray()).to.deep.equal(beforeAnchor);
    });
  }

  for (const type of [spec.ShapePrimitiveType.Rectangle, spec.ShapePrimitiveType.Ellipse]) {
    for (const scale of [0.001, -0.001]) {
      it(`round-trips Inspector dimensions at small scale ${scale}, type ${type}`, () => {
        const { scene, data, transform, setSize } = createHarness(type);

        transform.setScale(scale, 2, 1);
        setSize('x', 1);
        expect(scene.readVectorGeometry(data)!.width).to.be.closeTo(1, 1e-10);
        expect(scene.readVectorGeometry(data)!.height).to.equal(4);
        expect(transform.scale.x).to.equal(scale);
      });
    }
  }

  it('preserves intentional zero scale without writing invalid dimensions', () => {
    const { shape, transform, setSize, scene, data } = createHarness(spec.ShapePrimitiveType.Rectangle);

    transform.setScale(0, 1, 1);
    setSize('x', 1);
    expect(shape.width).to.equal(2);
    expect(transform.scale.x).to.equal(0);
    expect(scene.readVectorGeometry(data)!.width).to.equal(0);
  });

  for (const type of [spec.ShapePrimitiveType.Polygon, spec.ShapePrimitiveType.Star]) {
    it(`edits independent dimensions while preserving radius proportions, type ${type}`, () => {
      const { scene, data, transform, shape, definition, setSize } = createHarness(type);

      transform.setScale(-2, 3, 1);
      setSize('x', 8);
      expect(scene.readVectorGeometry(data)).to.include({ width: 8, height: 6 });
      setSize('y', 3);
      expect(scene.readVectorGeometry(data)).to.include({ width: 8, height: 3 });
      expect(transform.scale.x).to.be.lessThan(0);
      if (type === spec.ShapePrimitiveType.Star) {
        expect(shape.innerRadius / shape.outerRadius).to.be.closeTo(0.4, 1e-10);
        expect(definition.outerRadius).to.equal(shape.outerRadius);
        expect(definition.innerRadius).to.equal(shape.innerRadius);
      } else {
        expect(definition.radius).to.equal(shape.radius);
      }
    });
  }

  for (const shapeType of ['polygon', 'star', 'rect', 'ellipse'] as const) {
    it(`preserves ${shapeType} dimensions across repeated snapshot restoration`, () => {
      const { scene, data, transform } = createHarness(spec.ShapePrimitiveType.Rectangle, { polygonRadius: 0.25, starOuterRadius: 0.75 });
      let snapshot = { shapeType, center: { x: 20, y: 30 }, width: 2, height: 5 };

      for (let i = 0; i < 4; i++) {
        scene.updateVectorShape(data, snapshot);
        snapshot = scene.readVectorGeometry(data)!;
        expect(snapshot).to.deep.equal({ shapeType, center: { x: 20, y: 30 }, width: 2, height: 5 });
      }
      if (shapeType === 'rect' || shapeType === 'ellipse') {
        expect(transform.scale.toArray()).to.deep.equal([1, 1, 1]);
      }
    });
  }

  it('keeps finite scale when the configured base radius is zero', () => {
    const { scene, data, transform } = createHarness(spec.ShapePrimitiveType.Polygon, { polygonRadius: 0 });

    scene.updateVectorShape(data, { shapeType: 'polygon', center: { x: 0, y: 0 }, width: 2, height: 5 });
    expect(transform.scale.toArray().every(Number.isFinite)).to.equal(true);
  });
});
