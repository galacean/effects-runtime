#ifdef HAS_TARGET_POSITION0
vsIn vec3 a_Target_Position0;
#endif

#ifdef HAS_TARGET_POSITION1
vsIn vec3 a_Target_Position1;
#endif

#ifdef HAS_TARGET_POSITION2
vsIn vec3 a_Target_Position2;
#endif

#ifdef HAS_TARGET_POSITION3
vsIn vec3 a_Target_Position3;
#endif

#ifdef HAS_TARGET_POSITION4
vsIn vec3 a_Target_Position4;
#endif

#ifdef HAS_TARGET_POSITION5
vsIn vec3 a_Target_Position5;
#endif

#ifdef HAS_TARGET_POSITION6
vsIn vec3 a_Target_Position6;
#endif

#ifdef HAS_TARGET_POSITION7
vsIn vec3 a_Target_Position7;
#endif

#ifdef HAS_TARGET_NORMAL0
vsIn vec3 a_Target_Normal0;
#endif

#ifdef HAS_TARGET_NORMAL1
vsIn vec3 a_Target_Normal1;
#endif

#ifdef HAS_TARGET_NORMAL2
vsIn vec3 a_Target_Normal2;
#endif

#ifdef HAS_TARGET_NORMAL3
vsIn vec3 a_Target_Normal3;
#endif

#ifdef HAS_TARGET_NORMAL4
vsIn vec3 a_Target_Normal4;
#endif

#ifdef HAS_TARGET_TANGENT0
vsIn vec3 a_Target_Tangent0;
#endif

#ifdef HAS_TARGET_TANGENT1
vsIn vec3 a_Target_Tangent1;
#endif

#ifdef HAS_TARGET_TANGENT2
vsIn vec3 a_Target_Tangent2;
#endif

#ifdef HAS_TARGET_TANGENT3
vsIn vec3 a_Target_Tangent3;
#endif

#ifdef HAS_TARGET_TANGENT4
vsIn vec3 a_Target_Tangent4;
#endif

#ifdef USE_MORPHING
uniform float _morphWeights[WEIGHT_COUNT];
#endif

#ifdef HAS_JOINT_SET1
vsIn vec4 a_Joint1;
#endif

#ifdef HAS_JOINT_SET2
vsIn vec4 a_Joint2;
#endif

#ifdef HAS_WEIGHT_SET1
vsIn vec4 a_Weight1;
#endif

#ifdef HAS_WEIGHT_SET2
vsIn vec4 a_Weight2;
#endif

#ifdef USE_SKINNING
#ifdef USE_SKINNING_TEXTURE
uniform sampler2D _jointMatrixSampler;
uniform sampler2D _jointNormalMatrixSampler;
#else
uniform mat4 _jointMatrix[JOINT_COUNT];
uniform mat4 _jointNormalMatrix[JOINT_COUNT];
#endif
#endif

// these offsets assume the texture is 4 pixels across
#define ROW0_U ((0.5 + 0.0) / 4.0)
#define ROW1_U ((0.5 + 1.0) / 4.0)
#define ROW2_U ((0.5 + 2.0) / 4.0)
#define ROW3_U ((0.5 + 3.0) / 4.0)
 
#ifdef USE_SKINNING
mat4 getJointMatrix(float boneNdx) {
    #ifdef USE_SKINNING_TEXTURE
    float v = (boneNdx + 0.5) / float(JOINT_COUNT);
    return mat4(
        texture2D(_jointMatrixSampler, vec2(ROW0_U, v)),
        texture2D(_jointMatrixSampler, vec2(ROW1_U, v)),
        texture2D(_jointMatrixSampler, vec2(ROW2_U, v)),
        texture2D(_jointMatrixSampler, vec2(ROW3_U, v))
    );
    #else
    return _jointMatrix[int(boneNdx)];
    #endif
}

