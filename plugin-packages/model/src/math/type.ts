/**
 * 二维向量内部数据类型
 */
type Vec2DataType = number[] | [number, number] | Float32Array;

/**
* 三维向量内部数据类型
*/
type Vec3DataType = number[] | [number, number, number] | Float32Array;

/**
* 四维向量内部数据类型
*/
type Vec4DataType = number[] | [number, number, number, number] | Float32Array;

/**
* 二维矩阵内部数据类型
*/
type Mat2DataType = number[] | [number, number, number, number] | Float32Array;

/**
* 三维矩阵内部数据类型
*/
type Mat3DataType = number[] | [number, number, number, number, number, number, number, number, number] | Float32Array;

/**
* 四维矩阵内部数据类型
*/
type Mat4DataType = number[] | [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] | Float32Array;

/**
 * 四元数内部数据类型
 */
type QuatDataType = number[] | [number, number, number, number] | Float32Array;

export {
  Vec2DataType, Vec3DataType, Vec4DataType, Mat2DataType, Mat3DataType, Mat4DataType, QuatDataType,
};
