precision highp float;
precision highp int;

varying vec2 vGeometry;  // 几何空间坐标。和uEdgeTexture在同一个空间。

uniform float uRadius;
uniform int uMeshStart;  // [start, end)
uniform int uMeshEnd;
uniform int uEdgeTextureWidth;
uniform sampler2D uEdgeTexture;

const float PI_4 = 0.7853981633;
const float PI_3 = 1.0471975512;
const float PI = 3.14159265359;
const float _2PI = 6.28318530718;
const int MAX_LOAD_EDGES_PER_MESH = 520;  // 比scatter-edge-simplifier中限制稍大一些的值。

vec4 getPackedCoord(int index)
{
    float u = (float(index) + 0.5) / float(uEdgeTextureWidth);
    return texture2D(uEdgeTexture, vec2(u, 0.5));
}   

float gatherFeather(vec2 coord)
{
    float winding = 0.0;  
    float feather = 0.0;
    vec2 p1, p2, frontDir, poleAxis, front;
    float span, b, y1, y2;
    float r2 = uRadius * uRadius;
    float r4 = r2 * r2;
    float r6 = r2 * r4;
    float b2, b4, b6, y1_2, y2_2, c1, c2, c3, c4, integ1, integ2, integArc;
    for (int i = 0; i < MAX_LOAD_EDGES_PER_MESH; ++i)
    {
        int index = i + uMeshStart;
        if (index >= uMeshEnd) {break;}
        vec4 packedEdge = getPackedCoord(index);
        p1 = packedEdge.xy;
        p2 = packedEdge.zw;
        // if (distance(p1, p2) < 0.001) continue;  // 这一句由CPU的顶点简化过程实现。
        front = p2 - p1;
        frontDir = normalize(front);  // edge direction
        poleAxis = vec2(frontDir.y, -frontDir.x);
        p1 -= coord;
        p2 -= coord;  // to relative
        b = dot(p1, poleAxis);
        y1 = dot(p1, frontDir) ;  // to local space
        y2 = dot(p2, frontDir) ;
        winding += (atan(y2 / b) - atan(y1 / b));  // 这里可能会除以0,但好像不导致错误的结果

        float distT = clamp(dot(-p1, front) / dot(front, front), 0.0, 1.0);
        float distToEdge = length(distT * front + p1);
        if (abs(distToEdge) >= uRadius){
            continue;
        }  // not intersecting

        b2 = b * b;
        span = sqrt(r2 - b2);
        y1 = clamp(y1, -span, span);
	    y2 = clamp(y2, -span, span);
        b4 = b2 * b2;
        b6 = b4 * b2;
        r4 = r2 * r2;
        r6 = r4 * r2;
        y1_2 = y1 * y1;
        y2_2 = y2 * y2;
        c1 = b * (0.5 - 0.75 * b2 / r2 + 0.5 * b4 / r4 - 0.125 * b6 / r6);
        c2 = b * (-0.25 / r2 + 1.0/3.0 * b2 / r4 - 0.125 * b4 / r6);
        c3 = b * (0.1 / r4 - 0.075 * b2 / r6);	
        c4 = b * (-1.0 / 56.0 / r6);
        integ1 = (((c4 * y1_2 + c3) * y1_2 + c2) * y1_2 + c1) * y1;
        integ2 = (((c4 * y2_2 + c3) * y2_2 + c2) * y2_2 + c1) * y2;
        integArc = 0.1250 * r2 * (atan(y2 / b) - atan(y1 / b));
        feather += (integ2 - integ1 - integArc) / (r2 * PI_4);
    }
    winding /= _2PI; 
    return feather + winding;
}

void main()
{
    float opacity = gatherFeather(vGeometry);
    opacity = clamp(opacity, 0.0, 1.0);
    gl_FragColor = vec4(opacity, 0.0, 0.0, 0.0);
}