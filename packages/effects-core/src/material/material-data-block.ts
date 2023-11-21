import type * as spec from '@galacean/effects-specification';
import type { MaterialDataBlockDestroyOptions, UniformValue } from './types';
import { Texture } from '../texture';
import type { Disposable } from '../utils';

export interface MaterialDataBlockProps {
  uniformValues?: Record<string, UniformValue>,
  name?: string,
  keepUboData?: boolean,
}

/**
 * 引擎接入暂时不需要实现
 */
export abstract class MaterialDataBlock implements Disposable {
  readonly name: string;
  protected destroyed = false;

  protected constructor (props: MaterialDataBlockProps) {
    const { name = 'defaultDataBlock' } = props;

    this.name = name;
  }

  setUniformValues (uniformValue: Record<string, UniformValue>): void {
    Object.keys(uniformValue).forEach(key => {
      this.setUniformValue(key, uniformValue[key]);
    });
  }

  invalidAllFlags () {
    // OVERRIDE
  }

  updateUniformSubData (name: string, start: number, count: number) {
    // OVERRIDE
  }

  abstract hasUniformValue (name: string): boolean;

  abstract getUniformValue (name: string): UniformValue | undefined;

  abstract getUniformValues (): Record<string, UniformValue>;

  abstract setUniformValue (name: string, value: UniformValue): void;

  abstract removeUniformValue (name: string): void;

  abstract dispose (options?: MaterialDataBlockDestroyOptions): void;

  static create: (props: MaterialDataBlockProps) => MaterialDataBlock;
}

export function isUniformStruct (value: UniformValue) {
  return typeof value === 'object' && value && (value as (number[] | String | Texture[] | number[][] | spec.TypedArray)).length === undefined && value instanceof Texture;
}

export function isUniformStructArray (value: UniformValue) {
  return value && (value as Array<number>).length !== undefined && isUniformStruct((value as Array<number>)[0]);
}
