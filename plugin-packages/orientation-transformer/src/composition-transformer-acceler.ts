import type { Composition } from '@galacean/effects';

export interface CompositionTransformerTarget {
  name: string,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
}

type EventType = {
  x: number,
  y: number,
};

export class CompositionTransformerAcceler {
  private readonly targets: Record<string, CompositionTransformerTarget> = {};
  private readonly records: Record<string, { item: any, position: number[], current?: number[] }> = {};
  private readonly current: Record<string, number[]> = {};
  private gammaRange: [x: number, y: number] = [-89, 89];
  private betaRange: [x: number, y: number] = [-80, 80];
  private currentEvent?: EventType;

  constructor (
    private readonly composition: Composition,
  ) {
  }

  update ({ x, y }: EventType) {
    this.currentEvent = { x, y };
  }

  updateOrientation () {
    const event = this.currentEvent;

    if (event) {
      Object.getOwnPropertyNames(this.targets).forEach(name => {
        this.moveLayer(name, event);
      });
    }
  }

  initComposition () {
    const items = this.composition.items;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const target = this.targets[item.name];

      if (target) {
        const position = item.transform.position.toArray();
        const currentPosition = this.current[item.name];

        this.records[item.name] = {
          item,
          position,
        };
        if (currentPosition) {
          const [x, y, z] = currentPosition;

          item.transform.setPosition(x, y, z);
        }
      }
    }
  }

  addTarget (target: CompositionTransformerTarget) {
    this.targets[target.name] = target;
  }

  removeTarget (name: string) {
    delete this.targets[name];
    delete this.records[name];
  }

  private moveLayer (name: string, { x, y }: EventType) {
    const layer = this.records[name]?.item;

    if (layer) {
      const initPosition = this.records[name].position;
      const target = this.targets[name];
      const beta = clamp(x, this.betaRange), gamma = clamp(y, this.gammaRange);

      if (target) {
        const position = [
          initPosition[0] + 1.2 * mapRange((beta - this.gammaRange[0]) / (this.gammaRange[1] - this.gammaRange[0]), target.xMin, target.xMax),
          initPosition[1] + 1.2 * mapRange((gamma - this.betaRange[0]) / (this.betaRange[1] - this.betaRange[0]), target.yMin, target.yMax),
          initPosition[2],
        ];

        layer.transform.setPosition(...position);
        this.current[name] = position.slice();
      }
    }
  }
}

function clamp (x: number, range: [x: number, y: number]) {
  if (x < range[0]) {
    return range[0];
  } else if (x > range[1]) {
    return range[1];
  }

  return x;
}

function mapRange (t: number, min: number, max: number): number {
  return min + (max - min) * t;
}
