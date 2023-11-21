precision highp float;

attribute vec2 aPos;
varying vec2 uv;

void main(){
    gl_Position = vec4(aPos,0.,1.0);
    uv = (aPos + vec2(1.0))/2.;
}