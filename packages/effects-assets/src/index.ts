export class Assets {
  constructor () {
    console.info('effects-assets');
  }
}

export * from './effects-package';

export { default as G_QUAD } from './assets/geometries/g-quad.json';
export { default as M_DUCK } from './assets/materials/m-duck.json';
export { default as M_TRAIL } from './assets/materials/m-trail.json';
export { default as S_TRAIL } from './assets/shaders/s-trail.json';