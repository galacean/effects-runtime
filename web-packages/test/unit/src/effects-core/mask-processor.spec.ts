import type { Renderer } from '@galacean/effects-core';
import { Engine } from '@galacean/effects-core';
import { Geometry, MaskProcessor, glContext, SpriteComponent, math, VFXItem, Material } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

const dummyRef = { id: 'existing-mask-id' };

const vs = `attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
}`;

const fs = `precision highp float;
void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}`;

/**
 * 创建用作 Maskable 的 SpriteComponent，spy 替换 drawStencilMask 以追踪调用
 */
function createMaskableSprite (engine: Engine, name = 'mask'): SpriteComponent {
  const item = new VFXItem(engine);
  const sprite = item.addComponent(SpriteComponent);

  sprite.name = name;
  chai.spy.on(sprite, 'drawStencilMask', () => {});

  return sprite;
}

/**
 * 创建用作 RendererComponent 的 SpriteComponent，使用指定的材质列表
 */
function createSpriteRendererComponent (engine: Engine, materials: Material[]): SpriteComponent {
  const item = new VFXItem(engine);
  const sprite = item.addComponent(SpriteComponent);

  sprite.materials = materials;

  return sprite;
}
describe('core/material/mask-processor', () => {
  let canvas: HTMLCanvasElement;
  let engine: Engine;
  let renderer: Renderer;

  before(() => {
    canvas = document.createElement('canvas');
    const glEngine = new Engine(canvas, { glType: 'webgl2' });

    engine = glEngine;
    renderer = glEngine.renderer;

    const existingMask = createMaskableSprite(engine, 'existing-mask');

    existingMask.setInstanceId('existing-mask-id');
  });

  afterEach(() => {
    (renderer.engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary.dispose();
  });

  after(() => {
    engine.dispose();
    // @ts-expect-error
    renderer = null;
    // @ts-expect-error
    engine = null;
    canvas.remove();
    // @ts-expect-error
    canvas = null;
  });

  // ==================== 构造与初始值 ====================

  describe('constructor & defaults', () => {
    it('should have correct default values', () => {
      const mp = new MaskProcessor();

      expect(mp.alphaMaskEnabled).to.eql(false);
      expect(mp.isTrackMatte).to.eql(false);
    });

  });

  // ==================== addTrackMatteReference / removeTrackMatteReference / clearTrackMatteReferences ====================

  describe('mask reference management', () => {
    it('addTrackMatteReference should add a mask reference', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(sprite);
      mp.applyMasks(renderer, component);
      expect(sprite.drawStencilMask).to.have.been.called();
      expect(material.stencilTest).to.eql(true);
    });

    it('addTrackMatteReference should not add duplicate maskable', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(sprite);
      mp.addTrackMatteReference(sprite);
      mp.removeTrackMatteReference(sprite);
      mp.applyMasks(renderer, component);
      expect(material.stencilTest).to.eql(false);
    });

    it('addTrackMatteReference should support multiple different masks', () => {
      const mp = new MaskProcessor();
      const sprite1 = createMaskableSprite(engine, 'm1');
      const sprite2 = createMaskableSprite(engine, 'm2');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(sprite1);
      mp.addTrackMatteReference(sprite2);
      mp.applyMasks(renderer, component);
      expect(sprite1.drawStencilMask).to.have.been.called();
      expect(sprite2.drawStencilMask).to.have.been.called();
      expect(material.stencilRef).to.deep.equals([2, 2]);
    });

    it('removeTrackMatteReference should remove a mask reference', () => {
      const mp = new MaskProcessor();
      const sprite1 = createMaskableSprite(engine, 'm1');
      const sprite2 = createMaskableSprite(engine, 'm2');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(sprite1);
      mp.addTrackMatteReference(sprite2);
      mp.removeTrackMatteReference(sprite1);
      mp.applyMasks(renderer, component);
      expect(sprite2.drawStencilMask).to.have.been.called();
      expect(material.stencilRef).to.deep.equals([1, 1]);
    });

    it('removeTrackMatteReference should do nothing for non-existent maskable', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.removeTrackMatteReference(sprite);
      mp.applyMasks(renderer, component);
      expect(material.stencilTest).to.eql(false);
    });

    it('clearTrackMatteReferences should remove all references', () => {
      const mp = new MaskProcessor();
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(createMaskableSprite(engine, 'm1'));
      mp.addTrackMatteReference(createMaskableSprite(engine, 'm2'));
      mp.clearTrackMatteReferences();
      mp.applyMasks(renderer, component);
      expect(material.stencilTest).to.eql(false);
    });
  });

  // ==================== applyMasks ====================

  describe('applyMasks', () => {
    it('should call renderer.clear and drawStencilMask on forward masks in order', () => {
      const mp = new MaskProcessor();
      const sprite1 = createMaskableSprite(engine, 'm1');
      const sprite2 = createMaskableSprite(engine, 'm2');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(sprite1, false);
      mp.addTrackMatteReference(sprite2, false);
      mp.applyMasks(renderer, component);

      expect(sprite1.drawStencilMask).to.have.been.called.with(0);
      expect(sprite2.drawStencilMask).to.have.been.called.with(1);
    });

    it('should handle reverse masks with forwardCount as maskRef', () => {
      const mp = new MaskProcessor();
      const forward = createMaskableSprite(engine, 'f1');
      const reverse = createMaskableSprite(engine, 'r1');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(forward, false);
      mp.addTrackMatteReference(reverse, true);
      mp.applyMasks(renderer, component);

      expect(forward.drawStencilMask).to.have.been.called.with(0);
      expect(reverse.drawStencilMask).to.have.been.called.with(1);
    });

    it('should setup stencil on masked material (forward only)', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(sprite, false);
      mp.applyMasks(renderer, component);

      expect(material.stencilTest).to.eql(true);
      expect(material.stencilRef).to.deep.equals([1, 1]);
      expect(material.stencilReadMask).to.deep.equals([0xFF, 0xFF]);
      expect(material.stencilFunc).to.deep.equals([glContext.EQUAL, glContext.EQUAL]);
      expect(material.stencilOpZPass).to.deep.equals([glContext.KEEP, glContext.KEEP]);
    });

    it('should disable stencil when no mask references', () => {
      const mp = new MaskProcessor();
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.applyMasks(renderer, component);

      expect(material.stencilTest).to.eql(false);
    });

    it('should not remove existing references that are also frame clip masks', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(sprite);
      component.frameClipMasks = [sprite];

      mp.applyMasks(renderer, component);

      expect(mp.getTrackMatteReferences().length).to.eql(1);
      expect(mp.getTrackMatteReferences()[0].maskable).to.equal(sprite);
    });

    it('keeps frame clips out of track matte references when stencil drawing throws', () => {
      const mp = new MaskProcessor();
      const source = createMaskableSprite(engine);
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);
      const frameClip = {
        item: source.item,
        drawStencilMask (): void {
          throw new Error('Frame stencil draw failed');
        },
      };

      mp.addTrackMatteReference(source);
      component.frameClipMasks = [frameClip];

      expect(() => mp.applyMasks(renderer, component)).to.throw('Frame stencil draw failed');
      expect(mp.getTrackMatteReferences()).to.deep.equal([{ maskable: source, inverted: false }]);

      component.frameClipMasks = [];
      mp.applyMasks(renderer, component);
      expect(material.stencilRef).to.deep.equal([1, 1]);
    });

    it('should setup multiple materials', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const mat1 = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const mat2 = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [mat1, mat2]);

      mp.addTrackMatteReference(sprite, false);
      mp.applyMasks(renderer, component);

      expect(mat1.stencilTest).to.eql(true);
      expect(mat2.stencilTest).to.eql(true);
      expect(mat1.stencilRef).to.deep.equals([1, 1]);
      expect(mat2.stencilRef).to.deep.equals([1, 1]);
    });

    it('should set expectedStencilValue to the number of forward masks', () => {
      const mp = new MaskProcessor();
      const f1 = createMaskableSprite(engine, 'f1');
      const f2 = createMaskableSprite(engine, 'f2');
      const f3 = createMaskableSprite(engine, 'f3');
      const r1 = createMaskableSprite(engine, 'r1');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(f1, false);
      mp.addTrackMatteReference(f2, false);
      mp.addTrackMatteReference(f3, false);
      mp.addTrackMatteReference(r1, true);
      mp.applyMasks(renderer, component);

      expect(material.stencilRef).to.deep.equals([3, 3]);
      expect(r1.drawStencilMask).to.have.been.called.with(3);
    });
  });

  // ==================== drawStencilGeometry ====================

  describe('drawStencilGeometry', () => {
    it('should restore material state after drawing', () => {
      const mp = new MaskProcessor();
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const geometry = new Geometry(engine, {
        drawStart: 0,
        drawCount: 3,
        attributes: {
          'aPosition': {
            data: new Float32Array([0, 0, 1, 0, 0, 1]),
            size: 2,
            stride: 0,
            offset: 0,
          },
        },
      });

      // 设置初始值
      material.colorMask = true;
      material.stencilTest = false;
      material.stencilFunc = [glContext.ALWAYS, glContext.ALWAYS];
      material.stencilOpFail = [glContext.REPLACE, glContext.REPLACE];
      material.stencilOpZFail = [glContext.DECR, glContext.DECR];
      material.stencilOpZPass = [glContext.KEEP, glContext.KEEP];
      material.stencilRef = [0, 0];
      material.stencilReadMask = [0xFF, 0xFF];

      const worldMatrix = new math.Matrix4();

      mp.drawStencilGeometry(renderer, geometry, worldMatrix, material, 2);

      expect(material.colorMask).to.eql(true);
      expect(material.stencilTest).to.eql(false);
      expect(material.stencilFunc).to.deep.equals([glContext.ALWAYS, glContext.ALWAYS]);
      expect(material.stencilOpFail).to.deep.equals([glContext.REPLACE, glContext.REPLACE]);
      expect(material.stencilOpZFail).to.deep.equals([glContext.DECR, glContext.DECR]);
      expect(material.stencilOpZPass).to.deep.equals([glContext.KEEP, glContext.KEEP]);
      expect(material.stencilRef).to.deep.equals([0, 0]);
      expect(material.stencilReadMask).to.deep.equals([0xFF, 0xFF]);

      geometry.dispose();
    });
  });

  describe('loadTrackMatte', () => {
    it('restores track matte references and preserves them during unrelated updates', () => {
      const mp = new MaskProcessor();
      const source = engine.effectsObjectServer.findObject<SpriteComponent>(dummyRef);

      mp.loadTrackMatte(engine, { trackMatte: { references: [{ source: dummyRef, inverted: true }] } });
      expect(mp.getTrackMatteReferences()).to.deep.equal([{ maskable: source, inverted: true }]);

      mp.loadTrackMatte(engine, {});
      expect(mp.getTrackMatteReferences()).to.deep.equal([{ maskable: source, inverted: true }]);

      mp.loadTrackMatte(engine, { trackMatte: { references: [] } });
      expect(mp.getTrackMatteReferences()).to.deep.equal([]);
    });

    it('loads a visible track matte source', () => {
      const mp = new MaskProcessor();

      mp.loadTrackMatte(engine, { trackMatte: { isTrackMatte: true, sourceVisible: true } });

      expect(mp.isTrackMatte).to.eql(true);
      expect(mp.sourceVisible).to.eql(true);
    });

    it('defaults references to forward clipping', () => {
      const mp = new MaskProcessor();
      const existingMask = engine.effectsObjectServer.findObject<SpriteComponent>(dummyRef);

      mp.loadTrackMatte(engine, { trackMatte: { references: [{ source: dummyRef }] } });

      expect(mp.getTrackMatteReferences()).to.deep.equal([{ maskable: existingMask, inverted: false }]);
    });

    it('should skip unresolved entries while loading valid mask paths', () => {
      const mp = new MaskProcessor();

      mp.loadTrackMatte(engine, {
        trackMatte: { references: [{ source: { id: 'missing-mask' } }, { source: dummyRef, inverted: true }] },
      });

      expect(mp.getTrackMatteReferences()).to.deep.equal([
        { maskable: engine.effectsObjectServer.findObject(dummyRef), inverted: true },
      ]);
    });

    it('should warn and cap when mask references exceed the stencil limit', () => {
      const mp = new MaskProcessor();
      const references = Array.from({ length: 256 }, (_, i) => {
        const id = `cap-mask-${i}`;
        const sprite = createMaskableSprite(engine, id);

        sprite.setInstanceId(id);

        return { source: { id }, inverted: false };
      });

      mp.loadTrackMatte(engine, { trackMatte: { references } });

      expect(mp.getTrackMatteReferences().length).to.eql(254);
    });

    it('should deduplicate references pointing to the same maskable', () => {
      const mp = new MaskProcessor();
      const references = Array.from({ length: 5 }, () => ({ source: dummyRef, inverted: false }));

      mp.loadTrackMatte(engine, { trackMatte: { references } });

      expect(mp.getTrackMatteReferences().length).to.eql(1);
    });

    it('should set alphaMaskEnabled', () => {
      const mp = new MaskProcessor();

      mp.loadTrackMatte(engine, { trackMatte: { alphaMaskEnabled: true } });

      expect(mp.alphaMaskEnabled).to.eql(true);
    });

    it('should clear previous references when called again', () => {
      const mp = new MaskProcessor();
      const sprite1 = createMaskableSprite(engine, 'm1');
      const sprite2 = createMaskableSprite(engine, 'm2');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addTrackMatteReference(sprite1);
      mp.addTrackMatteReference(sprite2);

      mp.loadTrackMatte(engine, { trackMatte: { isTrackMatte: true } });
      mp.applyMasks(renderer, component);
      expect(material.stencilTest).to.eql(false);
    });
  });
});
