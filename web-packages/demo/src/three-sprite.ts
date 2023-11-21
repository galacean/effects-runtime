// @ts-nocheck
import { AssetManager, ThreeTexture, setConfig, PLAYER_OPTIONS_ENV_EDITOR } from '@galacean/effects-threejs';
import { createThreePlayer, renderbyThreeDisplayObject } from './common/three-display-object';
import inspireList from './assets/inspire-list';

const json = inspireList.camera.url;

(async () => {
  // 检查交互元素用
  setConfig('runtime_env', PLAYER_OPTIONS_ENV_EDITOR);
  const threePlayer = createThreePlayer({
    container: document.getElementById('J-container'),
    pixelRatio: window.devicePixelRatio,
  });

  void renderbyThreeDisplayObject(threePlayer, json);
  void renderThreeSprite();
})();

async function renderThreeSprite () {
  const container = document.getElementById('J-threeContainer');
  const width = container.getBoundingClientRect().width;
  const height = container.getBoundingClientRect().height;
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer();
  const camera = new THREE.PerspectiveCamera(80, width / height, 0.1, 1000);

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  camera.position.set(0, 0, 2);
  camera.lookAt(scene.position);

  const assetManager = new AssetManager({
    pendingCompile: true,
  });
  const res = await assetManager.loadScene(json);
  const options = res.textureOptions[0];
  const texture = new ThreeTexture(null, options);

  scene.add(getDataTextureMesh());
  scene.add(await getNormalTextureMesh(texture));
  scene.add(getRawShaderMesh(texture));
  scene.add(getRawShaderMeshWithUbo(texture));
  scene.add(getRawShaderLine());

  (function render () {
    renderer.render(scene, camera);

    requestAnimationFrame(render);
  })();
}

// 使用dataTexture创建material
function getDataTextureMesh () {
  const w = 512;
  const h = 512;

  const size = w * h;
  const data = new Uint8Array(4 * size);

  const r = Math.floor(Math.random() * 255);
  const g = Math.floor(Math.random() * 255);
  const b = Math.floor(Math.random() * 255);

  for (let i = 0; i < size; i++) {

    const stride = i * 4;

    data[stride] = r;
    data[stride + 1] = g;
    data[stride + 2] = b;
    data[stride + 3] = Math.random() * 255;

  }
  const t = new THREE.DataTexture(data, w, h);

  t.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t }));

  sprite.position.set(0, 0, 0);
  sprite.scale.set(1, 1, 0);

  return sprite;
}

// 使用 @galacean/effects-core assetmanager加载的图片创建texture
async function getNormalTextureMesh (texture) {
  // 加载纹理
  const material = new THREE.SpriteMaterial({ map: texture.texture, color: 0xffffff });
  const mesh = new THREE.Sprite(material);

  mesh.position.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);

  return mesh;
}

