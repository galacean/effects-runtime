import { decodeText } from './texture-transcoder';

export class BufferReader {
  private dataView: DataView;
  private littleEndian: boolean;
  private pos: number;
  private baseOffset: number;

  constructor (
    public data: Uint8Array,
    byteOffset = 0,
    byteLength?: number,
    littleEndian = true,
  ) {
    this.dataView = new DataView(
      data.buffer,
      data.byteOffset + byteOffset,
      byteLength ?? data.byteLength - byteOffset,
    );
    this.littleEndian = littleEndian;
    this.pos = 0;
    this.baseOffset = byteOffset;
  }

  get position () {
    return this.pos;
  }

  get offset () {
    return this.pos + this.baseOffset;
  }

  nextUint8 () {
    const value = this.dataView.getUint8(this.pos);

    this.pos += 1;

    return value;
  }

  nextUint16 () {
    const value = this.dataView.getUint16(this.pos, this.littleEndian);

    this.pos += 2;

    return value;
  }

  nextUint32 () {
    const value = this.dataView.getUint32(this.pos, this.littleEndian);

    this.pos += 4;

    return value;
  }

  nextInt32 () {
    const value = this.dataView.getInt32(this.pos, this.littleEndian);

    this.pos += 4;

    return value;
  }

  nextInt32Array (len: number) {
    const value = new Int32Array(this.data.buffer, this.pos + this.dataView.byteOffset, len);

    this.pos += 4 * len;

    return value;
  }

  nextFloat32 () {
    const value = this.dataView.getFloat32(this.pos, this.littleEndian);

    this.pos += 4;

    return value;
  }

  nextFloat32Array (len: number) {
    const value = new Float32Array(this.data.buffer, this.pos + this.dataView.byteOffset, len);

    this.pos += 4 * len;

    return value;
  }

  nextUint32Array (len: number) {
    const value = new Uint32Array(this.data.buffer, this.pos + this.dataView.byteOffset, len);

    this.pos += 4 * len;

    return value;
  }

  nextUint8Array (len: number) {
    const value = new Uint8Array(this.data.buffer, this.pos + this.dataView.byteOffset, len);

    this.pos += len;

    return value;
  }

  nextUint64 () {
    const left = this.dataView.getUint32(this.pos, this.littleEndian);
    const right = this.dataView.getUint32(this.pos + 4, this.littleEndian);
    const value = left + 2 ** 32 * right;

    this.pos += 8;

    return value;
  }

  nextStr (): string {
    const strByteLength = this.nextUint16();
    const uint8Array = new Uint8Array(this.data.buffer, this.pos + this.dataView.byteOffset, strByteLength);

    this.pos += strByteLength;

    return decodeText(uint8Array);
  }

  skip (bytes: number) {
    this.pos += bytes;

    return this;
  }

  scan (maxByteLength: number, term: number = 0x00): Uint8Array {
    const byteOffset = this.pos;
    let byteLength = 0;

    while (this.dataView.getUint8(this.pos) !== term && byteLength < maxByteLength) {
      byteLength++;
      this.pos++;
    }

    if (byteLength < maxByteLength) { this.pos++; }

    return new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + byteOffset, byteLength);
  }
}
