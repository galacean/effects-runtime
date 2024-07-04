import type { Composition, spec } from '@galacean/effects';
import type { AccelerMotionData } from './orientation-adapter-acceler';

export class CompositionTransformerAcceler {
  private readonly targets: Record<string, spec.PluginGyroscopeTarget> = {};
  private readonly records: Record<string, { item: any, position: number[], current?: number[], rotation: number[] }> = {};
  private readonly currentPos: Record<string, number[]> = {};
  private readonly currentRot: Record<string, number[]> = {};
  private gammaRange: [x: number, y: number] = [-89, 89];
  private betaRange: [x: number, y: number] = [-89, 89];
  private currentEvent?: AccelerMotionData;

  constructor (
    private readonly composition: Composition,
  ) {
  }

  update ({ x, y, beta, gamma }: AccelerMotionData) {
    this.currentEvent = { x, y, beta, gamma };
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
        const rotation = item.transform.rotation.toArray();

        const currentPosition = this.currentPos[item.name];
        const currentRot = this.currentRot[item.name];

        this.records[item.name] = {
          item,
          position,
          rotation,
        };
        if (currentPosition) {
          item.transform.setPosition(currentPosition[0], currentPosition[1], currentPosition[2]);
        }
        if (currentRot) {
          item.transform.setRotation(currentRot[0], currentRot[1], currentRot[2]);
        }

      }
    }
  }

  addTarget (target: spec.PluginGyroscopeTarget) {
    this.targets[target.name] = target;
  }

  removeTarget (name: string) {
    delete this.targets[name];
    delete this.records[name];
  }

  private moveLayer (name: string, { x, y, beta: b, gamma: g }: AccelerMotionData) {
    const layer = this.records[name]?.item;

    if (layer) {
      const initPosition = this.records[name].position;
      const initRotation = this.records[name].rotation;
      const target = this.targets[name];
      const beta = clamp(x, this.betaRange), gamma = clamp(y, this.gammaRange);

      if (target) {
        const position = [
          initPosition[0] + 1.2 * mapRange(normalize(beta, this.gammaRange[0], this.gammaRange[1]), target.xMin, target.xMax),
          initPosition[1] + 1.2 * mapRange(normalize(gamma, this.betaRange[0], this.betaRange[1]), target.yMin, target.yMax),
          initPosition[2],
        ];

        const br = normalize(clamp(g * 0.8, this.gammaRange), this.gammaRange[0], this.gammaRange[1]);
        const gr = normalize(clamp(b * 0.8, this.betaRange), this.betaRange[0], this.betaRange[1]);

        const rotation = [
          initRotation[0] + mapRange(gr, target.hMin, target.hMax),
          initRotation[1] + mapRange(br, target.vMin, target.vMax),
          initRotation[2],
        ];

        layer.transform.setPosition(...position);
        layer.transform.setRotation(...rotation);
        this.currentPos[name] = position.slice();
        this.currentRot[name] = rotation.slice();
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

function normalize (a: number, min: number, max: number) {
  return (a - min) / (max - min);
}
