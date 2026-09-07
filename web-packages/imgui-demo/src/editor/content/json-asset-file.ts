import type { Asset, spec } from '@galacean/effects';
import { EffectsObject, SerializationHelper } from '@galacean/effects';

export interface JsonAssetFile<TData extends Record<string, unknown> = Record<string, unknown>> {
  ID: string,
  TypeName: string,
  EngineBuild: number,
  Data: TData,
}

export function isJsonAssetFile (value: unknown): value is JsonAssetFile {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const file = value as Partial<JsonAssetFile>;

  return typeof file.ID === 'string'
    && typeof file.TypeName === 'string'
    && typeof file.EngineBuild === 'number'
    && !!file.Data
    && typeof file.Data === 'object';
}

export function createJsonAssetFile (
  data: spec.EffectsObjectData,
  engineBuild = 1,
): JsonAssetFile {
  const { id, dataType, ...assetData } = data;

  return {
    ID: id,
    TypeName: dataType,
    EngineBuild: engineBuild,
    Data: assetData,
  };
}

export function serializeJsonAsset (asset: Asset, typeName: string, engineBuild = 1): JsonAssetFile {
  const serialized = SerializationHelper.serialize(asset) as spec.EffectsObjectData;
  const { id: _id, dataType: _dataType, ...data } = serialized;

  return {
    ID: asset.getInstanceId(),
    TypeName: typeName,
    EngineBuild: engineBuild,
    Data: data as Record<string, unknown>,
  };
}

export function jsonAssetReplacer (_key: string, value: unknown): unknown {
  if (value instanceof EffectsObject) {
    return value.getInstanceId();
  }

  return value;
}

export function readFileAsText (file: File): Promise<string> {
  return file.text();
}

export function readFileAsDataUrl (file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error(`Failed to read '${file.name}' as a data URL.`));
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read '${file.name}'.`));
    reader.readAsDataURL(file);
  });
}
