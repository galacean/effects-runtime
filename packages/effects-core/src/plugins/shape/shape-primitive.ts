export abstract class ShapePrimitive {

  /** Checks whether the x and y coordinates passed to this function are contained within this ShapePrimitive. */
  abstract contains (x: number, y: number): boolean;
  /** Checks whether the x and y coordinates passed to this function are contained within the stroke of this shape */
  //   abstract strokeContains (x: number, y: number, strokeWidth: number): boolean;
  /** Creates a clone of this ShapePrimitive instance. */
  abstract clone (): ShapePrimitive;
  /** Copies the properties from another ShapePrimitive to this ShapePrimitive. */
  abstract copyFrom (source: ShapePrimitive): void;
  /** Copies the properties from this ShapePrimitive to another ShapePrimitive. */
  abstract copyTo (destination: ShapePrimitive): void;
  /** Returns the framing rectangle of the ShapePrimitive as a Rectangle object. */
  //   getBounds(out?: Rectangle): Rectangle,

  /** The X coordinate of the shape */
  abstract getX (): number;
  /** The Y coordinate of the shape */
  abstract getY (): number;

  abstract build (points: number[]): void;

  abstract triangulate (points: number[], vertices: number[], verticesOffset: number, indices: number[], indicesOffset: number): void;
}
