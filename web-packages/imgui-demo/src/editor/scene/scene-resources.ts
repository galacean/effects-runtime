import { binaryToBase64, EffectsPackage } from '@galacean/effects';
import type { Disposable, EffectsObject, spec, BinaryAsset } from '@galacean/effects';

/** Authored resource descriptors, independent of GPU upload objects and scene JSON. */
export class SceneResources {
  images: spec.ImageSource[] = [];
  bins: spec.BinaryFile[] = [];
  fonts?: spec.JSONScene['fonts'];
  videos?: spec.JSONScene['videos'];
  audios?: spec.JSONScene['audios'];
  plugins: string[] = [];
  readonly objects: EffectsObject[] = [];
  private readonly packages = new Map<number, string[]>();
  private readonly binarySources = new Map<BinaryAsset, Uint8Array>();

  bindPackage (index: number, bytes: ArrayBuffer): void {
    const assetPackage = new EffectsPackage();

    assetPackage.deserializeFromBinary(new Uint8Array(bytes));
    this.packages.set(index, assetPackage.exportObjectDatas.map(record => record.id));
  }

  /** Write each packaged asset once, using its current serialized object data. */
  writePackages (data: spec.JSONScene): void {
    for (const [index, ids] of this.packages) {
      const assetPackage = new EffectsPackage();

      for (const id of ids) {
        const record = data.geometries?.find(entry => entry.id === id);

        if (!record) {throw new Error(`Missing package asset '${id}'.`);}
        assetPackage.addData(record);
      }
      data.bins![index].url = `data:application/octet-stream;base64,${binaryToBase64(assetPackage.serializeToBinary())}`;
      const packaged = new Set(ids);

      data.geometries = data.geometries?.filter(record => !packaged.has(record.id));
    }
  }

  bindBinary (asset: BinaryAsset): void {
    this.objects.push(asset);
    this.binarySources.set(asset, new Uint8Array(asset.buffer.slice(0)));
  }
  readonly disposables: Disposable[] = [];

  fromData (data: spec.JSONScene, baseURL: string): void {
    this.images = structuredClone(data.images ?? []);
    this.bins = structuredClone(data.bins ?? []);
    this.fonts = structuredClone(data.fonts);
    this.videos = structuredClone(data.videos);
    this.audios = structuredClone(data.audios);
    this.plugins = [...(data.plugins ?? [])];
    for (const image of this.images as spec.CompressedImage[]) {
      for (const key of ['url', 'webp', 'avif', 'ktx2'] as const) {
        const url = image[key];

        if (url) {image[key] = new URL(url, baseURL).href;}
      }
    }
    for (const file of [...this.bins, ...(this.videos ?? []), ...(this.audios ?? [])]) {
      file.url = new URL(file.url, baseURL).href;
    }
    for (const video of this.videos ?? []) {
      if (video.hevc) {video.hevc.url = new URL(video.hevc.url, baseURL).href;}
    }
    for (const font of this.fonts ?? []) {
      if ('fontURL' in font && font.fontURL) {font.fontURL = new URL(font.fontURL, baseURL).href;}
    }
  }

  toData (): Pick<spec.JSONScene, 'images' | 'bins' | 'fonts' | 'videos' | 'audios' | 'plugins'> {
    const bins = structuredClone(this.bins);

    for (const [asset, original] of this.binarySources) {
      const bytes = new Uint8Array(asset.buffer);

      if (bytes.length === original.length && bytes.every((value, index) => value === original[index])) {continue;}
      const file = bins.find(entry => entry.id === asset.getInstanceId());

      if (!file) {throw new Error(`Missing binary resource descriptor for ${asset.getInstanceId()}.`);}
      file.url = `data:application/octet-stream;base64,${binaryToBase64(bytes)}`;
    }

    return structuredClone({ images: this.images, bins, fonts: this.fonts,
      videos: this.videos, audios: this.audios, plugins: this.plugins });
  }

  dispose (): void {
    for (const object of this.objects) {
      object.dispose();
      delete object.engine.jsonSceneData[object.getInstanceId()];
    }
    this.objects.length = 0;
    this.binarySources.clear();
    this.packages.clear();
    for (const disposable of this.disposables) {disposable.dispose();}
    this.disposables.length = 0;
  }
}
