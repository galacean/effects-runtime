import { Component } from '@galacean/effects';
import { createStandardParticleLayout } from '../builtin/standard-variables';
import type { ProModule } from '../modules/module';
import { ProEmitterInstance } from '../simulation/emitter-instance';
import { ProSystemInstance } from '../simulation/system-instance';

/**
 * 挂在 VFXItem 上的粒子系统逻辑组件。
 *
 * 持有 ProSystemInstance 并把组件生命周期映射到模拟器的 tick。
 * 提供便捷的默认初始化路径：自动建一个标准 layout 的 emitter，
 * 调用方只需 addModule 即可。
 */
export class ProParticleSystemComponent extends Component {
  systemInstance: ProSystemInstance = new ProSystemInstance();
  defaultEmitter: ProEmitterInstance | null = null;

  randomSeed = 0x12345678;

  /**
   * 创建一个挂上标准 Particle 变量布局的默认 emitter，添加到 systemInstance。
   *
   * 多次调用只会创建一次；之后返回已有 emitter。
   */
  ensureDefaultEmitter (): ProEmitterInstance {
    if (this.defaultEmitter) {
      return this.defaultEmitter;
    }
    const emitter = new ProEmitterInstance(this.systemInstance, this.randomSeed);

    emitter.initParticleDataSet(createStandardParticleLayout());
    this.systemInstance.addEmitter(emitter);
    this.defaultEmitter = emitter;

    return emitter;
  }

  addEmitter (): ProEmitterInstance {
    const emitter = new ProEmitterInstance(this.systemInstance, this.randomSeed + this.systemInstance.emitters.length);

    emitter.initParticleDataSet(createStandardParticleLayout());
    this.systemInstance.addEmitter(emitter);

    return emitter;
  }

  removeEmitter (emitter: ProEmitterInstance): void {
    this.systemInstance.removeEmitter(emitter);
    if (this.defaultEmitter === emitter) {
      this.defaultEmitter = this.systemInstance.emitters[0] ?? null;
    }
  }

  addModule (module: ProModule): void {
    this.ensureDefaultEmitter().addModule(module);
  }

  override onUpdate (dt: number): void {
    // 在 tick 之前把当前世界矩阵推给每个 emitter，World space 模式 spawn 烘焙用
    const wm = this.transform?.getWorldMatrix();

    if (wm) {
      for (const emitter of this.systemInstance.emitters) {
        emitter.worldMatrix.copyFrom(wm);
      }
    }
    this.systemInstance.tick(dt / 1000);
  }

  override onDestroy (): void {
    this.systemInstance.dispose();
    this.defaultEmitter = null;
  }
}
