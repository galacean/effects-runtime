export class SceneInfo {
  name = '';
  loadCost = 0;
  createCost = 0;
  totalCost = 0;
  totalDiffCost = 0;

  setInfo (
    name: string,
    loadCost: number,
    createCost: number,
    baseLoadCost: number,
    baseCreateCost: number,
  ) {
    this.name = name;
    this.loadCost = loadCost;
    this.createCost = createCost;
    this.totalCost = loadCost + createCost;
    this.totalDiffCost = this.totalCost - baseLoadCost - baseCreateCost;
  }

  add (scene: SceneInfo) {
    this.loadCost += scene.loadCost;
    this.createCost += scene.createCost;
    this.totalCost += scene.totalCost;
    this.totalDiffCost += scene.totalDiffCost;
  }
}
