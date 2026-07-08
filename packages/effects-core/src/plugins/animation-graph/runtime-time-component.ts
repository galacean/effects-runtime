export type AnimationGraphRuntimeTimeComponent = {
  setAnimationGraphRuntimeTime: (duration: number, activeValue: number) => void,
  clearAnimationGraphRuntimeTime: () => void,
};

export type AnimationGraphRuntimeTimeCleaner = Pick<AnimationGraphRuntimeTimeComponent, 'clearAnimationGraphRuntimeTime'>;
