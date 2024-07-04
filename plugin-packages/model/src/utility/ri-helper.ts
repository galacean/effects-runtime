import type { GeometryProps, Engine } from '@galacean/effects';
import { glContext, Geometry, Material, Mesh, RenderPassAttachmentStorageType } from '@galacean/effects';
import type { Matrix4 } from '../runtime/math';
import { Vector2, Vector3 } from '../runtime/math';

/**
 * FBO 选项类，负责构造 FBO 创建时的选项信息
 */
export class FBOOptions {
  /**
   * 分辨率
   */
  resolution: Vector2;
  /**
   * 颜色附件列表
   */
  colorAttachments: object[];
  /**
   * 深度附件
   */
  depthAttachment?: any;

  /**
   * 构造函数
   * @param options - FBO 参数
   */
  constructor (options: Record<string, any>) {
    this.resolution = options.resolution ?? new Vector2(512, 512);
    this.colorAttachments = options.colorAttachments ?? [];
    this.depthAttachment = options.depthAttachment;
  }

  /**
   * 添加深度附件
   * @param options - 深度附件参数
   */
  addDepthAttachment (options: Record<string, any>) {
    this.depthAttachment = {
      storageType: options.storageType ?? RenderPassAttachmentStorageType.depth_16_texture,
    };
  }

  /**
   * 添加默认深度附件，数据格式是 depth_16_texture
   */
  addDefaultDepthAttachment () {
    this.depthAttachment = { storageType: RenderPassAttachmentStorageType.depth_16_texture };
  }

  /**
   * 删除深度附件
   */
  deleteDepthAttachment () {
    this.depthAttachment = undefined;
  }

  /**
   * 添加颜色附件
   * @param options - 颜色附件参数
   */
  addColorAttachment (options: Record<string, any>) {
    this.colorAttachments.push({
      texture: {
        format: options.format ?? glContext.RGBA,
        type: options.type ?? glContext.HALF_FLOAT,
        minFilter: options.filter ?? glContext.LINEAR,
        magFilter: options.filter ?? glContext.LINEAR,
      },
    });
  }

  /**
   * 删除颜色附件，按照索引值
   * @param target - 颜色附件索引值
   */
  deleteColorAttachment (target: number) {
    if (target >= 0 && target < this.colorAttachments.length) {
      this.colorAttachments.splice(target, 1);
    }
  }

  /**
   * 获取视口大小
   */
  get viewport (): [number, number, number, number] {
    return [0, 0, this.resolution.x, this.resolution.y];
  }
}

/**
 * 包围盒 Mesh 类，负责 3D Mesh 测试包围盒的显示
 */
export class BoxMesh {
  /**
   * core 层 Mesh 对象
   */
  mesh: Mesh;

  /**
   * 构造函数，创建基础 Mesh 对象
   * @param engine - 引擎
   * @param priority - 优先级
   */
  constructor (engine: Engine, priority: number) {
    const material = Material.create(
      engine,
      {
        shader: {
          vertex: this.vertexShader,
          fragment: this.fragmentShader,
          shared: true,
        },
      }
    );

    material.depthTest = true;
    material.depthMask = true;
    this.mesh = Mesh.create(
      engine,
      {
        name: 'boxMesh',
        material,
        geometry: Geometry.create(engine, this.geometry),
        priority,
      }
    );
  }

  /**
   * 更新包围盒着色器 Uniform 数据
   * @param modelMatrix - 模型矩阵
   * @param viewProjMatrix - 相机投影矩阵
   * @param positions - 位置数组
   * @param lineColor - 线颜色
   */
  update (modelMatrix: Matrix4, viewProjMatrix: Matrix4, positions: Float32Array, lineColor: Vector3) {
    const material = this.mesh.material;

    material.setMatrix('_ModelMatrix', modelMatrix);
    material.setMatrix('_ViewProjectionMatrix', viewProjMatrix);
    for (let i = 0; i < positions.length; i += 3) {
      material.setVector3(`_PositionList[${i / 3}]`, Vector3.fromArray(positions, i));
    }
    material.setVector3('_LineColor', lineColor);
  }

  /**
   * 销毁，需要销毁 Mesh 对象
   */
  dispose () {
    this.mesh.dispose();
    // @ts-expect-error
    this.mesh = undefined;
  }

  /**
   * 获取顶点着色器代码
   */
  get vertexShader (): string {
    return `
      precision highp float;

      uniform mat4 _ModelMatrix;
      uniform mat4 _ViewProjectionMatrix;
      uniform vec3 _PositionList[8];
      attribute vec3 aPos;
      void main(){
        int index = int(aPos.x + 0.5);
        vec4 pos = _ModelMatrix * vec4(_PositionList[index], 1);
        gl_Position = _ViewProjectionMatrix * pos;
      }
    `;
  }

  /**
   * 获取片段着色器代码
   */
  get fragmentShader (): string {
    return `
      precision highp float;

      uniform vec3 _LineColor;
      void main(){
        gl_FragColor = vec4(_LineColor, 1);
      }
    `;
  }

  /**
   * 获取基础几何体
   */
  get geometry (): GeometryProps {
    const data = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const index = new Uint32Array([
      0, 1, 1, 2, 2, 3, 3, 0,
      4, 5, 5, 6, 6, 7, 7, 4,
      0, 4, 1, 5, 2, 6, 3, 7,
    ]);

    return {
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 1,
          data,
          stride: Float32Array.BYTES_PER_ELEMENT,
          offset: 0,
        },
      },
      mode: glContext.LINES,
      indices: { data: index },
      drawStart: 0,
      drawCount: 24,
    };
  }
}
