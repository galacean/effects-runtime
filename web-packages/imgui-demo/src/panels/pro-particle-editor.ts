import { VFXItem, spec } from '@galacean/effects';
import type { ProEmitterInstance, ProKeyframe, ProModule, ProRibbonFacingMode } from '@galacean/effects-plugin-particle-system-pro';
import {
  ProCurveColor, ProCurveFloat,
  ProDistributionColor, ProDistributionFloat, ProDistributionVector2, ProDistributionVector3,
  ProModuleStage, ProParticleSystemComponent, ProParticleSystemRendererComponent,
  ProRenderer, ProRibbonRenderer, ProRibbonRendererProperties, ProRibbonTextureMode,
  ProSpriteRenderer, ProSpriteRendererProperties,
  proModuleRegistry,
} from '@galacean/effects-plugin-particle-system-pro';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import {
  createAddItemCommand, createRemoveItemCommand, createReorderCommand,
  createSetValueCommand, globalUndoStack,
} from '../core/undo-stack';
import { ImGui } from '../imgui';
import { EditorGUILayout } from '../widgets/editor-gui-layout';
import { EditorWindow } from './editor-window';
import {
  getOverviewSelectedEmitterIndex, setOverviewSelectedEmitterIndex,
  getStageColor, getOverviewSelectedModule, setOverviewSelectedModule,
} from './pro-system-overview';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StageInfo {
  stage: ProModuleStage,
  label: string,
}

const STAGES: StageInfo[] = [
  { stage: ProModuleStage.SystemSpawn, label: 'System Spawn' },
  { stage: ProModuleStage.SystemUpdate, label: 'System Update' },
  { stage: ProModuleStage.EmitterSpawn, label: 'Emitter Spawn' },
  { stage: ProModuleStage.EmitterUpdate, label: 'Emitter Update' },
  { stage: ProModuleStage.ParticleSpawn, label: 'Particle Spawn' },
  { stage: ProModuleStage.ParticleUpdate, label: 'Particle Update' },
];

const BLEND_MODES: Array<{ label: string, value: spec.BlendingMode }> = [
  { label: 'ALPHA', value: spec.BlendingMode.ALPHA },
  { label: 'ADD', value: spec.BlendingMode.ADD },
  { label: 'MULTIPLY', value: spec.BlendingMode.MULTIPLY },
  { label: 'SUBTRACTION', value: spec.BlendingMode.SUBTRACTION },
  { label: 'SUPERPOSITION', value: spec.BlendingMode.SUPERPOSITION },
];

const SKIP_PROPS = new Set([
  'stage', 'enabled', 'accessors', 'cachedLayout', 'engine',
  'texture', 'blending', 'billboard', 'subUVRows', 'subUVCols', 'subUVTotal',
  'widthScale', 'textureMode', 'tileLength', 'facingMode', 'sortMode',
  // SpawnBurst.bursts — array of objects；用兼容 getter count/spawnTime 编辑 first burst
  'bursts',
]);

const CONDITIONAL_PROPS: Record<string, { dependsOn: string, showWhen: string[] }> = {
  sphereMin: { dependsOn: 'shape', showWhen: ['sphere'] },
  sphereMax: { dependsOn: 'shape', showWhen: ['sphere'] },
  boxSize: { dependsOn: 'shape', showWhen: ['box'] },
  boxSurfaceOnly: { dependsOn: 'shape', showWhen: ['box'] },
  cylinderHeight: { dependsOn: 'shape', showWhen: ['cylinder'] },
  cylinderRadius: { dependsOn: 'shape', showWhen: ['cylinder'] },
  ringRadius: { dependsOn: 'shape', showWhen: ['ring'] },
  ringThickness: { dependsOn: 'shape', showWhen: ['ring'] },
  planeSize: { dependsOn: 'shape', showWhen: ['plane'] },
  linearVelocity: { dependsOn: 'velocityType', showWhen: ['linear'] },
  speed: { dependsOn: 'velocityType', showWhen: ['inCone'] },
  coneAxis: { dependsOn: 'velocityType', showWhen: ['inCone'] },
  coneAngle: { dependsOn: 'velocityType', showWhen: ['inCone'] },
  pointSpeed: { dependsOn: 'velocityType', showWhen: ['fromPoint'] },
  pointOrigin: { dependsOn: 'velocityType', showWhen: ['fromPoint'] },
  // EmitterProperties — infinite 时不显示 duration/loopCount/loopDelay
  duration: { dependsOn: 'loopBehavior', showWhen: ['once', 'multiple'] },
  loopCount: { dependsOn: 'loopBehavior', showWhen: ['multiple'] },
  loopDelay: { dependsOn: 'loopBehavior', showWhen: ['once', 'multiple'] },
};

const MODULE_DND_TYPE = 'PRO_MODULE';

// ─── Search state ───────────────────────────────────────────────────────────

let g_searchFilter = '';

// ─── Editor Window ──────────────────────────────────────────────────────────

@editorWindow()
export class ProParticleEditor extends EditorWindow {
  @menuItem('Window/Pro Particle')
  static showWindow () {
    EditorWindow.getWindow(ProParticleEditor).open();
  }

  private selectedEmitterIndex = 0;

  constructor () {
    super();
    this.title = 'Pro Particle';
    this.open();
  }

  protected override onGUI (): void {
    const target = findProParticleTarget();

    if (!target) {
      ImGui.TextDisabled('Select a VFXItem with ProParticleSystemComponent.');

      return;
    }
    drawProParticleStack(target.system, target.rendererComponent, this);
  }
}

// ─── Target lookup ──────────────────────────────────────────────────────────

interface ProParticleTarget {
  system: ProParticleSystemComponent,
  rendererComponent: ProParticleSystemRendererComponent | null,
}

function findProParticleTarget (): ProParticleTarget | null {
  for (const obj of Selection.getSelectedObjects<object>()) {
    if (obj instanceof VFXItem) {
      const system = obj.getComponent(ProParticleSystemComponent);

      if (system) {
        return {
          system,
          rendererComponent: obj.getComponent(ProParticleSystemRendererComponent) ?? null,
        };
      }
    } else if (obj instanceof ProParticleSystemComponent) {
      return {
        system: obj,
        rendererComponent: obj.item?.getComponent(ProParticleSystemRendererComponent) ?? null,
      };
    }
  }

  return null;
}

// ─── Main draw (UE Niagara Selection panel layout) ──────────────────────────

export function drawProParticleStack (
  system: ProParticleSystemComponent,
  rendererComponent: ProParticleSystemRendererComponent | null,
  editor?: ProParticleEditor,
): void {
  // ── Toolbar: Undo/Redo + Search ──
  drawToolbar(system);
  ImGui.Separator();

  // ── Emitter tabs ──
  const emitters = system.systemInstance.emitters;
  const selectedIdx = drawEmitterTabs(system, emitters, editor);
  const emitter = emitters[selectedIdx];

  if (!emitter) {
    ImGui.TextDisabled('No emitter.');

    return;
  }

  // ── Emitter header info ──
  drawEmitterHeader(emitter, selectedIdx);
  ImGui.Separator();

  // ── Module stack (hide empty stages, UE SNiagaraStack style) ──
  for (const stage of STAGES) {
    const stageModules = emitter.modules.filter(m => m.stage === stage.stage);

    if (stageModules.length === 0 && g_searchFilter === '') {
      continue;
    }

    drawStageSection(emitter, stage, stageModules);
  }

  // ── Renderer section ──
  if (rendererComponent) {
    ImGui.Spacing();
    ImGui.Separator();
    drawRendererSection(rendererComponent);
  }

}

// ─── Toolbar ────────────────────────────────────────────────────────────────

function drawToolbar (system: ProParticleSystemComponent): void {
  const canUndo = globalUndoStack.canUndo;
  const canRedo = globalUndoStack.canRedo;

  if (!canUndo) { ImGui.BeginDisabled(); }
  if (ImGui.Button('Undo')) { globalUndoStack.undo(); }
  if (ImGui.IsItemHovered() && canUndo) { ImGui.SetTooltip(globalUndoStack.undoLabel); }
  if (!canUndo) { ImGui.EndDisabled(); }

  ImGui.SameLine();
  if (!canRedo) { ImGui.BeginDisabled(); }
  if (ImGui.Button('Redo')) { globalUndoStack.redo(); }
  if (ImGui.IsItemHovered() && canRedo) { ImGui.SetTooltip(globalUndoStack.redoLabel); }
  if (!canRedo) { ImGui.EndDisabled(); }

  ImGui.SameLine();
  if (ImGui.Button('Reset')) { system.systemInstance.reset(true); }
}

