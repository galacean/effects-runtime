import type {
  BaseItem, BaseItemTransform, Composition, CompressedImage, Image, JSONScene, JSONSceneLegacy,
  ParticleItem, RenderLevel, SpriteItem, TemplateImage,
} from '@galacean/effects-specification';
import { CAMERA_CLIP_MODE_NORMAL, EndBehavior, ItemType, JSONSceneVersion } from '@galacean/effects-specification';
import { generateGUID } from '../utils';
import { getStandardCameraContent } from './camera';
import { getStandardInteractContent } from './interact';
import {
  version21Migration,
  version22Migration,
  version24Migration,
  version30Migration,
  version31Migration,
  version32Migration,
} from './migration';
import { getStandardParticleContent } from './particle';
import { getStandardNullContent, getStandardSpriteContent } from './sprite';
import { arrAdd, quatFromXYZRotation, rotationZYXFromQuat } from './utils';

export * from './utils';

const v0 = /^(\d+)\.(\d+)\.(\d+)(-(\w+)\.\d+)?$/;
const standardVersion = /^(\d+)\.(\d+)$/;
let reverseParticle = false;

export function getStandardJSON (json: any): JSONScene {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid input: Expected a JSON object.');
  }

  // 修正老版本数据中，meshItem 以及 lightItem 结束行为错误问题
  version22Migration(json);

  if (v0.test(json.version)) {
    reverseParticle = (/^(\d+)/).exec(json.version)?.[0] === '0';

    return version32Migration(version31Migration(version30Migration(version21Migration(getStandardJSONFromV0(json)))));
  }

  reverseParticle = false;

  let vs = standardVersion.exec(json.version) || [];
  let mainVersion = Number(vs[1]);
  let minorVersion = Number(vs[2]);

  if (mainVersion) {
    if (mainVersion < 2 || (mainVersion === 2 && minorVersion < 4)) {
      json = version24Migration(json);
    }
    if (mainVersion < 3) {
      json = version30Migration(version21Migration(json));
    }
    // 版本号重新计算
    vs = standardVersion.exec(json.version) || [];
    mainVersion = Number(vs[1]);
    minorVersion = Number(vs[2]);
    // 3.x 版本格式转换
    if (mainVersion < 4) {
      if (minorVersion < 2) {
        json = version31Migration(json);
      }
      if (minorVersion < 3) {
        json = version32Migration(json);
      }
    }

    return json;
  }

  throw new Error(`Invalid JSON version: ${json.version}.`);
}

let currentVersion: JSONSceneVersion = JSONSceneVersion['1_0'];

function getStandardJSONFromV0 (json: any): JSONSceneLegacy {
  currentVersion = JSONSceneVersion['1_0'];
  const plugins = json.plugins || [];

  if (json.bins?.length) {
    currentVersion = JSONSceneVersion['1_3'];
  }
  const requires: string[] = (json.requires || []).slice();
  const images = json.images.map((img: any, index: number) => getStandardImage(img, index, json.imageTags || []));
  const textures = json.textures || images.map((img: any, i: number) => ({ source: i, flipY: true }));
  const ret: JSONSceneLegacy = {
    plugins: plugins,
    shapes: json.shapes || [],
    type: 'ge',
    version: currentVersion,
    playerVersion: json.playerVersion ?? {
      web: '',
      native: '',
    },
    compositionId: json.compositionId + '',
    compositions: json.compositions.map((comp: any) => getStandardComposition(comp, { plugins, requires })),
    images,
    imgUsage: json._imgs,
    binUsage: json.binUsage,
    spines: json.spines,
    requires: json.requires,
    textures,
    bins: (json.bins || []).slice(),
  };

  if (json._textures) {
    (ret as any)._textures = json._textures;
  }

  return ret;
}

export function getStandardImage (image: any, index: number, imageTags: RenderLevel[]): TemplateImage | Image | CompressedImage {
  const renderLevel = imageTags[index];

  if (typeof image === 'string') {
    return {
      id: generateGUID(),
      renderLevel,
      url: image,
    };
  } else if (image.template) {
    return {
      id: generateGUID(),
      url: image.url,
      template: image.template,
      webp: image.webp,
      renderLevel,
    };
  } else if (image.compressed) {
    return {
      id: generateGUID(),
      url: image.url,
      compressed: {
        astc: image.compressed.android,
        pvrtc: image.compressed.iOS,
      },
      webp: image.webp,
      renderLevel,
    };
  } else if (image.url) {
    return {
      id: generateGUID(),
      url: image.url,
      webp: image.webp,
      renderLevel,
    };
  } else if (image && image.sourceType) {
    return image;
  }
  throw new Error('Invalid image type.');
}

