/* eslint-disable no-console */
import '@galacean/effects-plugin-performance-monitor';
import '@galacean/effects-plugin-ktx2';
import type { GLEngine } from '@galacean/effects';
import { Player } from '@galacean/effects';

// 切换不同的监控模式
// eslint-disable-next-line prefer-const
let MONITOR_MODE = 1;
// 1 - 基础使用（带 UI）
// 2 - 自定义配置
// 3 - 无 UI 版本（仅数据）
// 4 - 事件监听模式
// 5 - 按需动态加载（按 F12 启用）
// 6 - 性能测试场景
// 7 - 内存泄漏检测
// 8 - 获取对象详情

// ============================================
// 场景配置
// ============================================
const json1 = 'https://mdn.alipayobjects.com/mars/afts/file/A*XrAAQIqk8bIAAAAAQFAAAAgAelB4AQ';
const json2 = 'https://mdn.alipayobjects.com/mars/afts/file/A*e4ovTLKXULoAAAAAQ1AAAAgAelB4AQ';
const container = document.getElementById('J-container');

// ============================================
// 主函数
// ============================================
(async () => {
  const player = new Player({ container });
  const engine = player.engine as GLEngine;

  switch (MONITOR_MODE) {
    // ========================================
    // 模式 1：基础使用（带 UI）
    // ========================================
    case 1: {
      const { startMonitoringWithUI } = await import(
        '@galacean/effects-plugin-performance-monitor'
      );

      startMonitoringWithUI(engine.gl);

      await player.loadScene(json2, { useCompressedTexture: true });

      break;
    }
    // ========================================
    // 模式 2：自定义配置
    // ========================================
    case 2: {
      const { startMonitoringWithUI } = await import(
        '@galacean/effects-plugin-performance-monitor'
      );

      startMonitoringWithUI(engine.gl, {
        logInterval: 2000,
        enableConsole: true,
        panelConfig: {
          position: 'top-left',
          theme: 'dark',
          updateRate: 1000,
          minimized: false,
        },
      });

      await player.loadScene(json2, { useCompressedTexture: true });

      break;
    }
    // ========================================
    // 模式 3：无 UI 版本（仅数据监控）
    // ========================================
    case 3: {
      const { startMonitoring } = await import(
        '@galacean/effects-plugin-performance-monitor'
      );

      const tracker = startMonitoring(engine.gl, {
        logInterval: 0,
        enableConsole: false,
      });

      await player.loadScene(json2, { useCompressedTexture: true });

      const snapshot = tracker.getSnapshot();

      if (snapshot) {
        console.log('=== 内存快照 ===');
        console.log('纹理内存:', (snapshot.memory.textureMemory / (1024 * 1024)).toFixed(2), 'MB');
        console.log('缓冲区内存:', (snapshot.memory.bufferMemory / (1024 * 1024)).toFixed(2), 'MB');
        console.log('Renderbuffer 内存:', (snapshot.memory.renderbufferMemory / (1024 * 1024)).toFixed(2), 'MB');
        console.log('帧缓冲内存:', (snapshot.memory.framebufferMemory / (1024 * 1024)).toFixed(2), 'MB');
        console.log('总内存:', (snapshot.memory.totalMemory / (1024 * 1024)).toFixed(2), 'MB');

        console.log('\n=== 资源统计 ===');
        console.log('纹理数量:', snapshot.resources.textureCount);
        console.log('缓冲区数量:', snapshot.resources.bufferCount);
        console.log('Renderbuffer 数量:', snapshot.resources.renderbufferCount);
        console.log('Shader 数量:', snapshot.resources.shaderCount);
        console.log('Program 数量:', snapshot.resources.programCount);
        console.log('Vertex Array 数量:', snapshot.resources.vertexArrayCount);
      }

      break;
    }
    // ========================================
    // 模式 4：事件监听模式
    // ========================================
    case 4: {
      const { startMonitoring } = await import(
        '@galacean/effects-plugin-performance-monitor'
      );

      const tracker = startMonitoring(engine.gl);

      tracker.on('memory-update', (data: { memory: { totalMemory: number, textureMemory: number, bufferMemory: number } }) => {
        const totalMB = data.memory.totalMemory / (1024 * 1024);

        console.log(`内存更新: ${totalMB.toFixed(2)} MB`);

        if (data.memory.totalMemory > 500 * 1024 * 1024) {
          console.warn('警告：内存使用超过 500MB!');
          console.table({
            '纹理内存': `${(data.memory.textureMemory / (1024 * 1024)).toFixed(2)} MB`,
            '缓冲区内存': `${(data.memory.bufferMemory / (1024 * 1024)).toFixed(2)} MB`,
            '总内存': `${totalMB.toFixed(2)} MB`,
          });
        }
      });

      tracker.on('context-lost', (data: { timestamp: string | number | Date }) => {
        console.error('WebGL 上下文丢失', new Date(data.timestamp).toLocaleTimeString());
      });

      await player.loadScene(json2, { useCompressedTexture: true });

      break;
    }
    // ========================================
    // 模式 5：按需动态加载（按 F12 启用）
    // ========================================
    case 5: {
      await player.loadScene(json2, { useCompressedTexture: true });

      let monitorEnabled = false;

      document.addEventListener('keydown', async e => {
        if (e.key === 'F12' && !monitorEnabled) {
          const { startMonitoringWithUI } = await import(
            '@galacean/effects-plugin-performance-monitor'
          );

          startMonitoringWithUI(engine.gl, {
            enableConsole: true,
            panelConfig: {
              theme: 'dark',
              position: 'top-right',
            },
          });

          monitorEnabled = true;
        }
      });

      break;
    }
    // ========================================
    // 模式 6：性能测试场景
    // ========================================
    case 6: {
      const { startMonitoring } = await import(
        '@galacean/effects-plugin-performance-monitor'
      );

      const tracker = startMonitoring(engine.gl);

      const before = tracker.getSnapshot();

      if (before) {
        console.log('场景加载前:');
        console.log('  总内存:', (before.memory.totalMemory / (1024 * 1024)).toFixed(2), 'MB');
        console.log('  纹理数量:', before.resources.textureCount);
        console.log('  缓冲区数量:', before.resources.bufferCount);
      }

      console.log('\n正在加载场景...');
      const startTime = performance.now();

      await player.loadScene(json2, { useCompressedTexture: true });

      const loadTime = performance.now() - startTime;

      const after = tracker.getSnapshot();

      if (after && before) {
        console.log('\n场景加载完成');
        console.log('加载耗时:', loadTime.toFixed(2), 'ms');

        const memoryGrowth = after.memory.totalMemory - before.memory.totalMemory;

        console.log('\n内存分析:');
        console.table({
          '总内存': `${(after.memory.totalMemory / (1024 * 1024)).toFixed(2)} MB`,
          '纹理内存': `${(after.memory.textureMemory / (1024 * 1024)).toFixed(2)} MB`,
          '缓冲区内存': `${(after.memory.bufferMemory / (1024 * 1024)).toFixed(2)} MB`,
          'Renderbuffer': `${(after.memory.renderbufferMemory / (1024 * 1024)).toFixed(2)} MB`,
          '帧缓冲': `${(after.memory.framebufferMemory / (1024 * 1024)).toFixed(2)} MB`,
          '内存增长': `${(memoryGrowth / (1024 * 1024)).toFixed(2)} MB`,
        });

        console.log('\n资源统计:');
        console.table({
          '纹理数量': after.resources.textureCount,
          '缓冲区数量': after.resources.bufferCount,
          'Renderbuffer 数量': after.resources.renderbufferCount,
          'Shader 数量': after.resources.shaderCount,
          'Program 数量': after.resources.programCount,
          'Vertex Array 数量': after.resources.vertexArrayCount,
        });

        const totalMB = after.memory.totalMemory / (1024 * 1024);
        let rating = '优秀';

        if (totalMB > 500) {
          rating = '较差';
        } else if (totalMB > 300) {
          rating = '一般';
        } else if (totalMB > 150) {
          rating = '良好';
        }

        console.log(`性能评级: ${rating}`);
      }

      break;
    }
    // ========================================
    // 模式 7：内存泄漏检测
    // ========================================
    case 7: {
      const { startMonitoring } = await import(
        '@galacean/effects-plugin-performance-monitor'
      );

      const tracker = startMonitoring(engine.gl);

      let baselineMemory = 0;
      let checkCount = 0;

      tracker.on('memory-update', (data: { memory: { totalMemory: number, textureMemory: number, bufferMemory: number, renderbufferMemory: number, framebufferMemory: number } }) => {
        if (baselineMemory === 0) {
          baselineMemory = data.memory.totalMemory;
          console.log('基准内存:', (baselineMemory / (1024 * 1024)).toFixed(2), 'MB');

          return;
        }

        checkCount++;
        const growth = data.memory.totalMemory - baselineMemory;
        const growthMB = growth / (1024 * 1024);

        console.log(`检查 #${checkCount}: 内存增长 ${growthMB.toFixed(2)} MB`);

        if (growthMB > 100) {
          console.error('\n疑似内存泄漏');
          console.error(`基准内存: ${(baselineMemory / (1024 * 1024)).toFixed(2)} MB`);
          console.error(`当前内存: ${(data.memory.totalMemory / (1024 * 1024)).toFixed(2)} MB`);
          console.error(`增长量: ${growthMB.toFixed(2)} MB`);

          console.table({
            '纹理内存': `${(data.memory.textureMemory / (1024 * 1024)).toFixed(2)} MB`,
            '缓冲区内存': `${(data.memory.bufferMemory / (1024 * 1024)).toFixed(2)} MB`,
            'Renderbuffer': `${(data.memory.renderbufferMemory / (1024 * 1024)).toFixed(2)} MB`,
            '帧缓冲': `${(data.memory.framebufferMemory / (1024 * 1024)).toFixed(2)} MB`,
          });

          console.log('\n自动下载内存报告...');
          tracker.getUI()?.downloadData(`leak-report-${Date.now()}.json`);
        }
      });

      await player.loadScene(json2, { useCompressedTexture: true });

      break;
    }
    // ========================================
    // 模式 8：获取对象详情
    // ========================================
    case 8: {
      await import('@galacean/effects-plugin-performance-monitor');

      await player.loadScene(json2, { useCompressedTexture: true });

      // 获取扩展
      const ext = engine.gl.getExtension('GALACEAN_memory_monitor');

      if (ext) {
        // 获取快照
        const snapshot = ext.getSnapshot();

        console.log('\n=== 内存快照 ===');
        console.table({
          '纹理内存': `${(snapshot.memory.textureMemory / (1024 * 1024)).toFixed(2)} MB`,
          '缓冲区内存': `${(snapshot.memory.bufferMemory / (1024 * 1024)).toFixed(2)} MB`,
          '总内存': `${(snapshot.memory.totalMemory / (1024 * 1024)).toFixed(2)} MB`,
        });

        // 获取纹理详情
        const textureDetails = ext.getObjectDetails(WebGLTexture);

        console.log('\n=== 纹理对象详情 ===');
        console.log(`共 ${textureDetails.length} 个纹理对象:\n`);

        textureDetails.forEach((detail, index) => {
          console.log(`纹理 #${index + 1}:`);
          console.log(`  大小: ${(detail.memorySize / (1024 * 1024)).toFixed(2)} MB`);

          if (detail.mipLevels && detail.mipLevels[0] && detail.mipLevels[0][0]) {
            const mip0 = detail.mipLevels[0][0];

            console.log(`  尺寸: ${mip0.width}x${mip0.height}`);
            console.log(`  格式: 0x${mip0.format.toString(16).toUpperCase()}`);
            console.log(`  Mipmap 层数: ${detail.mipLevels.length}`);
          }

          if (detail.createdAt) {
            console.log(`  创建位置:\n${detail.createdAt.split('\n').slice(0, 3).join('\n')}`);
          }
          console.log('');
        });

        // 获取缓冲区详情
        const bufferDetails = ext.getObjectDetails(WebGLBuffer);

        console.log('\n=== 缓冲区对象详情 ===');
        console.log(`共 ${bufferDetails.length} 个缓冲区对象:\n`);

        bufferDetails.forEach((detail, index) => {
          console.log(`缓冲区 #${index + 1}:`);
          console.log(`  大小: ${(detail.memorySize / 1024).toFixed(2)} KB`);

          if (detail.createdAt) {
            console.log(`  创建位置:\n${detail.createdAt.split('\n').slice(0, 3).join('\n')}`);
          }
          console.log('');
        });

        // 获取 Renderbuffer 详情
        const renderbufferDetails = ext.getObjectDetails(WebGLRenderbuffer);

        console.log('\n=== Renderbuffer 对象详情 ===');
        console.log(`共 ${renderbufferDetails.length} 个 Renderbuffer 对象:\n`);

        renderbufferDetails.forEach((detail, index) => {
          console.log(`Renderbuffer #${index + 1}:`);
          console.log(`  大小: ${(detail.memorySize / (1024 * 1024)).toFixed(2)} MB`);

          if (detail.createdAt) {
            console.log(`  创建位置:\n${detail.createdAt.split('\n').slice(0, 3).join('\n')}`);
          }
          console.log('');
        });

        // 获取 Shader 详情
        const shaderDetails = ext.getObjectDetails(WebGLShader);

        console.log('\n=== Shader 对象详情 ===');
        console.log(`共 ${shaderDetails.length} 个 Shader 对象`);

        // 获取 Program 详情
        const programDetails = ext.getObjectDetails(WebGLProgram);

        console.log('\n=== Program 对象详情 ===');
        console.log(`共 ${programDetails.length} 个 Program 对象`);
      } else {
        console.error('无法获取监控扩展');
      }

      break;
    }
    // ========================================
    // 未知模式
    // ========================================
    default:
      console.error(`未知的监控模式: ${MONITOR_MODE}`);
      await player.loadScene(json2, { useCompressedTexture: true });

      break;
  }
})();