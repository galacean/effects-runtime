// 路径蒙版与轨道遮罩组合运算共用的 stencil 位分配。
export const MaskStencil = {
  Path: 0b0001,
  Scratch: 0b0010,
  Target: 0b0100,
  Source: 0b1000,
  All: 0xFF,
} as const;
