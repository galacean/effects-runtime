import { VFXItem, type Engine } from '@galacean/effects';
import { Control, MouseFilter, UIControl } from '@galacean/effects-plugin-gui';
import { Editor2D } from './2d/editor-2d';
import { Selection } from './2d/selection/selection';
import { Editor3D } from './3d/editor-3d';

export type EditorMode = '2d' | '3d';

/** Owns the scene selection and both viewport controls for an editor canvas. */
export class Editor {
  readonly rootItem: VFXItem;
  readonly selection: Selection;
  readonly editor2D: Editor2D;
  readonly editor3D: Editor3D;
  private activeEditor: Editor2D | Editor3D;

  constructor (readonly engine: Engine) {
    const rootControl = new Control(engine);

    rootControl.mouseFilter = MouseFilter.Ignore;
    rootControl.setAnchorsAndOffsetsPreset('fullRect');
    this.rootItem = new VFXItem(engine);
    this.rootItem.addComponent(UIControl).control = rootControl;
    this.selection = new Selection(engine);
    this.editor2D = rootControl.addChild(new Editor2D(this));
    this.editor3D = rootControl.addChild(new Editor3D(this));
    this.editor3D.setActive(false);
    this.activeEditor = this.editor2D;
  }

  get mode (): EditorMode {
    return this.activeEditor === this.editor2D ? '2d' : '3d';
  }

  setMode (mode: EditorMode): void {
    const next = mode === '2d' ? this.editor2D : this.editor3D;

    if (next === this.activeEditor) { return; }
    const previous = this.activeEditor;

    this.activeEditor = next;
    previous.setActive(false);
    // Ending a drag can synchronously request another mode.
    this.activeEditor.setActive(true);
  }

  dispose (): void {
    this.rootItem.dispose();
  }
}
