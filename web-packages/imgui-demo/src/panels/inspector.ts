import type { LayoutPreset, Material, RectTransform, Texture } from '@galacean/effects';
import { Control, EffectsObject, RendererComponent, SerializationHelper, VFXItem, math, spec } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import { UIManager } from '../core/ui-manager';
import { ImGui, ImGui_Impl } from '../imgui';
import { EditorGUILayout, createImguiTextureFromImage } from '../widgets/editor-gui-layout';
import { EditorWindow } from './editor-window';
import { Editor } from '../custom-editors/editor';
import { GLTexture } from '@galacean/effects-webgl';
import type { FileNode } from '../core/file-node';
import { GalaceanEffects } from '../ge';

@editorWindow()
export class Inspector extends EditorWindow {

  private locked: boolean;
  private lockedObject: object;

  private defaultComponentEditor = new Editor();

  @menuItem('Window/Inspector')
  static showWindow () {
    EditorWindow.getWindow(Inspector).open();
  }

  constructor () {
    super();
    this.title = 'Inspector';
    this.open();
  }

  protected override onGUI (): void {
    const selectedObject = Selection.getSelectedObjects()[0];

    if (!selectedObject) {
      return;
    }
    let activeObject = selectedObject;

    if (this.locked) {
      activeObject = this.lockedObject;
    }

    if (activeObject instanceof VFXItem) {
      this.drawObjectTitle('VFXItem');
      this.drawVFXItemInspector(activeObject);
    } else {
      this.drawObject(activeObject);
    }
  }

  private drawObject (object: object) {
    for (const propertyName of Object.keys(object)) {
      const key = propertyName as keyof object;
      const property = object[key] as any;

      if (property === undefined || property === null) {
        continue;
      }

      if (typeof property === 'number') {
        EditorGUILayout.FloatField(propertyName, object, key);
      } else if (typeof property === 'boolean') {
        EditorGUILayout.Checkbox(propertyName, object, key);
      } else if (typeof property === 'string') {
        EditorGUILayout.TextField(propertyName, object, key);
      } else if (property instanceof math.Vector3) {
        EditorGUILayout.Vector3Field(propertyName, property);
      } else if (property instanceof math.Vector2) {
        EditorGUILayout.Vector2Field(propertyName, property);
      } else if (property instanceof math.Color) {
        EditorGUILayout.ColorField(propertyName, property);
      } else if (property instanceof EffectsObject) {
        EditorGUILayout.ObjectField(propertyName, object, key);
      } else if (property instanceof Object) {
        if (ImGui.TreeNode(propertyName + '##' + propertyName)) {
          this.drawObject(property);
          ImGui.TreePop();
        }
      }
    }
  }

  private drawObjectTitle (title: string) {
    ImGui.Text(title);
    // draw Lock check box
    const rightOffset = ImGui.GetWindowWidth() - 85 - ImGui.GetStyle().ItemSpacing.x;

    ImGui.SameLine(rightOffset);
    ImGui.Text('Lock');
    ImGui.SameLine();
    if (ImGui.Checkbox('##Lock', (value = this.locked)=>this.locked = value)) {
      const selectedObject = Selection.getSelectedObjects()[0];

      if (selectedObject) {
        this.lockedObject = selectedObject;
      }
    }
    ImGui.Separator();
  }

