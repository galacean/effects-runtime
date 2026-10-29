import { contentLibrary } from '../../core/content-library/content-library';
import { ImGui_Impl } from '../../imgui';

interface ImagePreview { texture: WebGLTexture, width: number, height: number }

export class ContentThumbnails {
  private images = new Map<string, ImagePreview>();
  private loading = new Set<string>();
  private generation = 0;

  get (id: string, full = false): ImagePreview | undefined {
    const key = id + (full ? ':full' : ':thumbnail');
    const cached = this.images.get(key);

    if (cached || this.loading.has(key)) { return cached; }
    this.loading.add(key);
    const generation = this.generation;

    void contentLibrary.storage.image(id).then(async source => {
      if (!source) { return; }
      const url = URL.createObjectURL(full ? source.blob : source.thumbnail);

      try {
        const image = new Image();

        image.src = url; await image.decode();
        const gl = ImGui_Impl.gl;

        if (!gl || generation !== this.generation) { return; }
        const texture = gl.createTexture();

        if (!texture) { return; }
        const previous = gl.getParameter(gl.TEXTURE_BINDING_2D), alignment = gl.getParameter(gl.UNPACK_ALIGNMENT);
        const flipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), premultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);

        gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.bindTexture(gl.TEXTURE_2D, previous); gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
        this.images.set(key, { texture, width: image.naturalWidth, height: image.naturalHeight });
      } finally { URL.revokeObjectURL(url); }
    }).catch(error => { if (generation === this.generation) { contentLibrary.report(error); } });

    return undefined;
  }

  clear (): void {
    this.generation++;
    for (const image of this.images.values()) { ImGui_Impl.gl?.deleteTexture(image.texture); }
    this.images.clear(); this.loading.clear();
  }
}
