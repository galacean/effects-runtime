/** Vertex input description. Slot indexes the buffers supplied when drawing. */
export interface VertexElement {
  readonly name: string,
  readonly slot: number,
  readonly type: number,
  readonly size: number,
  readonly byteOffset: number,
  readonly normalized: boolean,
  readonly divisor: number,
}
