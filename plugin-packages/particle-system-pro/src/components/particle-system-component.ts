import { Component } from '@galacean/effects';
import { createStandardParticleLayout } from '../builtin/standard-variables';
import type { ProModule } from '../modules/module';
import { ProEmitterInstance } from '../simulation/emitter-instance';
import {
  deserializeProModule, serializeProModule,
} from '../simulation/module-serialization';
import { ProSystemInstance } from '../simulation/system-instance';
import type { ProParticleSystemComponentData } from '../types/component-data';

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

  /**
   * 把当前系统状态序列化为 JSON。仅写出可恢复的配置（modules + 关键属性），
   * 不包含运行时缓冲（粒子实例、IdTable、参数 store 等）。
   */
  override toData (): ProParticleSystemComponentData {
    const data: ProParticleSystemComponentData = { emitters: [] };

    for (const emitter of this.systemInstance.emitters) {
      const modules: NonNullable<ProParticleSystemComponentData['emitters']>[number]['modules'] = [];

      for (const module of emitter.modules) {
        const moduleData = serializeProModule(module);

        if (moduleData) {
          modules.push(moduleData);
        }
      }
      data.emitters!.push({ name: emitter.name, modules });
    }

    return data;
  }

  /**
   * 从 JSON 恢复系统状态：清空现有 emitters，按 data 重建并填入 modules。
   * 反序列化失败的 module（typeId 未注册）被跳过并 warn。
   */
  override fromData (data: ProParticleSystemComponentData): void {
    super.fromData(data as Parameters<Component['fromData']>[0]);
    if (!data.emitters) {
      return;
    }

    // 清空现有 emitters；保持引用稳定性的代价：粒子状态会丢失
    const existing = [...this.systemInstance.emitters];

    for (const e of existing) {
      this.systemInstance.removeEmitter(e);
    }
    this.defaultEmitter = null;

    for (const emitterData of data.emitters) {
      const emitter = this.addEmitter();

      if (emitterData.name) {
        emitter.name = emitterData.name;
      }
      for (const moduleData of emitterData.modules) {
        const module = deserializeProModule(moduleData);

        if (module) {
          emitter.addModule(module);
        }
      }
    }
    this.defaultEmitter = this.systemInstance.emitters[0] ?? null;
  }
}