export function getStandardComposition (composition: any, opt: { plugins?: string[], requires?: string[] } = {}): Composition {
  const ret: Composition = {
    id: composition.id + '',
    camera: { clipMode: CAMERA_CLIP_MODE_NORMAL, ...composition.camera },
    duration: composition.duration,
    endBehavior: composition.endBehavior,
    items: composition.items.map((item: any) => getStandardItem(item, opt)),
    name: composition.name,
  };
  const startTime = composition.startTime || composition.st;

  if (startTime) {
    ret.startTime = startTime;
  }
  let previewSize = composition.meta?.previewSize;

  if (previewSize && previewSize[0] === previewSize[1] && previewSize[0] === 0) {
    previewSize = undefined;
  }
  if (previewSize) {
    ret.previewSize = previewSize;
  }

  return ret;
}

const tempQuat = [0, 0, 0, 1];
const stdAnchor = 0.5;

export function getStandardItem (item: any, opt: { plugins?: string[], requires?: string[] } = {}): SpriteItem | ParticleItem | BaseItem {
  let type: ItemType | string = ItemType.base;
  let transform: BaseItemTransform;
  let originContent;
  let content;
  let endBehavior: EndBehavior = item.endBehavior;
  let renderLevel: RenderLevel;
  let pluginName: string;
  let duration = NaN;
  let pn: number;

  if (item.content) {
    type = item.type || ItemType.plugin;
    pn = item.pn;
    pluginName = item.pluginName;
    content = item.content;
    originContent = item.content;
    if (isNaN(pn) && !pluginName) {
      pluginName = content.options.type;
    }
    if (item.duration) {
      duration = item.duration;
    }
    transform = item.transform || getTransform(originContent.transform);
  } else if (item.particle) {
    type = ItemType.particle;
    originContent = item.particle;
    transform = getTransform(originContent.transform, reverseParticle, true);
    content = getStandardParticleContent(originContent);
  } else if (item.sprite) {
    type = ItemType.sprite;
    originContent = item.sprite;
    transform = getTransform(originContent.transform, false, true);
    content = getStandardSpriteContent(originContent, transform);
  } else if (item.cal) {
    type = ItemType.null;
    originContent = item.cal;
    transform = getTransform(originContent.transform, false, true);
    content = getStandardNullContent(originContent, transform);
  } else if (item.ui) {
    type = ItemType.interact;
    originContent = item.ui;
    transform = getTransform(originContent.transform);
    content = getStandardInteractContent(originContent);
    transform.scale = [originContent.options.width || 1, originContent.options.height || 1, 1];
  } else if (item.model) {
    originContent = item.model;
    if (item.model.options.type === 1) {
      type = ItemType.camera;
      transform = getTransform(originContent.transform);
      content = getStandardCameraContent(originContent);
    }
  }
  if (content.renderer?.anchor) {
    const anchor = new Float32Array(content.renderer.anchor);

    if (anchor[0] == stdAnchor && anchor[1] == stdAnchor) {
      delete content.renderer.anchor;
    } else if (opt.requires) {
      arrAdd(opt.requires, 'anchor');
    }
  }
  if (originContent) {
    const looping = originContent.options?.looping;

    if (looping) {
      if (Array.isArray(looping)) {
        endBehavior = looping[1] ? EndBehavior.restart : EndBehavior.destroy;
      } else {
        endBehavior = EndBehavior.restart;
      }
    } else {
      endBehavior = endBehavior || originContent?.options?.endBehavior || EndBehavior.destroy;
    }
    if (originContent.options.renderLevel) {
      renderLevel = originContent.options.renderLevel;
    }
    if (isNaN(duration)) {
      duration = originContent.options.duration;
    }
  }

  const ret: BaseItem = {
    type,
    name: item.name,
    delay: item.delay,
    duration,
    id: item.id + '',
    // @ts-expect-error
    transform,
    endBehavior,
    // @ts-expect-error
    renderLevel,
    content,
  };

  // @ts-expect-error
  if (pluginName) {
    if (opt.plugins) {
      arrAdd(opt.plugins, pluginName);
      ret.pn = opt.plugins.indexOf(pluginName);
    } else {
      ret.pluginName = pluginName;
    }
    // @ts-expect-error
  } else if (Number.isInteger(pn)) {
    // @ts-expect-error
    ret.pn = pn;
  }
  if (item.parentId) {
    ret.parentId = item.parentId + '';
  }

  return ret;

  function getTransform (originTransform: BaseItemTransform, inverseRotation?: boolean, changeOrder?: boolean): BaseItemTransform {
    if (originTransform) {
      const transform: BaseItemTransform = {};
      const rotation = originTransform.rotation;

      if (rotation) {
        if (inverseRotation) {
          transform.rotation = [-rotation[0], -rotation[1], -rotation[2]];
        } else {
          transform.rotation = [rotation[0], rotation[1], rotation[2]];
        }
        if (changeOrder) {
          const q = quatFromXYZRotation(tempQuat, transform.rotation[0], transform.rotation[1], transform.rotation[2]);

          transform.rotation = rotationZYXFromQuat([], q);
        }
      }
      const position = originTransform.position;

      if (position) {
        transform.position = originTransform.position;
      }
      if (Array.isArray(originTransform.scale)) {
        transform.scale = [originTransform.scale[0] || 1, originTransform.scale[1] || 1, originTransform.scale[2] || 1];
      }

      return transform;
    }

    return {};
  }
}

