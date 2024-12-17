import { SceneInfo } from './scene-info';

export class PlayerCost {
  sceneList: SceneInfo[] = [];
  accumScene: SceneInfo;

  constructor () {
    this.accumScene = new SceneInfo();
  }

  add (
    name: string,
    loadCost: number,
    createCost: number,
    baseLoadCost: number,
    baseCreateCost: number,
  ) {
    const scene = new SceneInfo();

    scene.setInfo(name, loadCost, createCost, baseLoadCost, baseCreateCost);
    this.sceneList.push(scene);
    this.accumScene.add(scene);
  }

  getTotalSceneCount () {
    return this.sceneList.length;
  }

  getAverLoadCost () {
    return this.accumScene.loadCost / this.getTotalSceneCount();
  }

  getAverCreateCost () {
    return this.accumScene.createCost / this.getTotalSceneCount();
  }

  getMaxDiffCostScenes (count: number) {
    this.sceneList.sort((a, b) => b.totalDiffCost - a.totalDiffCost);
    const sceneList = [];

    for (let i = 0; i < count && i < this.sceneList.length; i++) {
      sceneList.push(this.sceneList[i]);
    }

    return sceneList;
  }
}
