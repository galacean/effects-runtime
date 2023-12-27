import type { ShaderData } from '@galacean/effects';
import { DataType } from '@galacean/effects';
import { v4 as uuidv4 } from 'uuid';
import trailFrag from './trail.fs.glsl';
import trailVert from './trail.vs.glsl';

export class TrailShader {
  static properties = `_StartColor("StartColor",Color) = (1,1,1,1)
    _EndColor("EndColor",Color) = (1,1,1,1)`;
  static vertex = trailVert;
  static fragment = trailFrag;

  static getShaderData (): ShaderData {
    const shaderData: ShaderData = {
      id: uuidv4().replace(/-/g, ''),
      dataType:DataType.Shader,
      vertex:TrailShader.vertex,
      fragment:TrailShader.fragment,
    };

    return shaderData;
  }
}
