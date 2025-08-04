import { GLTexture } from '@galacean/effects-webgl';
import type { FileNode } from '../core/file-node';
import { GalaceanEffects } from '../ge';
import { ImGui, ImGui_Impl } from '../imgui';

function access (object: any, property: string) {
  return (_ = object[property]) => {
    object[property] = _;

    return object[property];
  };
}

export class EditorGUILayout {
  static alignWidth = 300;

  static Label (label: string) {
    ImGui.Text('       ' + label);
    ImGui.SameLine(EditorGUILayout.alignWidth);
    ImGui.SetNextItemWidth(-1);
  }

  static TextField (label: string, object: object, property: string, guiID?: string) {
    EditorGUILayout.Label(label);

    return ImGui.InputText('##' + label + guiID, access(object, property), undefined, ImGui.InputTextFlags.EnterReturnsTrue);
  }

  static Text (label: string, text: string) {
    EditorGUILayout.Label(label);
    ImGui.Text(text);
  }

  static Checkbox (label: string, object: object, property: string, guiID?: string) {
    EditorGUILayout.Label(label);

    return ImGui.Checkbox('##' + label + guiID, access(object, property));
  }

  static Vector2Field (label: string, value: ImGui.XY | ImGui.Bind.ImTuple2<number>, guiID?: string) {
    EditorGUILayout.Label(label);

    return ImGui.DragFloat2('##' + label + guiID, value, 0.03);
  }

  static Vector3Field (label: string, value: ImGui.XYZ | ImGui.XYZW | ImGui.Bind.ImTuple3<number> | ImGui.Bind.ImTuple4<number>, guiID?: string) {
    EditorGUILayout.Label(label);

    return ImGui.DragFloat3('##' + label + guiID, value, 0.03);
  }

  static FloatField (label: string, object: object, property: string, guiID?: string) {
    EditorGUILayout.Label(label);

    return ImGui.DragFloat('##' + label + guiID, access(object, property), 0.03);
  }

  static ColorField (label: string, color: ImGui.RGBA | ImGui.Bind.ImTuple4<number> | ImGui.Bind.interface_ImVec4, guiID?: string) {
    EditorGUILayout.Label(label);

    return ImGui.ColorEdit4('##' + label + guiID, color, ImGui.ImGuiColorEditFlags.Float | ImGui.ImGuiColorEditFlags.HDR);
  }

  static ObjectField (label: string, object: object, property: string) {
    EditorGUILayout.Label(label);

    const targetObject = (object as Record<string, any>)[property];

    if (!targetObject) {
      return;
    }

    if (targetObject instanceof GLTexture) {
      let __inspectorTexture = (targetObject as any).__imguiInspectorTexture as WebGLTexture;

      if (!__inspectorTexture && targetObject.defination.image) {
        __inspectorTexture = createTextureFromImage(ImGui_Impl.gl!, targetObject.defination.image);
        (targetObject as any).__imguiInspectorTexture = __inspectorTexture;
      }
      ImGui.ImageButton(__inspectorTexture, new ImGui.Vec2(100, 100));
    } else {
      ImGui.Button(targetObject.name ?? 'EffectsObject', new ImGui.Vec2(200, 0));
    }

    if (ImGui.BeginDragDropTarget()) {
      const payload = ImGui.AcceptDragDropPayload(targetObject.constructor.name);

      if (payload) {
        void (payload.Data as FileNode).getFile().then(async (file: File | undefined)=>{
          if (!file) {
            return;
          }
          const effectsPackage = await GalaceanEffects.assetDataBase.loadPackageFile(file);

          if (!effectsPackage) {
            return;
          }
          (object as Record<string, any>)[property] = effectsPackage.exportObjects[0];
        });
      }

      ImGui.EndDragDropTarget();
    }
  }
}

export function createTextureFromImage (
  gl: WebGLRenderingContext,
  image: HTMLImageElement
): WebGLTexture {
  const texture = gl.createTexture()!;

  gl.bindTexture(gl.TEXTURE_2D, texture);

  // 上传图片数据到纹理
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  // 设置纹理参数
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}