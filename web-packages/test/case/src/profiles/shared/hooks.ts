import type { TestController } from '../../common/player/test-controller';

const { expect } = chai;

export function runRandomHitTest (controller: TestController, timeIndex: number) {
  const { oldPlayer, newPlayer } = controller;

  // @ts-expect-error
  Math.seedrandom(`hit-test${timeIndex}`);

  if (Math.random() < 0.75) {
    const count = Math.round(Math.random() * 8);

    for (let j = 0; j < count; j++) {
      const x = Math.random() * 2.0 - 1.0;
      const y = Math.random() * 2.0 - 1.0;
      const oldResult = oldPlayer.hitTest(x, y);
      const newResult = newPlayer.hitTest(x, y);

      expect(oldResult.length).to.eql(newResult.length);
    }

    return;
  }

  const hitPos = Math.random() < 0.5
    ? oldPlayer.getRandomPointInParticle()
    : newPlayer.getRandomPointInParticle();
  const oldResult = oldPlayer.hitTest(hitPos[0], hitPos[1]);
  const newResult = newPlayer.hitTest(hitPos[0], hitPos[1]);

  expect(oldResult.length).to.eql(newResult.length);
}
