import { EffectsObject } from '../effects-object';

export class Asset<T> extends EffectsObject {
  data: T;
}
