import type { Composition } from '@galacean/effects';
import { MaskComponent, Player, spec } from '@galacean/effects';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';

const { Add, Subtract, Intersect } = spec.MaskOperation;

type Mode = 'paths' | 'tracks' | 'combined';
type Shape = 'rectangle' | 'ellipse' | 'arrow';
type Source = Shape | 'image' | 'text';
type Content = 'fireworks' | 'coupon' | 'text' | 'video' | 'precomposition';
type PathEntry = { id: string, shape: Shape, operation: spec.MaskOperation, inverted: boolean, enabled: boolean, closed: boolean };
type TrackEntry = { source: Source, inverted: boolean };
type Preset = { name: string, expected: string, content?: Content, paths?: PathEntry[], tracks?: TrackEntry[], motion?: 'target' | 'source' | 'none', animate?: boolean };
const names = { rectangle: '矩形', ellipse: '椭圆', arrow: '箭头', image: '优惠券图片', text: '文字图层' };
const contentNames: Record<Content, string> = { fireworks: '烟花', coupon: '优惠券', text: '文字', video: '视频', precomposition: '预合成' };
const videoUrl = 'https://gw.alipayobjects.com/v/huamei_anctlg/afts/video/zdqnQqZit5AAAAAAAAAAAAAAfoeUAQBr';
const textWidth = 520;
const textHeight = 300;
const textWorldScale = 0.11092565 ** 2;
const colors = ['#b78aff', '#5ad6c3', '#ffbd69'];
const duration = 5;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const select = (id: string) => el<HTMLSelectElement>(id);
const input = (id: string) => el<HTMLInputElement>(id);
const pathEntry = (shape: Shape, operation = Add, inverted = false): PathEntry => ({ id: shape, shape, operation, inverted, enabled: true, closed: true });
const presets: Record<Mode, Preset[]> = {
  paths: [
    { name: 'Add · 两条路径并集', paths: [pathEntry('rectangle'), pathEntry('ellipse')], expected: '矩形或椭圆内的图片都保留。移动目标时，两条路径一起移动。' },
    { name: 'Subtract · 从矩形挖去椭圆', paths: [pathEntry('rectangle'), pathEntry('ellipse', Subtract)], expected: '先保留矩形，再挖去椭圆覆盖的部分。' },
    { name: 'Intersect · 两条路径交集', paths: [pathEntry('rectangle'), pathEntry('ellipse', Intersect)], expected: '只保留矩形与椭圆重叠的部分。' },
    { name: '三条路径 · 先并集再挖洞', paths: [pathEntry('rectangle'), pathEntry('ellipse'), pathEntry('arrow', Subtract)], expected: '(矩形 ∪ 椭圆) − 箭头；可以将箭头向上移，比较运算顺序。' },
    { name: '首项 Subtract · 保留路径外侧', paths: [pathEntry('ellipse', Subtract)], expected: '只有一条 Subtract 路径时，保留椭圆外侧的图片。' },
    { name: '反向路径 · 保留椭圆外侧', paths: [pathEntry('ellipse', Add, true)], expected: '反向先交换内外，再执行 Add；效果与首项 Subtract 相同。' },
    { name: '路径动画 · 顶点独立变化', paths: [pathEntry('rectangle')], animate: true, motion: 'none', expected: '目标静止，矩形右上顶点来回变化。动画绑定的是目标内部的路径。' },
    { name: '未闭合路径 · 不裁剪', paths: [{ ...pathEntry('arrow'), closed: false }], expected: '未闭合路径仍可编辑，但不裁剪目标。勾选“闭合”后生效。' },
    { name: '禁用路径 · 不裁剪', paths: [{ ...pathEntry('ellipse'), enabled: false }], expected: '禁用的路径不参与运算，勾选“启用”可恢复。' },
    { name: '空路径列表 · 完整显示', paths: [], expected: '没有有效路径时不裁剪内容。可在左侧添加新路径。' },
    { name: '文字 · 路径并集后挖洞', content: 'text', paths: [pathEntry('rectangle'), pathEntry('ellipse'), pathEntry('arrow', Subtract)], expected: '文字保留在矩形与椭圆的并集内，再被箭头挖空。移动文字时，内部路径一起移动。' },
    { name: '视频 · 两条路径交集', content: 'video', paths: [pathEntry('rectangle'), pathEntry('ellipse', Intersect)], expected: '视频在矩形与椭圆的交集内持续播放。移动或旋转视频时，两条路径跟随图层。' },
    { name: '预合成 · 图片与文字一起裁剪', content: 'precomposition', paths: [pathEntry('rectangle'), pathEntry('ellipse')], expected: '图片与文字属于同一个预合成。路径挂在预合成上，两个子图层一起被裁剪；移动或旋转目标时，内容与路径一起变化。' },
  ],
  tracks: [
    { name: '两个独立形状来源 · 交集', tracks: [{ source: 'rectangle', inverted: false }, { source: 'ellipse', inverted: false }], expected: '两个独立图层共同限制目标，只保留交集。来源移动不会带动目标。' },
    { name: '矩形来源 + 反向椭圆来源', tracks: [{ source: 'rectangle', inverted: false }, { source: 'ellipse', inverted: true }], expected: '目标在矩形内显示，同时排除椭圆区域。' },
    { name: '移动图片作为来源', tracks: [{ source: 'image', inverted: false }], expected: '优惠券图片独立移动，烟花图片只在它的有效轮廓内显示。' },
    { name: '仅反向图片来源', tracks: [{ source: 'image', inverted: true }], expected: '排除优惠券图片覆盖的区域；关闭透明轮廓裁剪可比较整张矩形。' },
    { name: '图片与形状两个来源', tracks: [{ source: 'image', inverted: false }, { source: 'ellipse', inverted: false }], expected: '目标同时受图片轮廓和椭圆图层限制。' },
    { name: '空来源列表 · 完整显示', tracks: [], expected: 'references 为空时不裁剪内容。' },
    { name: '文字 · 移动矩形作为来源', content: 'text', tracks: [{ source: 'rectangle', inverted: false }], expected: '文字保持原位，独立矩形移动时逐步显示或遮住字形。矩形不属于文字图层。' },
    { name: '视频 · 椭圆来源减去箭头来源', content: 'video', tracks: [{ source: 'ellipse', inverted: false }, { source: 'arrow', inverted: true }], expected: '视频在独立椭圆内播放，同时排除箭头区域。来源移动不会带动视频图层。' },
    { name: '文字作为来源 · 视频填充字形', content: 'video', tracks: [{ source: 'text', inverted: false }], expected: '独立文字图层作为轨道遮罩，视频只显示在字形轮廓内。关闭透明轮廓裁剪，可比较文字纹理的整个矩形。' },
  ],
  combined: [
    { name: '自有路径并集 ∩ 外部椭圆', paths: [pathEntry('rectangle'), pathEntry('arrow')], tracks: [{ source: 'ellipse', inverted: false }], expected: '先计算目标自己的路径并集，再与独立椭圆来源求交集。移动目标时，自有路径跟随，外部来源不跟随。', motion: 'target' },
    { name: '自有路径挖洞 ∩ 移动图片', paths: [pathEntry('rectangle'), pathEntry('ellipse', Subtract)], tracks: [{ source: 'image', inverted: false }], expected: '目标自己的矩形减去椭圆，再被移动的图片来源裁剪。', motion: 'source' },
  ],
};