// ─── Emitter Header ─────────────────────────────────────────────────────────

function drawEmitterHeader (emitter: ProEmitterInstance, idx: number): void {
  const data = emitter.particleDataSet?.getCurrentData();
  const count = data ? data.numInstances : 0;

  // Line 1: Emitter name (UE style: bold colored)
  ImGui.TextColored(
    new ImGui.ImVec4(0.9, 0.75, 0.3, 1.0),
    `Emitter ${idx}`,
  );
  // Line 2: Particle count (gray)
  ImGui.TextDisabled(`${count} Particles`);

  // Line 3: Search bar (UE "Search the stack" style, full width)
  ImGui.SetNextItemWidth(-1);
  const searchRef = { value: g_searchFilter };

  ImGui.InputTextWithHint('##stackSearch', 'Search the stack', (v = searchRef.value) => searchRef.value = v);
  g_searchFilter = searchRef.value;
}

// ─── Emitter Tabs ───────────────────────────────────────────────────────────

function drawEmitterTabs (
  system: ProParticleSystemComponent,
  emitters: ProEmitterInstance[],
  editor?: ProParticleEditor,
): number {
  let selectedIdx = getOverviewSelectedEmitterIndex();

  if (editor && (editor as any).selectedEmitterIndex !== selectedIdx) {
    selectedIdx = (editor as any).selectedEmitterIndex;
  }

  if (selectedIdx >= emitters.length) {
    selectedIdx = Math.max(0, emitters.length - 1);
  }

  if (emitters.length > 1 || emitters.length === 0) {
    ImGui.BeginGroup();
    for (let i = 0; i < emitters.length; i++) {
      if (i > 0) { ImGui.SameLine(); }
      const label = `Emitter ${i}`;

      if (i === selectedIdx) {
        ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.Vec4(0.3, 0.5, 0.8, 1.0));
      }
      if (ImGui.SmallButton(label + '##tab' + i)) {
        selectedIdx = i;
      }
      if (i === selectedIdx) {
        ImGui.PopStyleColor();
      }
    }
    ImGui.SameLine();
    if (ImGui.SmallButton('+ Emitter')) {
      system.addEmitter();
    }
    if (emitters.length > 1) {
      ImGui.SameLine();
      if (ImGui.SmallButton('- Remove##emitter')) {
        system.removeEmitter(emitters[selectedIdx]);
        selectedIdx = Math.min(selectedIdx, emitters.length - 1);
      }
    }
    ImGui.EndGroup();
  }

  if (editor) {
    (editor as any).selectedEmitterIndex = selectedIdx;
  }
  setOverviewSelectedEmitterIndex(selectedIdx);

  return selectedIdx;
}

// ─── Stage Section (UE execution category group) ────────────────────────────
// Draws continuous vertical color bar spanning the entire stage section height.

const BAR_WIDTH = 4;
const BAR_GAP = 6;
const STAGE_INDENT = BAR_WIDTH + BAR_GAP;

function reorderModuleBeforeTarget (emitter: ProEmitterInstance, draggedModule: ProModule, targetModule: ProModule): void {
  const oldIndex = emitter.modules.indexOf(draggedModule);
  const targetIndex = emitter.modules.indexOf(targetModule);

  if (oldIndex < 0 || targetIndex < 0 || oldIndex === targetIndex) {
    return;
  }

  const insertIndex = oldIndex < targetIndex ? targetIndex - 1 : targetIndex;

  if (insertIndex === oldIndex) {
    return;
  }

  globalUndoStack.execute(createReorderCommand(emitter.modules, draggedModule, insertIndex, 'Reorder Module'));
}

function drawStageSection (emitter: ProEmitterInstance, stage: StageInfo, stageModules: ProModule[]): void {
  const stageColor = getStageColor(stage.stage);
  const drawList = ImGui.GetWindowDrawList();

  // Compute checkbox X position BEFORE any indent (absolute reference)
  const lineHeight = ImGui.GetFrameHeight();
  const absCheckboxX = ImGui.GetContentRegionMax().x - lineHeight;

  // Save start position for continuous color bar
  const startPos = ImGui.GetCursorScreenPos();
  const startX = startPos.x;
  const startY = startPos.y;

  // Indent all content past the color bar
  ImGui.Indent(STAGE_INDENT);

  // Tighter vertical spacing for compact look
  ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(ImGui.GetStyle().ItemSpacing.x, 2));

  // ── Stage header: CollapsingHeader ──
  const stageDescriptors = proModuleRegistry.filter(d => d.stage === stage.stage);

  ImGui.PushStyleColor(ImGui.Col.Text, stageColor);

  const opened = ImGui.CollapsingHeader(
    stage.label + '##' + stage.stage,
    ImGui.TreeNodeFlags.DefaultOpen | ImGui.TreeNodeFlags.AllowOverlap,
  );

  ImGui.PopStyleColor();

  // + button aligned with module checkbox (use pre-indent absolute position)
  if (stageDescriptors.length > 0) {
    ImGui.SameLine(absCheckboxX - STAGE_INDENT);

    const addPopupId = 'AddModule_' + stage.stage;

    if (ImGui.Button('+##add_' + stage.stage, new ImGui.Vec2(lineHeight, lineHeight))) {
      ImGui.OpenPopup(addPopupId);
    }
    if (ImGui.BeginPopup(addPopupId)) {
      for (const descriptor of stageDescriptors) {
        if (ImGui.Selectable(descriptor.label + '##' + descriptor.id)) {
          const mod = descriptor.create();

          globalUndoStack.execute(createAddItemCommand(emitter.modules, mod, `Add ${descriptor.label}`));
        }
      }
      ImGui.EndPopup();
    }
  }

  // ── Module rows (if stage is open, indented under the stage header) ──
  if (opened) {
    const filteredModules = g_searchFilter
      ? stageModules.filter(m => prettifyModuleName(m.constructor.name).toLowerCase().includes(g_searchFilter.toLowerCase()))
      : stageModules;

    ImGui.Indent(12);
    for (let idx = 0; idx < filteredModules.length; idx++) {
      drawModuleEntry(emitter, filteredModules[idx], stageColor);
    }
    ImGui.Unindent(12);
  }

  ImGui.PopStyleVar(); // ItemSpacing
  ImGui.Unindent(STAGE_INDENT);

  // ── Draw continuous vertical color bar (post-render, covers full stage height) ──
  const endPos = ImGui.GetCursorScreenPos();
  const endY = endPos.y;

  if (endY > startY) {
    drawList.AddRectFilled(
      new ImGui.Vec2(startX, startY),
      new ImGui.Vec2(startX + BAR_WIDTH, endY),
      ImGui.GetColorU32(stageColor),
    );
  }
}

// ─── Module Entry (UE flat row: ▶ Name  R ☑) ───────────────────────────────
// The continuous color bar is drawn by the parent drawStageSection.

