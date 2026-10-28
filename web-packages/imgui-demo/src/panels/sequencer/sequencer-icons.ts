import { ImGui, ImGui_Impl } from '../../imgui';
import { drawEditorChevron } from '../../widgets/editor-arrow';

const paths = {
  actions: '<path fill="white" stroke="none" d="M12.2 2.3a5 5 0 0 0-5.1 6.3l-5 5a2.4 2.4 0 0 0 3.4 3.4l5-5a5 5 0 0 0 6.3-6.3l-3 3-2.5-2.5 3-3a5 5 0 0 0-2.1-.9Z"/>',
  view: '<path fill="white" stroke="none" fill-rule="evenodd" d="M1 10C5 3 15 3 19 10 15 17 5 17 1 10Zm9-4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><circle fill="white" stroke="none" cx="10" cy="10" r="2.2"/>',
  play: '<path fill="white" stroke="none" d="M6 3.5 16 10 6 16.5Z"/>',
  pause: '<path fill="white" stroke="none" d="M5 3h4v14H5zM11 3h4v14h-4z"/>',
  first: '<path fill="white" stroke="none" d="M2 3h2v14H2zM5 10l6-7v14zM11 10l7-7v14z"/>',
  last: '<path fill="white" stroke="none" d="M16 3h2v14h-2zM15 10 9 3v14zM9 10 2 3v14z"/>',
  previous: '<path fill="white" stroke="none" d="m6 5-5 5 5 5 5-5zM18 3l-7 7 7 7z"/>',
  next: '<path fill="white" stroke="none" d="m14 5-5 5 5 5 5-5zM2 3l7 7-7 7z"/>',
  previousKey: '<path fill="white" stroke="none" d="M13 4 6 10l7 6Z"/>',
  nextKey: '<path fill="white" stroke="none" d="m7 4 7 6-7 6Z"/>',
  back: '<path fill="white" stroke="none" d="M3 3h2v14H3zM16 3l-9 7 9 7z"/>',
  forward: '<path fill="white" stroke="none" d="M15 3h2v14h-2zM4 3l9 7-9 7z"/>',
  loop: '<path d="M16 7H6a3 3 0 0 0 0 6h2M4 13h10a3 3 0 0 0 0-6h-2M13 4l3 3-3 3M7 10l-3 3 3 3"/>',
  key: '<path d="m10 2 7 8-7 8-7-8z"/><path d="M7 10h6M10 7v6"/>',
  auto: '<path fill="white" stroke="none" fill-rule="evenodd" d="m10 1 9 9-9 9-9-9ZM10 5a2.5 2.5 0 0 0-1 4.8V14h2V9.8A2.5 2.5 0 0 0 10 5Z"/>',
  snap: '<path fill="white" stroke="none" d="M2 11V9a8 8 0 0 1 16 0v2h-4V9a4 4 0 0 0-8 0v2ZM2 12h4v6H2ZM14 12h4v6h-4Z"/>',
  curve: '<path d="M3 3v14h14M4 14c5 0 4-9 9-9h3"/><path d="M12.5 3.5h3v3h-3zM3 12.5h3v3H3z"/>',
  cube: '<path fill="white" stroke="none" d="m10 1 8 4.5-8 4.5-8-4.5ZM2 7l7 4v8l-7-4Zm9 4 7-4v8l-7 4Z"/>',
  transform: '<path d="M10 2v16M2 10h16M10 2 7 5m3-3 3 3m5 5-3-3m3 3-3 3m-5 5-3-3m3 3 3-3M2 10l3-3m-3 3 3 3"/>',
  opacity: '<circle cx="10" cy="10" r="7"/><path fill="white" stroke="none" d="M10 3a7 7 0 0 0 0 14Z"/>',
  folder: '<path fill="white" stroke="none" d="M2 4h6l2 2h8v2H5l-3 9Zm4 5h13l-3 8H3Z"/>',
  hidden: '<path fill="white" stroke="none" fill-rule="evenodd" d="M1 10C5 3 15 3 19 10 15 17 5 17 1 10Zm9-4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M3 2 17 18" stroke-width="2"/>',
  lock: '<rect x="4" y="9" width="12" height="9" rx="1.5"/><path d="M6.5 9V6a3.5 3.5 0 0 1 7 0v3"/>',
  plus: '<path d="M10 4v12M4 10h12"/>',
  fit: '<path d="M7 3H3v4M13 3h4v4M3 13v4h4M17 13v4h-4M6 14l8-8"/>',
  linear: '<path d="m4 16 12-12"/><rect x="2" y="14" width="4" height="4" fill="white" stroke="none"/><rect x="14" y="2" width="4" height="4" fill="white" stroke="none"/>',
  constant: '<path d="M3 15h8V5h6"/><rect x="1" y="13" width="4" height="4" fill="white" stroke="none"/><rect x="15" y="3" width="4" height="4" fill="white" stroke="none"/>',
  tangentAuto: '<path d="M2 15c5 0 4-10 9-10h7M6 5h10"/><path fill="white" stroke="none" d="m11 2 3 3-3 3-3-3z"/>',
  tangentUser: '<path d="M2 16C8 16 6 5 12 5h6M4 11l12-8"/><path fill="white" stroke="none" d="m10 3 3 3-3 3-3-3z"/>',
  tangentBreak: '<path d="M2 15c5 0 3-8 8-8s4 9 8 9M3 4l7 3 6-5"/><path fill="white" stroke="none" d="m10 4 3 3-3 3-3-3z"/>',
  flatten: '<path d="M2 10h16M3 16l5-6m4 0 5 6"/><path fill="white" stroke="none" d="m10 7 3 3-3 3-3-3z"/>',
  undo: '<path d="M7 4 3 8l4 4M3 8h8a5 5 0 0 1 5 5v3"/>',
  redo: '<path d="m13 4 4 4-4 4M17 8H9a5 5 0 0 0-5 5v3"/>',
};

export type SequenceIcon = keyof typeof paths | 'chevron';
const names = Object.keys(paths) as (keyof typeof paths)[];
const columns = 8;
const rows = Math.ceil(names.length / columns);
let atlas: WebGLTexture | null = null;
let loading = false;

export function drawSequenceIcon (name: SequenceIcon, x: number, y: number, size: number, tint: ImGui.Vec4): void {
  if (name === 'chevron') {
    drawEditorChevron(x, y, size, tint);

    return;
  }
  const gl = ImGui_Impl.gl;

  if (!gl) { return; }
  if (!atlas && !loading) {
    loading = true;
    const source = names.map((key, index) => `<g transform="translate(${index % columns * 20},${Math.floor(index / columns) * 20})">${paths[key]}</g>`).join('');
    const image = new Image();

    image.onload = () => {
      atlas = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.bindTexture(gl.TEXTURE_2D, null);
    };
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${columns * 64}" height="${rows * 64}" viewBox="0 0 ${columns * 20} ${rows * 20}" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${source}</svg>`);
  }
  if (!atlas) { return; }
  const index = names.indexOf(name), column = index % columns, row = Math.floor(index / columns);

  ImGui.GetWindowDrawList().AddImage(atlas, new ImGui.Vec2(Math.round(x), Math.round(y)), new ImGui.Vec2(Math.round(x) + size, Math.round(y) + size),
    new ImGui.Vec2(column / columns, row / rows), new ImGui.Vec2((column + 1) / columns, (row + 1) / rows), ImGui.GetColorU32(tint));
}