let mode: Mode = 'paths';
let paths: PathEntry[] = [];
let tracks: TrackEntry[] = [];
let animatedPath = false;
let nextId = 0;
let time = 0;
let playing = true;
let previousFrame = 0;
let loading = false;
let pending = false;
let ready = false;
let rebuildTimer: ReturnType<typeof setTimeout>;
let players: Player[] = [];
let compositions: Composition[] = [];
let videoListeners: (() => void)[] = [];
let resultScene: spec.JSONScene | undefined;

function contour (points: spec.Vector2Data[], easingIns: spec.Vector2Data[] = [], easingOuts: spec.Vector2Data[] = []): spec.ShapePathData {
  return { points, easingIns, easingOuts, shapes: [{ close: true, indexes: points.map((_, i) => ({ point: i, easingIn: i, easingOut: i })) }] };
}

function rectangle (left: number, bottom: number, right: number, top: number): spec.ShapePathData {
  return contour([{ x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: top }]);
}

function getPath (shape: Shape): spec.ShapePathData {
  if (shape === 'rectangle') {
    return rectangle(-2.7, -2.1, 0.9, 1.4);
  }
  if (shape === 'arrow') {
    return contour([{ x: -1.3, y: 1.9 }, { x: 1.8, y: 0 }, { x: -1.3, y: -1.9 }, { x: -0.4, y: 0 }]);
  }
  const rx = 2.15;
  const ry = 2.15;
  const k = 0.55228475;

  return contour(
    [{ x: 0.65 + rx, y: 0.5 }, { x: 0.65, y: 0.5 + ry }, { x: 0.65 - rx, y: 0.5 }, { x: 0.65, y: 0.5 - ry }],
    [{ x: 0, y: -k * ry }, { x: k * rx, y: 0 }, { x: 0, y: k * ry }, { x: -k * rx, y: 0 }],
    [{ x: 0, y: k * ry }, { x: -k * rx, y: 0 }, { x: 0, y: -k * ry }, { x: k * rx, y: 0 }],
  );
}

