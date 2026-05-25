import {
  ProModuleStage, ProParticleSystemComponent, ProParticleSystemRendererComponent,
  ProRibbonRenderer, ProSpriteRenderer, VFXItem, proModuleRegistry,
} from '@galacean/effects';
import type { ProEmitterInstance, ProModule } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import { createAddItemCommand, globalUndoStack } from '../core/undo-stack';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';
import { GraphView } from './node-graph/visual-graph/node-graph-view';
import { FlowGraph, FlowNode } from './node-graph/visual-graph/flow-graph';
import type { SelectedNode } from './node-graph/visual-graph/user-context';
import { UserContext } from './node-graph/visual-graph/user-context';
import type { DrawContext } from './node-graph/visual-graph/drawing-context';

type Color = ImGui.Color;
const Color = ImGui.Color;

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

// ─── Stage colors (UE Niagara execution category colors) ───────────────────

export const STAGE_COLORS: Record<string, ImGui.interface_ImVec4> = {
  [ProModuleStage.SystemSpawn]: new ImGui.ImVec4(0.25, 0.45, 0.85, 1.0),
  [ProModuleStage.SystemUpdate]: new ImGui.ImVec4(0.25, 0.45, 0.85, 1.0),
  [ProModuleStage.EmitterSpawn]: new ImGui.ImVec4(0.2, 0.7, 0.35, 1.0),
  [ProModuleStage.EmitterUpdate]: new ImGui.ImVec4(0.2, 0.7, 0.35, 1.0),
  [ProModuleStage.ParticleSpawn]: new ImGui.ImVec4(0.9, 0.55, 0.1, 1.0),
  [ProModuleStage.ParticleUpdate]: new ImGui.ImVec4(0.9, 0.55, 0.1, 1.0),
};

export function getStageColor (stage: ProModuleStage): ImGui.interface_ImVec4 {
  return STAGE_COLORS[stage] ?? new ImGui.ImVec4(0.5, 0.5, 0.5, 1.0);
}

// ─── Overview stages ────────────────────────────────────────────────────────

interface OverviewStageInfo {
  stage: ProModuleStage,
  label: string,
}

const OVERVIEW_STAGES: OverviewStageInfo[] = [
  { stage: ProModuleStage.EmitterSpawn, label: 'Emitter Spawn' },
  { stage: ProModuleStage.EmitterUpdate, label: 'Emitter Update' },
  { stage: ProModuleStage.ParticleSpawn, label: 'Particle Spawn' },
  { stage: ProModuleStage.ParticleUpdate, label: 'Particle Update' },
];

// ─── Global state for editor linkage ────────────────────────────────────────

let g_selectedEmitterIndex = 0;
let g_selectedModule: ProModule | null = null;
let g_overviewTarget: ProParticleSystemComponent | null = null;

export function getOverviewSelectedEmitterIndex (): number {
  return g_selectedEmitterIndex;
}

export function setOverviewSelectedEmitterIndex (index: number): void {
  g_selectedEmitterIndex = index;
}

export function getOverviewTarget (): ProParticleSystemComponent | null {
  return g_overviewTarget;
}

export function getOverviewSelectedModule (): ProModule | null {
  return g_selectedModule;
}

export function setOverviewSelectedModule (module: ProModule | null): void {
  g_selectedModule = module;
}

// ─── Overview Node: Emitter (对齐 SNiagaraOverviewStackNode) ───────────────

const NODE_WIDTH = 200;

export class ProEmitterOverviewNode extends FlowNode {
  emitterIndex = 0;
  emitterInstance: ProEmitterInstance | null = null;
  rendererTypes: string[] = [];
  particleCount = 0;
  enabled = true;

  override GetTypeName (): string { return `Emitter ${this.emitterIndex}`; }

  override GetTitleBarColor (): Color {
    if (!this.enabled) {
      return new Color(0.25, 0.25, 0.25, 1.0);
    }

    return new Color(0.45, 0.3, 0.08, 1.0);
  }

  override IsRenameable (): boolean { return true; }