function drawModuleEntry (emitter: ProEmitterInstance, module: ProModule, _stageColor: ImGui.interface_ImVec4): void {
  const uid = getModuleUid(module);
  const name = prettifyModuleName(module.constructor.name);
  const isSelected = getOverviewSelectedModule() === module;

  ImGui.PushID('mod_' + uid);

  // [▶ Module Name] — TreeNode (UE5 style: compact, no frame)
  if (isSelected) {
    ImGui.PushStyleColor(ImGui.Col.Header, new ImGui.ImVec4(0.2, 0.4, 0.7, 0.5));
  }

  const opened = ImGui.TreeNodeEx(
    name + '##' + uid,
    ImGui.TreeNodeFlags.SpanAvailWidth |
    ImGui.TreeNodeFlags.OpenOnArrow |
    ImGui.TreeNodeFlags.OpenOnDoubleClick |
    ImGui.TreeNodeFlags.AllowOverlap |
    (isSelected ? ImGui.TreeNodeFlags.Selected : 0),
  );

  if (isSelected) {
    ImGui.PopStyleColor();
  }

  if (ImGui.IsItemClicked(0)) {
    setOverviewSelectedModule(module);
  }

  if (ImGui.BeginDragDropSource(ImGui.DragDropFlags.None)) {
    ImGui.SetDragDropPayload(MODULE_DND_TYPE, module);
    ImGui.Text(name);
    ImGui.EndDragDropSource();
  }
  if (ImGui.BeginDragDropTarget()) {
    const payload = ImGui.AcceptDragDropPayload(MODULE_DND_TYPE);

    if (payload && payload.Data) {
      const draggedModule = payload.Data as ProModule;

      if (draggedModule !== module && draggedModule.stage === module.stage) {
        reorderModuleBeforeTarget(emitter, draggedModule, module);
      }
    }
    ImGui.EndDragDropTarget();
  }

  // Right-click context menu (inline per-item popup, safe outside node graph)
  if (ImGui.BeginPopupContextItem('##modctx_' + uid)) {
    if (ImGui.MenuItem('Delete Module')) {
      globalUndoStack.execute(createRemoveItemCommand(emitter.modules, module, `Remove ${name}`));
      if (getOverviewSelectedModule() === module) { setOverviewSelectedModule(null); }
    }
    ImGui.Separator();
    if (ImGui.MenuItem(module.enabled ? 'Disable' : 'Enable')) {
      module.enabled = !module.enabled;
    }
    ImGui.Separator();
    const moduleIdx = emitter.modules.indexOf(module);

    if (ImGui.MenuItem('Move Up', '', false, moduleIdx > 0)) {
      globalUndoStack.execute(createReorderCommand(emitter.modules, module, moduleIdx - 1, 'Move Module Up'));
    }
    if (ImGui.MenuItem('Move Down', '', false, moduleIdx < emitter.modules.length - 1)) {
      globalUndoStack.execute(createReorderCommand(emitter.modules, module, moduleIdx + 1, 'Move Module Down'));
    }
    ImGui.EndPopup();
  }

  // ── Right-side widgets: [↻] [☑] (UE style: checkbox at far right) ──
  {
    const lineHeight = ImGui.GetFrameHeight();
    const checkboxWidth = lineHeight;
    const resetWidth = lineHeight;
    const spacing = ImGui.GetStyle().ItemSpacing.x;
    const rightEdge = ImGui.GetContentRegionMax().x;
    const widgetsStartX = rightEdge - checkboxWidth - resetWidth - spacing;

    ImGui.SameLine(widgetsStartX);

    // ↻ Reset button (transparent background)
    ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.ImVec4(0, 0, 0, 0));
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, new ImGui.ImVec4(0.3, 0.3, 0.3, 0.5));
    if (ImGui.SmallButton('R##rst_' + uid)) {
      // Reset module to default values (re-create and copy stage/enabled)
      const descriptor = proModuleRegistry.find(d => d.create().constructor === module.constructor);

      if (descriptor) {
        const fresh = descriptor.create();

        for (const key of Object.keys(fresh)) {
          if (key === 'stage' || key === 'enabled' || key.startsWith('_')) { continue; }
          (module as unknown as Record<string, unknown>)[key] = (fresh as unknown as Record<string, unknown>)[key];
        }
      }
    }
    if (ImGui.IsItemHovered()) { ImGui.SetTooltip('Reset to defaults'); }
    ImGui.PopStyleColor(2);

    ImGui.SameLine();

    // ☑ Enabled checkbox
    const enabledRef = { value: module.enabled };

    if (ImGui.Checkbox('##en_' + uid, (v = enabledRef.value) => enabledRef.value = v)) {
      module.enabled = enabledRef.value;
    }
  }

  // Parameters table (when expanded)
  if (opened) {
    drawModuleParametersTable(module);
    ImGui.TreePop();
  }

  ImGui.PopID();
}

// ─── Module Parameters (UE SNiagaraStack two-column: Name | Value) ──────────

function drawModuleParametersTable (module: ProModule): void {
  const tableFlags = ImGui.TableFlags.Resizable |
    ImGui.TableFlags.BordersInnerV |
    ImGui.TableFlags.NoSavedSettings |
    ImGui.TableFlags.SizingStretchProp;

  if (!ImGui.BeginTable('##params_' + getModuleUid(module), 2, tableFlags)) {
    return;
  }

  ImGui.TableSetupColumn('Property', ImGui.TableColumnFlags.WidthStretch, 0.35);
  ImGui.TableSetupColumn('Value', ImGui.TableColumnFlags.WidthStretch, 0.65);

  drawProObjectTable(module);

  ImGui.EndTable();
}

// ─── Reflection-based parameter editor (table rows) ─────────────────────────

function drawProObjectTable (obj: object, prefix = ''): void {
  for (const key of Object.keys(obj)) {
    if (key.startsWith('_') || SKIP_PROPS.has(key)) {
      continue;
    }
    const cond = CONDITIONAL_PROPS[key];

    if (cond) {
      const depValue = (obj as Record<string, unknown>)[cond.dependsOn];

      if (!cond.showWhen.includes(depValue as string)) {
        continue;
      }
    }
    const value = (obj as Record<string, unknown>)[key];

    if (value === null || value === undefined) {
      continue;
    }

    const fullId = prefix + key;

    if (typeof value === 'number') {
      drawTableFloatRow(key, obj, key, fullId);
    } else if (typeof value === 'boolean') {
      drawTableCheckboxRow(key, obj, key, fullId);
    } else if (typeof value === 'string') {
      drawTableEnumRow(key, obj, key, value, fullId);
    } else if (Array.isArray(value) && value.length >= 2 && value.length <= 4 && value.every(v => typeof v === 'number')) {
      const isColorProp = /color/i.test(key);

      if (isColorProp && value.length === 4) {
        drawTableColorRow(key, value as [number, number, number, number], fullId);
      } else {
        drawTableVectorRow(key, value, fullId);
      }
    } else if (value instanceof ProDistributionColor) {
      drawTableDistributionColorRow(key, obj as Record<string, ProDistributionColor>, key, fullId);
    } else if (value instanceof ProDistributionFloat) {
      drawTableDistributionFloatRow(key, obj as Record<string, ProDistributionFloat>, key, fullId);
    } else if (value instanceof ProDistributionVector2) {
      drawTableDistributionVector2Row(key, obj as Record<string, ProDistributionVector2>, key, fullId);
    } else if (value instanceof ProDistributionVector3) {
      drawTableDistributionVector3Row(key, obj as Record<string, ProDistributionVector3>, key, fullId);
    } else if (value instanceof ProCurveFloat) {
      drawTableCurveFloatRow(key, obj as Record<string, ProCurveFloat>, key, fullId);
    } else if (value instanceof ProCurveColor) {
      drawTableCurveColorRow(key, obj as Record<string, ProCurveColor>, key, fullId);
    } else if (typeof value === 'object') {
      const constructorName = value.constructor?.name ?? '';

      if (constructorName === 'ProStandardAccessors' || constructorName === 'ProDataSetLayout') {
        continue;
      }
      // Sub-object: render as a header row spanning both columns, then recurse
      ImGui.TableNextRow();
      ImGui.TableNextColumn();
      const subOpen = ImGui.TreeNodeEx(prettifyLabel(key) + '##sub_' + fullId, ImGui.TreeNodeFlags.SpanAllColumns);

      if (subOpen) {
        drawProObjectTable(value, fullId + '.');
        ImGui.TreePop();
      }
    }
  }
}

// ─── Table row helpers (Label | Widget) ─────────────────────────────────────

function drawTableFloatRow (label: string, obj: object, key: string, id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);

  const oldValue = (obj as Record<string, number>)[key];
  const ref = { value: oldValue };

  if (ImGui.DragFloat('##' + id, (v = ref.value) => ref.value = v, 0.01, 0, 0, '%.3f')) {
    if (ref.value !== oldValue) {
      globalUndoStack.execute(createSetValueCommand(obj as Record<string, number>, key, ref.value, `Set ${label}`));
    }
  }
}

function drawTableCheckboxRow (label: string, obj: object, key: string, id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();

  const oldValue = (obj as Record<string, boolean>)[key];
  const ref = { value: oldValue };

  if (ImGui.Checkbox('##' + id, (v = ref.value) => ref.value = v)) {
    if (ref.value !== oldValue) {
      globalUndoStack.execute(createSetValueCommand(obj as Record<string, boolean>, key, ref.value, `Set ${label}`));
    }
  }
}

function drawTableColorRow (label: string, value: [number, number, number, number], id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  ImGui.ColorEdit4('##' + id, value, ImGui.ImGuiColorEditFlags.Float | ImGui.ImGuiColorEditFlags.HDR);
}

function drawTableVectorRow (label: string, value: number[], id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);

  if (value.length === 2) {
    ImGui.DragFloat2('##' + id, value as [number, number], 0.01);
  } else if (value.length === 3) {
    ImGui.DragFloat3('##' + id, value as [number, number, number], 0.01);
  } else if (value.length === 4) {
    ImGui.DragFloat4('##' + id, value as [number, number, number, number], 0.01);
  }
}

