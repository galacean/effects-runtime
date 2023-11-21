declare module 'string-hash';

declare module 'earcut' {
  export interface Node {
    public i: number;
    public x: number;
    public y: number;
    public z: number;

    public steiner: boolean;
    public prevZ: Node | null;
    public nextZ: Node | null;
    public prev: Node;
    public next: Node;
  }

  export function linkedList (data: number[], start: number, end: number, dim: number, clockwise: boolean): Node | undefined { }
  export function equals (p1: Node, p2: Node): boolean { }
  export function intersects (p1: Node, q1: Node, p2: Node, q2: Node): boolean { }
  export function locallyInside (a: Node, b: Node): boolean { }
  export function removeNode (p: Node) { }
  export function filterPoints (start: Node, end?: Node): Node { }
  export function indexCurve (start: Node, minX: number, minY: number, invSize: number) { }
  export function isEarHashed (ear: Node, minX: number, minY: number, invSize: number): boolean { }
  export function eliminateHoles (data: number[], holeIndices: number[], outerNode: Node, dim: number): Node { }
  export function splitPolygon (a: Node, b: Node): Node { }
  export function isValidDiagonal (a: Node, b: Node): number | boolean { }
  export function isEar (ear: Node): boolean { }
};
