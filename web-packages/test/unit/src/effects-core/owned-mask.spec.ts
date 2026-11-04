import {
  CacheDataManager, Composition, CompositionComponent, Engine, FloatPropertyMixerPlayable, FloatPropertyPlayableAsset,
  Geometry, RendererComponent, MaskComponent, Material, Player, ShapeComponent, SerializationHelper, TextureLoadAction,
  ParticleSystem, ParticleSystemRenderer,
  TimelineClip, TrackAsset, VFXItem, glContext, math, spec,
} from '@galacean/effects';
import type { PropertyClipPlayable } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;
const { Add, Subtract, Intersect } = spec.MaskOperation;
const operations = [Add, Subtract, Intersect];
const vertex = `attribute vec2 aPos;
uniform mat4 effects_MatrixVP;
uniform mat4 effects_ObjectToWorld;
void main() { gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 0.0, 1.0); }`;
const fragment = 'precision mediump float; void main() { gl_FragColor = vec4(1.0); }';

function pathData (points: spec.Vector2Data[], easingIns: spec.Vector2Data[] = [], easingOuts: spec.Vector2Data[] = [], close = true): spec.ShapePathData {
  return { points, easingIns, easingOuts, shapes: [{ close, indexes: points.map((_, i) => ({ point: i, easingIn: i, easingOut: i })) }] };
}

function rectangle (left: number, bottom: number, right: number, top: number): spec.ShapePathData {
  return pathData([{ x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: top }]);
}

function entry (id: string, path: spec.ShapePathData, operation = Add, inverted = false): spec.PathMaskData {
  return { id, path, operation, inverted };
}