const CURVE_MODE_LABELS = ['Constant', 'Linear', 'Curve'];

function getCurveMode (curve: ProCurveFloat): number {
  const len = curve.keyframes.length;

  if (len <= 1) { return 0; }
  if (len === 2 && curve.keyframes[0].interpMode === 'linear') { return 1; }

  return 2;
}

function drawTableCurveFloatRow (label: string, obj: Record<string, ProCurveFloat>, key: string, id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();

  const curve = obj[key];
  let mode = getCurveMode(curve);

  // Mode combo
  ImGui.SetNextItemWidth(80);
  if (ImGui.BeginCombo('##mode_' + id, CURVE_MODE_LABELS[mode])) {
    for (let m = 0; m < 3; m++) {
      if (ImGui.Selectable(CURVE_MODE_LABELS[m], m === mode)) {
        mode = m;
        if (m === 0) { obj[key] = ProCurveFloat.constant(1); } else if (m === 1) { obj[key] = ProCurveFloat.linear(1, 0); } else if (m === 2) {
          obj[key] = ProCurveFloat.fromKeyframes([
            { time: 0, value: 1, inTangent: 0, outTangent: 0, interpMode: 'cubic' },
            { time: 0.5, value: 0.5, inTangent: -1, outTangent: -1, interpMode: 'cubic' },
            { time: 1, value: 0, inTangent: -1, outTangent: 0, interpMode: 'cubic' },
          ]);
        }
      }
    }
    ImGui.EndCombo();
  }

  ImGui.SameLine();

  if (mode === 0) {
    const ref = { value: curve.keyframes[0]?.value ?? 0 };

    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragFloat('##val_' + id, (v = ref.value) => ref.value = v, 0.01)) {
      obj[key] = ProCurveFloat.constant(ref.value);
    }
  } else if (mode === 1) {
    const startVal = { value: curve.keyframes[0]?.value ?? 1 };
    const endVal = { value: curve.keyframes[1]?.value ?? 0 };
    const w = (ImGui.GetContentRegionAvail().x - 4) * 0.5;

    ImGui.SetNextItemWidth(w);
    const a = ImGui.DragFloat('##s_' + id, (v = startVal.value) => startVal.value = v, 0.01);

    ImGui.SameLine();
    ImGui.SetNextItemWidth(w);
    const b = ImGui.DragFloat('##e_' + id, (v = endVal.value) => endVal.value = v, 0.01);

    if (a || b) {
      obj[key] = ProCurveFloat.linear(startVal.value, endVal.value);
    }
  } else {
    // Curve preview mini-plot
    drawCurvePreview(curve, id);
  }

  // Keyframe editor (expanded below for Curve mode)
  if (mode === 2) {
    drawKeyframeEditor(obj, key, id);
  }
}

const CURVE_PREVIEW_HEIGHT = 40;
const CURVE_PREVIEW_SAMPLES = 64;

function drawCurvePreview (curve: ProCurveFloat, id: string): void {
  const avail = ImGui.GetContentRegionAvail().x;
  const drawList = ImGui.GetWindowDrawList();
  const pos = ImGui.GetCursorScreenPos();
  const w = Math.max(avail, 60);
  const h = CURVE_PREVIEW_HEIGHT;

  // Background
  drawList.AddRectFilled(
    new ImGui.Vec2(pos.x, pos.y),
    new ImGui.Vec2(pos.x + w, pos.y + h),
    ImGui.IM_COL32(30, 30, 30, 200),
  );
  drawList.AddRect(
    new ImGui.Vec2(pos.x, pos.y),
    new ImGui.Vec2(pos.x + w, pos.y + h),
    ImGui.IM_COL32(80, 80, 80, 255),
  );

  // Sample curve and find value range
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let s = 0; s <= CURVE_PREVIEW_SAMPLES; s++) {
    const t = s / CURVE_PREVIEW_SAMPLES;
    const v = curve.evaluate(t);

    if (v < minVal) { minVal = v; }
    if (v > maxVal) { maxVal = v; }
  }

  if (minVal === maxVal) { minVal -= 0.5; maxVal += 0.5; }
  const padding = (maxVal - minVal) * 0.1;

  minVal -= padding;
  maxVal += padding;

  // Draw curve line
  const prevPoint = new ImGui.Vec2(0, 0);

  for (let s = 0; s <= CURVE_PREVIEW_SAMPLES; s++) {
    const t = s / CURVE_PREVIEW_SAMPLES;
    const v = curve.evaluate(t);
    const px = pos.x + t * w;
    const py = pos.y + h - ((v - minVal) / (maxVal - minVal)) * h;

    if (s > 0) {
      drawList.AddLine(prevPoint, new ImGui.Vec2(px, py), ImGui.IM_COL32(100, 200, 100, 255), 1.5);
    }
    prevPoint.x = px;
    prevPoint.y = py;
  }

  // Draw keyframe dots
  for (const kf of curve.keyframes) {
    const kx = pos.x + kf.time * w;
    const ky = pos.y + h - ((kf.value - minVal) / (maxVal - minVal)) * h;

    drawList.AddCircleFilled(new ImGui.Vec2(kx, ky), 3, ImGui.IM_COL32(255, 200, 50, 255));
  }

  // Reserve space
  ImGui.Dummy(new ImGui.Vec2(w, h));
}

function drawKeyframeEditor (obj: Record<string, ProCurveFloat>, key: string, id: string): void {
  const curve = obj[key];
  const keys = curve.keyframes;
  let dirty = false;
  let removeIdx = -1;

  for (let i = 0; i < keys.length; i++) {
    const kf = keys[i];

    ImGui.TableNextRow();
    ImGui.TableNextColumn();

    // Key index label with remove button
    ImGui.AlignTextToFramePadding();
    ImGui.Text('  Key ' + i);
    ImGui.SameLine();
    if (ImGui.SmallButton('X##rmk_' + id + '_' + i)) {
      removeIdx = i;
    }

    ImGui.TableNextColumn();

    // Time + Value
    const colW = (ImGui.GetContentRegionAvail().x - 8) * 0.25;

    ImGui.SetNextItemWidth(colW);
    const tRef = { value: kf.time };

    if (ImGui.DragFloat('##t_' + id + '_' + i, (v = tRef.value) => tRef.value = v, 0.005, 0, 1, 'T:%.3f')) {
      kf.time = Math.max(0, Math.min(1, tRef.value));
      dirty = true;
    }

    ImGui.SameLine();
    ImGui.SetNextItemWidth(colW);
    const vRef = { value: kf.value };

    if (ImGui.DragFloat('##v_' + id + '_' + i, (v = vRef.value) => vRef.value = v, 0.01, 0, 0, 'V:%.3f')) {
      kf.value = vRef.value;
      dirty = true;
    }

    // Tangents
    ImGui.SameLine();
    ImGui.SetNextItemWidth(colW);
    const inRef = { value: kf.inTangent };

    if (ImGui.DragFloat('##in_' + id + '_' + i, (v = inRef.value) => inRef.value = v, 0.01, 0, 0, 'In:%.2f')) {
      kf.inTangent = inRef.value;
      dirty = true;
    }

    ImGui.SameLine();
    ImGui.SetNextItemWidth(colW);
    const outRef = { value: kf.outTangent };

    if (ImGui.DragFloat('##out_' + id + '_' + i, (v = outRef.value) => outRef.value = v, 0.01, 0, 0, 'Out:%.2f')) {
      kf.outTangent = outRef.value;
      dirty = true;
    }
  }

  // Add keyframe button
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.TableNextColumn();
  if (ImGui.SmallButton('+ Add Key##ak_' + id)) {
    const lastTime = keys.length > 0 ? keys[keys.length - 1].time : 0;
    const newTime = Math.min(1, lastTime + 0.25);
    const newKf: ProKeyframe = { time: newTime, value: curve.evaluate(newTime), inTangent: 0, outTangent: 0, interpMode: 'cubic' };

    keys.push(newKf);
    dirty = true;
  }

  if (removeIdx >= 0 && keys.length > 2) {
    keys.splice(removeIdx, 1);
    dirty = true;
  }

  if (dirty) {
    obj[key] = ProCurveFloat.fromKeyframes([...keys]);
  }
}

const COLOR_CURVE_MODE_LABELS = ['Constant', 'Linear', 'Per-Channel'];

