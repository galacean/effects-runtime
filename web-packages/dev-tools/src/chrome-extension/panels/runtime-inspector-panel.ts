import { math, Texture, TextureSourceType } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { Control, Label } from '@galacean/effects-plugin-gui';
import { Control as BaseControl } from '@galacean/effects-plugin-gui';
import { EditorWindow } from '../../framework/windows/editor-window';
import type { RuntimeConnection } from '../bridge/runtime-connection';
import type { RuntimeField, RuntimePreview, RuntimeValue } from '../bridge/protocol';
import { append, column, expand, label, margin } from '../../ui/controls/layout';
import { EditorSearchField } from '../../ui/controls/search-field';
import { PropertySheet } from '../../ui/property-editor/property-sheet';
import type { PropertyGroup } from '../../ui/property-editor/property-sheet';
import { propertyLabel } from '../../ui/property-editor/default-object-details';
import { editorColors } from '../../ui/theme/control-theme';

class RuntimeImage extends BaseControl {
  private texture?: Texture;
  private url = '';
  constructor (engine: Engine) { super(engine); this.setCustomMinimumSize(0, 180); this.visible = false; }
  setPreview (preview?: RuntimePreview): void {
    const url = preview?.url ?? '';

    if (url === this.url) { return; }
    this.url = url; this.texture?.dispose(); this.texture = undefined; this.visible = !!url;
    if (!url) { return; }
    const image = new Image();

    image.onload = () => { if (!this.isDisposed && this.url === url) { this.texture = Texture.create(this.engine, { sourceType: TextureSourceType.image, image }); } };
    image.onerror = () => { if (this.url === url) { this.visible = false; } };
    image.src = url;
  }
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, editorColors.recessed);
    if (!this.texture) { return; }
    const scale = Math.min((this.width - 16) / this.texture.width, (this.height - 16) / this.texture.height);
    const width = this.texture.width * scale, height = this.texture.height * scale;

    this.drawTexture((this.width - width) / 2, (this.height - height) / 2, width, height, this.texture);
  }
  override onDestroy (): void { this.url = ''; this.texture?.dispose(); super.onDestroy(); }
}

export class RuntimeInspectorPanel extends EditorWindow {
  private sheet!: PropertySheet;
  private search!: EditorSearchField;
  private heading!: Label;
  private preview!: RuntimeImage;
  private structure = '';
  private editOwner?: Control;

  constructor (private readonly connection: RuntimeConnection) { super(); this.title = 'Inspector'; this.open(); }
  protected override createContent (engine: Engine): Control {
    const content = column(engine);

    this.heading = label(engine, 'Select an object'); append(content, margin(engine, this.heading, 12, 8));
    this.search = new EditorSearchField(engine, 'Search…'); this.search.on('textChanged', query => this.sheet.filter(query));
    append(content, margin(engine, this.search, 8, 6));
    this.preview = append(content, new RuntimeImage(engine));
    this.sheet = append(content, expand(new PropertySheet(engine, {
      change: (_title, owner, action) => {
        const previousOwner = this.editOwner;

        this.editOwner = owner;
        try { action(); } finally { this.editOwner = previousOwner; }
      },
      finish: owner => this.connection.finish(owner),
    })));

    return content;
  }
  refresh (): void {
    if (!this.sheet) { return; }
    const snapshot = this.connection.snapshot;
    const fieldShape = (field: RuntimeField): unknown => [field.id, field.kind, field.writable, field.reference, Array.isArray(field.value) ? field.value.length : undefined, field.children?.map(fieldShape)];
    const signature = JSON.stringify([snapshot.selectedId, snapshot.sections.map(section => [section.id, section.fields.map(fieldShape)])]);

    this.heading.text = snapshot.selectedName ?? 'Select an object';
    this.preview.setPreview(snapshot.preview);
    if (signature !== this.structure) {
      this.structure = signature; this.sheet.clear();
      for (const section of snapshot.sections) {
        const group = this.sheet.section(section.id, propertyLabel(section.name));

        section.fields.forEach(field => this.build(group, field));
      }
      this.sheet.filter(this.search.text);
    }
    this.sheet.refresh();
  }
  private build (group: PropertyGroup, field: RuntimeField): void {
    const title = propertyLabel(field.name);
    const read = (): RuntimeValue => this.connection.field(field.id)?.value ?? field.value;
    const write = (value: RuntimeValue): void => { if (this.editOwner) { this.connection.write(this.editOwner, field.id, value); } };

    if (field.kind === 'group') {
      const nested = group.group(field.id, title, false);

      field.children?.forEach(child => this.build(nested, child));
    } else if (field.kind === 'reference' && field.reference) {
      group.button(title, String(read()), () => this.connection.select(field.reference), 'browseContent');
    } else if (!field.writable) { group.readOnly(title, () => Array.isArray(read()) ? (read() as RuntimeValue[]).join(', ') : String(read() ?? 'None')); } else if (field.kind === 'number') {
      group.number(title, { read: () => Number(read()), write });
    } else if (field.kind === 'string') { group.text(title, { read: () => String(read()), write }, String(read()).includes('\n')); } else if (field.kind === 'boolean') {
      group.boolean(title, { read: () => !!read(), write });
    } else if (field.kind === 'vector') {
      group.vector(title, { read: () => read() as number[], write }, (read() as number[]).length);
    } else if (field.kind === 'color') {
      group.color(title, { read: () => new math.Color(...read() as [number, number, number, number]), write: value => write([value.r, value.g, value.b, value.a]) });
    }
  }
}
