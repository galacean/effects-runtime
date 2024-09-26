//@ts-nocheck
import * as libtess from 'libtess';

const tessy = (function initTesselator () {
  // function called for each vertex of tesselator output
  function vertexCallback (data, polyVertArray) {
    // console.log(data[0], data[1]);
    polyVertArray[polyVertArray.length] = data[0];
    polyVertArray[polyVertArray.length] = data[1];
  }
  function begincallback (type) {
    if (type !== libtess.primitiveType.GL_TRIANGLES) {
      console.info('expected TRIANGLES but got type: ' + type);
    }
  }
  function errorcallback (errno) {
    console.error('error callback, error number: ' + errno);
  }
  // callback for when segments intersect and must be split
  function combinecallback (coords, data, weight) {
    // console.log('combine callback');
    return [coords[0], coords[1], coords[2]];
  }
  function edgeCallback (flag) {
    // don't really care about the flag, but need no-strip/no-fan behavior
    // console.log('edge flag: ' + flag);
  }

  const tessy = new libtess.GluTesselator();

  // tessy.gluTessProperty(libtess.gluEnum.GLU_TESS_WINDING_RULE, libtess.windingRule.GLU_TESS_WINDING_POSITIVE);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, vertexCallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN, begincallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, errorcallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, combinecallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG, edgeCallback);

  return tessy;
})();

export function triangulate (contours) {
  // libtess will take 3d verts and flatten to a plane for tesselation
  // since only doing 2d tesselation here, provide z=1 normal to skip
  // iterating over verts only to get the same answer.
  // comment out to test normal-generation code
  tessy.gluTessNormal(0, 0, 1);

  const triangleVerts = [];

  tessy.gluTessBeginPolygon(triangleVerts);

  for (let i = 0; i < contours.length; i++) {
    tessy.gluTessBeginContour();
    const contour = contours[i];

    for (let j = 0; j < contour.length; j += 2) {
      const coords = [contour[j], contour[j + 1], 0];

      tessy.gluTessVertex(coords, coords);
    }
    tessy.gluTessEndContour();
  }

  // finish polygon
  tessy.gluTessEndPolygon();

  return triangleVerts;
}