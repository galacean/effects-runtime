import type { Disposable, UniformValue, spec } from '@galacean/effects-core';
import { glContext } from '@galacean/effects-core';
import stringHash from 'string-hash';
import { GLGPUBuffer } from './gl-gpu-buffer';
import type { GLPipelineContext } from './gl-pipeline-context';

type TypedArrayCtrl =
  | Float32ArrayConstructor
  | Int8ArrayConstructor
  | Int32ArrayConstructor
  | Int16ArrayConstructor
  | Uint32ArrayConstructor
  | Uint16ArrayConstructor
  | Uint8ArrayConstructor;

type BlockUniformInfo = [
  type: number,
  offset: number,
  size: number,
  blockIndex: number,
  arrayStride: number,
  maxStride: number,
  rowMajor: number,
  index: number,
  byteLength: number,
];

export interface UniformBlockSpec {
  index: number,
  usedByVertexShader: boolean,
  usedByFragmentShader: boolean,
  size: number,
  uniformIndices: number[],
  used: boolean,
  name: string,
  uniforms: Record<string, BlockUniformInfo>,
  id: string,
}

const BlockUniformInfoOffset = 1;
const BlockUniformInfoByteLength = 8;
const BlockUniformInfoType = 0;
const BlockUniformInfoArrayStride = 4;
const BlockUniformInfoArraySize = 2;
const BlockUniformInfoRowStride = 5;
const fullRange = [0, 0];

const ItemPerValueMap: Record<number, number> = {
  [glContext.FLOAT]: 1,
  [glContext.INT]: 1,
  [glContext.UNSIGNED_INT]: 1,
  [glContext.SHORT]: 1,
  [glContext.BOOL]: 1,
  [glContext.UNSIGNED_SHORT]: 1,
  [glContext.FLOAT_VEC2]: 2,
  [glContext.FLOAT_VEC3]: 3,
  [glContext.FLOAT_VEC4]: 4,
  [glContext.FLOAT_MAT2]: 4,
  [glContext.FLOAT_MAT3]: 9,
  [glContext.FLOAT_MAT4]: 16,
  [glContext.FLOAT_MAT2x3]: 6,
  [glContext.FLOAT_MAT2x4]: 8,
  [glContext.FLOAT_MAT4x3]: 12,
  [glContext.FLOAT_MAT4x2]: 8,
  [glContext.FLOAT_MAT3x4]: 12,
  [glContext.FLOAT_MAT3x2]: 6,
  [glContext.INT_VEC2]: 2,
  [glContext.INT_VEC3]: 3,
  [glContext.INT_VEC4]: 4,
  [glContext.UNSIGNED_INT_VEC2]: 2,
  [glContext.UNSIGNED_INT_VEC3]: 3,
  [glContext.UNSIGNED_INT_VEC4]: 4,
  [glContext.BOOL_VEC2]: 2,
  [glContext.BOOL_VEC3]: 3,
  [glContext.BOOL_VEC4]: 4,
};
const setFloat32Array = arraySetter(Float32Array);
const setInt32Array = arraySetter(Int32Array);
const setUInt8Array = arraySetter(Uint8Array);

const memorySetter: Record<string, (value: any, info: BlockUniformInfo, name: string, range: spec.vec2) => UBODirtyFlag> = {
  [glContext.FLOAT]: numberSetter(Float32Array),
  [glContext.INT]: numberSetter(Int32Array),
  [glContext.UNSIGNED_INT]: numberSetter(Uint32Array),
  [glContext.SHORT]: numberSetter(Int16Array),
  [glContext.BOOL]: numberSetter(Uint8Array),
  [glContext.UNSIGNED_SHORT]: numberSetter(Uint16Array),
  [glContext.FLOAT_VEC2]: setFloat32Array,
  [glContext.FLOAT_VEC3]: setFloat32Array,
  [glContext.FLOAT_VEC4]: setFloat32Array,
  [glContext.FLOAT_MAT2]: setFloat32Array,
  [glContext.FLOAT_MAT3]: setFloat32Array,
  [glContext.FLOAT_MAT4]: setFloat32Array,
  [glContext.FLOAT_MAT2x3]: setFloat32Array,
  [glContext.FLOAT_MAT2x4]: setFloat32Array,
  [glContext.FLOAT_MAT4x3]: setFloat32Array,
  [glContext.FLOAT_MAT4x2]: setFloat32Array,
  [glContext.FLOAT_MAT3x4]: setFloat32Array,
  [glContext.FLOAT_MAT3x2]: setFloat32Array,
  [glContext.INT_VEC2]: setInt32Array,
  [glContext.INT_VEC3]: setInt32Array,
  [glContext.INT_VEC4]: setInt32Array,
  [glContext.UNSIGNED_INT_VEC2]: setInt32Array,
  [glContext.UNSIGNED_INT_VEC3]: setInt32Array,
  [glContext.UNSIGNED_INT_VEC4]: setInt32Array,
  [glContext.BOOL_VEC2]: setUInt8Array,
  [glContext.BOOL_VEC3]: setUInt8Array,
  [glContext.BOOL_VEC4]: setUInt8Array,
};

