import type { Material } from '@galacean/effects';
import { SerializationHelper, Texture, spec } from '@galacean/effects';
import { ImGui } from '../../../platform/imgui/index';
import { propertyLabel } from '../../../ui/property-editor/default-object-details';
import { PropertyFields as Fields } from '../../../ui/property-editor/property-fields';
import { toolbarButton } from '../../../ui/widgets/toolbar-button';
import { sceneWorkspace } from '../../scene/scene-workspace';
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

export function drawMaterialProperties (material: Material, skipColor = false): void {
  const contentAsset = assetLibrary.entry(material.getInstanceId());

  if (contentAsset?.kind === 'material') {
    Fields.Property('Source Asset', () => {
      if (toolbarButton('##EditMaterialAsset', { icon: 'materialAsset', label: 'Edit Material', height: 24, hint: 'Edit and save the shared material resource' })) { openContentAsset(contentAsset.id); }
    });
  }
  ImGui.BeginDisabled(contentAsset?.kind === 'material');
  const data = material.toData();
  const renderTypes = [spec.RenderType.Opaque, spec.RenderType.Transparent];
  const renderFaces = [spec.RenderFace.Front, spec.RenderFace.Back, spec.RenderFace.Both];
  let changed = false;

  data.stringTags ??= {};
  changed = Fields.ComboField('Surface Type', next => {
    if (next !== undefined) { data.stringTags.RenderType = renderTypes[next]; }

    return Math.max(0, renderTypes.indexOf((data.stringTags.RenderType ?? spec.RenderType.Transparent) as spec.RenderType));
  }, ['Opaque', 'Transparent']) || changed;
  changed = Fields.ComboField('Render Face', next => {
    if (next !== undefined) { data.stringTags.RenderFace = renderFaces[next]; }

    return Math.max(0, renderFaces.indexOf((data.stringTags.RenderFace ?? spec.RenderFace.Both) as spec.RenderFace));
  }, ['Front', 'Back', 'Both']) || changed;
  for (const property of materialProperties(material.shader?.shaderData.properties, data)) {
    const { name, label, type } = property;

    if (skipColor && name === '_Color') { continue; }
    ImGui.PushID(name);
    if (type === 'Float') {
      let number = data.floats[name] ?? (Number(property.fallback) || 0);
      const edited = property.toggle ? Fields.Property(label, () => ImGui.Checkbox('##Toggle', next => {
        if (next !== undefined) { number = next ? 1 : 0; }

        return number !== 0;
      })) : property.range ? Fields.Property(label, width => {
        ImGui.SetNextItemWidth(width);

        return ImGui.SliderFloat('##Range', next => {
          if (next !== undefined) { number = next; }

          return number;
        }, property.range![0], property.range![1], '%.3f');
      }) : Fields.NumberField(label, next => {
        if (next !== undefined) { number = next; }

        return number;
      });

      if (edited) { data.floats[name] = number; changed = true; }
    } else if (type === 'Color') {
      const color = data.colors[name] ?? { r: 1, g: 1, b: 1, a: 1 };

      if (Fields.ColorField(label, color)) { data.colors[name] = color; changed = true; }
    } else if (type === 'Vector') {
      const vector = data.vector4s[name] ?? { x: 1, y: 1, z: 0, w: 0 };

      if (Fields.Property(label, width => {
        ImGui.SetNextItemWidth(width);

        return ImGui.DragFloat4('##Vector', vector, 0.02);
      })) { data.vector4s[name] = vector; changed = true; }
    } else if (type === '2D') {
      let assigned: Texture | null | undefined;
      const reference = {
        get texture () { return assigned ?? material.getTexture(name); },
        set texture (texture: Texture | null) { assigned = texture; },
      };

      if (Fields.ObjectField(label, reference, 'texture', Texture.name, false, undefined, texture => {
        if (!material.isRegistered) { return; }
        sceneWorkspace.observe('Assign texture', () => {
          const latest = material.toData();

          latest.textures[name] = { ...latest.textures[name], texture: texture as unknown as spec.DataPath };
          SerializationHelper.deserialize(latest, material);
        }, [material]);
      }) && reference.texture) {
        data.textures[name] = { ...data.textures[name], texture: reference.texture as unknown as spec.DataPath }; changed = true;
      }
    }
    ImGui.PopID();
  }
  if (changed) {
    SerializationHelper.deserialize(data, material);
  }
  ImGui.EndDisabled();
}
