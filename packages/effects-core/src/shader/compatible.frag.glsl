#version 300 es
#ifdef WEBGL2
#define texture2D texture
#define textureCube texture
#define textureCubeLodEXT textureLod
layout(location = 0) out vec4 fragColor;
#else
#define fragColor gl_FragColor
#endif
