import type { ProVariable } from '../types/variable';

/**
 * 一个变量在 DataBuffer 内的位置信息。
 *
 * floatComponentStart / int32ComponentStart 是它在两条 SoA 通道上
 * 的起始 component index（不是字节偏移）。具体到某粒子的偏移还要
 * 乘以 buffer 的 stride（即 allocated instance count）。
 */
export interface ProVariableLayout {
  variable: ProVariable,
  floatComponentStart: number,
  int32ComponentStart: number,
}

/**
 * 描述一个 DataSet 的整体布局：哪些变量、每个变量在 SoA 缓冲中的位置、
 * 各通道总共占多少个 component。
 *
 * 一旦构造完成就视为只读，DataSet/DataBuffer 据此分配内存。
 */
export class ProDataSetLayout {
  readonly variables: ReadonlyArray<ProVariable>;
  readonly variableLayouts: ReadonlyArray<ProVariableLayout>;
  readonly totalFloatComponents: number;
  readonly totalInt32Components: number;

  private nameToLayout: Map<string, ProVariableLayout>;

  constructor (variables: ProVariable[]) {
    let floatCursor = 0;
    let int32Cursor = 0;
    const layouts: ProVariableLayout[] = [];
    const nameToLayout = new Map<string, ProVariableLayout>();

    for (const variable of variables) {
      const layout: ProVariableLayout = {
        variable,
        floatComponentStart: floatCursor,
        int32ComponentStart: int32Cursor,
      };

      floatCursor += variable.type.floatComponents;
      int32Cursor += variable.type.int32Components;
      layouts.push(layout);
      nameToLayout.set(variable.name, layout);
    }

    this.variables = variables;
    this.variableLayouts = layouts;
    this.totalFloatComponents = floatCursor;
    this.totalInt32Components = int32Cursor;
    this.nameToLayout = nameToLayout;
  }

  getLayout (name: string): ProVariableLayout | undefined {
    return this.nameToLayout.get(name);
  }

  hasVariable (name: string): boolean {
    return this.nameToLayout.has(name);
  }
}