function getColorCurveMode (curve: ProCurveColor): number {
  const modes = [getCurveMode(curve.r), getCurveMode(curve.g), getCurveMode(curve.b), getCurveMode(curve.a)];

  if (modes.every(m => m === 0)) { return 0; }
  if (modes.every(m => m <= 1)) { return 1; }

  return 2;
}

function drawTableCurveColorRow (label: string, obj: Record<string, ProCurveColor>, key: string, id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();

  const curve = obj[key];
  let mode = getColorCurveMode(curve);

  // Mode combo
  ImGui.SetNextItemWidth(100);
  if (ImGui.BeginCombo('##cmode_' + id, COLOR_CURVE_MODE_LABELS[mode])) {
    for (let m = 0; m < 3; m++) {
      if (ImGui.Selectable(COLOR_CURVE_MODE_LABELS[m], m === mode)) {
        mode = m;
        if (m === 0) { obj[key] = ProCurveColor.constant(1, 1, 1, 1); } else if (m === 1) { obj[key] = ProCurveColor.linear([1, 1, 1, 1], [1, 1, 1, 0]); } else if (m === 2) {
          obj[key] = new ProCurveColor(
            ProCurveFloat.fromKeyframes([
              { time: 0, value: 1, inTangent: 0, outTangent: 0, interpMode: 'cubic' },
              { time: 1, value: 1, inTangent: 0, outTangent: 0, interpMode: 'cubic' },
            ]),
            ProCurveFloat.fromKeyframes([
              { time: 0, value: 1, inTangent: 0, outTangent: 0, interpMode: 'cubic' },
              { time: 1, value: 1, inTangent: 0, outTangent: 0, interpMode: 'cubic' },
            ]),
            ProCurveFloat.fromKeyframes([
              { time: 0, value: 1, inTangent: 0, outTangent: 0, interpMode: 'cubic' },
              { time: 1, value: 1, inTangent: 0, outTangent: 0, interpMode: 'cubic' },
            ]),
            ProCurveFloat.fromKeyframes([
              { time: 0, value: 1, inTangent: 0, outTangent: 0, interpMode: 'cubic' },
              { time: 1, value: 0, inTangent: -1, outTangent: 0, interpMode: 'cubic' },
            ]),
          );
        }
      }
    }
    ImGui.EndCombo();
  }

  if (mode === 0) {
    // Constant color
    const color: [number, number, number, number] = [
      curve.r.keyframes[0]?.value ?? 1,
      curve.g.keyframes[0]?.value ?? 1,
      curve.b.keyframes[0]?.value ?? 1,
      curve.a.keyframes[0]?.value ?? 1,
    ];

    ImGui.SameLine();
    if (ImGui.ColorEdit4('##cc_' + id, color, ImGui.ImGuiColorEditFlags.Float | ImGui.ImGuiColorEditFlags.NoInputs)) {
      obj[key] = ProCurveColor.constant(color[0], color[1], color[2], color[3]);
    }
  } else if (mode === 1) {
    // Linear start → end
    const startColor: [number, number, number, number] = [
      curve.r.keyframes[0]?.value ?? 1,
      curve.g.keyframes[0]?.value ?? 1,
      curve.b.keyframes[0]?.value ?? 1,
      curve.a.keyframes[0]?.value ?? 1,
    ];
    const endColor: [number, number, number, number] = [
      curve.r.keyframes[1]?.value ?? curve.r.keyframes[0]?.value ?? 1,
      curve.g.keyframes[1]?.value ?? curve.g.keyframes[0]?.value ?? 1,
      curve.b.keyframes[1]?.value ?? curve.b.keyframes[0]?.value ?? 1,
      curve.a.keyframes[1]?.value ?? curve.a.keyframes[0]?.value ?? 1,
    ];

    ImGui.SameLine();
    const a = ImGui.ColorEdit4('##cs_' + id, startColor, ImGui.ImGuiColorEditFlags.Float | ImGui.ImGuiColorEditFlags.NoInputs);

    ImGui.SameLine();
    ImGui.Text('>>');
    ImGui.SameLine();
    const b = ImGui.ColorEdit4('##ce_' + id, endColor, ImGui.ImGuiColorEditFlags.Float | ImGui.ImGuiColorEditFlags.NoInputs);

    if (a || b) {
      obj[key] = ProCurveColor.linear(startColor, endColor);
    }
  } else {
    // Per-channel curve editing
    const channels: [string, ProCurveFloat][] = [['R', curve.r], ['G', curve.g], ['B', curve.b], ['A', curve.a]];
    const channelColors = [
      ImGui.IM_COL32(220, 80, 80, 255),
      ImGui.IM_COL32(80, 200, 80, 255),
      ImGui.IM_COL32(80, 120, 220, 255),
      ImGui.IM_COL32(200, 200, 200, 255),
    ];

    // Mini preview for all channels
    const avail = ImGui.GetContentRegionAvail().x;
    const drawList = ImGui.GetWindowDrawList();
    const pos = ImGui.GetCursorScreenPos();
    const pw = Math.max(avail, 60);
    const ph = CURVE_PREVIEW_HEIGHT;

    drawList.AddRectFilled(
      new ImGui.Vec2(pos.x, pos.y),
      new ImGui.Vec2(pos.x + pw, pos.y + ph),
      ImGui.IM_COL32(30, 30, 30, 200),
    );

    for (let ch = 0; ch < 4; ch++) {
      const chCurve = channels[ch][1];
      const prevP = new ImGui.Vec2(0, 0);

      for (let s = 0; s <= CURVE_PREVIEW_SAMPLES; s++) {
        const t = s / CURVE_PREVIEW_SAMPLES;
        const v = Math.max(0, Math.min(1, chCurve.evaluate(t)));
        const px = pos.x + t * pw;
        const py = pos.y + ph - v * ph;

        if (s > 0) {
          drawList.AddLine(prevP, new ImGui.Vec2(px, py), channelColors[ch], 1.2);
        }
        prevP.x = px;
        prevP.y = py;
      }
    }

    drawList.AddRect(
      new ImGui.Vec2(pos.x, pos.y),
      new ImGui.Vec2(pos.x + pw, pos.y + ph),
      ImGui.IM_COL32(80, 80, 80, 255),
    );
    ImGui.Dummy(new ImGui.Vec2(pw, ph));

    // Per-channel keyframe editors
    const curveObj: Record<string, ProCurveFloat> = { r: curve.r, g: curve.g, b: curve.b, a: curve.a };

    for (let ch = 0; ch < 4; ch++) {
      const [chName] = channels[ch];
      const chKey = chName.toLowerCase();

      ImGui.TableNextRow();
      ImGui.TableNextColumn();
      ImGui.Text('    ' + chName);
      ImGui.TableNextColumn();

      // Inline mode for this channel
      const chCurve = curveObj[chKey];
      const chMode = getCurveMode(chCurve);

      ImGui.SetNextItemWidth(70);
      if (ImGui.BeginCombo('##chm_' + id + '_' + chKey, CURVE_MODE_LABELS[chMode])) {
        for (let m = 0; m < 3; m++) {
          if (ImGui.Selectable(CURVE_MODE_LABELS[m] + '##' + chKey, m === chMode)) {
            if (m === 0) { curveObj[chKey] = ProCurveFloat.constant(chKey === 'a' ? 1 : 1); } else if (m === 1) { curveObj[chKey] = ProCurveFloat.linear(1, chKey === 'a' ? 0 : 1); } else {
              curveObj[chKey] = ProCurveFloat.fromKeyframes([
                { time: 0, value: 1, inTangent: 0, outTangent: 0, interpMode: 'cubic' },
                { time: 1, value: chKey === 'a' ? 0 : 1, inTangent: 0, outTangent: 0, interpMode: 'cubic' },
              ]);
            }
            obj[key] = new ProCurveColor(curveObj['r'], curveObj['g'], curveObj['b'], curveObj['a']);
          }
        }
        ImGui.EndCombo();
      }

      if (chMode === 2) {
        drawKeyframeEditor(curveObj, chKey, id + '_' + chKey);
        if (curveObj[chKey] !== channels[ch][1]) {
          obj[key] = new ProCurveColor(curveObj['r'], curveObj['g'], curveObj['b'], curveObj['a']);
        }
      } else if (chMode === 0) {
        ImGui.SameLine();
        const ref = { value: chCurve.keyframes[0]?.value ?? 1 };

        ImGui.SetNextItemWidth(60);
        if (ImGui.DragFloat('##chv_' + id + '_' + chKey, (v = ref.value) => ref.value = v, 0.01, 0, 1)) {
          curveObj[chKey] = ProCurveFloat.constant(ref.value);
          obj[key] = new ProCurveColor(curveObj['r'], curveObj['g'], curveObj['b'], curveObj['a']);
        }
      } else {
        ImGui.SameLine();
        const s = { value: chCurve.keyframes[0]?.value ?? 1 };
        const e = { value: chCurve.keyframes[1]?.value ?? 0 };

        ImGui.SetNextItemWidth(50);
        const ca = ImGui.DragFloat('##chs_' + id + '_' + chKey, (v = s.value) => s.value = v, 0.01, 0, 0, '%.2f');

        ImGui.SameLine();
        ImGui.SetNextItemWidth(50);
        const cb = ImGui.DragFloat('##che_' + id + '_' + chKey, (v = e.value) => e.value = v, 0.01, 0, 0, '%.2f');

        if (ca || cb) {
          curveObj[chKey] = ProCurveFloat.linear(s.value, e.value);
          obj[key] = new ProCurveColor(curveObj['r'], curveObj['g'], curveObj['b'], curveObj['a']);
        }
      }
    }
  }
}

