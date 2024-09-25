import type { spec } from '@galacean/effects';
import { Player } from '@galacean/effects';
import { CameraGestureHandlerImp, CameraGestureType } from '@galacean/effects-plugin-model';

interface AudioCompositionOptions {
  duration: number,
  endBehavior: spec.EndBehavior,
}

const { expect } = chai;
const player = new Player({
  canvas: document.createElement('canvas'),
});

describe('audioComponent ', function () {

  it('audioComponent:create', async function () {
  });
});
