import type { GLType } from '@galacean/effects';
import { PlayerCost } from './player-cost';

export class ComparatorStats {
  private oldCost: PlayerCost;
  private newCost: PlayerCost;

  constructor (
    private renderFramework: GLType,
  ) {
    this.oldCost = new PlayerCost();
    this.newCost = new PlayerCost();
  }

  addSceneInfo (
    name: string,
    oldLoadCost: number,
    oldCreateCost: number,
    newLoadCost: number,
    newCreateCost: number,
  ) {
    this.oldCost.add(name, oldLoadCost, oldCreateCost, oldLoadCost, oldCreateCost);
    this.newCost.add(name, newLoadCost, newCreateCost, oldLoadCost, oldCreateCost);
  }

  getStatsInfo () {
    const msgList = [];
    const oldAverLoadCost = this.oldCost.getAverLoadCost();
    const oldAverCreateCost = this.oldCost.getAverCreateCost();
    const oldAverTotalCost = oldAverLoadCost + oldAverCreateCost;
    const newAverLoadCost = this.newCost.getAverLoadCost();
    const newAverCreateCost = this.newCost.getAverCreateCost();
    const newAverTotalCost = newAverLoadCost + newAverCreateCost;
    const maxSceneList = this.newCost.getMaxDiffCostScenes(5);
    const oldCostInfo = `Old(${oldAverLoadCost.toFixed(2)}, ${oldAverCreateCost.toFixed(2)}, ${oldAverTotalCost.toFixed(2)})`;
    const newCostInfo = `New(${newAverLoadCost.toFixed(2)}, ${newAverCreateCost.toFixed(2)}, ${newAverTotalCost.toFixed(2)})`;

    msgList.push(`CostStats: ${this.renderFramework}, ${oldCostInfo}, ${newCostInfo}`);
    msgList.push('Top5Scene: ' + maxSceneList.map(scene => scene.name + `(${scene.totalDiffCost.toFixed(1)})`).join(', '));
    console.info(`[Test] ${msgList.join('\n')}`);

    return msgList.join('<br>');
  }
}