  private drawVFXItemInspector (activeObject: VFXItem) {
    EditorGUILayout.TextField('Name', activeObject, 'name');
    EditorGUILayout.TextField('GUID', activeObject, 'guid');

    EditorGUILayout.Label('Is Active');
    ImGui.Checkbox('##IsActive', (_ = activeObject.isActive) => {
      activeObject.setActive(_);

      return activeObject.isActive;
    });

    EditorGUILayout.FloatField('Duration', activeObject, 'duration');
    EditorGUILayout.FloatField('Time', activeObject, 'time');
    EditorGUILayout.Text('End Behavior', this.endBehaviorToString(activeObject.endBehavior));

    if (ImGui.CollapsingHeader(('Transform'), ImGui.TreeNodeFlags.DefaultOpen)) {
      const transform = activeObject.transform;

      EditorGUILayout.Vector3Field('Position', transform.position);
      EditorGUILayout.Vector3Field('Rotation', transform.rotation);
      EditorGUILayout.Vector3Field('Scale', transform.scale);
      EditorGUILayout.Vector2Field('Size', transform.size);

      transform.quat.setFromEuler(transform.rotation);
      transform.quat.conjugate();
      //@ts-expect-error
      transform.dirtyFlags.localData = true;
      //@ts-expect-error
      transform.dispatchValueChange();
    }

    // 仅当 VFXItem 挂了 Control 组件才显示锚点布局编辑区
    const controlComp = activeObject.getComponent(Control);

    if (controlComp && ImGui.CollapsingHeader('Layout', ImGui.TreeNodeFlags.DefaultOpen)) {
      this.drawLayoutInspector(controlComp);
    }

    for (const componet of activeObject.components) {
      const customEditor = UIManager.customEditors.get(componet.constructor);

      if (ImGui.CollapsingHeader(componet.constructor.name, ImGui.TreeNodeFlags.DefaultOpen)) {
        ImGui.PushID(componet.getInstanceId());

        EditorGUILayout.Checkbox('Enabled', componet, 'enabled');

        let editor = this.defaultComponentEditor;

        if (customEditor) {
          editor = customEditor;
        }

        editor.target = componet;
        editor.onInspectorGUI();

        ImGui.PopID();
      }
    }
    if (activeObject.getComponent(RendererComponent)) {
      const material = activeObject.getComponent(RendererComponent).material;

      if (material && ImGui.CollapsingHeader(material.name + ' (Material)##CollapsingHeader', ImGui.TreeNodeFlags.DefaultOpen)) {
        this.drawMaterial(material);
      }
    }
  }

  private drawMaterial (material: Material) {
    if (!material) {
      return;
    }
    const glMaterial = material;
    const serializedData = glMaterial.toData();
    const shaderProperties = material.shader.shaderData.properties;
    let dirtyFlag = false;

    if (!shaderProperties) {
      return;
    }

    // RenderType Combo
    const RenderType: string[] = [spec.RenderType.Opaque, spec.RenderType.Transparent];

    if (!serializedData.stringTags['RenderType']) {
      serializedData.stringTags['RenderType'] = spec.RenderType.Transparent;
    }
    let currentRenderTypeIndex = RenderType.indexOf(serializedData.stringTags['RenderType']);

    EditorGUILayout.Label('SurfaceType');
    if (ImGui.Combo('##RenderType', (value = currentRenderTypeIndex)=>currentRenderTypeIndex = value, RenderType)) {
      dirtyFlag = true;
    }
    serializedData.stringTags['RenderType'] = RenderType[currentRenderTypeIndex];

    // RenderFace Combo
    const RenderFace: string[] = [spec.RenderFace.Front, spec.RenderFace.Back, spec.RenderFace.Both];

    if (!serializedData.stringTags['RenderFace']) {
      serializedData.stringTags['RenderFace'] = spec.RenderFace.Both;
    }
    let currentRenderFaceIndex = RenderFace.indexOf(serializedData.stringTags['RenderFace']);

    EditorGUILayout.Label('RenderFace');
    if (ImGui.Combo('##RenderFace', (value = currentRenderFaceIndex)=>currentRenderFaceIndex = value, RenderFace)) {
      dirtyFlag = true;
    }
    serializedData.stringTags['RenderFace'] = RenderFace[currentRenderFaceIndex];
    const lines = shaderProperties.split('\n');

    for (const property of lines) {
      // 提取材质属性信息
      // 如 “_Float1("Float2", Float) = 0”
      // 提取出 “_Float1” “Float2” “Float” “0”
      const regex = /\s*(\s*\[[^\]]+\]\s*)*([^\s([\]]+)\s*\(\s*"(.+?)"\s*,\s*(.+?)\s*\)\s*=\s*(.+)\s*/;
      const matchResults = property.match(regex);

      if (!matchResults) {
        continue;
      }

      const attributesMatch = property.matchAll(/\[([^\]]+)\]/g);
      const attributes = Array.from(attributesMatch, m => m[1]);

      const uniformName = matchResults[2];
      const inspectorName = matchResults[3];
      const type = matchResults[4];
      const defaultValue = matchResults[5];

      // 提取 Range(a, b) 的 a 和 b
      const RangeMatch = type.match(/\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);

      EditorGUILayout.Label(inspectorName);
      if (RangeMatch) {
        const start = Number(RangeMatch[1]);
        const end = Number(RangeMatch[2]);

        if (serializedData.floats[uniformName] === undefined) {
          serializedData.floats[uniformName] = Number(defaultValue);
        }
        if (ImGui.SliderFloat('##' + uniformName, (value = serializedData.floats[uniformName])=>serializedData.floats[uniformName] = value, start, end)) {
          dirtyFlag = true;
        }
      } else if (type === 'Float') {
        if (serializedData.floats[uniformName] === undefined) {
          serializedData.floats[uniformName] = Number(defaultValue);
        }
        if (attributes.includes('Toggle')) {
          if (ImGui.Checkbox('##' + uniformName, (value = Boolean(serializedData.floats[uniformName])) => (serializedData.floats[uniformName] as unknown as boolean) = value)) {
            dirtyFlag = true;
          }
        } else {
          if (ImGui.DragFloat('##' + uniformName, (value = serializedData.floats[uniformName])=>serializedData.floats[uniformName] = value, 0.02)) {
            dirtyFlag = true;
          }
        }
      } else if (type === 'Color') {
        if (!serializedData.colors[uniformName]) {
          serializedData.colors[uniformName] = { r:1.0, g:1.0, b:1.0, a:1.0 };
        }
        if (ImGui.ColorEdit4('##' + uniformName, serializedData.colors[uniformName])) {
          dirtyFlag = true;
        }
      } else if (type === 'Vector') {
        if (!serializedData.vector4s[uniformName]) {
          serializedData.vector4s[uniformName] = { x:1.0, y:1.0, z:0.0, w:0.0 };
        }
        if (ImGui.DragFloat4('##' + uniformName, serializedData.vector4s[uniformName], 0.02)) {
          dirtyFlag = true;
        }
      } else if (type === '2D') {
        const texture = glMaterial.getTexture(uniformName);

        if (texture instanceof GLTexture) {
          let __inspectorTexture = (texture as any).__imguiInspectorTexture as WebGLTexture;

          if (!__inspectorTexture && texture.definition.image) {
            __inspectorTexture = createImguiTextureFromImage(texture.definition.image);
            (texture as any).__imguiInspectorTexture = __inspectorTexture;
          }
          ImGui.ImageButton('inspector_texture', __inspectorTexture, new ImGui.Vec2(100, 100));
        } else {
          ImGui.Button(inspectorName + '##' + uniformName, new ImGui.Vec2(100, 100));
        }
        if (ImGui.BeginDragDropTarget()) {
          const payload = ImGui.AcceptDragDropPayload(GLTexture.name);

          if (payload && payload.Data) {

            const droppedTexture = payload.Data as Texture;

            if (!serializedData.textures[uniformName]) {
              serializedData.textures[uniformName] = { texture: droppedTexture };
            } else {
              serializedData.textures[uniformName].texture = droppedTexture;
            }

            dirtyFlag = true;
          }

          ImGui.EndDragDropTarget();
        }
      }
    }

