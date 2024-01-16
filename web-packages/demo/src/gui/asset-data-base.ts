import type { EffectsObjectData, EffectsPackageData } from '@galacean/effects';
import json from '../assets/custom-material';

export class AssetDataBase {
  assetsData: Record<string, EffectsObjectData> = {};

  importAsset (path: string) {
    if (!this.isJsonPath(path)) {
      return;
    }
    fetch(path)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok.');
        }

        return response.text();
      })
      .then(data => {
        const packageData = JSON.parse(data) as EffectsPackageData;

        for (const effectsObjectData of packageData.exportObjects) {
          this.addData(effectsObjectData);
        }
      })
      .catch(error => {
        console.error('An error occurred:', error);
      });
  }

  addData (data: EffectsObjectData) {
    this.assetsData[data.id] = data;
  }

  isJsonPath (path: string) {
    return path.toLowerCase().endsWith('.json');
  }
}
export const assetDataBase = new AssetDataBase();

assetDataBase.importAsset('../src/assets/shaders/trail.shader.json');

assetDataBase.importAsset('../src/assets/geometries/duck.geo.json');
assetDataBase.importAsset('../src/assets/geometries/trail.geo.json');

assetDataBase.importAsset('../src/assets/materials/duck.mat.json');
assetDataBase.importAsset('../src/assets/materials/trail.mat.json');
assetDataBase.importAsset('../src/assets/materials/trail2.mat.json');
assetDataBase.importAsset('../src/assets/materials/trail3.mat.json');

for (const componentData of json.components) {
  assetDataBase.addData(componentData);
}