// Shared bit layout for path stacks and track-matte composition.
export const MaskStencil = {
  Path: 0b0001,
  Scratch: 0b0010,
  Target: 0b0100,
  Source: 0b1000,
  All: 0xFF,
} as const;
