import { BrowserFilePicker } from '../../platform/browser-files/file-dialog';
export interface ContentDropArea { x: number, y: number, width: number, height: number, folder: string }

export class ContentImportController {
  static preventNavigation (event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); }
  }

  areas: ContentDropArea[] = [];
  hovered?: ContentDropArea;
  private readonly picker = new BrowserFilePicker();
  private dragDepth = 0;

  constructor (private readonly importFiles: (files: File[], folder: string, replacement?: string) => void, private readonly context = () => '') { }

  enable (): void {
    window.addEventListener('dragenter', this.onDragEnter);
    window.addEventListener('dragover', this.onDragOver);
    window.addEventListener('dragleave', this.onDragLeave);
    window.addEventListener('drop', this.onDrop);
    window.addEventListener('blur', this.reset);
  }

  disable (): void {
    window.removeEventListener('dragenter', this.onDragEnter);
    window.removeEventListener('dragover', this.onDragOver);
    window.removeEventListener('dragleave', this.onDragLeave);
    window.removeEventListener('drop', this.onDrop);
    window.removeEventListener('blur', this.reset);
    this.areas = []; this.reset();
  }

  choose (folder: string, replacement?: string): void {
    const scope = this.context();

    this.picker.choose('image/*', files => {
      if (scope === this.context()) { this.importFiles(files, folder, replacement); }
    }, !replacement);
  }

  private isFile (event: DragEvent): boolean { return !!event.dataTransfer?.types.includes('Files'); }

  private readonly onDragEnter = (event: DragEvent): void => {
    if (this.isFile(event)) { event.preventDefault(); this.dragDepth++; }
  };

  private readonly onDragOver = (event: DragEvent): void => {
    if (!this.isFile(event)) { return; }
    event.preventDefault();
    this.hovered = [...this.areas].reverse().find(area => event.clientX >= area.x && event.clientX <= area.x + area.width && event.clientY >= area.y && event.clientY <= area.y + area.height);
    if (event.dataTransfer) { event.dataTransfer.dropEffect = this.hovered ? 'copy' : 'none'; }
  };

  private readonly onDragLeave = (event: DragEvent): void => {
    if (this.isFile(event) && --this.dragDepth <= 0) { this.reset(); }
  };

  private readonly onDrop = (event: DragEvent): void => {
    if (!this.isFile(event)) { return; }
    event.preventDefault();
    const area = [...this.areas].reverse().find(area => event.clientX >= area.x && event.clientX <= area.x + area.width && event.clientY >= area.y && event.clientY <= area.y + area.height);
    const files = Array.from(event.dataTransfer?.files ?? []);

    this.reset();
    if (area && files.length) { this.importFiles(files, area.folder); }
  };

  private readonly reset = (): void => { this.hovered = undefined; this.dragDepth = 0; };
}
