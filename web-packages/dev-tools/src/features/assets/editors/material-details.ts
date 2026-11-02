import type { Material } from '@galacean/effects';
import { SerializationHelper, Texture, spec, math } from '@galacean/effects';
import { propertyLabel } from '../../../ui/property-editor/default-object-details';
import type { PropertyGroup } from '../../../ui/property-editor/property-sheet';
import { assetLibrary } from '../asset-library';
import { openContentAsset } from './asset-editor-registry';

export interface MaterialProperty {
  name: string,
  label: string,
  type: string,
  fallback?: string,
  toggle?: boolean,
  range?: [number, number],
}

export function materialProperties (source: string | undefined, data: { floats?: object, colors?: object, vector4s?: object, textures?: object }): MaterialProperty[] {
  if (source) {
    return source.split('\n').flatMap(line => {
      const match = line.match(/\s*(\s*\[[^\]]+\]\s*)*([^\s([\]]+)\s*\(\s*"(.+?)"\s*,\s*(.+?)\s*\)\s*=\s*(.+)\s*/);

      if (!match || line.includes('[HideInInspector]')) { return []; }
      const range = match[4].match(/\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);

      const label = match[2] === '_MainTex' && match[3].startsWith('_') ? 'Texture' : propertyLabel(match[3]);

      return [{ name: match[2], label, type: range ? 'Float' : match[4], fallback: match[5],
        toggle: line.includes('[Toggle]'), range: range ? [Number(range[1]), Number(range[2])] as [number, number] : undefined }];
    });
  }

  return [
    ...Object.keys(data.floats ?? {}).map(name => ({ name, type: 'Float' })),
    ...Object.keys(data.colors ?? {}).map(name => ({ name, type: 'Color' })),
    ...Object.keys(data.vector4s ?? {}).map(name => ({ name, type: 'Vector' })),
    ...Object.keys(data.textures ?? {}).map(name => ({ name, type: '2D' })),
  ].map(property => ({ ...property, label: propertyLabel(property.name.replace(/^_/, '')) }));
}

export function materialSearchTerms (material: Material, skipColor = false): string[] {
  return ['Surface Type', 'Render Face', material.name ?? '', ...materialProperties(material.shader?.shaderData.properties, material.toData())
    .filter(property => !skipColor || property.name !== '_Color').map(property => property.label)];
}

export function buildMaterialProperties (group: PropertyGroup, material: Material, skipColor = false): void {
  const contentAsset = assetLibrary.entry(material.getInstanceId());
  const options = { enabled: () => contentAsset?.kind !== 'material' };
  const mutate = (action: (data: spec.MaterialData) => void): void => {
    const data = material.toData();

    action(data); SerializationHelper.deserialize(data, material);
  };

  if (contentAsset?.kind === 'material') { group.button('Source Asset', 'Edit Material', () => { openContentAsset(contentAsset.id); }, 'materialAsset'); }
  const renderTypes = [spec.RenderType.Opaque, spec.RenderType.Transparent];
  const renderFaces = [spec.RenderFace.Front, spec.RenderFace.Back, spec.RenderFace.Both];

  group.choice('Surface Type', { read: () => Math.max(0, renderTypes.indexOf((material.stringTags.RenderType ?? spec.RenderType.Transparent) as spec.RenderType)),
    write: index => mutate(data => { data.stringTags ??= {}; data.stringTags.RenderType = renderTypes[index]; }) }, ['Opaque', 'Transparent'], options);
  group.choice('Render Face', { read: () => Math.max(0, renderFaces.indexOf((material.stringTags.RenderFace ?? spec.RenderFace.Both) as spec.RenderFace)),
    write: index => mutate(data => { data.stringTags ??= {}; data.stringTags.RenderFace = renderFaces[index]; }) }, ['Front', 'Back', 'Both'], options);
  for (const property of materialProperties(material.shader?.shaderData.properties, material.toData())) {
    const { name, label, type } = property;

    if (skipColor && name === '_Color') { continue; }
    if (type === 'Float') {
      const read = () => material.getFloat(name) ?? (Number(property.fallback) || 0);

      if (property.toggle) { group.boolean(label, { read: () => read() !== 0, write: value => mutate(data => { data.floats[name] = value ? 1 : 0; }) }, options); } else { group.number(label, { read, write: value => mutate(data => { data.floats[name] = value; }) }, { min: property.range?.[0], max: property.range?.[1] }, options); }
    } else if (type === 'Color') {
      group.color(label, { read: () => material.getColor(name)?.clone() ?? new math.Color(1, 1, 1, 1),
        write: color => mutate(data => { data.colors[name] = { r: color.r, g: color.g, b: color.b, a: color.a }; }) }, options);
    } else if (type === 'Vector') {
      group.vector(label, { read: () => material.getVector4(name)?.toArray() ?? [1, 1, 0, 0],
        write: values => mutate(data => { data.vector4s[name] = { x: values[0], y: values[1], z: values[2], w: values[3] }; }) }, 4, options);
    } else if (type === '2D') {
      group.reference(label, { read: () => material.getTexture(name), write: texture => {
        if (texture instanceof Texture) { mutate(data => { data.textures[name] = { ...data.textures[name], texture: texture as unknown as spec.DataPath }; }); } else if (!texture) { mutate(data => { delete data.textures[name]; }); }
      } }, 'Texture', !options.enabled());
    }
  }
}
