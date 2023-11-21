// #ifdef WEBGL2
// layout(std140) uniform uMainBlock {
//   uniform mat4 uMainData[MAX_ITEM_COUNT];
// };
// layout(std140) uniform uTexBlock {
//   uniform vec4 uTexParams[MAX_ITEM_COUNT];//transparentOcclusion blending renderMode
//   uniform vec4 uTexOffset[MAX_ITEM_COUNT];// x y sx sy
// };
// #else
uniform mat4 uMainData[MAX_ITEM_COUNT];
uniform vec4 uTexParams[MAX_ITEM_COUNT];//transparentOcclusion blending renderMode
uniform vec4 uTexOffset[MAX_ITEM_COUNT];// x y sx sy
//pos v4 xyz
//size v4 width height life
//quat v4
//color v4
//#endif