// ─── Distribution editors ──────────────────────────────────────────────────

const DIST_MODE_LABELS = ['Constant', 'Range', 'Curve'];

function getDistModeIndex (mode: string): number {
  if (mode === 'constant') { return 0; }
  if (mode === 'range') { return 1; }

  return 2;
}

function drawTableDistributionColorRow (label: string, obj: Record<string, ProDistributionColor>, key: string, id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();

  const dist = obj[key];
  const allConstant = dist.r.mode === 'constant' && dist.g.mode === 'constant' &&
    dist.b.mode === 'constant' && dist.a.mode === 'constant';
  const allRange = dist.r.mode === 'range' && dist.g.mode === 'range' &&
    dist.b.mode === 'range' && dist.a.mode === 'range';

  let modeIdx = allConstant ? 0 : allRange ? 1 : 2;

  ImGui.SetNextItemWidth(80);
  if (ImGui.BeginCombo('##dcmode_' + id, DIST_MODE_LABELS[modeIdx])) {
    for (let m = 0; m < 2; m++) {
      if (ImGui.Selectable(DIST_MODE_LABELS[m], m === modeIdx)) {
        modeIdx = m;
        if (m === 0) {
          obj[key] = ProDistributionColor.fromConstant(
            dist.r.constant, dist.g.constant, dist.b.constant, dist.a.constant,
          );
        } else {
          obj[key] = ProDistributionColor.fromRange(
            [dist.r.min, dist.g.min, dist.b.min, dist.a.min],
            [dist.r.max, dist.g.max, dist.b.max, dist.a.max],
          );
        }
      }
    }
    ImGui.EndCombo();
  }

  ImGui.SameLine();

  if (modeIdx === 0) {
    const color: [number, number, number, number] = [
      dist.r.constant, dist.g.constant, dist.b.constant, dist.a.constant,
    ];

    if (ImGui.ColorEdit4('##dcval_' + id, color, ImGui.ImGuiColorEditFlags.Float | ImGui.ImGuiColorEditFlags.NoInputs)) {
      obj[key] = ProDistributionColor.fromConstant(color[0], color[1], color[2], color[3]);
    }
  } else if (modeIdx === 1) {
    const minColor: [number, number, number, number] = [dist.r.min, dist.g.min, dist.b.min, dist.a.min];
    const maxColor: [number, number, number, number] = [dist.r.max, dist.g.max, dist.b.max, dist.a.max];

    const a = ImGui.ColorEdit4('##dcmin_' + id, minColor, ImGui.ImGuiColorEditFlags.Float | ImGui.ImGuiColorEditFlags.NoInputs);

    ImGui.SameLine();
    ImGui.Text('~');
    ImGui.SameLine();
    const b = ImGui.ColorEdit4('##dcmax_' + id, maxColor, ImGui.ImGuiColorEditFlags.Float | ImGui.ImGuiColorEditFlags.NoInputs);

    if (a || b) {
      obj[key] = ProDistributionColor.fromRange(minColor, maxColor);
    }
  } else {
    ImGui.Text('Per-channel (edit sub-fields)');
  }
}

function drawTableDistributionFloatRow (label: string, obj: Record<string, ProDistributionFloat>, key: string, id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();

  const dist = obj[key];
  let modeIdx = getDistModeIndex(dist.mode);

  // Mode combo
  ImGui.SetNextItemWidth(80);
  if (ImGui.BeginCombo('##dmode_' + id, DIST_MODE_LABELS[modeIdx])) {
    for (let m = 0; m < 3; m++) {
      if (ImGui.Selectable(DIST_MODE_LABELS[m], m === modeIdx)) {
        modeIdx = m;
        if (m === 0) { obj[key] = ProDistributionFloat.fromConstant(dist.constant); } else if (m === 1) { obj[key] = ProDistributionFloat.fromRange(dist.min, dist.max); } else { obj[key] = ProDistributionFloat.fromCurve(dist.curve); }
      }
    }
    ImGui.EndCombo();
  }

  ImGui.SameLine();

  if (modeIdx === 0) {
    const ref = { value: dist.constant };

    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragFloat('##dval_' + id, (v = ref.value) => ref.value = v, 0.01)) {
      obj[key] = ProDistributionFloat.fromConstant(ref.value);
    }
  } else if (modeIdx === 1) {
    const minRef = { value: dist.min };
    const maxRef = { value: dist.max };
    const w = (ImGui.GetContentRegionAvail().x - 4) * 0.5;

    ImGui.SetNextItemWidth(w);
    const a = ImGui.DragFloat('##dmin_' + id, (v = minRef.value) => minRef.value = v, 0.01, 0, 0, 'Min:%.3f');

    ImGui.SameLine();
    ImGui.SetNextItemWidth(w);
    const b = ImGui.DragFloat('##dmax_' + id, (v = maxRef.value) => maxRef.value = v, 0.01, 0, 0, 'Max:%.3f');

    if (a || b) {
      obj[key] = ProDistributionFloat.fromRange(minRef.value, maxRef.value);
    }
  } else {
    drawCurvePreview(dist.curve, id);
  }

  // Curve keyframe editor when in curve mode
  if (modeIdx === 2) {
    const curveObj: Record<string, ProCurveFloat> = { __c: dist.curve };

    drawKeyframeEditor(curveObj, '__c', id + '_dcurve');
    if (curveObj['__c'] !== dist.curve) {
      obj[key] = ProDistributionFloat.fromCurve(curveObj['__c']);
    }
  }
}

function drawTableDistributionVector2Row (label: string, obj: Record<string, ProDistributionVector2>, key: string, id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();

  const dist = obj[key];
  const allSameMode = dist.x.mode === dist.y.mode;
  const sharedMode = dist.x.mode;

  if (allSameMode && sharedMode === 'constant') {
    const vals: [number, number] = [dist.x.constant, dist.y.constant];

    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragFloat2('##dv2_' + id, vals, 0.01)) {
      const next = new ProDistributionVector2(
        ProDistributionFloat.fromConstant(vals[0]),
        ProDistributionFloat.fromConstant(vals[1]),
        dist.uniform,
      );

      obj[key] = next;
    }
  } else if (allSameMode && sharedMode === 'range') {
    const minV: [number, number] = [dist.x.min, dist.y.min];
    const maxV: [number, number] = [dist.x.max, dist.y.max];
    const w = (ImGui.GetContentRegionAvail().x - 4) * 0.5;

    ImGui.SetNextItemWidth(w);
    const a = ImGui.DragFloat2('##dv2min_' + id, minV, 0.01);

    ImGui.SameLine();
    ImGui.SetNextItemWidth(w);
    const b = ImGui.DragFloat2('##dv2max_' + id, maxV, 0.01);

    if (a || b) {
      obj[key] = ProDistributionVector2.fromRange(minV, maxV, dist.uniform);
    }
  } else {
    ImGui.Text('Per-axis');
  }

  // Uniform 切换
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.Text('  Uniform');
  ImGui.TableNextColumn();
  const uniRef = { value: dist.uniform };

  if (ImGui.Checkbox('##dv2uni_' + id, (v = uniRef.value) => uniRef.value = v)) {
    dist.uniform = uniRef.value;
  }
}

