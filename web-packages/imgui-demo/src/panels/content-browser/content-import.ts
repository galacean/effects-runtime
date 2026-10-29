export interface ContentDropArea { x: number, y: number, width: number, height: number, folder: string }

export class ContentImport {
  static preventNavigation (event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); }
  }

  areas: ContentDropArea[] = [];
  hovered?: ContentDropArea;
  private picker?: HTMLInputElement;
  private target = '';
  private replacement?: string;
  private dragDepth = 0;

  constructor (private readonly importFiles: (files: File[], folder: string, replacement?: string) => void) { }

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
    this.target = folder; this.replacement = replacement;
    if (!this.picker) {
      this.picker = document.createElement('input');
      this.picker.type = 'file'; this.picker.accept = 'image/*'; this.picker.dataset.contentImport = 'true';
      this.picker.style.display = 'none'; document.body.appendChild(this.picker);
      this.picker.addEventListener('change', () => {
        const files = Array.from(this.picker!.files ?? []);

        if (files.length) { this.importFiles(files, this.target, this.replacement); }
        this.picker!.value = '';
      });
    }
    this.picker.multiple = !replacement; this.picker.click();
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
