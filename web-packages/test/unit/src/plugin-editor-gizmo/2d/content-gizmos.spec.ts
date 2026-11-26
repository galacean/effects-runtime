import {
  Composition,
  CompositionComponent,
  FrameComponent,
  Geometry,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  MouseButton,
  MouseButtonMask,
  Player,
  ShapeComponent,
  SpriteComponent,
  TimelineAsset,
  TransformPlayableAsset,
  TransformTrack,
  VertexElementType,
  math,
  spec,
  type VFXItem,
} from '@galacean/effects';
import { FFDComponent } from '@galacean/effects-plugin-ffd';
import type { Control } from '@galacean/effects-plugin-gui';
import type { GizmoViewport } from '../../../../../../plugin-packages/editor-gizmo/src/2d/viewport/gizmo-viewport';
import {
  ClickDragMultiplexGizmo,
  CornerRotationGizmo,
  CrystalLatticeGizmo,
  CurveGizmo,
  SelectionEditMode,
  DefaultSelectionMode,
  DefaultVFXItems,
  EffectsEditMode,
  GestureCursorType,
  GestureHandler,
  GizmoTool,
  GradientGizmo,
  GradientEditMode,
  LatticeEditMode,
  MoveGizmoTool,
  MoveSelectionGizmo,
  ResizeSelectionGizmo,
  TransformType,
  registerItemGeometry,
  getCustomItemGeometry,
  getItemViewBox,
  TransformHandlesGizmo,
  transformHandlesConfig,
  curveConfig,
  gradientConfig,
  crystalLatticeConfig,
  ffdWireframeConfig,
  selectionSnapConfig,
  captureMotionPaths,
  getGradientPaint,
  getShapeRenderBounds,
  setColorPaint,
  setGradientPaint,
  setMotionPath,
  getTransformedBoxCorners,
  inverseTransformBoxPoint,
  transformBoxPoint,
  findMotionPaths,
  updateMotionPathTranslation,
  GizmoType,
  FFDWireframeGizmo,
  type GradientSelectionEvent,
} from '../../../../../../plugin-packages/editor-gizmo/src/2d';
import { moveAnchor } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/transform-handles-gizmo';
import { sampleGradient } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/gradient-gizmo';
import { wireframeTriangles } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/ffd-wireframe-gizmo';
import {
  localToView,
  viewToLocal,
} from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/content-edit-utils';
import { createGizmoReference } from '../../../../../demo/src/gizmo-2d/reference-examples';
import { DemoEditor } from '../../../../../demo/src/gizmo-2d/editor';
import { DemoScene } from '../../../../../demo/src/gizmo-2d/scene';

const { expect } = chai;
const { Vector2, Vector3 } = math;

