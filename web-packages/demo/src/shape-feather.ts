import { Composition, Player, ShapeComponent, TextureLoadAction, VFXItem, math, spec } from '@galacean/effects';

type ShapeKind = 'rectangle' | 'ellipse' | 'star';
type FeatherShapeData = spec.ShapeComponentData & { featherRadius: number };

const container = document.getElementById('J-container')!;
const stage = document.getElementById('stage')!;
const form = document.getElementById('controls') as HTMLFormElement;
const radius = document.getElementById('radius') as HTMLInputElement;
const radiusMax = document.getElementById('radius-max') as HTMLInputElement;
const radiusLimit = document.getElementById('radius-limit')!;
const radiusValue = document.getElementById('radius-value') as HTMLOutputElement;
const radiusLabel = document.getElementById('radius-label')!;
const shapeSelect = document.getElementById('shape') as HTMLSelectElement;
const paintSelect = document.getElementById('paint') as HTMLSelectElement;
const layersSelect = document.getElementById('layers') as HTMLSelectElement;
const countSelect = document.getElementById('count') as HTMLSelectElement;
const backgroundSelect = document.getElementById('background') as HTMLSelectElement;
const status = document.getElementById('status')!;
const shapeKinds: ShapeKind[] = ['rectangle', 'ellipse', 'star'];

let player: Player | undefined;
let composition: Composition;
let featheredShapes: ShapeComponent[] = [];
let frame = 0;
let rebuildPending = false;
let width = 0;
let height = 0;

function createFill (): spec.PaintData {
  if (paintSelect.value === 'solid') {
    return { type: spec.FillType.Solid, color: { r: 1, g: 0.43, b: 0.29, a: 1 } };
  }
  const types = {
    linear: spec.FillType.GradientLinear,
    radial: spec.FillType.GradientRadial,
    angular: spec.FillType.GradientAngular,
  } as const;
  const type = types[paintSelect.value as keyof typeof types];

  return {
    type,
    gradientStops: [spec.ValueType.GRADIENT_COLOR, [
      [0, 1, 0.8, 0.47, 1],
      [0.5, 1, 0.47, 0.4, 1],
      [1, 0.74, 0.37, 0.85, 1],
    ]],
    startPoint: type === spec.FillType.GradientLinear ? { x: 0, y: 1 } : { x: 0.5, y: 0.5 },
    endPoint: { x: 1, y: 0.5 },
  };
}

function createShape (kind: ShapeKind, size: number, x: number, y: number, feather: number): ShapeComponent {
  const item = new VFXItem(player!.engine);
  const shape = item.addComponent(ShapeComponent);
  const geometry = {
    rectangle: { type: spec.ShapePrimitiveType.Rectangle, width: size, height: size * 0.72, roundness: size * 0.13 },
    ellipse: { type: spec.ShapePrimitiveType.Ellipse, xRadius: size * 0.46, yRadius: size * 0.46 },
    star: { type: spec.ShapePrimitiveType.Star, pointCount: 5, outerRadius: size * 0.55, innerRadius: size * 0.25, outerRoundness: 0, innerRoundness: 0 },
  }[kind];
  const data: FeatherShapeData = {
    ...geometry,
    id: shape.getInstanceId(),
    item: { id: item.getInstanceId() },
    dataType: spec.DataType.ShapeComponent,
    fills: layersSelect.value === 'stroke' ? [] : [createFill()],
    strokes: layersSelect.value === 'fill' ? [] : [{
      type: spec.FillType.Solid,
      color: { r: 0.37, g: 0.78, b: 1, a: 1 },
    }],
    strokeWidth: Math.max(4, size * 0.065),
    strokeJoin: spec.LineJoin.Round,
    featherRadius: feather,
  };

  shape.fromData(data);
  item.transform.setPosition(x, y, 0);
  item.setParent(composition.sceneRoot);
  shape.onUpdate(0);

  return shape;
}

