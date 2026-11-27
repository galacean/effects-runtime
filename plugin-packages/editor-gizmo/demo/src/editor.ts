import { ParticleSystem, PluginSystem, RendererComponent, Transform, spec, type Composition, type Geometry, type Material, type Player, type Renderer } from '@galacean/effects';
import { Editor, Gizmo3D, createGizmoMesh, createGizmoIcon, createEditorPrimitivesMaterial, createLineShapeGeometry, type Editor3D, type PrimitiveType, type GizmoGeometryOptions, type GizmoMesh } from '@galacean/effects-plugin-editor-gizmo';
import { createWireFrustumGeometry, createWireDirectionalLightGeometry, createWirePointLightGeometry, createWireSpotLightGeometry } from '../../src/3d/gizmo/debug-draw';
import { createGizmoMaterial } from '../../src/3d/gizmo/gizmo-materials';
import type { EditorGizmoPlugin } from '../../src/3d/editor-gizmo-plugin';

export interface GeometryExample {
  type: PrimitiveType | 'frustum' | 'directional-light' | 'point-light' | 'spot-light',
  icon?: string,
  options: Omit<GizmoGeometryOptions, 'size'> & { size: Record<string, any> },
  transform?: ConstructorParameters<typeof Transform>[0],
}

export function attachEditor (player: Player, composition: Composition): Editor {
  const editor = new Editor(player.engine);
  const toolbar = document.createElement('div');
  const mode = document.createElement('button');

  composition.addItem(editor.rootItem);
  editor.setMode('3d');
  const selected = composition.items.find(item => item !== editor.rootItem && item.type !== spec.ItemType.skybox
    && item.getComponent(RendererComponent));

  if (selected) { editor.selection.setSelectedItems([selected.getInstanceId()]); }
  mode.textContent = '返回 2D';
  mode.onclick = () => {
    editor.setMode(editor.mode === '3d' ? '2d' : '3d');
    mode.textContent = editor.mode === '3d' ? '返回 2D' : '切换到 3D';
    player.canvas.focus();
  };
  toolbar.appendChild(mode);
  for (const [label, tool] of [['移动 W', 'translate'], ['旋转 E', 'rotate'], ['缩放 R', 'scale'], ['相机', 'camera']] as const) {
    const button = document.createElement('button');

    button.textContent = label;
    button.onclick = () => {
      editor.editor3D.setTool(tool);
      player.canvas.focus();
    };
    toolbar.appendChild(button);
  }
  const space = document.createElement('button');

  space.textContent = '世界 / 局部 X';
  space.onclick = () => {
    const viewport = editor.editor3D;

    viewport.setTool(viewport.tool, viewport.space === 'world' ? 'local' : 'world');
    player.canvas.focus();
  };
  toolbar.appendChild(space);
  document.getElementById('J-container')!.before(toolbar);
  window.addEventListener('beforeunload', () => editor.dispose(), { once: true });

  return editor;
}

/** A demo shape with world-space geometry and no scene node. */
export class GeometryGizmo3D extends Gizmo3D {
  readonly type = 'geometry-example';
  private readonly mesh: GizmoMesh;
  private readonly transform: Transform;

  constructor (owner: Editor3D, example: GeometryExample) {
    super(owner);
    const plugin = PluginSystem.getPlugins().find(plugin => plugin.name === 'editor-gizmo') as EditorGizmoPlugin;

    if (typeof example.type === 'number') {
      this.mesh = example.icon
        ? createGizmoIcon(owner.engine, example.options, plugin.getIconTextures(owner.composition!).get(example.icon))
        : createGizmoMesh(owner.engine, example.type, example.options);
    } else {
      const size = example.options.size;
      let geometry: Geometry;

      switch (example.type) {
        case 'frustum':
          geometry = createWireFrustumGeometry(owner.engine, size.position, size.rotation, size.fov, size.aspect, size.near, size.far);

          break;
        case 'directional-light':
          geometry = createWireDirectionalLightGeometry(owner.engine, size.radius, size.length, size.segments, size.linesNumber, size.thetaStart, size.thetaLength);

          break;
        case 'point-light':
          geometry = createWirePointLightGeometry(owner.engine, size.range, size.segments, size.thetaStart, size.thetaLength);

          break;
        case 'spot-light':
          geometry = createWireSpotLightGeometry(owner.engine, size.range, size.spotAngle, size.segments, size.thetaStart, size.thetaLength);

          break;
      }
      this.mesh = { name: example.type, geometry, material: createGizmoMaterial(owner.engine, example.options.color, example.options.depthTest) };
    }
    this.transform = new Transform(example.transform);
  }

  override draw (renderer: Renderer): void {
    renderer.drawGeometry(this.mesh.geometry, this.transform.getWorldMatrix(), this.mesh.material);
  }

  override dispose (): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    super.dispose();
  }
}

export class ShapeGizmo3D extends Gizmo3D {
  readonly type = 'shape-example';
  private readonly material: Material;

  constructor (owner: Editor3D, private readonly geometry: Geometry, private readonly transform: Transform, color: spec.vec3) {
    super(owner);
    this.material = createEditorPrimitivesMaterial(owner.engine, color);
  }

  override draw (renderer: Renderer): void {
    renderer.drawGeometry(this.geometry, this.transform.getWorldMatrix(), this.material);
  }

  override dispose (): void {
    this.geometry.dispose();
    this.material.dispose();
    super.dispose();
  }
}

export function showEmitters (editor: Editor, composition: Composition): void {
  const viewport = editor.editor3D;

  for (const item of composition.items) {
    const shape = item.getComponent(ParticleSystem)?.definition.shape;

    if (!shape) { continue; }
    const geometry = createLineShapeGeometry(viewport.engine, { ...shape, shape: 'Sphere' });

    new ShapeGizmo3D(viewport, geometry, item.transform, [1, 1, 0]);
  }
}
