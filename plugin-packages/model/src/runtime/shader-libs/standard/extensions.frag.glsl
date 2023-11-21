vec3 _dFdx(vec3 coord)
{
#if defined(GL_OES_standard_derivatives) || defined(WEBGL2)
    return dFdx(coord);
#endif
    return vec3(0.0);
}

vec3 _dFdy(vec3 coord)
{
#if defined(GL_OES_standard_derivatives) || defined(WEBGL2)
    return dFdy(coord);
#endif
    return vec3(0.0);
}

#ifdef USE_TEX_LOD
vec4 _textureCubeLodEXT(samplerCube sampler, vec3 coord, float lod)
{
#if defined(WEBGL2) || defined(GL_EXT_shader_texture_lod)
    return textureCubeLodEXT(sampler, coord, lod);
#else
    return textureCube(sampler, coord, lod);
#endif
}
#endif