function render (): void {
  if (!player) {
    return;
  }
  const feather = Number(radius.value);

  radiusValue.value = `${feather} px`;
  radiusLabel.textContent = `${feather} px`;
  for (const shape of featheredShapes) {
    shape.featherRenderer.featherRadius = feather;
    shape.onApplyAnimationProperties();
    shape.onUpdate(0);
  }
  player.renderer.renderCompositions([composition], {
    colorAction: TextureLoadAction.clear,
    clearColor: [0, 0, 0, 0],
    depthAction: TextureLoadAction.clear,
    stencilAction: TextureLoadAction.clear,
  });
  player.engine.renderingServer.renderTargetPool.flush();
  const error = player.engine.renderErrors.values().next().value as Error | undefined;

  if (error) {
    throw error;
  }
  status.dataset.error = 'false';
  status.textContent = `共 ${Number(countSelect.value) * 2} 个图形 · 每侧 ${countSelect.value} 个`;
}

function rebuild (): void {
  player?.dispose();
  player = undefined;
  featheredShapes = [];
  width = stage.clientWidth;
  height = stage.clientHeight;
  player = new Player({
    container,
    manualRender: true,
    renderFramework: 'webgl2',
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    transparentBackground: true,
  });
  composition = new Composition(player.engine);
  const camera = composition.camera;

  camera.fov = 60;
  camera.clipMode = spec.CameraClipMode.landscape;
  camera.far = 10000;
  camera.position = new math.Vector3(0, 0, height / (2 * Math.tan(Math.PI / 6)));
  camera.updateMatrix();

  const count = Number(countSelect.value);
  const columns = count <= 3 ? 1 : count <= 12 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const cellWidth = (width / 2 - 40) / columns;
  const cellHeight = (height - 80) / rows;
  const size = Math.min(cellWidth, cellHeight) * 0.57;

  for (let i = 0; i < count; i++) {
    const kind = shapeSelect.value === 'mixed' ? shapeKinds[i % shapeKinds.length] : shapeSelect.value as ShapeKind;
    const localX = 20 + (i % columns + 0.5) * cellWidth;
    const y = height / 2 - 40 - (Math.floor(i / columns) + 0.5) * cellHeight;

    createShape(kind, size, localX - width / 2, y, 0);
    featheredShapes.push(createShape(kind, size, localX, y, Number(radius.value)));
  }
  render();
}

function requestRender (recreate = false): void {
  rebuildPending ||= recreate;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    try {
      if (rebuildPending) {
        rebuildPending = false;
        rebuild();
      } else {
        render();
      }
    } catch (error) {
      status.dataset.error = 'true';
      status.textContent = `绘制失败：${error instanceof Error ? error.message : String(error)}`;
      console.error(error);
    }
  });
}

function updateRadiusLimit (): void {
  if (!radiusMax.validity.valid) {
    radiusMax.value = radius.max;
  }
  radius.max = radiusMax.value;
  radiusLimit.textContent = `${radiusMax.value} px`;
}

radius.addEventListener('input', () => requestRender());
radiusMax.addEventListener('change', () => {
  updateRadiusLimit();
  requestRender();
});
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('change', event => {
  stage.dataset.background = backgroundSelect.value;
  if (event.target !== radius && event.target !== radiusMax && event.target !== backgroundSelect) {
    requestRender(true);
  }
});
document.getElementById('reset-params')!.addEventListener('click', () => {
  form.reset();
  updateRadiusLimit();
  radius.value = radius.defaultValue;
  stage.dataset.background = backgroundSelect.value;
  requestRender(true);
});
const observer = new ResizeObserver(() => {
  if (stage.clientWidth !== width || stage.clientHeight !== height) {
    requestRender(true);
  }
});

observer.observe(stage);
window.addEventListener('beforeunload', () => {
  observer.disconnect();
  cancelAnimationFrame(frame);
  player?.dispose();
}, { once: true });
requestRender(true);