function pathData (): spec.PathMaskData[] {
  return paths.map(p => {
    const path = getPath(p.shape);

    for (const shape of path.shapes) { shape.close = p.closed; }

    return { id: p.id, name: names[p.shape], operation: p.operation, inverted: p.inverted, enabled: p.enabled, path };
  });
}

function shapeData (id: string, path: spec.ShapePathData, color: string) {
  const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255);

  return {
    id: `${id}-renderer`, item: { id }, dataType: spec.DataType.ShapeComponent, type: spec.ShapePrimitiveType.Custom,
    ...path,
    fills: [{ type: spec.FillType.Solid, color: { r: rgb[0], g: rgb[1], b: rgb[2], a: 1 } }], strokes: [],
  };
}

function spriteData (id: string, coupon: boolean) {
  return {
    id: `${id}-renderer`, item: { id }, dataType: spec.DataType.SpriteComponent,
    options: { startColor: [1, 1, 1, 1] }, renderer: { renderMode: spec.RenderMode.MESH, texture: { id: 'atlas-texture' } },
    splits: [coupon ? [0, 0, 0.3955078125, 0.5126953125, 0] : [0, 0.513671875, 0.2568359375, 0.2568359375, 0]],
  };
}

function textData (id: string) {
  return {
    id: `${id}-renderer`, item: { id }, dataType: spec.DataType.TextComponent,
    renderer: { renderMode: spec.RenderMode.MESH },
    options: {
      text: 'MASK\n文字蒙版', fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 112,
      textWidth, textHeight, lineHeight: 132, textColor: [0.62, 0.94, 0.89, 1],
      textAlign: spec.TextAlignment.middle, textVerticalAlign: spec.TextVerticalAlign.middle,
      autoResize: spec.TextSizeMode.fixed,
    },
  };
}

function videoData (id: string) {
  return {
    id: `${id}-renderer`, item: { id }, dataType: spec.DataType.VideoComponent,
    renderer: { renderMode: spec.RenderMode.MESH, texture: { id: 'video-texture' } },
    options: { video: { id: 'demo-video' }, muted: true, volume: 0, playbackRate: 1, startColor: [1, 1, 1, 1] },
  };
}

function contentSize (content: Content): [number, number] {
  if (content === 'text') { return [textWidth * textWorldScale, textHeight * textWorldScale]; }
  if (content === 'video') { return [7, 7 * 540 / 962]; }

  return content === 'coupon' ? [5.9, 6.8] : [6.5, 6.5];
}

function targetName (): string {
  return `目标 / ${contentNames[select('image').value as Content]}`;
}

function itemData (id: string, name: string, content: Content = 'fireworks'): Omit<spec.VFXItemData, 'content'> {
  const [width, height] = contentSize(content);

  return {
    id, name, dataType: spec.DataType.VFXItemData, type: spec.ItemType.sprite,
    duration, delay: 0, endBehavior: spec.EndBehavior.freeze,
    components: [{ id: `${id}-renderer` }], children: [],
    transform: {
      position: { x: 0, y: 0, z: 0 }, eulerHint: { x: 0, y: 0, z: id === 'target' ? Number(input('rotation').value) : 0 },
      scale: { x: 1, y: 1, z: 1 }, anchor: { x: 0, y: 0 }, size: { x: width, y: height },
    },
  };
}

