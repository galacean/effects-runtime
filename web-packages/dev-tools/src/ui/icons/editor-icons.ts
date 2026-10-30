import { ImGui, ImGuiBackend } from '../../platform/imgui/index';
import { EDITOR_ICON_PATHS } from './editor-icon-paths';

export type EditorIcon = keyof typeof EDITOR_ICON_PATHS;
const names = Object.keys(EDITOR_ICON_PATHS) as EditorIcon[];
const columns = 8;
const cellSize = 24;
const iconSize = 20;
const rasterScale = 8;
const gutter = (cellSize - iconSize) / 2;
const rows = Math.ceil(names.length / columns);
let atlas: WebGLTexture | null = null;
let pending: Promise<void> | undefined;
let generation = 0;

export function clearEditorIcons (): void {
  generation++; pending = undefined;
  if (atlas) { ImGuiBackend.gl?.deleteTexture(atlas); atlas = null; }
}

export function loadEditorIcons (): Promise<void> {
  const gl = ImGuiBackend.gl;

  if (!gl || atlas) { return Promise.resolve(); }
  pending ??= new Promise<void>((resolve, reject) => {
    const requestedGeneration = generation;
    const source = names.map((key, index) => `<g transform="translate(${index % columns * cellSize + gutter},${Math.floor(index / columns) * cellSize + gutter})">${EDITOR_ICON_PATHS[key]}</g>`).join('');
    const image = new Image();

    image.onload = () => {
      if (requestedGeneration !== generation || gl.isContextLost()) {
        resolve();

        return;
      }
      const previous = gl.getParameter(gl.TEXTURE_BINDING_2D), flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), premultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);

      atlas = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.bindTexture(gl.TEXTURE_2D, previous); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply); resolve();
    };
    image.onerror = () => reject(new Error('Unable to load editor icons.'));
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${columns * cellSize * rasterScale}" height="${rows * cellSize * rasterScale}" viewBox="0 0 ${columns * cellSize} ${rows * cellSize}" fill="none">${source}</svg>`);
  });

  return pending;
}

export function drawEditorIcon (name: EditorIcon, x: number, y: number, size: number, tint: ImGui.Vec4, target = ImGui.GetWindowDrawList()): void {
  if (!atlas) {
    void loadEditorIcons().catch(console.error);

    return;
  }
  const index = names.indexOf(name), column = index % columns, row = Math.floor(index / columns);

  target.AddImage(atlas, new ImGui.Vec2(Math.round(x), Math.round(y)), new ImGui.Vec2(Math.round(x) + size, Math.round(y) + size),
    new ImGui.Vec2((column * cellSize + gutter) / (columns * cellSize), (row * cellSize + gutter) / (rows * cellSize)),
    new ImGui.Vec2((column * cellSize + gutter + iconSize) / (columns * cellSize), (row * cellSize + gutter + iconSize) / (rows * cellSize)), ImGui.GetColorU32(tint));
}
