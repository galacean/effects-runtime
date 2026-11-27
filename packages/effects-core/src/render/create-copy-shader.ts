export const EFFECTS_COPY_MESH_NAME = 'effects-internal-copy';
export const COPY_MESH_SHADER_ID = 'effects-internal-copy-mesh';

export const COPY_VERTEX_SHADER = `
precision highp float;
attribute vec2 aPos;
varying highp vec2 vTex;
void main(){
    gl_Position = vec4(aPos,0.,1.0);
    vTex = (aPos + vec2(1.0))/2.;
}`;

export const COPY_FRAGMENT_SHADER = `
#ifdef DEPTH_TEXTURE
#extension GL_EXT_frag_depth : require
#endif

precision highp float;
varying highp vec2 vTex;

#ifdef DEPTH_TEXTURE
uniform highp sampler2D _MainTex;
uniform highp float uDepthBias;
#endif
void main(){
    #ifdef DEPTH_TEXTURE
    gl_FragDepthEXT = clamp(texture2D(_MainTex,vTex).r + uDepthBias, 0.0, 1.0);
    #endif
}
`;