function buildScene (view: 'input' | 'sources' | 'result'): spec.JSONScene {
  const showSources = view === 'sources' && mode !== 'paths';
  const showTarget = !showSources;
  const applyPaths = view !== 'input' && mode !== 'tracks';
  const applyTracks = view === 'result' && mode !== 'paths';
  const content = select('image').value as Content;
  const usesVideo = showTarget && view !== 'sources' && content === 'video';
  const usesAtlas = (showTarget && view !== 'sources' && (content === 'fireworks' || content === 'coupon' || content === 'precomposition')) ||
    (mode !== 'paths' && view !== 'input' && tracks.some(t => t.source === 'image'));
  const scene = {
    version: '3.7', type: 'ge', playerVersion: { web: '2.10.4', native: '0.0.0' },
    compositionId: 'demo',
    images: usesAtlas ? [{ id: 'atlas', url: 'https://mdn.alipayobjects.com/mars/afts/file/A*aNewSLDibJsAAAAASoAAAAgAelB4AQ/original' }] : [],
    videos: usesVideo ? [{ id: 'demo-video', url: videoUrl }] : [],
    textures: [
      ...(usesAtlas ? [{ id: 'atlas-texture', source: { id: 'atlas' }, flipY: true }] : []),
      ...(usesVideo ? [{ id: 'video-texture', source: { id: 'demo-video' }, flipY: true }] : []),
    ],
    shapes: [], plugins: usesVideo ? ['video'] : [], bins: [],
    compositions: [{
      id: 'demo', name: '路径蒙版与轨道遮罩', duration, endBehavior: spec.EndBehavior.freeze, previewSize: [900, 900],
      camera: { fov: 90, near: 0.1, far: 20, position: [0, 0, 4.5], rotation: [0, 0, 0], clipMode: 1 },
      components: [{ id: 'demo-composition' }], children: [] as spec.DataPath[],
    }],
    items: [] as Omit<spec.VFXItemData, 'content'>[], components: [] as spec.ComponentData[], miscs: [] as spec.EffectsObjectData[],
  };
  const composition = {
    id: 'demo-composition', dataType: spec.DataType.CompositionComponent, item: { id: 'demo' },
    timelineAsset: { id: 'timeline' }, sceneBindings: [] as { key: spec.DataPath, value: spec.DataPath }[],
  };

  scene.components.push(composition);
  const timeline = { id: 'timeline', dataType: spec.DataType.TimelineAsset, tracks: [] as spec.DataPath[] };

  scene.miscs.push(timeline);
  const addItem = (item: Omit<spec.VFXItemData, 'content'>, component: spec.ComponentData, siblings = scene.compositions[0].children) => {
    item.type = component.dataType === spec.DataType.CompositionComponent ? spec.ItemType.composition :
      component.dataType === spec.DataType.ShapeComponent ? spec.ItemType.shape :
        component.dataType === spec.DataType.TextComponent ? spec.ItemType.text :
          component.dataType === spec.DataType.VideoComponent ? spec.ItemType.video : spec.ItemType.sprite;
    scene.items.push(item);
    scene.components.push(component);
    siblings.push({ id: item.id });
    if (component.dataType === spec.DataType.VideoComponent) {
      addTrack(item.id, `${item.id}-activation`, spec.DataType.ActivationTrack, {
        id: `${item.id}-activation-asset`, dataType: spec.DataType.ActivationPlayableAsset,
      });
    }
  };
  const addTrack = (target: string, id: string, type: spec.DataType, asset: spec.EffectsObjectData, path?: string) => {
    const track = { id, dataType: type, path, children: [], clips: [{ start: 0, duration, endBehavior: spec.EndBehavior.freeze, asset: { id: asset.id } }] };

    scene.miscs.push(asset, track);
    timeline.tracks.push({ id });
    composition.sceneBindings.push({ key: { id }, value: { id: target } });
  };
  const addMotion = (id: string, amplitude: number) => addTrack(id, `${id}-motion`, spec.DataType.TransformTrack, {
    id: `${id}-motion-asset`, dataType: spec.DataType.TransformPlayableAsset,
    positionOverLifetime: { path: [spec.ValueType.BEZIER_CURVE_PATH, [
      [[spec.BezierKeyframeType.LINE, [0, 0]], [spec.BezierKeyframeType.LINE, [0.5, 0.5]], [spec.BezierKeyframeType.LINE, [1, 1]]],
      [[0, 0, 0], [amplitude, 0, 0], [0, 0, 0]],
      [[amplitude / 3, 0, 0], [amplitude * 2 / 3, 0, 0], [amplitude * 2 / 3, 0, 0], [amplitude / 3, 0, 0]],
    ]] },
  } as spec.EffectsObjectData);

  // Only referenced layers exist as scene sources; owned paths never become source items.
  if (mode !== 'paths' && view !== 'input') {
    for (const [index, source] of [...new Set(tracks.map(t => t.source))].entries()) {
      const id = `source-${source}`;
      const component = {
        ...(source === 'image' ? spriteData(id, true) : source === 'text' ? textData(id) : shapeData(id, getPath(source), colors[index % colors.length])),
        trackMatte: { isTrackMatte: !showSources, alphaMaskEnabled: input('alpha').checked },
      };

      addItem(itemData(id, `来源 / ${names[source]}`, source === 'image' ? 'coupon' : source === 'text' ? 'text' : 'fireworks'), component);
      if (select('motion').value === 'source' && index === 0) {
        addMotion(id, 1.8);
      }
    }
  }
  if (showTarget) {
    const item = itemData('target', targetName(), content);
    const [width, height] = contentSize(content);
    const drawing = content === 'text' ? textData('target') : content === 'video' ? videoData('target') : spriteData('target', content === 'coupon');
    const target = {
      ...(view === 'sources' ? shapeData('target', rectangle(-width / 2, -height / 2, width / 2, height / 2), '#ffffff') : drawing),
      trackMatte: { references: applyTracks ? tracks.map(t => ({ source: { id: `source-${t.source}-renderer` }, inverted: t.inverted })) : [] },
    };

    if (applyPaths) {
      const mask: spec.MaskComponentData = {
        id: 'target-mask', item: { id: item.id }, dataType: spec.DataType.MaskComponent, masks: pathData(),
      };

      item.components.push({ id: mask.id });
      scene.components.push(mask);
      if (animatedPath && paths.length) {
        addTrack(mask.id, 'path-animation', spec.DataType.FloatPropertyTrack, {
          id: 'path-animation-asset', dataType: spec.DataType.FloatPropertyPlayableAsset,
          curveData: [spec.ValueType.BEZIER_CURVE, [[spec.BezierKeyframeType.LINE, [0, 0.9]], [spec.BezierKeyframeType.LINE, [0.5, 2.5]], [spec.BezierKeyframeType.LINE, [1, 0.9]]]],
        } as spec.EffectsObjectData, `masks.${paths[0].id}.path.points.2.x`);
      }
    }
    if (content === 'precomposition' && view !== 'sources') {
      const children: spec.DataPath[] = [];

      item.children = children;
      item.components[0] = { id: 'target-composition' };
      addItem(item, {
        id: 'target-composition', item: { id: item.id }, dataType: spec.DataType.CompositionComponent,
        items: children, timelineAsset: { id: 'target-timeline' }, sceneBindings: [],
      } as spec.CompositionComponentData);
      scene.miscs.push({ id: 'target-timeline', dataType: spec.DataType.TimelineAsset, tracks: [] } as spec.TimelineAssetData);
      addTrack('target-composition', 'target-subcomposition', spec.DataType.SubCompositionTrack, {
        id: 'target-subcomposition-asset', dataType: spec.DataType.SubCompositionPlayableAsset,
      });

      const picture = itemData('target-picture', '预合成 / 烟花');
      const label = itemData('target-text', '预合成 / 文字', 'text');

      picture.transform!.size = { x: 5.6, y: 5.6 };
      picture.transform!.position = { x: 0, y: 0.4, z: 0 };
      label.transform!.size = { x: 5.4, y: 5.4 * textHeight / textWidth };
      label.transform!.position = { x: 0, y: -1.5, z: 0 };
      addItem(picture, spriteData(picture.id, false), children);
      addItem(label, textData(label.id), children);
    } else {
      addItem(item, target);
    }
    if (select('motion').value === 'target') {
      addMotion('target', 0.9);
    }
  }

  return scene as unknown as spec.JSONScene;
}