mat4 getJointNormalMatrix(float boneNdx) {
    #ifdef USE_SKINNING_TEXTURE
    float v = (boneNdx + 0.5) / float(JOINT_COUNT);
    return mat4(
        texture2D(_jointNormalMatrixSampler, vec2(ROW0_U, v)),
        texture2D(_jointNormalMatrixSampler, vec2(ROW1_U, v)),
        texture2D(_jointNormalMatrixSampler, vec2(ROW2_U, v)),
        texture2D(_jointNormalMatrixSampler, vec2(ROW3_U, v))
    );
    #else
    return _jointNormalMatrix[int(boneNdx)];
    #endif
}

mat4 getSkinningMatrix()
{
    mat4 skin = mat4(0);

    #if defined(HAS_WEIGHT_SET1) && defined(HAS_JOINT_SET1)
    skin +=
        a_Weight1.x * getJointMatrix(a_Joint1.x) +
        a_Weight1.y * getJointMatrix(a_Joint1.y) +
        a_Weight1.z * getJointMatrix(a_Joint1.z) +
        a_Weight1.w * getJointMatrix(a_Joint1.w);
    #endif

    return skin;
}

mat4 getSkinningNormalMatrix()
{
    mat4 skin = mat4(0);

    #if defined(HAS_WEIGHT_SET1) && defined(HAS_JOINT_SET1)
    skin +=
        a_Weight1.x * getJointNormalMatrix(a_Joint1.x) +
        a_Weight1.y * getJointNormalMatrix(a_Joint1.y) +
        a_Weight1.z * getJointNormalMatrix(a_Joint1.z) +
        a_Weight1.w * getJointNormalMatrix(a_Joint1.w);
    #endif

    return skin;
}
#endif // !USE_SKINNING

#ifdef USE_MORPHING
vec4 getTargetPosition()
{
    vec4 pos = vec4(0);

#ifdef HAS_TARGET_POSITION0
    pos.xyz += _morphWeights[0] * a_Target_Position0;
#endif

#ifdef HAS_TARGET_POSITION1
    pos.xyz += _morphWeights[1] * a_Target_Position1;
#endif

#ifdef HAS_TARGET_POSITION2
    pos.xyz += _morphWeights[2] * a_Target_Position2;
#endif

#ifdef HAS_TARGET_POSITION3
    pos.xyz += _morphWeights[3] * a_Target_Position3;
#endif

#ifdef HAS_TARGET_POSITION4
    pos.xyz += _morphWeights[4] * a_Target_Position4;
#endif

    return pos;
}

vec4 getTargetNormal()
{
    vec4 normal = vec4(0);

#ifdef HAS_TARGET_NORMAL0
    normal.xyz += _morphWeights[0] * a_Target_Normal0;
#endif

#ifdef HAS_TARGET_NORMAL1
    normal.xyz += _morphWeights[1] * a_Target_Normal1;
#endif

#ifdef HAS_TARGET_NORMAL2
    normal.xyz += _morphWeights[2] * a_Target_Normal2;
#endif

#ifdef HAS_TARGET_NORMAL3
    normal.xyz += _morphWeights[3] * a_Target_Normal3;
#endif

#ifdef HAS_TARGET_NORMAL4
    normal.xyz += _morphWeights[4] * a_Target_Normal4;
#endif

    return normal;
}

vec4 getTargetTangent()
{
    vec4 tangent = vec4(0);

#ifdef HAS_TARGET_TANGENT0
    tangent.xyz += _morphWeights[0] * a_Target_Tangent0;
#endif

#ifdef HAS_TARGET_TANGENT1
    tangent.xyz += _morphWeights[1] * a_Target_Tangent1;
#endif

#ifdef HAS_TARGET_TANGENT2
    tangent.xyz += _morphWeights[2] * a_Target_Tangent2;
#endif

#ifdef HAS_TARGET_TANGENT3
    tangent.xyz += _morphWeights[3] * a_Target_Tangent3;
#endif

#ifdef HAS_TARGET_TANGENT4
    tangent.xyz += _morphWeights[4] * a_Target_Tangent4;
#endif

    return tangent;
}

#endif // !USE_MORPHING