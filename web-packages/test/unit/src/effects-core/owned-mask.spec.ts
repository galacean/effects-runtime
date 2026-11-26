import {
  CacheDataManager, Composition, CompositionComponent, Engine, FloatPropertyMixerPlayable, FloatPropertyPlayableAsset,
  Geometry, RendererComponent, MaskComponent, Material, Player, ShapeComponent, SerializationHelper, TextureLoadAction,
  ParticleSystem, ParticleSystemRenderer,
  TrackAsset, VFXItem, glContext, math, spec,
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

function pathData (points: spec.Vector2Data[], easingIns: spec.Vector2Data[] = [], easingOuts: spec.Vector2Data[] = [], close = true): spec.MaskPathData {
  return { points, easingIns, easingOuts, shapes: [{ close, indexes: points.map((_, i) => ({ point: i, easingIn: i, easingOut: i })) }] };
}

function rectangle (left: number, bottom: number, right: number, top: number): spec.MaskPathData {
  return pathData([{ x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: top }]);
}

function entry (id: string, path: spec.MaskPathData, operation = Add, inverted = false): spec.PathMaskData {
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
      target.maskProcessor.applyMasks(renderer, target);
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
        it(`composes Add then ${spec.MaskOperation[operation]}, inverted=${inverted}`, () => {
          mask.setMasks([
            entry('a', rectangle(-1, -1, 0, 1)),
            entry('b', rectangle(-1, -1, 1, 0), operation, inverted),
          ]);
          expect(render()).deep.equals(expected((x, y) => {
            const a = x < 0;
            const b = (y < 0) !== inverted;

            return operation === Add ? a || b : operation === Subtract ? a && !b : a && b;
          }));
        });
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

    it('supports self-intersecting contours', () => {
      mask.setMasks([entry('cross', pathData([{ x: -1, y: -1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }]))]);
      const cross = render();

      expect(cross[3 * 8]).equals(true);
      expect(cross[3]).equals(false);
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
      it(`intersects track mattes and frame clipping, inverted=${inverted}`, () => {
        const sourceItem = new VFXItem(engine);
        const sourceGeometry = Geometry.create(engine, {
          attributes: { aPos: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 0, 1, 0]) } },
          mode: glContext.TRIANGLE_STRIP, drawCount: 4,
        });
        const source = { item: sourceItem, drawStencilMask: (ref: number) => {
          target.maskProcessor.drawStencilGeometry(engine.renderer, sourceGeometry, math.Matrix4.IDENTITY, material, ref);
        } };

        resources.push(sourceItem, sourceGeometry);
        target.maskProcessor.addTrackMatteReference(source, inverted);
        mask.setMasks([entry('a', rectangle(-1, -1, 0, 1))]);
        expect(render()).deep.equals(expected((x, y) => x < 0 && ((y < 0) !== inverted)));
        target.maskProcessor.clearTrackMatteReferences();
        target.frameClipMasks.push(source);
        expect(render()).deep.equals(expected((x, y) => x < 0 && y < 0));
        expect(target.maskProcessor.getTrackMatteReferences()).has.length(0);
      });
    }

    it('does not overflow stencil with more than 254 owned paths', () => {
      mask.setMasks(Array.from({ length: 260 }, (_, i) => entry(`p${i}`, rectangle(-1, -1, 0, 1))));
      expect(render()).deep.equals(expected(x => x < 0));
    });

    it('preserves saturated track matte counters when combining a path stack', () => {
      const sourceItem = new VFXItem(engine);

      resources.push(sourceItem);
      for (let i = 0; i < 254; i++) {
        target.maskProcessor.addTrackMatteReference({ item: sourceItem, drawStencilMask: ref => {
          target.maskProcessor.drawStencilGeometry(engine.renderer, geometry, math.Matrix4.IDENTITY, material, ref);
        } }, i === 253);
      }
      mask.setMasks([entry('a', rectangle(-1, -1, 0, 1))]);
      expect(render()).deep.equals(expected(() => false));
      const last = target.maskProcessor.getTrackMatteReferences()[253];

      target.maskProcessor.removeTrackMatteReference(last.maskable);
      target.maskProcessor.addTrackMatteReference(last.maskable, false);
      expect(render()).deep.equals(expected(x => x < 0));
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
      // 直接复用形状的路径数据，顶点和控制柄索引保持不变。
      mask.setMasks([entry('shape', data)]);
      expect(render()).deep.equals(coverage);
      const saved = SerializationHelper.serialize(shape);

      for (const key of ['points', 'easingIns', 'easingOuts', 'shapes'] as const) {
        expect(saved[key], key).deep.equals(original[key]);
        expect(mask.getMasks()[0].path[key], key).deep.equals(original[key]);
      }
      expect(saved).not.have.property('path');
      expect(data).deep.equals(original);

      Object.assign(data, rectangle(-1, -1, 0, 1));
      data.shapes[0].transform = {
        position: { x: 0.5, y: 0.5, z: 0 }, scale: { x: 0.5, y: 0.5, z: 1 }, eulerHint: { x: 0, y: 0, z: 90 },
      };
      shape.fromData(data);
      shape.onUpdate(0);
      engine.renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });
      engine.renderer.renderMeshes([shape]);
      gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const transformed = Array.from({ length: 64 }, (_, i) => pixels[i * 4 + 3] > 127);

      expect(transformed).deep.equals(expected((x, y) => x > 0 && y > 0.5));
      mask.setMaskPath('shape', data);
      expect(render()).deep.equals(transformed);
    });

    it('clips indexed compound contours with a hole and skips open contours', () => {
      const path: spec.MaskPathData = {
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
      expect(render()).deep.equals(expected((x, y) => Math.abs(x) > 0.5 || Math.abs(y) > 0.5));
    });

    it('updates and reorders paths and round-trips their data and enabled state', () => {
      const path = rectangle(-1, -1, 0, 1);

      mask.setMasks([entry('a', path), entry('b', rectangle(-1, -1, 1, 0), Subtract)]);
      path.points[0].x = 99;
      expect(render()).deep.equals(expected((x, y) => x < 0 && y > 0));
      mask.moveMask('b', 0);
      expect(render()).deep.equals(expected((x, y) => x < 0 || y > 0));
      mask.enabled = false;
      const saved = SerializationHelper.serialize(mask);
      const restoredItem = new VFXItem(engine);
      const restored = restoredItem.addComponent(MaskComponent);

      resources.push(restoredItem);
      restored.fromData({ ...saved, id: restored.getInstanceId(), item: { id: restoredItem.getInstanceId() } } as spec.MaskComponentData);
      expect(restored.getMasks()).deep.equals(mask.getMasks());
      expect(restored.enabled).equals(false);
      expect(saved.enabled).equals(false);
      mask.enabled = true;
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

    it('animates vertices through property tracks after reordering and updating the stack', () => {
      target = item.addComponent(ShapeComponent);
      target.materials = [material];
      mask = item.getComponent(MaskComponent) ?? item.addComponent(MaskComponent);
      mask.setMasks([entry('a', rectangle(-1, -1, 0, 1)), { ...entry('b', rectangle(-1, -1, 1, 1)), enabled: false }]);
      const clip = new FloatPropertyPlayableAsset(engine);
      const track = new TrackAsset(engine);
      const mixer = new FloatPropertyMixerPlayable();
      const cache = new CacheDataManager({ trackData: new Map(), clipData: new Map(), sharedData: new Map() });

      resources.push(clip, track);
      cache.setTrackKey(0);
      clip.fromData({ id: 'mask-curve', dataType: spec.DataType.FloatPropertyPlayableAsset,
        curveData: [spec.ValueType.BEZIER_CURVE, [[spec.BezierKeyframeType.LINE, [0, 0]], [spec.BezierKeyframeType.LINE, [1, 1]]]],
      });
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

      mask.setMaskPath('a', pathData([{ x: -1, y: -1 }, { x: 0, y: 1 }]));
      sample(0.5);
      mask.setMaskPath('a', rectangle(-1, -1, 0, 1));
      sample(1);
      expect(mask.masks.a.path.points[2].x).equals(1);
      expect(render()).deep.equals(expected((x, y) => x < (y + 1) / 2));
    });

    it('keeps layer paths across renderer removal and releases clipping on mask removal', () => {
      const system = item.addComponent(ParticleSystem);
      const renderer = item.addComponent(ParticleSystemRenderer);

      renderer.maskProcessor = system.maskProcessor;
      target = renderer;
      target.materials = [material];
      mask.setMasks([entry('left', rectangle(-1, -1, 0, 1))]);
      expect(render()).deep.equals(expected(x => x < 0));
      renderer.dispose();
      system.dispose();
      target = item.addComponent(RendererComponent);
      target.materials = [material];
      expect(render()).deep.equals(expected(x => x < 0));
      mask.dispose();
      expect(render()).deep.equals(expected(() => true));
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
              position: { x: 0, y: -0.5, z: 0 }, scale: { x: 1, y: 1, z: 1 },
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
            id: 'matte-renderer', item: { id: 'matte' }, dataType: 'ShapeComponent', type: 1, width: 2, height: 1,
            fill: { color: { r: 0, g: 1, b: 0, a: 1 } }, renderer: { renderMode: 1 },
            ...(legacy ? { mask: { isMask: true } } : { trackMatte: { isTrackMatte: true } }),
          }],
        };
        const composition = await player.loadScene(scene);

        const loaded = composition.getItemByName('target')!;
        const graphic = loaded.getComponent(ShapeComponent);
        const source = composition.getItemByName('matte-only source')!.getComponent(ShapeComponent);

        source.priority = 0;
        graphic.priority = 1;
        player.gotoAndStop(0);
        const saved = SerializationHelper.serialize(graphic);

        expect(graphic).instanceOf(RendererComponent);
        const savedMask = SerializationHelper.serialize(loaded.getComponent(MaskComponent));

        expect(savedMask.masks).deep.equals([entry('left', rectangle(-1, -1, 0, 1))]);
        expect(savedMask.id).equals('layer-mask');
        expect(savedMask.item.id).equals('layer');
        expect(saved).not.have.property('pathMasks');
        expect(saved.trackMatte.references[0].source.id).equals('matte-renderer');
        expect(saved).not.have.property('mask');
        const gl = (player.engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
        const pixels = new Uint8Array(8 * 8 * 4);

        gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        expect(Array.from({ length: 64 }, (_, i) => pixels[i * 4] > 127)).deep.equals(expected((x, y) => x < 0 && y < 0));
        expect(Array.from({ length: 64 }, (_, i) => pixels[i * 4 + 3] > 127)).deep.equals(expected((x, y) => (legacy || x < 0) && y < 0));
        expect(player.engine.renderErrors.size).equals(0);

        const duplicate = await player.loadScene(scene);
        const duplicateGraphic = duplicate.getItemByName('target')!.getComponent(ShapeComponent);
        const duplicateSource = duplicate.getItemByName('matte-only source')!.getComponent(ShapeComponent);

        expect(duplicateSource).not.equals(source);
        expect(graphic.maskProcessor.getTrackMatteReferences()[0].maskable).equals(source);
        expect(duplicateGraphic.maskProcessor.getTrackMatteReferences()[0].maskable).equals(duplicateSource);
      });
    }
  });
}