describe('plugin-editor-gizmo/content-gizmos', () => {
  let player: Player;
  let container: HTMLDivElement;
  let composition: Composition;
  let handler: GestureHandler;
  let actions: { phase: string, canceled?: boolean, keyframeTime?: number }[];

  before(() => {
    container = document.createElement('div');
    Object.assign(container.style, { width: '800px', height: '600px' });
    document.body.appendChild(container);
    player = new Player({ container, manualRender: true, env: 'editor' });
  });
  beforeEach(() => {
    composition = new Composition(player.engine);
    composition.camera.position = new Vector3(0, 0, 12);
    composition.camera.fov = 45;
    handler = new GestureHandler(player.engine);
    actions = [];
    handler.setActiveEditMode(new SelectionEditMode(handler));
    for (const phase of ['actionstart', 'actionupdate', 'actioncommit'] as const) {
      handler.on(phase, event => actions.push({
        phase,
        canceled: event.canceled,
        keyframeTime: 'keyframeTime' in event ? event.keyframeTime : undefined,
      }));
    }
  });
  afterEach(() => {
    handler.dispose();
    player.destroyCurrentCompositions();
  });
  after(() => {
    player.dispose();
    container.remove();
  });

  function select (...items: VFXItem[]): void {
    handler.getSelection().commitSelectedItems(items.map(item => item.getInstanceId()));
  }

  function recordDrawing () {
    const calls: { kind: string, coords: number[], color?: number[], width?: number, text?: string }[] = [];
    const record = (kind: string, coords: number[], color?: math.Color, width?: number, text?: string) => {
      calls.push({ kind, coords, color: color?.toArray(), width, text });
    };
    const control: Pick<Control, 'drawLine' | 'drawPolyline' | 'drawTriangle' | 'drawRect'
    | 'drawCircle' | 'fillCircle' | 'fillTriangle' | 'fillRect' | 'drawText' | 'measureText'> = {
      drawLine: (x, y, endX, endY, color, width) => record('line', [x, y, endX, endY], color, width),
      drawPolyline: (points, color, width) => record('polyline', points, color, width),
      drawTriangle: (x, y, bx, by, cx, cy, color, width) => record('triangle', [x, y, bx, by, cx, cy], color, width),
      drawRect: (x, y, w, h, color, width) => record('rect', [x, y, w, h], color, width),
      drawCircle: (x, y, radius, color, width) => record('circle', [x, y, radius], color, width),
      fillCircle: (x, y, radius, color) => record('fillCircle', [x, y, radius], color),
      fillTriangle: (x, y, bx, by, cx, cy, color) => record('fillTriangle', [x, y, bx, by, cx, cy], color),
      fillRect: (x, y, w, h, color) => record('fillRect', [x, y, w, h], color),
      drawText: (x, y, text, fontSize, color) => record('text', [x, y, fontSize], color, undefined, text),
      measureText: (text, fontSize) => player.engine.renderingServer.graphics.measureText(text, fontSize),
    };

    return { calls, control: control as Control };
  }
  function down (point: math.Vector2, modifiers: Partial<InputEventMouseButton> = {}): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.copyFrom(point);
    event.buttonIndex = MouseButton.Left;
    event.buttonMask = MouseButtonMask.Left;
    event.pressed = true;

    return Object.assign(event, modifiers);
  }
  function drag (point: math.Vector2, shift = false, alt = false): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.copyFrom(point);
    event.buttonMask = MouseButtonMask.Left;
    event.pressed = true;
    event.shiftPressed = shift;
    event.altPressed = alt;

    return event;
  }
  function key (keycode = 'Escape', modifiers: Partial<InputEventKey> = {}): InputEventKey {
    const event = new InputEventKey();

    event.keycode = keycode;
    event.physicalKeycode = keycode;

    return Object.assign(event, modifiers);
  }
  function sprite (): VFXItem {
    const item = DefaultVFXItems.createSprite(composition);

    item.getComponent(SpriteComponent).setTexture(player.engine.assetServer.whiteTexture);
    select(item);

    return item;
  }
  function lattice () {
    const item = sprite();
    const component = item.addComponent(FFDComponent);
    const points = Array.from({ length: 6 }, (_, i) => new Vector3(i % 3 - 1, Math.floor(i / 3) - 0.5, 0));

    component.fromData({
      id: component.getInstanceId(),
      dataType: spec.DataType.FFDComponent,
      item: { id: item.getInstanceId() },
      rowNum: 2,
      colNum: 3,
      boundMin: new Vector3(-1, -0.5, 0),
      boundMax: new Vector3(1, 0.5, 0),
      controlPoints: points,
    });

    return { item, component, points, gizmo: new CrystalLatticeGizmo(handler, item) };
  }
  function gradient (type: spec.FillType = spec.FillType.GradientLinear, strokeWidth = 0) {
    const item = DefaultVFXItems.createShapeItem(composition);
    const component = item.getComponent(ShapeComponent);

    const data = { type: spec.ShapePrimitiveType.Rectangle, width: 4, height: 2, roundness: 0,
      fills: [{ type, startPoint: { x: 0.2, y: 0.5 }, endPoint: { x: 0.8, y: 0.5 },
        gradientStops: [spec.ValueType.GRADIENT_COLOR, [[0, 1, 0, 0, 1], [1, 0, 0, 1, 1]]] }],
      strokes: strokeWidth ? [{ type: spec.FillType.Solid, color: { r: 0, g: 0, b: 0, a: 1 } }] : [], strokeWidth,
      renderer: { renderMode: spec.RenderMode.MESH } } as unknown as spec.ShapeComponentData;

    component.fromData(data);
    component.onUpdate(0);
    select(item);

    return { item, component, data, gizmo: new GradientGizmo(handler, item) };
  }
  function path () {
    const item = sprite();
    const component = composition.sceneRoot.getComponent(CompositionComponent);
    const timeline = new TimelineAsset(player.engine);
    const track = new TransformTrack(player.engine);
    const clip = track.createClip(TransformPlayableAsset);

    timeline.tracks.push(track);
    clip.fromData({
      id: clip.getInstanceId(),
      dataType: spec.DataType.TransformPlayableAsset,
      start: 2,
      duration: 4,
      endBehavior: spec.EndBehavior.freeze,
      positionOverLifetime: {
        path: [spec.ValueType.BEZIER_CURVE_PATH, [
          [
            [spec.BezierKeyframeType.LINE, [0, 0]],
            [spec.BezierKeyframeType.LINE, [0.5, 0.5]],
            [spec.BezierKeyframeType.LINE, [1, 1]],
          ],
          [[-2, 0, 0], [0, 1, 0], [2, 0, 0]], [[-1.5, 1, 0], [-0.5, 1, 0], [0.5, 1, 0], [1.5, 1, 0]],
        ]],
      },
    });
    component.fromData({
      id: component.getInstanceId(),
      dataType: spec.DataType.CompositionComponent,
      item: {
        id: composition.sceneRoot.getInstanceId(),
      },
      sceneBindings: [],
      timelineAsset: {
        id: timeline.getInstanceId(),
      },
    });
    component.setBinding(track, item);
    component.sampleTime(3);

    return { item, clip, component, gizmo: new CurveGizmo(handler) };
  }

  it('keeps anchor compensation exact under mirrored, rotated, nonuniform parents', () => {
    const item = sprite();
    const parent = DefaultVFXItems.createEmpty(composition);

    parent.transform.setScale(-2, 3, 1);
    parent.transform.setRotation(15, 10, 35);
    item.setParent(parent);
    item.transform.setScale(1.7, -0.8, 1);
    item.transform.setRotation(7, 20, 60);
    item.transform.setAnchor(0.2, -0.1);
    const before = [...item.transform.getWorldMatrix().elements];

    moveAnchor(item, new Vector3(-0.3, 0.4, 0));
    item.transform.getWorldMatrix().elements.forEach((value, index) => expect(value).closeTo(before[index], 1e-5));
    expect(item.transform.anchor.x).equals(-0.3);
  });

  it('round trips screen points through the transformed local plane', () => {
    const item = sprite();

    item.transform.setRotation(20, 15, 30);
    item.transform.setScale(-2, 0.8, 1);
    const point = new Vector3(0.2, -0.3, 0);
    const back = viewToLocal(item, localToView(item, point))!;

    expect(back.x).closeTo(point.x, 1e-5);
    expect(back.y).closeTo(point.y, 1e-5);
    item.transform.setScale(0, 1, 1);
    expect(viewToLocal(item, new Vector2())).equals(undefined);
  });

  it('reads FFD copies, validates batch writes and preserves a rectangular grid', () => {
    const { component } = lattice();
    const data = component.getLattice();

    data.points[0].x = 99;
    expect(component.getLattice().points[0].x).equals(-1);
    expect([data.rows, data.columns]).deep.equals([2, 3]);
    expect(() => component.setControlPoints([])).throws();
  });

  it('moves a lattice group with Shift and rolls back without a later commit', () => {
    const { item, component, points, gizmo } = lattice();
    const start = localToView(item, points[0]);

    gizmo.selected.add(0);
    gizmo.selected.add(1);
    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 12)), true));
    const moved = component.getLattice().points;

    expect(moved[0].x).greaterThan(points[0].x);
    expect(moved[0].y).closeTo(points[0].y, 1e-5);
    expect(moved[1].x - points[1].x).closeTo(moved[0].x - points[0].x, 1e-5);
    gizmo.onKeyDown(key());
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(100, 50))));
    gizmo.onMouseUp(down(start));
    expect(component.getLattice().points.map(point =>
      point.toArray())).deep.equals(points.map(point =>
      point.toArray()));
    expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
    expect(actions.at(-1)?.canceled).equals(true);
    expect(Array.from(gizmo.selected)).deep.equals([0, 1]);
  });

  it('uses row-major non-square lattice edges', () => {
    const { item, points, gizmo } = lattice();
    const lines: number[][] = [];

    gizmo.draw({ drawLine: (...args: number[]) => lines.push(args.slice(0, 4)), fillCircle: () => {} } as never);
    expect(lines).length(7);
    const a = localToView(item, points[0]);
    const b = localToView(item, points[3]);

    expect(lines.some(line => line[0] === a.x && line[1] === a.y && line[2] === b.x && line[3] === b.y)).equals(true);
  });

  it('toggles with Shift, subtracts with Ctrl/Command and force-adds with Shift+Ctrl', () => {
    const { item, points, gizmo } = lattice();
    const click = (index: number, modifiers: Partial<InputEventMouseButton> = {}) => {
      const position = localToView(item, points[index]);

      gizmo.onMouseDown(down(position, modifiers));
      gizmo.onMouseUp(down(position));
    };

    click(0);
    click(1, { shiftPressed: true });
    expect(Array.from(gizmo.selected)).deep.equals([0, 1]);
    click(0, { shiftPressed: true });
    expect(Array.from(gizmo.selected)).deep.equals([1]);
    click(2, { ctrlPressed: true });
    expect(Array.from(gizmo.selected)).deep.equals([1]);
    click(1, { ctrlPressed: true });
    expect(gizmo.selected.size).equals(0);
    click(0, { ctrlPressed: true, shiftPressed: true });
    click(0, { ctrlPressed: true, shiftPressed: true });
    click(1, { metaPressed: true, shiftPressed: true });
    expect(Array.from(gizmo.selected)).deep.equals([0, 1]);
    click(0, { metaPressed: true });
    expect(Array.from(gizmo.selected)).deep.equals([1]);
    expect(actions).length(0);
  });

  for (const [modifiers, expected] of [
    [{}, [0, 1]], [{ shiftPressed: true }, [0, 1, 2, 5]],
    [{ ctrlPressed: true }, [2, 5]], [{ shiftPressed: true, ctrlPressed: true }, [0, 1, 2, 5]],
  ] as [Partial<InputEventMouseButton>, number[]][]) {
    it(`combines marquee with the original selection and includes its boundary (${JSON.stringify(modifiers)})`, () => {
      const { item, points, gizmo } = lattice();
      const views = points.map(point => localToView(item, point));
      const start = views[0].clone().add(new Vector2(-32, 32)); // 从四角旋转热区外开始框选。

      [0, 2, 5].forEach(index => gizmo.selected.add(index));
      gizmo.onMouseDown(down(start, modifiers));
      gizmo.onMouseDrag(drag(views[1]));
      expect(Array.from(gizmo.selected).sort()).deep.equals(expected);
      gizmo.onMouseDrag(drag(views[0]));
      expect(gizmo.selected.has(1)).equals(false);
      expect(gizmo.selected.has(2)).equals(!!(modifiers.shiftPressed || modifiers.ctrlPressed));
      gizmo.onKeyDown(key());
      expect(Array.from(gizmo.selected)).deep.equals([0, 2, 5]);
      expect(actions).length(0);
    });
  }

  it('distinguishes Shift-click from Shift-drag and keeps the chosen dominant axis', () => {
    const { item, component, points, gizmo } = lattice();
    const start = localToView(item, points[0]);

    gizmo.selected.add(0);
    gizmo.selected.add(1);
    gizmo.onMouseDown(down(start, { shiftPressed: true }));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(24, 8)), true, true));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(25, 80)), true, true));
    gizmo.onMouseUp(down(start));
    expect(Array.from(gizmo.selected)).deep.equals([0, 1]);
    expect(localToView(item, component.getLattice().points[0]).y).closeTo(start.y, 1e-5);
    expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
  });

  it('never turns a subtract click into a drag of the remaining selection', () => {
    const { item, component, points, gizmo } = lattice();
    const start = localToView(item, points[0]);

    gizmo.selected.add(0);
    gizmo.selected.add(1);
    gizmo.onMouseDown(down(start, { ctrlPressed: true }));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 20))));
    gizmo.onMouseUp(down(start));
    expect(Array.from(gizmo.selected)).deep.equals([1]);
    expect(component.getLattice().points.map(p => p.toArray())).deep.equals(points.map(p => p.toArray()));
    expect(actions).length(0);
  });

  it('chooses the nearest overlapping point and ignores click jitter', () => {
    const { item, component, points, gizmo } = lattice();

    points[1].copyFrom(points[0]).add(new Vector3(0.02, 0, 0));
    component.setControlPoints(points);
    const start = localToView(item, points[1]);

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(1, 1))));
    gizmo.onMouseUp(down(start));
    expect(Array.from(gizmo.selected)).deep.equals([1]);
    expect(actions).length(0);
    expect(component.getLattice().points.map(p => p.toArray())).deep.equals(points.map(p => p.toArray()));
  });

  it('discards an empty transform when a group returns to its original points', () => {
    const { item, component, points, gizmo } = lattice();
    const start = localToView(item, points[0]);

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 20)), false, true));
    gizmo.onMouseDrag(drag(start, false, true));
    gizmo.onMouseUp(down(start));
    component.getLattice().points.forEach((p, i) => expect(p.distance(points[i])).lessThan(1e-6));
    expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
    expect(actions.at(-1)?.canceled).equals(true);
  });

  it('nudges in screen pixels under rotated, mirrored parents and commits once per key sequence', () => {
    const { item, component, points, gizmo } = lattice();
    const parent = DefaultVFXItems.createEmpty(composition);

    parent.transform.setScale(-2, 3, 1);
    parent.transform.setRotation(0, 0, 30);
    item.setParent(parent);
    const start = localToView(item, points[0]);
    const transform = Array.from(item.transform.getWorldMatrix().elements);

    gizmo.selected.add(0);
    gizmo.selected.add(1);
    gizmo.onKeyDown(key('ArrowRight'));
    gizmo.onKeyDown(key('ArrowRight', { echo: true }));
    gizmo.onKeyDown(key('ArrowUp', { shiftPressed: true }));
    const end = localToView(item, component.getLattice().points[0]);

    expect(end.x - start.x).closeTo(2, 1e-5);
    expect(end.y - start.y).closeTo(-10, 1e-5);
    expect(component.getLattice().points[0].z).equals(points[0].z);
    expect(Array.from(item.transform.getWorldMatrix().elements)).deep.equals(transform);
    gizmo.onKeyUp(key('ArrowRight'));
    expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
    gizmo.onKeyUp(key('ArrowUp'));
    expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
    expect(actions.filter(action => action.phase === 'actionstart')).length(1);
  });

  it('rolls back key repeats on Escape and waits for release before restarting', () => {
    const { component, points, gizmo } = lattice();

    gizmo.selected.add(0);
    gizmo.onKeyDown(key('ArrowRight'));
    gizmo.onKeyDown(key());
    gizmo.onKeyDown(key('ArrowRight', { echo: true }));
    expect(component.getLattice().points[0].toArray()).deep.equals(points[0].toArray());
    gizmo.onKeyUp(key('ArrowRight'));
    gizmo.onKeyDown(key('ArrowRight'));
    gizmo.onKeyUp(key('ArrowRight'));
    expect(component.getLattice().points[0].x).greaterThan(points[0].x);
    expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
  });

  it('switches explicit drag axes without a jump and ignores repeated axis keys', () => {
    const { item, component, points, gizmo } = lattice();
    const start = localToView(item, points[0]);
    const first = start.clone().add(new Vector2(20, 12));

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(first, false, true));
    gizmo.onKeyDown(key('x'));
    gizmo.onKeyDown(key('x', { echo: true }));
    gizmo.onMouseDrag(drag(first, false, true));
    gizmo.onMouseDrag(drag(first.clone().add(new Vector2(30, 40)), false, true));
    let end = localToView(item, component.getLattice().points[0]);

    expect(end.x - start.x).closeTo(50, 1e-5);
    expect(end.y - start.y).closeTo(12, 1e-5);
    gizmo.onKeyDown(key('y'));
    gizmo.onMouseDrag(drag(first.clone().add(new Vector2(30, 40)), false, true));
    gizmo.onMouseDrag(drag(first.clone().add(new Vector2(80, 50)), false, true));
    end = localToView(item, component.getLattice().points[0]);
    expect(end.x - start.x).closeTo(50, 1e-5);
    expect(end.y - start.y).closeTo(22, 1e-5);
    gizmo.onKeyDown(key());
  });

  it('freezes soft weights, keeps points outside the radius fixed and restores radius on cancel', () => {
    const { item, component, points, gizmo } = lattice();
    const start = localToView(item, points[0]);
    const neighbor = localToView(item, points[1]);
    const radius = 200 / Math.sqrt(5); // 局部半径 2；相邻点距离 1，权重应为 0.5。

    gizmo.setSoftSelection(true, radius);
    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(20, 0)), false, true));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(40, 0)), false, true));
    expect(localToView(item, component.getLattice().points[1]).x - neighbor.x).closeTo(20, 1e-5);
    expect(component.getLattice().points[2].toArray()).deep.equals(points[2].toArray());
    gizmo.onKeyDown(key(']', { physicalKeycode: 'BracketRight' }));
    expect(gizmo.softRadius).greaterThan(radius);
    expect(component.getLattice().points[2].x).greaterThan(points[2].x);
    gizmo.onKeyDown(key());
    expect(gizmo.softRadius).equals(radius);
    expect(component.getLattice().points.map(p => p.toArray())).deep.equals(points.map(p => p.toArray()));
  });

  function latticeHandles (gizmo: CrystalLatticeGizmo) {
    const corners: math.Vector2[] = [];

    gizmo.draw({
      drawLine: () => {},
      drawRect: () => {},
      drawPolyline: () => {},
      fillCircle: () => {},
      drawCircle: () => {},
      fillRect: (x: number, y: number, width: number) => {
        if (width === 8) {
          corners.push(new Vector2(x + 4, y + 4));
        }
      },
    } as never);

    return { corner: corners[0], corners, center: corners[0].clone().add(corners[2]).multiply(0.5) };
  }

  it('scales collinear selected points together and applies soft influence once', () => {
    const { component, points, gizmo, item } = lattice();
    const transform = Array.from(item.transform.getWorldMatrix().elements);

    gizmo.selected.add(0);
    gizmo.selected.add(1);
    gizmo.setSoftSelection(true, 200 / Math.sqrt(5));
    const { corner, center } = latticeHandles(gizmo);

    gizmo.onMouseDown(down(corner));
    gizmo.onMouseDrag(drag(corner.clone().subtract(center).multiply(2).add(center)));
    const result = component.getLattice().points;

    expect(result[0].x).closeTo(-1.5, 1e-5);
    expect(result[1].x).closeTo(0.5, 1e-5);
    expect(result[2].x).closeTo(1.75, 1e-5);
    expect(result[0].y).closeTo(-0.5, 1e-5);
    expect(Array.from(item.transform.getWorldMatrix().elements)).deep.equals(transform);
    gizmo.onKeyDown(key());
    expect(component.getLattice().points.map(p => p.toArray())).deep.equals(points.map(p => p.toArray()));
  });

  it('separates lattice corner scaling, exterior rotation and empty-space selection', () => {
    const { component, points, gizmo } = lattice();
    let cursor: GestureCursorType | undefined;

    handler.setCursor = result => {
      cursor = result.type;
    };
    gizmo.selected.add(0);
    gizmo.selected.add(2);
    const { corners, center } = latticeHandles(gizmo);

    for (const corner of corners) {
      const outward = new Vector2(Math.sign(corner.x - center.x), Math.sign(corner.y - center.y));
      const rotation = corner.clone().add(outward.clone().multiply(9));

      gizmo.onMouseMove(drag(corner));
      expect(cursor).equals(GestureCursorType.SCALE);
      gizmo.onMouseMove(drag(rotation));
      expect(cursor).equals(GestureCursorType.ROTATION);
      gizmo.onMouseMove(drag(rotation, true));
      expect(cursor).equals(GestureCursorType.BOX_SELECT);
      gizmo.onMouseMove(drag(corner.clone().subtract(outward.clone().multiply(8))));
      expect(cursor).equals(GestureCursorType.BOX_SELECT);
      gizmo.onMouseMove(drag(corner.clone().add(outward.multiply(16))));
      expect(cursor).equals(GestureCursorType.BOX_SELECT);
    }
    const oldRotation = new Vector2(center.x, corners[0].y - 24);

    gizmo.onMouseMove(drag(oldRotation));
    expect(cursor).equals(GestureCursorType.BOX_SELECT);
    gizmo.onMouseDown(down(oldRotation));
    gizmo.onMouseDrag(drag(oldRotation.clone().add(new Vector2(30, 0))));
    gizmo.onMouseUp(down(oldRotation));
    expect(component.getLattice().points.map(point =>
      point.toArray())).deep.equals(points.map(point =>
      point.toArray()));
    expect(actions).length(0);
  });

  for (const cornerIndex of [0, 1, 2, 3]) {
    it(`rotates a selected pair from corner ${cornerIndex} with 15 degree snapping`, () => {
      const { component, points, gizmo } = lattice();

      gizmo.selected.add(0);
      gizmo.selected.add(2);
      const { corners, center } = latticeHandles(gizmo);
      const corner = corners[cornerIndex];
      const start = corner.clone().add(new Vector2(
        Math.sign(corner.x - center.x) * 9,
        Math.sign(corner.y - center.y) * 9
      ));
      const offset = start.clone().subtract(center);
      const angle = 37 * Math.PI / 180;
      const end = center.clone().add(new Vector2(
        offset.x * Math.cos(angle) - offset.y * Math.sin(angle),
        offset.x * Math.sin(angle) + offset.y * Math.cos(angle)
      ));

      gizmo.onMouseDown(down(start));
      gizmo.onMouseDrag(drag(end, true));
      gizmo.onMouseUp(down(end));
      const result = component.getLattice().points;

      expect(result[0].x).closeTo(-Math.sqrt(3) / 2, 1e-5);
      expect(result[0].y).closeTo(0, 1e-5);
      expect(result[2].x).closeTo(Math.sqrt(3) / 2, 1e-5);
      expect(result[2].y).closeTo(-1, 1e-5);
      expect(result[1].toArray()).deep.equals(points[1].toArray());
      expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
    });
  }

  it('cancels a lattice edit when the view changes and does not overwrite replacement topology', () => {
    const { component, points, item, gizmo } = lattice();
    const start = localToView(item, points[0]);

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 0)), false, true));
    composition.camera.fov = 50;
    gizmo.onUpdate();
    expect(component.getLattice().points.map(p => p.toArray())).deep.equals(points.map(p => p.toArray()));
    gizmo.onMouseDown(down(localToView(item, points[0])));
    component.fromData({
      id: component.getInstanceId(),
      dataType: spec.DataType.FFDComponent,
      item: { id: item.getInstanceId() },
      rowNum: 2,
      colNum: 2,
      boundMin: new Vector3(-1, -1, 0),
      boundMax: new Vector3(1, 1, 0),
      controlPoints: points.slice(0, 4),
    });
    gizmo.onUpdate();
    expect(component.getLattice().points).length(4);
    expect(gizmo.selected.size).equals(0);
  });

  for (const change of ['topology', 'component', 'view']) {
    it(`cancels without writing stale lattice points when actionstart changes the ${change}`, () => {
      const { item, component, points, gizmo } = lattice();
      const start = localToView(item, points[0]);
      const replacement = Array.from({ length: 9 }, (_, i) => new Vector3(i % 3 - 1, Math.floor(i / 3) - 1, 0));
      let target = component;

      handler.on('actionstart', () => {
        if (change === 'view') {
          composition.camera.fov = 50;

          return;
        }
        if (change === 'component') {
          component.dispose();
          target = item.addComponent(FFDComponent);
        }
        target.fromData({
          id: target.getInstanceId(),
          dataType: spec.DataType.FFDComponent,
          item: { id: item.getInstanceId() },
          rowNum: 3,
          colNum: 3,
          boundMin: new Vector3(-1, -1, 0),
          boundMax: new Vector3(1, 1, 0),
          controlPoints: replacement,
        });
      });
      gizmo.onMouseDown(down(start));
      expect(() => gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 20))))).not.throws();
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(60, 40))));
      gizmo.onMouseUp(down(start));
      expect(target.getLattice().points.map(point =>
        point.toArray())).deep.equals((change === 'view'
        ? points
        : replacement).map(point =>
        point.toArray()));
      expect(actions.filter(action => action.canceled)).length(1);
      expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
      gizmo.dispose();
    });
  }

  it('cancels a lattice edit when the canvas dimensions change', () => {
    const { item, component, points, gizmo } = lattice();
    const start = localToView(item, points[0]);
    const canvas = player.engine.canvas;
    const descriptor = Object.getOwnPropertyDescriptor(canvas, 'clientWidth');

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 20))));
    try {
      Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: canvas.clientWidth + 10 });
      gizmo.onUpdate();
      expect(component.getLattice().points.map(point =>
        point.toArray())).deep.equals(points.map(point =>
        point.toArray()));
      expect(actions.filter(action => action.canceled)).length(1);
    } finally {
      if (descriptor) {
        Object.defineProperty(canvas, 'clientWidth', descriptor);
      } else {
        Reflect.deleteProperty(canvas, 'clientWidth');
      }
      gizmo.dispose();
    }
  });

  it('cancels keyboard nudging when its component is removed before a pointer press', () => {
    const { item, component, points, gizmo } = lattice();
    const start = localToView(item, points[0]);

    gizmo.selected.add(0);
    gizmo.onKeyDown(key('ArrowRight'));
    expect(component.getLattice().points[0].x).greaterThan(points[0].x);
    component.dispose();
    gizmo.onMouseDown(down(start));
    gizmo.onKeyUp(key('ArrowRight'));
    expect(actions.filter(action => action.canceled)).length(1);
    expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
    gizmo.dispose();
  });

  for (const IndexArray of [Uint16Array, Uint32Array]) {
    for (const subMesh of [false, true]) {
      it(`extracts interleaved ${IndexArray.name} triangles using byte offsets (submesh=${subMesh})`, () => {
        const geometry = Geometry.create(player.engine, {
          attributes: { aPos: { size: 3, stride: 16, offset: 4,
            data: new Float32Array([99, 0, 0, 0, 99, 1, 0, 0, 99, 0, 1, 0, 99, 9, 9, 0]) } },
          indices: {
            data: new IndexArray([3, 3, 3, 0, 1, 2, 3, 3, 3]),
          },
          drawStart: subMesh ? 0 : 3 * IndexArray.BYTES_PER_ELEMENT,
          drawCount: subMesh ? 9 : 3,
        });

        if (subMesh) {
          geometry.subMeshes = [{ offset: 3 * IndexArray.BYTES_PER_ELEMENT, indexCount: 3, vertexCount: 4 }];
        }
        expect(wireframeTriangles(geometry).map(triangle =>
          triangle.map(point =>
            point.toArray()))).deep.equals([[[0, 0, 0], [1, 0, 0], [0, 1, 0]]]);
        geometry.dispose();
      });
    }
  }

  for (const subMesh of [false, true]) {
    it(`extracts non-indexed triangles using vertex ranges (submesh=${subMesh})`, () => {
      const geometry = Geometry.create(player.engine, {
        attributes: {
          aPos: {
            size: 2,
            data: new Float32Array([9, 9, 9, 9, 9, 9, 0, 0, 1, 0, 0, 1]),
          },
        },
        drawStart: subMesh ? 0 : 3,
        drawCount: subMesh ? 6 : 3,
      });

      if (subMesh) {
        geometry.subMeshes = [{ offset: 3, vertexCount: 3, indexCount: 0 }];
      }
      expect(wireframeTriangles(geometry).map(triangle =>
        triangle.map(point =>
          point.toArray()))).deep.equals([[[0, 0, 0], [1, 0, 0], [0, 1, 0]]]);
      geometry.dispose();
    });
  }

  it('projects shared wireframe vertices consistently and refreshes geometry and camera changes', () => {
    const { item } = lattice();
    const sprite = item.getComponent(SpriteComponent);
    const original = sprite.geometry;
    const vertices = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
    const indices = [0, 1, 2, 0, 2, 3];
    const geometry = Geometry.create(player.engine, { attributes: { aPos: { size: 3, data: vertices } },
      indices: { data: new Uint16Array(indices) }, drawCount: 6 });
    const gizmo = new FFDWireframeGizmo(handler);

    sprite.geometry = geometry;
    item.transform.size.set(2, 3);
    try {
      for (const updated of [false, true]) {
        if (updated) {
          vertices[0] = -0.5;
          geometry.setAttributeData(VertexElementType.Position, vertices);
          item.transform.setRotation(0, 0, 25);
          composition.camera.fov = 50;
        }
        const triangles: number[][] = [];

        gizmo.draw({ drawTriangle: (...values: number[]) => triangles.push(values.slice(0, 6)) } as never);
        const expected = indices.map(index =>
          localToView(
            item,
            new Vector3(vertices[index * 3] * 2, vertices[index * 3 + 1] * 3, 0)
          ));

        expect(triangles).length(2);
        triangles.flat().forEach((value, index) => expect(value).closeTo(expected.flatMap(point =>
          point.toArray())[index], 1e-5));
      }
    } finally {
      sprite.geometry = original;
      geometry.dispose();
    }
  });

  it('keeps local bounds aligned with UVs after geometry shrinks or becomes empty', () => {
    const { component, data } = gradient(spec.FillType.GradientLinear, 2);
    const box = component.getRenderBounds();

    expect(getShapeRenderBounds(component)!.max.x).closeTo(3, 1e-5);
    expect(box.max.x).closeTo(3, 1e-5);
    expect(component.getBoundingBox().max.x).equals(2);
    component.strokeWidth = 0;
    component.onUpdate(0);
    const bounds = getShapeRenderBounds(component)!;

    component.getRenderBounds(box);
    expect(bounds.min.toArray()).deep.equals([-2, -1]);
    expect(bounds.max.toArray()).deep.equals([2, 1]);
    expect(box.min.toArray()).deep.equals([-2, -1, 0]);
    expect(box.max.toArray()).deep.equals([2, 1, 0]);
    bounds.max.x = 100;
    expect(getShapeRenderBounds(component)!.max.x).equals(2);
    expect(component.getRenderBounds(box).max.x).equals(2);
    component.fromData({ ...data, fills: [], strokes: [] });
    component.onUpdate(0);
    expect(getShapeRenderBounds(component)).equals(undefined);
    expect(component.getRenderBounds(box).isEmpty()).equals(true);
    expect(component.getBoundingBox().isEmpty()).equals(false);
    component.fromData(data);
    component.onUpdate(0);
    expect(getShapeRenderBounds(component)!.max.x).closeTo(3, 1e-5);
    expect(component.getRenderBounds(box).max.x).closeTo(3, 1e-5);
  });

  it('uses solid shape geometry bounds independently of item size and refreshes world bounds after transforms', () => {
    const { component, item } = gradient();

    setColorPaint(component, 'fill', 0, { type: spec.FillType.Solid, color: new math.Color(1, 0, 0, 1) });
    component.onUpdate(0);
    item.transform.size.set(5, 7);
    item.transform.setScale(-2, 3, 1);
    item.setPosition(10, -4, 0);
    const bounds = getShapeRenderBounds(component)!;
    const box = component.getRenderBounds();

    expect(bounds.min.toArray()).deep.equals([-2, -1]);
    expect(bounds.max.toArray()).deep.equals([2, 1]);
    expect(box.min.toArray()).deep.equals([-2, -1, 0]);
    expect(box.max.toArray()).deep.equals([2, 1, 0]);
    box.applyMatrix4(item.transform.getWorldMatrix());
    expect(box.min.toArray()).deep.equals([6, -7, 0]);
    expect(box.max.toArray()).deep.equals([14, -1, 0]);
    item.transform.setRotation(0, 0, 90);
    component.getRenderBounds(box).applyMatrix4(item.transform.getWorldMatrix());
    box.min.toArray().forEach((value, index) => expect(value).closeTo([7, -8, 0][index], 1e-5));
    box.max.toArray().forEach((value, index) => expect(value).closeTo([13, 0, 0][index], 1e-5));
    expect(getShapeRenderBounds(component)!.min.toArray()).deep.equals(bounds.min.toArray());
    expect(getShapeRenderBounds(component)!.max.toArray()).deep.equals(bounds.max.toArray());
  });

  it('normalizes negative local shape coordinates to the same UV range as centered geometry', () => {
    const { component, data, item } = gradient();
    const readUVRange = () => {
      const geometry = (component as unknown as { geometry: Geometry }).geometry;
      const uv = geometry.getAttributeData(VertexElementType.TexCoord0)!;
      const indices = Array.from(geometry.getIndexData()).slice(0, geometry.getDrawCount());
      const u = indices.map(index => uv[index * 2]);
      const v = indices.map(index => uv[index * 2 + 1]);

      return [Math.min(...u), Math.max(...u), Math.min(...v), Math.max(...v)];
    };
    const original = readUVRange();

    expect(original).deep.equals([0, 1, 0, 1]);
    component.fromData({
      ...data,
      transform: {
        position: {
          x: -5,
          y: -4,
          z: 0,
        },
        eulerHint: {
          x: 0,
          y: 0,
          z: 0,
        },
        scale: {
          x: 1,
          y: 1,
          z: 1,
        },
      },
    });
    component.onUpdate(0);
    expect(getShapeRenderBounds(component)!.min.toArray()).deep.equals([-7, -5]);
    expect(getShapeRenderBounds(component)!.max.toArray()).deep.equals([-3, -3]);
    expect(readUVRange()).deep.equals(original);
    item.setPosition(-10, -10, 0);
    component.onUpdate(0);
    expect(readUVRange()).deep.equals(original);
  });

  for (const invalid of ['color', 'endpoint', 'duplicate-stop', 'too-many-stops', 'too-few-stops']) {
    it(`rejects ${invalid} gradient data consistently at edit entry and component write`, () => {
      const { component, data, item, gizmo } = gradient();
      const stops = invalid === 'too-many-stops' ? Array.from({ length: 9 }, (_, index) => [index / 8, 1, 0, 0, 1])
        : [[0, invalid === 'color' ? Infinity : 1, 0, 0, 1], [invalid === 'duplicate-stop' ? 0 : 1, 0, 0, 1, 1]];

      if (invalid === 'too-few-stops') {
        stops.pop();
      }
      component.fromData({ ...data, fills: [{ type: spec.FillType.GradientLinear,
        startPoint: { x: 0.2, y: 0.5 }, endPoint: { x: invalid === 'endpoint' ? Infinity : 0.8, y: 0.5 },
        gradientStops: [spec.ValueType.GRADIENT_COLOR, stops] }] } as unknown as spec.ShapeComponentData);
      component.onUpdate(0);
      const paint = getGradientPaint(component, 'fill', 0)!;

      expect(() => setGradientPaint(component, 'fill', 0, paint)).throws('Invalid gradient paint.');
      const mode = handler.getActiveEditMode() as SelectionEditMode;

      expect(mode.editContent({ type: 'gradient', paintKind: 'fill', paintIndex: 0 })).equals(false);
      expect(() => gizmo.onMouseDown(down(localToView(item, new Vector3(-1.2, 0, 0))))).not.throws();
      expect(actions).length(0);
    });
  }

  it('copies submitted paint and leaves the previous paint intact when validation fails', () => {
    const { component } = gradient();
    const paint = getGradientPaint(component, 'fill', 0)!;

    paint.startPoint.x = 0.3;
    setGradientPaint(component, 'fill', 0, paint);
    paint.startPoint.x = 0.4;
    paint.gradientStops.stops[0].color.g = 0.8;
    const saved = getGradientPaint(component, 'fill', 0)!;

    expect(saved.startPoint.x).equals(0.3);
    expect(saved.gradientStops.stops[0].color.g).equals(0);
    paint.gradientStops.stops[1].time = paint.gradientStops.stops[0].time;
    expect(() => setColorPaint(component, 'fill', 0, paint)).throws();
    expect(getGradientPaint(component, 'fill', 0)).deep.equals(saved);
  });

  it('refreshes only the edited paint material through the generic runtime setter', () => {
    const { component } = gradient(spec.FillType.GradientLinear, 2);
    const fillMaterial = component.materials[0];
    const strokeMaterial = component.materials[1];
    const stroke = component.getPaint('stroke', 0);
    const bounds = component.getRenderBounds();
    const paint = { type: spec.FillType.Solid, color: new math.Color(0.2, 0.4, 0.6, 1) } as const;

    component.setPaint('fill', 0, paint);
    component.onUpdate(0);
    expect(component.getPaint('fill', 0)).equals(paint);
    expect(component.materials).deep.equals([fillMaterial, strokeMaterial]);
    expect(fillMaterial.getFloat('_FillType')).equals(spec.FillType.Solid);
    expect(fillMaterial.color.toArray()).deep.equals(paint.color.toArray());
    expect(component.getPaint('stroke', 0)).equals(stroke);
    expect(component.getRenderBounds()).deep.equals(bounds);
    for (const index of [-1, 0.5, 1, NaN]) {
      expect(() => component.setPaint('fill', index, paint)).throws('The selected paint does not exist.');
    }
    expect(component.getPaint('fill', 0)).equals(paint);
  });

  it('matches renderer smoothstep instead of linear gradient interpolation', () => {
    const { component } = gradient();
    const paint = getGradientPaint(component, 'fill', 0)!;
    const color = sampleGradient(paint, 0.25);

    expect(color.b).closeTo(0.15625, 1e-6);
    paint.startPoint.x = 9;
    expect(getGradientPaint(component, 'fill', 0)!.startPoint.x).equals(0.2);
  });

  for (const type of [spec.FillType.GradientLinear, spec.FillType.GradientRadial, spec.FillType.GradientAngular]) {
    it(`rolls back gradient endpoints and ignores subsequent drag/up (${type})`, () => {
      const { component, item, gizmo } = gradient(type);
      const start = localToView(item, new Vector3(-1.2, 0, 0));

      gizmo.onMouseDown(down(start));
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(25, 20))));
      expect(getGradientPaint(component, 'fill', 0)!.startPoint.x).not.equals(0.2);
      gizmo.onKeyDown(key());
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(50, 20))));
      gizmo.onMouseUp(down(start));
      expect(getGradientPaint(component, 'fill', 0)!.startPoint.toArray()).deep.equals([0.2, 0.5]);
      expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
    });
  }

  describe('gradient selection events', () => {
    let events: GradientSelectionEvent[];

    beforeEach(() => {
      events = [];
      handler.on('gradientselectionchange', event => events.push(event));
    });

    it('reports programmatic selection with target context and ignores unchanged or invalid selections', () => {
      const { item, gizmo } = gradient();

      gizmo.selectStop(0);
      gizmo.selectStop(0);
      gizmo.selectStop(1);
      for (const index of [1, -1, 2, 0.5, NaN]) {
        gizmo.selectStop(index);
      }
      gizmo.onUpdate();
      expect(events.map(({ index, percentage }) => ({ index, percentage }))).deep.equals([
        { index: 0, percentage: 0 }, { index: 1, percentage: 100 },
      ]);
      expect(events[0]).includes({
        source: gizmo, editType: 'gradient', itemId: item.getInstanceId(), paintKind: 'fill', paintIndex: 0,
      });
      expect(actions).length(0);
    });

    it('reports canvas stop changes and preserves selection while editing an endpoint', () => {
      const { item, gizmo } = gradient();

      for (const x of [1.2, -1.2, -1.2]) {
        const point = localToView(item, new Vector3(x, 0, 0)).add(new Vector2(0, 12));

        gizmo.onMouseDown(down(point));
        gizmo.onMouseUp(down(point));
      }
      const endpoint = localToView(item, new Vector3(-1.2, 0, 0));

      gizmo.onMouseDown(down(endpoint));
      gizmo.onMouseDrag(drag(endpoint.clone().add(new Vector2(20, 10))));
      gizmo.onMouseUp(down(endpoint));
      gizmo.onUpdate();
      expect(gizmo.selectedStopIndex).equals(0);
      expect(events.map(({ index, percentage }) => ({ index, percentage }))).deep.equals([
        { index: 1, percentage: 100 }, { index: 0, percentage: 0 },
      ]);
    });

    it('clears stop selection on blank clicks without leaving gradient editing or changing the paint', () => {
      const { item, component } = gradient();

      handler.setActiveTool(new MoveGizmoTool(handler));
      const mode = handler.getActiveEditMode() as SelectionEditMode;
      const edit = { type: 'gradient', paintKind: 'fill', paintIndex: 0 } as const;

      mode.editContent(edit);
      const gizmo = handler.getGizmoManager().get('gradient')!;
      const viewport = (handler as unknown as { gizmoViewport: GizmoViewport }).gizmoViewport;
      const original = getGradientPaint(component, 'fill', 0);
      const blank = localToView(item, new Vector3(0, 2, 0));

      gizmo.selectStop(0);
      for (let i = 0; i < 2; i++) {
        viewport.onMouseDown(down(blank));
        viewport.onMouseUp(down(blank, { pressed: false, buttonMask: MouseButtonMask.None }));
      }
      expect(gizmo.selectedStopIndex).equals(-1);
      expect(mode.contentEdit).deep.equals(edit);
      expect(handler.getGizmoManager().get('gradient')).equals(gizmo);
      expect(handler.getSelection().getSelectedPlayerItems()).deep.equals([item]);
      expect(getGradientPaint(component, 'fill', 0)).deep.equals(original);
      expect(actions).length(0);
      expect(events.map(({ index, percentage }) => ({ index, percentage }))).deep.equals([
        { index: 0, percentage: 0 }, { index: -1, percentage: undefined },
      ]);
    });

    it('reports the written stop after insertion, sorting, fractional movement and cancellation', () => {
      const { item, component, gizmo } = gradient();
      const original = getGradientPaint(component, 'fill', 0)!;

      original.gradientStops.stops.splice(1, 0, { time: 0.75, color: new math.Color(0, 1, 0, 1) });
      setGradientPaint(component, 'fill', 0, original);
      handler.on('gradientselectionchange', ({ index, percentage }) => {
        expect(getGradientPaint(component, 'fill', 0)!.gradientStops.stops[index].time * 100).equals(percentage);
        expect(gizmo.selectedStopIndex).equals(index);
      });
      gizmo.selectStop(2);
      const press = localToView(item, new Vector3()).add(new Vector2(0, 12));
      const target = localToView(item, new Vector3(0.75, 0, 0)).add(new Vector2(0, 12));

      gizmo.onMouseDown(down(press));
      expect(events.at(-1)!.index).equals(1);
      expect(events.at(-1)!.percentage).closeTo(50, 1e-6);
      gizmo.onMouseDrag(drag(target));
      expect(events.at(-1)!.index).equals(2);
      expect(events.at(-1)!.percentage).closeTo(81.25, 1e-6);
      gizmo.selectStop(0);
      gizmo.onUpdate();
      expect(events).length(3);
      gizmo.onKeyDown(key());
      gizmo.onMouseUp(down(target));
      expect(events).length(4);
      expect(events.at(-1)).includes({ index: 2, percentage: 100 });
      expect(getGradientPaint(component, 'fill', 0)).deep.equals(original);
      expect(actions.some(action => action.phase === 'actioncommit')).equals(false);
    });

    for (const shortcut of ['Backspace', 'Delete']) {
      it(`keeps a clicked stop selected and deletes it once with ${shortcut}, ignoring the key without a selection`, () => {
        const { item, component } = gradient();
        const paint = getGradientPaint(component, 'fill', 0)!;

        paint.gradientStops.stops.splice(1, 0,
          { time: 0.25, color: new math.Color(0, 1, 0, 1) },
          { time: 0.5, color: new math.Color(1, 1, 0, 1) });
        setGradientPaint(component, 'fill', 0, paint);
        handler.setActiveTool(new MoveGizmoTool(handler));
        const mode = handler.getActiveEditMode() as SelectionEditMode;

        mode.editContent({ type: 'gradient', paintKind: 'fill', paintIndex: 0 });
        const gizmo = handler.getGizmoManager().get('gradient')!;
        const viewport = (handler as unknown as { gizmoViewport: GizmoViewport }).gizmoViewport;

        viewport.onKeyDown(key(shortcut));
        expect(getGradientPaint(component, 'fill', 0)).deep.equals(paint);
        expect(actions).length(0);
        expect(events).length(0);
        const point = localToView(item, new Vector3()).add(new Vector2(0, 12));

        viewport.onMouseDown(down(point));
        viewport.onMouseUp(down(point, { pressed: false, buttonMask: MouseButtonMask.None }));
        const hover = new InputEventMouseMotion();

        hover.position.copyFrom(localToView(item, new Vector3(0, 2, 0)));
        viewport.onMouseMove(hover);
        gizmo.onUpdate();
        expect(gizmo.selectedStopIndex).equals(2);
        actions.length = 0;

        viewport.onKeyDown(key(shortcut));
        viewport.onKeyDown(key(shortcut));
        gizmo.onUpdate();
        expect(getGradientPaint(component, 'fill', 0)!.gradientStops.stops.map(stop => stop.time))
          .deep.equals([0, 0.25, 1]);
        expect(gizmo.selectedStopIndex).equals(-1);
        expect(composition.items).includes(item);
        expect(handler.getGizmoManager().get('gradient')).equals(gizmo);
        expect(actions.map(action => action.phase)).deep.equals(['actionstart', 'actionupdate', 'actioncommit']);
        expect(events.map(({ index, percentage }) => ({ index, percentage }))).deep.equals([
          { index: 2, percentage: 50 }, { index: -1, percentage: undefined },
        ]);
      });
    }

    it('clears selection when the idle gradient is changed to a solid fill', () => {
      const { component, gizmo } = gradient();

      gizmo.selectStop(1);
      setColorPaint(component, 'fill', 0, { type: spec.FillType.Solid, color: new math.Color(0, 1, 0, 1) });
      gizmo.onUpdate();
      gizmo.dispose();
      expect(events).length(2);
      expect(events.at(-1)).includes({ index: -1, percentage: undefined });
      expect(gizmo.selectedStopIndex).equals(-1);
    });

    it('identifies the selected stroke and clears its selection on disposal', () => {
      const { item, component, data } = gradient();

      component.fromData({ ...data, strokes: [data.fills[0], data.fills[0]], strokeWidth: 2 });
      component.onUpdate(0);
      const gizmo = new GradientGizmo(handler, item, 'stroke', 1);

      gizmo.selectStop(1);
      expect(events[0]).includes({
        source: gizmo, itemId: item.getInstanceId(), paintKind: 'stroke', paintIndex: 1, index: 1, percentage: 100,
      });
      gizmo.dispose();
      gizmo.dispose();
      expect(events).length(2);
      expect(events[1]).includes({ paintKind: 'stroke', paintIndex: 1, index: -1, percentage: undefined });
    });
  });

  it('adds, drags, sorts and deletes a gradient stop without deleting the item', () => {
    const { item, component, gizmo } = gradient();
    const center = localToView(item, new Vector3());
    const cursor = center.clone().add(new Vector2(0, 12));

    gizmo.onMouseDown(down(cursor));
    expect(getGradientPaint(component, 'fill', 0)!.gradientStops.stops).length(3);
    gizmo.onMouseDrag(drag(cursor.clone().add(new Vector2(25, 0))));
    gizmo.onMouseUp(down(cursor));
    expect(getGradientPaint(component, 'fill', 0)!.gradientStops.stops[1].time).greaterThan(0.5);
    gizmo.onKeyDown(key('Backspace'));
    gizmo.onKeyDown(key('Backspace'));
    expect(getGradientPaint(component, 'fill', 0)!.gradientStops.stops).length(2);
    expect(composition.items).includes(item);
  });

  for (const transformed of [false, true]) {
    it(`aligns angular gradient stops with the ellipse tangent (${transformed ? 'transformed' : 'default'})`, () => {
      const { component, item, gizmo } = gradient(spec.FillType.GradientAngular);
      const paint = getGradientPaint(component, 'fill', 0)!;

      paint.startPoint.set(0.5, 0.5);
      paint.endPoint.set(0.9, 0.5);
      paint.gradientStops.stops.splice(1, 0, ...[0.125, 0.375, 0.625, 0.875].map(time =>
        ({ time, color: new math.Color(0, 1, 0, 1) })));
      setGradientPaint(component, 'fill', 0, paint);
      if (transformed) {
        item.transform.setScale(-1.5, 0.8, 1);
        item.transform.setRotation(0, 0, 30);
      }
      const { calls, control } = recordDrawing();

      gizmo.draw(control);
      const ellipse = calls.find(call => call.kind === 'polyline' && call.coords.length === 130)!.coords;
      const point = (index: number) => new Vector2(ellipse[index * 2], ellipse[index * 2 + 1]);
      const markers = calls.filter(call => call.kind === 'polyline' && call.coords.length === 10);
      const origin = localToView(item, new Vector3());
      const config = handler.getConfigManager().get(gradientConfig);

      for (const [index, sample] of [8, 24, 40, 56].entries()) {
        const coords = markers[index + 1].coords;
        const a = new Vector2(coords[0], coords[1]);
        const b = new Vector2(coords[2], coords[3]);
        const c = new Vector2(coords[4], coords[5]);
        const center = a.clone().add(c).multiply(0.5);
        const edge = b.clone().subtract(a);
        const tangent = point(sample + 1).subtract(point(sample - 1)).normalize();
        const offset = center.clone().subtract(point(sample));

        expect(Math.abs(edge.clone().normalize().dot(tangent))).closeTo(1, 1e-6);
        expect(offset.dot(tangent)).closeTo(0, 1e-6);
        expect(offset.length()).closeTo(config.stopOffset, 1e-6);
        expect(offset.dot(point(sample).subtract(origin))).greaterThan(0);

        const press = center.clone().add(edge.multiply(0.4))
          .add(offset.normalize().multiply(config.stopHeight * 0.4));

        gizmo.onMouseDown(down(press));
        gizmo.onMouseUp(down(press));
        expect(gizmo.selectedStopIndex).equals(index + 1);
      }
      expect(getGradientPaint(component, 'fill', 0)).deep.equals(paint);
    });
  }

  it('previews and inserts an angular gradient stop on the outward ellipse normal', () => {
    const { component, gizmo } = gradient(spec.FillType.GradientAngular);
    const paint = getGradientPaint(component, 'fill', 0)!;

    paint.startPoint.set(0.5, 0.5);
    paint.endPoint.set(0.9, 0.5);
    setGradientPaint(component, 'fill', 0, paint);
    const { calls, control } = recordDrawing();

    gizmo.draw(control);
    const ellipse = calls.find(call => call.kind === 'polyline' && call.coords.length === 130)!.coords;
    const point = (index: number) => new Vector2(ellipse[index * 2], ellipse[index * 2 + 1]);
    const tangent = point(9).subtract(point(7)).normalize();
    const normal = new Vector2(-tangent.y, tangent.x);
    const press = point(8).add(normal.multiply(handler.getConfigManager().get(gradientConfig).stopOffset));
    const hover = new InputEventMouseMotion();

    hover.position.copyFrom(press);
    gizmo.onMouseMove(hover);
    calls.length = 0;
    gizmo.draw(control);
    const markers = calls.filter(call => call.kind === 'polyline' && call.coords.length === 10);

    expect(markers).length(3);
    const preview = markers[2].coords;
    const center = new Vector2(preview[0] + preview[4], preview[1] + preview[5]).multiply(0.5);

    expect(center.distance(press)).lessThan(1e-4);
    gizmo.onMouseDown(down(press));
    gizmo.onMouseUp(down(press));
    expect(gizmo.selectedStopIndex).equals(1);
    const stops = getGradientPaint(component, 'fill', 0)!.gradientStops.stops;

    expect(stops).length(3);
    expect(stops[1].time).closeTo(0.125, 1e-6);
  });

  it('drags angular gradient stops continuously across sub-percent positions and the seam', () => {
    const { component, item, gizmo } = gradient(spec.FillType.GradientAngular);
    const paint = getGradientPaint(component, 'fill', 0)!;

    paint.startPoint.set(0.5, 0.5);
    paint.endPoint.set(0.9, 0.5);
    paint.gradientStops.stops.splice(1, 0, { time: 0.25, color: new math.Color(0, 1, 0, 1) });
    setGradientPaint(component, 'fill', 0, paint);
    const base = localToView(item, new Vector3(0, 0.8, 0));
    const start = base.clone().add(new Vector2(0, -12));

    gizmo.onMouseDown(down(start));
    for (const ratio of [0.251, 0.254, 0.256, 0.999, 1.001]) {
      const target = localToView(
        item,
        new Vector3(
          1.6 * Math.cos(ratio * 2 * Math.PI),
          0.8 * Math.sin(ratio * 2 * Math.PI),
          0
        )
      );

      gizmo.onMouseDrag(drag(start.clone().add(target.subtract(base))));
      expect(getGradientPaint(component, 'fill', 0)!.gradientStops.stops[gizmo.selectedStopIndex].time)
        .closeTo(ratio % 1, 1e-6);
    }
    gizmo.onMouseUp(down(start));
    expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
  });

  it('uses Alt for symmetric gradient dragging when navigator is unavailable', () => {
    const { item, component, gizmo } = gradient();
    const start = localToView(item, new Vector3(-1.2, 0, 0));
    const descriptor = Object.getOwnPropertyDescriptor(window, 'navigator');

    gizmo.onMouseDown(down(start));
    try {
      Object.defineProperty(window, 'navigator', { configurable: true, value: undefined });
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(20, 20)), false, true));
      const paint = getGradientPaint(component, 'fill', 0)!;

      expect(paint.startPoint.x).greaterThan(0.2);
      expect(paint.startPoint.clone().add(paint.endPoint).toArray()).deep.equals([1, 1]);
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'navigator', descriptor);
      } else {
        Reflect.deleteProperty(window, 'navigator');
      }
      gizmo.dispose();
    }
  });

  for (const count of [4, 8]) {
    it(`clears all lattice selection and redraws every point after its count changes to ${count}`, () => {
      const { item, component, gizmo } = lattice();
      const columns = count / 2;
      const points = Array.from({ length: count }, (_, index) =>
        new Vector3(index % columns, Math.floor(index / columns), 0));

      gizmo.selected.add(0);
      gizmo.selected.add(5);
      component.fromData({
        id: component.getInstanceId(), dataType: spec.DataType.FFDComponent,
        item: { id: item.getInstanceId() }, rowNum: 2, colNum: columns,
        boundMin: new Vector3(0, 0, 0), boundMax: new Vector3(columns - 1, 1, 0), controlPoints: points,
      });
      gizmo.onUpdate();
      expect(gizmo.selected.size).equals(0);
      const drawing = recordDrawing();

      gizmo.draw(drawing.control);
      expect(drawing.calls.filter(call => call.kind === 'fillCircle')).length(count * 2);
    });
  }

  it('resamples edited paths through the asset API while preserving clip metadata and other channels', () => {
    const { item, clip, component } = path();

    clip.setData({
      ...clip.transformAnimationData,
      name: 'Animated path',
      sizeOverLifetime: { size: [spec.ValueType.LINE, [[0, 1], [1, 3]]] },
      rotationOverLifetime: { asRotation: true, z: [spec.ValueType.LINE, [[0, 10], [1, 80]]] },
    });
    component.timelineAsset!.markAsChanged();
    component.sampleTime(4);
    const originalData = structuredClone(clip.transformAnimationData);
    const position = item.transform.position.clone();
    const rotation = item.transform.quat.toArray();
    const scale = item.transform.scale.toArray();
    const time = component.getTime();
    const target = findMotionPaths(item)[0];
    const editedPath = structuredClone(target.path);
    let changes = 0;

    clip.on('changed', () => { changes++; });
    for (const channel of [1, 2] as const) {
      for (const point of editedPath[channel]) {
        point[0] += 3;
        point[1] -= 2;
      }
    }
    setMotionPath(target, editedPath);
    component.sampleTime(component.getTime());
    expect(changes).equals(1);
    expect(component.getTime()).equals(time);
    expect(item.transform.position.x).closeTo(position.x + 3, 1e-5);
    expect(item.transform.position.y).closeTo(position.y - 2, 1e-5);
    expect(item.transform.position.z).closeTo(position.z, 1e-5);
    expect(item.transform.quat.toArray()).deep.equals(rotation);
    expect(item.transform.scale.toArray()).deep.equals(scale);
    expect(clip.transformAnimationData).deep.equals({
      ...originalData,
      positionOverLifetime: {
        ...originalData.positionOverLifetime,
        path: [spec.ValueType.BEZIER_CURVE_PATH, editedPath],
      },
    });
    editedPath[1][0][0] = 999;
    expect(findMotionPaths(item)[0].path[1][0][0]).equals(1);
  });

  it('mirrors a middle path control, reports its keyframe time, and restores on Escape', () => {
    const { item, gizmo } = path();
    const original = structuredClone(findMotionPaths(item)[0].path);
    const start = localToView(item, new Vector3(...original[2][1]), item.transform.getParentMatrix());

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(0, -25))));
    const controls = findMotionPaths(item)[0].path[2];

    expect(controls[1][1] + controls[2][1]).closeTo(2, 1e-5);
    expect(actions.at(-1)?.keyframeTime).equals(4);
    gizmo.onKeyDown(key());
    expect(findMotionPaths(item)[0].path).deep.equals(original);
  });

  it('moves the path with a freely dragged item and keeps the result when the timeline samples again', () => {
    const { item, component } = path();
    const parent = DefaultVFXItems.createEmpty(composition);

    parent.transform.setScale(-1.2, 0.8, 1);
    parent.transform.setRotation(0, 0, 25);
    item.setParent(parent);
    const original = structuredClone(findMotionPaths(item)[0].path);
    const position = item.transform.position.clone();
    const start = localToView(item, new Vector3());
    const gizmo = new MoveSelectionGizmo(handler);

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(32, 18))));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(64, 36))));
    const movedPosition = item.transform.position.clone();
    const delta = movedPosition.clone().subtract(position);
    const moved = findMotionPaths(item)[0].path;

    expect(delta.length()).greaterThan(0.1);
    expect(moved[0]).deep.equals(original[0]);
    for (const channel of [1, 2] as const) {
      moved[channel].forEach((value, index) => {
        const expected = new Vector3(...original[channel][index]).add(delta);

        value.forEach((axis, i) => expect(axis).closeTo(expected.toArray()[i], 1e-5));
      });
    }
    gizmo.onMouseUp(down(start));
    component.sampleTime(component.getTime());
    expect(component.getTime()).equals(3);
    item.transform.position.toArray().forEach((value, i) => expect(value).closeTo(movedPosition.toArray()[i], 1e-5));
    component.sampleTime(6);
    item.transform.position.toArray().forEach((value, i) => expect(value).closeTo(moved[1][2][i], 1e-5));
    expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
    gizmo.dispose();
  });

  for (const axis of ['free', 'x', 'y']) {
    it(`restores the translated path and element after canceling a ${axis} drag`, () => {
      const { item, component } = path();
      const original = structuredClone(findMotionPaths(item)[0].path);
      const position = item.transform.position.clone();
      const resize = new ResizeSelectionGizmo(handler);
      const gizmo = axis === 'free' ? new MoveSelectionGizmo(handler) : new TransformHandlesGizmo(handler, resize);

      resize.refreshWireframeBySelectedItems();
      const start = axis === 'free' ? localToView(item, new Vector3())
        : resize.wireframe.anchor.clone().add(new Vector2(axis === 'x' ? 40 : 0, axis === 'y' ? -40 : 0));
      const end = start.clone().add(new Vector2(30, -25));

      gizmo.onMouseDown(down(start));
      gizmo.onMouseDrag(drag(end));
      expect(findMotionPaths(item)[0].path).not.deep.equals(original);
      const delta = item.transform.position.clone().subtract(position);

      expect(findMotionPaths(item)[0].path[2][0][0]).closeTo(original[2][0][0] + delta.x, 1e-5);
      expect(findMotionPaths(item)[0].path[2][0][1]).closeTo(original[2][0][1] + delta.y, 1e-5);
      if (axis === 'x') {
        expect(delta.y).closeTo(0, 1e-5);
      }
      if (axis === 'y') {
        expect(delta.x).closeTo(0, 1e-5);
      }
      gizmo.onKeyDown(key());
      gizmo.onMouseDrag(drag(end));
      gizmo.onMouseUp(down(end));
      expect(findMotionPaths(item)[0].path).deep.equals(original);
      component.sampleTime(component.getTime());
      item.transform.position.toArray().forEach((value, i) => expect(value).closeTo(position.toArray()[i], 1e-5));
      expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
      gizmo.dispose();
      resize.dispose();
    });
  }

  it('preserves the whole path in world space when a translation reparents the item', () => {
    const { item } = path();
    const snapshot = captureMotionPaths(item);
    const parent = DefaultVFXItems.createEmpty(composition);
    const delta = new Vector3(0.8, -0.3, 0);
    const worldPosition = item.transform.position.clone().applyMatrix(snapshot.parentMatrix).add(delta);

    parent.transform.setPosition(2, 1, 0);
    parent.transform.setScale(-2, 0.7, 1);
    parent.transform.setRotation(0, 0, 30);
    item.setParent(parent);
    const matrix = item.transform.getParentMatrix()!;
    const position = worldPosition.applyMatrix(matrix.clone().invert());

    item.setPosition(...position.toArray());
    updateMotionPathTranslation(snapshot);
    const moved = findMotionPaths(item)[0].path;

    for (const channel of [1, 2] as const) {
      moved[channel].forEach((value, i) => {
        const actual = new Vector3(...value).applyMatrix(matrix);
        const expected = new Vector3(...snapshot.paths[0].path[channel][i])
          .applyMatrix(snapshot.parentMatrix).add(delta);

        expect(actual.distance(expected)).lessThan(1e-5);
      });
    }
    expect(moved[0]).deep.equals(snapshot.paths[0].path[0]);
  });

  it('keeps motion snapshots and previous path values independent across repeated translations', () => {
    const { item } = path();
    const snapshot = captureMotionPaths(item);
    const original = structuredClone(snapshot.paths[0].path);

    item.translate(1, 0, 0);
    updateMotionPathTranslation(snapshot);
    const previous = findMotionPaths(item)[0].path;
    const previousValue = structuredClone(previous);

    item.translate(1, 0, 0);
    updateMotionPathTranslation(snapshot);
    const current = findMotionPaths(item)[0].path;

    expect(previous).deep.equals(previousValue);
    expect(snapshot.paths[0].path).deep.equals(original);
    for (const channel of [1, 2] as const) {
      current[channel].forEach((point, index) => expect(point).deep.equals([
        original[channel][index][0] + 2,
        original[channel][index][1],
        original[channel][index][2],
      ]));
    }
    current[0][0][1][0] = 0.1;
    expect(snapshot.paths[0].path).deep.equals(original);
  });

  it('moves a path point and its adjacent handles without jumping to an off-center press', () => {
    const { item, gizmo, component } = path();
    const original = structuredClone(findMotionPaths(item)[0].path);
    const start = localToView(item, new Vector3(...original[1][1]), item.transform.getParentMatrix());
    const press = start.clone().add(new Vector2(3, 2));
    const movement = new Vector2(24, -15);

    gizmo.onMouseDown(down(press));
    gizmo.onMouseDrag(drag(press.clone().add(movement), true));
    const moved = findMotionPaths(item)[0].path;
    const delta = new Vector3(...moved[1][1]).subtract(new Vector3(...original[1][1]));
    const view = localToView(item, new Vector3(...moved[1][1]), item.transform.getParentMatrix());

    expect(view.x).closeTo(start.x + movement.x, 1e-5);
    expect(view.y).closeTo(start.y, 1e-5);
    for (const index of [1, 2]) {
      expect(new Vector3(...moved[2][index]).subtract(new Vector3(...original[2][index])).distance(delta))
        .lessThan(1e-5);
    }
    expect(moved[2][0]).deep.equals(original[2][0]);
    expect(moved[2][3]).deep.equals(original[2][3]);
    expect(moved[0]).deep.equals(original[0]);
    expect(component.getTime()).equals(3);
    gizmo.onMouseUp(down(press));
    gizmo.dispose();
  });

  it('picks the nearest handle and prioritizes a point when its handle overlaps', () => {
    const { item, clip, gizmo } = path();
    const original = structuredClone(findMotionPaths(item)[0].path);

    original[2][1] = [...original[1][1]];
    setMotionPath(findMotionPaths(item)[0], original);
    const start = localToView(item, new Vector3(...original[1][1]), item.transform.getParentMatrix());

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(15, -10))));
    expect(findMotionPaths(item)[0].path[1][1]).not.deep.equals(original[1][1]);
    gizmo.onKeyDown(key());
    original[2][1][0] -= 0.06;
    setMotionPath(findMotionPaths(item)[0], original);
    const handle = localToView(item, new Vector3(...original[2][1]), item.transform.getParentMatrix());

    gizmo.onMouseDown(down(handle));
    gizmo.onMouseDrag(drag(handle.clone().add(new Vector2(-12, -10)), false, true));
    expect(findMotionPaths(item)[0].path[1]).deep.equals(original[1]);
    expect(findMotionPaths(item)[0].path[2][1]).not.deep.equals(original[2][1]);
    gizmo.dispose();
  });

  it('keeps asymmetric handles unchanged on a zero-distance drag', () => {
    const { item, clip, gizmo } = path();
    const original = structuredClone(findMotionPaths(item)[0].path);

    original[2][2][1] += 1;
    setMotionPath(findMotionPaths(item)[0], original);
    const press = localToView(
      item,
      new Vector3(...original[2][1]),
      item.transform.getParentMatrix()
    ).add(new Vector2(3, 2));

    gizmo.onMouseDown(down(press));
    gizmo.onMouseDrag(drag(press));
    gizmo.onMouseUp(down(press));
    expect(findMotionPaths(item)[0].path).deep.equals(original);
    gizmo.dispose();
  });

  it('keeps the effects selection and translates the path when editing position in the inspector', async function () {
    this.timeout(10000);
    const { root, item } = await createGizmoReference(composition, 'path');
    const mode = new SelectionEditMode(handler, { effectsItemId: root.getInstanceId() });

    handler.setActiveTool(new MoveGizmoTool(handler));
    handler.setActiveEditMode(mode);
    select(item);
    const editor = new DemoEditor(player, new DemoScene(player, composition), handler, container);
    const original = structuredClone(findMotionPaths(item)[0].path);
    const position = item.transform.position.clone();

    try {
      editor.editSelectedPosition('x', position.x + 1.25);
      editor.editSelectedPosition('y', position.y - 0.75);
      expect(handler.getActiveEditMode()).equals(mode);
      expect(editor.selectedItem).equals(item);
      const moved = findMotionPaths(item)[0].path;

      for (const channel of [1, 2] as const) {
        moved[channel].forEach((value, i) => {
          expect(value[0]).closeTo(original[channel][i][0] + 1.25, 1e-5);
          expect(value[1]).closeTo(original[channel][i][1] - 0.75, 1e-5);
          expect(value[2]).equals(original[channel][i][2]);
        });
      }
      root.getComponent(CompositionComponent).sampleTime(root.getComponent(CompositionComponent).getTime());
      expect(item.transform.position.x).closeTo(position.x + 1.25, 1e-5);
      expect(item.transform.position.y).closeTo(position.y - 0.75, 1e-5);
    } finally {
      editor.dispose();
    }
  });

  describe('gizmo drawing config', () => {
    it('updates axis, anchor and label styles without canceling an active transform', () => {
      sprite();
      const resize = new ResizeSelectionGizmo(handler);
      const gizmo = new TransformHandlesGizmo(handler, resize);
      const manager = handler.getConfigManager();
      const { calls, control } = recordDrawing();
      const alpha = 0x80 / 255;

      manager.set(transformHandlesConfig, {
        xAxisLineColor: 0xFF000080,
        yAxisLineColor: 0x0000FF80,
        xAxisFillColor: 0x00FF0080,
        axisLineWidth: 4,
        activeAxisLineWidth: 6,
        axisLength: 100,
        axisArrowLength: 20,
        axisArrowWidth: 14,
        anchorRadius: 10,
        anchorFillRadius: 7,
        anchorLineColor: 0x00FFFF80,
        anchorLineWidth: 3,
        anchorFillColor: 0xFF00FF80,
        labelFontSize: 16,
        labelTextColor: 0x00FF0080,
        labelBackgroundColor: 0x0000FF80,
        labelPaddingX: 10,
        labelPaddingY: 8,
        labelOffsetX: 20,
        labelOffsetY: 25,
      });
      gizmo.draw(control);
      const anchor = resize.wireframe.anchor.clone();
      const lines = calls.filter(call => call.kind === 'line');
      const arrow = calls.find(call => call.kind === 'fillTriangle')!;

      expect(lines[0].color).deep.equals([1, 0, 0, alpha]);
      expect(lines[0].width).equals(4);
      expect(lines[0].coords[2] - anchor.x).equals(80);
      expect(lines[1].color).deep.equals([0, 0, 1, alpha]);
      expect(arrow.color).deep.equals([0, 1, 0, alpha]);
      expect(arrow.coords[0] - anchor.x).equals(100);
      expect(arrow.coords[3] - arrow.coords[5]).equals(14);
      expect(calls.find(call => call.kind === 'circle')).includes({ width: 3 });
      expect(calls.find(call => call.kind === 'circle')!.coords[2]).equals(10);
      expect(calls.find(call => call.kind === 'fillCircle')!.color).deep.equals([1, 0, 1, alpha]);

      const hover = drag(anchor.clone().add(new Vector2(9, 0)));

      gizmo.onMouseMove(hover);
      expect(hover.isAccepted()).equals(true);
      calls.length = 0;
      gizmo.draw(control);
      const label = calls.find(call => call.kind === 'text')!;
      const background = calls.find(call => call.kind === 'fillRect')!;

      expect(label.coords[2]).equals(16);
      expect(label.color).deep.equals([0, 1, 0, alpha]);
      expect(background.color).deep.equals([0, 0, 1, alpha]);
      expect(background.coords.slice(0, 2)).deep.equals([anchor.x + 20, anchor.y + 25]);
      const press = down(anchor.clone().add(new Vector2(95, 0)));

      gizmo.onMouseDown(press);
      expect(press.isAccepted()).equals(true);
      manager.set(transformHandlesConfig, { xAxisLineColor: 0xFF000040 });
      calls.length = 0;
      gizmo.draw(control);
      expect(calls.find(call => call.kind === 'line')!.width).equals(6);
      expect(calls.find(call => call.kind === 'line')!.color).deep.equals([1, 0, 0, 0x40 / 255]);
      expect(actions.filter(action => action.canceled)).length(0);
      gizmo.dispose();
      resize.dispose();
    });

    it('uses configured group corner sizes for both drawing and hit testing', () => {
      const first = sprite();
      const second = sprite();

      first.setPosition(-2, 0, 0);
      second.setPosition(2, 0, 0);
      select(first, second);
      handler.getConfigManager().set(transformHandlesConfig, {
        groupCornerSize: 16,
        groupCornerFillColor: 0xFF000080,
        groupCornerLineColor: 0x00FF0080,
        groupCornerLineWidth: 3,
      });
      const resize = new ResizeSelectionGizmo(handler);
      const gizmo = new TransformHandlesGizmo(handler, resize);
      const { calls, control } = recordDrawing();

      gizmo.draw(control);
      const corners = calls.filter(call => call.kind === 'fillRect');
      const borders = calls.filter(call => call.kind === 'rect');

      expect(corners).length(4);
      expect(corners.every(call => call.coords[2] === 16 && call.coords[3] === 16)).equals(true);
      expect(corners[0].color).deep.equals([1, 0, 0, 0x80 / 255]);
      expect(borders[0].color).deep.equals([0, 1, 0, 0x80 / 255]);
      expect(borders.every(call => call.width === 3)).equals(true);
      const corner = new Vector2(corners[0].coords[0] + 8, corners[0].coords[1] + 8);
      const press = down(corner.add(new Vector2(9, 0)));

      gizmo.onMouseDown(press);
      expect(press.isAccepted()).equals(true);
      gizmo.dispose();
      resize.dispose();
    });

    it('updates curve lines, point states and hit sizes on an existing Gizmo', () => {
      const { item, gizmo } = path();
      const manager = handler.getConfigManager();
      const { calls, control } = recordDrawing();
      const alpha = 0x80 / 255;

      manager.set(curveConfig, {
        pathColor: 0xFF000080,
        pathWidth: 3,
        pathOutlineColor: 0x0000FF80,
        pathOutlineWidth: 7,
        controlLineColor: 0x00FF0080,
        controlLineWidth: 2,
        controlPointRadius: 8,
        controlPointFillColor: 0x0000FF80,
        pointSize: 20,
        selectedPointSize: 24,
        hoverPointSize: 22,
        pointFillColor: 0x00FF0080,
        selectedPointFillColor: 0xFF000080,
        hoverPointFillColor: 0x0000FF80,
      });
      gizmo.draw(control);
      const paths = calls.filter(call => call.kind === 'polyline');

      expect(paths[0].color).deep.equals([0, 0, 1, alpha]);
      expect(paths[0].width).equals(7);
      expect(paths[1].color).deep.equals([1, 0, 0, alpha]);
      expect(paths[1].width).equals(3);
      expect(calls.some(call => call.kind === 'line' && call.width === 2 && call.color?.[1] === 1)).equals(true);
      expect(calls.some(call => call.kind === 'fillCircle' && call.coords[2] === 8)).equals(true);
      expect(calls.some(call => call.kind === 'fillRect' && call.coords[2] === 20)).equals(true);
      const point = localToView(
        item, new Vector3(...findMotionPaths(item)[0].path[1][1]), item.transform.getParentMatrix(),
      );
      const hover = drag(point.clone().add(new Vector2(10, 0)));

      gizmo.onMouseMove(hover);
      expect(hover.isAccepted()).equals(true);
      calls.length = 0;
      gizmo.draw(control);
      expect(calls.find(call => call.kind === 'fillRect'
        && call.coords[0] === point.x - 11 && call.coords[1] === point.y - 11
        && call.coords[2] === 22)!.color)
        .deep.equals([0, 0, 1, alpha]);
      const press = down(hover.position);

      gizmo.onMouseDown(press);
      expect(press.isAccepted()).equals(true);
      calls.length = 0;
      gizmo.draw(control);
      expect(calls.find(call => call.kind === 'fillRect'
        && call.coords[0] === point.x - 12 && call.coords[1] === point.y - 12
        && call.coords[2] === 24)!.color)
        .deep.equals([1, 0, 0, alpha]);
      gizmo.onKeyDown(key());
      manager.reset(curveConfig);
      calls.length = 0;
      gizmo.draw(control);
      expect(calls.filter(call => call.kind === 'polyline')[1].width).equals(2);
      gizmo.dispose();
    });

    it('styles gradient markers with color alpha without changing the underlying paint', () => {
      const { component, item, gizmo } = gradient(spec.FillType.GradientAngular);
      const original = getGradientPaint(component, 'fill', 0)!;
      const manager = handler.getConfigManager();
      const { calls, control } = recordDrawing();

      original.gradientStops.stops.forEach(stop => {
        stop.color.a = 0.4;
      });
      setGradientPaint(component, 'fill', 0, original);
      manager.set(gradientConfig, {
        lineColor: 0xFF000080,
        lineWidth: 3,
        rangeLineColor: 0x00FF0080,
        rangeLineWidth: 2,
        rotationRadius: 24,
        rotationLineColor: 0x0000FF80,
        rotationLineWidth: 4,
        endpointRadius: 7,
        endpointFillColor: 0x00FF0080,
        endpointLineColor: 0xFF000080,
        endpointLineWidth: 2,
        stopWidth: 24,
        stopHeight: 20,
        stopOffset: 30,
        selectedStopLineColor: 0xFF000080,
        selectedStopLineWidth: 3,
        labelFontSize: 18,
        labelTextColor: 0x00FF0080,
      });
      gizmo.draw(control);
      expect(calls.find(call => call.kind === 'line')!.color).deep.equals([1, 0, 0, 0x80 / 255]);
      expect(calls.find(call => call.kind === 'circle' && call.coords[2] === 24)!.width).equals(4);
      expect(calls.filter(call => call.kind === 'circle' && call.coords[2] === 7)).length(2);
      expect(calls.filter(call => call.kind === 'fillTriangle').every(call => call.color?.[3] === 0.4)).equals(true);
      expect(getGradientPaint(component, 'fill', 0)).deep.equals(original);

      manager.set(gradientConfig, { selectedStopFillColor: 0x0000FF80 });
      gizmo.selectStop(0);
      calls.length = 0;
      gizmo.draw(control);
      expect(calls.filter(call => call.kind === 'fillTriangle').at(-1)!.color)
        .deep.equals([0, 0, 1, 0x80 / 255]);
      expect(calls.find(call => call.kind === 'text')!.coords[2]).equals(18);
      const end = localToView(item, new Vector3(1.2, 0, 0));
      const press = down(end.add(new Vector2(30, 0)));

      gizmo.onMouseDown(press);
      expect(press.isAccepted()).equals(true);
      expect(gizmo.selectedStopIndex).equals(0);
      gizmo.onKeyDown(key());
      expect(getGradientPaint(component, 'fill', 0)).deep.equals(original);
      gizmo.dispose();
    });

    it('styles lattice edges, soft selection, frames, marquee and operation labels', () => {
      const { item, points, gizmo } = lattice();
      const { calls, control } = recordDrawing();
      const alpha = 0x80 / 255;

      handler.getConfigManager().set(crystalLatticeConfig, {
        lineColor: 0xFF000080,
        lineWidth: 2,
        boundaryLineColor: 0x00FF0080,
        boundaryLineWidth: 4,
        selectedLineColor: 0x0000FF80,
        selectedLineWidth: 6,
        pointRadius: 8,
        selectedPointRadius: 9,
        pointBorderColor: 0xFF00FF80,
        pointBorderWidth: 2,
        selectedPointFillColor: 0xFF000080,
        softPointFillColor: 0x0000FF80,
        hoverRingRadius: 14,
        hoverRingWidth: 3,
        framePadding: 20,
        frameMinSize: 80,
        frameLineWidth: 3,
        cornerSize: 12,
        cornerFillColor: 0x00FF0080,
        cornerLineColor: 0xFF000080,
        cornerLineWidth: 2,
        centerSize: 12,
        softRangeLineColor: 0xFF000080,
        softRangeLineWidth: 5,
        marqueeFillColor: 0xFF000080,
        marqueeLineColor: 0x0000FF80,
        marqueeLineWidth: 4,
        labelFontSize: 18,
        labelTextColor: 0x00FF0080,
        labelBackgroundColor: 0x0000FF80,
      });
      gizmo.selected.add(0);
      gizmo.selected.add(1);
      gizmo.setSoftSelection(true, 200);
      const start = localToView(item, points[0]).add(new Vector2(9, 0));

      gizmo.onMouseMove(drag(start));
      gizmo.draw(control);
      expect(calls.some(call => call.kind === 'line' && call.width === 2 && call.color?.[0] === 1)).equals(true);
      expect(calls.some(call => call.kind === 'line' && call.width === 4 && call.color?.[1] === 1)).equals(true);
      expect(calls.some(call => call.kind === 'line' && call.width === 6 && call.color?.[2] === 1)).equals(true);
      expect(calls.find(call => call.kind === 'fillCircle' && call.coords[2] === 9)!.color)
        .deep.equals([1, 0, 0, alpha]);
      expect(calls.find(call => call.kind === 'fillCircle' && call.coords[2] === 8)!.color)
        .deep.equals([0, 0, 1, alpha]);
      expect(calls.some(call => call.kind === 'circle' && call.coords[2] === 14 && call.width === 3)).equals(true);
      expect(calls.filter(call => call.kind === 'fillRect' && call.coords[2] === 12)).length(4);
      expect(calls.find(call => call.kind === 'polyline')!.width).equals(5);

      gizmo.onMouseDown(down(start));
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(20, 8)), false, true));
      calls.length = 0;
      gizmo.draw(control);
      expect(calls.find(call => call.kind === 'text')!.coords[2]).equals(18);
      expect(calls.find(call => call.kind === 'text')!.color).deep.equals([0, 1, 0, alpha]);
      expect(calls.filter(call => call.kind === 'fillRect').at(-1)!.color).deep.equals([0, 0, 1, alpha]);
      gizmo.onKeyDown(key());
      gizmo.selected.clear();
      gizmo.setSoftSelection(false);
      gizmo.onMouseDown(down(new Vector2(10, 10)));
      gizmo.onMouseDrag(drag(new Vector2(40, 40)));
      calls.length = 0;
      gizmo.draw(control);
      const marquee = calls.find(call => call.kind === 'fillRect')!;

      expect(marquee.coords).deep.equals([10, 10, 30, 30]);
      expect(marquee.color).deep.equals([1, 0, 0, alpha]);
      expect(calls.find(call => call.kind === 'rect')!.width).equals(4);
      gizmo.dispose();
    });

    it('updates FFD wireframe color, alpha and line width independently and resets them', () => {
      const { item, gizmo: latticeGizmo } = lattice();
      const sprite = item.getComponent(SpriteComponent);
      const original = sprite.geometry;
      const geometry = Geometry.create(player.engine, {
        attributes: { aPos: { size: 3, data: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) } },
        drawCount: 3,
      });
      const gizmo = new FFDWireframeGizmo(handler);
      const manager = handler.getConfigManager();
      const { calls, control } = recordDrawing();

      sprite.geometry = geometry;
      try {
        manager.set(ffdWireframeConfig, { lineColor: 0x00FF0080, lineWidth: 3.5 });
        manager.set(curveConfig, { pathColor: 0xFF0000CC });
        gizmo.draw(control);
        expect(calls).length(1);
        expect(calls[0].color).deep.equals([0, 1, 0, 0x80 / 255]);
        expect(calls[0].width).equals(3.5);
        manager.reset(ffdWireframeConfig);
        calls.length = 0;
        gizmo.draw(control);
        expect(calls[0].color).deep.equals([1, 0, 0, 1]);
        expect(calls[0].width).equals(1);
      } finally {
        sprite.geometry = original;
        geometry.dispose();
        gizmo.dispose();
        latticeGizmo.dispose();
      }
    });
  });

  describe('transform handle config', () => {
    const handles = [
      { handle: 'x', configKey: 'xAxisEnabled', offset: [40, 0] },
      { handle: 'y', configKey: 'yAxisEnabled', offset: [0, -40] },
      { handle: 'anchor', configKey: 'anchorEnabled', offset: [0, 0] },
    ] as const;

    for (const target of handles) {
      it(`independently hides and disables the ${target.handle} handle and restores it on reset`, () => {
        sprite();
        const resize = new ResizeSelectionGizmo(handler);
        const gizmo = new TransformHandlesGizmo(handler, resize);
        const manager = handler.getConfigManager();
        const drawings: string[] = [];
        const control = {
          drawLine: (x: number, y: number, endX: number) => drawings.push(x === endX ? 'y' : 'x'),
          fillTriangle: () => {},
          fillCircle: () => drawings.push('anchor'),
          drawCircle: () => {},
        };
        let cursor: GestureCursorType | undefined;

        handler.setCursor = result => {
          cursor = result.type;
        };
        gizmo.draw(control as never);
        expect(drawings).deep.equals(['x', 'y', 'anchor']);
        const start = resize.wireframe.anchor.clone().add(new Vector2(...target.offset));
        const hover = drag(start);

        gizmo.onMouseMove(hover);
        expect(hover.isAccepted()).equals(true);
        manager.set(transformHandlesConfig, { [target.configKey]: false });
        expect(cursor).equals(GestureCursorType.NORMAL);
        drawings.length = 0;
        gizmo.draw(control as never);
        expect(drawings).deep.equals(handles.filter(entry => entry !== target).map(entry => entry.handle));

        for (const candidate of handles) {
          const point = resize.wireframe.anchor.clone().add(new Vector2(...candidate.offset));
          const press = down(point);

          gizmo.onMouseDown(press);
          expect(press.isAccepted()).equals(candidate !== target);
          gizmo.onKeyDown(key());
        }
        const disabledHover = drag(start);

        gizmo.onMouseMove(disabledHover);
        expect(disabledHover.isAccepted()).equals(false);
        manager.reset(transformHandlesConfig);
        const press = down(start);

        gizmo.onMouseDown(press);
        expect(press.isAccepted()).equals(true);
        gizmo.dispose();
        resize.dispose();
      });

      for (const alt of target.handle === 'anchor' ? [false] : [false, true]) {
        it(`rolls back an active ${target.handle} ${alt ? 'rotation' : 'drag'} when its config is disabled`, () => {
          const { item, gizmo: curve } = path();

          item.transform.setScale(2, 1.5, 1);
          item.transform.setRotation(0, 0, 25);
          const resize = new ResizeSelectionGizmo(handler);
          const gizmo = new TransformHandlesGizmo(handler, resize);
          const manager = handler.getConfigManager();
          const read = () => ({
            position: item.transform.position.toArray(),
            anchor: item.transform.anchor.toArray(),
            scale: item.transform.scale.toArray(),
            rotation: item.transform.quat.toArray(),
            path: structuredClone(findMotionPaths(item)[0].path),
          });
          const original = read();

          resize.refreshWireframeBySelectedItems();
          const start = resize.wireframe.anchor.clone().add(new Vector2(...target.offset));
          const end = start.clone().add(new Vector2(30, 25));

          gizmo.onMouseDown(down(start, { altPressed: alt }));
          gizmo.onMouseDrag(drag(end, false, alt));
          const preview = read();

          expect(preview).not.deep.equals(original);
          manager.set(transformHandlesConfig, { [target.handle === 'x' ? 'yAxisEnabled' : 'xAxisEnabled']: false });
          expect(read()).deep.equals(preview);
          expect(actions.filter(action => action.canceled)).length(0);
          manager.set(transformHandlesConfig, { [target.configKey]: false });
          expect(read()).deep.equals(original);
          expect(handler.getSelectionTransformKind()).equals('idle');
          expect(actions.filter(action => action.canceled)).length(1);

          manager.reset(transformHandlesConfig);
          gizmo.onMouseDrag(drag(end.clone().add(new Vector2(10, 10)), false, alt));
          gizmo.onMouseUp(down(end));
          expect(read()).deep.equals(original);
          expect(actions.filter(action => action.phase === 'actioncommit')).length(0);

          gizmo.onMouseDown(down(start, { altPressed: alt }));
          gizmo.onMouseDrag(drag(end, false, alt));
          gizmo.onMouseUp(down(end));
          expect(read()).not.deep.equals(original);
          expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
          gizmo.dispose();
          resize.dispose();
          curve.dispose();
        });
      }
    }

    for (const phase of ['actionstart', 'actionupdate', 'actioncommit'] as const) {
      it(`handles disabling an axis from its ${phase} listener`, () => {
        const item = sprite();
        const resize = new ResizeSelectionGizmo(handler);
        const gizmo = new TransformHandlesGizmo(handler, resize);
        const original = item.transform.position.toArray();

        handler.on(phase, event => {
          if (event.source === gizmo && !event.canceled) {
            handler.getConfigManager().set(transformHandlesConfig, { xAxisEnabled: false });
          }
        });
        resize.refreshWireframeBySelectedItems();
        const start = resize.wireframe.anchor.clone().add(new Vector2(40, 0));
        const end = start.clone().add(new Vector2(30, 20));

        gizmo.onMouseDown(down(start));
        gizmo.onMouseDrag(drag(end));
        gizmo.onMouseUp(down(end));
        if (phase === 'actioncommit') {
          expect(item.transform.position.toArray()).not.deep.equals(original);
          expect(actions.filter(action => action.canceled)).length(0);
          expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
        } else {
          expect(item.transform.position.toArray()).deep.equals(original);
          expect(actions.filter(action => action.canceled)).length(1);
          expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
        }
        gizmo.dispose();
        resize.dispose();
      });
    }

    it('preserves free movement when all axis and anchor handles are disabled', () => {
      const item = sprite();

      handler.getConfigManager().set(transformHandlesConfig, {
        xAxisEnabled: false,
        yAxisEnabled: false,
        anchorEnabled: false,
      });
      handler.setActiveTool(new MoveGizmoTool(handler));
      const viewport = (handler as unknown as { gizmoViewport: GizmoViewport }).gizmoViewport;
      const start = localToView(item, new Vector3());
      const end = start.clone().add(new Vector2(35, 25));
      const original = item.transform.position.toArray();

      viewport.onMouseDown(down(start));
      viewport.onMouseMove(drag(end));
      viewport.onMouseUp(down(end, { pressed: false, buttonMask: MouseButtonMask.None }));
      expect(item.transform.position.toArray()).not.deep.equals(original);
      expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
    });
  });

  it('moves an anchor through its Gizmo and restores both anchor and compensation', () => {
    const item = sprite();

    item.transform.setScale(2, 1.5, 1);
    item.transform.setRotation(0, 0, 35);
    const resize = new ResizeSelectionGizmo(handler);
    const gizmo = new TransformHandlesGizmo(handler, resize);

    resize.refreshWireframeBySelectedItems();
    const start = resize.wireframe.anchor.clone();
    const matrix = [...item.transform.getWorldMatrix().elements];
    const position = item.transform.position.toArray();

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(20, 15))));
    expect(item.transform.anchor.length()).greaterThan(0);
    item.transform.getWorldMatrix().elements.forEach((value, index) => expect(value).closeTo(matrix[index], 1e-5));
    gizmo.onKeyDown(key());
    expect(item.transform.position.toArray()).deep.equals(position);
    expect(item.transform.anchor.length()).equals(0);
    resize.dispose();
  });

  for (const cancel of [false, true]) {
    it(`preserves an animated item through anchor dragging, resampling and ${cancel ? 'cancel' : 'commit'}`, () => {
      const { item, component } = path();
      const parent = DefaultVFXItems.createEmpty(composition);

      parent.transform.setScale(-1.2, 0.8, 1);
      parent.transform.setRotation(0, 0, 25);
      item.setParent(parent);
      item.transform.setScale(2, 1.5, 1);
      item.transform.setRotation(0, 0, 35);
      const original = structuredClone(findMotionPaths(item)[0].path);
      const matrix = [...item.transform.getWorldMatrix().elements];
      const resize = new ResizeSelectionGizmo(handler);
      const gizmo = new TransformHandlesGizmo(handler, resize);

      resize.refreshWireframeBySelectedItems();
      const start = resize.wireframe.anchor.clone();

      gizmo.onMouseDown(down(start));
      for (const offset of [new Vector2(20, 15), new Vector2(40, 30)]) {
        gizmo.onMouseDrag(drag(start.clone().add(offset)));
        component.sampleTime(component.getTime());
        item.transform.getWorldMatrix().elements.forEach((value, index) => expect(value).closeTo(matrix[index], 1e-5));
      }
      expect(findMotionPaths(item)[0].path).not.deep.equals(original);
      if (cancel) {
        gizmo.onKeyDown(key());
        gizmo.onMouseDrag(drag(start.clone().add(new Vector2(60, 45))));
        expect(item.transform.anchor.length()).equals(0);
        expect(findMotionPaths(item)[0].path).deep.equals(original);
      }
      gizmo.onMouseUp(down(start));
      component.sampleTime(component.getTime());
      item.transform.getWorldMatrix().elements.forEach((value, index) => expect(value).closeTo(matrix[index], 1e-5));
      expect(actions.filter(action => action.phase === 'actioncommit')).length(cancel ? 0 : 1);
      gizmo.dispose();
      resize.dispose();
    });
  }

  for (const axis of ['x', 'y']) {
    for (const rotatedCamera of [false, true]) {
      it(`moves a mixed-depth selection by the screen ${axis} delta with ${rotatedCamera
        ? 'a rotated'
        : 'the default'} camera`, () => {
        const parent = DefaultVFXItems.createEmpty(composition);
        const first = sprite();
        const second = sprite();

        parent.transform.setScale(-1.2, 0.8, 1);
        parent.transform.setRotation(10, 15, 25);
        first.setParent(parent);
        second.setParent(parent);
        first.setPosition(-1, 0, 6);
        second.setPosition(1, 0, -3);
        select(first, second);
        if (rotatedCamera) {
          composition.camera.rotation = new math.Euler(10, 18, 5);
        }
        const items = [first, second];
        const before = items.map(item => localToView(item, new Vector3()));
        const resize = new ResizeSelectionGizmo(handler);
        const gizmo = new TransformHandlesGizmo(handler, resize);

        resize.refreshWireframeBySelectedItems();
        const start = resize.wireframe.anchor.clone().add(axis === 'x' ? new Vector2(40, 0) : new Vector2(0, -40));

        gizmo.onMouseDown(down(start));
        gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 20))));
        items.forEach((item, index) => {
          const delta = localToView(item, new Vector3()).subtract(before[index]);

          expect(delta.x).closeTo(axis === 'x' ? 30 : 0, 1e-4);
          expect(delta.y).closeTo(axis === 'y' ? 20 : 0, 1e-4);
        });
        gizmo.onKeyDown(key());
        items.forEach((item, index) =>
          expect(localToView(item, new Vector3()).distance(before[index])).lessThan(1e-4),
        );
        gizmo.dispose();
        resize.dispose();
      });
    }
  }

  it('uniformly scales a group about its center and restores every member on Escape', () => {
    const first = sprite();
    const second = sprite();

    first.setPosition(-1, 0, 0);
    second.setPosition(1, 0, 0);
    select(first, second);
    const resize = new ResizeSelectionGizmo(handler);
    const gizmo = new TransformHandlesGizmo(handler, resize);

    resize.refreshWireframeBySelectedItems();
    const corner = getTransformedBoxCorners(resize.wireframe.transform!)[0];
    const center = resize.wireframe.anchor.clone();
    const press = down(corner);

    press.altPressed = true;
    gizmo.onMouseDown(press);
    gizmo.onMouseDrag(drag(center.clone().add(corner.clone().subtract(center).multiply(2)), false, true));
    expect(first.transform.position.x).closeTo(-2, 1e-5);
    expect(second.transform.position.x).closeTo(2, 1e-5);
    expect(first.transform.scale.x).closeTo(2, 1e-5);
    gizmo.onKeyDown(key());
    expect(first.transform.position.x).equals(-1);
    expect(second.transform.position.x).equals(1);
    resize.dispose();
  });

  it('rotates group positions together and rejects shear under a nonuniform parent', () => {
    for (const nonuniform of [false, true]) {
      const parent = DefaultVFXItems.createEmpty(composition);
      const first = sprite();
      const second = sprite();

      parent.transform.setScale(nonuniform ? 2 : 1, 1, 1);
      first.setParent(parent);
      second.setParent(parent);
      first.setPosition(-1, 0, 0);
      second.setPosition(1, 0, 0);
      select(first, second);
      const resize = new ResizeSelectionGizmo(handler);
      const gizmo = new TransformHandlesGizmo(handler, resize);

      resize.refreshWireframeBySelectedItems();
      const corner = getTransformedBoxCorners(resize.wireframe.transform!)[0];
      const center = resize.wireframe.anchor.clone();
      const start = corner.clone().add(new Vector2(-10, -10));
      const offset = start.clone().subtract(center);
      const angle = Math.PI / 4;
      const end = center.clone().add(new Vector2(
        offset.x * Math.cos(angle) - offset.y * Math.sin(angle),
        offset.x * Math.sin(angle) + offset.y * Math.cos(angle)
      ));

      gizmo.onMouseDown(down(start));
      gizmo.onMouseDrag(drag(end));
      expect(first.transform.position.x).closeTo(nonuniform ? -1 : -Math.cos(angle), 1e-5);
      expect(first.transform.position.y).closeTo(nonuniform ? 0 : Math.sin(angle), 1e-5);
      gizmo.onKeyDown(key());
      resize.dispose();
    }
  });

  for (const axis of ['x', 'y'] as const) {
    it(`preserves the existing orientation during Alt-${axis} rotation after a corner rotation`, () => {
      const item = sprite();

      item.rotate(0, 0, 30);
      const original = item.transform.quat.clone();
      const resize = new ResizeSelectionGizmo(handler);
      const gizmo = new TransformHandlesGizmo(handler, resize);

      try {
        resize.refreshWireframeBySelectedItems();
        const start = resize.wireframe.anchor.clone().add(axis === 'x' ? new Vector2(40, 0) : new Vector2(0, -40));
        let changes = 0;

        item.transform.on('changed', () => changes++);
        gizmo.onMouseDown(down(start, { altPressed: true }));
        gizmo.onMouseDrag(drag(start, false, true));
        expect(changes).equals(0);
        expect(item.transform.quat.toArray()).deep.equals(original.toArray());

        for (const amount of [10, 20, 100, 120, 400, 420]) {
          const delta = axis === 'x' ? new Vector2(0, amount) : new Vector2(amount, 0);

          gizmo.onMouseDrag(drag(start.clone().add(delta), false, true));
          const rotation = item.transform.rotation;

          expect(rotation.x).closeTo(axis === 'x' ? -amount : 0, 1e-5);
          expect(rotation.y).closeTo(axis === 'y' ? -amount : 0, 1e-5);
          expect(rotation.z).closeTo(30, 1e-5);
          const expected = new math.Quaternion().setFromEuler(new math.Euler(
            axis === 'x' ? -amount : 0, axis === 'y' ? -amount : 0, 30,
          )).conjugate();

          expect(Math.abs(item.transform.quat.dot(expected))).closeTo(1, 1e-8);
        }
        gizmo.onKeyDown(key());
        expect(item.transform.quat.toArray()).deep.equals(original.toArray());
      } finally {
        gizmo.dispose();
        resize.dispose();
      }
    });

    for (const kind of ['sprite', 'shape', 'host'] as const) {
      it(`aligns the ${kind} selection outline and handles with all four corners after ${axis} rotation`, () => {
        const item = kind === 'shape' ? gradient().item : sprite();
        const parent = DefaultVFXItems.createEmpty(composition);

        parent.transform.setRotation(10, -12, 20);
        parent.transform.setScale(-1.2, 0.8, 1);
        item.setParent(parent);
        item.transform.setSize(4, 2);
        item.transform.setAnchor(0.3, -0.2);
        item.transform.setRotation(axis === 'x' ? 45 : 0, axis === 'y' ? 50 : 0, 15);
        item.setPosition(0.4, -0.3, 2);
        const unregister = kind === 'host'
          ? registerItemGeometry(player.engine, target => target === item ? { min: [-2, -1], max: [2, 1] } : undefined)
          : undefined;
        const resize = new ResizeSelectionGizmo(handler);

        try {
          resize.refreshWireframeBySelectedItems();
          const corners = [new Vector3(-2, 1, 0), new Vector3(2, 1, 0), new Vector3(2, -1, 0), new Vector3(-2, -1, 0)]
            .map(point => localToView(item, point));

          expect(resize.wireframe.edges).length(4);
          expect(resize.wireframe.scaleCorners).length(4);
          corners.forEach((point, index) => {
            expect(resize.wireframe.edges[index].start.distance(point)).lessThan(1e-4);
            expect(resize.wireframe.edges[index].end.distance(corners[(index + 1) % 4])).lessThan(1e-4);
            expect(resize.wireframe.scaleCorners[index].center.distance(point)).lessThan(1e-4);
          });
          const center = localToView(item, new Vector3());
          const transform = resize.wireframe.transform!;
          const local = inverseTransformBoxPoint(transform, center);

          expect(local.x).closeTo(0.5, 1e-5);
          expect(local.y).closeTo(0.5, 1e-5);
          expect(transformBoxPoint(transform, new Vector2(0.5, 0.5)).distance(center)).lessThan(1e-4);
          const bounds = getItemViewBox(item, new Vector2(800, 600));

          expect(bounds.min.x).closeTo(Math.min(...corners.map(point => point.x)), 1e-4);
          expect(bounds.max.x).closeTo(Math.max(...corners.map(point => point.x)), 1e-4);
          expect(bounds.min.y).closeTo(Math.min(...corners.map(point => point.y)), 1e-4);
          expect(bounds.max.y).closeTo(Math.max(...corners.map(point => point.y)), 1e-4);
        } finally {
          unregister?.();
          resize.dispose();
        }
      });
    }
  }

  for (const includeChildren of [undefined, false, true]) {
    it(`honors custom geometry child aggregation for frames (${includeChildren})`, () => {
      const frame = DefaultVFXItems.createEmpty(composition);

      frame.addComponent(FrameComponent);
      const child = sprite();

      child.setParent(frame);
      child.setPosition(5, 0, 0);
      child.transform.setSize(2, 2);
      const unregister = registerItemGeometry(player.engine, item => item === frame
        ? { min: [-1, -1], max: [1, 1], includeChildren }
        : undefined);

      try {
        const bounds = getItemViewBox(frame, new Vector2(800, 600));
        const frameRight = localToView(frame, new Vector3(1, 0, 0)).x;
        const childRight = localToView(child, new Vector3(1, 0, 0)).x;

        expect(bounds.max.x).closeTo(includeChildren ? childRight : frameRight, 1e-5);
        expect(bounds.containsPoint(localToView(child, new Vector3()))).equals(includeChildren === true);
      } finally {
        unregister();
      }
    });
  }

  for (const rotation of [[55, 30, 0], [0, 60, 0], [-50, -25, 15]] as const) {
    it(`follows both perspective text edges with width hit bands (${rotation})`, () => {
      const item = DefaultVFXItems.createText(composition);

      item.transform.setSize(4, 4);
      item.transform.setRotation(rotation[0], rotation[1], rotation[2]);
      select(item);
      const resize = new ResizeSelectionGizmo(handler);

      try {
        resize.refreshWireframeBySelectedItems();
        expect(resize.wireframe.widthScaleAreas).length(2);
        for (const edge of resize.wireframe.widthScaleEdges) {
          for (const ratio of [0.25, 0.5, 0.75]) {
            resize.refreshTransformType(edge.at(ratio));
            expect(resize.activeType).equals(TransformType.WIDTH_SCALE);
          }
        }
        for (const corner of resize.wireframe.scaleCorners) {
          resize.refreshTransformType(corner.center);
          expect(resize.activeType).equals(TransformType.SCALE);
        }
      } finally {
        resize.dispose();
      }
    });
  }

  for (const initialY of [80, -80, 90, -90, 100, -100, 460, -460]) {
    it(`accumulates Alt-Y rotation from ${initialY} degrees without folding the angles`, () => {
      const item = sprite();

      item.transform.setRotation(15, initialY, 30);
      const original = item.transform.quat.clone();
      const originalRotation = item.transform.rotation.toArray();
      const resize = new ResizeSelectionGizmo(handler);
      const gizmo = new TransformHandlesGizmo(handler, resize);

      try {
        resize.refreshWireframeBySelectedItems();
        const start = resize.wireframe.anchor.clone().add(new Vector2(0, -40));

        gizmo.onMouseDown(down(start, { altPressed: true }));
        for (const distance of [10, 20, 40, 80, 280, 380, 360]) {
          const angle = Math.sign(initialY) * distance;

          gizmo.onMouseDrag(drag(start.clone().add(new Vector2(-angle, 0)), false, true));
          const angles = [15, initialY + angle, 30] as const;
          const expected = new math.Quaternion().setFromEuler(new math.Euler(...angles)).conjugate();

          expect(Math.abs(item.transform.quat.dot(expected))).closeTo(1, 1e-8);
          item.transform.rotation.toArray().forEach((value, index) => expect(value).closeTo(angles[index], 1e-5));
        }
        gizmo.onKeyDown(key());
        expect(item.transform.quat.toArray()).deep.equals(original.toArray());
        expect(item.transform.rotation.toArray()).deep.equals(originalRotation);
      } finally {
        gizmo.dispose();
        resize.dispose();
      }
    });
  }

  it('keeps separate Alt-Y angles through modifier changes and subsequent drags', () => {
    const items = [sprite(), sprite()];

    items[0].transform.setRotation(5, 80, 25);
    items[1].transform.setRotation(-10, 100, -15);
    select(...items);
    const resize = new ResizeSelectionGizmo(handler);
    const gizmo = new TransformHandlesGizmo(handler, resize);
    const expectRotation = (amount: number) => {
      items.forEach((item, index) => {
        const angles = index === 0 ? [5, 80 + amount, 25] as const : [-10, 100 + amount, -15] as const;
        const expected = new math.Quaternion().setFromEuler(new math.Euler(...angles)).conjugate();

        item.transform.rotation.toArray().forEach((value, axis) => expect(value).closeTo(angles[axis], 1e-5));
        expect(Math.abs(item.transform.quat.dot(expected))).closeTo(1, 1e-8);
      });
    };

    try {
      resize.refreshWireframeBySelectedItems();
      const start = resize.wireframe.anchor.clone().add(new Vector2(0, -40));

      gizmo.onMouseDown(down(start));
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(0, 10))));
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(-10, 10)), false, true));
      expectRotation(0);
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(-30, 10)), false, true));
      expectRotation(20);
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(-40, 10))));
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(-40, 20))));
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(-50, 20)), false, true));
      expectRotation(20);
      const end = start.clone().add(new Vector2(-70, 20));

      gizmo.onMouseDrag(drag(end, false, true));
      expectRotation(40);
      gizmo.onMouseUp(down(end, { altPressed: true }));
      expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
      const committed = items.map(item => item.transform.quat.toArray());

      resize.refreshWireframeBySelectedItems();
      const nextStart = resize.wireframe.anchor.clone().add(new Vector2(0, -40));

      gizmo.onMouseDown(down(nextStart, { altPressed: true }));
      gizmo.onMouseDrag(drag(nextStart.clone().add(new Vector2(-20, 0)), false, true));
      expectRotation(60);
      gizmo.onKeyDown(key());
      expectRotation(40);
      items.forEach((item, index) => expect(item.transform.quat.toArray()).deep.equals(committed[index]));
    } finally {
      gizmo.dispose();
      resize.dispose();
    }
  });

  it('constrains an axis drag and rebases when Alt changes its meaning', () => {
    const item = sprite();
    const resize = new ResizeSelectionGizmo(handler);
    const gizmo = new TransformHandlesGizmo(handler, resize);

    resize.refreshWireframeBySelectedItems();
    const start = resize.wireframe.anchor.clone().add(new Vector2(40, 0));

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 20))));
    expect(item.transform.position.x).greaterThan(0);
    expect(item.transform.position.y).equals(0);
    const position = item.transform.position.clone();

    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 20)), false, true));
    expect(item.transform.position.toArray()).deep.equals(position.toArray());
    expect(item.transform.rotation.x).equals(0);
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 40)), false, true));
    expect(item.transform.rotation.x).closeTo(-20, 1e-5);
    gizmo.onKeyDown(key());
    expect(item.transform.position.length()).equals(0);
    expect(item.transform.rotation.x).closeTo(0, 1e-5);
    resize.dispose();
  });

  it('forwards Escape to the existing move tool and ignores the remaining captured drag', () => {
    const item = sprite();
    const gizmo = new ClickDragMultiplexGizmo(handler, {
      clickCandidates: [],
      dragCandidates: [new MoveSelectionGizmo(handler)],
    });
    const start = localToView(item, new Vector3());
    const position = item.transform.position.toArray();

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(35, 20))));
    expect(item.transform.position.toArray()).not.deep.equals(position);
    gizmo.onKeyDown(key());
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(70, 40))));
    gizmo.onMouseUp(down(start));
    expect(item.transform.position.toArray()).deep.equals(position);
    expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
    expect(actions.at(-1)?.canceled).equals(true);
    gizmo.dispose();
  });

  for (const operation of ['resize', 'rotate']) {
    it(`restores the existing ${operation} tool on Escape, including mirrored transforms`, () => {
      const item = sprite();

      item.transform.setScale(1.2, -1.5, 1);
      item.transform.setRotation(0, 0, 20);
      const resize = new ResizeSelectionGizmo(handler);
      const gizmo = operation === 'resize' ? resize : new CornerRotationGizmo(handler, resize);

      resize.refreshWireframeBySelectedItems();
      const center = resize.wireframe.anchor.clone();
      const corner = resize.wireframe.scaleCorners[0].center.clone();
      const start = operation === 'resize'
        ? corner
        : corner.clone().add(corner.clone().subtract(center).normalize().multiply(12));
      const offset = start.clone().subtract(center);
      const end = operation === 'resize' ? center.clone().add(offset.clone().multiply(1.5))
        : center.clone().add(new Vector2(offset.x - offset.y, offset.x + offset.y).multiply(Math.SQRT1_2));
      const matrix = [...item.transform.getWorldMatrix().elements];
      const rotation = item.transform.rotation.clone();
      const press = down(start);

      gizmo.onMouseDown(press);
      expect(press.isAccepted()).equals(true);
      gizmo.onMouseDrag(drag(end));
      expect([...item.transform.getWorldMatrix().elements]).not.deep.equals(matrix);
      gizmo.onKeyDown(key());
      gizmo.onMouseDrag(drag(end));
      gizmo.onMouseUp(down(end));
      item.transform.getWorldMatrix().elements.forEach((value, index) => expect(value).closeTo(matrix[index], 1e-5));
      expect(item.transform.rotation.toArray()).deep.equals(rotation.toArray());
      expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
      expect(actions.at(-1)?.canceled).equals(true);
      gizmo.dispose();
      resize.dispose();
    });
  }

  it('moves the dragged control and keeps its opposite fixed while Alt is pressed', () => {
    const { item, gizmo } = path();
    const original = structuredClone(findMotionPaths(item)[0].path);
    const start = localToView(item, new Vector3(...original[2][1]), item.transform.getParentMatrix());

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(20, -20)), false, true));
    const controls = findMotionPaths(item)[0].path[2];
    const moved = localToView(item, new Vector3(...controls[1]), item.transform.getParentMatrix());

    expect(controls[1]).not.deep.equals(original[2][1]);
    expect(moved.x - start.x).closeTo(20, 1e-5);
    expect(moved.y - start.y).closeTo(-20, 1e-5);
    expect(controls[2]).deep.equals(original[2][2]);
    gizmo.dispose();
  });

  it('restores content immediately on mode exit despite a later captured drag', () => {
    const { item, component, points } = lattice();
    const mode = handler.getActiveEditMode() as SelectionEditMode;

    handler.setActiveTool(new MoveGizmoTool(handler));
    mode.editContent({ type: 'lattice' });
    const gizmo = handler.getGizmoManager().get('crystal-lattice')!;
    const start = localToView(item, points[0]);

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(20, 0))));
    mode.onExit();
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(40, 0))));
    gizmo.onMouseUp(down(start));
    expect(component.getLattice().points.map(point =>
      point.toArray())).deep.equals(points.map(point =>
      point.toArray()));
    expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
  });

  for (const effectsMode of [false, true]) {
    for (const transition of ['rebuild', 'mode-exit']) {
      it(`continues a captured move until release across ${transition} in ${effectsMode
        ? 'effects'
        : 'default'} mode`, () => {
        const item = sprite();
        const options = { showMotionPath: false, showTransformHandles: false };

        handler.setActiveTool(new MoveGizmoTool(handler));
        handler.setActiveEditMode(effectsMode ? new SelectionEditMode(handler, {
          ...options,
          effectsItemId: composition.sceneRoot.getInstanceId(),
        })
          : new SelectionEditMode(handler, options));
        select(item);
        const gizmo = handler.getGizmoManager().get('click-drag-multiplex')!;
        const dispose = chai.spy.on(gizmo, 'dispose');
        const viewport = (handler as unknown as { gizmoViewport: GizmoViewport }).gizmoViewport;
        const start = localToView(item, new Vector3());
        const original = item.transform.position.toArray();

        viewport.onMouseDown(down(start));
        viewport.onMouseMove(drag(start.clone().add(new Vector2(35, 20))));
        const moved = item.transform.position.toArray();

        expect(moved).not.deep.equals(original);
        if (transition === 'rebuild') {
          handler.rebuildGizmos();
        } else {
          handler.setActiveEditMode(new SelectionEditMode(handler, options));
        }
        expect(item.transform.position.toArray()).deep.equals(moved);
        expect(dispose).not.to.have.been.called();
        const end = start.clone().add(new Vector2(70, 40));

        viewport.onMouseMove(drag(end));
        expect(item.transform.position.toArray()).not.deep.equals(moved);
        viewport.onMouseUp(down(end, { pressed: false, buttonMask: MouseButtonMask.None }));
        expect(dispose).to.have.been.called.once;
        expect(actions.filter(action => action.canceled)).length(0);
        expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
      });
    }

    for (const content of ['lattice', 'gradient'] as const) {
      it(`preserves captured ${content} across rebuild and cancels it on content exit in ${effectsMode
        ? 'effects'
        : 'default'} mode`, () => {
        const target = content === 'lattice' ? lattice() : gradient();
        const { item } = target;
        const read = () => 'points' in target ? target.component.getLattice().points.map(point => point.toArray())
          : getGradientPaint(target.component, 'fill', 0)!.startPoint.toArray();
        const original = read();

        handler.setActiveTool(new MoveGizmoTool(handler));
        if (effectsMode) {
          handler.setActiveEditMode(new SelectionEditMode(handler, {
            effectsItemId: composition.sceneRoot.getInstanceId(),
          }));
          select(item);
        }
        const mode = handler.getActiveEditMode() as SelectionEditMode;

        mode.editContent(content === 'lattice' ? {
          type: 'lattice',
        } : {
          type: 'gradient',
          paintKind: 'fill',
          paintIndex: 0,
        });
        const gizmo = handler.getGizmoManager().get(content === 'lattice'
          ? GizmoType.CRYSTAL_LATTICE
          : GizmoType.GRADIENT)!;
        const dispose = chai.spy.on(gizmo, 'dispose');
        const viewport = (handler as unknown as { gizmoViewport: GizmoViewport }).gizmoViewport;
        const start = localToView(item, 'points' in target ? target.points[0] : new Vector3(-1.2, 0, 0));

        viewport.onMouseDown(down(start));
        viewport.onMouseMove(drag(start.clone().add(new Vector2(20, 0))));
        const moved = read();

        expect(moved).not.deep.equals(original);
        handler.rebuildGizmos();
        expect(read()).deep.equals(moved);
        viewport.onMouseMove(drag(start.clone().add(new Vector2(30, 0))));
        expect(read()).not.deep.equals(moved);
        mode.editContent();
        expect(read()).deep.equals(original);
        expect(dispose).not.to.have.been.called();
        viewport.onMouseMove(drag(start.clone().add(new Vector2(40, 0))));
        viewport.onMouseUp(down(start, { pressed: false, buttonMask: MouseButtonMask.None }));
        expect(dispose).to.have.been.called.once;
        expect(read()).deep.equals(original);
        expect(actions.filter(action => action.canceled)).length(1);
        expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
      });
    }
  }

  for (const content of ['lattice', 'gradient'] as const) {
    it(`uses the standalone ${content} mode and cancels its captured drag after a rebuild on exit`, () => {
      const target = content === 'lattice' ? lattice() : gradient();
      const read = () => 'points' in target ? target.component.getLattice().points.map(point => point.toArray())
        : getGradientPaint(target.component, 'fill', 0)!.startPoint.toArray();
      const original = read();
      const mode = content === 'lattice' ? new LatticeEditMode(handler) : new GradientEditMode(handler);

      handler.setActiveTool(new MoveGizmoTool(handler));
      expect(mode.canEdit()).equals(true);
      handler.setActiveEditMode(mode);
      const type = content === 'lattice' ? GizmoType.CRYSTAL_LATTICE : GizmoType.GRADIENT;
      const gizmo = handler.getGizmoManager().get(type)!;
      const viewport = (handler as unknown as { gizmoViewport: GizmoViewport }).gizmoViewport;
      const start = localToView(target.item, 'points' in target ? target.points[0] : new Vector3(-1.2, 0, 0));

      expect(handler.getGizmoManager().get('transform-handles')).equals(undefined);
      expect(handler.getGizmoManager().get('resize-selection')).equals(undefined);
      expect(handler.getGizmoManager().get('curve')).equals(undefined);
      viewport.onMouseDown(down(start));
      viewport.onMouseMove(drag(start.clone().add(new Vector2(20, 0))));
      const moved = read();

      expect(moved).not.deep.equals(original);
      handler.rebuildGizmos();
      expect(read()).deep.equals(moved);
      viewport.onMouseMove(drag(start.clone().add(new Vector2(30, 0))));
      expect(read()).not.deep.equals(moved);
      handler.setActiveEditMode(new SelectionEditMode(handler));
      expect(read()).deep.equals(original);
      viewport.onMouseMove(drag(start.clone().add(new Vector2(40, 0))));
      viewport.onMouseUp(down(start, { pressed: false, buttonMask: MouseButtonMask.None }));
      expect(read()).deep.equals(original);
      expect(actions.filter(action => action.canceled)).length(1);
      expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
      expect(handler.getGizmoManager().get(type)).equals(undefined);
    });
  }

  it('switches content editing inside the existing selection mode', () => {
    const { item } = lattice();
    const mode = handler.getActiveEditMode() as SelectionEditMode;

    expect(mode.editContent({ type: 'lattice' })).equals(true);
    expect(handler.getActiveEditMode()).equals(mode);
    expect(handler.getSelection().getSelectedPlayerItems()).deep.equals([item]);
    expect(mode.createGizmos().map(gizmo => gizmo.type)).deep.equals(['ffd-wireframe', 'crystal-lattice']);
    mode.editContent();
  });

  it('keeps the original selection modes free of optional editing gizmos', () => {
    const ordinary = new GestureHandler(player.engine);

    try {
      expect(ordinary.getActiveEditMode()).instanceOf(DefaultSelectionMode);
      ordinary.setActiveTool(new MoveGizmoTool(ordinary));
      expect(ordinary.getGizmoManager().get('ffd-wireframe')).equals(undefined);
      expect(ordinary.getGizmoManager().get('curve')).equals(undefined);
      expect(ordinary.getGizmoManager().get('transform-handles')).equals(undefined);
      const selectionMode = new DefaultSelectionMode(ordinary);

      ordinary.setActiveEditMode(selectionMode);
      ordinary.resetEditMode();
      expect(ordinary.getActiveEditMode()).equals(selectionMode);
      ordinary.setActiveTool(new GizmoTool(ordinary));
      expect(ordinary.getActiveEditMode()).equals(selectionMode);
      const effects = new EffectsEditMode(ordinary, composition.sceneRoot.getInstanceId()).createGizmos();

      expect(effects.map(gizmo => gizmo.type)).deep.equals([
        'corner-rotation', 'resize-selection', 'leave-effects-edit', 'click-drag-multiplex',
      ]);
      effects.forEach(gizmo => gizmo.dispose());
    } finally {
      ordinary.dispose();
    }
  });

  it('reactivates the complete mode in the demo through the existing mode API', () => {
    const editor = new DemoEditor(player, new DemoScene(player, composition), handler, container);

    try {
      for (const tool of ['pen', 'shape', 'frame', 'text'] as const) {
        editor.setTool(tool);
        editor.setTool('move');
        expect(handler.getActiveEditMode()).instanceOf(SelectionEditMode);
        expect(handler.getGizmoManager().get('ffd-wireframe')).instanceOf(FFDWireframeGizmo);
        expect(handler.getGizmoManager().get('curve')).instanceOf(CurveGizmo);
        expect(handler.getGizmoManager().get('transform-handles')).instanceOf(TransformHandlesGizmo);
      }
    } finally {
      editor.dispose();
    }
  });

  it('loads the reference FFD mesh and restores its already-deformed 5 × 5 lattice', async function () {
    this.timeout(10000);
    const { item } = await createGizmoReference(composition, 'ffd');

    player.tick(0);
    select(item);
    const component = item.getComponent(FFDComponent);
    const original = component.getLattice();
    const gizmo = new CrystalLatticeGizmo(handler, item);

    expect([original.rows, original.columns, original.points.length]).deep.equals([5, 5, 25]);
    expect(original.points[5].x).closeTo(-4.5545, 1e-5);
    expect(wireframeTriangles(item.getComponent(SpriteComponent).geometry).length).greaterThan(2);
    const start = localToView(item, original.points[5]);

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(35, 20))));
    expect(component.getLattice().points[5].x).not.equals(original.points[5].x);
    gizmo.onKeyDown(key());
    gizmo.onMouseUp(down(start));
    expect(component.getLattice().points.map(point =>
      point.toArray())).deep.equals(original.points.map(point =>
      point.toArray()));
  });

  it('edits the reference path through its ObjectBindingTrack and keeps its keyframe time', async function () {
    this.timeout(10000);
    const { root, item } = await createGizmoReference(composition, 'path');

    player.tick(0);
    select(item);
    const paths = findMotionPaths(item);

    expect(paths).length(1);
    expect(paths[0].clip.duration).equals(5);
    expect(paths[0].path[1][1]).deep.equals([2.3911, -5.357, 0]);
    const original = structuredClone(paths[0].path);
    const gizmo = new CurveGizmo(handler);
    const start = localToView(item, new Vector3(...original[1][1]), item.transform.getParentMatrix());

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, -15))));
    expect(findMotionPaths(item)[0].path[1][1]).not.deep.equals(original[1][1]);
    expect(actions.at(-1)?.keyframeTime).closeTo(2.74, 1e-6);
    const timeline = root.getComponent(CompositionComponent);

    timeline.setTime(3);
    expect(item.transform.position.x).closeTo(findMotionPaths(item)[0].path[1][1][0], 1e-5);
    gizmo.onKeyDown(key());
    expect(findMotionPaths(item)[0].path).deep.equals(original);
    expect(timeline.getTime()).equals(3);
  });

  it('loads the reference angular gradient and switches color modes without changing geometry or stops', async function () {
    this.timeout(10000);
    const { item } = await createGizmoReference(composition, 'gradient');

    player.tick(0);
    select(item);
    const shape = item.getComponent(ShapeComponent);
    const original = getGradientPaint(shape, 'fill', 0)!;
    const bounds = getShapeRenderBounds(shape)!;

    expect(original.type).equals(spec.FillType.GradientAngular);
    expect(original.gradientStops.stops[0].color.r).closeTo(0.8941, 1e-6);
    expect(bounds.max.x - bounds.min.x).closeTo(7.8171, 1e-5);
    const gizmo = new GradientGizmo(handler, item);
    const start = localToView(item, new Vector3(bounds.max.x, 0, 0));

    gizmo.onMouseDown(down(start));
    gizmo.onMouseDrag(drag(start.clone().add(new Vector2(20, -15))));
    expect(getGradientPaint(shape, 'fill', 0)!.endPoint.toArray()).not.deep.equals(original.endPoint.toArray());
    gizmo.onKeyDown(key());
    for (const type of [
      spec.FillType.Solid,
      spec.FillType.GradientLinear,
      spec.FillType.GradientAngular,
      spec.FillType.GradientRadial,
    ] as const) {
      setColorPaint(shape, 'fill', 0, type === spec.FillType.Solid ? {
        type,
        color: original.gradientStops.stops[0].color,
      } : {
        ...original,
        type,
      });
      shape.onUpdate(0);
      expect(shape.material.getFloat('_FillType')).equals(type);
      expect(getShapeRenderBounds(shape)!.min.toArray()).deep.equals(bounds.min.toArray());
      if (type !== spec.FillType.Solid) {
        expect(getGradientPaint(shape, 'fill', 0)!.gradientStops.stops.map(stop =>
          stop.color.toArray())).deep.equals(original.gradientStops.stops.map(stop =>
          stop.color.toArray()));
      }
    }
  });

  for (const axis of ['x', 'y'] as const) {
    it(`uses directional cursors for ${axis} movement and Alt rotation`, () => {
      const item = sprite();
      const resize = new ResizeSelectionGizmo(handler);
      const gizmo = new TransformHandlesGizmo(handler, resize);
      let cursor: GestureCursorType | undefined;

      handler.setCursor = result => {
        cursor = result.type;
      };
      resize.refreshWireframeBySelectedItems();
      const start = resize.wireframe.anchor.clone().add(axis === 'x' ? new Vector2(40, 0) : new Vector2(0, -40));
      const hover = drag(start);

      gizmo.onMouseMove(hover);
      expect(cursor).equals(axis === 'x' ? GestureCursorType.HORIZONTAL_ARROW : GestureCursorType.VERTICAL_ARROW);
      hover.altPressed = true;
      gizmo.onMouseMove(hover);
      expect(cursor).equals(axis === 'x' ? GestureCursorType.VERTICAL_ARROW : GestureCursorType.HORIZONTAL_ARROW);
      const press = down(start);

      press.altPressed = true;
      gizmo.onMouseDown(press);
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(18, 24)), false, true));
      expect(item.transform.rotation[axis]).closeTo(axis === 'x' ? -24 : -18, 1e-5);
      expect(item.transform.rotation[axis === 'x' ? 'y' : 'x']).equals(0);
      gizmo.onKeyDown(key());
      resize.dispose();
    });
  }

  it('centers both normalized anchor labels inside their background and shows grab cursors', () => {
    const item = sprite();
    const resize = new ResizeSelectionGizmo(handler);
    const gizmo = new TransformHandlesGizmo(handler, resize);
    let cursor: GestureCursorType | undefined;
    const rectangles: number[][] = [];
    const labels: { x: number, y: number, text: string }[] = [];
    const measureText = (text: string, size: number) => player.engine.renderingServer.graphics.measureText(text, size);
    const control = { drawLine: () => {}, fillTriangle: () => {}, fillCircle: () => {}, drawCircle: () => {},
      fillRect: (x: number, y: number, w: number, h: number) => rectangles.push([x, y, w, h]),
      drawText: (x: number, y: number, text: string) => labels.push({ x, y, text }), measureText };

    handler.setCursor = result => {
      cursor = result.type;
    };
    resize.refreshWireframeBySelectedItems();
    const anchor = resize.wireframe.anchor.clone();

    gizmo.onMouseMove(drag(anchor));
    expect(cursor).equals(GestureCursorType.HAND);
    gizmo.draw(control as never);
    expect(labels.map(label => label.text)).deep.equals(['x: 0.5', 'y: 0.5']);
    gizmo.onMouseDown(down(anchor));
    expect(cursor).equals(GestureCursorType.ACTIVE_HAND);
    gizmo.onKeyDown(key());
    moveAnchor(item, new Vector3(-12.85, -2, 0));
    resize.refreshWireframeBySelectedItems();
    gizmo.onMouseMove(drag(resize.wireframe.anchor));
    rectangles.length = 0;
    labels.length = 0;
    gizmo.draw(control as never);
    const [x, y, width, height] = rectangles[0];
    const tops: number[] = [];
    const bottoms: number[] = [];

    for (const label of labels) {
      const metric = measureText(label.text, 12);

      expect(label.x + metric.width / 2).closeTo(x + width / 2, 1e-5);
      expect(metric.width).at.most(width - 16);
      tops.push(label.y + metric.inkTop);
      bottoms.push(label.y + metric.inkTop + metric.inkHeight);
    }
    expect(Math.min(...tops) - y).closeTo(6, 1e-5);
    expect(y + height - Math.max(...bottoms)).closeTo(6, 1e-5);
    resize.dispose();
  });
  describe('review regressions', () => {
    for (const operation of ['rotate', 'scale'] as const) {
      it(`keeps the current anchor as the pivot after ${operation} and position resampling`, () => {
        const { item, component } = path();

        component.sampleTime(4);
        item.transform.setScale(2, 1.5, 1);
        item.transform.setRotation(0, 0, 20);
        const resize = new ResizeSelectionGizmo(handler), gizmo = new TransformHandlesGizmo(handler, resize);

        resize.refreshWireframeBySelectedItems();
        const start = resize.wireframe.anchor.clone();

        gizmo.onMouseDown(down(start));
        gizmo.onMouseDrag(drag(start.clone().add(new Vector2(30, 20))));
        gizmo.onMouseUp(down(start));
        component.sampleTime(component.getTime());
        const anchor = item.transform.anchor.clone();
        const pivot = anchor.clone().applyMatrix(item.transform.getWorldMatrix());
        const origin = new Vector3().applyMatrix(item.transform.getWorldMatrix());

        expect(anchor.length()).greaterThan(0);
        if (operation === 'rotate') { item.transform.setRotation(0, 0, 65); } else { item.transform.setScale(3, 2.5, 1); }
        const edited = Array.from(item.transform.getWorldMatrix().elements);

        expect(new Vector3().applyMatrix(item.transform.getWorldMatrix()).distance(origin)).greaterThan(0.01);
        expect(anchor.clone().applyMatrix(item.transform.getWorldMatrix()).distance(pivot)).lessThan(1e-6);
        component.sampleTime(component.getTime());
        expect(anchor.clone().applyMatrix(item.transform.getWorldMatrix()).distance(pivot)).lessThan(1e-6);
        item.transform.getWorldMatrix().elements.forEach((value, index) => expect(value).closeTo(edited[index], 1e-6));
        gizmo.dispose(); resize.dispose();
      });
    }

    it('marquee-selects from the lattice center when oversized handles cover it', () => {
      const { item, component, points, gizmo } = lattice();

      handler.getConfigManager().set(crystalLatticeConfig, { cornerSize: 2000 });
      gizmo.selected.add(0); gizmo.selected.add(5);
      const center = localToView(item, points[0].clone().add(points[5]).multiply(0.5));
      const end = localToView(item, points[5]).add(new Vector2(10, -10));

      gizmo.onMouseDown(down(center));
      expect(gizmo.selected.size).equals(0);
      gizmo.onMouseDrag(drag(end));
      const drawing = recordDrawing();

      gizmo.draw(drawing.control);
      expect(drawing.calls.some(call => call.text?.includes('NaN'))).equals(false);
      gizmo.onMouseUp(down(end));
      expect(Array.from(gizmo.selected).sort()).deep.equals([4, 5]);
      expect(component.getLattice().points.map(point => point.toArray())).deep.equals(points.map(point => point.toArray()));
      expect(actions.filter(action => action.phase === 'actioncommit')).length(0);
      gizmo.dispose();
    });

    it('retains a committed gradient when its listener exits content editing', () => {
      const { item, component } = gradient();

      handler.setActiveTool(new MoveGizmoTool(handler));
      const mode = handler.getActiveEditMode() as SelectionEditMode;

      mode.editContent({ type: 'gradient', paintKind: 'fill', paintIndex: 0 });
      const gizmo = handler.getGizmoManager().get('gradient')!;
      const start = localToView(item, new Vector3(-1.2, 0, 0));

      gizmo.onMouseDown(down(start));
      gizmo.onMouseDrag(drag(start.clone().add(new Vector2(25, 10))));
      const expected = getGradientPaint(component, 'fill', 0);

      handler.on('actioncommit', () => mode.editContent());
      gizmo.onMouseUp(down(start));
      expect(getGradientPaint(component, 'fill', 0)).deep.equals(expected);
      expect(actions.filter(action => action.phase === 'actioncommit')).length(1);
      expect(actions.some(action => action.canceled)).equals(false);
    });

    it('returns a radial gradient to its direction at an off-axis rotation press', () => {
      const { item, component, gizmo } = gradient(spec.FillType.GradientRadial);
      const original = getGradientPaint(component, 'fill', 0)!;
      const press = localToView(item, new Vector3(1.2, 0, 0)).add(new Vector2(10, -8));

      gizmo.onMouseDown(down(press));
      gizmo.onMouseDrag(drag(press.clone().add(new Vector2(0, -20))));
      expect(getGradientPaint(component, 'fill', 0)!.endPoint.distance(original.endPoint)).greaterThan(0.01);
      gizmo.onMouseDrag(drag(press));
      gizmo.onMouseUp(down(press));
      expect(getGradientPaint(component, 'fill', 0)!.endPoint.distance(original.endPoint)).lessThan(1e-6);
    });

    it('inserts at the visible lane center under nonuniform scaling', () => {
      const { item, component, gizmo } = gradient();

      item.transform.setScale(3, 1, 1);
      const paint = getGradientPaint(component, 'fill', 0)!;

      paint.startPoint.set(0.2, 0.1); paint.endPoint.set(0.45, 0.9);
      setGradientPaint(component, 'fill', 0, paint);
      handler.getConfigManager().set(gradientConfig, { stopOffset: 20, stopWidth: 16 });
      const a = localToView(item, new Vector3(-1.2, -0.8, 0));
      const b = localToView(item, new Vector3(-0.2, 0.8, 0));
      const direction = b.clone().subtract(a);
      const normal = new Vector2(-direction.y, direction.x).normalize();
      const press = a.clone().add(b).multiply(0.5).add(normal.multiply(20));

      gizmo.onMouseDown(down(press)); gizmo.onMouseUp(down(press));
      const stops = getGradientPaint(component, 'fill', 0)!.gradientStops.stops;

      expect(stops).length(3); expect(stops[1].time).closeTo(0.5, 1e-6);
    });

    for (const operation of ['scale', 'rotate'] as const) {
      for (const cancel of [false, true]) {
        for (const anchored of [false, true]) {
          it(`updates animated group paths for ${operation} and ${cancel ? 'cancel' : 'commit'} (anchor edited=${anchored})`, () => {
            const { item, component } = path();

            // Use an exact keyframe so this assertion does not include arc-length sampling roundoff.
            component.sampleTime(4);
            if (anchored) {
              const resize = new ResizeSelectionGizmo(handler), gizmo = new TransformHandlesGizmo(handler, resize);

              resize.refreshWireframeBySelectedItems();
              const start = resize.wireframe.anchor.clone();

              gizmo.onMouseDown(down(start));
              gizmo.onMouseDrag(drag(start.clone().add(new Vector2(15, 10))));
              gizmo.onMouseUp(down(start));
              component.sampleTime(component.getTime());
              gizmo.dispose(); resize.dispose();
            }
            const second = sprite();

            second.setPosition(2, -1, 0); select(item, second);
            const original = structuredClone(findMotionPaths(item)[0].path);
            const resize = new ResizeSelectionGizmo(handler);
            const gizmo = new TransformHandlesGizmo(handler, resize);

            resize.refreshWireframeBySelectedItems();
            const corner = getTransformedBoxCorners(resize.wireframe.transform!)[0];
            const center = resize.wireframe.anchor.clone();
            const start = operation === 'scale' ? corner : corner.clone().add(new Vector2(-10, -10));
            const offset = start.clone().subtract(center);
            const end = operation === 'scale' ? center.clone().add(offset.multiply(1.5))
              : center.clone().add(new Vector2(offset.x * Math.cos(0.4) - offset.y * Math.sin(0.4), offset.x * Math.sin(0.4) + offset.y * Math.cos(0.4)));

            gizmo.onMouseDown(down(start, { altPressed: true }));
            gizmo.onMouseDrag(drag(end, false, true));
            const editedPosition = item.transform.position.clone();

            expect(findMotionPaths(item)[0].path).not.deep.equals(original);
            if (cancel) { gizmo.onKeyDown(key()); }
            gizmo.onMouseUp(down(end)); component.sampleTime(component.getTime());
            if (cancel) { expect(findMotionPaths(item)[0].path).deep.equals(original); } else { expect(item.transform.position.distance(editedPosition)).lessThan(1e-5); }
            gizmo.dispose(); resize.dispose();
          });
        }
      }
    }

    for (const separateTrack of [false, true]) {
      for (const cancel of [false, true]) {
        it(`uses one current anchor across animated channels after repeated edits (separate=${separateTrack}, cancel=${cancel})`, () => {
          const { item, clip, component } = path();
          const animation: Pick<spec.TransformPlayableAssetData, 'sizeOverLifetime' | 'rotationOverLifetime'> = {
            sizeOverLifetime: { size: [spec.ValueType.LINE, [[0, 1], [1, 3]]] },
            rotationOverLifetime: { asRotation: true, z: [spec.ValueType.LINE, [[0, 10], [1, 80]]] },
          };

          if (separateTrack) {
            const track = new TransformTrack(player.engine);
            const animated = track.createClip(TransformPlayableAsset);

            animated.fromData({ id: animated.getInstanceId(), dataType: spec.DataType.TransformPlayableAsset,
              start: 2, duration: 4, endBehavior: spec.EndBehavior.freeze, ...animation });
            component.timelineAsset!.tracks.push(track);
            component.timelineAsset!.markAsChanged();
            component.setBinding(track, item);
          } else {
            clip.fromData({ ...clip.transformAnimationData, ...animation });
          }
          component.onAwake();
          for (const time of [3, 5]) {
            component.sampleTime(time);
            const beforeData = structuredClone(clip.transformAnimationData);
            const beforePath = structuredClone(findMotionPaths(item)[0].path);
            const beforePosition = item.transform.position.clone();
            const beforeMatrix = Array.from(item.transform.getWorldMatrix().elements);
            const resize = new ResizeSelectionGizmo(handler), gizmo = new TransformHandlesGizmo(handler, resize);

            resize.refreshWireframeBySelectedItems();
            const start = resize.wireframe.anchor.clone();

            gizmo.onMouseDown(down(start));
            gizmo.onMouseDrag(drag(start.clone().add(new Vector2(15, 10))));
            const displacement = item.transform.position.clone().subtract(beforePosition);

            if (cancel) { gizmo.onKeyDown(key()); displacement.set(0, 0, 0); }
            gizmo.onMouseUp(down(start));
            const anchor = item.transform.anchor.clone();

            component.sampleTime(component.getTime());
            item.transform.getWorldMatrix().elements.forEach((value, axis) => expect(value).closeTo(beforeMatrix[axis], 1e-5));
            if (cancel) { expect(clip.transformAnimationData).deep.equals(beforeData); }
            // Only the gesture's displacement is added to the path; later rotation/scale uses the current anchor.
            const endPosition = new Vector3(...beforePath[1][2]).add(displacement);

            component.sampleTime(6);
            expect(item.transform.position.distance(endPosition)).lessThan(1e-5);
            expect(item.transform.anchor.toArray()).deep.equals(anchor.toArray());
            expect(anchor.clone().applyMatrix(item.transform.getWorldMatrix()).distance(endPosition.clone().add(anchor))).lessThan(1e-5);
            clip.fromData(JSON.parse(JSON.stringify(clip.transformAnimationData)));
            component.onAwake(); component.sampleTime(6);
            expect(item.transform.position.distance(endPosition)).lessThan(1e-5);
            gizmo.dispose(); resize.dispose();
          }
        });
      }
    }

    for (const rotate of [false, true]) {
      it(`reports actual axis transforms when Alt changes without/with rotation (${rotate})`, () => {
        sprite();
        const resize = new ResizeSelectionGizmo(handler), gizmo = new TransformHandlesGizmo(handler, resize);
        let committed: { transformType?: TransformType, transformTypes?: TransformType[] } = {};

        handler.on('actioncommit', event => { if ('transformType' in event) { committed = event; } });
        resize.refreshWireframeBySelectedItems();
        const start = resize.wireframe.anchor.clone().add(new Vector2(40, 0));
        const moved = start.clone().add(new Vector2(20, 0));

        gizmo.onMouseDown(down(start)); gizmo.onMouseDrag(drag(moved));
        gizmo.onMouseDrag(drag(moved, false, true));
        if (rotate) { gizmo.onMouseDrag(drag(moved.clone().add(new Vector2(0, 20)), false, true)); }
        gizmo.onMouseUp(down(moved, { altPressed: true }));
        expect(committed.transformType).equals(rotate ? TransformType.MIXED : TransformType.TRANSLATION);
        expect(committed.transformTypes).deep.equals(rotate ? [TransformType.TRANSLATION, TransformType.ROTATION] : [TransformType.TRANSLATION]);
        gizmo.dispose(); resize.dispose();
      });
    }

    it('does not draw or hit old axes after the selected item becomes hidden', () => {
      const item = sprite(), resize = new ResizeSelectionGizmo(handler), gizmo = new TransformHandlesGizmo(handler, resize);

      resize.refreshWireframeBySelectedItems();
      const start = resize.wireframe.anchor.clone().add(new Vector2(40, 0));

      item.setVisible(false);
      const drawing = recordDrawing();

      gizmo.draw(drawing.control);
      expect(drawing.calls).length(0);
      const press = down(start);

      gizmo.onMouseDown(press); expect(press.isAccepted()).equals(false);
      gizmo.dispose(); resize.dispose();
    });

    it('keeps a new registration alive after an old geometry cleanup is called twice', () => {
      const item = sprite();
      const provider = () => ({ min: [-2, -1] as const, max: [2, 1] as const });
      const old = registerItemGeometry(player.engine, provider);

      old();
      const current = registerItemGeometry(player.engine, provider);

      old();
      expect(getCustomItemGeometry(item)).deep.equals(provider()); current();
      expect(getCustomItemGeometry(item)).equals(undefined);
    });

    it('aligns selection bounds and local handles with a transformed composition', () => {
      const item = sprite();
      const previous = composition.transform.position.clone();

      composition.transform.setPosition(2, -1, 0);
      try {
        const box = getItemViewBox(item, new Vector2(800, 600));
        const center = localToView(item, new Vector3());

        expect(box.getCenter().distance(center)).lessThan(1e-5);
        expect(viewToLocal(item, center)!.length()).lessThan(1e-5);
      } finally { composition.transform.setPosition(...previous.toArray()); }
    });

    it('accepts canvas and marquee children in an arbitrary named frame scope', () => {
      const scene = new DemoScene(player, composition), frame = scene.createFrame([0, 0], [5, 5]);

      frame.item.name = 'FFD example';
      const inside = sprite(), outside = sprite();

      inside.setParent(frame.item);
      handler.setActiveEditMode(new SelectionEditMode(handler, { effectsItemId: frame.item.getInstanceId() }));
      const selection = handler.getSelection();

      expect(selection.filterSelectedItems([inside.getInstanceId(), outside.getInstanceId()])).deep.equals([inside.getInstanceId()]);
      expect(selection.resolveMarqueeSelectableItem(inside)).equals(inside);
      expect(selection.resolveMarqueeSelectableItem(outside)).equals(undefined);
    });

    it('allows an arbitrary scope within Effects while retaining nested Effects boundaries', () => {
      const scene = new DemoScene(player, composition);
      const outer = scene.createFrame([0, 0], [5, 5]).item;
      const scope = scene.createFrame([0, 0], [4, 4]).item;
      const nested = scene.createFrame([0, 0], [2, 2]).item;

      outer.name = nested.name = '动效';
      scope.name = 'Editable subtree';
      scope.setParent(outer); nested.setParent(scope);
      const inside = sprite(), nestedChild = sprite();

      inside.setParent(scope); nestedChild.setParent(nested);
      handler.setActiveEditMode(new SelectionEditMode(handler, { effectsItemId: scope.getInstanceId() }));
      const selection = handler.getSelection();

      expect(selection.filterSelectedItems([inside, nestedChild, scope].map(item => item.getInstanceId())))
        .deep.equals([inside.getInstanceId()]);
      expect(selection.resolveMarqueeSelectableItem(inside)).equals(inside);
      expect(selection.resolveMarqueeSelectableItem(nestedChild)).equals(undefined);
    });

    it('retains scoped child selections through Demo Shift selection and repeated inspector edits', () => {
      const scene = new DemoScene(player, composition), frame = scene.createFrame([0, 0], [5, 5]);
      const first = sprite(), second = sprite();

      first.setParent(frame.item); second.setParent(frame.item);
      const data = [first, second].map(item => ({ item, name: item.getInstanceId(), kind: 'Sprite' as const, editRoot: frame.item }));
      const getItem = scene.getItem.bind(scene);

      scene.getItem = item => data.find(entry => entry.item === item) ?? getItem(item);
      const editor = new DemoEditor(player, scene, handler, container);

      try {
        editor.select(first); editor.select(second, true);
        expect(editor.selectedItems).deep.equals([first, second]);
        editor.select(first);
        editor.editSelected('rotate', item => item.setRotation(0, 0, 20));
        editor.editSelected('size', item => item.transform.setSize(3, 4));
        expect(editor.selectedItem).equals(first);
        expect(first.transform.size.toArray()).deep.equals([3, 4]);
        expect(frame.item.transform.size.toArray()).deep.equals([5, 5]);
      } finally { editor.dispose(); }
    });

    for (const scoped of [false, true]) {
      it(`routes Demo content editing from the existing selection mode (scoped=${scoped})`, () => {
        const { item } = gradient();
        const scene = new DemoScene(player, composition);

        if (scoped) {
          const frame = scene.createFrame([0, 0], [5, 5]);

          item.setParent(frame.item);
          handler.setActiveEditMode(new EffectsEditMode(handler, frame.item.getInstanceId()));
        } else { handler.setActiveEditMode(new DefaultSelectionMode(handler)); }
        select(item); handler.setActiveTool(new MoveGizmoTool(handler));
        const editor = new DemoEditor(player, scene, handler, container);

        try {
          editor.editContent({ type: 'gradient', paintKind: 'fill', paintIndex: 0 });
          expect(editor.gradientGizmo).instanceOf(GradientGizmo);
          expect(editor.selectedItem).equals(item);
          editor.editContent(); expect(editor.gradientGizmo).equals(undefined);
        } finally { editor.dispose(); }
      });
    }
  });

});
