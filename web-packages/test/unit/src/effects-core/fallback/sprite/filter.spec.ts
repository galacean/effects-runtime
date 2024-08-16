/**
 * 主要用于测试 filter 字段被过滤掉
 */
import type { spec } from '@galacean/effects';
import { getStandardJSON } from '@galacean/effects';

const { expect } = chai;

describe('core/fallback/filter', () => {
  it('filter 元素被过滤掉', () => {
    const json = '{"images":[],"version":"1.5","type":"mars","compositions":[{"id":"28","name":"欢呼粒子","duration":3,"startTime":0,"endBehavior":2,"previewSize":[750,750],"items":[{"id":"557","name":"face","duration":2,"type":"2","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"shape":{"shape":"Cone","radius":0.6,"arc":360,"arcMode":0,"angle":33,"type":2,"alignSpeedDirection":false,"turbulenceX":[0,0],"turbulenceY":[0,0],"turbulenceZ":[0,0]},"splits":[[0.5400390625,0.0009765625,0.3125,0.078125,0]],"options":{"startColor":[8,[1,1,1,1]],"maxCount":100,"startLifetime":[4,[1,1.4]],"startDelay":[0,0],"startSize":[4,[0.2,0.4]],"sizeAspect":[0,1],"start3DSize":false,"startRotationZ":[4,[0,360]]},"renderer":{"renderMode":1,"texture":0},"emission":{"rateOverTime":[0,0],"burstOffsets":[{"index":0,"x":0,"y":0,"z":0},{"index":1,"x":0,"y":0,"z":0},{"index":2,"x":0,"y":0,"z":0}],"bursts":[{"time":0,"count":22,"cycles":1,"interval":0},{"time":0.5,"count":22,"cycles":1,"interval":0},{"time":1,"count":22,"cycles":1,"interval":0}]},"positionOverLifetime":{"asMovement":false,"speedOverLifetime":[6,[[0,1,0,0],[0.2169,0.8442,-1.3,-1.22],[0.4336,0.1332,-0.4662,-0.5119],[1,0,0,0]]],"linearY":[0,0],"linearX":[0,0],"linearZ":[0,0],"startSpeed":[4,[9,16]],"gravity":[0,-7,0],"gravityOverLifetime":[0,1]},"sizeOverLifetime":{"size":[5,[[0,0.8],[0.2547,1.4018],[1,1.6]]]},"rotationOverLifetime":{"asRotation":false,"z":[4,[260,400]]},"colorOverLifetime":{"opacity":[5,[[0,0],[0.1769,1],[0.8198,1],[1,0]]]},"textureSheetAnimation":{"col":4,"animate":false,"total":0,"row":1}}},{"id":"562","name":"filter_447","duration":5,"type":"8","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"options":{},"filter":{"name":"bloom","radius":32,"colorThreshold":[220,220,220],"bloomAddon":[0,0.6],"colorAddon":[0,0.7]},"renderer":{"renderMode":0},"positionOverLifetime":{"path":[2,[0,0,0]]}},"transform":{"position":[0,0,-0.000002098084138424383],"rotation":[0,0,0],"scale":[9,9,1]}}]}],"compositionId":"28","bins":[],"textures":[{"source":0,"flipY":true},{"source":1,"flipY":true}]}';
    const result = getStandardJSON(JSON.parse(json));
    const filterItems = result.items.filter(item => item.type === '8' as spec.ItemType);

    expect(filterItems.length).eq(0);
  });

  it('过滤逻辑不影响不包含 filter 元素的合成', () => {
    const json = '{"playerVersion":{"web":"1.6.5","native":"0.0.1.202311221223"},"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*zWTWTIIi0-EAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*fzoHTblnpQcAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"fonts":[],"spines":[],"version":"2.4","shapes":[],"plugins":[],"type":"ge","compositions":[{"id":"1","name":"烟花","duration":5,"startTime":0,"endBehavior":0,"previewSize":[0,0],"items":[{"id":"14","name":"item_1","duration":4.5,"type":"2","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"shape":{"shape":"Sphere","radius":0.1,"arc":360,"arcMode":3,"type":1,"alignSpeedDirection":false},"options":{"startColor":[13,[[0.3333,0.9373,0.7686,1],[0.5059,0.9255,0.9255,1],[0.4549,0.7255,1,1],[0.6353,0.6078,0.9961,1],[0.8745,0.902,0.9137,1],[0,0.7216,0.5804,1],[0,0.8078,0.7882,1],[0.0353,0.5176,0.8902,1],[0.4235,0.3608,0.9059,1],[1,0.9176,0.6549,1],[0.9804,0.6941,0.6275,1],[1,0.4627,0.4588,1],[0.9922,0.4745,0.6588,1],[0.9922,0.7961,0.4314,1],[0.8824,0.4392,0.3333,1],[0.8392,0.1882,0.1922,1],[0.9098,0.2627,0.5765,1]]],"maxCount":200,"startLifetime":[4,[1,1.4]],"startDelay":[0,0],"startSize":[4,[0.1,0.15]],"sizeAspect":[0,1],"start3DSize":false,"startRotationZ":[4,[0,360]],"startRotationX":[4,[0,360]],"startRotationY":[4,[0,360]]},"renderer":{"renderMode":0,"texture":0,"blending":0},"emission":{"rateOverTime":[0,0],"bursts":[{"time":0,"count":80,"cycles":3,"interval":1}],"burstOffsets":[{"index":0,"x":0,"y":2,"z":0},{"index":0,"x":-2,"y":0,"z":-1},{"index":0,"x":2,"y":1,"z":0}]},"positionOverLifetime":{"speedOverLifetime":[21,[[3,[0,1,0.34,1]],[2,[0.005,0,1,0]]]],"startSpeed":[4,[5,5.8]],"gravity":[0,-2,0],"gravityOverLifetime":[0,1]},"rotationOverLifetime":{"separateAxes":true,"x":[4,[180,360]],"y":[4,[180,360]],"z":[4,[180,360]]},"colorOverLifetime":{"opacity":[21,[[4,[0,1]],[4,[0.4831,1]],[4,[0.7937,0]],[4,[1,0]]]]},"textureSheetAnimation":{"col":2,"row":2}},"transform":{"position":[0,1,0],"rotation":[0,0,0],"scale":[1,1,1]}}],"camera":{"fov":60,"far":20,"near":0.1,"clipMode":0,"position":[0,0,8],"rotation":[0,0,0]}}],"requires":[],"compositionId":"1","bins":[],"textures":[{"source":0,"flipY":true}]}';
    const result = getStandardJSON(JSON.parse(json));
    const filterItems = result.items.filter(item => item.type === '8' as spec.ItemType);

    expect(filterItems.length).eq(0);
  });

  it('particle filter 被过滤掉', () => {
    const json = '{"images":[],"spines":[],"version":"1.5","shapes":[],"plugins":[],"type":"mars","compositions":[{"id":"25","name":"distortion","duration":5,"startTime":0,"endBehavior":0,"previewSize":[0,0],"items":[{"id":"36","name":"distortion","duration":5,"type":"2","visible":true,"endBehavior":4,"delay":0,"renderLevel":"B+","content":{"shape":{"shape":"None","radius":1,"arc":360,"arcMode":0,"type":0},"options":{"startColor":[8,[1,1,1,1]],"maxCount":1,"startLifetime":[0,5],"startDelay":[0,0],"start3DSize":true,"startSizeX":[0,6],"startSizeY":[0,9]},"renderer":{"texture":0,"order":1},"emission":{"rateOverTime":[0,5]},"positionOverLifetime":{"startSpeed":[0,0],"gravityOverLifetime":[0,1]},"rotationOverLifetime":{"asRotation":true,"z":[0,5]},"filter":{"name":"distortion","center":[0.5,0],"direction":[0.2,1],"strength":[0,0.008],"period":[0,6],"waveMovement":[5,[[0,0],[1,6]]]}},"transform":{"position":[1.723219445898673,3.100635886398397,0],"rotation":[0,0,0],"scale":[1,1,1]}},{"id":"37","name":"virus","duration":5,"type":"1","visible":true,"endBehavior":4,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"texture":1,"order":2},"positionOverLifetime":{},"splits":[[0.001953125,0.001953125,0.673828125,0.619140625,0]]},"transform":{"position":[-0.14902922818470277,-0.1669679315773056,0],"rotation":[0,0,0],"scale":[3.5,3.2159420289855074,1]}}]}],"requires":[],"compositionId":"25","bins":[],"textures":[{"source":0,"flipY":true},{"source":1,"flipY":true}]}';
    const result = getStandardJSON(JSON.parse(json));
    const filterItems = result.items.filter(item => {
      if (item.type === '2' as spec.ItemType && item.content.filter) {
        return true;
      }

      return false;
    });

    expect(filterItems.length).eq(0);
  });
});
