import { EffectsObject } from './effects-object';

export class Asset extends EffectsObject {
}

export class DataAsset<T> extends Asset {
  data: T;
}