// 自定义shader（不带ubo）
function getRawShaderMesh (texture) {
  const vertexShader = `
  precision mediump float;
  attribute vec2 uv;
  attribute vec3 position;
  uniform mat4 effects_ObjectToWorld;
  uniform mat4 effects_MatrixInvV;
  uniform mat4 uProjection;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = uProjection * effects_MatrixInvV * effects_ObjectToWorld * vec4(position,1.0);
  }`;
  const fragmentShader = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    void main()
    {
        gl_FragColor = texture2D(uTexture, vUv);
    }
  `;
  const shaderMaterial = new THREE.RawShaderMaterial({
    uniforms:
    {
      'uTexture': { value: null },
      'effects_ObjectToWorld': { value: null },
      'effects_MatrixInvV': { value: null },
      'uProjection': { value: null },
    },
    vertexShader,
    fragmentShader,
  });

  shaderMaterial.uniforms.uTexture.value = texture.texture;
  const gg = new THREE.BufferGeometry();
  const POINTS = 4;
  const vertices = new Float32Array([
    -0.2, -0.2, 1.0, 0.0, 0.0, // x,y,z,u,v
    0.2, -0.2, 1.0, 1.0, 0.0,
    0.2, 0.2, 1.0, 1.0, 1.0,
    -0.2, 0.2, 1.0, 0.0, 1.0,
  ]);
  const ver = new Float32Array(5 * POINTS);
  const indices = new Uint8Array([0, 1, 2, 0, 2, 3]);
  const vertexBuffer = new THREE.InterleavedBuffer(ver, 5);

  gg.setAttribute('position', new THREE.InterleavedBufferAttribute(vertexBuffer, 3, 0, false));
  gg.setAttribute('uv', new THREE.InterleavedBufferAttribute(vertexBuffer, 2, 3, false));
  gg.setIndex(new THREE.BufferAttribute(indices, 1));
  for (let i = 0; i < vertices.length; i++) {
    ver[i] = vertices[i];
  }
  gg.drawRange.start = 0;
  gg.drawRange.count = indices.length;
  const ss = new THREE.Mesh(gg, shaderMaterial);

  ss.position.set(0, 0.5, 0);
  ss.scale.set(1, 1, 1);
  ss.onBeforeRender = function (renderer, scene, camera, geometry, material) {
    const uniformsMap = {
      'effects_ObjectToWorld': ss.matrixWorld,
      'effects_MatrixInvV': camera.matrixWorldInverse,
      'uProjection': camera.projectionMatrix,
    };

    for (const [key, value] of Object.entries(uniformsMap)) {
      material.uniforms[key].value = value;
    }
    material.uniformsNeedUpdate = true;
  };

  return ss;
}

function getRawShaderMeshWithUbo (texture) {
  const vertexShader = `
  layout(std140) uniform ViewData {
    mat4 projectionMatrix;
    mat4 viewMatrix;
    mat4 modelMatrix;
  };
  in vec2 uv;
  in vec3 position;
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0);
  }`;
  const fragmentShader = `
    precision highp float;
    in vec2 vUv;
    uniform sampler2D uTexture;
    out vec4 fragColor;
    void main()
    {
        fragColor = texture(uTexture, vUv);
    }
  `;
  const shaderMaterial = new THREE.RawShaderMaterial({
    uniforms:
    {
      'uTexture': { value: null },
      'uModel': { value: null },
      'uView': { value: null },
      'uProjection': { value: null },
    },
    vertexShader,
    fragmentShader,
    glslVersion: THREE.GLSL3,
  });
  const viewDataGroup = new THREE.UniformsGroup();

  viewDataGroup.setName('ViewData');
  viewDataGroup.add(new THREE.Uniform(new THREE.Matrix4())); // projection matrix
  viewDataGroup.add(new THREE.Uniform(new THREE.Matrix4())); // view matrix
  viewDataGroup.add(new THREE.Uniform(new THREE.Matrix4())); // model Matrix

  shaderMaterial.uniformsGroups = [viewDataGroup];
  shaderMaterial.uniforms.uTexture.value = texture.texture;
  const gg = new THREE.BufferGeometry();
  const POINTS = 4;
  const vertices = new Float32Array([
    -0.2, -0.2, 1.0, 0.0, 0.0, // x,y,z,u,v
    0.2, -0.2, 1.0, 1.0, 0.0,
    0.2, 0.2, 1.0, 1.0, 1.0,
    -0.2, 0.2, 1.0, 0.0, 1.0,
  ]);
  const ver = new Float32Array(5 * POINTS);
  const indices = new Uint8Array([0, 1, 2, 0, 2, 3]);
  const vertexBuffer = new THREE.InterleavedBuffer(ver, 5);

  gg.setAttribute('position', new THREE.InterleavedBufferAttribute(vertexBuffer, 3, 0, false));
  gg.setAttribute('uv', new THREE.InterleavedBufferAttribute(vertexBuffer, 2, 3, false));
  gg.setIndex(new THREE.BufferAttribute(indices, 1));
  for (let i = 0; i < vertices.length; i++) {
    ver[i] = vertices[i];
  }
  gg.drawRange.start = 0;
  gg.drawRange.count = indices.length;
  const ss = new THREE.Mesh(gg, shaderMaterial);

  ss.position.set(-0.5, 0, 0);
  ss.scale.set(1, -1, 1);
  ss.onBeforeRender = function (renderer, scene, camera, geometry, material) {
    const viewData = material.uniformsGroups[0].uniforms;

    viewData[0].value = camera.projectionMatrix;
    viewData[1].value = camera.matrixWorldInverse;
    viewData[2].value = ss.matrixWorld;
    material.uniformsNeedUpdate = true;
  };

  return ss;
}

// 自定义material gl.LINES
function getRawShaderLine () {
  const vertexShader = `
  precision mediump float;
  attribute vec2 position;
  uniform mat4 effects_ObjectToWorld;
  uniform mat4 effects_MatrixInvV;
  uniform mat4 uProjection;
  uniform vec4 uColor;
  varying vec4 vColor;
  void main() {
    gl_Position = uProjection * effects_MatrixInvV * effects_ObjectToWorld * vec4(position,0.0,1.0);
    vColor = uColor;
  }`;
  const fragmentShader = `
    precision mediump float;
    varying vec4 vColor;
    void main()
    {
        gl_FragColor = vColor;
    }
  `;
  const shaderMaterial = new THREE.RawShaderMaterial({
    uniforms:
    {
      'uColor': { value: [0.6, 1, 1, 1] },
      'effects_ObjectToWorld': { value: null },
      'effects_MatrixInvV': { value: null },
      'uProjection': { value: null },
    },
    vertexShader,
    fragmentShader,
  });

  const gg = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -0.5, -0.5,
    0.5, -0.5,
    0.5, 0.5,
    -0.5, 0.5,
  ]);

  // gl.LINES使用
  const indices = new Uint8Array([0, 1, 1, 2, 2, 3, 3, 0]);
  const vertexBuffer = new THREE.InterleavedBuffer(vertices, 2);

  gg.setAttribute('position', new THREE.InterleavedBufferAttribute(vertexBuffer, 2, 0, false));
  gg.setIndex(new THREE.BufferAttribute(indices, 1));
  // gl.LINES使用
  const ss = new THREE.LineSegments(gg, shaderMaterial);

  ss.position.set(1, 0, 0);
  ss.onBeforeRender = function (renderer, scene, camera, geometry, material) {
    const uniformsMap = {
      'effects_ObjectToWorld': ss.matrixWorld,
      'effects_MatrixInvV': camera.matrixWorldInverse,
      'uProjection': camera.projectionMatrix,
    };

    for (const [key, value] of Object.entries(uniformsMap)) {
      material.uniforms[key].value = value;
    }
    material.uniformsNeedUpdate = true;
  };

  return ss;
}
