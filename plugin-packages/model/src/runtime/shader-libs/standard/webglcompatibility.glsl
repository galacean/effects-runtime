#ifdef WEBGL2
    #define vsIn in
    #define vsOut out
    #define fsIn in
    #define fsOut out
    #define texture2D texture
    #define textureCube texture
    #define textureCubeLodEXT textureLod
#else
    #define vsIn attribute
    #define vsOut varying
    #define fsIn varying
    #define fsOut varying
#endif