function drawTableDistributionVector3Row (label: string, obj: Record<string, ProDistributionVector3>, key: string, id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();

  const dist = obj[key];
  const axes: ['x', 'y', 'z'] = ['x', 'y', 'z'];

  // Show compact if all axes share same mode
  const allSameMode = dist.x.mode === dist.y.mode && dist.y.mode === dist.z.mode;
  const sharedMode = dist.x.mode;

  if (allSameMode && sharedMode === 'constant') {
    const vals: [number, number, number] = [dist.x.constant, dist.y.constant, dist.z.constant];

    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragFloat3('##dv3_' + id, vals, 0.01)) {
      obj[key] = ProDistributionVector3.fromConstant(vals[0], vals[1], vals[2]);
    }
  } else if (allSameMode && sharedMode === 'range') {
    const minV: [number, number, number] = [dist.x.min, dist.y.min, dist.z.min];
    const maxV: [number, number, number] = [dist.x.max, dist.y.max, dist.z.max];
    const w = (ImGui.GetContentRegionAvail().x - 4) * 0.5;

    ImGui.SetNextItemWidth(w);
    const a = ImGui.DragFloat3('##dv3min_' + id, minV, 0.01);

    ImGui.SameLine();
    ImGui.SetNextItemWidth(w);
    const b = ImGui.DragFloat3('##dv3max_' + id, maxV, 0.01);

    if (a || b) {
      obj[key] = ProDistributionVector3.fromRange(minV, maxV, dist.uniform);
    }
  } else {
    ImGui.Text('Per-axis');
  }

  // Per-axis rows
  for (const axis of axes) {
    const axisDist = dist[axis];
    const axisId = id + '_' + axis;

    ImGui.TableNextRow();
    ImGui.TableNextColumn();
    ImGui.AlignTextToFramePadding();
    ImGui.Text('  ' + axis.toUpperCase());
    ImGui.TableNextColumn();

    let modeIdx = getDistModeIndex(axisDist.mode);

    ImGui.SetNextItemWidth(70);
    if (ImGui.BeginCombo('##dvm_' + axisId, DIST_MODE_LABELS[modeIdx])) {
      for (let m = 0; m < 3; m++) {
        if (ImGui.Selectable(DIST_MODE_LABELS[m] + '##' + axisId, m === modeIdx)) {
          modeIdx = m;
          if (m === 0) { dist[axis] = ProDistributionFloat.fromConstant(axisDist.constant); } else if (m === 1) { dist[axis] = ProDistributionFloat.fromRange(axisDist.min, axisDist.max); } else { dist[axis] = ProDistributionFloat.fromCurve(axisDist.curve); }
        }
      }
      ImGui.EndCombo();
    }

    ImGui.SameLine();

    if (modeIdx === 0) {
      const ref = { value: axisDist.constant };

      ImGui.SetNextItemWidth(-1);
      if (ImGui.DragFloat('##dvv_' + axisId, (v = ref.value) => ref.value = v, 0.01)) {
        dist[axis] = ProDistributionFloat.fromConstant(ref.value);
      }
    } else if (modeIdx === 1) {
      const minRef = { value: axisDist.min };
      const maxRef = { value: axisDist.max };
      const w2 = (ImGui.GetContentRegionAvail().x - 4) * 0.5;

      ImGui.SetNextItemWidth(w2);
      const ca = ImGui.DragFloat('##dvmin_' + axisId, (v = minRef.value) => minRef.value = v, 0.01, 0, 0, '%.3f');

      ImGui.SameLine();
      ImGui.SetNextItemWidth(w2);
      const cb = ImGui.DragFloat('##dvmax_' + axisId, (v = maxRef.value) => maxRef.value = v, 0.01, 0, 0, '%.3f');

      if (ca || cb) {
        dist[axis] = ProDistributionFloat.fromRange(minRef.value, maxRef.value);
      }
    } else {
      drawCurvePreview(axisDist.curve, axisId);
      const curveObj: Record<string, ProCurveFloat> = { __c: axisDist.curve };

      drawKeyframeEditor(curveObj, '__c', axisId + '_curve');
      if (curveObj['__c'] !== axisDist.curve) {
        dist[axis] = ProDistributionFloat.fromCurve(curveObj['__c']);
      }
    }
  }
}

const KNOWN_ENUM_OPTIONS: Record<string, string[]> = {
  shape: ['box', 'sphere', 'cylinder', 'ring', 'plane'],
  velocityType: ['linear', 'inCone', 'fromPoint'],
  loopBehavior: ['infinite', 'once', 'multiple'],
  simulationSpace: ['local', 'world'],
};

function drawTableEnumRow (label: string, obj: object, key: string, currentValue: string, id: string): void {
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text(prettifyLabel(label));
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);

  const options = KNOWN_ENUM_OPTIONS[key];

  if (options) {
    let idx = options.indexOf(currentValue);

    if (idx < 0) { idx = 0; }
    if (ImGui.Combo('##' + id, (v = idx) => idx = v, options)) {
      if (options[idx] !== currentValue) {
        (obj as Record<string, unknown>)[key] = options[idx];
      }
    }
  } else {
    const ref = { value: currentValue };

    if (ImGui.InputText('##' + id, (v = ref.value) => ref.value = v, undefined, ImGui.InputTextFlags.EnterReturnsTrue)) {
      if (ref.value !== currentValue) {
        (obj as Record<string, unknown>)[key] = ref.value;
      }
    }
  }
}

// ─── Renderer Section ───────────────────────────────────────────────────────

function drawRendererSection (rc: ProParticleSystemRendererComponent): void {
  // ── Renderers: CollapsingHeader (same style as stage categories) ──
  const sectionOpen = ImGui.CollapsingHeader(
    'Renderers (' + rc.renderers.length + ')##renderers_section',
    ImGui.TreeNodeFlags.DefaultOpen | ImGui.TreeNodeFlags.AllowOverlap,
  );

  // + Add Renderer button aligned with module checkboxes
  {
    const lineHeight = ImGui.GetFrameHeight();
    const rightEdge = ImGui.GetContentRegionMax().x;

    ImGui.SameLine(rightEdge - lineHeight);
    const addPopupId = 'AddRenderer_popup';

    if (ImGui.Button('+##add_renderer', new ImGui.Vec2(lineHeight, lineHeight))) {
      ImGui.OpenPopup(addPopupId);
    }
    if (ImGui.BeginPopup(addPopupId)) {
      if (ImGui.Selectable('Sprite Renderer')) {
        const props = new ProSpriteRendererProperties();
        const renderer = new ProSpriteRenderer(rc.item.engine, props);

        rc.addRenderer(renderer);
      }
      if (ImGui.Selectable('Ribbon Renderer')) {
        const props = new ProRibbonRendererProperties();
        const renderer = new ProRibbonRenderer(rc.item.engine, props);

        rc.addRenderer(renderer);
      }
      ImGui.EndPopup();
    }
  }

  if (!sectionOpen) {
    return;
  }

  let removeIdx = -1;

  ImGui.Indent(12);
  for (let i = 0; i < rc.renderers.length; i++) {
    const r = rc.renderers[i];

    ImGui.PushID('renderer_' + i);

    const rName = r instanceof ProSpriteRenderer ? 'Sprite Renderer' : r instanceof ProRibbonRenderer ? 'Ribbon Renderer' : 'Renderer';
    const rOpened = ImGui.TreeNodeEx(
      rName + '##r' + i,
      ImGui.TreeNodeFlags.DefaultOpen |
      ImGui.TreeNodeFlags.SpanAvailWidth |
      ImGui.TreeNodeFlags.OpenOnArrow |
      ImGui.TreeNodeFlags.OpenOnDoubleClick,
    );

    // Right-click to remove
    if (ImGui.BeginPopupContextItem('##rctx_' + i)) {
      if (ImGui.MenuItem('Remove Renderer')) {
        removeIdx = i;
      }
      ImGui.EndPopup();
    }

    if (rOpened) {
      if (r instanceof ProSpriteRenderer) {
        drawSpriteRendererTable(r);
      } else if (r instanceof ProRibbonRenderer) {
        drawRibbonRendererTable(r);
      }
      ImGui.TreePop();
    }
    ImGui.PopID();
  }
  ImGui.Unindent(12);

  if (removeIdx >= 0) {
    rc.removeRenderer(removeIdx);
  }
}

// ─── Sprite Renderer (table layout) ────────────────────────────────────────

export function drawSpriteRendererProperties (renderer: ProSpriteRenderer): void {
  drawSpriteRendererTable(renderer);
}

