import type { UniformValue } from './material';
import type { RenderingData } from './render';
import type { Disposable } from './utils';
import { isFunction } from './utils';

export type SemanticFunc = (state: RenderingData) => UniformValue | undefined;
export type SemanticGetter = UniformValue | SemanticFunc;

export class SemanticMap implements Disposable {
  public readonly semantics: Record<string, SemanticGetter>;

  constructor (semantics: Record<string, SemanticGetter> = {}) {
    this.semantics = { ...semantics };
  }

  toObject (): Record<string, SemanticGetter> {
    return { ...this.semantics };
  }

  setSemantic (name: string, value?: SemanticGetter) {
    if (value === undefined) {
      delete this.semantics[name];
    } else {
      this.semantics[name] = value;
    }
  }

  getSemanticValue (name: string, state: RenderingData) {
    const ret = this.semantics[name];

    if (isFunction(ret)) {
      return (ret as SemanticFunc)(state);
    }

    return ret;
  }

  hasSemanticValue (name: string): boolean {
    return name in this.semantics;
  }

  dispose () {
    Object.keys(this.semantics).forEach(name => {
      delete this.semantics[name];
    });
  }
}