function optionList (items: [string, string][], value: string): string {
  return items.map(([id, label]) => `<option value="${id}"${id === value ? ' selected' : ''}>${label}</option>`).join('');
}

function editLists (): void {
  el('paths').innerHTML = paths.map((p, index) => `<div class="mask-row" data-path="${index}">
    <i class="dot" style="background:${colors[index % colors.length]}"></i>
    <select aria-label="路径 ${index + 1} 形状" data-field="shape">${optionList(Object.entries(names).filter(([id]) => id !== 'image' && id !== 'text'), p.shape)}</select>
    <select aria-label="路径 ${index + 1} 运算" data-field="operation">${optionList([[String(Add), 'Add'], [String(Subtract), 'Subtract'], [String(Intersect), 'Intersect']], String(p.operation))}</select>
    <div class="row-actions"><label><input type="checkbox" data-field="inverted" ${p.inverted ? 'checked' : ''}>反向</label><label><input type="checkbox" data-field="enabled" ${p.enabled ? 'checked' : ''}>启用</label><label><input type="checkbox" data-field="closed" ${p.closed ? 'checked' : ''}>闭合</label><button data-action="up" aria-label="上移路径 ${index + 1}" ${index ? '' : 'disabled'}>↑</button><button data-action="remove" aria-label="删除路径 ${index + 1}">×</button></div>
  </div>`).join('');
  el('tracks').innerHTML = tracks.map((t, index) => `<div class="mask-row" data-track="${index}">
    <i class="dot" style="background:${colors[index % colors.length]}"></i>
    <select aria-label="来源 ${index + 1}" data-field="source">${optionList(Object.entries(names), t.source)}</select><span class="muted">交集</span>
    <div class="row-actions"><label><input type="checkbox" data-field="inverted" ${t.inverted ? 'checked' : ''}>反向</label><button data-action="remove" aria-label="删除来源 ${index + 1}">×</button></div>
  </div>`).join('');
  el<HTMLButtonElement>('add-track').disabled = tracks.length >= Object.keys(names).length;
}

