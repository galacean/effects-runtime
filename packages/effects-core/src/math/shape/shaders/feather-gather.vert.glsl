precision highp float;

attribute vec2 aPos;  // 这是在几何空间的box。

varying vec2 vGeometry;

uniform mat4 uProjection; 

void main() {
    vGeometry = aPos;
    gl_Position = uProjection * vec4(aPos, 0.0, 1.0);
}