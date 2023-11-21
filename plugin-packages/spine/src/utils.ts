import type { Material } from '@galacean/effects';
import { assertExist, glContext } from '@galacean/effects';
import type { SkeletonData, MixBlend } from './core';
import {
  AtlasAttachmentLoader, BinaryInput,
  BlendMode,
  SkeletonBinary,
  SkeletonJson,
  TextureAtlas,
  TextureFilter,
  TextureWrap,
} from './core';

/**
 * 颜色相关方法
 **/
export class Color {
  constructor (
    public r: number = 0,
    public g: number = 0,
    public b: number = 0,
    public a: number = 0,
  ) { }

  set (r: number, g: number, b: number, a: number) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;

    return this.clamp();
  }

  toString () {
    return `r: ${this.r}, g: ${this.g}, b: ${this.b}, a: ${this.a}`;
  }

  setFromColor (c: Color) {
    this.r = c.r;
    this.g = c.g;
    this.b = c.b;
    this.a = c.a;

    return this;
  }

  setFromString (hex: string) {
    hex = hex.charAt(0) == '#' ? hex.substr(1) : hex;
    this.r = parseInt(hex.substr(0, 2), 16) / 255;
    this.g = parseInt(hex.substr(2, 2), 16) / 255;
    this.b = parseInt(hex.substr(4, 2), 16) / 255;
    this.a = hex.length != 8 ? 1 : parseInt(hex.substr(6, 2), 16) / 255;

    return this;
  }

  add (r: number, g: number, b: number, a: number) {
    this.r += r;
    this.g += g;
    this.b += b;
    this.a += a;

    return this.clamp();
  }

  clamp () {
    if (this.r < 0) { this.r = 0; } else if (this.r > 1) { this.r = 1; }

    if (this.g < 0) { this.g = 0; } else if (this.g > 1) { this.g = 1; }

    if (this.b < 0) { this.b = 0; } else if (this.b > 1) { this.b = 1; }

    if (this.a < 0) { this.a = 0; } else if (this.a > 1) { this.a = 1; }

    return this;
  }

  static rgba8888ToColor (color: Color, value: number) {
    color.r = ((value & 0xff000000) >>> 24) / 255;
    color.g = ((value & 0x00ff0000) >>> 16) / 255;
    color.b = ((value & 0x0000ff00) >>> 8) / 255;
    color.a = ((value & 0x000000ff)) / 255;
  }

  static rgb888ToColor (color: Color, value: number) {
    color.r = ((value & 0x00ff0000) >>> 16) / 255;
    color.g = ((value & 0x0000ff00) >>> 8) / 255;
    color.b = ((value & 0x000000ff)) / 255;
  }

  static fromString (hex: string): Color {
    return new Color().setFromString(hex);
  }

}

export function setBlending (material: Material, mode: BlendMode, pma: boolean) {
  material.blendEquation = [glContext.FUNC_ADD, glContext.FUNC_ADD];
  switch (mode) {
    case BlendMode.Multiply:
      material.blendFunction = [glContext.DST_COLOR, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA];

      break;
    case BlendMode.Screen:
      material.blendFunction = [glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE_MINUS_SRC_COLOR, glContext.ONE_MINUS_SRC_ALPHA];

      break;
    case BlendMode.Additive:
      material.blendFunction = [pma ? glContext.ONE : glContext.SRC_ALPHA, glContext.ONE, glContext.ONE, glContext.ONE];

      break;
    case BlendMode.Normal:
      material.blendFunction = [pma ? glContext.ONE : glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];

      break;
    default:
      throw new Error(`Unknown blend mode: ${mode}`);
  }
}

/**
 * 获取骨骼数据
 * @param atlas - 纹理图集文件 `.atlas` 结尾
 * @param skeletonFile - 描述文件 `.skel` 或者 `.json` 结尾
 * @param skeletonType - 'skel' | 'json'
 * @returns
 */
export function createSkeletonData (atlas: TextureAtlas, skeletonFile: any, skeletonType: any): SkeletonData {
  const atlasLoader = new AtlasAttachmentLoader(atlas);
  const skeletonLoader = skeletonType === 'skel' ? new SkeletonBinary(atlasLoader) : new SkeletonJson(atlasLoader);

  return skeletonLoader.readSkeletonData(skeletonFile);
}

/**
 * 获取创建纹理需要的参数
 * @param atlasBuffer
 * @returns 包含 magFilter, minFilter, wrapS, wrapT 的对象
*/
export function getTextureOptions (atlasBuffer: ArrayBuffer) {
  const textDecoder = new TextDecoder('utf-8');
  const atlasText = textDecoder.decode(new Uint8Array(atlasBuffer, 0));
  const atlas = new TextureAtlas(atlasText);
  const images: string[] = [];
  const page = atlas.pages[0]; // 打包配置都一样

  for (const page of atlas.pages) {
    images.push(page.name);
  }
  const {
    magFilter = TextureFilter.Linear,
    minFilter = TextureFilter.Linear,
    uWrap = TextureWrap.ClampToEdge,
    vWrap = TextureWrap.ClampToEdge,
  } = page;

  return {
    images,
    pma: page.pma,
    magFilter,
    minFilter,
    wrapS: uWrap,
    wrapT: vWrap,
  };
}

