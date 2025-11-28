import type { Engine } from '@galacean/effects-core';
import { RenderTargetPool, FilterMode, RenderTextureFormat } from '@galacean/effects-core';
import type { GLRenderer } from '@galacean/effects-webgl';
import { GLEngine } from '@galacean/effects-webgl';

const { expect } = chai;

describe('effects-core/render-target-pool', () => {
  let engine: Engine;
  let renderer: GLRenderer;
  let canvas: HTMLCanvasElement;
  let pool: RenderTargetPool;

  before(() => {
    canvas = document.createElement('canvas');
    engine = new GLEngine(canvas, { glType: 'webgl' });
    renderer = engine.renderer as GLRenderer;
    pool = new RenderTargetPool(engine);
  });

  after(() => {
    pool.dispose();
    engine.dispose();
    canvas.remove();
  });

  afterEach(() => {
    // 每个测试后清理池中的资源
    pool.flush(true);
  });

  describe('constructor', () => {
    it('should create RenderTargetPool with engine reference', () => {
      const testPool = new RenderTargetPool(engine);

      expect(testPool.engine).to.equal(engine);
      testPool.dispose();
    });
  });

  describe('get', () => {
    it('should create new framebuffer when pool is empty', () => {
      const fb = pool.get('test', 256, 256);

      expect(fb).to.not.be.null;
      expect(fb.name).to.equal('test');
      // Check framebuffer properties through its attachments
      const colorTextures = fb.getColorTextures();

      fb.bind();
      expect(colorTextures).to.have.length(1);
      expect(colorTextures[0].getWidth()).to.equal(256);
      expect(colorTextures[0].getHeight()).to.equal(256);
      fb.unbind();
    });

    it('should create framebuffer with default parameters', () => {
      const fb = pool.get('default-test', 128, 128);

      expect(fb).to.not.be.null;
      expect(fb.name).to.equal('default-test');
      expect(fb.getColorTextures()).to.have.length(1);
    });

    it('should create framebuffer with custom filter mode', () => {
      const fb1 = pool.get('linear', 64, 64, 0, FilterMode.Linear);
      const fb2 = pool.get('nearest', 64, 64, 0, FilterMode.Nearest);

      expect(fb1).to.not.be.null;
      expect(fb2).to.not.be.null;
      expect(fb1.name).to.equal('linear');
      expect(fb2.name).to.equal('nearest');
    });

    it('should create framebuffer with different formats', () => {
      const fb1 = pool.get('rgba32', 32, 32, 0, FilterMode.Linear, RenderTextureFormat.RGBA32);
      const fb2 = pool.get('rgbahalf', 32, 32, 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);

      expect(fb1).to.not.be.null;
      expect(fb2).to.not.be.null;
    });

    it('should create framebuffer with depth buffer', () => {
      const fbNoDepth = pool.get('no-depth', 64, 64, 0);
      const fbDepth16 = pool.get('depth-16', 64, 64, 16);
      const fbDepth24 = pool.get('depth-24', 64, 64, 24);

      expect(fbNoDepth).to.not.be.null;
      expect(fbDepth16).to.not.be.null;
      expect(fbDepth24).to.not.be.null;
    });

    it('should reuse framebuffer from pool with same parameters', () => {
      // 创建一个framebuffer
      const fb1 = pool.get('test1', 100, 100, 0, FilterMode.Linear, RenderTextureFormat.RGBA32);

      // 释放它
      pool.release(fb1);

      // 用相同参数获取应该返回同一个framebuffer
      const fb2 = pool.get('test2', 100, 100, 0, FilterMode.Linear, RenderTextureFormat.RGBA32);

      expect(fb2).to.equal(fb1);
      expect(fb2.name).to.equal('test2'); // 名称应该被更新
    });

    it('should create new framebuffer when parameters differ', () => {
      const fb1 = pool.get('test1', 100, 100);

      pool.release(fb1);

      // 不同尺寸应该创建新的framebuffer
      const fb2 = pool.get('test2', 200, 200);

      expect(fb2).to.not.equal(fb1);
    });

    it('should not reuse occupied framebuffer', () => {
      const fb1 = pool.get('test1', 64, 64);
      // 不释放fb1

      const fb2 = pool.get('test2', 64, 64); // 相同参数但fb1还在使用

      expect(fb2).to.not.equal(fb1);
    });
  });

  describe('release', () => {
    it('should mark framebuffer as available for reuse', () => {
      const fb1 = pool.get('test1', 80, 80);

      expect(fb1).to.not.be.null;

      // 释放framebuffer
      pool.release(fb1);

      // 应该能够重用
      const fb2 = pool.get('test2', 80, 80);

      expect(fb2).to.equal(fb1);
      expect(fb2.name).to.equal('test2');
    });

    it('should handle releasing non-existent framebuffer gracefully', () => {
      const externalFb = pool.get('external', 32, 32);

      pool.release(externalFb); // 正常释放

      // 再次释放同一个framebuffer应该不会出错
      pool.release(externalFb);
    });
  });

  describe('flush', () => {
    it('should remove unused framebuffers after threshold frames', () => {
      const fb1 = pool.get('test1', 50, 50);

      pool.release(fb1);

      // 模拟经过多帧，超过阈值 (maxUnusedFrames = 4)
      for (let i = 0; i < 6; i++) {
        pool.flush();
      }

      // 现在获取相同参数的framebuffer应该创建新的
      const fb2 = pool.get('test2', 50, 50);

      expect(fb2).to.not.equal(fb1);
    });

    it('should keep occupied framebuffers during flush', () => {
      const fb1 = pool.get('occupied', 70, 70);
      // 不释放fb1，保持占用状态

      pool.flush(true); // 强制清理

      // fb1应该仍然有效且被占用
      const fb2 = pool.get('new', 70, 70);

      expect(fb2).to.not.equal(fb1); // 应该创建新的，因为fb1还在占用中
    });

    it('should force cleanup all unused framebuffers when force=true', () => {
      const fb1 = pool.get('test1', 90, 90);

      pool.release(fb1);

      // 强制清理所有未使用的RT
      pool.flush(true);

      // 现在获取相同参数应该创建新的framebuffer
      const fb2 = pool.get('test2', 90, 90);

      expect(fb2).to.not.equal(fb1);
    });

    it('should respect custom frames offset', () => {
      const fb1 = pool.get('custom-threshold', 40, 40);

      pool.release(fb1);

      // 使用自定义阈值0，第二次flush时应该清理
      pool.flush(false, 0);
      pool.flush(false, 0);

      const fb2 = pool.get('new-after-custom', 40, 40);

      expect(fb2).to.not.equal(fb1);
    });

    it('should increment frame counter on each flush', () => {
      const fb1 = pool.get('frame-test', 30, 30);

      pool.release(fb1);

      // 调用flush但不超过阈值
      pool.flush();
      pool.flush();

      // 应该还能重用
      const fb2 = pool.get('frame-test-2', 30, 30);

      expect(fb2).to.equal(fb1);
    });
  });

  describe('dispose', () => {
    it('should dispose all framebuffers in pool', () => {
      const testPool = new RenderTargetPool(engine);

      const fb1 = testPool.get('dispose-test1', 25, 25);
      const fb2 = testPool.get('dispose-test2', 35, 35);

      testPool.release(fb1);
      // fb2保持占用状态

      // dispose整个pool
      testPool.dispose();

      // 验证framebuffer已被销毁（通过检查后续行为）
      // 由于dispose后pool内部数组仍然存在但RT已销毁，这里主要确保不报错
    });
  });

  describe('parameter hashing', () => {
    it('should correctly hash parameters for cache key', () => {
      // 测试不同参数组合产生不同的缓存行为
      const fb1 = pool.get('hash1', 64, 64, 0, FilterMode.Linear, RenderTextureFormat.RGBA32);
      const fb2 = pool.get('hash2', 64, 64, 16, FilterMode.Linear, RenderTextureFormat.RGBA32);
      const fb3 = pool.get('hash3', 64, 64, 0, FilterMode.Nearest, RenderTextureFormat.RGBA32);
      const fb4 = pool.get('hash4', 64, 64, 0, FilterMode.Linear, RenderTextureFormat.RGBAHalf);

      // 所有framebuffer都应该是不同的实例
      expect(fb1).to.not.equal(fb2);
      expect(fb1).to.not.equal(fb3);
      expect(fb1).to.not.equal(fb4);
      expect(fb2).to.not.equal(fb3);
      expect(fb2).to.not.equal(fb4);
      expect(fb3).to.not.equal(fb4);
    });

    it('should handle size variations correctly', () => {
      const fb1 = pool.get('size1', 64, 64);
      const fb2 = pool.get('size2', 64, 128); // 不同高度
      const fb3 = pool.get('size3', 128, 64); // 不同宽度

      expect(fb1).to.not.equal(fb2);
      expect(fb1).to.not.equal(fb3);
      expect(fb2).to.not.equal(fb3);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid acquire/release cycles', () => {
      let lastFb;

      for (let i = 0; i < 10; i++) {
        const fb = pool.get(`cycle-${i}`, 128, 128);

        if (lastFb) {
          pool.release(lastFb);
        }
        lastFb = fb;
      }

      if (lastFb) {
        pool.release(lastFb);
      }
    });

    it('should reuse released RT in same frame', () => {
      const fb1 = pool.get('reuse-test', 64, 64);

      pool.release(fb1);

      // 在同一帧内获取相同参数的RT应该重用
      const fb2 = pool.get('reuse-test-2', 64, 64);

      expect(fb2).to.equal(fb1);
    });
  });
});