  override DrawExtraControls (ctx: DrawContext, _pUserContext: UserContext): void {
    const emitter = this.emitterInstance;

    if (!emitter) {
      return;
    }

    // Scale-aware width: convert canvas NODE_WIDTH to current window pixels
    const scaledWidth = ctx.CanvasToWindow(NODE_WIDTH);
    const checkboxOffset = scaledWidth - ctx.CanvasToWindow(30);
    const selectableWidth = scaledWidth - ctx.CanvasToWindow(45);

    this.BeginDrawInternalRegion(ctx);

    // ── Renderer row (top content bar like UE) ──
    if (this.rendererTypes.length > 0) {
      for (let ri = 0; ri < this.rendererTypes.length; ri++) {
        if (ri > 0) { ImGui.SameLine(); }
        const rt = this.rendererTypes[ri];

        ImGui.TextColored(
          rt === 'Sprite' ? new ImGui.ImVec4(0.9, 0.8, 0.3, 1.0) : new ImGui.ImVec4(0.4, 0.7, 1.0, 1.0),
          rt === 'Sprite' ? '* Sprite Renderer' : '~ Ribbon Renderer',
        );
      }
    }

    ImGui.Spacing();
    ImGui.Separator();

    // ── Module stack (flat list matching UE SNiagaraOverviewStack) ──
    for (const stageInfo of OVERVIEW_STAGES) {
      const stageModules = emitter.modules.filter(m => m.stage === stageInfo.stage);
      const descriptors = proModuleRegistry.filter(d => d.stage === stageInfo.stage);

      // Hide stages with no modules and no available descriptors
      if (stageModules.length === 0 && descriptors.length === 0) {
        continue;
      }

      const stageColor = getStageColor(stageInfo.stage);

      // Stage group header row: ● StageName  + (larger/bolder than modules)
      ImGui.Spacing();
      ImGui.PushStyleColor(ImGui.Col.Text, stageColor);
      ImGui.Bullet();
      ImGui.SameLine();
      ImGui.Text(stageInfo.label);
      ImGui.PopStyleColor();

      // + add button right-aligned (scaled)
      if (descriptors.length > 0) {
        ImGui.SameLine(checkboxOffset);
        const addPopupId = `addmod_${stageInfo.stage}_${this.emitterIndex}`;

        if (ImGui.SmallButton(`+##add_${stageInfo.stage}`)) {
          ImGui.OpenPopup(addPopupId);
        }
        if (ImGui.BeginPopup(addPopupId)) {
          for (const desc of descriptors) {
            if (ImGui.Selectable(desc.label)) {
              const mod = desc.create();

              globalUndoStack.execute(createAddItemCommand(emitter.modules, mod, `Add ${desc.label}`));
            }
          }
          ImGui.EndPopup();
        }
      }

      // Module rows (smaller/compact)
      ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(ImGui.GetStyle().ItemSpacing.x, 1));
      ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(2, 0));
      for (const mod of stageModules) {
        const uid = getModuleUid(mod);
        const name = truncateText(prettifyModuleName(mod.constructor.name), 22);
        const isSelected = g_selectedModule === mod;

        ImGui.PushID(uid);

        if (isSelected) {
          ImGui.PushStyleColor(ImGui.Col.Header, new ImGui.ImVec4(0.2, 0.4, 0.7, 0.6));
        }

        // Module row: "▸ Name" selectable + checkbox on right
        ImGui.Indent(8);
        if (ImGui.Selectable(`${name}`, isSelected, ImGui.SelectableFlags.None, new ImVec2(selectableWidth - 8, 0))) {
          g_selectedModule = mod;
          g_selectedEmitterIndex = this.emitterIndex;
        }
        ImGui.Unindent(8);

        if (isSelected) {
          ImGui.PopStyleColor();
        }

        // Enabled checkbox right-aligned (scaled)
        ImGui.SameLine(checkboxOffset);
        const enRef = { value: mod.enabled };

        if (ImGui.Checkbox(`##en${uid}`, (v = enRef.value) => enRef.value = v)) {
          mod.enabled = enRef.value;
        }

        ImGui.PopID();
      }
      ImGui.PopStyleVar(2); // FramePadding, ItemSpacing
    }

    this.EndDrawInternalRegion(ctx);
  }
}

// ─── Overview Node: System ──────────────────────────────────────────────────

export class ProSystemOverviewNode extends FlowNode {
  particleCount = 0;

  override GetTypeName (): string { return 'System'; }

  override GetTitleBarColor (): Color {
    return new Color(0.15, 0.35, 0.6, 1.0);
  }

  override IsRenameable (): boolean { return true; }

  override DrawExtraControls (ctx: DrawContext, _pUserContext: UserContext): void {
    this.BeginDrawInternalRegion(ctx);
    ImGui.Text(`Particles: ${this.particleCount}`);
    this.EndDrawInternalRegion(ctx);
  }
}

// ─── Overview Graph ─────────────────────────────────────────────────────────

export class ProSystemOverviewGraph extends FlowGraph {
  systemNode: ProSystemOverviewNode | null = null;
  emitterNodes: ProEmitterOverviewNode[] = [];
}

