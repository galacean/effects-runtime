import type { Texture2DSourceOptions } from './types';
import type { GPUCapability } from '../render/gpu-capability';

export interface TextureLoader {
  /**
   * 从 ArrayBuffer 加载纹理
   */
  loadFromBuffer(
    arrBuffer: ArrayBuffer,
    gpuCapability?: GPUCapability
  ): Promise<Texture2DSourceOptions>,

  /**
   * 从 URL 加载纹理
   */
  loadFromURL(
    url: string,
    gpuCapability?: GPUCapability
  ): Promise<Texture2DSourceOptions>,

  /**
   * 释放资源
   */
  dispose(): void,

}

/**
 * 纹理加载器工厂类型
 */
export type TextureLoaderFactory = () => TextureLoader;

/**
 * 纹理加载器注册表
 */
class TextureLoaderRegistry {
  private loaders: Map<string, TextureLoaderFactory> = new Map();
  private instances: Map<string, TextureLoader> = new Map();

  /**
   * 注册纹理加载器
   * @param type - 加载器类型（如 'ktx2', 'hdr'）
   * @param factory - 加载器工厂函数
   */
  register (type: string, factory: TextureLoaderFactory): void {
    if (this.loaders.has(type)) {
      console.warn(`TextureLoader for type "${type}" is already registered, overwriting.`);
    }
    this.loaders.set(type, factory);
  }

  /**
   * 注销纹理加载器
   * @param type - 加载器类型
   */
  unregister (type: string): void {
    const instance = this.instances.get(type);

    if (instance) {
      instance.dispose();
      this.instances.delete(type);
    }
    this.loaders.delete(type);
  }

  /**
   * 获取纹理加载器实例（单例）
   * @param type - 加载器类型
   */
  getLoader (type: string): TextureLoader | null {
    // 如果已有实例，直接返回
    if (this.instances.has(type)) {
      return this.instances.get(type)!;
    }

    // 创建新实例
    const factory = this.loaders.get(type);

    if (!factory) {
      console.error(`TextureLoader for type "${type}" is not registered.`);

      return null;
    }

    const instance = factory();

    this.instances.set(type, instance);

    return instance;
  }

  /**
   * 检查是否已注册某类型加载器
   */
  has (type: string): boolean {
    return this.loaders.has(type);
  }

  /**
   * 获取所有已注册的加载器类型
   */
  getRegisteredTypes (): string[] {
    return Array.from(this.loaders.keys());
  }

  /**
   * 清理所有加载器
   */
  dispose (): void {
    this.instances.forEach(instance => instance.dispose());
    this.instances.clear();
    this.loaders.clear();
  }
}

/**
 * 全局纹理加载器注册表实例
 */
export const textureLoaderRegistry = new TextureLoaderRegistry();
