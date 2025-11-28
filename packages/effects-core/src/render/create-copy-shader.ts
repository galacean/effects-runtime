export const EFFECTS_COPY_MESH_NAME = 'effects-internal-copy';
export const COPY_MESH_SHADER_ID = 'effects-internal-copy-mesh';

export const COPY_VERTEX_SHADER = `
precision highp float;
attribute vec2 aPos;
varying vec2 vTex;
void main(){
    gl_Position = vec4(aPos,0.,1.0);
    vTex = (aPos + vec2(1.0))/2.;
}`;

export const COPY_FRAGMENT_SHADER = `precision mediump float;
varying vec2 vTex;

#ifdef DEPTH_TEXTURE
uniform sampler2D uDepth;
#extension GL_EXT_frag_depth : enable
#endif
void main(){
    #ifdef DEPTH_TEXTURE
    gl_FragDepthEXT = texture2D(uDepth,vTex).r;
    #endif
}
`;