/**
 * 变量值类型枚举。
 *
 * 与 Niagara 的 FNiagaraTypeDefinition 对应，但只保留 CPU 模拟必要的内置类型。
 */
export enum ProVariableKind {
  Float = 'float',
  Int32 = 'int32',
  Bool = 'bool',
  Vec2 = 'vec2',
  Vec3 = 'vec3',
  Vec4 = 'vec4',
  Quat = 'quat',
  Color = 'color',
  Position = 'position',
}

/**
 * 一种变量类型的结构描述：占多少个 float / int32 component，对齐与字节数。
 *
 * 用于驱动 DataBuffer 的 SoA 布局计算。
 */
export interface ProVariableType {
  readonly kind: ProVariableKind,
  readonly floatComponents: number,
  readonly int32Components: number,
  readonly sizeBytes: number,
  readonly alignment: number,
}

function floatType (kind: ProVariableKind, components: number): ProVariableType {
  return {
    kind,
    floatComponents: components,
    int32Components: 0,
    sizeBytes: components * 4,
    alignment: 4,
  };
}

function intType (kind: ProVariableKind, components: number): ProVariableType {
  return {
    kind,
    floatComponents: 0,
    int32Components: components,
    sizeBytes: components * 4,
    alignment: 4,
  };
}

/**
 * 内置变量类型常量表。新增类型需同时更新 ProVariableKind 与此表。
 */
export const ProVariableTypes = {
  Float: floatType(ProVariableKind.Float, 1),
  Int32: intType(ProVariableKind.Int32, 1),
  Bool: intType(ProVariableKind.Bool, 1),
  Vec2: floatType(ProVariableKind.Vec2, 2),
  Vec3: floatType(ProVariableKind.Vec3, 3),
  Vec4: floatType(ProVariableKind.Vec4, 4),
  Quat: floatType(ProVariableKind.Quat, 4),
  Color: floatType(ProVariableKind.Color, 4),
  Position: floatType(ProVariableKind.Position, 3),
} as const satisfies Record<string, ProVariableType>;

/**
 * 一个被命名的变量：name 唯一标识，type 决定布局。
 *
 * 不直接持有值，值由 ParameterStore 或 DataBuffer 存储。
 */
export interface ProVariable {
  readonly name: string,
  readonly type: ProVariableType,
}

export function createProVariable (name: string, type: ProVariableType): ProVariable {
  return { name, type };
}