function updateExplanation (): void {
  el('paths-panel').hidden = mode === 'tracks';
  el('tracks-panel').hidden = mode === 'paths';
  input('outlines').parentElement!.hidden = mode === 'tracks';
  el('mode-title').textContent = mode === 'paths' ? '图层自带路径蒙版' : mode === 'tracks' ? '独立图层作为轨道遮罩' : '路径蒙版与轨道遮罩叠加';
  el('ownership').textContent = mode === 'paths' ? '路径属于目标图层；移动和旋转目标时，路径随它一起变化。' : mode === 'tracks' ? '来源是独立图层，通过 trackMatte.references 引用；不会随目标的变换一起移动。' : '目标内部的路径与外部引用分别配置，最终结果取交集。';
  el('source-title').textContent = mode === 'paths' ? '② 路径覆盖区域' : '② 独立来源图层';
  el('source-caption').textContent = mode === 'paths' ? '白色是实际运算后的保留区域；彩色线条是属于目标的路径轮廓。' : mode === 'tracks' ? '这里显示独立来源本身；它们的交集或反向裁剪体现在右侧。' : '显示外部来源。彩色线条来自目标自己的路径，两者不是同一类对象。';
  let expression = '';

  for (const p of paths.filter(p => p.enabled && p.closed)) {
    const name = `${p.inverted ? '反向 ' : ''}${names[p.shape]}`;

    expression = expression ? `(${expression} ${p.operation === Add ? '∪' : p.operation === Subtract ? '−' : '∩'} ${name})` : p.operation === Subtract ? `全区域 − ${name}` : name;
  }
  const trackExpression = tracks.map(t => `${t.inverted ? '反向 ' : ''}${names[t.source]}`).join(' ∩ ') || '全区域';

  el('formula').textContent = mode === 'paths' ? `路径：${expression || '全区域'}` : mode === 'tracks' ? `轨道遮罩：${trackExpression}` : `路径 [${expression || '全区域'}] ∩ 轨道遮罩 [${trackExpression}]`;
  el('structure').textContent = select('image').value === 'precomposition' ?
    `目标预合成\n  ├─ CompositionComponent\n  ├─ MaskComponent（裁剪两个子图层）\n${paths.map(p => `  │    └─ ${p.id} / ${names[p.shape]}`).join('\n')}\n  ├─ 图片子图层 / SpriteComponent\n  └─ 文字子图层 / TextComponent` :
    `目标图层\n  ├─ ${contentNames[select('image').value as Content]}组件（通过 MaskProcessor 裁剪）${mode !== 'paths' ? `\n  │    └─ trackMatte.references → ${tracks.map(t => `来源 / ${names[t.source]}`).join('、') || '空列表'}` : ''}${mode !== 'tracks' ? `\n  └─ MaskComponent\n${paths.map(p => `       └─ ${p.id} / ${names[p.shape]}（自有路径）`).join('\n')}` : ''}${mode !== 'paths' ? `\n\n独立来源图层\n${tracks.map(t => `  └─ ${names[t.source]}`).join('\n')}` : ''}`;
  el('config').textContent = JSON.stringify([
    ...(mode !== 'tracks' ? [{ id: 'target-mask', item: { id: 'target' }, dataType: spec.DataType.MaskComponent, masks: pathData() }] : []),
    ...(mode !== 'paths' ? [{ id: 'target-renderer', item: { id: 'target' }, trackMatte: { references: tracks.map(t => ({ source: { id: `source-${t.source}-renderer` }, inverted: t.inverted })) } }] : []),
  ], null, 2);
  el('legend').innerHTML = mode !== 'tracks' ? paths.map((p, index) => `<span><i class="dot" style="background:${colors[index % colors.length]}"></i>${names[p.shape]} · 自有路径${!p.enabled ? '（禁用）' : !p.closed ? '（未闭合）' : ''}</span>`).join('') : tracks.map((t, index) => `<span><i class="dot" style="background:${colors[index % colors.length]}"></i>${names[t.source]} · 独立图层</span>`).join('');
}

function guides (): void {
  const svg = el('path-guides');

  const hide = mode === 'tracks' || !input('outlines').checked;

  svg.toggleAttribute('hidden', hide);
  if (hide) {
    svg.innerHTML = '';

    return;
  }
  const item = compositions[2]?.getItemByName(targetName());
  const component = item?.getComponent(MaskComponent);

  if (!component || !item) {
    svg.innerHTML = '';

    return;
  }
  const e = item.transform.getWorldMatrix().elements;
  const elements = component.getMasks().map((m, index) => {
    const p = m.path;
    const d = p.shapes.map(shape => {
      if (shape.indexes.length === 0) { return ''; }
      const first = p.points[shape.indexes[0].point];
      let contour = `M ${first.x} ${first.y}`;

      for (let i = 1; i < shape.indexes.length + (shape.close ? 1 : 0); i++) {
        const previousIndex = shape.indexes[i - 1];
        const nextIndex = shape.indexes[i % shape.indexes.length];
        const previous = p.points[previousIndex.point];
        const next = p.points[nextIndex.point];
        const out = p.easingOuts[previousIndex.easingOut] ?? { x: 0, y: 0 };
        const incoming = p.easingIns[nextIndex.easingIn] ?? { x: 0, y: 0 };

        contour += ` C ${previous.x + out.x} ${previous.y + out.y} ${next.x + incoming.x} ${next.y + incoming.y} ${next.x} ${next.y}`;
      }

      return contour + (shape.close ? ' Z' : '');
    }).join(' ');

    return `<path d="${d}" fill="none" stroke="${colors[index % colors.length]}" stroke-width="2" vector-effect="non-scaling-stroke"${m.enabled === false ? ' stroke-dasharray="5 5" opacity=".4"' : ''}/>`;
  }).join('');

  svg.innerHTML = `<g transform="scale(1,-1)"><g transform="matrix(${e[0]} ${e[1]} ${e[4]} ${e[5]} ${e[12]} ${e[13]})">${elements}</g></g>`;
}

