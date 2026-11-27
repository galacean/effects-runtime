uniform highp sampler2D effects_GizmoSceneDepth;
uniform highp vec4 effects_GizmoSceneDepthViewport;
uniform bool effects_GizmoSceneDepthEnabled;

void testSceneDepth() {
  if (effects_GizmoSceneDepthEnabled) {
    highp vec2 uv = (gl_FragCoord.xy - effects_GizmoSceneDepthViewport.xy) / effects_GizmoSceneDepthViewport.zw;
    highp float sceneDepth = texture2D(effects_GizmoSceneDepth, uv).r;
    // Allow one depth-24 quantization step for coplanar outlines.
    if (gl_FragCoord.z > sceneDepth + 1.0 / 16777216.0) {
      discard;
    }
  }
}
