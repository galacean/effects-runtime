const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
function load(name) {
  const filename = path.join(__dirname, '../src/2d/modes', name + '.ts');
  const code = ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module = {exports:{}}; new Function('require','module','exports',code)(id=>load(path.basename(id)),module,module.exports);return module.exports;
}
const m=load('spatial-math'), c=load('camera-math');
test('ray planes and axes use world geometry and reject parallel/behind hits',()=>{
 const ray={origin:{x:2,y:3,z:8},direction:{x:0,y:0,z:-1}};
 assert.deepEqual(m.rayPlanePoint(ray,{x:0,y:0,z:2},{x:0,y:0,z:1}),{x:2,y:3,z:2});
 assert.equal(m.rayPlanePoint(ray,{x:0,y:0,z:10},{x:0,y:0,z:1}),undefined);
 assert.equal(m.rayAxisParameter(ray,{x:0,y:0,z:0},{x:1,y:0,z:0}),2);
 assert.equal(m.rayAxisParameter(ray,{x:0,y:0,z:0},{x:0,y:0,z:1}),undefined);
});
test('orbit preserves target and radius, and avoids polar singularities',()=>{
 const before={position:{x:0,y:0,z:10},target:{x:0,y:0,z:0},up:{x:0,y:1,z:0},fov:60};
 for(const dy of [-1e6,1e6,0]) {const after=c.orbitEditorCamera(before,90,dy);assert.ok(Math.abs(m.length3(m.sub3(after.position,after.target))-10)<1e-10);assert.deepEqual(after.target,before.target);assert.ok(Math.abs(after.position.y)<10);}
 assert.deepEqual(before.position,{x:0,y:0,z:10});
});
test('dolly cannot cross the target or exceed the editor distance limits',()=>{
 const before={position:{x:0,y:0,z:10},target:{x:0,y:0,z:0},up:{x:0,y:1,z:0},fov:60};
 assert.equal(c.dollyEditorCamera(before,0).position.z,0.001);assert.equal(c.dollyEditorCamera(before,1e9).position.z,1e6);
});

test('free look fixes the eye and fly preserves the viewing direction',()=>{
 const before={position:{x:0,y:2,z:10},target:{x:0,y:2,z:0},up:{x:0,y:1,z:0},fov:60};
 const look=c.lookEditorCamera(before,60,30);assert.deepEqual(look.position,before.position);assert.ok(Math.abs(m.length3(m.sub3(look.target,look.position))-10)<1e-10);
 const fly=c.flyEditorCamera(look,1,1,1,2);const a=m.sub3(look.target,look.position),b=m.sub3(fly.target,fly.position);for(const k of ['x','y','z'])assert.ok(Math.abs(a[k]-b[k])<1e-10);
});
test('grid clipping rejects invisible segments and clips crossing segments at the camera plane',()=>{
 const camera={position:{x:0,y:0,z:0},target:{x:0,y:0,z:-1},up:{x:0,y:1,z:0},fov:60};
 assert.equal(c.clipEditorSegment(camera,{x:0,y:0,z:1},{x:1,y:0,z:2}),undefined);
 const pair=c.clipEditorSegment(camera,{x:0,y:0,z:1},{x:0,y:0,z:-1});assert.ok(Math.abs(pair[0].z+0.01)<1e-10);assert.equal(pair[1].z,-1);
});
