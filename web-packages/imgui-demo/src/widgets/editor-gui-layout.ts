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
  static alignWidth = 200;

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

  static Vector3Field (label: string, value: ImGui.XYZ | ImGui.XYZW | ImGui.Bind.ImTuple3<number> | ImGui.Bind.ImTuple4<number>, guiID?: string): boolean {
    const id = guiID ?? label;
    let changed = false;

    // 创建一个临时数组来存储值
    const tempValues = [
      (value as any).x ?? (value as any)[0],
      (value as any).y ?? (value as any)[1],
      (value as any).z ?? (value as any)[2],
    ];

    ImGui.PushID(id);

    // 使用统一的标签对齐系统
    EditorGUILayout.Label(label);

    // 计算可用宽度和间距
    const style = ImGui.GetStyle();
    const spacing = style.ItemInnerSpacing.x;
    const buttonSize = ImGui.GetFrameHeight(); // 使用框架高度确保对齐
    const buttonWidth = 5;
    const availableWidth = ImGui.GetContentRegionAvail().x;

    // 计算输入框宽度：总宽度 - 3个按钮宽度 - 5个间距（按钮和输入框之间的间距）
    const totalButtonWidth = buttonWidth * 3;
    const totalSpacing = spacing * 5; // 按钮前、按钮后、按钮前、按钮后、按钮前的间距
    const inputWidth = Math.max(0, (availableWidth - totalButtonWidth - totalSpacing) / 3);

    ImGui.BeginGroup();

    // 定义颜色常量
    const xColor = new ImGui.Vec4(0.8, 0.1, 0.15, 1.0);
    const xColorHover = new ImGui.Vec4(0.9, 0.2, 0.2, 1.0);
    const xColorBg = new ImGui.Vec4(0.8, 0.1, 0.15, 0.15);

    const yColor = new ImGui.Vec4(0.2, 0.7, 0.2, 1.0);
    const yColorHover = new ImGui.Vec4(0.3, 0.8, 0.3, 1.0);
    const yColorBg = new ImGui.Vec4(0.2, 0.7, 0.2, 0.15);

    const zColor = new ImGui.Vec4(0.1, 0.25, 0.8, 1.0);
    const zColorHover = new ImGui.Vec4(0.2, 0.35, 0.9, 1.0);
    const zColorBg = new ImGui.Vec4(0.1, 0.25, 0.8, 0.15);

    // X 坐标输入
    ImGui.PushStyleColor(ImGui.Col.Button, xColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, xColorHover);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, xColor);
    ImGui.Button('', new ImGui.Vec2(buttonWidth, buttonSize));
    ImGui.PopStyleColor(3);

    ImGui.SameLine(0, spacing);
    ImGui.SetNextItemWidth(inputWidth);
    // ImGui.PushStyleColor(ImGui.Col.FrameBg, xColorBg);
    if (ImGui.DragFloat('##X', access(tempValues, '0'), 0.01, 0, 0, '%.3f')) {
      changed = true;
    }
    // ImGui.PopStyleColor();

    // Y 坐标输入
    ImGui.SameLine(0, spacing);
    ImGui.PushStyleColor(ImGui.Col.Button, yColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, yColorHover);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, yColor);
    ImGui.Button('', new ImGui.Vec2(buttonWidth, buttonSize));
    ImGui.PopStyleColor(3);

    ImGui.SameLine(0, spacing);
    ImGui.SetNextItemWidth(inputWidth);
    // ImGui.PushStyleColor(ImGui.Col.FrameBg, yColorBg);
    if (ImGui.DragFloat('##Y', access(tempValues, '1'), 0.01, 0, 0, '%.3f')) {
      changed = true;
    }
    // ImGui.PopStyleColor();

    // Z 坐标输入
    ImGui.SameLine(0, spacing);
    ImGui.PushStyleColor(ImGui.Col.Button, zColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, zColorHover);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, zColor);
    ImGui.Button('', new ImGui.Vec2(buttonWidth, buttonSize));
    ImGui.PopStyleColor(3);

    ImGui.SameLine(0, spacing);
    ImGui.SetNextItemWidth(inputWidth);
    // ImGui.PushStyleColor(ImGui.Col.FrameBg, zColorBg);
    if (ImGui.DragFloat('##Z', access(tempValues, '2'), 0.01, 0, 0, '%.3f')) {
      changed = true;
    }
    // ImGui.PopStyleColor();

    ImGui.EndGroup();
    ImGui.PopID();

    // 如果值改变，更新原始值
    if (changed) {
      if ('x' in value) {
        value.x = tempValues[0];
        value.y = tempValues[1];
        value.z = tempValues[2];
      } else {
        (value as any)[0] = tempValues[0];
        (value as any)[1] = tempValues[1];
        (value as any)[2] = tempValues[2];
      }
    }

    return changed;
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
        __inspectorTexture = createImguiTextureFromImage(targetObject.defination.image);
        (targetObject as any).__imguiInspectorTexture = __inspectorTexture;
      }
      ImGui.ImageButton(__inspectorTexture, new ImGui.Vec2(100, 100));
    } else {
      ImGui.Button(targetObject.name ?? 'EffectsObject', new ImGui.Vec2(-1, 0));
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

export function createImguiTextureFromImage (
  image: HTMLImageElement
): WebGLTexture {
  const gl = ImGui_Impl.gl!;
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