/**
 * 获取皮肤列表
 * @param skeletonData
 * @returns 包含皮肤名称的数组
 */
export function getAnimationList (skeletonData: SkeletonData): string[] {
  return skeletonData.animations.map(animation => animation.name);
}

/**
 * 获取动画时长
 * @param skeletonData - 骨骼数据
 * @param animationName - 动画名称
 * @returns 指定动画的持续时间（单位 s）
 */
export function getAnimationDuration (skeletonData: SkeletonData, animationName: string) {
  const animation = skeletonData.findAnimation(animationName);

  assertExist(animation);

  return animation.duration;
}

/**
 * 获取动画列表
 * @param skeletonData - 骨骼数据
 * @returns 指定骨骼动画的动画名数组
 */
export function getSkinList (skeletonData: SkeletonData): string[] {
  return skeletonData.skins.map(skin => skin.name);
}

/**
 * 获取 spine 文件对应的编辑器版本
 */
export function getSpineVersion (skeleton: DataView) {
  const input = new BinaryInput(skeleton);

  input.readInt32();
  input.readInt32();

  return input.readString();
}

/**
 * String 相关
 */
export interface StringMap<T> {
  [key: string]: T,
}

export class StringSet {
  entries: StringMap<boolean> = {};
  size = 0;

  add (value: string): boolean {
    const contains = this.entries[value];

    this.entries[value] = true;
    if (!contains) {
      this.size++;

      return true;
    }

    return false;
  }

  addAll (values: string[]): boolean {
    const oldSize = this.size;

    for (let i = 0, n = values.length; i < n; i++) { this.add(values[i]); }

    return oldSize != this.size;
  }

  contains (value: string) {
    return this.entries[value];
  }

  clear () {
    this.entries = {};
    this.size = 0;
  }
}

/**
 * 数组相关
 */
export interface NumberArrayLike {
  readonly length: number,
  [n: number]: number,
}

export interface Disposable {
  dispose (): void,
}

export class ArrayUtils {
  static SUPPORTS_TYPED_ARRAYS = typeof (Float32Array) !== 'undefined';

  static arrayCopy<T> (source: ArrayLike<T>, sourceStart: number, dest: ArrayLike<T>, destStart: number, numElements: number) {
    for (let i = sourceStart, j = destStart; i < sourceStart + numElements; i++, j++) {
      // @ts-expect-error
      dest[j] = source[i];
    }
  }

  static arrayFill<T> (array: ArrayLike<T>, fromIndex: number, toIndex: number, value: T) {
    for (let i = fromIndex; i < toIndex; i++) {
      // @ts-expect-error
      array[i] = value;
    }
  }

  static setArraySize<T> (array: Array<T>, size: number, value: any = 0): Array<T> {
    const oldSize = array.length;

    if (oldSize == size) { return array; }
    array.length = size;
    if (oldSize < size) {
      for (let i = oldSize; i < size; i++) { array[i] = value; }
    }

    return array;
  }

  static ensureArrayCapacity<T> (array: Array<T>, size: number, value: any = 0): Array<T> {
    if (array.length >= size) { return array; }

    return ArrayUtils.setArraySize(array, size, value);
  }

  static newArray<T> (size: number, defaultValue: T): Array<T> {
    const array = new Array<T>(size);

    for (let i = 0; i < size; i++) { array[i] = defaultValue; }

    return array;
  }

  static newFloatArray (size: number): NumberArrayLike {
    if (ArrayUtils.SUPPORTS_TYPED_ARRAYS) { return new Float32Array(size); } else {
      const array = new Array<number>(size);

      for (let i = 0; i < array.length; i++) { array[i] = 0; }

      return array;
    }
  }

  static newShortArray (size: number): NumberArrayLike {
    if (ArrayUtils.SUPPORTS_TYPED_ARRAYS) { return new Int16Array(size); } else {
      const array = new Array<number>(size);

      for (let i = 0; i < array.length; i++) { array[i] = 0; }

      return array;
    }
  }

  static toFloatArray (array: Array<number>) {
    return ArrayUtils.SUPPORTS_TYPED_ARRAYS ? new Float32Array(array) : array;
  }

  static toSinglePrecision (value: number) {
    return ArrayUtils.SUPPORTS_TYPED_ARRAYS ? Math.fround(value) : value;
  }

  // This function is used to fix WebKit 602 specific issue described at http://esotericsoftware.com/forum/iOS-10-disappearing-graphics-10109
  static webkit602BugfixHelper (alpha: number, blend: MixBlend) {
  }

  static contains<T> (array: Array<T>, element: T, identity = true) {
    for (let i = 0; i < array.length; i++) { if (array[i] == element) { return true; } }

    return false;
  }

  static enumValue (type: any, name: string) {
    return type[name[0].toUpperCase() + name.slice(1)];
  }
}

export class Pool<T> {
  private items = new Array<T>();
  private instantiator: () => T;

  constructor (instantiator: () => T) {
    this.instantiator = instantiator;
  }

  obtain () {
    return this.items.length > 0 ? this.items.pop()! : this.instantiator();
  }

  free (item: T) {
    if ((item as any).reset) { (item as any).reset(); }
    this.items.push(item);
  }

  freeAll (items: ArrayLike<T>) {
    for (let i = 0; i < items.length; i++) { this.free(items[i]); }
  }

  clear () {
    this.items.length = 0;
  }
}