function updatePreview (): void {
  guides();
  input('time').value = String(time);
  el('clock').textContent = `${time.toFixed(2)} / 5s`;
  const canvas = players[0].canvas;

  el('resolution').textContent = `画布 ${canvas.width} × ${canvas.height} 像素 · DPR ${window.devicePixelRatio || 1}。文字使用高分辨率纹理，图片和视频的清晰度取决于素材本身。`;
}

function render (): void {
  if (!ready) { return; }
  for (const [index, player] of players.entries()) {
    const video = compositions[index].getItemByName(targetName())?.getComponent(VideoComponent);

    if (playing) {
      player.gotoAndPlay(time);
      video?.playVideo();
    } else {
      player.gotoAndStop(time);
      video?.pauseVideo();
    }
  }
  updatePreview();
}

function watchVideoFrames (): void {
  for (const [index, composition] of compositions.entries()) {
    const video = composition.getItemByName(targetName())?.getComponent(VideoComponent)?.video;
    const player = players[index];

    if (!video) { continue; }
    // A paused seek decodes asynchronously; redraw after the component has uploaded that frame.
    const redraw = () => requestAnimationFrame(() => {
      if (ready && players.includes(player)) { player.tick(0); }
    });

    video.addEventListener('seeked', redraw);
    video.addEventListener('loadeddata', redraw);
    let frameCallback: number | undefined;
    const decoded = () => {
      redraw();
      frameCallback = video.requestVideoFrameCallback(decoded);
    };

    if (video.requestVideoFrameCallback) { frameCallback = video.requestVideoFrameCallback(decoded); }
    videoListeners.push(() => {
      video.removeEventListener('seeked', redraw);
      video.removeEventListener('loadeddata', redraw);
      if (frameCallback !== undefined) { video.cancelVideoFrameCallback(frameCallback); }
    });
  }
}

async function rebuild (): Promise<void> {
  if (loading) {
    pending = true;

    return;
  }
  loading = true;
  do {
    pending = false;
    ready = false;
    el('status').className = 'muted';
    el('status').textContent = '加载中…';
    el<HTMLButtonElement>('download').disabled = true;
    updateExplanation();
    videoListeners.forEach(dispose => dispose());
    videoListeners = [];
    for (const player of players) {
      player.dispose();
    }
    players = [];
    compositions = [];
    try {
      const views = ['input', 'sources', 'result'] as const;
      const scenes = views.map(buildScene);

      resultScene = scenes[2];
      players = views.map(view => {
        const player = new Player({
          container: el(view), env: 'editor', manualRender: true, interactive: false, transparentBackground: true,
          pixelRatio: window.devicePixelRatio || 1, renderFramework: select('framework').value as 'webgl' | 'webgl2',
        });

        player.pause();

        return player;
      });
      compositions = await Promise.all(players.map((player, index) => player.loadScene(scenes[index], { autoplay: false })));
      players.forEach(player => player.pause());
      watchVideoFrames();
      ready = !pending;
      if (ready) {
        render();
        previousFrame = performance.now();
        el('status').textContent = '已加载 · 三个预览共用时间轴，视频默认静音';
        el<HTMLButtonElement>('download').disabled = false;
      }
    } catch (error) {
      el('status').className = 'error';
      el('status').textContent = `加载失败：${error instanceof Error ? error.message : String(error)}`;
      console.error(error);
    }
  } while (pending);
  loading = false;
}

function changed (): void {
  animatedPath = false;
  el('expected').textContent = '自定义配置。可拖动时间或旋转目标，对比路径与独立来源的归属。';
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => { void rebuild(); }, 100);
}

function choosePreset (): void {
  const preset = presets[mode][Number(select('case').value)];

  paths = (preset.paths ?? []).map(p => ({ ...p }));
  tracks = (preset.tracks ?? []).map(t => ({ ...t }));
  animatedPath = !!preset.animate;
  time = 0;
  select('image').value = preset.content ?? 'fireworks';
  select('motion').value = preset.motion ?? (mode === 'paths' ? 'target' : 'source');
  input('rotation').value = '0';
  el('rotation-value').textContent = '0°';
  input('alpha').checked = true;
  el('expected').textContent = preset.expected;
  editLists();
  clearTimeout(rebuildTimer);
  void rebuild();
}

