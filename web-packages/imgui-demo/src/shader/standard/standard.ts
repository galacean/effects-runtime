import { spec } from '@galacean/effects';
import properties from './properties';

const vertex = `
precision highp float;

attribute vec3 aPos;

varying vec3 v_CameraPosObj;
varying vec3 v_ViewDirObj;
varying vec3 v_PosObj;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_ObjectToWorld;
uniform vec3 effects_WorldSpaceCameraPos;

void main() {
  mat4 m_WorldToObject = inverse(effects_ObjectToWorld);

  vec3 cameraPosObj=(m_WorldToObject*vec4(effects_WorldSpaceCameraPos,1.)).xyz;
  v_CameraPosObj=cameraPosObj;
  v_ViewDirObj=aPos.xyz-cameraPosObj;
  v_PosObj=aPos.xyz;

  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos.xyz, 1.0);
}
`;

const fragment = `
precision highp float;

uniform vec2 u_LayerTilingOffset;
uniform sampler2D u_BgTex;
uniform sampler2D u_DeskTex;

uniform float u_CubeDepth;// 实际 3d 场景的远平面深度
uniform float u_UVDepth;// 正面透视纹理的两个侧面大小占比

varying vec3 v_CameraPosObj;
varying vec3 v_ViewDirObj;
varying vec3 v_PosObj;

void main(){
  
  // 射线与标准 AABB 求交
  // t 是射线和 AABB 的 x、y、z 平面相交的时间
  // t=(1-p)/view=1/view-p/view
  
  // 和家具所在平面（ z = u_CubeDepth/2 ）求交
  float t1z1=abs(u_CubeDepth/2./v_ViewDirObj.z)-v_PosObj.z/v_ViewDirObj.z;
  
  // 和虚拟立方体求交 （x:[-1,1],y:[-1,1],z:[0,u_CubeDepth]）
  // 远平面（ z = -u_CubeDepth ）
  float t1z=abs(u_CubeDepth/v_ViewDirObj.z)-v_PosObj.z/v_ViewDirObj.z;
  // 侧面（ x = +- 1 ）
  float t1x=abs(1./v_ViewDirObj.x)-v_PosObj.x/v_ViewDirObj.x;
  // 侧面（ y = +- 1 ）
  float t1y=abs(1./v_ViewDirObj.y)-v_PosObj.y/v_ViewDirObj.y;
  // 和虚拟立方体的实际交点
  float tMin=min(min(t1x,t1y),t1z);
  
  vec4 col;
  vec3 origin=vec3(v_PosObj.xy,0.);// ray 原点
  
  if(t1z1>tMin){
    // ray 先打到虚拟立方体时,采样虚拟立方体
    // 实际交点的坐标
    vec3 pos=origin+tMin*v_ViewDirObj;// ray 和虚拟立方体的交点，pos = rayOrigin + tmin * rayDir
    pos.z=-pos.z/u_CubeDepth;// pos: x,y: [-1,1],z: [0,1]。z 越大越深。让 pos 的 x,y 范围为 [-1,1] 是为了计算方便。如果为[0,1]，需要以 0.5 为轴算偏移量。
    // *假设* 3D => 2D 的映射关系是*线形*的，代入几个特殊交点 P 可以算出下面的映射的公式。比如 P =（1,0,1）时， uv = (1 - u_UVDepth, 0)
    // 事实上只要美术素材符合要求，那它就是线形的
    vec2 uv=pos.xy*(1.-u_UVDepth*pos.z);// pos.z 越大，uv 偏移越大。pos.z 最大值对应的 偏移量 = 2 * 单个侧面占纹理大小的比例。乘 2 是因为 pos 的 x,y 范围是 [-1,1]。
    uv=(uv+1.)/2.;// [-1,1] => [0,1]
    
    col=texture2D(u_BgTex, uv);
  }else{
    // ray 先打到家具层时，采样家具层
    vec3 pos=origin+t1z1*v_ViewDirObj;// ray 和家具层的交点
    pos.z=-pos.z/u_CubeDepth;
    vec2 uv=pos.xy*(1.-u_UVDepth*pos.z);
    uv=(uv+1.)/2.;
    col=texture2D(u_DeskTex, uv);
    
    if(col.a<.1){
      // 如果家具层交点是透明的，采样虚拟立方体。
      vec3 pos=origin+tMin*v_ViewDirObj;
      pos.z=-pos.z/u_CubeDepth;
      vec2 uv=pos.xy*(1.-u_UVDepth*pos.z);
      uv=(uv+1.)/2.;
      col=texture2D(u_BgTex, uv);
    }
  }
  gl_FragColor=col;
}
`;

const shader: spec.ShaderData = {
  vertex,
  fragment,
  properties,
  id: '90ed7bbc1c364b3097b502b4a0f13d5c',
  dataType: spec.DataType.Shader,
};

export default shader;