interface UBODirtyFlag {
  start: number,
  dirty: boolean,
  buffer?: spec.TypedArray,
}

export class UniformBlockBuffer implements Disposable {
  buffer?: GLGPUBuffer;
  dirtyFlags: Record<string, UBODirtyFlag>;
  keepData: boolean;//for debug use

  constructor (
    pipelineContext: GLPipelineContext,
    private readonly info: UniformBlockSpec,
  ) {
    this.buffer = new GLGPUBuffer(pipelineContext, {
      target: glContext.UNIFORM_BUFFER,
      name: info.name,
      type: glContext.BYTE,
      elementCount: info.size,
    });
    this.dirtyFlags = {};
  }

  setValues (
    uniformValues: Record<string, UniformValue>,
    dirtyFlags: Record<string, boolean>,
    uniformValueOffsets: Record<string, spec.vec2>,
  ): void {
    Object.keys(uniformValues).forEach(name => {
      const value = uniformValues[name];
      const uniformInfo: BlockUniformInfo = this.info.uniforms[name];

      if (uniformInfo && dirtyFlags[name]) {
        const range = uniformValueOffsets[name] || fullRange;
        const setter = memorySetter[uniformInfo[BlockUniformInfoType]]!;

        this.dirtyFlags[name] = setter(value, uniformInfo, name, range);
      }
    });
  }

  bind (gl: WebGL2RenderingContext, program: WebGLProgram, bufferBindIndex: number) {
    const buffer = this.buffer;

    if (buffer) {
      buffer.bind();
      Object.values(this.dirtyFlags).forEach(flag => {
        if (flag.dirty) {
          // @ts-expect-error
          buffer.bufferSubData(flag.start, new Uint8Array(flag.buffer.buffer));
          if (!this.keepData) {
            delete flag.buffer;
          }
          flag.dirty = false;
        }
      });
      gl.uniformBlockBinding(program, bufferBindIndex, bufferBindIndex);
      gl.bindBufferRange(gl.UNIFORM_BUFFER, bufferBindIndex, buffer.glBuffer, 0, this.info.size);
    }

  }

  dispose () {
    if (this.buffer) {
      this.buffer.dispose();
      this.buffer = undefined;
    }
  }
}

function numberSetter (typedArray: TypedArrayCtrl) {
  return (
    value: number | number[],
    info: BlockUniformInfo,
    name: string,
    range: spec.vec2,
  ): UBODirtyFlag => {
    const flag: UBODirtyFlag = {
      start: info[BlockUniformInfoOffset],
      dirty: true,
    };
    const arrSize = info[BlockUniformInfoArraySize];

    if (arrSize > 1) {
      const values = value as number[];

      if (values.length) {
        const eleCount = range[1] || values.length;
        const vecLen = info[BlockUniformInfoArrayStride] / typedArray.BYTES_PER_ELEMENT;
        const buffer = flag.buffer = new typedArray(eleCount * vecLen);
        const start = range[0] || 0;

        for (let i = 0; i < eleCount; i++) {
          buffer[i * vecLen] = values[i + start];
        }
        flag.start += start * vecLen;
      }
    } else {
      flag.buffer = new typedArray([value] as number[]);
    }

    return flag;
  };
}