    SerializationHelper.deserialize(serializedData, glMaterial);
    if (dirtyFlag) {
      GalaceanEffects.assetDataBase.setDirty(glMaterial.getInstanceId());
    }
  }

  /**
   * 锚点布局编辑器。仅在 VFXItem 挂了 Control 组件时调用。
   *
   * - `Rect Position` / `Rect Size` 直接编辑 rect,走 `RectTransform` 重写的 `setPosition` / `setSize`,
   *   内部反推 offset(保持当前 anchor)并 applyLayout
   * - `Anchor Min/Max`、`Offset Min/Max`、`Pivot Offset`(= `Transform.anchor` 像素偏移)直接修改字段
   * - `Anchor Preset` 4×4 网格切换 anchor;`Anchors + Offsets Preset` 同时贴边放置
   */
  private drawLayoutInspector (control: Control): void {
    const t = control.transform;
    const rt = control.transform as RectTransform;

    // Rect Position(= rect 左下角)。RectTransform.setPosition 重写为反推 offset 的语义
    {
      const buf: [number, number] = [rt.position.x, rt.position.y];

      EditorGUILayout.Label('Rect Position');
      if (ImGui.DragFloat2('##RectPosition', buf, 1, -10000, 10000, '%.0f')) {
        rt.setPosition(buf[0], buf[1], rt.position.z);
      }
    }
    // Rect Size。RectTransform.setSize 重写为反推 offset 的语义
    {
      const buf: [number, number] = [rt.size.x, rt.size.y];

      EditorGUILayout.Label('Rect Size');
      if (ImGui.DragFloat2('##RectSize', buf, 1, 0, 10000, '%.0f')) {
        rt.setSize(buf[0], buf[1]);
      }
    }

    ImGui.Spacing();

    // anchorMin (left, bottom),归一化 [0, 1]
    {
      const buf: [number, number] = [rt.anchorMin.x, rt.anchorMin.y];

      EditorGUILayout.Label('Anchor Min');
      if (ImGui.SliderFloat2('##AnchorMin', buf, 0, 1, '%.2f')) {
        rt.setAnchorMin(buf[0], buf[1]);
      }
    }
    // anchorMax (right, top),归一化 [0, 1]
    {
      const buf: [number, number] = [rt.anchorMax.x, rt.anchorMax.y];

      EditorGUILayout.Label('Anchor Max');
      if (ImGui.SliderFloat2('##AnchorMax', buf, 0, 1, '%.2f')) {
        rt.setAnchorMax(buf[0], buf[1]);
      }
    }
    // offsetMin (left, bottom),像素
    {
      const buf: [number, number] = [rt.offsetMin.x, rt.offsetMin.y];

      EditorGUILayout.Label('Offset Min');
      if (ImGui.DragFloat2('##OffsetMin', buf, 1, -10000, 10000, '%.0f')) {
        rt.setOffsetMin(buf[0], buf[1]);
      }
    }
    // offsetMax (right, top),像素
    {
      const buf: [number, number] = [rt.offsetMax.x, rt.offsetMax.y];

      EditorGUILayout.Label('Offset Max');
      if (ImGui.DragFloat2('##OffsetMax', buf, 1, -10000, 10000, '%.0f')) {
        rt.setOffsetMax(buf[0], buf[1]);
      }
    }
    // pivot(归一化 [0, 1])。setPivot 内部会同步 `transform.anchor = pivot * size`,
    // 所以 layout 缩放中心 + 矩阵旋转/缩放中心都绕同一点
    {
      const buf: [number, number] = [rt.pivot.x, rt.pivot.y];

      EditorGUILayout.Label('Pivot');
      if (ImGui.SliderFloat2('##Pivot', buf, 0, 1, '%.2f')) {
        rt.setPivot(buf[0], buf[1]);
      }
    }
    // 派生只读显示:transform.anchor = pivot * size
    ImGui.TextDisabled(`  transform.anchor (derived) = (${t.anchor.x.toFixed(0)}, ${t.anchor.y.toFixed(0)})`);
    ImGui.Spacing();

    // Preset 4×4 网格,Shift = 同时设 offset(贴边放置),否则只切 anchor
    if (ImGui.TreeNode('Anchor Preset')) {
      Inspector.drawAnchorPresetGrid(control);
      ImGui.TreePop();
    }
  }

  /**
   * 4×4 锚点预设网格。普通点击 = `setAnchorsPreset`(只切 anchor);Shift+点击 = `setAnchorsAndOffsetsPreset`(同时按当前 size 贴边)
   * 列:Left / Center / Right / Wide(横向拉伸)
   * 行:Top  / Middle / Bottom / Tall(纵向拉伸)
   */
  private static drawAnchorPresetGrid (control: Control): void {
    const rt = control.transform as RectTransform;

    type CellPreset = LayoutPreset;
    // 矩阵索引 = [row][col],row 顺序:T/M/B/H,col 顺序:L/C/R/W
    const matrix: CellPreset[][] = [
      ['topLeft', 'centerTop', 'topRight', 'topWide'],
      ['centerLeft', 'center', 'centerRight', 'hcenterWide'],
      ['bottomLeft', 'centerBottom', 'bottomRight', 'bottomWide'],
      ['leftWide', 'vcenterWide', 'rightWide', 'fullRect'],
    ];
    const colNames = ['L', 'C', 'R', 'W'];
    const rowNames = ['T', 'M', 'B', 'H'];

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (col > 0) {
          ImGui.SameLine();
        }
        const preset = matrix[row][col];
        const label = `${colNames[col]}${rowNames[row]}##preset_${row}_${col}`;

        if (ImGui.Button(label, new ImGui.Vec2(28, 22))) {
          if (ImGui.GetIO().KeyShift) {
            rt.setAnchorsAndOffsetsPreset(preset);
          } else {
            rt.setAnchorsPreset(preset);
          }
        }
      }
    }
    ImGui.TextDisabled('  Shift+click = anchor + offset preset');
  }

  private endBehaviorToString (endBehavior: spec.EndBehavior) {
    let result = '';

    switch (endBehavior) {
      case spec.EndBehavior.destroy:
        result = 'Destroy';

        break;
      case spec.EndBehavior.forward:
        result = 'Forward';

        break;
      case spec.EndBehavior.freeze:
        result = 'Freeze';

        break;
      case spec.EndBehavior.restart:
        result = 'Restart';

        break;
    }

    return result;
  }
}