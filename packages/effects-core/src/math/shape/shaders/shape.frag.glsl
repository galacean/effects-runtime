precision highp float;
#include "./gradient.glsl"

uniform sampler2D _ImageTex;           // 图片纹理
uniform vec2 _ImageSize;               // 图片尺寸 (px)
uniform vec2 _DestSize;                // 目标区域尺寸 (px)
uniform int _ImageScaleMode;           // 图片缩放模式 (0:FILL 覆盖, 1:FIT 适应, 2:CROP 裁剪, 3:TILE 平铺)
uniform mat3 _TextureTransform;          // 图片UV变换矩阵
uniform float _ImageScalingFactor;     // 平铺缩放因子( 仅 _ImageScaleMode==3 生效), 1=一屏一张
uniform float _ImageOpacity;           // 图片不透明度 0..1

varying vec2 uv0;

// 应用2D变换到UV
vec2 applyTransform(mat3 m, vec2 uv) {
    uv = uv - vec2(0.5, 0.5);

    vec3 p = m * vec3(uv, 1.0);

    p.xy = p.xy + vec2(0.5, 0.5);

    return p.xy;
}

void main() {
    vec4 finalColor = vec4(1.0);

    if(_FillType == 0.0 || _FillType == 1.0 || _FillType == 2.0 || _FillType == 3.0) {
        finalColor = evalGradient(uv0);
    } else if(_FillType == 4.0) {
        // 图片填充 (Image Paint)
        vec2 uv = uv0;

        // 计算宽高比
        float rSrc = _ImageSize.x / max(_ImageSize.y, 1.0);
        float rDst = _DestSize.x / max(_DestSize.y, 1.0);

        // 根据模式调整采样UV
        bool maskOutside = false;
        if(_ImageScaleMode == 0) {
            // FILL 覆盖（可能裁剪）
            vec2 scale = vec2(1.0);
            if(rDst > rSrc) {
                scale = vec2(1.0, rSrc / rDst);
            } else {
                scale = vec2(rDst / rSrc, 1.0);
            }
            uv = (uv - 0.5) * scale + 0.5;
            uv = clamp(uv, 0.0, 1.0);
        } else if(_ImageScaleMode == 1) {
            // FIT 适应（保留空白）
            vec2 scale = vec2(1.0);
            if(rDst > rSrc) {
                scale = vec2(rSrc / rDst, 1.0);
            } else {
                scale = vec2(1.0, rSrc / rDst);
            }
            uv = (uv - 0.5) * scale + 0.5;
            maskOutside = true;
        } else if(_ImageScaleMode == 2) {
            // CROP 指定裁剪矩形
            uv = applyTransform(_TextureTransform, uv0);
            maskOutside = true;
        } else if(_ImageScaleMode == 3) {
            // TILE 平铺(保持源图比例,不随容器uv拉伸)
            // 1) 按“目标/源”宽高比做 uv 轴向校正，使单瓦片单元为源图比例
            float aspectFix = rDst / max(rSrc, 1e-6);
            vec2 uvTile = (uv0 - 0.5) * vec2(aspectFix, 1.0) + 0.5;

            // 2) 可选：应用仅含旋转/平移的 _TextureTransform(若包含非等比缩放会再次引入拉伸)
            // uvTile = applyTransform(_TextureTransform, uvTile);

            // 3) 重复密度（正值放大重复次数，支持负值时可用 sign 控制翻转）
            float s = max(abs(_ImageScalingFactor), 1e-6);
            uv = fract(uvTile * s);
        }

        vec4 img = texture2D(_ImageTex, uv);

        // 对于 FIT/CROP 模式，区域外设为透明
        if(maskOutside) {
            if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                img.a = 0.0;
            }
        }

        img.a *= _ImageOpacity;
        finalColor = img;
    }

    finalColor.rgb *= finalColor.a;
    gl_FragColor = finalColor;
}