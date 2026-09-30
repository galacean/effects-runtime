import { restoreTestState, getSpyCalls, spyOnGetter, type TestSpy } from '../helpers/spies';
import { InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, type InputEventMouse, spec, type Engine, type TextComponent, type Texture, type VFXItem } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Box2, Circle, Line2 } from '@galacean/effects-math/es/extension/index';
import { getBoxTransform, Matrix4, Vector2, Vector3, getBoxCorners, setBoxFromPoints } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { getRotatedBoxCorners } from '../../../../../../plugin-packages/editor-gizmo/src/2d/drawing';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d';
import { FrameManager, LoadingManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d';

import { ResizeSelectionGizmo, ResizeSelectionIconType, TransformType } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/resize-selection-gizmo';
import type { Selection } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/selection';
import { SnapManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/snap-manager';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';

const { expect } = chai;

describe('plugin-editor-gizmo/resize-selection-gizmo', () => {
  afterEach(restoreTestState);

type SelectionStub = Selection & {
  selectedIds: string[],
  interactionStartSelectedIds: string[],
};

function mouseButton (x: number, y = 20, pressed = true, buttonMask = MouseButtonMask.Left): InputEventMouseButton {
  const event = new InputEventMouseButton();

  event.position.set(x, y);
  event.globalPosition.set(x, y);
  event.buttonMask = buttonMask;
  event.buttonIndex = MouseButton.Left;
  event.pressed = pressed;

  return event;
}

function mouseMotion (x: number, y = 20, buttonMask = MouseButtonMask.Left): InputEventMouseMotion {
  const event = new InputEventMouseMotion();

  event.position.set(x, y);
  event.globalPosition.set(x, y);
  event.buttonMask = buttonMask;

  event.pressed = event.buttonMask !== MouseButtonMask.None;

  return event;
}

function accepted (event: InputEventMouse, dispatch: () => void): boolean {
  event.clearAccepted();
  dispatch();

  return event.isAccepted();
}

function createSelection (selectedIds = ['selected'], oldSelectedIds = selectedIds): SelectionStub {
  const selection = {
    selectedIds: [...selectedIds],
    interactionStartSelectedIds: [...oldSelectedIds],
    getSelectedIds () {
      return [...this.selectedIds];
    },
    getSelectedPlayerItems () {
      return this.selectedIds.map(id => ({
        getInstanceId: () => id,
      }) as unknown as VFXItem);
    },
    findUnselectedItem () {
      return undefined;
    },
    clear () {
      this.selectedIds = [];
    },
    clearHover: chai.spy(),
    commitHoverTarget: chai.spy(),
    addSelectedItem (id: string) {
      if (!this.selectedIds.includes(id)) {
        this.selectedIds.push(id);
      }

      return this.selectedIds;
    },
  };

  return selection as unknown as SelectionStub;
}

function createGizmo (
  type: TransformType,
  selection = createSelection(),
): {
    gizmo: ResizeSelectionGizmo,
    owner: GizmoOwner,
    emit: TestSpy,
    loadingManager: LoadingManager,
  } {
  const engine = {
    // getContainerSize 直读 engine.canvas.parentElement 的 offsetWidth/Height（与原按 canvas 取值对齐 = 800/600）。
    canvas: { parentElement: { offsetWidth: 800, offsetHeight: 600 } },
    compositions: [],
    getServer (this: { compositions: unknown[] }) { return { compositions: this.compositions }; },

  } as unknown as Engine;
  const configs = new ConfigManager();
  const frames = new FrameManager({} as unknown as Engine);
  let selectionTransformKind: 'idle' | 'move' | 'resize' = 'idle';
  const emit = chai.spy();
  const loadingManager = new LoadingManager();
  const owner = {
    emit,
    setCursor: chai.spy(),
    getSelection: () => selection,
    getLoadingManager: () => loadingManager,
    getFrameManager: () => frames,
    getSelectionTransformKind: () => selectionTransformKind,
    setSelectionTransformKind: (kind: 'idle' | 'move' | 'resize') => {
      selectionTransformKind = kind;
    },
    getMousePosition: () => new Vector2(),
    isPanning: () => false,
    isHandToolMode: () => false,
    rebuildGizmos: () => {},
    // engine 经 owner.getEngine 懒取（取代构造注入）
    getEngine: () => engine,
    getGizmoManager: () => undefined,
    getConfigManager: () => configs,
  } as unknown as GizmoOwner;
  const snapManager = new SnapManager(owner);

  owner.getSnapManager = () => snapManager;
  const gizmo = new ResizeSelectionGizmo(owner);

  chai.spy.on(gizmo, 'refreshWireframeBySelectedItems', () => {});
  chai.spy.on(gizmo, 'refreshTransformType', () => {
    gizmo.activeType = type;
    gizmo.wireframe.activeType = type;
  });
  chai.spy.on(gizmo, 'refreshCursorResult', () => {});
  gizmo.wireframe.interactive = true;

  return { gizmo, owner, emit, loadingManager };
}

describe('ResizeSelectionGizmo - handles only', () => {
  it('选区包含 loading 元素时保留选框但禁用缩放手柄与命中', () => {
    const { gizmo, loadingManager, emit } = createGizmo(TransformType.SCALE);

    gizmo.refreshWireframeBySelectedItems = ResizeSelectionGizmo.prototype.refreshWireframeBySelectedItems;
    const normalItem = {
      type: spec.ItemType.sprite,
      isVisible: false,
      getInstanceId: () => 'normal',
      getComponent: () => undefined,
    } as unknown as VFXItem;
    const loadingItem = {
      type: spec.ItemType.video,
      isVisible: false,
      getInstanceId: () => 'loading',
      getComponent: () => undefined,
    } as unknown as VFXItem;

    spyOnGetter(gizmo, 'selectedItems', () => ([normalItem, loadingItem]));
    loadingManager.add('loading');

    gizmo.refreshWireframeBySelectedItems();

    expect(gizmo.wireframe.interactive).to.equal(false);
    expect(gizmo.wireframe.cornerEnable).to.equal(false);
    expect(gizmo.wireframe.scaleCorners).to.deep.equal([]);
    expect(gizmo.wireframe.widthScaleAreas).to.deep.equal([]);
    expect(gizmo.activeType).to.equal(TransformType.NULL);

    const down = mouseButton(10, 20, true);

    expect(accepted(down, () => gizmo.onMouseDown(down))).to.equal(false);
    expect(getSpyCalls(emit).some(args => args.length === 2 && args[0] === 'actionstart' && args[1] != null)).not.to.equal(true);
  });

  it('按实际元素类型选择信息标签图标', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const getIconType = (gizmo as unknown as {
      getIconType: (item: VFXItem) => ResizeSelectionIconType,
    }).getIconType.bind(gizmo);
    const getItemInfoName = (gizmo as unknown as {
      getItemInfoName: (item: VFXItem) => string,
    }).getItemInfoName.bind(gizmo);
    const item = (type: spec.ItemType, name = '', hasFrameComponent = false) => ({
      type,
      name,
      getComponent: () => hasFrameComponent ? {} : undefined,
    }) as unknown as VFXItem;

    expect(getIconType(item(spec.ItemType.sprite))).to.equal(ResizeSelectionIconType.IMAGE);
    expect(getIconType(item(spec.ItemType.video))).to.equal(ResizeSelectionIconType.VIDEO);
    expect(getIconType(item(spec.ItemType.text))).to.equal(ResizeSelectionIconType.TEXT);
    expect(getIconType(item(spec.ItemType.null))).to.equal(ResizeSelectionIconType.GROUP);
    expect(getIconType(item(spec.ItemType.null, '画板', true))).to.equal(ResizeSelectionIconType.FRAME);
    expect(getIconType(item(spec.ItemType.null, '特效', true))).to.equal(ResizeSelectionIconType.EFFECTS);

    const imageGenerator = {
      type: spec.ItemType.sprite,
      name: '生成器',
      definition: { content: { generatorType: 'image' } },
    } as unknown as VFXItem;
    const videoGenerator = {
      type: spec.ItemType.sprite,
      name: '生成器',
      definition: { content: { generatorType: 'video' } },
    } as unknown as VFXItem;

    expect(getIconType(imageGenerator)).to.equal(ResizeSelectionIconType.IMAGE);
    expect(getItemInfoName(imageGenerator)).to.equal('图片生成器');
    expect(getIconType(videoGenerator)).to.equal(ResizeSelectionIconType.VIDEO);
    expect(getItemInfoName(videoGenerator)).to.equal('视频生成器');
    expect(getItemInfoName(item(spec.ItemType.sprite, '自定义生成器'))).to.equal('自定义生成器');
  });

  it('信息标签按 drawText 的完整 cell 高度转换坐标，使文字与图标保持原有对齐', () => {
    chai.spy.on(CanvasRenderingContext2D.prototype, 'measureText', function (this: CanvasRenderingContext2D, text: string) {
      const fontSize = Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 14);

      return {
        width: Array.from(text).length * fontSize / 2,
        actualBoundingBoxAscent: fontSize * 0.8,
        actualBoundingBoxDescent: fontSize * 0.2,
      };
    });

    try {
      const { gizmo } = createGizmo(TransformType.NULL);
      const item = { type: spec.ItemType.sprite, name: '图片' } as VFXItem;
      const texture = { isDestroyed: false } as Texture;

      spyOnGetter(gizmo, 'selectedItems', () => ([item]));
      spyOnGetter(gizmo, 'viewScale', () => (1));
      gizmo.wireframe.box.setFromCenterAndSize(new Vector2(100, 120), new Vector2(200, 40));

      const internals = gizmo as unknown as {
        getIconTexture: () => Texture | undefined,
        renderItemInfo: (control: Control, sizeTextColor: number, nameTextColor: number) => void,
      };

      chai.spy.on(internals, 'getIconTexture', () => (texture));

      const drawTexture = chai.spy();
      const drawText = chai.spy();
      const control = {
        drawTexture,
        drawText,
        engine: {
          displayServer: { pixelRatio: 2 },
          renderingServer: { graphics: { pushTransform: chai.spy(), popTransform: chai.spy() } },
        },
      } as unknown as Control;

      internals.renderItemInfo(control, 0x666666, 0x666666);

      expect(drawTexture).to.have.been.called.with.exactly(0, 0, 15, 15, texture);
      expect(drawText).to.have.been.called.exactly(2);
      // fontSize=14、上下 padding 各 4px，cell 高 22px；旧版底边 y=1 转为新版顶部 y=-23。
      expect(getSpyCalls(drawText).map(call => call[1])).to.deep.equal([-23, -23]);
    } finally {
      chai.spy.restore();
    }
  });

  function setWireframeBox (gizmo: ResizeSelectionGizmo, box: Box2, corners: Vector2[] = getBoxCorners(box)): void {
    gizmo.wireframe.box.copyFrom(box);
    gizmo.wireframe.totalBox.copyFrom(box).expandByScalar(16);
    gizmo.wireframe.transform = getBoxTransform(corners);
    gizmo.wireframe.edges = corners.map((corner, index) => (
      new Line2(corner, corners[(index + 1) % corners.length])
    ));
    gizmo.wireframe.scaleCorners = [];
    gizmo.wireframe.widthScaleAreas = [];
  }

  it('角点使用沿选框旋转的 14×14 方形命中区，并优先于边', () => {
    const { gizmo } = createGizmo(TransformType.NULL);

    gizmo.refreshTransformType = ResizeSelectionGizmo.prototype.refreshTransformType;
    spyOnGetter(gizmo, 'selectedItems', () => ([{ type: spec.ItemType.sprite }] as VFXItem[]));

    const c = Math.SQRT1_2;
    const xAxis = new Vector2(c, c);
    const yAxis = new Vector2(-c, c);
    const rotate = (x: number, y: number) => new Vector2(100 + x * c - y * c, 100 + x * c + y * c);
    const corners = [
      rotate(-40, -20), rotate(40, -20), rotate(40, 20), rotate(-40, 20),
    ];
    const box = setBoxFromPoints(new Box2(), corners);

    setWireframeBox(gizmo, box, corners);
    gizmo.wireframe.scaleCorners = corners.map(corner => new Circle(corner, gizmo.config.scaleCircleSize));

    const corner = corners[0];
    // 局部轴两个方向各偏移 6px：已在旧的 4px 命中圆外，但仍在 14×14 方形内。
    const insideSquare = corner.clone().add(xAxis.clone().multiply(6)).add(yAxis.clone().multiply(6));

    gizmo.refreshTransformType(insideSquare);
    expect(gizmo.activeType).to.equal(TransformType.SCALE);
    expect(gizmo.wireframe.scaleCorner).to.deep.equal(corner);

    const findCorner = (gizmo as unknown as {
      findScaleCorner: (point: Vector2) => Circle | undefined,
    }).findScaleCorner.bind(gizmo);

    expect(findCorner(corner.clone().add(xAxis.clone().multiply(7.01)))).to.equal(undefined);
  });

  it('只接管缩放角点；外侧角旋转区让给 CornerRotationGizmo', () => {
    const { gizmo } = createGizmo(TransformType.NULL);

    gizmo.refreshTransformType = ResizeSelectionGizmo.prototype.refreshTransformType;
    spyOnGetter(gizmo, 'selectedItems', () => ([{ type: spec.ItemType.sprite }] as VFXItem[]));

    const box = new Box2().setFromCenterAndSize(new Vector2(150, 150), new Vector2(100, 100));

    setWireframeBox(gizmo, box);
    const corners = getBoxCorners(box);

    gizmo.wireframe.scaleCorners = corners.map(corner => new Circle(corner, gizmo.config.scaleCircleSize));

    const corner = corners[0];
    const { xAxis, yAxis } = (gizmo as unknown as {
      boxLocalAxes: () => { xAxis: Vector2, yAxis: Vector2 },
    }).boxLocalAxes();
    const centerDirection = new Vector2().subtractVectors(corner, box.getCenter());
    const outwardX = xAxis.clone().multiply(centerDirection.dot(xAxis) >= 0 ? 1 : -1);
    const outwardY = yAxis.clone().multiply(centerDirection.dot(yAxis) >= 0 ? 1 : -1);

    // 外移 6px 同时落在缩放与旋转方形内，缩放必须优先。
    const overlap = corner.clone().add(outwardX.clone().multiply(6)).add(outwardY.clone().multiply(6));

    expect((gizmo as unknown as { computeTransformType: (point: Vector2) => TransformType }).computeTransformType(overlap)).to.equal(TransformType.SCALE);

    // 外移 10px 已越过缩放区；ResizeSelection 不再把它识别为 ROTATION。
    const rotationOnly = corner.clone().add(outwardX.clone().multiply(10)).add(outwardY.clone().multiply(10));

    gizmo.refreshTransformType(rotationOnly);
    expect(gizmo.activeType).to.equal(TransformType.NULL);
  });

  it('普通元素四条边均命中单轴缩放，并记录真实旋转边', () => {
    const { gizmo } = createGizmo(TransformType.NULL);

    gizmo.refreshTransformType = ResizeSelectionGizmo.prototype.refreshTransformType;
    spyOnGetter(gizmo, 'selectedItems', () => ([{ type: spec.ItemType.sprite }] as VFXItem[]));
    const c = Math.SQRT1_2;
    const rotate = (x: number, y: number) => new Vector2(100 + x * c - y * c, 100 + x * c + y * c);
    const corners = [
      rotate(-40, -20), rotate(40, -20), rotate(40, 20), rotate(-40, 20),
    ];
    const box = setBoxFromPoints(new Box2(), corners);

    setWireframeBox(gizmo, box, corners);

    for (const edge of gizmo.wireframe.edges) {
      const point = edge.getCenter();

      gizmo.refreshTransformType(point);
      expect(gizmo.activeType).to.equal(TransformType.SCALE);
      expect(gizmo.wireframe.scaleCorner).to.deep.equal(point);
      expect(gizmo.wireframe.scaleEdgeCorners).to.deep.equal([edge.start, edge.end]);
    }
  });

  it('极宽或极高元素都按拓扑索引取正对边，不把更远的相邻边误当固定边', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const internal = gizmo as unknown as {
      oppositeScaleEdgeCenter: (corners: Vector2[]) => Vector2 | undefined,
    };

    for (const size of [new Vector2(400, 40), new Vector2(40, 400)]) {
      setWireframeBox(gizmo, new Box2().setFromCenterAndSize(new Vector2(100, 100), size));
      gizmo.wireframe.edges.forEach((edge, index) => {
        expect(internal.oppositeScaleEdgeCenter([edge.start, edge.end])).to.deep.equal(gizmo.wireframe.edges[(index + 2) % 4].getCenter());
      });
    }
  });

  it('文字边缩放始终从按下时排版快照绝对写入', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const textComponent = {
      text: 'two lines',
      textStyle: { fontSize: 20 },
      textLayout: { width: 100, lineHeight: 24 },
      setFontSize: chai.spy(),
      setLineHeight: chai.spy(),
      setTextWidth: chai.spy(),
      setTextHeight: chai.spy(),
      getLineCount: chai.spy(() => 2),
    } as unknown as TextComponent;
    const transform = {
      setScale: chai.spy(),
      setPosition: chai.spy(),
    };
    const item = {
      type: spec.ItemType.text,
      transform,
    } as unknown as VFXItem;
    const session = {
      item,
      initialPosition: new Vector3(10, 20, 0),
      initialScale: new Vector3(1, 1, 1),
      parentWorldToLocal: new Matrix4(),
      text: {
        component: textComponent,
        mode: 'font',
        autoResize: spec.TextSizeMode.fixed,
        fontSize: 20,
        fontOffset: 0,
        lineHeight: 24,
        width: 100,
        height: 48,
        lineCount: 2,
      },
    };
    const internal = gizmo as unknown as {
      applyAnchoredResize: (resizeSession: unknown, resize: unknown) => void,
    };

    internal.applyAnchoredResize(session, {
      totalScalar: new Vector3(1.25, 1.25, 1.25),
      totalTranslation: new Vector3(-5, 5, 0),
    });
    // 模拟上一帧排版刷新后的可变状态；下一帧结果仍只能读取 session 快照。
    textComponent.textStyle.fontSize = 25;
    textComponent.textLayout.lineHeight = 30;
    textComponent.textLayout.width = 125;
    internal.applyAnchoredResize(session, {
      totalScalar: new Vector3(0.75, 0.75, 0.75),
      totalTranslation: new Vector3(5, -5, 0),
    });

    expect(getSpyCalls(textComponent.setFontSize).at(-1)).to.deep.equal([15]);
    expect(getSpyCalls(textComponent.setLineHeight).at(-1)).to.deep.equal([18]);
    expect(getSpyCalls(textComponent.setTextWidth).at(-1)).to.deep.equal([75]);
    expect(getSpyCalls(textComponent.setTextHeight).at(-1)).to.deep.equal([36]);
    expect(getSpyCalls(transform.setScale).at(-1)).to.deep.equal([1, 1, 1]);
    expect(getSpyCalls(transform.setPosition).at(-1)).to.deep.equal([15, 15, 0]);
  });

  it('收窄换行后连续拖动角点，分数高度不会改变文字宽高比', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const component = {
      text: '测试文字自动换行',
      setFontSize: chai.spy(),
      setLineHeight: chai.spy(),
      setTextWidth: chai.spy(),
      setTextHeight: chai.spy(),
      getLineCount: chai.spy(() => 3),
    };
    const transform = { setScale: chai.spy(), setPosition: chai.spy() };
    const session = {
      item: { type: spec.ItemType.text, transform } as unknown as VFXItem,
      initialPosition: new Vector3(),
      initialScale: new Vector3(1, 1, 1),
      parentWorldToLocal: new Matrix4(),
      text: {
        component,
        mode: 'width',
        autoResize: spec.TextSizeMode.fixed,
        fontSize: 20,
        fontOffset: 0,
        lineHeight: 24.2,
        width: 200,
        height: 24.2,
        lineCount: 1,
      },
    };
    const apply = (x: number, y: number) => {
      (gizmo as unknown as {
        applyAnchoredResize: (session: unknown, resize: unknown) => void,
      }).applyAnchoredResize(session, {
        totalScalar: new Vector3(x, y, 1),
        totalTranslation: new Vector3(),
      });
    };

    apply(0.5, 1);
    expect(getSpyCalls(component.setTextHeight).at(-1)).to.deep.equal([73]);
    session.text = { ...session.text, mode: 'font', width: 100, height: 73, lineCount: 3 };

    for (const scalar of [0.75, 1.25, 0.5]) {
      apply(scalar, scalar);
      expect(getSpyCalls(component.setTextHeight).at(-1)).to.deep.equal([73 * scalar]);
      expect(getSpyCalls(component.setFontSize).at(-1)).to.deep.equal([20 * scalar]);
      expect(getSpyCalls(transform.setScale).at(-1)).to.deep.equal([1, 1, 1]);
    }
  });

  it('文字上下边经过固定边后继续改字号和位置，但保持文字方向', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const textComponent = {
      setFontSize: chai.spy(),
      setLineHeight: chai.spy(),
      setTextWidth: chai.spy(),
      setTextHeight: chai.spy(),
    };
    const transform = {
      setScale: chai.spy(),
      setPosition: chai.spy(),
    };
    const session = {
      item: { type: spec.ItemType.text, transform } as unknown as VFXItem,
      initialPosition: new Vector3(10, 20, 0),
      initialScale: new Vector3(2, 3, 1),
      parentWorldToLocal: new Matrix4(),
      text: {
        component: textComponent,
        mode: 'font',
        autoResize: spec.TextSizeMode.fixed,
        fontSize: 20,
        fontOffset: 0,
        lineHeight: 24,
        width: 100,
        height: 24,
        lineCount: 1,
      },
    };
    const apply = (scalar: number, totalTranslation = new Vector3()) => {
      (gizmo as unknown as {
        applyAnchoredResize: (resizeSession: unknown, resize: unknown) => void,
      }).applyAnchoredResize(session, {
        totalScalar: new Vector3(Math.abs(scalar), scalar, Math.abs(scalar)),
        totalTranslation,
      });
    };

    apply(0.01);
    expect(getSpyCalls(textComponent.setFontSize).at(-1)).to.deep.equal([1]);
    expect(getSpyCalls(transform.setScale).at(-1)?.[0]).to.be.closeTo(0.4, 0.5 * 10 ** -(2));
    // 小字号使用等比补偿，不能因为文本框高度取整而压扁字形。
    expect(getSpyCalls(textComponent.setTextHeight).at(-1)?.[0]).to.be.closeTo(1.2, 0.5 * 10 ** -(2));
    expect(getSpyCalls(transform.setScale).at(-1)?.[1]).to.be.closeTo(0.6, 0.5 * 10 ** -(2));
    expect(getSpyCalls(transform.setScale).at(-1)?.[2]).to.equal(1);
    session.text.autoResize = spec.TextSizeMode.autoHeight;
    apply(0.01);
    // autoHeight 同样保持等比补偿。
    expect(getSpyCalls(transform.setScale).at(-1)?.[1]).to.be.closeTo(0.6, 0.5 * 10 ** -(2));
    apply(0);
    expect(getSpyCalls(transform.setScale).at(-1)).to.deep.equal([0, 0, 1]);
    apply(-0.5, new Vector3(0, -75, 0));
    expect(getSpyCalls(textComponent.setFontSize).at(-1)).to.deep.equal([10]);
    expect(getSpyCalls(transform.setScale).at(-1)).to.deep.equal([2, 3, 1]);
    expect(getSpyCalls(transform.setPosition).at(-1)).to.deep.equal([10, -55, 0]);
  });

  it('文字左右边越过固定边后持续改宽度和位置，但保持文字方向', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const textComponent = {
      text: 'text',
      setTextWidth: chai.spy(),
      setTextHeight: chai.spy(),
      getLineCount: chai.spy(() => 1),
    };
    const transform = {
      setScale: chai.spy(),
      setPosition: chai.spy(),
    };
    const session = {
      item: { type: spec.ItemType.text, transform } as unknown as VFXItem,
      initialPosition: new Vector3(100, 20, 0),
      initialScale: new Vector3(2, 3, 1),
      parentWorldToLocal: new Matrix4(),
      text: {
        component: textComponent,
        mode: 'width',
        autoResize: spec.TextSizeMode.fixed,
        fontSize: 20,
        fontOffset: 10,
        lineHeight: 24,
        width: 100,
        height: 24,
        lineCount: 1,
      },
    };
    const apply = (scalar: number, totalTranslation = new Vector3()) => {
      (gizmo as unknown as {
        applyAnchoredResize: (resizeSession: unknown, resize: unknown) => void,
      }).applyAnchoredResize(session, {
        totalScalar: new Vector3(scalar, 1, 1),
        totalTranslation,
      });
    };

    apply(0);
    expect(getSpyCalls(textComponent.setTextWidth).at(-1)).to.deep.equal([0]);
    expect(getSpyCalls(transform.setScale).at(-1)).to.deep.equal([0, 3, 1]);
    apply(-0.5, new Vector3(-75, 0, 0));
    expect(getSpyCalls(textComponent.setTextWidth).at(-1)).to.deep.equal([50]);
    expect(getSpyCalls(transform.setScale).at(-1)?.[0]).to.be.closeTo(11 / 6, 0.5 * 10 ** -(2));
    expect(getSpyCalls(transform.setScale).at(-1)?.[1]).to.equal(3);
    expect(getSpyCalls(transform.setScale).at(-1)?.[2]).to.equal(1);
    expect(getSpyCalls(transform.setPosition).at(-1)).to.deep.equal([25, 20, 0]);
    // (layout 50 + offset 10) / (layout 100 + offset 10) 再乘 residual，
    // 最终可视宽度严格为初始值的 0.5，符号只用于决定文字位于固定边哪一侧。
    expect((60 / 110) * (getSpyCalls(transform.setScale).at(-1)?.[0] ?? 0) / 2).to.be.closeTo(0.5, 0.5 * 10 ** -(2));
  });

  it('文字角点跨过对角点时只改变字号和位置，不改变文字方向', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const textComponent = {
      setFontSize: chai.spy(),
      setLineHeight: chai.spy(),
      setTextWidth: chai.spy(),
      setTextHeight: chai.spy(),
    };
    const transform = {
      setScale: chai.spy(),
      setPosition: chai.spy(),
    };
    const session = {
      item: { type: spec.ItemType.text, transform } as unknown as VFXItem,
      initialPosition: new Vector3(50, 40, 0),
      initialScale: new Vector3(2, 3, 1),
      parentWorldToLocal: new Matrix4(),
      text: {
        component: textComponent,
        mode: 'font',
        autoResize: spec.TextSizeMode.fixed,
        fontSize: 20,
        fontOffset: 0,
        lineHeight: 24,
        width: 100,
        height: 24,
        lineCount: 1,
      },
    }

    ;(gizmo as unknown as {
      applyAnchoredResize: (resizeSession: unknown, resize: unknown) => void,
    }).applyAnchoredResize(session, {
      totalScalar: new Vector3(-0.5, 0.5, 0.5),
      totalTranslation: new Vector3(-75, -20, 0),
    });

    expect(getSpyCalls(textComponent.setFontSize).at(-1)).to.deep.equal([10]);
    expect(getSpyCalls(textComponent.setTextWidth).at(-1)).to.deep.equal([50]);
    expect(getSpyCalls(transform.setScale).at(-1)).to.deep.equal([2, 3, 1]);
    expect(getSpyCalls(transform.setPosition).at(-1)).to.deep.equal([-25, 20, 0]);
  });

  it('普通元素边缩放从初始 scale 绝对写入，可反向放大并越过零点镜像', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const transform = {
      setScale: chai.spy(),
      setPosition: chai.spy(),
    };
    const session = {
      item: { type: spec.ItemType.sprite, transform } as unknown as VFXItem,
      initialPosition: new Vector3(10, 20, 0),
      initialScale: new Vector3(2, 3, 1),
      parentWorldToLocal: new Matrix4(),
    };
    const apply = (scalar: number) => {
      (gizmo as unknown as {
        applyAnchoredResize: (resizeSession: unknown, resize: unknown) => void,
      }).applyAnchoredResize(session, {
        totalScalar: new Vector3(scalar, 1, 1),
        totalTranslation: new Vector3(4, 0, 0),
      });
    };

    apply(0.5);
    apply(0.25);
    apply(0.75);
    apply(0);
    apply(-0.5);

    expect(getSpyCalls(transform.setScale)).to.deep.equal([
      [1, 3, 1],
      [0.5, 3, 1],
      [1.5, 3, 1],
      [0, 3, 1],
      [-1, 3, 1],
    ]);
    expect(getSpyCalls(transform.setPosition).at(-1)).to.deep.equal([14, 20, 0]);
  });

  it('普通元素角点穿越时按双轴符号镜像，并从按下快照绝对写入', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const transform = {
      setScale: chai.spy(),
      setPosition: chai.spy(),
    };
    const session = {
      item: { type: spec.ItemType.sprite, transform } as unknown as VFXItem,
      initialPosition: new Vector3(50, 40, 0),
      initialScale: new Vector3(2, 3, 4),
      parentWorldToLocal: new Matrix4(),
    }

    ;(gizmo as unknown as {
      applyAnchoredResize: (resizeSession: unknown, resize: unknown) => void,
    }).applyAnchoredResize(session, {
      totalScalar: new Vector3(-0.5, 0.75, 0.75),
      totalTranslation: new Vector3(-75, -10, 0),
    });

    expect(getSpyCalls(transform.setScale).at(-1)).to.deep.equal([-1, 2.25, 3]);
    expect(getSpyCalls(transform.setPosition).at(-1)).to.deep.equal([-25, 30, 0]);
  });

  it('手柄在实际拖动时进入变换，Up 结束变换并把 hover 留给 cached Move', () => {
    const { gizmo, owner, emit } = createGizmo(TransformType.SCALE);

    // 几何装配依赖真实 item.transform，本用例只验 Up 尾提交，stub 掉_plane 装配。
    chai.spy.on(gizmo as unknown as { beginTransformOperation: () => void }, 'beginTransformOperation', () => {});
    chai.spy.on(gizmo as unknown as {
      handleScale: (shift: Vector2, direction: Vector2, event: InputEventMouse) => number,
    }, 'handleScale', () => (0));
    const commitHover = owner.getSelection().commitHoverTarget as TestSpy;

    const down = mouseButton(10, 20, true, MouseButtonMask.Left);

    expect(accepted(down, () => gizmo.onMouseDown(down))).to.equal(true);
    expect(owner.getSelectionTransformKind()).to.equal('idle');
    const drag = mouseMotion(15, 20, MouseButtonMask.Left);

    expect(accepted(drag, () => gizmo.onMouseDrag(drag))).to.equal(true);
    expect(owner.getSelectionTransformKind()).to.equal('resize');
    expect(emit).to.have.been.called.with.exactly('actionupdate', {
      source: gizmo,
      transformType: TransformType.SCALE,
    });
    const up = mouseButton(15, 20, false, MouseButtonMask.None);

    expect(accepted(up, () => gizmo.onMouseUp(up))).to.equal(true);

    expect(commitHover).not.to.have.been.called();
    expect(owner.getSelectionTransformKind()).to.equal('idle');
  });

  it('缩放手柄目标点通过 owner SnapManager 吸附并产生 visualization', () => {
    const { gizmo, owner } = createGizmo(TransformType.SCALE);

    owner.getSnapManager().cacheSnapTargetBoxes([
      new Box2(new Vector2(103, 104), new Vector2(113, 114)),
    ]);
    const snapHandlePoint = (gizmo as unknown as {
      snapHandlePoint: (point: Vector2) => Vector2,
    }).snapHandlePoint.bind(gizmo);

    const snapped = snapHandlePoint(new Vector2(100, 100));

    expect(snapped.x).to.equal(103);
    expect(snapped.y).to.equal(104);
    expect(owner.getSnapManager().result).to.deep.include({ x: -3, y: -4 });
    expect(owner.getSnapManager().getSnappingVisualizations().length).to.be.greaterThan(0);
  });

  it('四个角点均按拓扑索引找到固定对角点', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const box = new Box2().setFromCenterAndSize(new Vector2(100, 80), new Vector2(120, 60));

    setWireframeBox(gizmo, box);
    const internal = gizmo as unknown as {
      oppositeScaleCorner: (corner: Vector2) => Vector2 | undefined,
    };

    const corners = getBoxCorners(box);

    corners.forEach((corner, index) => {
      expect(internal.oppositeScaleCorner(corner)).to.deep.equal(corners[(index + 2) % 4]);
    });
  });

  it('text width handle follows the raw pointer after leaving the snap threshold', () => {
    const { gizmo } = createGizmo(TransformType.WIDTH_SCALE);

    gizmo.cursorPoint.set(95, 10);

    const handleAnchoredResize = chai.spy();
    const internal = gizmo as unknown as {
      handleWidthScale: (shift: Vector2, direction: Vector2, event: InputEventMouse) => number,
      handleAnchoredResize: typeof handleAnchoredResize,
    };

    internal.handleAnchoredResize = handleAnchoredResize;

    const event = mouseMotion(107, 10);

    internal.handleWidthScale(new Vector2(12, 0), new Vector2(1, 0), event);

    expect(handleAnchoredResize).to.have.been.called.with.exactly(new Vector2(107, 10), new Vector2(1, 0), event);
  });

  it('两类缩放都由 ResizeSelection 的首次工具分发直接建立会话', () => {
    for (const type of [TransformType.SCALE, TransformType.WIDTH_SCALE]) {
      const { gizmo } = createGizmo(type);
      const beginTransformOperation = chai.spy()

      ;(gizmo as unknown as { beginTransformOperation: typeof beginTransformOperation }).beginTransformOperation = beginTransformOperation;

      const down = mouseButton(10, 20, true);

      expect(accepted(down, () => gizmo.onMouseDown(down))).to.equal(true);
      expect(beginTransformOperation).to.have.been.called.once;
    }
  });

  it('仅无按键 hover 命中缩放控制点时阻止元素预选', () => {
    for (const type of [TransformType.SCALE, TransformType.WIDTH_SCALE]) {
      const selection = createSelection();
      const { gizmo } = createGizmo(type, selection);

      const hover = mouseMotion(10, 20, MouseButtonMask.None);

      expect(accepted(hover, () => gizmo.onMouseMove(hover))).to.equal(true);
      expect(selection.clearHover).not.to.have.been.called();
      const pressed = mouseMotion(10, 20);

      expect(accepted(pressed, () => gizmo.onMouseMove(pressed))).to.equal(false);
    }

    const { gizmo } = createGizmo(TransformType.TRANSLATION);
    const hover = mouseMotion(10, 20, MouseButtonMask.None);

    expect(accepted(hover, () => gizmo.onMouseMove(hover))).to.equal(false);
  });

  it('非文本统一渲染：蓝色边线 + 4 角点方形手柄 + 信息标签，无圆形/无纹理', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const item = {
      type: spec.ItemType.sprite,
      transform: { rotation: { z: 0 } },
    } as VFXItem;

    spyOnGetter(gizmo, 'selectedItems', () => ([item]));

    gizmo.wireframe.box.setFromCenterAndSize(new Vector2(50, 50), new Vector2(100, 40));
    // refreshWireframeBySelectedItems 被 mock，手动补齐统一 draw 路径所需几何
    const corners = getBoxCorners(gizmo.wireframe.box);

    gizmo.wireframe.transform = getBoxTransform(corners);
    gizmo.wireframe.edges = corners.map((c, i) => new Line2(
      new Vector2().copyFrom(c),
      new Vector2().copyFrom(corners[(i + 1) % 4]),
    ));
    gizmo.wireframe.scaleCorners = corners.map(c => new Circle(
      new Vector2().copyFrom(c),
      gizmo.config.scaleCircleSize,
    ));
    gizmo.wireframe.cornerEnable = true;
    gizmo.wireframe.widthScaleAreas = [];

    const drawLine = chai.spy();
    const fillRect = chai.spy();
    const fillCircle = chai.spy();
    const drawCircle = chai.spy();
    const drawTexture = chai.spy();
    const pushTransform = chai.spy();
    const popTransform = chai.spy();
    const control = {
      drawLine,
      fillRect,
      fillCircle,
      drawCircle,
      drawTexture,
      engine: { renderingServer: { graphics: { pushTransform, popTransform } } },
    } as unknown as Control;
    const renderItemInfo = chai.spy()

    ;(gizmo as unknown as { renderItemInfo: typeof renderItemInfo }).renderItemInfo = renderItemInfo;

    gizmo.draw(control);

    // 蓝色边线 4 条（首条 drawLine 为边线，末参数=线宽）
    expect(getSpyCalls(drawLine)[0].at(-1)).to.equal(gizmo.config.wireframeWidth);
    // 4 角点为方形手柄：fillRect 在旋转变换内按全宽全高填充（半边长=scaleCircleSize → 8×8），每个手柄压一次变换
    expect(fillRect).to.have.been.called.exactly(4);
    expect(getSpyCalls(fillRect)[0].slice(2, 4)).to.deep.equal([gizmo.config.scaleCircleSize * 2, gizmo.config.scaleCircleSize * 2]);
    expect(pushTransform).to.have.been.called.exactly(4);
    expect(popTransform).to.have.been.called.exactly(4);
    // 无圆形角点、无边中圆点、无旋转贴图
    expect(fillCircle).not.to.have.been.called();
    expect(drawCircle).not.to.have.been.called();
    expect(drawTexture).not.to.have.been.called();
    // 非文本单选渲染信息标签
    expect(renderItemInfo).to.have.been.called();
  });

  it('selection transform kind 为 move 时隐藏整个 transform overlay', () => {
    const { gizmo, owner } = createGizmo(TransformType.NULL);

    owner.setSelectionTransformKind('move');
    const renderItemInfo = chai.spy.on(gizmo as unknown as { renderItemInfo: () => void }, 'renderItemInfo', () => {});

    gizmo.wireframe.box.setFromCenterAndSize(new Vector2(50, 50), new Vector2(100, 40));
    const corners = getBoxCorners(gizmo.wireframe.box);

    gizmo.wireframe.transform = getBoxTransform(corners);
    gizmo.wireframe.edges = corners.map((corner, index) => new Line2(
      new Vector2().copyFrom(corner),
      new Vector2().copyFrom(corners[(index + 1) % corners.length]),
    ));
    gizmo.wireframe.scaleCorners = corners.map(corner => new Circle(
      new Vector2().copyFrom(corner),
      gizmo.config.scaleCircleSize,
    ));
    gizmo.wireframe.cornerEnable = true;

    const drawLine = chai.spy();
    const fillRect = chai.spy();
    const control = {
      drawLine,
      fillRect,
      engine: { renderingServer: { graphics: { pushTransform: chai.spy(), popTransform: chai.spy() } } },
    } as unknown as Control;

    gizmo.draw(control);

    expect(drawLine).not.to.have.been.called();
    expect(fillRect).not.to.have.been.called();
    expect(renderItemInfo).not.to.have.been.called();
  });

  it('单文本不渲染信息标签（无 icon/名称/尺寸），仍绘蓝色边线 + 4 角点方形手柄', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const textItem = {
      type: spec.ItemType.text,
      transform: { rotation: { z: 0 } },
    } as VFXItem;

    spyOnGetter(gizmo, 'selectedItems', () => ([textItem]));

    gizmo.wireframe.box.setFromCenterAndSize(new Vector2(50, 50), new Vector2(100, 40));
    const corners = getBoxCorners(gizmo.wireframe.box);

    gizmo.wireframe.transform = getBoxTransform(corners);
    gizmo.wireframe.edges = corners.map((c, i) => new Line2(
      new Vector2().copyFrom(c),
      new Vector2().copyFrom(corners[(i + 1) % 4]),
    ));
    gizmo.wireframe.scaleCorners = corners.map(c => new Circle(
      new Vector2().copyFrom(c),
      gizmo.config.scaleCircleSize,
    ));
    gizmo.wireframe.cornerEnable = true;
    gizmo.wireframe.widthScaleAreas = [];

    const drawLine = chai.spy();
    const fillRect = chai.spy();
    const drawTexture = chai.spy();
    const pushTransform = chai.spy();
    const popTransform = chai.spy();
    const control = {
      drawLine,
      fillRect,
      drawTexture,
      engine: { renderingServer: { graphics: { pushTransform, popTransform } } },
    } as unknown as Control;
    const renderItemInfo = chai.spy()

    ;(gizmo as unknown as { renderItemInfo: typeof renderItemInfo }).renderItemInfo = renderItemInfo;

    gizmo.draw(control);

    // 边线 + 方形手柄仍绘制
    expect(getSpyCalls(drawLine)[0].at(-1)).to.equal(gizmo.config.wireframeWidth);
    expect(fillRect).to.have.been.called.exactly(4);
    // 单文本不渲染信息标签（无 icon/名称/尺寸/纹理）
    expect(renderItemInfo).not.to.have.been.called();
    expect(drawTexture).not.to.have.been.called();
  });

  it('旋转文本包围盒的局部轴随旋转同步（宽度手柄命中/绘制基准）', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const c = Math.SQRT1_2;
    const s = Math.SQRT1_2;
    // 45° 旋转的包围盒，四角顺序为：(左上,右上,右下,左下)
    const rot = (x: number, y: number) => new Vector2(100 + x * c - y * s, 100 + x * s + y * c);
    const corners = [
      rot(-40, -20), rot(40, -20), rot(40, 20), rot(-40, 20),
    ];

    gizmo.wireframe.box = setBoxFromPoints(new Box2(), corners);
    gizmo.wireframe.transform = getBoxTransform(corners);
    const { xAxis, yAxis } = (gizmo as unknown as {
      boxLocalAxes: () => { xAxis: Vector2, yAxis: Vector2 },
    }).boxLocalAxes();

    // 水平轴随 45° 旋转为 (cos45, sin45)，不再是轴对齐 (1,0)
    expect(xAxis.x).to.be.closeTo(c, 0.5 * 10 ** -(5));
    expect(xAxis.y).to.be.closeTo(s, 0.5 * 10 ** -(5));
    // 竖轴与水平轴正交（点积为 0）
    expect(xAxis.x * yAxis.x + xAxis.y * yAxis.y).to.be.closeTo(0, 0.5 * 10 ** -(5));
  });

  it('文本角点缩小后，左右整条可用边仍能命中宽度调整', () => {
    const { gizmo } = createGizmo(TransformType.NULL);

    gizmo.refreshWireframeBySelectedItems = ResizeSelectionGizmo.prototype.refreshWireframeBySelectedItems;
    gizmo.refreshTransformType = ResizeSelectionGizmo.prototype.refreshTransformType;
    const size = new Vector2(0.2, 0.8);
    const textItem = {
      type: spec.ItemType.text,
      isVisible: true,
      getInstanceId: () => 'wrapped-text',
      getComponent: () => undefined,
      transform: {
        size,
        updateLocalMatrix: () => {},
        getWorldMatrix: () => new Matrix4(),
      },
      composition: {
        transform: { getWorldMatrix: () => new Matrix4() },
        camera: {
          getProjectionMatrix: () => new Matrix4(),
          getViewMatrix: () => new Matrix4(),
        },
      },
    } as unknown as VFXItem;

    spyOnGetter(gizmo, 'selectedItems', () => ([textItem]));

    // 先是 80 × 240 的多行文本，再模拟角点等比缩小到 20 × 60。
    for (const scalar of [1, 0.25]) {
      size.set(0.2 * scalar, 0.8 * scalar);
      gizmo.refreshWireframeBySelectedItems();
      expect(gizmo.wireframe.widthScaleAreas).to.have.lengthOf(2);
      for (const edgeIndex of [1, 3]) {
        const edge = gizmo.wireframe.edges[edgeIndex];

        for (const t of [0.25, 0.5, 0.75]) {
          gizmo.refreshTransformType(edge.at(t));
          expect(gizmo.activeType).to.equal(TransformType.WIDTH_SCALE);
        }
      }
      gizmo.refreshTransformType(gizmo.wireframe.scaleCorners[0].center);
      expect(gizmo.activeType).to.equal(TransformType.SCALE);
    }
  });

  it('旋转文本的左右边线带按旋转矩形命中，旋转矩形外的点不误命中', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const textItem = { type: spec.ItemType.text, transform: { rotation: { z: Math.PI / 4 } } } as VFXItem;

    spyOnGetter(gizmo, 'selectedItems', () => ([textItem]));

    // 45° 旋转的左右边线命中带：中心 (100,100)，半厚 3 沿宽轴、半长 9 沿竖轴
    const center = new Vector2(100, 100);
    const xAxis = new Vector2(Math.SQRT1_2, Math.SQRT1_2);
    const yAxis = new Vector2(-Math.SQRT1_2, Math.SQRT1_2);

    gizmo.wireframe.interactive = true;
    gizmo.wireframe.widthScaleAreas = [getBoxTransform(getRotatedBoxCorners(center, xAxis, yAxis, 3, 9))!];
    gizmo.wireframe.scaleCorners = [];
    gizmo.wireframe.box = new Box2();
    // 统一 computeTransformType 有 totalBox 预检，覆盖测试点
    gizmo.wireframe.totalBox = setBoxFromPoints(new Box2(), [
      new Vector2(50, 50), new Vector2(150, 50), new Vector2(150, 150), new Vector2(50, 150),
    ]);

    const compute = (gizmo as unknown as {
      computeTransformType: (point: Vector2) => TransformType,
    }).computeTransformType.bind(gizmo);

    // 命中带中心与沿旋转宽轴内偏移 2（半厚 3 内）的点命中 WIDTH_SCALE
    expect(compute(new Vector2(100, 100))).to.equal(TransformType.WIDTH_SCALE);
    expect(compute(center.clone().add(xAxis.clone().multiply(2)))).to.equal(TransformType.WIDTH_SCALE);
    // 沿旋转宽轴偏移 4（超出半厚 3）的点落在旋转矩形外，不命中 WIDTH_SCALE
    expect(compute(center.clone().add(xAxis.clone().multiply(4)))).not.to.equal(TransformType.WIDTH_SCALE);
  });

  it('文字左右边改输入框宽度，上下边改字号', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const textItem = { type: spec.ItemType.text } as VFXItem;

    spyOnGetter(gizmo, 'selectedItems', () => ([textItem]));
    // 轴对齐盒 100..200 × 100..200，按固定四角顺序构造。
    const corners = [
      new Vector2(100, 100), new Vector2(200, 100), new Vector2(200, 200), new Vector2(100, 200),
    ];
    const box = setBoxFromPoints(new Box2(), corners);

    gizmo.wireframe.interactive = true;
    gizmo.wireframe.box = box;
    gizmo.wireframe.transform = getBoxTransform(corners);
    gizmo.wireframe.edges = corners.map((corner, index) => (
      new Line2(corner, corners[(index + 1) % corners.length])
    ));
    gizmo.wireframe.totalBox = setBoxFromPoints(new Box2(), [
      new Vector2(80, 80), new Vector2(220, 80), new Vector2(220, 220), new Vector2(80, 220),
    ]);
    // 角点缩放圆（4 角）
    gizmo.wireframe.scaleCorners = corners.map(c => new Circle(
      new Vector2().copyFrom(c),
      gizmo.config.scaleCircleSize,
    ));
    // 左/右竖边中点宽度回流命中带（沿轴对齐局部轴，半厚 4、半长 边长/2 - scaleCircleSize）
    const { xAxis, yAxis } = (gizmo as unknown as {
      boxLocalAxes: () => { xAxis: Vector2, yAxis: Vector2 },
    }).boxLocalAxes();
    const edgeLen = corners[0].distance(corners[1]);
    const halfLen = edgeLen / 2 - 7;

    gizmo.wireframe.widthScaleAreas = [
      getBoxTransform(getRotatedBoxCorners(
        new Line2(corners[1], corners[2]).at(0.5), xAxis, yAxis, 4, halfLen,
      ))!,
      getBoxTransform(getRotatedBoxCorners(
        new Line2(corners[3], corners[0]).at(0.5), xAxis, yAxis, 4, halfLen,
      ))!,
    ];
    const compute = (gizmo as unknown as {
      computeTransformType: (point: Vector2) => TransformType,
    }).computeTransformType.bind(gizmo);

    // 左/右边中点命中宽度回流（命中带优先于角点/平移）
    expect(compute(new Vector2(200, 150))).to.equal(TransformType.WIDTH_SCALE);
    expect(compute(new Vector2(100, 150))).to.equal(TransformType.WIDTH_SCALE);
    // 上/下边命中字号缩放；仅离开边命中带后的盒内区域才是平移。
    expect(compute(new Vector2(150, 103))).to.equal(TransformType.SCALE);
    expect(compute(new Vector2(150, 197))).to.equal(TransformType.SCALE);
    expect(compute(new Vector2(150, 115))).to.equal(TransformType.TRANSLATION);
  });

  it('文字宽度会话按交互方向取真实左/右边，旋转后仍不选错边', () => {
    const { gizmo } = createGizmo(TransformType.NULL);
    const getEdge = (gizmo as unknown as {
      draggedWidthEdge: (center: Vector2, dir: Vector2) => Line2 | undefined,
    }).draggedWidthEdge.bind(gizmo);

    // 轴对齐：中心 (100,100)，宽 80（半宽 40）高 40
    const axisAlignedCorners = [
      new Vector2(60, 80), new Vector2(140, 80), new Vector2(140, 120), new Vector2(60, 120),
    ];

    gizmo.wireframe.box = setBoxFromPoints(new Box2(), axisAlignedCorners);
    gizmo.wireframe.transform = getBoxTransform(axisAlignedCorners);
    const center = new Vector2(100, 100);
    const right = getEdge(center, new Vector2(1, 0))!.getCenter();
    const left = getEdge(center, new Vector2(-1, 0))!.getCenter();

    expect(right).to.deep.equal(new Vector2(140, 100));
    expect(left).to.deep.equal(new Vector2(60, 100));
    // 起点到中心距离 = 真实半宽（originLength 不再陈旧）
    expect(right.distance(center)).to.equal(40);
    expect(left.distance(center)).to.equal(40);

    // 45° 旋转：中心 (100,100)，角点顺序 (左上,右上,右下,左下)，半宽 40、半高 20
    const c = Math.SQRT1_2;
    const s = Math.SQRT1_2;
    const rot = (x: number, y: number) => new Vector2(100 + x * c - y * s, 100 + x * s + y * c);
    const rotatedCorners = [
      rot(-40, -20), rot(40, -20), rot(40, 20), rot(-40, 20),
    ];

    gizmo.wireframe.box = setBoxFromPoints(new Box2(), rotatedCorners);
    gizmo.wireframe.transform = getBoxTransform(rotatedCorners);
    // 旋转后右侧手柄方向 = 局部 +x 旋转 45° = (cos45, sin45)
    const xDir = new Vector2(c, s);
    const rotRight = getEdge(center, xDir)!.getCenter();
    const rotLeft = getEdge(center, xDir.clone().multiply(-1))!.getCenter();

    expect(rotRight.distance(center)).to.be.closeTo(40, 0.5 * 10 ** -(5));
    expect(rotLeft.distance(center)).to.be.closeTo(40, 0.5 * 10 ** -(5));
    expect(rotRight.clone().subtract(center).dot(xDir)).to.be.greaterThan(0);
    expect(rotLeft.clone().subtract(center).dot(xDir)).to.be.lessThan(0);
  });

});
});