function arraySetter (type: TypedArrayCtrl) {
  return (
    value: number[],
    info: BlockUniformInfo,
    name: string,
    range: spec.vec2,
  ): UBODirtyFlag => {
    const blockByteLen = info[BlockUniformInfoByteLength];
    const arrSize = info[BlockUniformInfoArraySize];
    const rowStride = info[BlockUniformInfoRowStride];
    const entryStride = arrSize === 1 ? blockByteLen : info[BlockUniformInfoArrayStride];
    const entryRowCount = rowStride ? entryStride / rowStride : 1;
    const rowNumPadding = entryStride / type.BYTES_PER_ELEMENT / entryRowCount;
    const maxRowCount = blockByteLen / type.BYTES_PER_ELEMENT / rowNumPadding;
    //set array
    const numPerEntry = ItemPerValueMap[info[BlockUniformInfoType]];
    const numPerRow = numPerEntry / entryRowCount;
    const valueStartIndex = (range[0] || 0) * numPerEntry;
    const totalRow = range[1] ? entryRowCount * range[1] : maxRowCount;
    const buffer = new type(rowNumPadding * totalRow);
    const flag: UBODirtyFlag = {
      start: info[BlockUniformInfoOffset] + entryStride * (range[0] || 0),
      dirty: true,
      buffer,
    };

    for (let i = 0, bufferTarget = 0, sourceIndex = valueStartIndex; i < totalRow; i++) {
      for (let j = 0; j < numPerRow; j++) {
        buffer[bufferTarget + j] = value[sourceIndex + j];
      }
      bufferTarget += rowNumPadding;
      sourceIndex += numPerRow;
    }

    return flag;
  };
}

// TODO: 函数名重定义
export function createUniformBlockDataFromProgram (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): { blockSpecs: UniformBlockSpec[], blockUniformNames: string[] } {
  const blockSpecs: UniformBlockSpec[] = [];
  const blockUniformNames: string[] = [];
  const uniformBlocks = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS);

  for (let idx = 0; idx < uniformBlocks; ++idx) {
    const name = gl.getActiveUniformBlockName(program, idx)!;
    const blockSpec: UniformBlockSpec = {
      index: gl.getUniformBlockIndex(program, name),
      usedByVertexShader: gl.getActiveUniformBlockParameter(program, idx, gl.UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER),
      usedByFragmentShader: gl.getActiveUniformBlockParameter(program, idx, gl.UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER),
      size: gl.getActiveUniformBlockParameter(program, idx, gl.UNIFORM_BLOCK_DATA_SIZE),
      uniformIndices: gl.getActiveUniformBlockParameter(program, idx, gl.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES),
      used: false,
      uniforms: {},
      name,
      id: '',
    };

    blockSpec.used = blockSpec.usedByVertexShader || blockSpec.usedByFragmentShader;
    blockSpecs[idx] = blockSpec;

    const indices = blockSpec.uniformIndices;
    const uniformNames: string[] = [];

    for (let i = 0; i < indices.length; i++) {
      const name = gl.getActiveUniform(program, indices[i])!.name.replace('[0]', '');

      blockSpec.uniforms[name] = [0, 0, 0, 0, 0, 0, 0, i, 0];
      uniformNames[i] = name;
      blockUniformNames.push(name);
    }
    [
      gl.UNIFORM_TYPE,
      gl.UNIFORM_OFFSET,
      gl.UNIFORM_SIZE,
      gl.UNIFORM_BLOCK_INDEX,
      gl.UNIFORM_ARRAY_STRIDE,
      gl.UNIFORM_MATRIX_STRIDE,
      gl.UNIFORM_IS_ROW_MAJOR,
    ].forEach((param, pi) => {
      gl.getActiveUniforms(program, indices, param)
        .forEach((value: number, idx: number) => {
          const name = uniformNames[idx];

          blockSpec.uniforms[name][pi] = +value;
        });
    });
    for (let i = 0; i < uniformNames.length; i++) {
      const uniform = blockSpec.uniforms[uniformNames[i]];
      const nextUniform = blockSpec.uniforms[uniformNames[i + 1]];
      const size = nextUniform ? nextUniform[1] : blockSpec.size;

      uniform[8] = size - uniform[1];
    }
    blockSpec.id = getUboHash(blockSpec) + '';
  }

  return { blockSpecs, blockUniformNames };
}

function getUboHash (spec: UniformBlockSpec) {
  const { name, size, uniforms, uniformIndices } = spec;
  const ret = Object.keys(uniforms)
    .map(name => `${name}[${uniforms[name].join(':')}]`)
    .join('+');

  return stringHash(`${name}+`, `${size}+`, `${uniformIndices.length}+`, ret);
}