for (const glType of ['webgl', 'webgl2'] as const) {
  describe(`core/owned-mask/${glType}`, () => {
    let engine: Engine;
    let item: VFXItem;
    let target: RendererComponent;
    let mask: MaskComponent;
    let geometry: Geometry;
    let material: Material;
    const resources: { dispose: () => void }[] = [];

    before(() => {
      const canvas = document.createElement('canvas');

      canvas.width = canvas.height = 8;
      engine = new Engine(canvas, { glType });
      engine.renderer.setGlobalMatrix('effects_MatrixVP', math.Matrix4.IDENTITY);
      engine.renderer.setViewport(0, 0, 8, 8);
    });
    after(() => engine.dispose());
    beforeEach(() => {
      engine.renderer.setGlobalMatrix('effects_MatrixVP', math.Matrix4.IDENTITY);
      item = new VFXItem(engine);
      target = item.addComponent(RendererComponent);
      mask = item.getComponent(MaskComponent) ?? item.addComponent(MaskComponent);
      material = Material.create(engine, { shader: { vertex, fragment } });
      material.depthTest = material.depthMask = material.blending = material.culling = false;
      geometry = Geometry.create(engine, {
        attributes: { aPos: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]) } },
        mode: glContext.TRIANGLE_STRIP, drawCount: 4,
      });
      target.materials = [material];
      resources.push(item, geometry, material);
    });
    afterEach(() => {
      for (const resource of resources.splice(0).reverse()) {
        resource.dispose();
      }
    });

    function render (): boolean[] {
      const renderer = engine.renderer;

      renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });
      target.maskManager.drawStencilMask(renderer, target);
      renderer.drawGeometry(geometry, item.transform.getWorldMatrix(), material);
      const gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
      const pixels = new Uint8Array(8 * 8 * 4);

      gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      expect(gl.getError()).equals(gl.NO_ERROR);
      expect(engine.renderErrors.size).equals(0);

      return Array.from({ length: 64 }, (_, i) => pixels[i * 4 + 3] > 127);
    }

    function expected (predicate: (x: number, y: number) => boolean): boolean[] {
      return Array.from({ length: 64 }, (_, i) => predicate((i % 8 + 0.5) / 4 - 1, (Math.floor(i / 8) + 0.5) / 4 - 1));
    }

    for (const operation of operations) {
      for (const inverted of [false, true]) {
        it(`evaluates leading ${spec.MaskOperation[operation]}, inverted=${inverted}`, () => {
          mask.setMasks([entry('a', rectangle(-1, -1, 0, 1), operation, inverted)]);
          expect(render()).deep.equals(expected(x => (x < 0) !== (inverted !== (operation === Subtract))));
        });
        for (const firstOperation of operations) {
          for (const firstInverted of [false, true]) {
            it(`composes ${firstOperation}/${firstInverted} then ${operation}/${inverted}`, () => {
              mask.setMasks([
                entry('a', rectangle(-1, -1, 0, 1), firstOperation, firstInverted),
                entry('b', rectangle(-1, -1, 1, 0), operation, inverted),
              ]);
              expect(render()).deep.equals(expected((x, y) => {
                const a = (x < 0) !== (firstInverted !== (firstOperation === Subtract));
                const b = (y < 0) !== inverted;

                return operation === Add ? a || b : operation === Subtract ? a && !b : a && b;
              }));
            });
          }
        }
      }
    }

    it('defaults to Add and ignores disabled, open and incomplete paths', () => {
      mask.setMasks([
        { id: 'a', path: rectangle(-1, -1, 0, 1) },
        { id: 'disabled', path: rectangle(-1, -1, 1, 1), enabled: false, operation: Subtract },
        { id: 'open', path: pathData(rectangle(-1, -1, 1, 1).points, [], [], false), operation: Subtract },
        { id: 'empty', path: pathData([]), operation: Intersect },
      ]);
      expect(render()).deep.equals(expected(x => x < 0));
      mask.enabled = false;
      expect(render()).deep.equals(expected(() => true));
      mask.enabled = true;
      mask.setMasks([]);
      expect(render()).deep.equals(expected(() => true));
    });

    it('round-trips the public component enabled flag independently of path switches', () => {
      const data: spec.MaskComponentData = {
        id: mask.getInstanceId(), item: { id: item.getInstanceId() }, dataType: spec.DataType.MaskComponent,
        enabled: false,
        masks: [
          entry('left', rectangle(-1, -1, 0, 1)),
          { ...entry('disabled', rectangle(-1, -1, 1, 1), Subtract), enabled: false },
        ],
      };

      SerializationHelper.deserialize(data, mask);
      expect(mask.enabled).equals(false);
      expect(render()).deep.equals(expected(() => true));
      const saved = SerializationHelper.serialize(mask) as spec.MaskComponentData;

      expect(saved.enabled).equals(false);
      expect(saved).not.have.property('_enabled');
      expect(saved.masks[1].enabled).equals(false);
      const enabledData: spec.MaskComponentData = { ...saved, enabled: true };

      SerializationHelper.deserialize(enabledData, mask);
      expect(mask.enabled).equals(true);
      expect(render()).deep.equals(expected(x => x < 0));
      mask.enabled = false;
      const defaults = { ...saved };

      delete defaults.enabled;
      SerializationHelper.deserialize(defaults, mask);
      expect(mask.enabled).equals(true);
      expect(render()).deep.equals(expected(x => x < 0));
    });

    it('supports holes, self intersections and zero-area closed contours', () => {
      mask.setMasks([
        entry('outer', rectangle(-1, -1, 1, 1)), entry('hole', rectangle(-0.5, -0.5, 0.5, 0.5), Subtract),
      ]);
      expect(render()).deep.equals(expected((x, y) => Math.abs(x) > 0.5 || Math.abs(y) > 0.5));
      mask.setMasks([entry('cross', pathData([{ x: -1, y: -1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }]))]);
      const cross = render();

      expect(cross[3 * 8]).equals(true);
      expect(cross[3]).equals(false);
      mask.setMasks([entry('line', pathData([{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }]))]);
      expect(render()).deep.equals(expected(() => false));
    });

    it('moves with its owner and ordinary transform parents without clipping siblings', () => {
      const parent = new VFXItem(engine);

      resources.push(parent);
      item.setParent(parent);
      parent.transform.setPosition(0.5, 0, 0);
      item.transform.setScale(0.5, 0.5, 1);
      mask.setMasks([entry('a', rectangle(-1, -1, 0, 1))]);
      parent.addComponent(MaskComponent).setMasks([entry('parentMask', rectangle(-10, -10, -9, -9))]);
      expect(render()).deep.equals(expected((x, y) => x > 0 && x < 0.5 && Math.abs(y) < 0.5));
    });

    it('intersects masks across precomposition boundaries', () => {
      const parent = new VFXItem(engine);

      resources.push(parent);
      parent.addComponent(CompositionComponent);

      item.setParent(parent);
      parent.addComponent(MaskComponent).setMasks([entry('parentMask', rectangle(-1, -1, 1, 0))]);
      mask.setMasks([entry('a', rectangle(-1, -1, 0, 1))]);
      expect(render()).deep.equals(expected((x, y) => x < 0 && y < 0));
    });

    for (const inverted of [false, true]) {
      it(`intersects legacy references and frame clipping, inverted=${inverted}`, () => {
        const sourceItem = new VFXItem(engine);
        const sourceGeometry = Geometry.create(engine, {
          attributes: { aPos: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 0, 1, 0]) } },
          mode: glContext.TRIANGLE_STRIP, drawCount: 4,
        });
        const source = { item: sourceItem, drawStencilMask: (ref: number) => {
          target.maskManager.drawGeometryMask(engine.renderer, sourceGeometry, math.Matrix4.IDENTITY, material, ref);
        } };

        resources.push(sourceItem, sourceGeometry);
        target.maskManager.addMaskReference(source, inverted);
        mask.setMasks([entry('a', rectangle(-1, -1, 0, 1))]);
        expect(render()).deep.equals(expected((x, y) => x < 0 && ((y < 0) !== inverted)));
        target.maskManager.clearMaskReferences();
        target.frameClipMasks.push(source);
        expect(render()).deep.equals(expected((x, y) => x < 0 && y < 0));
        expect(target.maskManager.getMaskReferences()).has.length(0);
      });
    }

    it('does not overflow stencil with more than 254 owned paths', () => {
      mask.setMasks(Array.from({ length: 260 }, (_, i) => entry(`p${i}`, rectangle(-1, -1, 0, 1))));
      expect(render()).deep.equals(expected(x => x < 0));
    });

    it('preserves saturated legacy counters when combining a path stack', () => {
      for (let i = 0; i < 254; i++) {
        target.maskManager.addMaskReference({ item, drawStencilMask: ref => {
          target.maskManager.drawGeometryMask(engine.renderer, geometry, math.Matrix4.IDENTITY, material, ref);
        } }, i === 253);
      }
      mask.setMasks([entry('a', rectangle(-1, -1, 0, 1))]);
      expect(render()).deep.equals(expected(() => false));
      const last = target.maskManager.getMaskReferences()[253];

      target.maskManager.removeMaskReference(last.maskable);
      target.maskManager.addMaskReference(last.maskable, false);
      expect(render()).deep.equals(expected(x => x < 0));
    });

    it('evaluates a two-vertex closed Bezier lens', () => {
      mask.setMasks([entry('lens', pathData(
        [{ x: -1, y: 0 }, { x: 1, y: 0 }],
        [{ x: 0, y: -1 }, { x: 0, y: 1 }],
        [{ x: 0, y: 1 }, { x: 0, y: -1 }],
      ))]);
      const pixels = render();

      expect(pixels[4 * 8 + 4]).equals(true);
      expect(pixels[0]).equals(false);
    });

    it('uses existing custom-shape JSON for masks and preserves shape serialization', () => {
      const composition = new Composition(engine);
      const shapeItem = new VFXItem(engine);

      composition.camera.fov = 90;
      composition.camera.aspect = 1;
      composition.camera.position = new math.Vector3(0, 0, 1);
      shapeItem.composition = composition;
      engine.renderer.setGlobalMatrix('effects_MatrixVP', composition.camera.getViewProjectionMatrix());
      const shape = shapeItem.addComponent(ShapeComponent);
      const data: spec.CustomShapeData = {
        id: shape.getInstanceId(), item: { id: shapeItem.getInstanceId() }, dataType: spec.DataType.ShapeComponent,
        type: spec.ShapePrimitiveType.Custom,
        points: [{ x: 1, y: 0 }, { x: 5, y: 5 }, { x: -1, y: 0 }],
        easingIns: [{ x: 8, y: 8 }, { x: 0, y: -1 }, { x: 0, y: 1 }],
        easingOuts: [{ x: 8, y: 8 }, { x: 0, y: -1 }, { x: 8, y: 8 }, { x: 0, y: 1 }],
        shapes: [{ close: true, indexes: [
          { point: 2, easingIn: 1, easingOut: 3 }, { point: 0, easingIn: 2, easingOut: 1 },
        ] }],
        fills: [{ type: spec.FillType.Solid, color: { r: 1, g: 1, b: 1, a: 1 } }], strokes: [],
      };
      const original = JSON.parse(JSON.stringify(data));

      resources.push(composition, shapeItem);
      SerializationHelper.deserialize(JSON.parse(JSON.stringify(data)), shape);
      shape.onUpdate(0);
      engine.renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });
      engine.renderer.renderMeshes([shape]);
      const gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
      const pixels = new Uint8Array(8 * 8 * 4);

      gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const coverage = Array.from({ length: 64 }, (_, i) => pixels[i * 4 + 3] > 127);

      expect(coverage[4 * 8 + 4]).equals(true);
      expect(coverage[0]).equals(false);
      // The same indexed fields are consumed directly, without remapping vertices or handles.
      mask.setMasks([entry('shape', data)]);
      expect(render()).deep.equals(coverage);
      const saved = SerializationHelper.serialize(shape);

      for (const key of ['points', 'easingIns', 'easingOuts', 'shapes'] as const) {
        expect(saved[key], key).deep.equals(original[key]);
        expect(mask.getMasks()[0].path[key], key).deep.equals(original[key]);
      }
      expect(saved).not.have.property('path');
      expect(data).deep.equals(original);
    });

    it('clips indexed compound contours with a hole and skips open contours', () => {
      const path: spec.ShapePathData = {
        points: [
          { x: -1, y: -1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 },
          { x: -0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: -0.5 }, { x: -0.5, y: 0.5 },
        ],
        easingIns: [{ x: 0, y: 0 }], easingOuts: [{ x: 0, y: 0 }],
        shapes: [
          { close: true, indexes: [0, 2, 1, 3].map(point => ({ point, easingIn: 0, easingOut: 0 })) },
          { close: true, indexes: [4, 7, 5, 6].map(point => ({ point, easingIn: 0, easingOut: 0 })) },
          { close: false, indexes: [0, 1, 2].map(point => ({ point, easingIn: 0, easingOut: 0 })) },
        ],
      };

      mask.setMasks([entry('compound', path)]);
      path.shapes[0].indexes[0].point = 1;
      expect(render()).deep.equals(expected((x, y) => Math.abs(x) > 0.5 || Math.abs(y) > 0.5));
      const snapshot = mask.getMasks();

      snapshot[0].path.shapes[1].close = false;
      expect(render()).deep.equals(expected((x, y) => Math.abs(x) > 0.5 || Math.abs(y) > 0.5));
      mask.setMasks(snapshot);
      expect(render()).deep.equals(expected(() => true));
    });

    it('updates curved geometry and serializes detached paths with stable IDs', () => {
      const path = rectangle(-1, -1, 0, 1);

      mask.setMasks([entry('a', path), entry('b', rectangle(-1, -1, 1, 0), Subtract)]);
      path.points[0].x = 99;
      expect(render()).deep.equals(expected((x, y) => x < 0 && y > 0));
      mask.moveMask('b', 0);
      expect(render()).deep.equals(expected((x, y) => x < 0 || y > 0));
      const saved = SerializationHelper.serialize(mask);
      const restoredItem = new VFXItem(engine);
      const restored = restoredItem.addComponent(MaskComponent);

      resources.push(restoredItem);
      restored.fromData({ ...saved, id: restored.getInstanceId(), item: { id: restoredItem.getInstanceId() } } as spec.MaskComponentData);
      expect(restored.getMasks()).deep.equals(mask.getMasks());
      mask.setMaskPath('a', rectangle(0, -1, 1, 1));
      expect(render()).deep.equals(expected((x, y) => x > 0 || y > 0));
      expect(saved.masks[1].path.points[0].x).equals(-1);
      mask.setMasks([entry('curve', pathData(
        [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }],
        [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }],
        [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0 }],
      ))]);
      expect(render()[5 * 8 + 4]).equals(true);
    });

    it('updates one path without rebuilding the other cached geometries', () => {
      mask.setMasks([
        entry('a', rectangle(-1, -1, 0, 1)),
        entry('b', rectangle(-1, -1, 1, 0), Subtract),
        entry('c', rectangle(-1, -1, 1, 1), Intersect),
      ]);
      expect(render()).deep.equals(expected((x, y) => x < 0 && y > 0));
      const upload = chai.spy.on(Geometry.prototype, 'setAttributeData');

      try {
        mask.setMaskPath('a', rectangle(0, -1, 1, 1));
        expect(render()).deep.equals(expected((x, y) => x > 0 && y > 0));
        expect(upload).called.once;
        expect(render()).deep.equals(expected((x, y) => x > 0 && y > 0));
        expect(upload).called.once;
      } finally {
        chai.spy.restore(Geometry.prototype, 'setAttributeData');
      }
    });

    it('animates vertices through property tracks after reordering and updating the stack', () => {
      target = item.addComponent(ShapeComponent);
      target.materials = [material];
      mask = item.getComponent(MaskComponent) ?? item.addComponent(MaskComponent);
      mask.setMasks([entry('a', rectangle(-1, -1, 0, 1)), { ...entry('b', rectangle(-1, -1, 1, 1)), enabled: false }]);
      const asset = new FloatPropertyPlayableAsset(engine);
      const track = new TrackAsset(engine);
      const mixer = new FloatPropertyMixerPlayable();
      const clip = new TimelineClip();
      const cache = new CacheDataManager({ trackData: new Map(), clipData: new Map(), sharedData: new Map() });

      resources.push(asset, track);
      cache.setTrackKey(0);
      asset.fromData({ id: 'mask-curve', dataType: spec.DataType.FloatPropertyPlayableAsset,
        curveData: [spec.ValueType.BEZIER_CURVE, [[spec.BezierKeyframeType.LINE, [0, 0]], [spec.BezierKeyframeType.LINE, [1, 1]]]],
      });
      clip.asset = asset;
      clip.start = 0;
      clip.duration = 2;
      track.createTrackMixer = () => mixer;
      track.compileClips([clip]);
      mixer.propertyPath = 'masks.a.path.points.2.x';
      const playable = mixer.getClipPlayable(0) as PropertyClipPlayable<number>;
      const sample = (time: number) => {
        playable.value = time;
        mixer.setClipWeight(0, 1);
        mixer.evaluate(0, mask, { time, deltaTime: 0 }, cache);
      };

      sample(0);
      expect(render()).deep.equals(expected(x => x < 0));
      mask.moveMask('b', 0);
      mask.setMasks(mask.getMasks());
      sample(1);
      expect(render()).deep.equals(expected((x, y) => x < (y + 1) / 2));
    });

    it('rejects malformed updates without replacing a valid stack', () => {
      mask.setMasks([entry('a', rectangle(-1, -1, 0, 1))]);
      expect(() => mask.setMasks([entry('duplicate', rectangle(-1, -1, 1, 1)), entry('duplicate', rectangle(-1, -1, 1, 1))])).throws();
      expect(() => mask.setMaskPath('a', pathData([{ x: NaN, y: 0 }]))).throws();
      const invalidIndex = rectangle(-1, -1, 1, 1);

      invalidIndex.shapes[0].indexes[0].point = 4;
      expect(() => mask.setMaskPath('a', invalidIndex)).throws();
      invalidIndex.shapes[0].indexes[0].point = 0;
      invalidIndex.easingIns = [{ x: 0, y: 0 }];
      expect(() => mask.setMaskPath('a', invalidIndex)).throws();
      expect(render()).deep.equals(expected(x => x < 0));
    });

    it('keeps layer paths alive when particle rendering components are removed', () => {
      const system = item.addComponent(ParticleSystem);
      const renderer = item.addComponent(ParticleSystemRenderer);

      renderer.maskManager = system.maskManager;
      target = renderer;
      target.materials = [material];
      mask.setMasks([entry('left', rectangle(-1, -1, 0, 1))]);
      expect(item.getComponent(MaskComponent)).equals(mask);
      expect(render()).deep.equals(expected(x => x < 0));
      renderer.enabled = false;
      expect(render()).deep.equals(expected(x => x < 0));

      let disposals = 0;
      const dispose = mask.dispose.bind(mask);

      mask.dispose = () => { disposals++; dispose(); };
      renderer.dispose();
      system.dispose();
      expect(disposals).equals(0);
      target = item.addComponent(RendererComponent);
      target.materials = [material];
      expect(render()).deep.equals(expected(x => x < 0));
      item.dispose();
      expect(disposals).equals(1);
    });

    it('shares layer paths across renderers and releases clipping when the mask is removed', () => {
      const first = target;
      const second = item.addComponent(RendererComponent);

      second.materials = [material];
      mask.setMasks([entry('left', rectangle(-1, -1, 0, 1))]);
      expect(render()).deep.equals(expected(x => x < 0));
      target = second;
      expect(render()).deep.equals(expected(x => x < 0));
      mask.enabled = false;
      expect(render()).deep.equals(expected(() => true));
      mask.enabled = true;
      target = first;
      expect(render()).deep.equals(expected(x => x < 0));
      mask.dispose();
      expect(item.getComponent(MaskComponent)).equals(undefined);
      expect(render()).deep.equals(expected(() => true));
      mask = item.addComponent(MaskComponent);
      mask.setMasks([entry('bottom', rectangle(-1, -1, 1, 0))]);
      target = second;
      expect(render()).deep.equals(expected((x, y) => y < 0));
    });

    for (const legacy of [false, true]) {
      it(`loads a layer MaskComponent with ${legacy ? 'visible legacy mask' : 'source-only trackMatte'} references`, async () => {
        const canvas = document.createElement('canvas');

        canvas.width = canvas.height = 8;
        const player = new Player({ canvas, manualRender: true, renderFramework: glType, pixelRatio: 1 });

        resources.push(player);
        const scene = {
          version: '3.2', type: 'ge', playerVersion: { web: '2.10.4', native: '0.0.0' },
          images: [], textures: [], shapes: [], plugins: [], bins: [],
          compositionId: '1', compositions: [{
            id: '1', name: 'owned-mask', duration: 5, endBehavior: 5, previewSize: [8, 8], items: [{ id: 'layer' }, { id: 'matte' }],
            camera: { fov: 90, near: 0.1, far: 20, position: [0, 0, 1], rotation: [0, 0, 0], clipMode: 1 },
          }],
          items: [{
            id: 'layer', dataType: 'VFXItemData', name: 'target', type: 'shape', duration: 5, delay: 0, endBehavior: 5,
            transform: {
              position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
              eulerHint: { x: 0, y: 0, z: 0 }, anchor: { x: 0, y: 0 },
            },
            components: [{ id: 'shape' }, { id: 'layer-mask' }],
          }, {
            id: 'matte', dataType: 'VFXItemData', name: 'matte-only source', type: 'shape', duration: 5, delay: 0, endBehavior: 5,
            transform: {
              position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
              eulerHint: { x: 0, y: 0, z: 0 }, anchor: { x: 0, y: 0 },
            },
            components: [{ id: 'matte-renderer' }],
          }],
          components: [{
            id: 'shape', item: { id: 'layer' }, dataType: 'ShapeComponent', type: 1, width: 2, height: 2,
            fill: { color: { r: 1, g: 1, b: 1, a: 1 } }, renderer: { renderMode: 1 },
            ...(legacy ? { mask: { references: [{ mask: { id: 'matte-renderer' } }] } } : { trackMatte: { references: [{ source: { id: 'matte-renderer' } }] } }),
          }, {
            id: 'layer-mask', item: { id: 'layer' }, dataType: 'MaskComponent',
            masks: [entry('left', rectangle(-1, -1, 0, 1))],
          }, {
            id: 'matte-renderer', item: { id: 'matte' }, dataType: 'ShapeComponent', type: 1, width: 2, height: 2,
            fill: { color: { r: 0, g: 1, b: 0, a: 1 } }, renderer: { renderMode: 1 },
            ...(legacy ? { mask: { isMask: true } } : { trackMatte: { isTrackMatte: true } }),
          }],
        };
        const composition = await player.loadScene(scene);

        player.gotoAndStop(0);
        const loaded = composition.getItemByName('target')!;

        const graphic = loaded.getComponent(ShapeComponent);
        const saved = SerializationHelper.serialize(graphic);

        expect(graphic).instanceOf(RendererComponent);
        expect(SerializationHelper.serialize(loaded.getComponent(MaskComponent)).masks).deep.equals([entry('left', rectangle(-1, -1, 0, 1))]);
        expect(saved).not.have.property('pathMasks');
        expect(saved.trackMatte.references[0].source.id).equals('matte-renderer');
        expect(saved).not.have.property('mask');
        const gl = (player.engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
        const pixels = new Uint8Array(8 * 8 * 4);

        gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        expect(Array.from({ length: 64 }, (_, i) => pixels[i * 4 + 3] > 127)).deep.equals(expected(x => legacy || x < 0));
        expect(player.engine.renderErrors.size).equals(0);

        const source = composition.getItemByName('matte-only source')!.getComponent(ShapeComponent);
        const sourceData = SerializationHelper.serialize(source);
        const exported = JSON.parse(JSON.stringify(scene));

        exported.components = exported.components.map((component: spec.ComponentData) => {
          return component.id === 'shape' ? saved : component.id === 'matte-renderer' ? sourceData : component;
        });
        player.destroyCurrentCompositions();
        await player.loadScene(exported);
        player.gotoAndStop(0);
        const reloadedPixels = new Uint8Array(pixels.length);

        gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, reloadedPixels);
        expect(Array.from(reloadedPixels)).deep.equals(Array.from(pixels));
        expect(player.engine.renderErrors.size).equals(0);
      });
    }
  });
}
