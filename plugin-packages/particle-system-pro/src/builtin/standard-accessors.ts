import type { ProDataSetLayout } from '../data/data-set-layout';
import {
  ProFloatAccessor, ProInt32Accessor, ProVec2Accessor, ProVec3Accessor, ProVec4Accessor,
} from '../data/data-accessor';
import { ProStandardVariableNames } from './standard-variables';

/**
 * 把所有 standard 变量的强类型 accessor 一次性缓存下来。
 *
 * Module 直接拿现成的 accessor 用，避免每个 module 自己再 new 一遍、
 * 也避免 layout 变更时漏掉某个引用。
 */
export class ProStandardAccessors {
  age: ProFloatAccessor;
  lifetime: ProFloatAccessor;
  position: ProVec3Accessor;
  velocity: ProVec3Accessor;
  color: ProVec4Accessor;
  size: ProVec2Accessor;
  rotation: ProFloatAccessor;
  subUVFrame: ProFloatAccessor;
  initialColor: ProVec4Accessor;
  initialSize: ProVec2Accessor;
  ribbonId: ProInt32Accessor;
  uniqueId: ProInt32Accessor;
  cameraOffset: ProFloatAccessor;
  mass: ProFloatAccessor;
  previousPosition: ProVec3Accessor;
  ribbonLinkOrder: ProFloatAccessor;
  ribbonWidth: ProFloatAccessor;
  initialRibbonWidth: ProFloatAccessor;
  ribbonUVDistance: ProFloatAccessor;
  initialPosition: ProVec3Accessor;
  randomSeed: ProFloatAccessor;
  noiseOffset: ProVec3Accessor;
  scale: ProVec3Accessor;
  previousSpriteSize: ProVec2Accessor;
  previousSpriteRotation: ProFloatAccessor;
  previousScale: ProVec3Accessor;
  previousRibbonWidth: ProFloatAccessor;
  previousVelocity: ProVec3Accessor;

  constructor (layout: ProDataSetLayout) {
    this.age = new ProFloatAccessor(layout, ProStandardVariableNames.Age);
    this.lifetime = new ProFloatAccessor(layout, ProStandardVariableNames.Lifetime);
    this.position = new ProVec3Accessor(layout, ProStandardVariableNames.Position);
    this.velocity = new ProVec3Accessor(layout, ProStandardVariableNames.Velocity);
    this.color = new ProVec4Accessor(layout, ProStandardVariableNames.Color);
    this.size = new ProVec2Accessor(layout, ProStandardVariableNames.Size);
    this.rotation = new ProFloatAccessor(layout, ProStandardVariableNames.Rotation);
    this.subUVFrame = new ProFloatAccessor(layout, ProStandardVariableNames.SubUVFrame);
    this.initialColor = new ProVec4Accessor(layout, ProStandardVariableNames.InitialColor);
    this.initialSize = new ProVec2Accessor(layout, ProStandardVariableNames.InitialSize);
    this.ribbonId = new ProInt32Accessor(layout, ProStandardVariableNames.RibbonID);
    this.uniqueId = new ProInt32Accessor(layout, ProStandardVariableNames.UniqueID);
    this.cameraOffset = new ProFloatAccessor(layout, ProStandardVariableNames.CameraOffset);
    this.mass = new ProFloatAccessor(layout, ProStandardVariableNames.Mass);
    this.previousPosition = new ProVec3Accessor(layout, ProStandardVariableNames.PreviousPosition);
    this.ribbonLinkOrder = new ProFloatAccessor(layout, ProStandardVariableNames.RibbonLinkOrder);
    this.ribbonWidth = new ProFloatAccessor(layout, ProStandardVariableNames.RibbonWidth);
    this.initialRibbonWidth = new ProFloatAccessor(layout, ProStandardVariableNames.InitialRibbonWidth);
    this.ribbonUVDistance = new ProFloatAccessor(layout, ProStandardVariableNames.RibbonUVDistance);
    this.initialPosition = new ProVec3Accessor(layout, ProStandardVariableNames.InitialPosition);
    this.randomSeed = new ProFloatAccessor(layout, ProStandardVariableNames.RandomSeed);
    this.noiseOffset = new ProVec3Accessor(layout, ProStandardVariableNames.NoiseOffset);
    this.scale = new ProVec3Accessor(layout, ProStandardVariableNames.Scale);
    this.previousSpriteSize = new ProVec2Accessor(layout, ProStandardVariableNames.PreviousSpriteSize);
    this.previousSpriteRotation = new ProFloatAccessor(layout, ProStandardVariableNames.PreviousSpriteRotation);
    this.previousScale = new ProVec3Accessor(layout, ProStandardVariableNames.PreviousScale);
    this.previousRibbonWidth = new ProFloatAccessor(layout, ProStandardVariableNames.PreviousRibbonWidth);
    this.previousVelocity = new ProVec3Accessor(layout, ProStandardVariableNames.PreviousVelocity);
  }
}