// ─── Editor Window ──────────────────────────────────────────────────────────

@editorWindow()
export class ProSystemOverview extends EditorWindow {
  @menuItem('Window/Pro System Overview')
  static showWindow () {
    EditorWindow.getWindow(ProSystemOverview).open();
  }

  private graphView: GraphView;
  private userContext: UserContext;
  private graph: ProSystemOverviewGraph;
  private lastSystem: ProParticleSystemComponent | null = null;
  private lastEmitterCount = -1;

  constructor () {
    super();
    this.title = 'Pro System Overview';
    this.userContext = new UserContext();
    this.graphView = new GraphView(this.userContext);
    this.graph = new ProSystemOverviewGraph();
    this.graphView.SetGraphToView(this.graph);

    this.userContext.OnSelectionChanged((_oldSel, newSel) => {
      this.onNodeSelectionChanged(newSel);
    });

    this.open();
  }

  protected override onGUI (): void {
    const system = findActiveSystem();

    if (!system) {
      ImGui.TextDisabled('Select a VFXItem with ProParticleSystemComponent.');

      return;
    }

    g_overviewTarget = system;
    this.syncGraphWithSystem(system);
    this.updateNodeStats(system);

    this.graphView.UpdateAndDraw(0);
  }

  private syncGraphWithSystem (system: ProParticleSystemComponent): void {
    const emitters = system.systemInstance.emitters;
    const needsRebuild = system !== this.lastSystem ||
      emitters.length !== this.lastEmitterCount;

    if (!needsRebuild) {
      return;
    }

    this.lastSystem = system;
    this.lastEmitterCount = emitters.length;
    this.graph = new ProSystemOverviewGraph();

    const systemNode = this.graph.CreateNode(ProSystemOverviewNode, new ImVec2(50, 80));

    systemNode.m_name = system.item.name || 'Particle System';
    this.graph.systemNode = systemNode;

    this.graph.emitterNodes = [];
    for (let i = 0; i < emitters.length; i++) {
      const x = 280 + i * 260;
      const node = this.graph.CreateNode(ProEmitterOverviewNode, new ImVec2(x, 50));

      node.emitterIndex = i;
      node.emitterInstance = emitters[i];
      node.m_name = `Emitter ${i}`;
      node.rendererTypes = this.getRendererTypes(system, i);
      this.graph.emitterNodes.push(node);
    }

    this.graphView.SetGraphToView(this.graph);
  }

  private updateNodeStats (system: ProParticleSystemComponent): void {
    const emitters = system.systemInstance.emitters;
    let totalParticles = 0;

    for (let i = 0; i < this.graph.emitterNodes.length; i++) {
      const emitter = emitters[i];
      const node = this.graph.emitterNodes[i];

      if (emitter && emitter.particleDataSet) {
        const data = emitter.particleDataSet.getCurrentData();
        const count = data ? data.numInstances : 0;

        node.particleCount = count;
        totalParticles += count;
      }
      node.emitterInstance = emitter;
      node.rendererTypes = this.getRendererTypes(system, i);
    }

    if (this.graph.systemNode) {
      this.graph.systemNode.particleCount = totalParticles;
    }
  }

  private getRendererTypes (system: ProParticleSystemComponent, emitterIdx: number): string[] {
    const rc = system.item.getComponent(ProParticleSystemRendererComponent);

    if (!rc) { return []; }
    const types: string[] = [];

    for (let i = 0; i < rc.renderers.length; i++) {
      if (i !== emitterIdx) { continue; }
      const r = rc.renderers[i];

      if (r instanceof ProSpriteRenderer) { types.push('Sprite'); } else if (r instanceof ProRibbonRenderer) { types.push('Ribbon'); }
    }

    return types;
  }

  private onNodeSelectionChanged (newSelection: SelectedNode[]): void {
    if (newSelection.length === 0) { return; }
    const node = newSelection[0].m_pNode;

    if (node instanceof ProEmitterOverviewNode) {
      g_selectedEmitterIndex = node.emitterIndex;
    }
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function findActiveSystem (): ProParticleSystemComponent | null {
  for (const obj of Selection.getSelectedObjects<object>()) {
    if (obj instanceof VFXItem) {
      const system = obj.getComponent(ProParticleSystemComponent);

      if (system) { return system; }
    } else if (obj instanceof ProParticleSystemComponent) {
      return obj;
    }
  }

  return null;
}

function prettifyModuleName (raw: string): string {
  return raw.replace(/^Pro/, '').replace(/Module$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function truncateText (text: string, maxLen: number): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1) + '…';
}

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