function drawSpriteRendererTable (renderer: ProSpriteRenderer): void {
  const p: ProSpriteRendererProperties = renderer.properties;
  const tableFlags = ImGui.TableFlags.Resizable | ImGui.TableFlags.BordersInnerV | ImGui.TableFlags.SizingStretchProp;

  if (!ImGui.BeginTable('##sprite_props', 2, tableFlags)) {
    return;
  }
  ImGui.TableSetupColumn('Property', ImGui.TableColumnFlags.WidthStretch, 0.35);
  ImGui.TableSetupColumn('Value', ImGui.TableColumnFlags.WidthStretch, 0.65);

  // Texture URL
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('Texture');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  const urlRef = { value: getDebugTextureUrl(p) };

  if (ImGui.InputText('##TexURL', (v = urlRef.value) => urlRef.value = v, undefined, ImGui.InputTextFlags.EnterReturnsTrue)) {
    setDebugTextureUrl(p, urlRef.value);
    void loadAndApplyTexture(renderer, urlRef.value);
  }

  // Blending
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('Blending');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  let currentBlendIndex = BLEND_MODES.findIndex(b => b.value === p.blending);

  if (currentBlendIndex < 0) { currentBlendIndex = 0; }
  if (ImGui.Combo('##Blending', (v = currentBlendIndex) => currentBlendIndex = v, BLEND_MODES.map(b => b.label))) {
    p.blending = BLEND_MODES[currentBlendIndex].value;
    renderer.syncProperties();
  }

  // Facing Mode
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('Facing Mode');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  const spriteFacingModes: Array<typeof p.facingMode> = ['billboard', 'velocity'];
  let spriteFacingIdx = spriteFacingModes.indexOf(p.facingMode);

  if (spriteFacingIdx < 0) { spriteFacingIdx = 0; }
  if (ImGui.Combo('##SpriteFacing', (v = spriteFacingIdx) => spriteFacingIdx = v, spriteFacingModes)) {
    p.facingMode = spriteFacingModes[spriteFacingIdx];
    renderer.syncProperties();
  }

  // Sort Mode
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('Sort Mode');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  const spriteSortModes: Array<typeof p.sortMode> = ['none', 'viewDepth', 'distance', 'age'];
  let spriteSortIdx = spriteSortModes.indexOf(p.sortMode);

  if (spriteSortIdx < 0) { spriteSortIdx = 0; }
  if (ImGui.Combo('##SpriteSort', (v = spriteSortIdx) => spriteSortIdx = v, spriteSortModes)) {
    p.sortMode = spriteSortModes[spriteSortIdx];
  }

  // SubUV
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('SubUV Rows');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  ImGui.DragFloat('##SubRows', (v = p.subUVRows) => p.subUVRows = v, 1, 1, 32, '%.0f');

  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('SubUV Cols');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  ImGui.DragFloat('##SubCols', (v = p.subUVCols) => p.subUVCols = v, 1, 1, 32, '%.0f');

  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('SubUV Total');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  ImGui.DragFloat('##SubTotal', (v = p.subUVTotal) => p.subUVTotal = v, 1, 1, 1024, '%.0f');

  // Apply button spanning both columns
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.TableNextColumn();
  if (ImGui.SmallButton('Apply SubUV')) {
    renderer.syncProperties();
  }

  ImGui.EndTable();
}

// ─── Ribbon Renderer (table layout) ─────────────────────────────────────────

export function drawRibbonRendererProperties (renderer: ProRibbonRenderer): void {
  drawRibbonRendererTable(renderer);
}

function drawRibbonRendererTable (renderer: ProRibbonRenderer): void {
  const p: ProRibbonRendererProperties = renderer.properties;
  const tableFlags = ImGui.TableFlags.Resizable | ImGui.TableFlags.BordersInnerV | ImGui.TableFlags.SizingStretchProp;

  if (!ImGui.BeginTable('##ribbon_props', 2, tableFlags)) {
    return;
  }
  ImGui.TableSetupColumn('Property', ImGui.TableColumnFlags.WidthStretch, 0.35);
  ImGui.TableSetupColumn('Value', ImGui.TableColumnFlags.WidthStretch, 0.65);

  // Texture URL
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('Texture');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  const urlRef = { value: getDebugTextureUrl(p as any) };

  if (ImGui.InputText('##RibbonTexURL', (v = urlRef.value) => urlRef.value = v, undefined, ImGui.InputTextFlags.EnterReturnsTrue)) {
    setDebugTextureUrl(p as any, urlRef.value);
    void loadAndApplyRibbonTexture(renderer, urlRef.value);
  }

  // Blending
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('Blending');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  let currentBlendIndex = BLEND_MODES.findIndex(b => b.value === p.blending);

  if (currentBlendIndex < 0) { currentBlendIndex = 0; }
  if (ImGui.Combo('##RibbonBlending', (v = currentBlendIndex) => currentBlendIndex = v, BLEND_MODES.map(b => b.label))) {
    p.blending = BLEND_MODES[currentBlendIndex].value;
    renderer.syncProperties();
  }

  // Width Scale
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('Width Scale');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  ImGui.DragFloat('##WidthScale', (v = p.widthScale) => p.widthScale = v, 0.01, 0, 10, '%.3f');

  // Texture Mode
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('Texture Mode');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  const textureModes = ['stretch', 'tile'];
  let texModeIdx = textureModes.indexOf(p.textureMode);

  if (texModeIdx < 0) { texModeIdx = 0; }
  if (ImGui.Combo('##TexMode', (v = texModeIdx) => texModeIdx = v, textureModes)) {
    p.textureMode = textureModes[texModeIdx] as ProRibbonTextureMode;
  }

  // Tile Length (conditional)
  if (p.textureMode === ProRibbonTextureMode.Tile) {
    ImGui.TableNextRow();
    ImGui.TableNextColumn();
    ImGui.AlignTextToFramePadding();
    ImGui.Text('Tile Length');
    ImGui.TableNextColumn();
    ImGui.SetNextItemWidth(-1);
    ImGui.DragFloat('##TileLen', (v = p.tileLength) => p.tileLength = v, 0.1, 0.01, 100, '%.2f');
  }

  // Facing Mode
  ImGui.TableNextRow();
  ImGui.TableNextColumn();
  ImGui.AlignTextToFramePadding();
  ImGui.Text('Facing Mode');
  ImGui.TableNextColumn();
  ImGui.SetNextItemWidth(-1);
  const facingModes = ['camera', 'velocity'];
  let facingIdx = facingModes.indexOf(p.facingMode);

  if (facingIdx < 0) { facingIdx = 0; }
  if (ImGui.Combo('##FacingMode', (v = facingIdx) => facingIdx = v, facingModes)) {
    p.facingMode = facingModes[facingIdx] as ProRibbonFacingMode;
  }

  ImGui.EndTable();
}

// ─── Texture helpers ────────────────────────────────────────────────────────

async function loadAndApplyTexture (renderer: ProSpriteRenderer, url: string): Promise<void> {
  if (!url) {
    renderer.setTexture(null);

    return;
  }
  const { Texture } = await import('@galacean/effects');

  try {
    const texture = await Texture.fromImage(url, renderer.material.engine);

    renderer.setTexture(texture);
  } catch (err) {
    console.warn('[ProSpriteRenderer] failed to load texture:', url, err);
  }
}

async function loadAndApplyRibbonTexture (renderer: ProRibbonRenderer, url: string): Promise<void> {
  if (!url) {
    renderer.setTexture(null);

    return;
  }
  const { Texture } = await import('@galacean/effects');

  try {
    const texture = await Texture.fromImage(url, renderer.material.engine);

    renderer.setTexture(texture);
  } catch (err) {
    console.warn('[ProRibbonRenderer] failed to load texture:', url, err);
  }
}

function getDebugTextureUrl (p: object): string {
  return (p as Record<string, string>).__debugUrl ?? '';
}

function setDebugTextureUrl (p: object, url: string): void {
  (p as Record<string, string>).__debugUrl = url;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

const moduleUids = new WeakMap<ProModule, number>();
let nextModuleUid = 1;

function getModuleUid (module: ProModule): number {
  let uid = moduleUids.get(module);

  if (uid === undefined) {
    uid = nextModuleUid++;
    moduleUids.set(module, uid);
  }

  return uid;
}

function prettifyModuleName (raw: string): string {
  return raw.replace(/^Pro/, '').replace(/Module$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function prettifyLabel (key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2');
}