function chooseMode (value: Mode, presetIndex = Math.max(0, presets[value].findIndex(preset => preset.content === select('image').value))): void {
  mode = value;
  select('image').querySelector<HTMLOptionElement>('option[value=precomposition]')!.disabled = mode !== 'paths';
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  select('case').innerHTML = optionList(presets[mode].map((preset, index) => [String(index), preset.name]), String(presetIndex));
  select('motion').querySelector<HTMLOptionElement>('option[value=source]')!.disabled = mode === 'paths';
  choosePreset();
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  button.onclick = () => chooseMode(button.dataset.mode as Mode);
}
select('case').onchange = choosePreset;
for (const id of ['image', 'framework', 'motion', 'alpha']) {
  el(id).onchange = () => { clearTimeout(rebuildTimer); void rebuild(); };
}
input('rotation').oninput = () => {
  el('rotation-value').textContent = `${input('rotation').value}°`;
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => { void rebuild(); }, 100);
};
input('outlines').onchange = guides;
el('paths').onchange = event => {
  const field = event.target as HTMLInputElement;
  const row = field.closest<HTMLElement>('[data-path]');

  if (!row) { return; }
  const p = paths[Number(row.dataset.path)];

  switch (field.dataset.field) {
    case 'shape': p.shape = field.value as Shape;

      break;
    case 'operation': p.operation = Number(field.value);

      break;
    case 'inverted': p.inverted = field.checked;

      break;
    case 'enabled': p.enabled = field.checked;

      break;
    case 'closed': p.closed = field.checked;

      break;
  }
  changed();
};
el('paths').onclick = event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  const row = button?.closest<HTMLElement>('[data-path]');

  if (!row) { return; }
  const index = Number(row.dataset.path);

  if (button!.dataset.action === 'up' && index > 0) { [paths[index - 1], paths[index]] = [paths[index], paths[index - 1]]; }
  if (button!.dataset.action === 'remove') { paths.splice(index, 1); }
  editLists(); changed();
};
el('tracks').onchange = event => {
  const field = event.target as HTMLInputElement;
  const row = field.closest<HTMLElement>('[data-track]');

  if (!row) { return; }
  const t = tracks[Number(row.dataset.track)];

  if (field.dataset.field === 'source') {
    const source = field.value as Source;

    if (tracks.some(other => other !== t && other.source === source)) {
      field.value = t.source;

      return;
    }
    t.source = source;
  } else { t.inverted = field.checked; }
  changed();
};
el('tracks').onclick = event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  const row = button?.closest<HTMLElement>('[data-track]');

  if (!row) { return; }
  tracks.splice(Number(row.dataset.track), 1); editLists(); changed();
};
el('add-path').onclick = () => {
  paths.push({ ...pathEntry('arrow'), id: `path-${++nextId}` }); editLists(); changed();
};
el('add-track').onclick = () => {
  const source = (Object.keys(names) as Source[]).find(key => !tracks.some(t => t.source === key));

  if (source) { tracks.push({ source, inverted: false }); editLists(); changed(); }
};
function pause (): void { playing = false; el('play').textContent = '播放'; }
el('play').onclick = () => { playing = !playing; el('play').textContent = playing ? '暂停' : '播放'; render(); };
el('restart').onclick = () => { time = 0; render(); };
el('step').onclick = () => { pause(); time = Math.min(duration, time + 1 / 30); render(); };
input('time').oninput = () => { pause(); time = Number(input('time').value); render(); };
el('download').onclick = () => {
  if (!resultScene || !ready) { return; }
  const url = URL.createObjectURL(new Blob([JSON.stringify(resultScene, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');

  anchor.href = url; anchor.download = `multi-mask-${mode}-${select('image').value}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
new ResizeObserver(() => {
  if (ready) { players.forEach(player => { player.resize(); player.tick(0); }); updatePreview(); }
}).observe(el('input'));
function frame (now: number): void {
  if (ready && playing) {
    const dt = Math.max(0, now - previousFrame);

    if (time + dt / 1000 >= duration) {
      time = (time + dt / 1000) % duration;
      render();
    } else {
      // Tick normally while playing; repeated gotoAndStop would seek the video on every frame.
      players.forEach(player => player.tick(dt));
      time = compositions[0].time;
      updatePreview();
    }
  }
  previousFrame = now;
  requestAnimationFrame(frame);
}
window.addEventListener('pagehide', () => {
  ready = false;
  videoListeners.forEach(dispose => dispose());
  players.forEach(player => player.dispose());
});
const query = new URLSearchParams(location.search);
const initialMode: Mode = query.get('mode') === 'tracks' ? 'tracks' : query.get('mode') === 'combined' ? 'combined' : 'paths';
const initialPreset = presets[initialMode].findIndex(preset => preset.content === query.get('content'));

chooseMode(initialMode, Math.max(0, initialPreset));
requestAnimationFrame(frame);
