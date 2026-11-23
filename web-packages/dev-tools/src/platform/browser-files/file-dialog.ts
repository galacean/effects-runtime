export function downloadBlob (blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a');

  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export class BrowserFilePicker {
  private input?: HTMLInputElement;

  choose (accept: string, onFiles: (files: File[]) => void, multiple = false): void {
    this.input ??= document.createElement('input');
    this.input.type = 'file'; this.input.accept = accept; this.input.multiple = multiple;
    this.input.onchange = () => {
      const files = Array.from(this.input?.files ?? []);

      this.input!.value = '';
      if (files.length) { onFiles(files); }
    };
    this.input.click();
  }

  dispose (): void { this.input?.remove(); this.input = undefined; }
}
